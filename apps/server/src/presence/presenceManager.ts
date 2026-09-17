import { Server, Socket } from 'socket.io';
import { UserPresence } from '@callapp/shared';

interface DeviceSession {
  socketId: string;
  deviceType: 'web' | 'desktop';
  lastPing: number;
}

export class PresenceManager {
  private static io: Server;
  // Map of clean appId -> Map of socketId -> DeviceSession
  private static userSockets = new Map<string, Map<string, DeviceSession>>();
  // Map of socketId -> clean appId
  private static socketToAppId = new Map<string, string>();
  // Map of clean appId -> in_call boolean
  private static userInCall = new Map<string, boolean>();
  // Map of clean appId -> API device presence
  private static apiPresence = new Map<string, { status: 'online' | 'offline' | 'busy'; lastPing: number; platform?: string }>();

  static init(io: Server): void {
    this.io = io;

    // Heartbeat check every 15 seconds (unref'd so it does not block clean test exit)
    const sweepInterval = setInterval(() => {
      this.sweepStaleSessions();
    }, 15000);
    sweepInterval.unref();
  }

  static setApiPresence(appId: string, status: 'online' | 'offline' | 'busy', platform?: string): void {
    const cleanId = appId.replace(/\D/g, '');
    if (!cleanId) return;

    if (status === 'offline') {
      this.apiPresence.delete(cleanId);
    } else {
      this.apiPresence.set(cleanId, {
        status,
        lastPing: Date.now(),
        platform,
      });
    }
    this.broadcastPresence(cleanId, this.getPresence(cleanId));
  }

  static clearApiPresence(appId: string): void {
    const cleanId = appId.replace(/\D/g, '');
    if (!cleanId) return;
    this.apiPresence.delete(cleanId);
    this.broadcastPresence(cleanId, this.getPresence(cleanId));
  }

  static registerSocket(appId: string, socket: Socket, deviceType: 'web' | 'desktop' = 'web'): void {
    const cleanId = appId.replace(/\D/g, '');
    if (!cleanId) return;

    if (!this.userSockets.has(cleanId)) {
      this.userSockets.set(cleanId, new Map());
    }

    const sessions = this.userSockets.get(cleanId)!;
    sessions.set(socket.id, {
      socketId: socket.id,
      deviceType,
      lastPing: Date.now(),
    });

    this.socketToAppId.set(socket.id, cleanId);

    console.log(`[PresenceManager] PRESENCE: app_id=${cleanId} socket_id=${socket.id} device=${deviceType} active_sessions=${sessions.size} status=online`);
    this.broadcastPresence(cleanId, this.getPresence(cleanId));
  }

  static unregisterSocket(socketId: string): void {
    const appId = this.socketToAppId.get(socketId);
    if (!appId) return;

    this.socketToAppId.delete(socketId);

    const sessions = this.userSockets.get(appId);
    if (sessions) {
      sessions.delete(socketId);
      console.log(`[PresenceManager] PRESENCE DISCONNECT: socket_id=${socketId} app_id=${appId} remaining_sessions=${sessions.size}`);
      if (sessions.size === 0) {
        this.userSockets.delete(appId);
        this.userInCall.delete(appId);
        this.broadcastPresence(appId, this.getPresence(appId));
      } else {
        // Multi-device: still online
        this.broadcastPresence(appId, this.getPresence(appId));
      }
    }
  }

  static updatePing(socketId: string): void {
    const appId = this.socketToAppId.get(socketId);
    if (!appId) return;

    const sessions = this.userSockets.get(appId);
    if (sessions && sessions.has(socketId)) {
      sessions.get(socketId)!.lastPing = Date.now();
    }
  }

  static setInCall(appId: string, inCall: boolean): void {
    const cleanId = appId.replace(/\D/g, '');
    if (!cleanId) return;

    if (inCall) {
      this.userInCall.set(cleanId, true);
    } else {
      this.userInCall.delete(cleanId);
    }
    this.broadcastPresence(cleanId, this.getPresence(cleanId));
  }

  static getPresence(appId: string): UserPresence {
    const cleanId = appId.replace(/\D/g, '');
    if (!cleanId) return 'offline';

    if (this.userInCall.get(cleanId)) {
      return 'in_call';
    }

    const sessions = this.userSockets.get(cleanId);
    if (sessions && sessions.size > 0) {
      // Check if at least one socket is actively connected in Socket.IO
      if (this.io?.sockets?.sockets) {
        for (const [socketId] of sessions) {
          const liveSocket = this.io.sockets.sockets.get(socketId);
          if (liveSocket && liveSocket.connected) {
            return 'online';
          }
        }
      }

      // Fallback: If sessions map has entries within ping window
      const now = Date.now();
      for (const [, session] of sessions) {
        if (now - session.lastPing < 60000) {
          return 'online';
        }
      }
    }

    const api = this.apiPresence.get(cleanId);
    if (api) {
      if (api.status === 'busy') return 'in_call';
      if (api.status === 'online') return 'online';
    }

    return 'offline';
  }

  static getSocketsForAppId(appId: string): string[] {
    const cleanId = appId.replace(/\D/g, '');
    const sessions = this.userSockets.get(cleanId);
    if (!sessions) return [];

    const activeSocketIds: string[] = [];
    for (const socketId of sessions.keys()) {
      if (this.io?.sockets?.sockets) {
        const liveSocket = this.io.sockets.sockets.get(socketId);
        if (liveSocket && liveSocket.connected) {
          activeSocketIds.push(socketId);
        }
      } else {
        activeSocketIds.push(socketId);
      }
    }
    return activeSocketIds;
  }

  static isUserOnline(appId: string): boolean {
    const presence = this.getPresence(appId);
    return presence === 'online' || presence === 'in_call';
  }

  static isUserInCall(appId: string): boolean {
    return this.getPresence(appId) === 'in_call';
  }

  private static broadcastPresence(appId: string, presence: UserPresence): void {
    if (!this.io) return;
    this.io.emit('presence:update', { appId, presence });
  }

  private static sweepStaleSessions(): void {
    const now = Date.now();
    const timeoutThreshold = 60000; // 60 seconds grace period
    const apiTimeoutThreshold = 90000; // 90 seconds for API presence

    // Sweep socket sessions
    for (const [appId, sessions] of this.userSockets.entries()) {
      for (const [socketId, session] of sessions.entries()) {
        const liveSocket = this.io?.sockets?.sockets?.get(socketId);

        // If the socket is still connected at the transport level, it is live
        if (liveSocket && liveSocket.connected) {
          session.lastPing = now;
          continue;
        }

        // Only evict if socket is truly disconnected or past timeoutThreshold
        if (!liveSocket || !liveSocket.connected || now - session.lastPing > timeoutThreshold) {
          if (liveSocket) {
            liveSocket.disconnect(true);
          }
          sessions.delete(socketId);
          this.socketToAppId.delete(socketId);
        }
      }

      if (sessions.size === 0) {
        this.userSockets.delete(appId);
        this.userInCall.delete(appId);
        this.broadcastPresence(appId, this.getPresence(appId));
      }
    }

    // Sweep API presence
    for (const [appId, api] of this.apiPresence.entries()) {
      if (now - api.lastPing > apiTimeoutThreshold) {
        this.apiPresence.delete(appId);
        this.broadcastPresence(appId, this.getPresence(appId));
      }
    }
  }
}

