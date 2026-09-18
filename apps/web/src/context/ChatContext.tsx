import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
  Conversation,
  Message,
  MessageReaction,
  MessageType,
  isValidAppId,
  formatAppId,
} from '@callapp/shared';
import { useAuth } from './AuthContext';
import { useCall } from './CallContext';
import { SoundManager } from '@callapp/shared';

interface TypingState {
  conversationId: string;
  senderAppId: string;
  senderName: string;
  isTyping: boolean;
}

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Record<string, Message[]>;
  typingState: Record<string, { senderAppId: string; senderName: string }[]>;
  totalUnreadChats: number;
  selectConversation: (conversationId: string | null) => void;
  startDirectChat: (targetAppId: string, targetName?: string) => Promise<Conversation>;
  sendMessage: (params: {
    conversationId: string;
    targetAppId: string;
    content?: string;
    type?: MessageType;
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    mediaDuration?: number;
    replyTo?: Message['replyTo'];
  }) => Promise<void>;
  editMessage: (conversationId: string, targetAppId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, targetAppId: string, messageId: string) => Promise<void>;
  reactToMessage: (conversationId: string, targetAppId: string, messageId: string, emoji: string, action?: 'add' | 'remove') => Promise<void>;
  sendTyping: (conversationId: string, targetAppId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string, targetAppId: string) => void;
  deleteConversation: (conversationId: string) => void;
  uploadMedia: (file: File) => Promise<{ url: string; name: string; size: number; duration?: number }>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useCall();

  const userAppId = user?.appId?.replace(/\D/g, '') || '';
  const CONV_STORAGE_KEY = `callapp_local_conversations_${userAppId}`;
  const MSG_STORAGE_KEY = `callapp_local_messages_${userAppId}`;

  // State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (!userAppId) return [];
    try {
      const saved = localStorage.getItem(`callapp_local_conversations_${userAppId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (!userAppId) return {};
    try {
      const saved = localStorage.getItem(`callapp_local_messages_${userAppId}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [typingState, setTypingState] = useState<Record<string, { senderAppId: string; senderName: string }[]>>({});

  const typingTimeoutRef = useRef<Record<string, any>>({});
  const activeConvRef = useRef<string | null>(activeConversationId);
  activeConvRef.current = activeConversationId;

  // Active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  // Total unread count
  const totalUnreadChats = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Sync to localStorage whenever conversations change
  useEffect(() => {
    if (userAppId) {
      try {
        localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversations));
      } catch (e) {
        console.warn('LocalStorage save error for conversations:', e);
      }
    }
  }, [conversations, userAppId, CONV_STORAGE_KEY]);

  // Sync to localStorage whenever messages change
  useEffect(() => {
    if (userAppId) {
      try {
        localStorage.setItem(MSG_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn('LocalStorage save error for messages:', e);
      }
    }
  }, [messages, userAppId, MSG_STORAGE_KEY]);

  // Reload when user account changes
  useEffect(() => {
    if (userAppId) {
      try {
        const savedConvs = localStorage.getItem(CONV_STORAGE_KEY);
        const savedMsgs = localStorage.getItem(MSG_STORAGE_KEY);
        setConversations(savedConvs ? JSON.parse(savedConvs) : []);
        setMessages(savedMsgs ? JSON.parse(savedMsgs) : {});
      } catch (e) {
        setConversations([]);
        setMessages({});
      }
    } else {
      setConversations([]);
      setMessages({});
      setActiveConversationId(null);
    }
  }, [userAppId, CONV_STORAGE_KEY, MSG_STORAGE_KEY]);

  // Mark conversation as read
  const markAsRead = useCallback(
    (conversationId: string, targetAppId: string) => {
      // 1. Mark in local state
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );

      // 2. Mark received messages as read
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m =>
            m.receiverAppId === userAppId ? { ...m, status: 'read' as const } : m
          ),
        };
      });

      // 3. Emit read ack over socket to sender
      if (socket && isConnected) {
        socket.emit('chat:read', { conversationId, targetAppId });
      }
    },
    [socket, isConnected, userAppId]
  );

  // Select conversation
  const selectConversation = useCallback(
    (conversationId: string | null) => {
      setActiveConversationId(conversationId);
      if (conversationId) {
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) {
          markAsRead(conversationId, conv.contactAppId);
        }
      }
    },
    [conversations, markAsRead]
  );

  // Start Direct Chat with 10-digit App ID
  const startDirectChat = useCallback(
    async (targetAppId: string, targetName?: string): Promise<Conversation> => {
      const cleanTargetId = targetAppId.replace(/\D/g, '');
      if (!isValidAppId(cleanTargetId)) {
        throw new Error('Please enter a valid 10-digit App ID');
      }

      if (cleanTargetId === userAppId) {
        throw new Error('You cannot start a chat with yourself');
      }

      // Check if conversation already exists
      const existing = conversations.find(c => c.contactAppId === cleanTargetId);
      if (existing) {
        selectConversation(existing.id);
        return existing;
      }

      // Create new local conversation
      const newConvId = `conv_${[userAppId, cleanTargetId].sort().join('_')}`;
      const now = new Date().toISOString();
      const newConv: Conversation = {
        id: newConvId,
        contactAppId: cleanTargetId,
        contactName: targetName || `User (${formatAppId(cleanTargetId)})`,
        lastMessageAt: now,
        lastMessagePreview: 'Started chat',
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      setConversations(prev => [newConv, ...prev]);
      selectConversation(newConvId);
      return newConv;
    },
    [userAppId, conversations, selectConversation]
  );

  // Send Message
  const sendMessage = useCallback(
    async (params: {
      conversationId: string;
      targetAppId: string;
      content?: string;
      type?: MessageType;
      mediaUrl?: string;
      mediaName?: string;
      mediaSize?: number;
      mediaDuration?: number;
      replyTo?: Message['replyTo'];
    }) => {
      const { conversationId, targetAppId, content, type = 'text', mediaUrl, mediaName, mediaSize, mediaDuration, replyTo } = params;
      const cleanTargetId = targetAppId.replace(/\D/g, '');

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const newMsg: Message = {
        id: msgId,
        conversationId,
        senderAppId: userAppId,
        senderName: user?.name || 'Me',
        receiverAppId: cleanTargetId,
        content: content || '',
        type,
        mediaUrl,
        mediaName,
        mediaSize,
        mediaDuration,
        replyTo,
        reactions: [],
        status: 'sending',
        isEdited: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Optimistically append message to local storage state
      setMessages(prev => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: [...list, newMsg],
        };
      });

      // 2. Update conversation preview and move to top
      const previewText = type === 'audio' ? '🎤 Voice note' : content || 'Message';
      setConversations(prev => {
        const existing = prev.find(c => c.id === conversationId);
        if (existing) {
          const updated = {
            ...existing,
            lastMessageAt: now,
            lastMessagePreview: previewText,
            updatedAt: now,
          };
          return [updated, ...prev.filter(c => c.id !== conversationId)];
        } else {
          const created: Conversation = {
            id: conversationId,
            contactAppId: cleanTargetId,
            contactName: `User (${formatAppId(cleanTargetId)})`,
            lastMessageAt: now,
            lastMessagePreview: previewText,
            unreadCount: 0,
            createdAt: now,
            updatedAt: now,
          };
          return [created, ...prev];
        }
      });

      // 3. Realtime delivery over socket relay
      if (socket && isConnected) {
        socket.emit('chat:send', { conversationId, targetAppId: cleanTargetId, message: newMsg }, (res: any) => {
          const finalStatus: Message['status'] = res?.delivered ? 'delivered' : 'sent';
          setMessages(prev => {
            const list = prev[conversationId] || [];
            return {
              ...prev,
              [conversationId]: list.map(m => (m.id === msgId ? { ...m, status: finalStatus } : m)),
            };
          });
        });
      } else {
        // Mark as sent in local state
        setMessages(prev => {
          const list = prev[conversationId] || [];
          return {
            ...prev,
            [conversationId]: list.map(m => (m.id === msgId ? { ...m, status: 'sent' } : m)),
          };
        });
      }
    },
    [userAppId, user, socket, isConnected]
  );

  // Edit Message locally + socket
  const editMessage = useCallback(
    async (conversationId: string, targetAppId: string, messageId: string, content: string) => {
      const now = new Date().toISOString();
      setMessages(prev => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: list.map(m => (m.id === messageId ? { ...m, content, isEdited: true, updatedAt: now } : m)),
        };
      });

      if (socket && isConnected) {
        socket.emit('chat:edit', { conversationId, targetAppId, messageId, content });
      }
    },
    [socket, isConnected]
  );

  // Delete Message locally + socket
  const deleteMessage = useCallback(
    async (conversationId: string, targetAppId: string, messageId: string) => {
      const now = new Date().toISOString();
      setMessages(prev => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: list.map(m =>
            m.id === messageId ? { ...m, content: 'This message was deleted', isDeleted: true, updatedAt: now } : m
          ),
        };
      });

      if (socket && isConnected) {
        socket.emit('chat:delete', { conversationId, targetAppId, messageId });
      }
    },
    [socket, isConnected]
  );

  // React to Message
  const reactToMessage = useCallback(
    async (conversationId: string, targetAppId: string, messageId: string, emoji: string, action: 'add' | 'remove' = 'add') => {
      setMessages(prev => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: list.map(m => {
            if (m.id !== messageId) return m;
            let listReacts = m.reactions || [];
            if (action === 'remove') {
              listReacts = listReacts.filter(r => !(r.userAppId === userAppId && r.emoji === emoji));
            } else {
              if (!listReacts.some(r => r.userAppId === userAppId && r.emoji === emoji)) {
                listReacts = [
                  ...listReacts,
                  {
                    id: `${messageId}-${userAppId}-${emoji}`,
                    messageId,
                    userAppId,
                    userName: user?.name,
                    emoji,
                    createdAt: new Date().toISOString(),
                  },
                ];
              }
            }
            return { ...m, reactions: listReacts };
          }),
        };
      });

      if (socket && isConnected) {
        socket.emit('chat:react', { conversationId, targetAppId, messageId, emoji, action });
      }
    },
    [userAppId, user, socket, isConnected]
  );

  // Send Typing
  const sendTyping = useCallback(
    (conversationId: string, targetAppId: string, isTyping: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit('chat:typing', { conversationId, targetAppId, isTyping });

      if (isTyping) {
        if (typingTimeoutRef.current[conversationId]) {
          clearTimeout(typingTimeoutRef.current[conversationId]);
        }
        typingTimeoutRef.current[conversationId] = setTimeout(() => {
          socket.emit('chat:typing', { conversationId, targetAppId, isTyping: false });
        }, 3500);
      }
    },
    [socket, isConnected]
  );

  // Delete Conversation locally
  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    setMessages(prev => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    if (activeConvRef.current === conversationId) {
      setActiveConversationId(null);
    }
  }, []);

  // Upload Voice/Audio Media helper (Base64 data URL for local device storage)
  const uploadMedia = useCallback(
    async (file: File): Promise<{ url: string; name: string; size: number; duration?: number }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            url: reader.result as string,
            name: file.name,
            size: file.size,
          });
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Socket Realtime Listeners
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    // 1. Incoming real-time message
    const handleIncomingMessage = (payload: { conversationId: string; message: Message }) => {
      const { conversationId, message } = payload;
      const senderAppId = message.senderAppId;

      // Ensure conversation exists locally
      setConversations(prev => {
        const isViewing = activeConvRef.current === conversationId;
        const existing = prev.find(c => c.id === conversationId);
        const preview = message.type === 'audio' ? '🎤 Voice note' : message.content || 'Message';

        if (existing) {
          const updated = {
            ...existing,
            lastMessageAt: message.createdAt,
            lastMessagePreview: preview,
            unreadCount: isViewing ? 0 : existing.unreadCount + 1,
            updatedAt: message.createdAt,
          };
          return [updated, ...prev.filter(c => c.id !== conversationId)];
        } else {
          const created: Conversation = {
            id: conversationId,
            contactAppId: senderAppId,
            contactName: message.senderName || `User (${formatAppId(senderAppId)})`,
            lastMessageAt: message.createdAt,
            lastMessagePreview: preview,
            unreadCount: isViewing ? 0 : 1,
            createdAt: message.createdAt,
            updatedAt: message.createdAt,
          };
          return [created, ...prev];
        }
      });

      // Append to local messages
      setMessages(prev => {
        const currentList = prev[conversationId] || [];
        if (currentList.some(m => m.id === message.id)) return prev;
        return {
          ...prev,
          [conversationId]: [...currentList, message],
        };
      });

      // Send delivered ack back to sender
      socket.emit('chat:delivered', {
        conversationId,
        targetAppId: senderAppId,
        messageId: message.id,
      });

      // If active conversation, also mark read immediately
      if (activeConvRef.current === conversationId) {
        socket.emit('chat:read', { conversationId, targetAppId: senderAppId });
      } else {
        // Play notification tone
        try {
          SoundManager.playConnectedSound();
        } catch (e) {}

        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(message.senderName || 'New Message', {
            body: message.content || 'Sent a voice note',
            icon: '/icon-192.png',
          });
        }
      }
    };

    // 2. Message delivered ack
    const handleDelivered = (payload: { conversationId: string; messageId: string; deliveredToAppId: string }) => {
      const { conversationId, messageId } = payload;
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m =>
            m.id === messageId && m.status !== 'read' ? { ...m, status: 'delivered' } : m
          ),
        };
      });
    };

    // 3. Message read ack
    const handleRead = (payload: { conversationId: string; readByAppId: string; readAt: string }) => {
      const { conversationId } = payload;
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m =>
            m.senderAppId === userAppId ? { ...m, status: 'read' } : m
          ),
        };
      });
    };

    // 4. Typing indicator
    const handleTyping = (payload: {
      conversationId: string;
      senderAppId: string;
      senderName: string;
      isTyping: boolean;
    }) => {
      const { conversationId, senderAppId, senderName, isTyping } = payload;
      if (senderAppId === userAppId) return;

      setTypingState(prev => {
        const currentList = prev[conversationId] || [];
        if (isTyping) {
          if (currentList.some(u => u.senderAppId === senderAppId)) return prev;
          return { ...prev, [conversationId]: [...currentList, { senderAppId, senderName }] };
        } else {
          return { ...prev, [conversationId]: currentList.filter(u => u.senderAppId !== senderAppId) };
        }
      });
    };

    // 5. Reactions
    const handleReaction = (payload: {
      conversationId: string;
      messageId: string;
      userAppId: string;
      emoji: string;
      action: 'add' | 'remove';
    }) => {
      const { conversationId, messageId, userAppId: rUserAppId, emoji, action } = payload;
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m => {
            if (m.id !== messageId) return m;
            let current = m.reactions || [];
            if (action === 'remove') {
              current = current.filter(r => !(r.userAppId === rUserAppId && r.emoji === emoji));
            } else {
              if (!current.some(r => r.userAppId === rUserAppId && r.emoji === emoji)) {
                current = [
                  ...current,
                  {
                    id: `${messageId}-${rUserAppId}-${emoji}`,
                    messageId,
                    userAppId: rUserAppId,
                    emoji,
                    createdAt: new Date().toISOString(),
                  },
                ];
              }
            }
            return { ...m, reactions: current };
          }),
        };
      });
    };

    // 6. Message Edited
    const handleEdited = (payload: { conversationId: string; messageId: string; content: string; updatedAt: string }) => {
      const { conversationId, messageId, content, updatedAt } = payload;
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m => (m.id === messageId ? { ...m, content, isEdited: true, updatedAt } : m)),
        };
      });
    };

    // 7. Message Deleted
    const handleDeleted = (payload: { conversationId: string; messageId: string }) => {
      const { conversationId, messageId } = payload;
      setMessages(prev => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map(m =>
            m.id === messageId ? { ...m, content: 'This message was deleted', isDeleted: true } : m
          ),
        };
      });
    };

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:delivered', handleDelivered);
    socket.on('chat:read', handleRead);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:edited', handleEdited);
    socket.on('chat:deleted', handleDeleted);

    return () => {
      socket.off('chat:message', handleIncomingMessage);
      socket.off('chat:delivered', handleDelivered);
      socket.off('chat:read', handleRead);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:edited', handleEdited);
      socket.off('chat:deleted', handleDeleted);
    };
  }, [socket, isConnected, userAppId]);

  return (
    <ChatContext.Provider
      value={{
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
        markAsRead,
        deleteConversation,
        uploadMedia,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
