/**
 * Notification & Background Attention Manager for Call App.
 * Handles Web Browser Notifications, document title pulsing, and taskbar attention.
 */

import { formatAppId } from '@callapp/shared';

let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'CallApp';
let titleBlinkInterval: any = null;
let activeNotification: Notification | null = null;

export class CallNotificationManager {
  /**
   * Request Notification permission from the browser.
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      try {
        return await Notification.requestPermission();
      } catch (e) {
        return 'denied';
      }
    }

    return Notification.permission;
  }

  /**
   * Check if notifications are enabled and supported.
   */
  static isPermissionGranted(): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    return Notification.permission === 'granted';
  }

  /**
   * Show incoming call notification.
   */
  static showIncomingCallNotification(
    callId: string,
    callerName: string,
    callerAppId: string,
    onAccept?: () => void,
    onDecline?: () => void
  ): void {
    // 1. Flash document title for background tabs
    this.startTitleFlashing(callerName);

    // 2. Web Notification API
    if (this.isPermissionGranted()) {
      try {
        // Close any previous notification first
        this.clearNotification();

        const formattedId = formatAppId(callerAppId);
        const options: NotificationOptions = {
          body: `${callerName} (${formattedId}) is calling you...`,
          tag: `incoming-call-${callId}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: true,
          silent: false, // Browser notification sound if permitted
        };

        activeNotification = new Notification(`📞 Incoming Call: ${callerName}`, options);

        activeNotification.onclick = () => {
          if (typeof window !== 'undefined') {
            window.focus();
          }
          if (onAccept) onAccept();
          this.clearNotification();
        };

        activeNotification.onclose = () => {
          activeNotification = null;
        };
      } catch (e) {
        console.warn('[NotificationManager] Notification error:', e);
      }
    }
  }

  /**
   * Show missed call notification.
   */
  static showMissedCallNotification(callerName: string, callerAppId: string): void {
    if (this.isPermissionGranted()) {
      try {
        const formattedId = formatAppId(callerAppId);
        const notification = new Notification(`🔴 Missed Call from ${callerName}`, {
          body: `${formattedId} called while you were unavailable.`,
          tag: `missed-call-${Date.now()}`,
          icon: '/favicon.ico',
        });

        notification.onclick = () => {
          if (typeof window !== 'undefined') {
            window.focus();
          }
          notification.close();
        };
      } catch (e) {}
    }
  }

  /**
   * Start alternating the document title to grab attention in background tabs.
   */
  private static startTitleFlashing(callerName: string): void {
    if (typeof document === 'undefined') return;

    this.stopTitleFlashing();
    originalDocumentTitle = document.title || 'CallApp';

    let isAlert = true;
    titleBlinkInterval = setInterval(() => {
      document.title = isAlert
        ? `🔔 (1) Incoming Call: ${callerName}`
        : `📞 CallApp - Ringing...`;
      isAlert = !isAlert;
    }, 1000);
  }

  /**
   * Stop title flashing and restore original title.
   */
  private static stopTitleFlashing(): void {
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
    }
    if (typeof document !== 'undefined') {
      document.title = originalDocumentTitle;
    }
  }

  /**
   * Clear active notification and stop background alerts.
   */
  static clearNotification(): void {
    this.stopTitleFlashing();
    if (activeNotification) {
      try {
        activeNotification.close();
      } catch (e) {}
      activeNotification = null;
    }
  }
}
