import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Slash,
  CheckCircle,
  Key,
  Bot,
  Cpu,
  Smartphone,
  Server,
  User,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { formatAppId, CallingIdentity, IdentityType } from '@callapp/shared';

interface IdentityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NewKeyPopup {
  name: string;
  appId: string;
  apiKey: string;
  isRotated?: boolean;
}

export const IdentityManagerModal: React.FC<IdentityManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [identities, setIdentities] = useState<CallingIdentity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<IdentityType>('ai');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // New key display popup
  const [newKeyPopup, setNewKeyPopup] = useState<NewKeyPopup | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchIdentities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/v1/identities');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIdentities(data.identities || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load identities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIdentities();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsCreating(true);
      setError(null);
      const res = await fetch('/api/v1/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create identity');

      setNewName('');
      setShowCreateForm(false);
      setNewKeyPopup({
        name: data.name,
        appId: data.app_id,
        apiKey: data.api_key,
      });

      await fetchIdentities();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRotateKey = async (identity: CallingIdentity) => {
    if (!window.confirm(`Are you sure you want to rotate the API key for ${identity.name} (${identity.appId})? The old key will immediately stop working, but the 10-digit App ID will remain unchanged.`)) {
      return;
    }

    try {
      setActionLoadingId(identity.id);
      setError(null);
      const res = await fetch(`/api/v1/identities/${identity.id}/rotate-key`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to rotate key');

      setNewKeyPopup({
        name: data.name,
        appId: data.app_id,
        apiKey: data.api_key,
        isRotated: true,
      });

      await fetchIdentities();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (identity: CallingIdentity) => {
    if (!window.confirm(`Revoke identity ${identity.name} (${identity.appId})? It will not be able to authenticate or make/receive calls.`)) {
      return;
    }

    try {
      setActionLoadingId(identity.id);
      setError(null);
      const res = await fetch(`/api/v1/identities/${identity.id}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to revoke identity');
      }
      await fetchIdentities();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleActivate = async (identity: CallingIdentity) => {
    try {
      setActionLoadingId(identity.id);
      setError(null);
      const res = await fetch(`/api/v1/identities/${identity.id}/activate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to activate identity');

      if (data.api_key) {
        setNewKeyPopup({
          name: identity.name,
          appId: identity.appId,
          apiKey: data.api_key,
        });
      }

      await fetchIdentities();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string, isKey: boolean = false, appId?: string) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } else if (appId) {
      setCopiedAppId(appId);
      setTimeout(() => setCopiedAppId(null), 2000);
    }
  };

  const getTypeIcon = (type: IdentityType) => {
    switch (type) {
      case 'ai':
        return <Bot size={16} color="#007AFF" />;
      case 'bot':
        return <Cpu size={16} color="#5856D6" />;
      case 'service':
        return <Server size={16} color="#FF9500" />;
      case 'device':
        return <Smartphone size={16} color="#34C759" />;
      case 'application':
        return <Radio size={16} color="#AF52DE" />;
      default:
        return <User size={16} color="var(--text-secondary)" />;
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '88vh',
          backgroundColor: 'var(--card-bg)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          border: '1px solid var(--card-border)',
          borderRadius: '28px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--card-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 122, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#007AFF',
              }}
            >
              <Key size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Calling Identities
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                API Credentials & 10-Digit App IDs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--btn-bg)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(255, 59, 48, 0.12)',
                border: '1px solid rgba(255, 59, 48, 0.25)',
                color: '#FF3B30',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* New Key Generated Alert Dialog */}
          {newKeyPopup && (
            <div
              style={{
                backgroundColor: 'rgba(52, 199, 89, 0.12)',
                border: '1px solid rgba(52, 199, 89, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34C759', marginBottom: '8px' }}>
                <CheckCircle size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  {newKeyPopup.isRotated ? 'API Key Rotated Successfully' : 'Calling Identity Created'}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                <strong>{newKeyPopup.name}</strong> has been assigned App ID <strong>{formatAppId(newKeyPopup.appId)}</strong>.
                Save this secret API Key now. <em>It will not be displayed again.</em>
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                  }}
                >
                  {newKeyPopup.apiKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyPopup.apiKey, true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: copiedKey ? '#34C759' : 'var(--btn-bg)',
                    color: copiedKey ? '#FFFFFF' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  onClick={() => setNewKeyPopup(null)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Create Button / Create Form Toggle */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                border: '1px dashed rgba(0, 122, 255, 0.4)',
                color: '#007AFF',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '20px',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>Create Calling Identity (Lucia AI / Service / Bot)</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreate}
              style={{
                backgroundColor: 'var(--btn-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '18px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  New Calling Identity
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Identity Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Lucia, Vancix, Home Assistant"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as IdentityType)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    <option value="ai">AI (e.g. Lucia Assistant)</option>
                    <option value="bot">Bot (Voice Automation)</option>
                    <option value="service">Service (Backend Integration)</option>
                    <option value="device">Device (Hardware / Bridge)</option>
                    <option value="application">Application (External App)</option>
                    <option value="human">Human (User)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newName.trim()}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#007AFF',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isCreating ? 0.7 : 1,
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create & Generate Key'}
                </button>
              </div>
            </form>
          )}

          {/* List of Identities */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Registered Calling Identities ({identities.length})
            </span>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading identities...
              </div>
            ) : identities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No external calling identities created yet. Click above to create one.
              </div>
            ) : (
              identities.map((item) => {
                const isActive = item.status === 'active';
                const isActionLoading = actionLoadingId === item.id;

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--btn-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getTypeIcon(item.type)}
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {item.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 122, 255, 0.12)',
                            color: '#007AFF',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.type}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: isActive ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                          color: isActive ? '#34C759' : '#FF3B30',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#34C759' : '#FF3B30' }} />
                        {item.status}
                      </span>
                    </div>

                    {/* App ID & Key Prefix Details */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: '10px',
                        padding: '10px',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          10-Digit App ID
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <strong style={{ letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                            {formatAppId(item.appId)}
                          </strong>
                          <button
                            onClick={() => copyToClipboard(item.appId, false, item.appId)}
                            title="Copy App ID"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedAppId === item.appId ? '#34C759' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            {copiedAppId === item.appId ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          API Credential
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                          {item.keyPrefix ? `${item.keyPrefix}••••••••` : 'No active key'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleRotateKey(item)}
                        disabled={isActionLoading}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--btn-bg)',
                          border: '1px solid var(--card-border)',
                          color: 'var(--text-primary)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <RefreshCw size={12} className={isActionLoading ? 'animate-spin' : ''} />
                        Rotate Key
                      </button>

                      {isActive ? (
                        <button
                          onClick={() => handleRevoke(item)}
                          disabled={isActionLoading}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                            border: '1px solid rgba(255, 59, 48, 0.25)',
                            color: '#FF3B30',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Slash size={12} />
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(item)}
                          disabled={isActionLoading}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(52, 199, 89, 0.1)',
                            border: '1px solid rgba(52, 199, 89, 0.25)',
                            color: '#34C759',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle size={12} />
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
