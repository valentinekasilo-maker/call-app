import React, { useState } from 'react';
import { Phone, Lock, Mail, User as UserIcon, Sun, Moon, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-app)',
        position: 'relative',
      }}
    >
      {/* ── Theme Switcher in top right ──────────────────────────── */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-surface-subtle)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* ── iOS Frosted Auth Card ─────────────────────────────────── */}
      <div
        className="liquid-glass animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '2.5rem 1.75rem',
          borderRadius: '28px',
        }}
      >
        {/* Apple Phone App Icon & Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent-call) 0%, #28B84C 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(52, 199, 89, 0.35)',
            }}
          >
            <Phone size={32} fill="currentColor" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Phone
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Pure internet calling with 10-digit App IDs
          </p>
        </div>

        {/* iOS Segmented Control Tab Switcher */}
        <div className="ios-segmented-control" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`ios-segmented-tab ${isLogin ? 'active' : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`ios-segmented-tab ${!isLogin ? 'active' : ''}`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(255, 59, 48, 0.12)',
              color: 'var(--accent-hangup)',
              padding: '10px 12px',
              borderRadius: '12px',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isLogin && (
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Your Name
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-glass-subtle)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  gap: '10px',
                }}
              >
                <UserIcon size={17} color="var(--text-tertiary)" />
                <input
                  type="text"
                  placeholder="e.g. Valence"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    width: '100%',
                    fontSize: '0.92rem',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Email
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-glass-subtle)',
                borderRadius: '12px',
                padding: '10px 12px',
                gap: '10px',
              }}
            >
              <Mail size={17} color="var(--text-tertiary)" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '0.92rem',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-glass-subtle)',
                borderRadius: '12px',
                padding: '10px 12px',
                gap: '10px',
              }}
            >
              <Lock size={17} color="var(--text-tertiary)" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '0.92rem',
                }}
              />
            </div>
          </div>

          {!isLogin && (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '2px' }}>
              ✨ You will automatically receive a unique <strong>10-digit App ID</strong> (e.g. 0748321905) to receive internet calls.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '14px',
              backgroundColor: 'var(--accent-call)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.96rem',
              boxShadow: '0 8px 20px rgba(52, 199, 89, 0.3)',
            }}
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Get My App ID'}
          </button>
        </form>
      </div>
    </div>
  );
};
