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

export interface CallRecord {
  id: string;
  callerAppId: string;
  callerName?: string;
  receiverAppId: string;
  receiverName?: string;
  status: CallStatus;
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
}

export interface CallIncomingPayload {
  callId: string;
  callerAppId: string;
  callerName: string;
}

export interface CallAcceptPayload {
  callId: string;
}

export interface CallAcceptedPayload {
  callId: string;
  receiverAppId: string;
  receiverName: string;
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

// Client-to-Server Socket Events
export interface ClientToServerEvents {
  // Presence & Ping
  'presence:ping': () => void;
  'presence:query': (payload: PresenceStatusRequestPayload, callback: (response: PresenceStatusResponsePayload) => void) => void;

  // Call Signaling
  'call:initiate': (payload: CallInitiatePayload, callback: (response: { success: boolean; callId?: string; error?: CallErrorPayload }) => void) => void;
  'call:accept': (payload: CallAcceptPayload) => void;
  'call:reject': (payload: CallRejectPayload) => void;
  'call:cancel': (payload: CallCancelPayload) => void;
  'call:hangup': (payload: CallHangupPayload) => void;

  // WebRTC Signaling
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
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
}
