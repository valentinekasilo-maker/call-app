import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useContacts } from '../context/ContactsContext';
import { formatAppId } from '@callapp/shared';

export const IncomingCallModal: React.FC = () => {
  const { callState, activeCall, acceptCall, rejectCall } = useCall();
  const { resolveContactDisplayName } = useContacts();

  if (callState !== 'incoming_ringing' || !activeCall) return null;

  const isVideo = activeCall.callType === 'video';
  const displayName = resolveContactDisplayName(activeCall.remoteAppId, activeCall.remoteName);

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
        padding: '4rem 1.5rem 3.5rem 1.5rem',
      }}
    >
      {/* ── Caller Info ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '1rem' }}>
        <div
          style={{
            fontSize: '0.85rem',
            color: isVideo ? 'var(--accent-blue)' : 'var(--text-muted)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {isVideo ? (
            <>
              <Video size={16} color="#0A84FF" />
              <span>Incoming Video Call</span>
            </>
          ) : (
            <span>Incoming Voice Call</span>
          )}
        </div>

        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: '0.35rem',
          }}
        >
          {displayName}
        </h1>

        <div
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}
        >
          {formatAppId(activeCall.remoteAppId)}
        </div>
      </div>

      {/* ── Animated Center Avatar ───────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="animate-pulse-incoming"
          style={{
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            backgroundColor: isVideo ? 'var(--accent-blue)' : 'var(--accent-call)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '2.5rem',
            fontWeight: 600,
            boxShadow: isVideo
              ? '0 12px 36px rgba(10, 132, 255, 0.45)'
              : '0 12px 36px rgba(52, 199, 89, 0.45)',
          }}
        >
          {displayName ? (
            displayName.charAt(0).toUpperCase()
          ) : isVideo ? (
            <Video size={44} />
          ) : (
            <Phone size={44} />
          )}
        </div>
      </div>

      {/* ── Action Controls (Decline / Accept) ────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          width: '100%',
          maxWidth: '340px',
          padding: '0 1rem',
          position: 'relative',
          zIndex: 100,
          pointerEvents: 'auto',
        }}
      >
        {/* Decline Button */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            rejectCall();
          }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              rejectCall();
            }}
            className="ios-hangup-button"
            title="Decline"
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              position: 'relative',
              zIndex: 101,
            }}
          >
            <PhoneOff size={32} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Decline
          </span>
        </div>

        {/* Accept Button */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            acceptCall();
          }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              acceptCall();
            }}
            className="ios-call-button"
            title={isVideo ? 'Accept Video' : 'Accept'}
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              position: 'relative',
              zIndex: 101,
              backgroundColor: isVideo ? 'var(--accent-blue)' : undefined,
            }}
          >
            {isVideo ? <Video size={32} /> : <Phone size={32} fill="currentColor" />}
          </button>
          <span style={{ fontSize: '0.85rem', color: isVideo ? 'var(--accent-blue)' : 'var(--accent-call)', fontWeight: 600 }}>
            Accept
          </span>
        </div>
      </div>
    </div>
  );
};
