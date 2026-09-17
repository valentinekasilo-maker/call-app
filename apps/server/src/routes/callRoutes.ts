import { Router, Response } from 'express';
import { CallRepository } from '../repositories/callRepository';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { config } from '../config';
import { WebRTCConfig } from '@callapp/shared';

const router = Router();

/**
 * GET /api/calls/history
 * Returns the authenticated user's call history.
 */
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const limit = parseInt(req.query.limit as string || '50', 10);
  const history = await CallRepository.getHistoryForAppId(req.user.appId, limit);
  res.json({ history });
});

/**
 * GET /api/calls/config
 * Returns the WebRTC ICE server configuration for the client.
 */
router.get('/config', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const webrtcConfig: WebRTCConfig = {
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

  res.json({ webrtcConfig });
});

export default router;
