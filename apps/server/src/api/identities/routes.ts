import { Router, Request, Response } from 'express';
import { IdentityService } from './service';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';

const router = Router();

/**
 * POST /api/v1/identities
 * Create a new Complete Calling Identity (e.g., Lucia AI).
 * Automatically generates a 10-digit App ID and primary sk_live_ API key.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, permissions, metadata } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Field "name" is required and must be a string' },
      });
      return;
    }

    const identity = await IdentityService.createIdentity(
      name,
      type || 'ai',
      Array.isArray(permissions) ? permissions : undefined,
      metadata || {}
    );

    res.status(201).json(identity);
  } catch (err: any) {
    console.error('[API identities] Create error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/identities
 * List all registered calling identities (secrets are never returned).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const identities = await IdentityService.listIdentities();
    res.json({ identities });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/identities/:id
 * Get details of a specific calling identity.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let identity = await IdentityService.getIdentityById(id);
    if (!identity) {
      identity = await IdentityService.getIdentityByAppId(id);
    }

    if (!identity) {
      res.status(404).json({ error: { code: 'IDENTITY_NOT_FOUND', message: `Identity not found: ${id}` } });
      return;
    }

    res.json(identity);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * POST /api/v1/identities/:id/rotate-key
 * Rotate the secret API key for an identity.
 * The 10-digit App ID remains exactly the same.
 */
router.post('/:id/rotate-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await IdentityService.rotateApiKey(id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'KEY_ROTATION_FAILED', message: err.message } });
  }
});

/**
 * POST /api/v1/identities/:id/revoke
 * Revoke/Disable an identity and invalidate its keys.
 */
router.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await IdentityService.revokeIdentity(id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'REVOCATION_FAILED', message: err.message } });
  }
});

/**
 * POST /api/v1/identities/:id/activate
 * Reactivate an identity.
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await IdentityService.activateIdentity(id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'ACTIVATION_FAILED', message: err.message } });
  }
});

export default router;
