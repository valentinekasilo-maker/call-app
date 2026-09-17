import React, { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, RotateCcw, Info } from 'lucide-react';
import { CallRecord, formatAppId } from '@callapp/shared';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';

export const CallHistory: React.FC = () => {
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user, token } = useAuth();
  const { initiateCall, isConnected } = useCall();

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/calls/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to load call history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCallDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredHistory = history.filter(call => {
    if (filter === 'missed') {
      const isOutgoing = call.callerAppId === user?.appId;
      return !isOutgoing && call.status === 'missed';
    }
    return true;
  });

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', paddingBottom: '1rem' }}>
      {/* ── Top Header & Segmented Filter ────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Recents
          </h1>
          <button
            onClick={fetchHistory}
            style={{
              padding: '6px',
              color: 'var(--accent-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Refresh Recents"
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {/* iOS Segmented Pill (All / Missed) */}
        <div className="ios-segmented-control">
          <button
            onClick={() => setFilter('all')}
            className={`ios-segmented-tab ${filter === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('missed')}
            className={`ios-segmented-tab ${filter === 'missed' ? 'active' : ''}`}
          >
            Missed
          </button>
        </div>
      </div>

      {/* ── Recents List ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
            Loading calls...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              color: 'var(--text-muted)',
            }}
          >
            <Phone size={42} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No Recents
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {filter === 'missed' ? 'You have no missed calls.' : 'Calls you make and receive will appear here.'}
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
            {filteredHistory.map((call, index) => {
              const isOutgoing = call.callerAppId === user?.appId;
              const remoteAppId = isOutgoing ? call.receiverAppId : call.callerAppId;
              const remoteName = isOutgoing ? call.receiverName || 'User' : call.callerName || 'User';
              const isMissed = !isOutgoing && call.status === 'missed';
              const isDeclined = call.status === 'declined';
              const isCancelled = call.status === 'cancelled';

              const getStatusLabel = () => {
                if (isMissed) return 'Missed';
                if (isDeclined) return 'Declined';
                if (isCancelled) return 'Cancelled';
                if (call.status === 'completed' && call.duration > 0) return formatDuration(call.duration);
                return isOutgoing ? 'Outgoing' : 'Incoming';
              };

              return (
                <div
                  key={call.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderBottom: index < filteredHistory.length - 1 ? '1px solid var(--border-separator)' : 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Left: Avatar + Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: isMissed ? 'rgba(255, 59, 48, 0.14)' : 'var(--bg-surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: isMissed ? 'var(--accent-hangup)' : 'var(--text-primary)',
                        flexShrink: 0,
                      }}
                    >
                      {remoteName.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: isMissed ? 'var(--accent-hangup)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {isOutgoing ? (
                          <PhoneOutgoing size={13} color="var(--text-muted)" />
                        ) : isMissed ? (
                          <PhoneMissed size={13} color="var(--accent-hangup)" />
                        ) : isDeclined || isCancelled ? (
                          <PhoneMissed size={13} color="var(--text-muted)" />
                        ) : (
                          <PhoneIncoming size={13} color="var(--accent-call)" />
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{remoteName}</span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{formatAppId(remoteAppId)}</span>
                        <span>• {getStatusLabel()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Date/Time + Redial */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatCallDate(call.startedAt)}
                    </span>
                    <button
                      onClick={() => initiateCall(remoteAppId)}
                      disabled={!isConnected}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        color: 'var(--accent-call)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`Call ${remoteName}`}
                    >
                      <Phone size={15} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
