import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { formatAppId } from '@callapp/shared';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      showIncomingPopup: (payload: any) => void;
      closeIncomingPopup: () => void;
      onPopupAction: (callback: (action: 'accept' | 'reject', payload: any) => void) => () => void;
      acceptFromPopup: (payload: any) => void;
      rejectFromPopup: (payload: any) => void;
      getPopupData: () => any;
    };
  }
}

export const IncomingPopupView: React.FC = () => {
  const [callData, setCallData] = useState<any>(null);

  useEffect(() => {
    if (window.electronAPI?.getPopupData) {
      const data = window.electronAPI.getPopupData();
      setCallData(data);
    }
  }, []);

  const handleAccept = () => {
    if (window.electronAPI?.acceptFromPopup) {
      window.electronAPI.acceptFromPopup(callData);
    }
  };

  const handleReject = () => {
    if (window.electronAPI?.rejectFromPopup) {
      window.electronAPI.rejectFromPopup(callData);
    }
  };

  if (!callData) {
    return null;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        backgroundColor: 'transparent',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        className="liquid-glass-elevated"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.15rem',
          borderRadius: '20px',
        }}
      >
        {/* Caller Avatar & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="animate-pulse-incoming"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-call)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <Phone size={22} fill="currentColor" />
          </div>

          <div>
            <div
              style={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                fontWeight: 600,
                marginBottom: '1px',
              }}
            >
              Incoming Call
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '130px',
              }}
            >
              {callData.callerName || 'Unknown'}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              {formatAppId(callData.callerAppId || '')}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleReject}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-hangup)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 59, 48, 0.35)',
            }}
            title="Decline"
          >
            <PhoneOff size={20} />
          </button>

          <button
            onClick={handleAccept}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-call)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(52, 199, 89, 0.35)',
            }}
            title="Accept"
          >
            <Phone size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};
