import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useCall } from './context/CallContext';
import { useTheme } from './context/ThemeContext';
import { useChat } from './context/ChatContext';
import { AuthView } from './components/AuthView';
import { NavigationBar, ActiveTab } from './components/NavigationBar';
import { ChatListView } from './components/chat/ChatListView';
import { ConversationView } from './components/chat/ConversationView';
import { NewChatModal } from './components/chat/NewChatModal';
import { CallsView } from './components/CallsView';
import { ContactsList } from './components/ContactsList';
import { SettingsView } from './components/SettingsView';
import { IncomingCallModal } from './components/IncomingCallModal';
import { OutgoingCallModal } from './components/OutgoingCallModal';
import { ActiveCallModal } from './components/ActiveCallModal';
import { DeviceSettingsModal } from './components/DeviceSettingsModal';
import { IdentityManagerModal } from './components/IdentityManagerModal';
import {
  MessageSquare,
  Phone,
  Settings,
  LogOut,
  Copy,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Key,
} from 'lucide-react';
import { formatAppId } from '@callapp/shared';

export const App: React.FC = () => {
  const { user, token, isLoading, logout } = useAuth();
  const { isConnected, errorMessage, clearError, unreadMissedCount, markMissedCallsViewed } = useCall();
  const { theme, toggleTheme } = useTheme();
  const {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    typingState,
    totalUnreadChats,
    selectConversation,
    startDirectChat,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    sendTyping,
    deleteConversation,
    uploadMedia,
  } = useChat();

  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showIdentities, setShowIdentities] = useState<boolean>(false);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [copiedAppId, setCopiedAppId] = useState<boolean>(false);
  const [prefillAppId, setPrefillAppId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'calls') {
      markMissedCallsViewed();
    }
  };

  const handleStartChatFromContact = async (appId: string) => {
    try {
      await startDirectChat(appId);
      setActiveTab('chats');
    } catch (e: any) {
      console.warn('Failed to start chat from contact:', e);
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #5856D6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(10, 132, 255, 0.35)',
            }}
          >
            <MessageSquare size={30} />
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Connecting Messenger...</span>
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

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isDesktop ? '16px' : '0',
      }}
    >
      {/* ── Mobile Phone Chassis Canvas ────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: isDesktop ? '460px' : '100%',
          height: isDesktop ? '92vh' : '100dvh',
          maxHeight: isDesktop ? '900px' : '100dvh',
          backgroundColor: 'var(--bg-chassis)',
          boxShadow: isDesktop ? '0 24px 64px rgba(0, 0, 0, 0.45)' : 'none',
          borderRadius: isDesktop ? '28px' : '0',
          border: isDesktop ? '1px solid var(--border-glass)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Top Header Bar (Hidden when actively inside a conversation) ── */}
        {(!activeConversationId || activeTab !== 'chats') && (
          <header
            style={{
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-glass)',
              backgroundColor: 'var(--nav-bar-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 40,
            }}
          >
            {/* User Profile & 10-Digit App ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #5856D6 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(10, 132, 255, 0.25)',
                  flexShrink: 0,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {user.name}
                  </span>
                  <span
                    className={`presence-dot presence-${isConnected ? 'online' : 'offline'}`}
                    title={isConnected ? 'Connected & Live' : 'Connecting...'}
                  />
                </div>

                {/* 1-Click Copy 10-Digit App ID Pill */}
                <button
                  onClick={handleCopyAppId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    marginTop: '1px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                  }}
                  title="Click to copy your 10-digit App ID"
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    ID: {formatAppId(user.appId)}
                  </span>
                  {copiedAppId ? <Check size={12} color="#34C759" /> : <Copy size={12} color="var(--text-dim)" />}
                </button>
              </div>
            </div>

            {/* Quick Actions Header Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Calling Identities / Lucia AI Key Manager */}
              <button
                onClick={() => setShowIdentities(true)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(10, 132, 255, 0.12)',
                  border: '1px solid rgba(10, 132, 255, 0.25)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Lucia AI & Developer API Keys"
              >
                <Key size={15} />
              </button>

              {/* Audio Settings */}
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Audio Device Settings"
              >
                <Settings size={16} />
              </button>

              {/* Sign Out */}
              <button
                onClick={logout}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>
        )}

        {/* ── Error Toast Alert ───────────────────────────────────── */}
        {errorMessage && (
          <div
            className="animate-slide-up"
            style={{
              margin: '10px 16px 0 16px',
              padding: '10px 16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 59, 48, 0.12)',
              border: '1px solid rgba(255, 59, 48, 0.25)',
              color: '#FF3B30',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              zIndex: 35,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                color: '#FF3B30',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Main Tab Content ────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* TAB 1: CHATS (1-to-1 Private Local Messaging) */}
          {activeTab === 'chats' && (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {!activeConversationId ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <ChatListView
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    typingState={typingState}
                    onSelectConversation={id => selectConversation(id)}
                    onOpenNewChatModal={() => setShowNewChatModal(true)}
                    onDeleteConversation={deleteConversation}
                  />
                </div>
              ) : activeConversation ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <ConversationView
                    conversation={activeConversation}
                    messages={messages[activeConversation.id] || []}
                    typingUsers={typingState[activeConversation.id] || []}
                    onBack={() => selectConversation(null)}
                    onSendMessage={params =>
                      sendMessage({
                        conversationId: activeConversation.id,
                        targetAppId: activeConversation.contactAppId,
                        ...params,
                      })
                    }
                    onEditMessage={(msgId, content) =>
                      editMessage(activeConversation.id, activeConversation.contactAppId, msgId, content)
                    }
                    onDeleteMessage={msgId =>
                      deleteMessage(activeConversation.id, activeConversation.contactAppId, msgId)
                    }
                    onReactToMessage={(msgId, emoji, action) =>
                      reactToMessage(activeConversation.id, activeConversation.contactAppId, msgId, emoji, action)
                    }
                    onSendTyping={isTyping =>
                      sendTyping(activeConversation.id, activeConversation.contactAppId, isTyping)
                    }
                    onDeleteConversation={deleteConversation}
                    onUploadMedia={uploadMedia}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: CALLS (Keypad + Call History) */}
          {activeTab === 'calls' && (
            <div style={{ width: '100%', height: '100%' }}>
              <CallsView
                prefillAppId={prefillAppId}
                unreadMissedCount={unreadMissedCount}
                onClearMissedBadge={markMissedCallsViewed}
                onAddContactFromKeypad={appId => {
                  setPrefillAppId(appId);
                  setActiveTab('contacts');
                }}
              />
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <div style={{ width: '100%', height: '100%' }}>
              <ContactsList
                initialAddAppId={prefillAppId}
                onClearInitialAdd={() => setPrefillAppId(null)}
                onStartChat={handleStartChatFromContact}
              />
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ width: '100%', height: '100%' }}>
              <SettingsView
                onOpenIdentityManager={() => setShowIdentities(true)}
                onOpenDeviceSettings={() => setShowSettings(true)}
              />
            </div>
          )}
        </main>

        {/* ── iOS / Liquid Glass Bottom Navigation Bar ────────────────────────────── */}
        {(!activeConversationId || activeTab !== 'chats') && (
          <NavigationBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            badgeCounts={{
              chats: totalUnreadChats,
              calls: unreadMissedCount,
            }}
          />
        )}

        {/* ── Native Calling Modals (Voice Calling 100% Preserved) ──────────────────── */}
        <IncomingCallModal />
        <OutgoingCallModal />
        <ActiveCallModal onOpenAudioSettings={() => setShowSettings(true)} />
        <DeviceSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        <IdentityManagerModal isOpen={showIdentities} onClose={() => setShowIdentities(false)} />

        {/* ── Direct 1-to-1 Chat Modal ────────────────────────────────────────── */}
        {showNewChatModal && (
          <NewChatModal
            onClose={() => setShowNewChatModal(false)}
            onStartChat={async appId => {
              await startDirectChat(appId);
              setActiveTab('chats');
            }}
          />
        )}
      </div>
    </div>
  );
};
