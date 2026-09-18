import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, formatAppId, SoundManager } from '@callapp/shared';
import {
  Phone,
  ChevronLeft,
  Paperclip,
  Send,
  Mic,
  FileText,
  Check,
  CheckCheck,
  CornerUpLeft,
  Edit2,
  Trash2,
  Copy,
  Play,
  Pause,
  Download,
  X,
  Shield,
  Clock,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useContacts } from '../../context/ContactsContext';
import { VoiceRecorder } from './VoiceRecorder';

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
  typingUsers: { senderAppId: string; senderName: string }[];
  onBack?: () => void;
  onSendMessage: (params: {
    content?: string;
    type?: any;
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    mediaDuration?: number;
    replyTo?: Message['replyTo'];
  }) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onReactToMessage: (messageId: string, emoji: string, action?: 'add' | 'remove') => Promise<void>;
  onSendTyping: (isTyping: boolean) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onUploadMedia: (file: File) => Promise<{ url: string; name: string; size: number; duration?: number }>;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  messages,
  typingUsers,
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onSendTyping,
  onDeleteConversation,
  onUploadMedia,
}) => {
  const { user } = useAuth();
  const { initiateCall, presenceMap } = useCall();
  const { resolveContactDisplayName, isContactSaved, addContact } = useContacts();

  const userAppId = user?.appId?.replace(/\D/g, '') || '';
  const [inputContent, setInputContent] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});

  // Add Contact modal states
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [customContactName, setCustomContactName] = useState<string>('');
  const [addContactLoading, setAddContactLoading] = useState<boolean>(false);
  const [addContactError, setAddContactError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  const displayName = resolveContactDisplayName(conversation.contactAppId, conversation.contactName);
  const isSaved = isContactSaved(conversation.contactAppId);

  const presence = presenceMap[conversation.contactAppId] || 'offline';
  const isTyping = typingUsers.length > 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputContent(val);
    onSendTyping(val.length > 0);
  };

  const handleSend = async () => {
    if (!inputContent.trim()) return;
    SoundManager.triggerHaptic(20);

    if (editingMessage) {
      await onEditMessage(editingMessage.id, inputContent.trim());
      setEditingMessage(null);
      setInputContent('');
      onSendTyping(false);
      return;
    }

    const content = inputContent.trim();
    const replyTo = replyingTo
      ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          content: replyingTo.content,
          type: replyingTo.type,
        }
      : undefined;

    setInputContent('');
    setReplyingTo(null);
    onSendTyping(false);

    try {
      await onSendMessage({
        content,
        type: 'text',
        replyTo,
      });
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    setIsRecordingVoice(false);
    try {
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const { url } = await onUploadMedia(file);
      await onSendMessage({
        type: 'audio',
        mediaUrl: url,
        mediaDuration: duration,
        mediaName: 'Voice Note',
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              senderName: replyingTo.senderName,
              content: replyingTo.content,
              type: replyingTo.type,
            }
          : undefined,
      });
      setReplyingTo(null);
    } catch (e) {
      console.error('Failed to send voice note:', e);
    }
  };

  const toggleAudio = (msgId: string, url: string) => {
    let audio = audioElementsRef.current[msgId];
    if (!audio) {
      audio = new Audio(url);
      audioElementsRef.current[msgId] = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress(prev => ({
            ...prev,
            [msgId]: (audio.currentTime / audio.duration) * 100,
          }));
        }
      };

      audio.onended = () => {
        setPlayingAudioId(null);
        setAudioProgress(prev => ({ ...prev, [msgId]: 0 }));
      };
    }

    if (playingAudioId === msgId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      Object.values(audioElementsRef.current).forEach(a => a.pause());
      audio.play();
      setPlayingAudioId(msgId);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Avatar with live presence */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #5856D6 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              {displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '11px',
                height: '11px',
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

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                {displayName}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: isTyping ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
              {isTyping
                ? `${typingUsers[0].senderName} is typing...`
                : `${formatAppId(conversation.contactAppId)} • ${presence === 'online' ? 'Online' : presence === 'in_call' ? 'In Call' : 'Offline'}`}
            </div>
          </div>
        </div>

        {/* Action Controls (Voice Calling + Add Contact when unsaved) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isSaved && (
            <button
              onClick={() => {
                setCustomContactName('');
                setAddContactError(null);
                setShowAddContactModal(true);
              }}
              title="Add to Contacts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(10, 132, 255, 0.12)',
                border: '1px solid rgba(10, 132, 255, 0.25)',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={15} />
              <span>Add Contact</span>
            </button>
          )}

          <button
            onClick={() => initiateCall(conversation.contactAppId, 'audio')}
            title="Voice Call"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 199, 89, 0.12)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              color: '#34C759',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Phone size={18} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-card)',
              padding: '16px 24px',
              borderRadius: '20px',
              border: '1px solid var(--border-glass)',
              maxWidth: '320px',
            }}
          >
            🔒 Messages and voice notes are stored locally on your device and transmitted directly.
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderAppId === userAppId;
            const isMenuOpen = activeMenuMessageId === msg.id;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  position: 'relative',
                }}
              >
                {/* Message Bubble */}
                <div
                  onContextMenu={e => {
                    e.preventDefault();
                    setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                  }}
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                    border: isMe ? 'none' : '1px solid var(--border-glass)',
                    position: 'relative',
                  }}
                >
                  {/* Quoted Reply */}
                  {msg.replyTo && (
                    <div
                      style={{
                        padding: '6px 10px',
                        backgroundColor: isMe ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-input)',
                        borderLeft: `3px solid ${isMe ? '#FFFFFF' : 'var(--accent-primary)'}`,
                        borderRadius: '6px',
                        marginBottom: '6px',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, opacity: 0.9 }}>{msg.replyTo.senderName}</div>
                      <div style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.replyTo.content || 'Voice Note'}
                      </div>
                    </div>
                  )}

                  {/* Voice Note Player */}
                  {msg.type === 'audio' && msg.mediaUrl && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minWidth: '220px',
                        padding: '4px 0',
                      }}
                    >
                      <button
                        onClick={() => toggleAudio(msg.id, msg.mediaUrl!)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: isMe ? '#FFFFFF' : 'var(--accent-primary)',
                          color: isMe ? 'var(--accent-primary)' : '#FFFFFF',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {playingAudioId === msg.id ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            height: '4px',
                            backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : 'var(--bg-input)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              backgroundColor: isMe ? '#FFFFFF' : 'var(--accent-primary)',
                              width: `${audioProgress[msg.id] || 0}%`,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.68rem',
                            marginTop: '4px',
                            opacity: 0.8,
                          }}
                        >
                          <span>🎤 Voice note</span>
                          <span>{msg.mediaDuration ? `${msg.mediaDuration}s` : ''}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Content */}
                  {msg.content && (
                    <div
                      style={{
                        fontSize: '0.92rem',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                        fontStyle: msg.isDeleted ? 'italic' : 'normal',
                        opacity: msg.isDeleted ? 0.7 : 1,
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Time & Delivery Ticks */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px',
                      fontSize: '0.68rem',
                      opacity: isMe ? 0.85 : 0.6,
                    }}
                  >
                    {msg.isEdited && <span>(edited)</span>}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && !msg.isDeleted && (
                      <span>
                        {msg.status === 'read' ? (
                          <CheckCheck size={14} color="#64D2FF" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck size={14} color="rgba(255, 255, 255, 0.7)" />
                        ) : (
                          <Check size={14} color="rgba(255, 255, 255, 0.7)" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Floating Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      marginTop: '-8px',
                      marginLeft: isMe ? '0' : '10px',
                      marginRight: isMe ? '10px' : '0',
                      zIndex: 5,
                    }}
                  >
                    {msg.reactions.map(r => (
                      <span
                        key={r.id}
                        onClick={() => onReactToMessage(msg.id, r.emoji, r.userAppId === userAppId ? 'remove' : 'add')}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '12px',
                          padding: '2px 6px',
                          fontSize: '0.75rem',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          cursor: 'pointer',
                        }}
                      >
                        {r.emoji}
                      </span>
                    ))}
                  </div>
                )}

                {/* Context Action Menu */}
                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      [isMe ? 'right' : 'left']: '0',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 30,
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    {/* Quick Reactions Bar */}
                    <div style={{ display: 'flex', gap: '6px', padding: '4px 6px', borderBottom: '1px solid var(--border-glass)' }}>
                      {quickEmojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            onReactToMessage(msg.id, emoji);
                            setActiveMenuMessageId(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setReplyingTo(msg);
                        setActiveMenuMessageId(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        borderRadius: '8px',
                      }}
                    >
                      <CornerUpLeft size={15} /> Reply
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content || '');
                        setActiveMenuMessageId(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        borderRadius: '8px',
                      }}
                    >
                      <Copy size={15} /> Copy
                    </button>

                    {isMe && !msg.isDeleted && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessage(msg);
                            setInputContent(msg.content || '');
                            setActiveMenuMessageId(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            borderRadius: '8px',
                          }}
                        >
                          <Edit2 size={15} /> Edit
                        </button>

                        <button
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setActiveMenuMessageId(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#FF3B30',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            borderRadius: '8px',
                          }}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Banner */}
      {replyingTo && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerUpLeft size={16} color="var(--accent-primary)" />
            <div>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                Replying to {replyingTo.senderName}:
              </span>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{replyingTo.content || 'Voice Note'}</span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Editing Message</span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputContent('');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Area / Voice Recorder */}
      <div
        style={{
          padding: '10px 16px',
          backgroundColor: 'var(--bg-card)',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'relative',
        }}
      >
        {isRecordingVoice ? (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setIsRecordingVoice(false)} />
        ) : (
          <>
            <textarea
              value={inputContent}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                outline: 'none',
                resize: 'none',
                maxHeight: '100px',
                fontFamily: 'inherit',
              }}
            />

            {inputContent.trim().length > 0 ? (
              <button
                onClick={handleSend}
                title="Send Message"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(10, 132, 255, 0.3)',
                }}
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={() => setIsRecordingVoice(true)}
                title="Record Voice Note"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mic size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Add Contact Modal Dialog */}
      {showAddContactModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowAddContactModal(false)}
        >
          <div
            className="liquid-glass"
            style={{
              width: '100%',
              maxWidth: '360px',
              borderRadius: '24px',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Add Contact
              </h3>
              <button
                onClick={() => setShowAddContactModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                App ID
              </label>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {formatAppId(conversation.contactAppId)}
              </div>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!customContactName.trim()) {
                  setAddContactError('Please enter a contact name');
                  return;
                }
                try {
                  setAddContactLoading(true);
                  setAddContactError(null);
                  await addContact(conversation.contactAppId, customContactName.trim());
                  setShowAddContactModal(false);
                  setCustomContactName('');
                } catch (err: any) {
                  setAddContactError(err.message || 'Failed to save contact');
                } finally {
                  setAddContactLoading(false);
                }
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John"
                  value={customContactName}
                  onChange={e => setCustomContactName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {addContactError && (
                <div style={{ color: 'var(--accent-hangup)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  {addContactError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addContactLoading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    opacity: addContactLoading ? 0.7 : 1,
                  }}
                >
                  {addContactLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
