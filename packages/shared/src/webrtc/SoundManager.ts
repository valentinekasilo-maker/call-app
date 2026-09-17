/**
 * Professional Sound Manager for Internet Voice Calling.
 * Synthesizes realistic phone ringtones, ringbacks, and feedback chimes
 * using the Web Audio API with zero external media dependencies.
 */

export class SoundManager {
  private static audioCtx: AudioContext | null = null;
  private static ringInterval: any = null;
  private static ringbackInterval: any = null;
  private static isPlayingRingtone = false;
  private static isPlayingRingback = false;
  private static volume = 0.8;
  private static autoplayUnlocked = false;

  public static isSoundEnabled = true;

  /**
   * Safe AudioContext initializer with user-interaction unlock fallback.
   */
  private static getAudioContext(): AudioContext | null {
    if (!this.isSoundEnabled || typeof window === 'undefined') return null;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {
          // Autoplay policy blocked; register one-time unlock listener
          this.setupAutoplayUnlock();
        });
      }

      return this.audioCtx;
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not supported or blocked:', e);
      return null;
    }
  }

  /**
   * Set up one-time listener to resume AudioContext as soon as the user interacts with the window.
   */
  private static setupAutoplayUnlock(): void {
    if (this.autoplayUnlocked || typeof window === 'undefined') return;

    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.autoplayUnlocked = true;
          // If we were supposed to be playing a ringtone, re-trigger it
          if (this.isPlayingRingtone) {
            this.playRingtonePattern();
          }
        }).catch(() => {});
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  /**
   * Explicitly resume/unlock the Web Audio context during a user gesture (e.g. Accept/Call click).
   */
  static unlockAudio(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Set master sound volume (0.0 to 1.0).
   */
  static setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
  }

  /**
   * Play a single harmonic bell / marimba note.
   */
  private static playNote(freq: number, startTime: number, duration: number, gainValue = 0.25): void {
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sine wave with soft harmonic
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Exponential decay envelope (warm acoustic bell sound)
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainValue * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      // Ignore oscillator errors
    }
  }

  /**
   * Single iteration of incoming acoustic ringtone pattern (iOS-inspired harmonic chord cadence).
   */
  private static playRingtonePattern(): void {
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;

    // Pattern: 4 melodic chord pairs reminiscent of modern phone bells
    const notes = [
      // Phrase 1
      { freq: 523.25, time: 0.00, dur: 0.22, gain: 0.28 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.24, gain: 0.32 }, // E5
      { freq: 783.99, time: 0.20, dur: 0.28, gain: 0.35 }, // G5
      { freq: 1046.50, time: 0.35, dur: 0.40, gain: 0.38 }, // C6

      // Phrase 2
      { freq: 587.33, time: 0.65, dur: 0.22, gain: 0.28 }, // D5
      { freq: 698.46, time: 0.73, dur: 0.24, gain: 0.32 }, // F5
      { freq: 880.00, time: 0.85, dur: 0.30, gain: 0.35 }, // A5
      { freq: 1174.66, time: 1.00, dur: 0.45, gain: 0.40 }, // D6

      // Chime resonance accent
      { freq: 1318.51, time: 1.25, dur: 0.55, gain: 0.35 }, // E6
      { freq: 1046.50, time: 1.45, dur: 0.65, gain: 0.32 }, // C6
    ];

    for (const n of notes) {
      this.playNote(n.freq, now + n.time, n.dur, n.gain);
    }
  }

  /**
   * Play Incoming Call Ringtone.
   * Loops seamlessly until stopped, with strict single-instance guarantee.
   */
  static playRingtone(): void {
    if (this.isPlayingRingtone) return; // Prevent duplicate loop
    this.stopAll();

    this.isPlayingRingtone = true;

    // Trigger first iteration immediately
    this.playRingtonePattern();

    // Loop pattern every 2.8 seconds
    this.ringInterval = setInterval(() => {
      if (this.isPlayingRingtone) {
        this.playRingtonePattern();
      }
    }, 2800);
  }

  /**
   * Stops the incoming call ringtone immediately.
   */
  static stopRingtone(): void {
    this.isPlayingRingtone = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /**
   * Single iteration of outgoing standard ringback tone (440Hz + 480Hz dual-frequency).
   */
  private static playRingbackTone(): void {
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const duration = 1.6;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now); // Standard 440Hz

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now); // Standard 480Hz

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, now + 0.08);
      gain.gain.setValueAtTime(0.12 * this.volume, now + duration - 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {}
  }

  /**
   * Play Outgoing Ringback tone (loops every 4 seconds while ringing).
   */
  static playRingback(): void {
    if (this.isPlayingRingback) return;
    this.stopAll();

    this.isPlayingRingback = true;
    this.playRingbackTone();

    this.ringbackInterval = setInterval(() => {
      if (this.isPlayingRingback) {
        this.playRingbackTone();
      }
    }, 4000);
  }

  /**
   * Stops the outgoing ringback tone.
   */
  static stopRingback(): void {
    this.isPlayingRingback = false;
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }

  /**
   * Pleasant ascending connection chime when call is accepted.
   */
  static playConnectedSound(): void {
    this.stopAll();

    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    this.playNote(523.25, now + 0.00, 0.12, 0.20); // C5
    this.playNote(659.25, now + 0.10, 0.14, 0.25); // E5
    this.playNote(783.99, now + 0.22, 0.25, 0.30); // G5
  }

  /**
   * Gentle descending tone when call ends/hangs up.
   */
  static playEndedSound(): void {
    this.stopAll();

    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    this.playNote(493.88, now + 0.00, 0.14, 0.22); // B4
    this.playNote(392.00, now + 0.12, 0.28, 0.20); // G4
  }

  /**
   * Stops all active ringtones, ringbacks, and loops immediately.
   */
  static stopAll(): void {
    this.stopRingtone();
    this.stopRingback();
  }
}
