import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { formatAppId } from '@callapp/shared';

export const IncomingCallModal: React.FC = () => {
  const { callState, activeCall, acceptCall, rejectCall } = useCall();

  if (callState !== 'incoming_ringing' || !activeCall) return null;

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
            color: 'var(--text-muted)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginBottom: '0.5rem',
          }}
        >
          CallApp Audio
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
          {activeCall.remoteName}
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
            backgroundColor: 'var(--accent-call)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '2.5rem',
            fontWeight: 600,
          }}
        >
          {activeCall.remoteName ? activeCall.remoteName.charAt(0).toUpperCase() : <Phone size={44} />}
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
        }}
      >
        {/* Decline Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={rejectCall}
            className="ios-hangup-button"
            title="Decline"
          >
            <PhoneOff size={32} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Decline
          </span>
        </div>

        {/* Accept Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={acceptCall}
            className="ios-call-button"
            title="Accept"
          >
            <Phone size={32} fill="currentColor" />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-call)', fontWeight: 600 }}>
            Accept
          </span>
        </div>
      </div>
    </div>
  );
};
