import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, Video, Delete, Clipboard, Check, UserPlus } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { cleanAppId, formatAppId, CallType, SoundManager } from '@callapp/shared';

interface KeypadButtonDef {
  digit: string;
  letters: string;
}

const KEYPAD_BUTTONS: KeypadButtonDef[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'A B C' },
  { digit: '3', letters: 'D E F' },
  { digit: '4', letters: 'G H I' },
  { digit: '5', letters: 'J K L' },
  { digit: '6', letters: 'M N O' },
  { digit: '7', letters: 'P Q R S' },
  { digit: '8', letters: 'T U V' },
  { digit: '9', letters: 'W X Y Z' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export const Keypad: React.FC<{ onAddContact?: (appId: string) => void }> = ({ onAddContact }) => {
  const [appIdInput, setAppIdInput] = useState<string>('');
  const [lookupUser, setLookupUser] = useState<{ name: string; presence: string } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const { initiateCall, isConnected } = useCall();
  const { token } = useAuth();
  const backspaceTimerRef = useRef<any>(null);

  const handleDigit = useCallback((digit: string) => {
    SoundManager.playDTMFTone(digit);
    SoundManager.triggerHaptic(15);
    setCallNotice(null);
    setAppIdInput(prev => {
      const clean = cleanAppId(prev);
      if (clean.length < 10) {
        return clean + digit;
      }
      return prev;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    SoundManager.playBackspaceClick();
    SoundManager.triggerHaptic(20);
    setCallNotice(null);
    setAppIdInput(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    SoundManager.playBackspaceClick();
    SoundManager.triggerHaptic([20, 30, 20]);
    setCallNotice(null);
    setAppIdInput('');
    setLookupUser(null);
  }, []);

  // Keyboard support for desktop / physical typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard if typing in a standard input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === '*' || e.key === '#') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleCall();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, appIdInput, isConnected, initiateCall]);

  // Global paste handler (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const pastedText = e.clipboardData?.getData('text') || '';
      const digitsOnly = cleanAppId(pastedText);
      if (digitsOnly.length > 0) {
        setCallNotice(null);
        setAppIdInput(digitsOnly.slice(0, 10));
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Live lookup when 10 digits are entered
  useEffect(() => {
    const rawDigits = cleanAppId(appIdInput);
    if (rawDigits.length === 10 && token) {
      fetch(`/api/users/lookup/${rawDigits}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.user) {
            setLookupUser({
              name: data.user.name,
              presence: data.user.presence || 'offline',
            });
          } else {
            setLookupUser(null);
          }
        })
        .catch(() => setLookupUser(null));
    } else {
      setLookupUser(null);
    }
  }, [appIdInput, token]);

  const handleCall = (callType: CallType = 'audio') => {
    SoundManager.triggerHaptic(40);
    const raw = cleanAppId(appIdInput);
    if (raw.length === 0) {
      setCallNotice('Enter a 10-digit App ID to place call');
      setTimeout(() => setCallNotice(null), 3000);
      return;
    }
    if (raw.length < 10) {
      const remaining = 10 - raw.length;
      setCallNotice(`Enter full 10 digits (need ${remaining} more)`);
      setTimeout(() => setCallNotice(null), 3000);
      return;
    }
    if (!isConnected) {
      setCallNotice('Connecting to network... calling now');
      setTimeout(() => setCallNotice(null), 3000);
    }
    initiateCall(raw, callType);
  };

  const handleCopyInput = () => {
    const raw = cleanAppId(appIdInput);
    if (raw.length > 0) {
      navigator.clipboard.writeText(raw);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 1500);
    }
  };

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = cleanAppId(text);
      if (digits.length > 0) {
        setCallNotice(null);
        setAppIdInput(digits.slice(0, 10));
      }
    } catch {
      // Fallback if clipboard read is blocked
    }
  };

  const rawLength = cleanAppId(appIdInput).length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '340px',
        margin: '0 auto',
        padding: '0.5rem 0',
      }}
    >
      {/* ── Top Display Area ─────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          marginBottom: '0.75rem',
        }}
      >
        {/* Formatted Number Display */}
        <div
          onClick={handleCopyInput}
          title={appIdInput ? 'Click to copy number' : undefined}
          style={{
            fontSize: '2.1rem',
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: appIdInput ? 'var(--text-primary)' : 'var(--text-dim)',
            textAlign: 'center',
            cursor: appIdInput ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            userSelect: 'none',
          }}
        >
          {appIdInput ? formatAppId(appIdInput) : ' '}
        </div>

        {/* Action Link under Number (Add Number or Live User Status) */}
        {lookupUser ? (
          <div
            style={{
              marginTop: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 10px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-glass-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span className={`presence-dot presence-${lookupUser.presence}`} />
            <span style={{ fontWeight: 600 }}>{lookupUser.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>
              ({lookupUser.presence})
            </span>
          </div>
        ) : rawLength === 10 && onAddContact ? (
          <button
            onClick={() => onAddContact(cleanAppId(appIdInput))}
            style={{
              marginTop: '4px',
              color: 'var(--accent-blue)',
              fontSize: '0.82rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <UserPlus size={14} />
            <span>Add Number</span>
          </button>
        ) : rawLength === 0 ? (
          <button
            onClick={handlePasteClick}
            style={{
              marginTop: '4px',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: 0.8,
            }}
          >
            <Clipboard size={12} />
            <span>Paste App ID</span>
          </button>
        ) : null}

        {callNotice ? (
          <span
            style={{
              position: 'absolute',
              bottom: '-22px',
              fontSize: '0.78rem',
              color: 'var(--accent-call)',
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '2px 10px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass-subtle)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {callNotice}
          </span>
        ) : copiedNotification ? (
          <span
            style={{
              position: 'absolute',
              bottom: '-18px',
              fontSize: '0.72rem',
              color: 'var(--accent-call)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <Check size={12} /> Copied to clipboard
          </span>
        ) : null}
      </div>

      {/* ── iOS 3×4 Circular Keypad Matrix ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px 20px',
          width: '100%',
          justifyItems: 'center',
          marginBottom: '18px',
        }}
      >
        {KEYPAD_BUTTONS.map(btn => (
          <button
            key={btn.digit}
            onClick={() => handleDigit(btn.digit)}
            className="ios-keypad-btn"
          >
            <span className="ios-keypad-digit">{btn.digit}</span>
            {btn.letters ? (
              <span className="ios-keypad-letters">{btn.letters}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Call & Action Controls Row ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          width: '100%',
          position: 'relative',
          height: '80px',
        }}
      >
        {/* Voice Call Button */}
        <button
          onClick={() => handleCall('audio')}
          className="ios-call-button"
          title="Voice Call (10-digit App ID)"
          style={{
            transform: rawLength === 10 ? 'scale(1.05)' : 'scale(1)',
            opacity: rawLength === 10 ? 1 : 0.9,
            cursor: 'pointer',
          }}
        >
          <Phone size={30} fill="currentColor" />
        </button>

        {/* Video Call Button */}
        <button
          onClick={() => handleCall('video')}
          title="Video Call (10-digit App ID)"
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-blue)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(10, 132, 255, 0.45)',
            border: 'none',
            cursor: 'pointer',
            transform: rawLength === 10 ? 'scale(1.05)' : 'scale(1)',
            opacity: rawLength === 10 ? 1 : 0.9,
            transition: 'all 0.15s ease',
          }}
        >
          <Video size={30} />
        </button>

        {/* Backspace Button on Right */}
        {appIdInput.length > 0 && (
          <button
            onClick={handleBackspace}
            onMouseDown={() => {
              backspaceTimerRef.current = setTimeout(handleClear, 600);
            }}
            onMouseUp={() => clearTimeout(backspaceTimerRef.current)}
            onMouseLeave={() => clearTimeout(backspaceTimerRef.current)}
            style={{
              position: 'absolute',
              right: '8px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Delete (Hold to clear)"
          >
            <Delete size={24} />
          </button>
        )}
      </div>
    </div>
  );
};
