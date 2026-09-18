import React, { useState, useRef, useEffect } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Grid,
  ShieldCheck,
  SwitchCamera,
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { formatAppId, SoundManager } from '@callapp/shared';

export const ActiveCallModal: React.FC<{ onOpenAudioSettings?: () => void }> = ({
  onOpenAudioSettings,
}) => {
  const {
    callState,
    activeCall,
    endCall,
    isMuted,
    toggleMute,
    isVideoMuted,
    toggleVideoMute,
    switchCamera,
    localAudioLevel,
    localStream,
    remoteStream,
    availableVideoInputs,
  } = useCall();

  const [showInCallKeypad, setShowInCallKeypad] = useState<boolean>(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach local media stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote media stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState !== 'active_call' || !activeCall) return null;

  const isVideoCall = activeCall.callType === 'video';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasMultipleCameras = availableVideoInputs.length > 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        backdropFilter: 'blur(36px) saturate(190%)',
        WebkitBackdropFilter: 'blur(36px) saturate(190%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        padding: isVideoCall ? '1.5rem 1rem 2.5rem 1rem' : '3.5rem 1.5rem 3.5rem 1.5rem',
        overflow: 'hidden',
      }}
    >
      {/* ── VIDEO CALL BACKGROUND / MAIN VIEW ───────────────────── */}
      {isVideoCall ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#050505',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Fallback if remote video track is absent / audio only */}
          {(!remoteStream || remoteStream.getVideoTracks().length === 0) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle at center, rgba(10, 132, 255, 0.15) 0%, rgba(0,0,0,0.95) 75%)',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 100%)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '3rem',
                  fontWeight: 600,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  marginBottom: '1rem',
                }}
              >
                {activeCall.remoteName ? activeCall.remoteName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                Connecting video stream...
              </div>
            </div>
          )}

          {/* Local Video PiP Preview */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '110px',
              height: '160px',
              borderRadius: '16px',
              overflow: 'hidden',
              backgroundColor: '#1C1C1E',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
              zIndex: 15,
            }}
          >
            {!isVideoMuted && localStream && localStream.getVideoTracks().length > 0 ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirror local preview
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  gap: '6px',
                  backgroundColor: '#121214',
                }}
              >
                <VideoOff size={22} />
                <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>Cam Off</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Caller & Status Header ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
          background: isVideoCall ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
          padding: isVideoCall ? '10px 20px' : '0',
          borderRadius: isVideoCall ? '20px' : '0',
          backdropFilter: isVideoCall ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: isVideoCall ? 'blur(16px)' : 'none',
          border: isVideoCall ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          maxWidth: '90%',
        }}
      >
        <div
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {isVideoCall ? (
            <>
              <Video size={14} color="var(--accent-blue)" />
              <span style={{ color: '#0A84FF', fontWeight: 600 }}>CallApp HD Video</span>
            </>
          ) : (
            <>
              <ShieldCheck size={14} color="var(--accent-call)" />
              <span>CallApp HD Audio</span>
            </>
          )}
        </div>

        <h1
          style={{
            fontSize: isVideoCall ? '1.5rem' : '2.1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            marginBottom: '0.15rem',
          }}
        >
          {activeCall.remoteName}
        </h1>

        <div
          style={{
            fontSize: isVideoCall ? '0.85rem' : '1rem',
            color: 'var(--text-muted)',
            marginBottom: isVideoCall ? '0.25rem' : '0.75rem',
          }}
        >
          {formatAppId(activeCall.remoteAppId)}
        </div>

        {/* Call Duration Counter */}
        <div
          style={{
            fontSize: isVideoCall ? '1.1rem' : '1.4rem',
            fontWeight: 500,
            color: '#FFFFFF',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {formatDuration(activeCall.duration)}
        </div>

        {/* Live Audio Level Equalizer (Voice call mode) */}
        {!isVideoCall && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              marginTop: '0.75rem',
              height: '14px',
            }}
          >
            {[0.2, 0.4, 0.6, 0.8, 1.0, 0.8, 0.6, 0.4, 0.2].map((multiplier, i) => (
              <div
                key={i}
                style={{
                  width: '3px',
                  backgroundColor: isMuted ? 'var(--accent-hangup)' : 'var(--accent-call)',
                  borderRadius: '2px',
                  height: `${Math.max(4, localAudioLevel * 20 * multiplier)}px`,
                  transition: 'height 0.05s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Caller Avatar (Audio call mode) ────────────────────── */}
      {!isVideoCall && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '130px',
              height: '130px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 100%)',
              border: '2px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '3.5rem',
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            {activeCall.remoteName ? activeCall.remoteName.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      )}

      {/* ── In-Call Keypad Overlay (DTMF) ─────────────────────────── */}
      {showInCallKeypad && (
        <div
          className="liquid-glass-elevated animate-slide-up"
          style={{
            position: 'absolute',
            bottom: '180px',
            width: '280px',
            padding: '1.25rem',
            borderRadius: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            zIndex: 30,
            backgroundColor: 'rgba(20, 20, 24, 0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
            <button
              key={digit}
              onClick={() => {
                SoundManager.playDTMFTone(digit);
                SoundManager.triggerHaptic(15);
              }}
              style={{
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontSize: '1.2rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {digit}
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom In-Call Controls Dock ──────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: isVideoCall ? '400px' : '360px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isVideoCall ? '1.25rem' : '2rem',
          position: 'relative',
          zIndex: 20,
          background: isVideoCall ? 'rgba(0, 0, 0, 0.55)' : 'transparent',
          padding: isVideoCall ? '16px 14px' : '0',
          borderRadius: isVideoCall ? '28px' : '0',
          backdropFilter: isVideoCall ? 'blur(24px)' : 'none',
          WebkitBackdropFilter: isVideoCall ? 'blur(24px)' : 'none',
          border: isVideoCall ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
        }}
      >
        {/* Action Buttons Grid */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '0.75rem',
          }}
        >
          {/* Mute Microphone */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={toggleMute}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: isMuted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                color: isMuted ? '#000000' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <span style={{ fontSize: '0.72rem', color: isMuted ? '#FFFFFF' : 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              {isMuted ? 'Muted' : 'Mute'}
            </span>
          </div>

          {/* Video Call Camera Toggle (Video call mode) */}
          {isVideoCall && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={toggleVideoMute}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: isVideoMuted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                  color: isVideoMuted ? '#000000' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={isVideoMuted ? 'Start Video' : 'Stop Video'}
              >
                {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
              <span style={{ fontSize: '0.72rem', color: isVideoMuted ? '#FFFFFF' : 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {isVideoMuted ? 'Video Off' : 'Video On'}
              </span>
            </div>
          )}

          {/* Flip / Switch Camera (if multiple video inputs available) */}
          {isVideoCall && hasMultipleCameras && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => switchCamera()}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Switch Camera"
              >
                <SwitchCamera size={24} />
              </button>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                Flip
              </span>
            </div>
          )}

          {/* Keypad DTMF Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setShowInCallKeypad(!showInCallKeypad)}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: showInCallKeypad ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                color: showInCallKeypad ? '#000000' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Keypad"
            >
              <Grid size={24} />
            </button>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              Keypad
            </span>
          </div>

          {/* Audio Output Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onOpenAudioSettings}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Audio Settings"
            >
              <Volume2 size={24} />
            </button>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              Speaker
            </span>
          </div>
        </div>

        {/* End Call Button */}
        <button
          onClick={endCall}
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-hangup)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 59, 48, 0.45)',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
          }}
          title="End Call"
        >
          <PhoneOff size={30} />
        </button>
      </div>
    </div>
  );
};
