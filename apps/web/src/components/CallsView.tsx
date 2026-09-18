import React, { useState } from 'react';
import { Keypad } from './Keypad';
import { CallHistory } from './CallHistory';
import { Phone, Clock } from 'lucide-react';

interface CallsViewProps {
  onAddContactFromKeypad?: (appId: string) => void;
  prefillAppId?: string | null;
  unreadMissedCount?: number;
  onClearMissedBadge?: () => void;
}

export const CallsView: React.FC<CallsViewProps> = ({
  onAddContactFromKeypad,
  prefillAppId,
  unreadMissedCount = 0,
  onClearMissedBadge,
}) => {
  const [subTab, setSubTab] = useState<'keypad' | 'recents'>('keypad');

  const handleSubTabChange = (tab: 'keypad' | 'recents') => {
    setSubTab(tab);
    if (tab === 'recents' && onClearMissedBadge) {
      onClearMissedBadge();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* Top Segmented Switcher */}
      <div
        style={{
          padding: '14px 20px 8px 20px',
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '16px',
            padding: '4px',
            width: '100%',
            maxWidth: '320px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <button
            onClick={() => handleSubTabChange('keypad')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: subTab === 'keypad' ? 'var(--bg-card)' : 'transparent',
              color: subTab === 'keypad' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: subTab === 'keypad' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Phone size={15} /> Keypad
          </button>

          <button
            onClick={() => handleSubTabChange('recents')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: subTab === 'recents' ? 'var(--bg-card)' : 'transparent',
              color: subTab === 'recents' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              position: 'relative',
              boxShadow: subTab === 'recents' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Clock size={15} /> Recents
            {unreadMissedCount > 0 && (
              <span
                style={{
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#FF3B30',
                  color: '#FFFFFF',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadMissedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {subTab === 'keypad' ? (
          <Keypad onAddContact={onAddContactFromKeypad} />
        ) : (
          <CallHistory />
        )}
      </div>
    </div>
  );
};
