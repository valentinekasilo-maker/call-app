import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatAppId } from '@callapp/shared';
import {
  User,
  Shield,
  Smartphone,
  Mic,
  Moon,
  Sun,
  Key,
  LogOut,
  Copy,
  Check,
  Edit2,
  ChevronRight,
  Laptop,
  Globe,
} from 'lucide-react';

interface SettingsViewProps {
  onOpenIdentityManager: () => void;
  onOpenDeviceSettings: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenIdentityManager,
  onOpenDeviceSettings,
}) => {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [copied, setCopied] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>(user?.name || '');
  const [aboutText, setAboutText] = useState<string>('Hey there! I am using CallApp.');
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<'main' | 'devices'>('main');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Copy 10-digit App ID
  const handleCopyAppId = () => {
    if (user?.appId) {
      navigator.clipboard.writeText(user.appId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    try {
      setIsSaving(true);
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          about: aboutText.trim(),
        }),
      });
      if (res.ok) {
        setIsEditingProfile(false);
      }
    } catch (e) {
      console.warn('Failed to update profile:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflowY: 'auto',
        paddingBottom: '40px',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-glass)',
          backgroundColor: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {activeSection === 'main' ? 'Settings' : 'Linked Devices'}
        </h1>
      </div>

      <div style={{ padding: '20px', maxWidth: '600px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeSection === 'main' ? (
          <>
            {/* Profile Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border-glass)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #5856D6 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(10, 132, 255, 0.3)',
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditingProfile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Display Name"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={aboutText}
                      onChange={e => setAboutText(e.target.value)}
                      placeholder="About / Status"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--accent-primary)',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: 'none',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {displayName || user?.name}
                      </span>
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {aboutText}
                    </div>

                    {/* App ID Pill */}
                    <div
                      onClick={handleCopyAppId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '8px',
                        padding: '4px 10px',
                        backgroundColor: 'rgba(10, 132, 255, 0.1)',
                        border: '1px solid rgba(10, 132, 255, 0.25)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        ID: {formatAppId(user?.appId || '')}
                      </span>
                      {copied ? <Check size={13} color="#34C759" /> : <Copy size={13} color="var(--accent-primary)" />}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Settings Sections */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border-glass)',
                overflow: 'hidden',
              }}
            >
              {/* Linked Devices */}
              <button
                onClick={() => setActiveSection('devices')}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                    <Laptop size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Linked Devices</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Web browser & Windows desktop sessions
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>

              {/* Audio Settings (Microphone & Speaker) */}
              <button
                onClick={onOpenDeviceSettings}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(52, 199, 89, 0.15)',
                      color: '#34C759',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Mic size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Audio Devices</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Microphone and Speaker configuration
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>

              {/* Theme Toggle */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-glass)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 149, 0, 0.15)',
                      color: '#FF9500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Appearance
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Currently {theme === 'dark' ? 'Dark Mode (#000000)' : 'Light Mode (#FFFFFF)'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={toggleTheme}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>

              {/* Developer / Lucia API Key Manager */}
              <button
                onClick={onOpenIdentityManager}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(175, 82, 222, 0.15)',
                      color: '#AF52DE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Key size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>API Identities (Lucia AI)</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Programmatic calling and messaging tokens
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>
            </div>

            {/* Log Out */}
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 59, 48, 0.12)',
                border: '1px solid rgba(255, 59, 48, 0.25)',
                color: '#FF3B30',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <LogOut size={18} /> Sign Out
            </button>
          </>
        ) : (
          /* Linked Devices View */
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              border: '1px solid var(--border-glass)',
              padding: '20px',
            }}
          >
            <button
              onClick={() => setActiveSection('main')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginBottom: '16px',
              }}
            >
              ← Back to Settings
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Current Device */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px',
                  backgroundColor: 'rgba(52, 199, 89, 0.08)',
                  border: '1px solid rgba(52, 199, 89, 0.25)',
                  borderRadius: '16px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(52, 199, 89, 0.2)',
                    color: '#34C759',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Laptop size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    Current Device (This Session)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#34C759', fontWeight: 600 }}>
                    ● Active Now • WebRTC & Socket Connected
                  </div>
                </div>
              </div>

              {/* Windows Desktop */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '16px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(10, 132, 255, 0.15)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Globe size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    CallApp Windows Desktop Client
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Auto-syncs incoming voice call signaling & presence
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
