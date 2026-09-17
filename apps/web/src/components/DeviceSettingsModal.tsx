import React from 'react';
import { Mic, Volume2, X, Moon, Sun, Shield, Info } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

export const DeviceSettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const {
    availableInputs,
    availableOutputs,
    selectedInputId,
    selectedOutputId,
    setSelectedInputId,
    setSelectedOutputId,
    requestNotificationPermission,
    requestMicrophonePermission,
  } = useCall();
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-backdrop)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
    >
      <div
        className="liquid-glass-elevated animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '1.75rem',
          borderRadius: '24px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Settings
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ── Appearance (Light / Dark Theme) ────────────────────── */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>
              Appearance
            </label>
            <div className="ios-segmented-control">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`ios-segmented-tab ${theme === 'light' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Sun size={15} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`ios-segmented-tab ${theme === 'dark' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Moon size={15} />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* ── Microphone Selection ──────────────────────────────── */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '6px',
              }}
            >
              <Mic size={14} color="var(--accent-call)" />
              Microphone
            </label>
            <select
              value={selectedInputId}
              onChange={e => setSelectedInputId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-glass-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            >
              {availableInputs.length === 0 ? (
                <option value="">Default Microphone</option>
              ) : (
                availableInputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 5)})`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* ── Speaker Selection ─────────────────────────────────── */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '6px',
              }}
            >
              <Volume2 size={14} color="var(--accent-blue)" />
              Audio Output / Speaker
            </label>
            <select
              value={selectedOutputId}
              onChange={e => setSelectedOutputId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-glass-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            >
              {availableOutputs.length === 0 ? (
                <option value="">Default Speaker / Headphone</option>
              ) : (
                availableOutputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker (${d.deviceId.slice(0, 5)})`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* ── Permissions Section ──────────────────────────────── */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              <Shield size={14} color="var(--accent-call)" />
              Permissions
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Microphone Permission */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-glass-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mic size={15} color="var(--accent-call)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Microphone Access
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const granted = await requestMicrophonePermission();
                    if (granted) {
                      alert('Microphone access enabled successfully.');
                    } else {
                      alert('Please allow microphone permissions in your browser or OS settings.');
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(52, 199, 89, 0.15)',
                    color: 'var(--accent-call)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableInputs.length > 0 && availableInputs[0].label ? 'Granted' : 'Grant / Test'}
                </button>
              </div>

              {/* Notification Permission */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-glass-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={15} color="var(--accent-blue)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Call Notifications
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    if (res === 'granted') {
                      alert('Notifications enabled.');
                    } else {
                      alert('Notification permission: ' + res);
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 122, 255, 0.15)',
                    color: 'var(--accent-blue)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                    ? 'Enabled'
                    : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '1.5rem',
            padding: '11px',
            borderRadius: '14px',
            backgroundColor: 'var(--accent-blue)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.92rem',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};
