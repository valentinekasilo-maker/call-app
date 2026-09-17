import React, { useState } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, Grid, Activity, ShieldCheck } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { formatAppId } from '@callapp/shared';

export const ActiveCallModal: React.FC<{ onOpenAudioSettings?: () => void }> = ({
  onOpenAudioSettings,
}) => {
  const { callState, activeCall, endCall, isMuted, toggleMute, localAudioLevel } = useCall();
  const [showInCallKeypad, setShowInCallKeypad] = useState<boolean>(false);

  if (callState !== 'active_call' || !activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-app)',
        backdropFilter: 'blur(36px) saturate(190%)',
        WebkitBackdropFilter: 'blur(36px) saturate(190%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        padding: '3.5rem 1.5rem 3.5rem 1.5rem',
      }}
    >
      {/* ── Caller & Status Header ───────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginBottom: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ShieldCheck size={14} color="var(--accent-call)" />
          <span>CallApp HD Audio</span>
        </div>

        <h1
          style={{
            fontSize: '2.1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: '0.2rem',
          }}
        >
          {activeCall.remoteName}
        </h1>

        <div
          style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
          }}
        >
          {formatAppId(activeCall.remoteAppId)}
        </div>

        {/* Call Duration Counter */}
        <div
          style={{
            fontSize: '1.4rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {formatDuration(activeCall.duration)}
        </div>

        {/* Subtle Live Audio Level Equalizer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '16px',
            marginTop: '0.75rem',
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map(bar => {
            const active = !isMuted && localAudioLevel >= bar * 10;
            return (
              <div
                key={bar}
                style={{
                  width: '3px',
                  height: active ? `${Math.min(16, Math.max(4, bar * 2))}px` : '3px',
                  backgroundColor: active ? 'var(--accent-call)' : 'var(--border-glass)',
                  borderRadius: '2px',
                  transition: 'height 0.08s ease',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ── Center Avatar ────────────────────────────────────────── */}
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          fontSize: '2.25rem',
          fontWeight: 600,
        }}
      >
        {activeCall.remoteName ? activeCall.remoteName.charAt(0).toUpperCase() : 'U'}
      </div>

      {/* ── Circular In-Call Controls Matrix ──────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2.25rem',
          width: '100%',
          maxWidth: '320px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            width: '100%',
            justifyItems: 'center',
          }}
        >
          {/* Mute Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={toggleMute}
              className={`ios-call-ctrl-btn ${isMuted ? 'active' : ''}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isMuted ? 'unmute' : 'mute'}
            </span>
          </div>

          {/* Keypad Toggle Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setShowInCallKeypad(prev => !prev)}
              className={`ios-call-ctrl-btn ${showInCallKeypad ? 'active' : ''}`}
              title="Keypad"
            >
              <Grid size={24} />
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              keypad
            </span>
          </div>

          {/* Speaker / Audio Settings Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onOpenAudioSettings}
              className="ios-call-ctrl-btn"
              title="Audio Output / Speaker"
            >
              <Volume2 size={24} />
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              speaker
            </span>
          </div>
        </div>

        {/* ── Large Red End Call Button ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={endCall}
            className="ios-hangup-button"
            title="End Call"
          >
            <PhoneOff size={32} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-hangup)', fontWeight: 600 }}>
            End Call
          </span>
        </div>
      </div>
    </div>
  );
};
