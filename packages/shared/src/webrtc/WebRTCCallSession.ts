import { WebRTCConfig } from '../types';

export type CallConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface WebRTCCallSessionEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: CallConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onError?: (error: Error) => void;
  onAudioLevel?: (level: number) => void; // 0 to 100 for local mic visualizer
}

export class WebRTCCallSession {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioLevelInterval: any = null;
  private isMuted = false;
  private isVideoMuted = false;
  private isVideoCall = false;
  private events: WebRTCCallSessionEvents = {};

  constructor(
    private config: WebRTCConfig,
    events: WebRTCCallSessionEvents = {}
  ) {
    this.events = events;
  }

  /**
   * Initializes local microphone and optional camera stream
   */
  async initLocalStream(
    audioDeviceId?: string,
    videoDeviceId?: string,
    isVideo: boolean = false
  ): Promise<MediaStream> {
    this.isVideoCall = isVideo;
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: isVideo
        ? {
            deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
          }
        : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.setupAudioAnalyser(this.localStream);
      this.events.onLocalStream?.(this.localStream);
      return this.localStream;
    } catch (err: any) {
      // Fallback: if video fails (e.g. no camera attached), try audio-only
      if (isVideo) {
        console.warn('Camera access failed, falling back to audio-only stream:', err);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: constraints.audio,
            video: false,
          });
          this.setupAudioAnalyser(this.localStream);
          this.events.onLocalStream?.(this.localStream);
          return this.localStream;
        } catch (audioErr: any) {
          const error = new Error(`Failed to access media devices: ${audioErr.message}`);
          this.events.onError?.(error);
          throw error;
        }
      }

      const error = new Error(`Failed to access microphone: ${err.message}`);
      this.events.onError?.(error);
      throw error;
    }
  }

  /**
   * Creates the RTCPeerConnection and attaches local media tracks
   */
  createPeerConnection(): RTCPeerConnection {
    const rtcConfig: RTCConfiguration = {
      iceServers: this.config.iceServers.length > 0
        ? this.config.iceServers
        : [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);
    this.remoteDescriptionSet = false;
    this.iceCandidateBuffer = [];

    // Attach local audio & video tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote media tracks
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.events.onRemoteStream?.(this.remoteStream);
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        this.events.onRemoteStream?.(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.events.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    // Handle Connection State changes
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.connectionState as CallConnectionState;
      this.events.onConnectionStateChange?.(state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        this.events.onConnectionStateChange?.(state as CallConnectionState);
      }
    };

    return this.peerConnection;
  }

  /**
   * Generates SDP Offer (Caller side)
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection!.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handles incoming SDP Offer and generates SDP Answer (Receiver side)
   */
  async handleOfferAndCreateAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offerSdp));
    this.remoteDescriptionSet = true;
    await this.flushIceCandidateBuffer();

    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handles incoming SDP Answer (Caller side)
   */
  async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.remoteDescriptionSet = true;
    await this.flushIceCandidateBuffer();
  }

  /**
   * Adds an ICE candidate, buffering if remote description is not yet set
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection || !this.remoteDescriptionSet) {
      this.iceCandidateBuffer.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  }

  private async flushIceCandidateBuffer(): Promise<void> {
    while (this.iceCandidateBuffer.length > 0) {
      const candidate = this.iceCandidateBuffer.shift();
      if (candidate && this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error adding buffered ICE candidate:', err);
        }
      }
    }
  }

  /**
   * Toggles microphone mute
   */
  setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    return this.isMuted;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Toggles camera video mute
   */
  setVideoMuted(muted: boolean): boolean {
    this.isVideoMuted = muted;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    return this.isVideoMuted;
  }

  getIsVideoMuted(): boolean {
    return this.isVideoMuted;
  }

  /**
   * Switch to a different video camera device
   */
  async switchCamera(videoDeviceId: string): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) return null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: videoDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return null;

      // Replace video track in localStream
      if (this.localStream) {
        const oldTracks = this.localStream.getVideoTracks();
        oldTracks.forEach(t => {
          this.localStream?.removeTrack(t);
          t.stop();
        });
        this.localStream.addTrack(newVideoTrack);
      }

      // Replace track on RTCPeerConnection sender
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      this.events.onLocalStream?.(this.localStream!);
      return this.localStream;
    } catch (e) {
      console.warn('Failed to switch camera:', e);
      return null;
    }
  }

  /**
   * Audio Level Visualizer setup
   */
  private setupAudioAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.audioLevelInterval = setInterval(() => {
        if (!this.audioAnalyser || this.isMuted) {
          this.events.onAudioLevel?.(0);
          return;
        }
        this.audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        this.events.onAudioLevel?.(normalized);
      }, 100);
    } catch (err) {
      console.warn('Audio analyser setup failed:', err);
    }
  }

  /**
   * Clean up all media tracks, intervals, and peer connection
   */
  close(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.iceCandidateBuffer = [];
    this.remoteDescriptionSet = false;
  }
}
