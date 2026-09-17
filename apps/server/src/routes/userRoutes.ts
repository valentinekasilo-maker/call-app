import { Router, Response } from 'express';
import { UserRepository } from '../repositories/userRepository';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { isValidAppId } from '@callapp/shared';
import { PresenceManager } from '../presence/presenceManager';

const router = Router();

/**
 * GET /api/users/lookup/:appId
 *
 * Safe App ID lookup. Returns only public profile information:
 * - name
 * - appId
 * - presence status
 *
 * Does NOT expose: email, UUID, avatar_url, or other private fields.
 * Requires authentication to prevent unauthenticated scraping.
 */
router.get('/lookup/:appId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  if (!isValidAppId(appId)) {
    res.status(400).json({ error: 'Invalid 10-digit App ID format' });
    return;
  }

  const user = await UserRepository.findByAppId(appId);
  if (!user) {
    res.status(404).json({ error: 'User with this App ID not found' });
    return;
  }

  const presence = PresenceManager.getPresence(appId);

  // Return only public-safe fields
  res.json({
    user: {
      name: user.name,
      appId: user.appId,
      presence,
    },
  });
});

export default router;
