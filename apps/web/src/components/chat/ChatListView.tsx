import React, { useState } from 'react';
import { Conversation, formatAppId } from '@callapp/shared';
import {
  Search,
  Plus,
  MessageSquare,
  Pin,
  VolumeX,
  Mic,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

interface ChatListViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  typingState: Record<string, { senderAppId: string; senderName: string }[]>;
  onSelectConversation: (id: string) => void;
  onOpenNewChatModal: () => void;
  onDeleteConversation?: (id: string) => void;
}

export const ChatListView: React.FC<ChatListViewProps> = ({
  conversations,
  activeConversationId,
  typingState,
  onSelectConversation,
  onOpenNewChatModal,
  onDeleteConversation,
}) => {
  const { user } = useAuth();
  const { presenceMap } = useCall();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    if (filterType === 'unread' && (!c.unreadCount || c.unreadCount === 0)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.contactName?.toLowerCase().includes(q);
    const appIdMatch = c.contactAppId?.includes(q);
    const lastMsgMatch = c.lastMessagePreview?.toLowerCase().includes(q);
    return nameMatch || appIdMatch || lastMsgMatch;
  });

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isThisWeek = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
    if (isThisWeek) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-glass)',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Chats
          </h1>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(52, 199, 89, 0.12)',
              color: '#34C759',
              fontWeight: 700,
            }}
          >
            🔒 Local & Private
          </span>
        </div>

        <button
          onClick={onOpenNewChatModal}
          title="New Direct Message"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            border: 'none',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10, 132, 255, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '16px',
            padding: '8px 14px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search 10-digit App ID or messages..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'unread'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              style={{
                padding: '5px 14px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: filterType === tab ? 'var(--accent-primary)' : 'var(--bg-input)',
                color: filterType === tab ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
        {filteredConversations.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                No private chats yet
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Start a 1-to-1 conversation with any 10-digit App ID.
              </div>
            </div>
            <button
              onClick={onOpenNewChatModal}
              style={{
                marginTop: '8px',
                padding: '8px 18px',
                borderRadius: '20px',
                backgroundColor: 'var(--accent-primary)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Start New Chat
            </button>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isSelected = activeConversationId === conv.id;
            const typingList = typingState[conv.id] || [];
            const isTyping = typingList.length > 0;
            const presence = presenceMap[conv.contactAppId] || 'offline';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
                  border: isSelected ? '1px solid rgba(10, 132, 255, 0.25)' : '1px solid transparent',
                  marginBottom: '4px',
                  transition: 'background-color 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Avatar with Presence Indicator */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary) 0%, #5856D6 100%)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                    }}
                  >
                    {conv.contactName?.charAt(0) || 'U'}
                  </div>

                  {/* Presence Dot */}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '1px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor:
                        presence === 'online'
                          ? '#34C759'
                          : presence === 'in_call'
                          ? '#FF9500'
                          : 'var(--presence-offline)',
                      border: '2px solid var(--bg-card)',
                    }}
                  />
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {conv.contactName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ({formatAppId(conv.contactAppId)})
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: conv.unreadCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontWeight: conv.unreadCount > 0 ? 700 : 500,
                      }}
                    >
                      {formatTimestamp(conv.lastMessageAt)}
                    </span>
                  </div>

                  {/* Subtitle / Preview / Typing */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '3px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: isTyping ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontStyle: isTyping ? 'italic' : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '200px',
                      }}
                    >
                      {isTyping ? `${typingList[0].senderName} is typing...` : conv.lastMessagePreview || 'No messages'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {conv.isPinned && <Pin size={13} color="var(--text-muted)" />}
                      {conv.isMuted && <VolumeX size={13} color="var(--text-muted)" />}
                      {conv.unreadCount > 0 && (
                        <span
                          style={{
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '9px',
                            backgroundColor: 'var(--accent-primary)',
                            color: '#FFFFFF',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                          }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                      {onDeleteConversation && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (window.confirm(`Delete local chat history with ${conv.contactName}?`)) {
                              onDeleteConversation(conv.id);
                            }
                          }}
                          title="Delete local chat history"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
