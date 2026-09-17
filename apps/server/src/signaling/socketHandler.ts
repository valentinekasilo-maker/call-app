import { Server, Socket } from 'socket.io';
import { resolveTokenToPayload, TokenPayload } from '../services/authService';
import { PresenceManager } from '../presence/presenceManager';
import { CallManager } from './callManager';
import {
  CallInitiatePayload,
  CallAcceptPayload,
  CallRejectPayload,
  CallCancelPayload,
  CallHangupPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  PresenceStatusRequestPayload,
} from '@callapp/shared';

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
  deviceType?: 'web' | 'desktop';
}

export function setupSocketHandler(io: Server): void {
  PresenceManager.init(io);
  CallManager.init(io);

  // ──────────────────────────────────────────────────────────────
  // Socket Authentication Middleware
  // Verifies Supabase JWT and fetches the user profile (appId, name)
  // ──────────────────────────────────────────────────────────────
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    const deviceType = (socket.handshake.auth?.deviceType as 'web' | 'desktop') || 'web';

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      // Verify Supabase JWT + fetch profile in one call
      const payload = await resolveTokenToPayload(token);
      socket.user = payload;
      socket.deviceType = deviceType;
      console.log(`[SocketAuth] Authenticated socket ${socket.id} for user ${payload.name} (App ID: ${payload.appId})`);
      next();
    } catch (err: any) {
      console.error('[SocketAuth] Authentication failed:', err.message);
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      socket.disconnect(true);
      return;
    }

    const { appId, name } = socket.user;
    const cleanAppId = appId.replace(/\D/g, '');
    const deviceType = socket.deviceType || 'web';

    // Register with Presence Manager
    PresenceManager.registerSocket(cleanAppId, socket, deviceType);

    // Keep session alive on ANY incoming event from this socket
    socket.onAny(() => {
      PresenceManager.updatePing(socket.id);
    });

    // Ping / Pong for presence heartbeat
    socket.on('presence:ping', () => {
      PresenceManager.updatePing(socket.id);
      socket.emit('presence:pong');
    });

    // Query presence for a list of App IDs (e.g. for contacts list)
    socket.on('presence:query', (payload: PresenceStatusRequestPayload, callback) => {
      if (typeof callback === 'function' && payload?.appIds && Array.isArray(payload.appIds)) {
        const statuses: Record<string, any> = {};
        for (const targetAppId of payload.appIds) {
          statuses[targetAppId] = PresenceManager.getPresence(targetAppId);
        }
        callback({ statuses });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Call Signaling Events — unchanged from before
    // The server trusts appId from socket.user (verified from Supabase JWT)
    // Clients cannot claim to be a different appId
    // ──────────────────────────────────────────────────────────────
    socket.on('call:initiate', (payload: CallInitiatePayload, callback) => {
      CallManager.initiateCall(socket, appId, name, payload.targetAppId, callback).catch(err => {
        console.error('[SocketHandler] call:initiate error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
        }
      });
    });

    socket.on('call:accept', (payload: CallAcceptPayload) => {
      CallManager.acceptCall(socket, appId, payload.callId);
    });

    socket.on('call:reject', (payload: CallRejectPayload) => {
      CallManager.rejectCall(socket, appId, payload.callId, payload.reason);
    });

    socket.on('call:cancel', (payload: CallCancelPayload) => {
      CallManager.cancelCall(socket, appId, payload.callId);
    });

    socket.on('call:hangup', (payload: CallHangupPayload) => {
      CallManager.hangupCall(socket, appId, payload.callId);
    });

    // WebRTC Signaling Relay — completely unchanged
    socket.on('webrtc:offer', (payload: WebRTCOfferPayload) => {
      CallManager.relayOffer(socket, payload.callId, payload.sdp);
    });

    socket.on('webrtc:answer', (payload: WebRTCAnswerPayload) => {
      CallManager.relayAnswer(socket, payload.callId, payload.sdp);
    });

    socket.on('webrtc:ice-candidate', (payload: WebRTCIceCandidatePayload) => {
      CallManager.relayIceCandidate(socket, payload.callId, payload.candidate);
    });

    // Disconnect Handling
    socket.on('disconnect', () => {
      CallManager.handleSocketDisconnect(socket.id);
      PresenceManager.unregisterSocket(socket.id);
    });
  });
}
