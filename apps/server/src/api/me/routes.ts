import { Router, Request, Response } from 'express';
import { requireApiAuth } from '../middleware/apiAuth';

const router = Router();

/**
 * GET /api/v1/me
 * Returns the complete calling identity associated with the authenticated API key.
 * Allows external applications (e.g. Lucia) to verify "Who am I?".
 */
router.get('/', requireApiAuth, (req: Request, res: Response) => {
  const identity = req.identity!;

  res.json({
    identity_id: identity.id,
    profile_id: identity.profileId,
    name: identity.name,
    app_id: identity.appId,
    type: identity.type,
    status: identity.status,
    permissions: identity.permissions,
    metadata: identity.metadata || {},
  });
});

export default router;
