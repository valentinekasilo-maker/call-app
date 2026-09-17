import { UserRepository } from '../../repositories/userRepository';
import { PresenceManager } from '../../presence/presenceManager';
import { isValidAppId } from '@callapp/shared';

export interface PublicUserProfile {
  app_id: string;
  display_name: string;
  type: string;
  presence: string;
}

export class UserService {
  /**
   * Look up a public user profile by their 10-digit App ID.
   * Strips private fields and attaches real-time presence.
   */
  static async lookupByAppId(appId: string): Promise<PublicUserProfile | null> {
    if (!isValidAppId(appId)) {
      throw new Error('Invalid 10-digit App ID format');
    }

    const user = await UserRepository.findByAppId(appId);
    if (!user) return null;

    const presence = PresenceManager.getPresence(appId);

    return {
      app_id: user.appId,
      display_name: user.name,
      type: user.accountType || 'human',
      presence,
    };
  }
}
