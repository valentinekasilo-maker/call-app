import { Server, Socket } from 'socket.io';
import { PresenceManager } from '../presence/presenceManager';
import { CallRepository } from '../repositories/callRepository';
import { UserRepository } from '../repositories/userRepository';
import { isValidAppId, WebRTCConfig, AccountType } from '@callapp/shared';
import { config } from '../config';
import { WebhookService } from '../api/webhooks/webhookService';

export interface ActiveCall {
  callId: string;
  callerAppId: string;
  callerName: string;
  callerType?: AccountType;
  callerSocketId?: string;
  receiverAppId: string;
  receiverName: string;
  receiverType?: AccountType;
  receiverSocketId?: string;
  status: 'ringing' | 'accepted' | 'ended';
  startedAt: number;
  answeredAt?: number;
  ringTimer?: NodeJS.Timeout;
}

export class CallManager {
  private static io: Server;
  // Map of callId -> ActiveCall
  private static activeCalls = new Map<string, ActiveCall>();
  // Map of socketId -> callId
  private static socketToCallId = new Map<string, string>();
  // Rate limiting map: appId -> timestamps[]
  private static callRateLimits = new Map<string, number[]>();

  static init(io: Server): void {
    this.io = io;
  }

  static getWebRTCConfig(): WebRTCConfig {
    return {
      iceServers: [
        ...config.stunServers.map(url => ({ urls: url })),
        ...(config.turn.url
          ? [
              {
                urls: config.turn.url,
                username: config.turn.username,
                credential: config.turn.credential,
              },
            ]
          : []),
      ],
    };
  }

  static checkRateLimit(appId: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxCalls = 10;

    let timestamps = this.callRateLimits.get(appId) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);
    if (timestamps.length >= maxCalls) {
      return false;
    }
    timestamps.push(now);
    this.callRateLimits.set(appId, timestamps);
    return true;
  }

  static getActiveCall(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  static async initiateCall(
    callerSocket: Socket,
    callerAppId: string,
    callerName: string,
    targetAppId: string,
    callback: (response: { success: boolean; callId?: string; error?: any }) => void
  ): Promise<void> {
    // 1. Validate Target App ID format
    if (!isValidAppId(targetAppId)) {
      callback({
        success: false,
        error: { code: 'INVALID_APP_ID', message: 'The specified 10-digit App ID format is invalid.' },
      });
      return;
    }

    // 2. Prevent calling self
    if (callerAppId === targetAppId) {
      callback({
        success: false,
        error: { code: 'INVALID_APP_ID', message: 'You cannot call your own App ID.' },
      });
      return;
    }

    // 3. Rate Limit Check
    if (!this.checkRateLimit(callerAppId)) {
      callback({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Call rate limit exceeded. Please wait a moment.' },
      });
      return;
    }

    // 4. Verify Target User Exists (async Supabase lookup)
    const targetUser = await UserRepository.findByAppId(targetAppId);
    if (!targetUser) {
      callback({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: `No user found with App ID ${targetAppId}.` },
      });
      return;
    }

    // 5. Verify Target User is Online
    if (!PresenceManager.isUserOnline(targetAppId)) {
      callback({
        success: false,
        error: { code: 'USER_OFFLINE', message: `${targetUser.name} is currently offline.` },
      });
      return;
    }

    // 6. Verify Target User is not already In-Call
    if (PresenceManager.isUserInCall(targetAppId)) {
      callback({
        success: false,
        error: { code: 'USER_BUSY', message: `${targetUser.name} is currently on another call.` },
      });
      return;
    }

    // 7. Verify Caller is not already In-Call
    if (PresenceManager.isUserInCall(callerAppId)) {
      callback({
        success: false,
        error: { code: 'USER_BUSY', message: 'You are already in an active call.' },
      });
      return;
    }

    // 8. Create Call Record in Supabase (async)
    let dbCall;
    try {
      dbCall = await CallRepository.createCall(callerAppId, targetAppId);
    } catch (err: any) {
      callback({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to create call record.' },
      });
      return;
    }
    const callId = dbCall.id;

    // 9. Setup 30s Ring Timeout
    const ringTimer = setTimeout(() => {
      this.handleCallTimeout(callId);
    }, 30000);

    const callerUser = await UserRepository.findByAppId(callerAppId);

    const activeCall: ActiveCall = {
      callId,
      callerAppId,
      callerName,
      callerType: (callerUser?.accountType as AccountType) || 'human',
      callerSocketId: callerSocket.id,
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: (targetUser.accountType as AccountType) || 'human',
      status: 'ringing',
      startedAt: Date.now(),
      ringTimer,
    };

    this.activeCalls.set(callId, activeCall);
    this.socketToCallId.set(callerSocket.id, callId);

    // 10. Notify Receiver Clients via Socket
    const receiverSockets = PresenceManager.getSocketsForAppId(targetAppId);
    if (this.io) {
      for (const socketId of receiverSockets) {
        this.io.to(socketId).emit('call:incoming', {
          callId,
          callerAppId,
          callerName,
        });
      }
    }

    // 11. Notify Caller that it is ringing
    callerSocket.emit('call:ringing', {
      callId,
      targetAppId,
      targetName: targetUser.name,
    });

    // 12. Dispatch Webhook Events
    WebhookService.dispatchCallEvent('incoming_call', {
      callId,
      callerAppId,
      callerName,
      callerType: activeCall.callerType,
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: activeCall.receiverType,
      status: 'ringing',
      startedAt: new Date(activeCall.startedAt).toISOString(),
    });

    WebhookService.dispatchCallEvent('call_ringing', {
      callId,
      callerAppId,
      callerName,
      callerType: activeCall.callerType,
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: activeCall.receiverType,
      status: 'ringing',
      startedAt: new Date(activeCall.startedAt).toISOString(),
    });

    callback({ success: true, callId });
  }

  /**
   * Programmatic API Call Initiation (e.g. from Lucia or external app).
   */
  static async initiateApiCall(
    callerAppId: string,
    targetAppId: string
  ): Promise<{ callId: string; status: string; from: string; to: string }> {
    if (!isValidAppId(targetAppId)) {
      throw new Error('The specified 10-digit App ID format is invalid.');
    }

    if (callerAppId === targetAppId) {
      throw new Error('You cannot call your own App ID.');
    }

    if (!this.checkRateLimit(callerAppId)) {
      throw new Error('Call rate limit exceeded. Please wait a moment.');
    }

    const [callerUser, targetUser] = await Promise.all([
      UserRepository.findByAppId(callerAppId),
      UserRepository.findByAppId(targetAppId),
    ]);

    if (!callerUser) {
      throw new Error(`Caller account with App ID ${callerAppId} not found.`);
    }

    if (!targetUser) {
      throw new Error(`No user found with target App ID ${targetAppId}.`);
    }

    if (!PresenceManager.isUserOnline(targetAppId)) {
      throw new Error(`${targetUser.name} (${targetAppId}) is currently offline.`);
    }

    if (PresenceManager.isUserInCall(targetAppId)) {
      throw new Error(`${targetUser.name} is currently on another call.`);
    }

    if (PresenceManager.isUserInCall(callerAppId)) {
      throw new Error('Caller is already in an active call.');
    }

    // Create DB Call record
    const dbCall = await CallRepository.createCall(callerAppId, targetAppId);
    const callId = dbCall.id;

    // 30s Ring Timeout
    const ringTimer = setTimeout(() => {
      this.handleCallTimeout(callId);
    }, 30000);

    const activeCall: ActiveCall = {
      callId,
      callerAppId,
      callerName: callerUser.name,
      callerType: (callerUser.accountType as AccountType) || 'ai',
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: (targetUser.accountType as AccountType) || 'human',
      status: 'ringing',
      startedAt: Date.now(),
      ringTimer,
    };

    this.activeCalls.set(callId, activeCall);

    // Notify receiver sockets if any
    const receiverSockets = PresenceManager.getSocketsForAppId(targetAppId);
    if (this.io) {
      for (const socketId of receiverSockets) {
        this.io.to(socketId).emit('call:incoming', {
          callId,
          callerAppId,
          callerName: callerUser.name,
        });
      }
    }

    // Dispatch Webhooks
    WebhookService.dispatchCallEvent('incoming_call', {
      callId,
      callerAppId,
      callerName: callerUser.name,
      callerType: activeCall.callerType,
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: activeCall.receiverType,
      status: 'ringing',
      startedAt: new Date(activeCall.startedAt).toISOString(),
    });

    WebhookService.dispatchCallEvent('call_ringing', {
      callId,
      callerAppId,
      callerName: callerUser.name,
      callerType: activeCall.callerType,
      receiverAppId: targetAppId,
      receiverName: targetUser.name,
      receiverType: activeCall.receiverType,
      status: 'ringing',
      startedAt: new Date(activeCall.startedAt).toISOString(),
    });

    return {
      callId,
      status: 'ringing',
      from: callerAppId,
      to: targetAppId,
    };
  }

  static acceptCall(receiverSocket: Socket, receiverAppId: string, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'ringing') {
      receiverSocket.emit('call:error', {
        callId,
        code: 'SERVER_ERROR',
        message: 'Call is no longer active or was cancelled.',
      });
      return;
    }

    if (call.receiverAppId !== receiverAppId) {
      receiverSocket.emit('call:error', {
        callId,
        code: 'UNAUTHORIZED',
        message: 'You are not authorized to accept this call.',
      });
      return;
    }

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
      call.ringTimer = undefined;
    }

    call.status = 'accepted';
    call.receiverSocketId = receiverSocket.id;
    call.answeredAt = Date.now();
    this.socketToCallId.set(receiverSocket.id, callId);

    // Mark both in call
    PresenceManager.setInCall(call.callerAppId, true);
    PresenceManager.setInCall(call.receiverAppId, true);

    // Update Supabase (fire and forget — non-blocking)
    CallRepository.markAnswered(callId).catch(err =>
      console.error('[CallManager] markAnswered failed:', err)
    );

    const webrtcConfig = this.getWebRTCConfig();

    // Notify caller that receiver accepted
    if (call.callerSocketId && this.io) {
      this.io.to(call.callerSocketId).emit('call:accepted', {
        callId,
        receiverAppId: call.receiverAppId,
        receiverName: call.receiverName,
        webrtcConfig,
      });
    }

    // Notify receiver with webrtc config
    receiverSocket.emit('call:accepted', {
      callId,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      webrtcConfig,
    });

    // Dispatch Webhook
    WebhookService.dispatchCallEvent('call_accepted', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'accepted',
      startedAt: new Date(call.startedAt).toISOString(),
      answeredAt: new Date(call.answeredAt).toISOString(),
    });
  }

  /**
   * Programmatic API Call Accept
   */
  static async acceptApiCall(callId: string, receiverAppId: string): Promise<any> {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'ringing') {
      throw new Error('Call is no longer active or was already answered/cancelled.');
    }

    if (call.receiverAppId !== receiverAppId) {
      throw new Error('You are not authorized to accept this call.');
    }

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
      call.ringTimer = undefined;
    }

    call.status = 'accepted';
    call.answeredAt = Date.now();

    // Mark both in call
    PresenceManager.setInCall(call.callerAppId, true);
    PresenceManager.setInCall(call.receiverAppId, true);

    // Update DB
    await CallRepository.markAnswered(callId);

    const webrtcConfig = this.getWebRTCConfig();

    // Notify caller socket if connected
    if (call.callerSocketId && this.io) {
      this.io.to(call.callerSocketId).emit('call:accepted', {
        callId,
        receiverAppId: call.receiverAppId,
        receiverName: call.receiverName,
        webrtcConfig,
      });
    }

    // Dispatch Webhook
    WebhookService.dispatchCallEvent('call_accepted', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'accepted',
      startedAt: new Date(call.startedAt).toISOString(),
      answeredAt: new Date(call.answeredAt).toISOString(),
    });

    return {
      callId,
      status: 'accepted',
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      webrtcConfig,
    };
  }

  static rejectCall(receiverSocket: Socket, receiverAppId: string, callId: string, reason: string = 'declined'): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.receiverAppId !== receiverAppId) return;

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
    }

    // Fire and forget — non-blocking Supabase write
    CallRepository.endCall(callId, 'declined').catch(err =>
      console.error('[CallManager] endCall(declined) failed:', err)
    );

    if (call.callerSocketId && this.io) {
      this.io.to(call.callerSocketId).emit('call:declined', {
        callId,
        reason,
      });
    }

    // Dispatch Webhook
    WebhookService.dispatchCallEvent('call_declined', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'declined',
      startedAt: new Date(call.startedAt).toISOString(),
    });

    this.cleanupCall(callId);
  }

  /**
   * Programmatic API Call Decline
   */
  static async declineApiCall(callId: string, receiverAppId: string, reason: string = 'declined'): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error('Call not found or already ended.');
    }

    if (call.receiverAppId !== receiverAppId) {
      throw new Error('You are not authorized to decline this call.');
    }

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
    }

    await CallRepository.endCall(callId, 'declined');

    if (call.callerSocketId && this.io) {
      this.io.to(call.callerSocketId).emit('call:declined', {
        callId,
        reason,
      });
    }

    WebhookService.dispatchCallEvent('call_declined', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'declined',
      startedAt: new Date(call.startedAt).toISOString(),
    });

    this.cleanupCall(callId);
  }

  static cancelCall(callerSocket: Socket, callerAppId: string, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.callerAppId !== callerAppId) return;

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
    }

    // Fire and forget
    CallRepository.endCall(callId, 'cancelled').catch(err =>
      console.error('[CallManager] endCall(cancelled) failed:', err)
    );

    const receiverSockets = PresenceManager.getSocketsForAppId(call.receiverAppId);
    if (this.io) {
      for (const socketId of receiverSockets) {
        this.io.to(socketId).emit('call:cancelled', {
          callId,
          reason: 'Caller cancelled the call.',
        });
      }
    }

    WebhookService.dispatchCallEvent('call_cancelled', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'cancelled',
      startedAt: new Date(call.startedAt).toISOString(),
    });

    this.cleanupCall(callId);
  }

  static hangupCall(socket: Socket, appId: string, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.callerAppId !== appId && call.receiverAppId !== appId) return;

    const duration = call.answeredAt ? Math.max(0, Math.floor((Date.now() - call.answeredAt) / 1000)) : 0;
    const finalStatus = call.status === 'accepted' ? 'completed' : 'missed';

    // Fire and forget
    CallRepository.endCall(callId, finalStatus, duration).catch(err =>
      console.error('[CallManager] endCall(completed/missed) failed:', err)
    );

    // Notify other party
    const targetSocketId = socket.id === call.callerSocketId ? call.receiverSocketId : call.callerSocketId;
    if (targetSocketId && this.io) {
      this.io.to(targetSocketId).emit('call:ended', {
        callId,
        reason: 'Call ended by remote party.',
        duration,
      });
    }

    socket.emit('call:ended', {
      callId,
      reason: 'Call ended.',
      duration,
    });

    WebhookService.dispatchCallEvent('call_ended', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: finalStatus,
      startedAt: new Date(call.startedAt).toISOString(),
      answeredAt: call.answeredAt ? new Date(call.answeredAt).toISOString() : null,
      endedAt: new Date().toISOString(),
      duration,
    });

    this.cleanupCall(callId);
  }

  /**
   * Programmatic API Call End
   */
  static async endApiCall(callId: string, participantAppId: string, reason: string = 'ended'): Promise<{ duration: number; status: string }> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      // Check database
      const dbCall = await CallRepository.getById(callId);
      if (dbCall && (dbCall.callerAppId === participantAppId || dbCall.receiverAppId === participantAppId)) {
        return { duration: dbCall.duration, status: dbCall.status };
      }
      throw new Error('Call not found or already completed.');
    }

    if (call.callerAppId !== participantAppId && call.receiverAppId !== participantAppId) {
      throw new Error('You are not a participant in this call.');
    }

    const duration = call.answeredAt ? Math.max(0, Math.floor((Date.now() - call.answeredAt) / 1000)) : 0;
    const finalStatus = call.status === 'accepted' ? 'completed' : 'missed';

    await CallRepository.endCall(callId, finalStatus, duration);

    // Notify any active sockets
    const targetSocketId = participantAppId === call.callerAppId ? call.receiverSocketId : call.callerSocketId;
    if (targetSocketId && this.io) {
      this.io.to(targetSocketId).emit('call:ended', {
        callId,
        reason: `Call ended by ${participantAppId}.`,
        duration,
      });
    }

    WebhookService.dispatchCallEvent('call_ended', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: finalStatus,
      startedAt: new Date(call.startedAt).toISOString(),
      answeredAt: call.answeredAt ? new Date(call.answeredAt).toISOString() : null,
      endedAt: new Date().toISOString(),
      duration,
    });

    this.cleanupCall(callId);

    return { duration, status: finalStatus };
  }

  static handleSocketDisconnect(socketId: string): void {
    const callId = this.socketToCallId.get(socketId);
    if (!callId) return;

    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.status === 'ringing') {
      if (socketId === call.callerSocketId) {
        // Caller disconnected while ringing
        this.cancelCall({ id: socketId } as Socket, call.callerAppId, callId);
      } else {
        // Receiver disconnected while ringing
        this.rejectCall({ id: socketId } as Socket, call.receiverAppId, callId, 'Receiver disconnected');
      }
    } else if (call.status === 'accepted') {
      // Disconnected during active call
      const duration = call.answeredAt ? Math.max(0, Math.floor((Date.now() - call.answeredAt) / 1000)) : 0;

      // Fire and forget
      CallRepository.endCall(callId, 'completed', duration).catch(err =>
        console.error('[CallManager] endCall(disconnect) failed:', err)
      );

      const targetSocketId = socketId === call.callerSocketId ? call.receiverSocketId : call.callerSocketId;
      if (targetSocketId && this.io) {
        this.io.to(targetSocketId).emit('call:ended', {
          callId,
          reason: 'Remote party disconnected.',
          duration,
        });
      }

      WebhookService.dispatchCallEvent('call_ended', {
        callId,
        callerAppId: call.callerAppId,
        callerName: call.callerName,
        callerType: call.callerType,
        receiverAppId: call.receiverAppId,
        receiverName: call.receiverName,
        receiverType: call.receiverType,
        status: 'completed',
        startedAt: new Date(call.startedAt).toISOString(),
        answeredAt: call.answeredAt ? new Date(call.answeredAt).toISOString() : null,
        endedAt: new Date().toISOString(),
        duration,
      });

      this.cleanupCall(callId);
    }
  }

  private static handleCallTimeout(callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'ringing') return;

    // Fire and forget
    CallRepository.endCall(callId, 'missed').catch(err =>
      console.error('[CallManager] endCall(missed/timeout) failed:', err)
    );

    if (call.callerSocketId && this.io) {
      this.io.to(call.callerSocketId).emit('call:declined', {
        callId,
        reason: 'No answer.',
      });
    }

    const receiverSockets = PresenceManager.getSocketsForAppId(call.receiverAppId);
    if (this.io) {
      for (const socketId of receiverSockets) {
        this.io.to(socketId).emit('call:missed', {
          callId,
          callerAppId: call.callerAppId,
          callerName: call.callerName,
          reason: 'Ringing timed out after 30 seconds.',
        });
        this.io.to(socketId).emit('call:cancelled', {
          callId,
          reason: 'Missed call.',
        });
      }
    }

    WebhookService.dispatchCallEvent('call_declined', {
      callId,
      callerAppId: call.callerAppId,
      callerName: call.callerName,
      callerType: call.callerType,
      receiverAppId: call.receiverAppId,
      receiverName: call.receiverName,
      receiverType: call.receiverType,
      status: 'missed',
      startedAt: new Date(call.startedAt).toISOString(),
    });

    this.cleanupCall(callId);
  }

  // WebRTC Signaling Relay — completely unchanged
  static relayOffer(socket: Socket, callId: string, sdp: RTCSessionDescriptionInit): void {
    const call = this.activeCalls.get(callId);
    if (!call || !call.receiverSocketId) return;

    if (socket.id === call.callerSocketId) {
      this.io.to(call.receiverSocketId).emit('webrtc:offer', { callId, sdp });
    }
  }

  static relayAnswer(socket: Socket, callId: string, sdp: RTCSessionDescriptionInit): void {
    const call = this.activeCalls.get(callId);
    if (!call || !call.callerSocketId) return;

    if (socket.id === call.receiverSocketId) {
      this.io.to(call.callerSocketId).emit('webrtc:answer', { callId, sdp });
    }
  }

  static relayIceCandidate(socket: Socket, callId: string, candidate: RTCIceCandidateInit): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const targetSocketId = socket.id === call.callerSocketId ? call.receiverSocketId : call.callerSocketId;
    if (targetSocketId && this.io) {
      this.io.to(targetSocketId).emit('webrtc:ice-candidate', { callId, candidate });
    }
  }

  private static cleanupCall(callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
    }

    if (call.callerSocketId) this.socketToCallId.delete(call.callerSocketId);
    if (call.receiverSocketId) this.socketToCallId.delete(call.receiverSocketId);

    PresenceManager.setInCall(call.callerAppId, false);
    PresenceManager.setInCall(call.receiverAppId, false);

    this.activeCalls.delete(callId);
  }
}
