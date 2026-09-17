import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useCall } from './context/CallContext';
import { useTheme } from './context/ThemeContext';
import { AuthView } from './components/AuthView';
import { NavigationBar, ActiveTab } from './components/NavigationBar';
import { Keypad } from './components/Keypad';
import { ContactsList } from './components/ContactsList';
import { CallHistory } from './components/CallHistory';
import { IncomingCallModal } from './components/IncomingCallModal';
import { OutgoingCallModal } from './components/OutgoingCallModal';
import { ActiveCallModal } from './components/ActiveCallModal';
import { DeviceSettingsModal } from './components/DeviceSettingsModal';
import { IdentityManagerModal } from './components/IdentityManagerModal';
import {
  Phone,
  Settings,
  LogOut,
  Copy,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Star,
  Key,
} from 'lucide-react';
import { formatAppId } from '@callapp/shared';

export const App: React.FC = () => {
  const { user, token, isLoading, logout } = useAuth();
  const { isConnected, errorMessage, clearError, unreadMissedCount, markMissedCallsViewed } = useCall();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<ActiveTab>('keypad');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showIdentities, setShowIdentities] = useState<boolean>(false);
  const [copiedAppId, setCopiedAppId] = useState<boolean>(false);
  const [prefillAppId, setPrefillAppId] = useState<string | null>(null);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      markMissedCallsViewed();
    }
  };


  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent-call) 0%, #28B84C 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(52, 199, 89, 0.3)',
            }}
          >
            <Phone size={28} fill="currentColor" />
          </div>
          <span>Connecting Phone...</span>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <AuthView />;
  }

  const handleCopyAppId = () => {
    if (user?.appId) {
      navigator.clipboard.writeText(user.appId);
      setCopiedAppId(true);
      setTimeout(() => setCopiedAppId(false), 2000);
    }
  };

  const handleAddContactFromKeypad = (appId: string) => {
    setPrefillAppId(appId);
    setActiveTab('contacts');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
      }}
    >
      {/* ── iOS Phone Chassis Canvas ──────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-chassis)',
          boxShadow: 'var(--shadow-chassis)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflowX: 'hidden',
        }}
      >
        {/* ── Top Header / Status Bar ─────────────────────────────── */}
        <header
          style={{
            padding: '1rem 1.25rem 0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-glass-subtle)',
            backgroundColor: 'var(--nav-bar-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          {/* User Info & 10-Digit App ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-call) 0%, #28B84C 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(52, 199, 89, 0.25)',
                flexShrink: 0,
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
                <span
                  className={`presence-dot presence-${isConnected ? 'online' : 'offline'}`}
                  title={isConnected ? 'Connected' : 'Connecting...'}
                />
              </div>

              {/* 1-Click Copy App ID Pill */}
              <button
                onClick={handleCopyAppId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  marginTop: '1px',
                  padding: '0',
                }}
                title="Click to copy your 10-digit App ID"
              >
                <span>ID: {formatAppId(user.appId)}</span>
                {copiedAppId ? (
                  <Check size={12} color="var(--accent-call)" />
                ) : (
                  <Copy size={12} color="var(--text-dim)" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Appearance Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Calling Identities Management Button */}
            <button
              onClick={() => setShowIdentities(true)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 122, 255, 0.12)',
                color: '#007AFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Calling Identities & API Keys"
            >
              <Key size={16} />
            </button>

            {/* Audio Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Settings"
            >
              <Settings size={17} />
            </button>

            {/* Sign Out Button */}
            <button
              onClick={logout}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Sign Out"
            >
              <LogOut size={17} />
            </button>

          </div>
        </header>

        {/* ── Error Toast Alert ───────────────────────────────────── */}
        {errorMessage && (
          <div
            className="animate-slide-up"
            style={{
              margin: '0.75rem 1rem 0 1rem',
              padding: '0.75rem 1rem',
              borderRadius: '14px',
              backgroundColor: 'rgba(255, 59, 48, 0.12)',
              border: '1px solid rgba(255, 59, 48, 0.25)',
              color: 'var(--accent-hangup)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={clearError}
              style={{
                color: 'var(--accent-hangup)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Main Tab Content ────────────────────────────────────── */}
        <main style={{ flex: 1, padding: '1rem 1.25rem', width: '100%' }}>
          {activeTab === 'keypad' && (
            <Keypad onAddContact={handleAddContactFromKeypad} />
          )}

          {activeTab === 'history' && <CallHistory />}

          {activeTab === 'contacts' && (
            <ContactsList
              initialAddAppId={prefillAppId}
              onClearInitialAdd={() => setPrefillAppId(null)}
            />
          )}

          {activeTab === 'favorites' && (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                color: 'var(--text-muted)',
              }}
            >
              <Star size={42} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No Favorites
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Quick dial contacts from the Keypad or Contacts tab.
              </p>
            </div>
          )}
        </main>

        {/* ── iOS Bottom Navigation Bar ────────────────────────────── */}
        <NavigationBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          badgeCounts={{ history: unreadMissedCount }}
        />

        {/* ── Native iOS Calling Screens & Modals ──────────────────── */}
        <IncomingCallModal />
        <OutgoingCallModal />
        <ActiveCallModal onOpenAudioSettings={() => setShowSettings(true)} />
        <DeviceSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
        <IdentityManagerModal
          isOpen={showIdentities}
          onClose={() => setShowIdentities(false)}
        />
      </div>
    </div>
  );
};

