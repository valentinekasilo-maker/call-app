import { Router, Request, Response } from 'express';
import { ApiAuthService } from './service';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';

const router = Router();

/**
 * POST /api/v1/auth/keys
 * Create a new API key for the current authenticated application.
 */
router.post('/keys', requireApiAuth, requirePermission('accounts:write'), async (req: Request, res: Response) => {
  try {
    const { name, permissions } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Field "name" is required' } });
      return;
    }

    const key = await ApiAuthService.generateApiKey(
      req.apiClient!.appId,
      name,
      Array.isArray(permissions) ? permissions : undefined
    );

    res.status(201).json(key);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/auth/keys
 * List active and revoked API keys for the current application.
 */
router.get('/keys', requireApiAuth, async (req: Request, res: Response) => {
  try {
    const keys = await ApiAuthService.listApiKeys(req.apiClient!.appId);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/v1/auth/keys/:id
 * Revoke an existing API key.
 */
router.delete('/keys/:id', requireApiAuth, requirePermission('accounts:write'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ApiAuthService.revokeApiKey(id, req.apiClient!.appId);
    if (!success) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API Key not found or already revoked' } });
      return;
    }
    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
