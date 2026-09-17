import { Server, Socket } from 'socket.io';
import { UserPresence } from '@callapp/shared';

interface DeviceSession {
  socketId: string;
  deviceType: 'web' | 'desktop';
  lastPing: number;
}

export class PresenceManager {
  private static io: Server;
  // Map of appId -> Map of socketId -> DeviceSession
  private static userSockets = new Map<string, Map<string, DeviceSession>>();
  // Map of socketId -> appId
  private static socketToAppId = new Map<string, string>();
  // Map of appId -> in_call boolean
  private static userInCall = new Map<string, boolean>();
  // Map of appId -> API device presence
  private static apiPresence = new Map<string, { status: 'online' | 'offline' | 'busy'; lastPing: number; platform?: string }>();

  static init(io: Server): void {
    this.io = io;

    // Heartbeat check every 10 seconds (unref'd so it does not block clean test exit)
    const sweepInterval = setInterval(() => {
      this.sweepStaleSessions();
    }, 10000);
    sweepInterval.unref();
  }

  static setApiPresence(appId: string, status: 'online' | 'offline' | 'busy', platform?: string): void {
    if (status === 'offline') {
      this.apiPresence.delete(appId);
    } else {
      this.apiPresence.set(appId, {
        status,
        lastPing: Date.now(),
        platform,
      });
    }
    this.broadcastPresence(appId, this.getPresence(appId));
  }

  static clearApiPresence(appId: string): void {
    this.apiPresence.delete(appId);
    this.broadcastPresence(appId, this.getPresence(appId));
  }

  static registerSocket(appId: string, socket: Socket, deviceType: 'web' | 'desktop' = 'web'): void {
    if (!this.userSockets.has(appId)) {
      this.userSockets.set(appId, new Map());
    }

    const sessions = this.userSockets.get(appId)!;
    const isFirstSession = sessions.size === 0;

    sessions.set(socket.id, {
      socketId: socket.id,
      deviceType,
      lastPing: Date.now(),
    });

    this.socketToAppId.set(socket.id, appId);

    if (isFirstSession) {
      this.broadcastPresence(appId, this.getPresence(appId));
    }
  }

  static unregisterSocket(socketId: string): void {
    const appId = this.socketToAppId.get(socketId);
    if (!appId) return;

    this.socketToAppId.delete(socketId);

    const sessions = this.userSockets.get(appId);
    if (sessions) {
      sessions.delete(socketId);
      if (sessions.size === 0) {
        this.userSockets.delete(appId);
        this.userInCall.delete(appId);
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
    if (inCall) {
      this.userInCall.set(appId, true);
    } else {
      this.userInCall.delete(appId);
    }
    this.broadcastPresence(appId, this.getPresence(appId));
  }

  static getPresence(appId: string): UserPresence {
    if (this.userInCall.get(appId)) {
      return 'in_call';
    }

    const sessions = this.userSockets.get(appId);
    if (sessions && sessions.size > 0) {
      return 'online';
    }

    const api = this.apiPresence.get(appId);
    if (api) {
      if (api.status === 'busy') return 'in_call';
      if (api.status === 'online') return 'online';
    }

    return 'offline';
  }

  static getSocketsForAppId(appId: string): string[] {
    const sessions = this.userSockets.get(appId);
    if (!sessions) return [];
    return Array.from(sessions.keys());
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
    const timeoutThreshold = 35000; // 35 seconds without ping
    const apiTimeoutThreshold = 90000; // 90 seconds for API presence

    // Sweep socket sessions
    for (const [appId, sessions] of this.userSockets.entries()) {
      for (const [socketId, session] of sessions.entries()) {
        if (now - session.lastPing > timeoutThreshold) {
          const socket = this.io?.sockets?.sockets?.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
          sessions.delete(socketId);
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

