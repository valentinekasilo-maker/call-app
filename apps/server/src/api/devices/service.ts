import { PresenceManager } from '../../presence/presenceManager';

export class DeviceService {
  /**
   * Register or update the online presence state of an external application/device.
   */
  static async registerDevicePresence(
    appId: string,
    status: 'online' | 'offline' | 'busy' = 'online',
    platform?: string
  ): Promise<{ app_id: string; status: string; updated_at: string }> {
    PresenceManager.setApiPresence(appId, status, platform);

    return {
      app_id: appId,
      status: PresenceManager.getPresence(appId),
      updated_at: new Date().toISOString(),
    };
  }
}
