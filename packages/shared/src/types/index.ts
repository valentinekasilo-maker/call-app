export type UserPresence = 'online' | 'offline' | 'connecting' | 'in_call';

export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'missed'
  | 'cancelled'
  | 'completed'
  | 'failed';

export type IdentityType = 'human' | 'ai' | 'bot' | 'service' | 'device' | 'application';
export type AccountType = IdentityType;
export type IdentityStatus = 'active' | 'inactive' | 'revoked';

export interface User {
  id: string;
  name: string;
  appId: string; // 10-digit numeric ID e.g. 0748321905
  email?: string;
  accountType?: IdentityType;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface UserProfile extends User {
  presence?: UserPresence;
}

export interface CallingIdentity {
  id: string;
  profileId: string;
  name: string;
  appId: string; // 10-digit App ID
  type: IdentityType;
  status: IdentityStatus;
  permissions: string[];
  metadata?: Record<string, any>;
  keyPrefix?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedIdentity {
  id: string;
  profileId: string;
  name: string;
  appId: string;
  type: IdentityType;
  status: IdentityStatus;
  permissions: string[];
  metadata?: Record<string, any>;
  credentialId: string;
}

export interface ApiClientInfo {
  keyId: string;
  identityId: string;
  appId: string;
  name: string;
  accountType: IdentityType;
  permissions: string[];
}

export interface WebhookEventPayload {
  event:
    | 'incoming_call'
    | 'call_ringing'
    | 'call_accepted'
    | 'call_declined'
    | 'call_cancelled'
    | 'call_ended'
    | 'call_failed';
  call_id: string;
  caller: {
    app_id: string;
    name: string;
    type?: IdentityType;
  };
  receiver: {
    app_id: string;
    name: string;
    type?: IdentityType;
  };
  from?: {
    app_id: string;
    name: string;
    account_type?: IdentityType;
  };
  to?: {
    app_id: string;
    name: string;
    account_type?: IdentityType;
  };
  status: CallStatus;
  started_at?: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration?: number;
  timestamp: string;
}



export interface AuthResponse {
  user: User;
  token: string;
}

export interface Contact {
  id: string;
  userId: string;
  contactAppId: string;
  contactName: string;
  createdAt: string;
  presence?: UserPresence;
}

export type CallType = 'audio' | 'video';

export interface CallRecord {
  id: string;
  callerAppId: string;
  callerName?: string;
  receiverAppId: string;
  receiverName?: string;
  status: CallStatus;
  callType?: CallType;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  duration: number; // in seconds
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCConfig {
  iceServers: IceServerConfig[];
}

// Signaling Protocol Payloads
export interface CallInitiatePayload {
  targetAppId: string;
  callType?: CallType;
}

export interface CallIncomingPayload {
  callId: string;
  callerAppId: string;
  callerName: string;
  callType?: CallType;
}

export interface CallAcceptPayload {
  callId: string;
}

export interface CallAcceptedPayload {
  callId: string;
  receiverAppId: string;
  receiverName: string;
  callType?: CallType;
  webrtcConfig: WebRTCConfig;
}

export interface CallRejectPayload {
  callId: string;
  reason?: string;
}

export interface CallDeclinedPayload {
  callId: string;
  reason?: string;
}

export interface CallCancelPayload {
  callId: string;
}

export interface CallCancelledPayload {
  callId: string;
  reason?: string;
}

export interface CallHangupPayload {
  callId: string;
}

export interface CallEndedPayload {
  callId: string;
  reason?: string;
  duration: number;
}

export interface CallErrorPayload {
  callId?: string;
  code: 'USER_NOT_FOUND' | 'USER_OFFLINE' | 'USER_BUSY' | 'INVALID_APP_ID' | 'SERVER_ERROR' | 'UNAUTHORIZED';
  message: string;
}

export interface WebRTCOfferPayload {
  callId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerPayload {
  callId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCIceCandidatePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
}

export interface PresenceUpdatePayload {
  appId: string;
  presence: UserPresence;
}

export interface PresenceStatusRequestPayload {
  appIds: string[];
}

export interface PresenceStatusResponsePayload {
  statuses: Record<string, UserPresence>;
}

export type MessageType = 'text' | 'audio';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface LocalConversation {
  id: string; // usually standard direct format, e.g. direct_0711111111_0722222222 or contactAppId
  contactAppId: string;
  contactName: string;
  contactAvatarUrl?: string;
  contactAbout?: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Conversation = LocalConversation;

export interface MessageReaction {
  id: string;
  messageId: string;
  userAppId: string;
  userName?: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderAppId: string;
  senderName: string;
  receiverAppId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaDuration?: number; // in seconds for voice notes
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
    type: MessageType;
  };
  reactions?: MessageReaction[];
  status: MessageStatus;
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedContact {
  id: string;
  userId: string;
  blockedAppId: string;
  blockedName?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time Socket Payloads (Ephemeral Relay Only — Zero DB Persistence)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatSendPayload {
  conversationId: string;
  targetAppId: string;
  message: Message;
}

export interface ChatTypingPayload {
  conversationId: string;
  targetAppId: string;
  isTyping: boolean;
}

export interface ChatReadPayload {
  conversationId: string;
  targetAppId: string;
  messageIds?: string[];
}

export interface ChatDeliveredPayload {
  conversationId: string;
  targetAppId: string;
  messageId: string;
}

export interface ChatReactPayload {
  conversationId: string;
  targetAppId: string;
  messageId: string;
  emoji: string;
  action: 'add' | 'remove';
}

export interface ChatEditPayload {
  conversationId: string;
  targetAppId: string;
  messageId: string;
  content: string;
}

export interface ChatDeletePayload {
  conversationId: string;
  targetAppId: string;
  messageId: string;
}

// Client-to-Server Socket Events
export interface ClientToServerEvents {
  // Presence & Ping
  'presence:ping': () => void;
  'presence:query': (payload: PresenceStatusRequestPayload, callback: (response: PresenceStatusResponsePayload) => void) => void;

  // Voice Call Signaling
  'call:initiate': (payload: CallInitiatePayload, callback: (response: { success: boolean; callId?: string; error?: CallErrorPayload }) => void) => void;
  'call:accept': (payload: CallAcceptPayload) => void;
  'call:reject': (payload: CallRejectPayload) => void;
  'call:cancel': (payload: CallCancelPayload) => void;
  'call:hangup': (payload: CallHangupPayload) => void;

  // WebRTC Signaling
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;

  // Real-Time Ephemeral Chat Relay
  'chat:send': (payload: ChatSendPayload, callback?: (response: { success: boolean; delivered: boolean; error?: string }) => void) => void;
  'chat:typing': (payload: ChatTypingPayload) => void;
  'chat:read': (payload: ChatReadPayload) => void;
  'chat:delivered': (payload: ChatDeliveredPayload) => void;
  'chat:react': (payload: ChatReactPayload) => void;
  'chat:edit': (payload: ChatEditPayload) => void;
  'chat:delete': (payload: ChatDeletePayload) => void;
}

// Server-to-Client Socket Events
export interface ServerToClientEvents {
  // Presence
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'presence:pong': () => void;

  // Call Signaling
  'call:incoming': (payload: CallIncomingPayload) => void;
  'call:ringing': (payload: { callId: string; targetAppId: string; targetName: string }) => void;
  'call:accepted': (payload: CallAcceptedPayload) => void;
  'call:declined': (payload: CallDeclinedPayload) => void;
  'call:cancelled': (payload: CallCancelledPayload) => void;
  'call:missed': (payload: { callId: string; callerAppId: string; callerName: string; reason?: string }) => void;
  'call:ended': (payload: CallEndedPayload) => void;
  'call:error': (payload: CallErrorPayload) => void;

  // WebRTC Signaling
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;

  // Real-Time Ephemeral Chat Relay
  'chat:message': (payload: { conversationId: string; message: Message }) => void;
  'chat:typing': (payload: { conversationId: string; senderAppId: string; senderName: string; isTyping: boolean }) => void;
  'chat:delivered': (payload: { conversationId: string; messageId: string; deliveredToAppId: string }) => void;
  'chat:read': (payload: { conversationId: string; readByAppId: string; readAt: string }) => void;
  'chat:reaction': (payload: { conversationId: string; messageId: string; userAppId: string; emoji: string; action: 'add' | 'remove' }) => void;
  'chat:edited': (payload: { conversationId: string; messageId: string; content: string; updatedAt: string }) => void;
  'chat:deleted': (payload: { conversationId: string; messageId: string }) => void;
}
