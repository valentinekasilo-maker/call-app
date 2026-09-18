import React, { useState } from 'react';
import { X, MessageSquare, ArrowRight, UserPlus, Clipboard } from 'lucide-react';
import { isValidAppId, formatAppId } from '@callapp/shared';

interface NewChatModalProps {
  onClose: () => void;
  onStartChat: (targetAppId: string) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onStartChat }) => {
  const [appIdInput, setAppIdInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = text.replace(/\D/g, '').slice(0, 10);
      setAppIdInput(clean);
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = appIdInput.replace(/\D/g, '');

    if (!isValidAppId(cleanId)) {
      setError('Please enter a valid 10-digit App ID');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onStartChat(cleanId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to open conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(10, 132, 255, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                New Direct Chat
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Enter the recipient's 10-digit App ID
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 59, 48, 0.12)',
                border: '1px solid rgba(255, 59, 48, 0.3)',
                borderRadius: '12px',
                color: '#FF3B30',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Recipient 10-digit App ID
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={appIdInput}
                onChange={e => {
                  setAppIdInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setError(null);
                }}
                placeholder="07XXXXXXXX"
                autoFocus
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  fontVariantNumeric: 'tabular-nums',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                style={{
                  padding: '0 14px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                }}
              >
                <Clipboard size={16} /> Paste
              </button>
            </div>
            {appIdInput.length === 10 && (
              <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                Formatted: {formatAppId(appIdInput)}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || appIdInput.length !== 10}
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: appIdInput.length === 10 ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: appIdInput.length === 10 ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '1rem',
              border: 'none',
              cursor: appIdInput.length === 10 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{isSubmitting ? 'Opening Chat...' : 'Start Chat'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
