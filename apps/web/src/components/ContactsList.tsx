import React, { useState, useEffect } from 'react';
import { UserPlus, Phone, Trash2, Search, X, Copy, Check, User } from 'lucide-react';
import { Contact, formatAppId, isValidAppId } from '@callapp/shared';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';

interface ContactsListProps {
  initialAddAppId?: string | null;
  onClearInitialAdd?: () => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  initialAddAppId,
  onClearInitialAdd,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newAppId, setNewAppId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { initiateCall, presenceMap, queryPresence, isConnected } = useCall();
  const { user, token } = useAuth();

  useEffect(() => {
    if (initialAddAppId) {
      setNewAppId(initialAddAppId);
      setShowAddModal(true);
      if (onClearInitialAdd) onClearInitialAdd();
    }
  }, [initialAddAppId, onClearInitialAdd]);

  const fetchContacts = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        const appIds = (data.contacts || []).map((c: Contact) => c.contactAppId);
        queryPresence(appIds);
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!token) {
      setAddError('You must be signed in to add contacts');
      return;
    }

    if (!isValidAppId(newAppId)) {
      setAddError('Please enter a valid 10-digit App ID');
      return;
    }

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactAppId: newAppId.trim(),
          contactName: newName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add contact');
        return;
      }

      setNewAppId('');
      setNewName('');
      setShowAddModal(false);
      fetchContacts();
    } catch (err: any) {
      setAddError(err.message || 'Error adding contact');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (e) {
      console.error('Error deleting contact:', e);
    }
  };

  const handleCopyAppId = (appId: string) => {
    navigator.clipboard.writeText(appId);
    setCopiedId(appId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredContacts = contacts.filter(
    c =>
      c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactAppId.includes(searchQuery)
  );

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', paddingBottom: '1.5rem' }}>
      {/* ── Title & Add Button ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Contacts
        </h1>
        <button
          onClick={() => {
            setNewAppId('');
            setNewName('');
            setAddError(null);
            setShowAddModal(true);
          }}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-subtle)',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Add Contact"
        >
          <UserPlus size={18} />
        </button>
      </div>

      {/* ── iOS Style Search Field ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border-glass-subtle)',
          borderRadius: '12px',
          padding: '8px 12px',
          gap: '8px',
          marginBottom: '1rem',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search contacts or App ID"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            width: '100%',
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── "My Card" Profile Preview ────────────────────────────── */}
      {user && (
        <div
          className="liquid-glass"
          style={{
            padding: '12px 16px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-blue) 0%, #5856D6 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                My Card
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                App ID: {formatAppId(user.appId)}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleCopyAppId(user.appId)}
            style={{
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--accent-blue)',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Copy My App ID"
          >
            {copiedId === user.appId ? <Check size={13} color="var(--accent-call)" /> : <Copy size={13} />}
            <span>{copiedId === user.appId ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      )}

      {/* ── Contacts List ────────────────────────────────────────── */}
      <div>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: 'var(--text-muted)',
            }}
          >
            <User size={40} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No Contacts
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Add a contact using their 10-digit App ID.
            </p>
          </div>
        ) : (
          <div
            className="liquid-glass"
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-glass)',
            }}
          >
            {filteredContacts.map((contact, index) => {
              const presence = presenceMap[contact.contactAppId] || 'offline';

              return (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderBottom: index < filteredContacts.length - 1 ? '1px solid var(--border-separator)' : 'none',
                  }}
                >
                  {/* Left: Avatar + Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-surface-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '1rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {contact.contactName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`presence-dot presence-${presence}`}
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          border: '2px solid var(--bg-app)',
                        }}
                        title={`Status: ${presence}`}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {contact.contactName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                        }}
                      >
                        {formatAppId(contact.contactAppId)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleCopyAppId(contact.contactAppId)}
                      style={{
                        padding: '6px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Copy App ID"
                    >
                      {copiedId === contact.contactAppId ? <Check size={16} color="var(--accent-call)" /> : <Copy size={16} />}
                    </button>

                    <button
                      onClick={() => initiateCall(contact.contactAppId)}
                      disabled={!isConnected}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        color: 'var(--accent-call)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Call"
                    >
                      <Phone size={16} fill="currentColor" />
                    </button>

                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      style={{
                        padding: '6px',
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete Contact"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Contact Modal Sheet ──────────────────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-backdrop)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="liquid-glass-elevated animate-slide-up"
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: '1.75rem',
              borderRadius: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                New Contact
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {addError && (
              <div
                style={{
                  backgroundColor: 'rgba(255, 59, 48, 0.12)',
                  color: 'var(--accent-hangup)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  10-Digit App ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0748321905"
                  maxLength={10}
                  value={newAppId}
                  onChange={e => setNewAppId(e.target.value.replace(/\D/g, ''))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-glass-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    letterSpacing: '0.04em',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-glass-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--accent-blue)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
