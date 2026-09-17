import { Router, Request, Response } from 'express';
import { UserService } from './service';
import { requireApiAuth } from '../middleware/apiAuth';

const router = Router();

/**
 * GET /api/v1/users/:appId
 * Lookup public user information and live presence by 10-digit App ID.
 */
router.get('/:appId', requireApiAuth, async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const user = await UserService.lookupByAppId(appId);

    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: `No user found with App ID ${appId}`,
        },
      });
      return;
    }

    res.json(user);
  } catch (err: any) {
    if (err.message.includes('Invalid 10-digit App ID')) {
      res.status(400).json({ error: { code: 'INVALID_APP_ID', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
