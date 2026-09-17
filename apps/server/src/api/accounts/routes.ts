import { Router, Request, Response } from 'express';
import { AccountService } from './service';
import { UserRepository } from '../../repositories/userRepository';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';

const router = Router();

/**
 * POST /api/v1/accounts
 * Register a new external application calling account (e.g., Lucia AI).
 * Automatically generates a unique 10-digit App ID and initial API key.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, metadata } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Field "name" is required and must be a string' },
      });
      return;
    }

    const account = await AccountService.createAccount(name, type || 'ai', metadata || {});
    res.status(201).json(account);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/accounts/me
 * Get current application account profile details.
 */
router.get('/me', requireApiAuth, async (req: Request, res: Response) => {
  try {
    const user = await UserRepository.findByAppId(req.apiClient!.appId);
    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Account not found' } });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      app_id: user.appId,
      type: user.accountType || 'ai',
      metadata: user.metadata || {},
      created_at: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * POST /api/v1/accounts/:accountId/assign
 * Assign an existing account to an application.
 */
router.post('/:accountId/assign', requireApiAuth, requirePermission('accounts:write'), async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { application } = req.body;

    if (!application || typeof application !== 'string') {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Field "application" is required' },
      });
      return;
    }

    const result = await AccountService.assignAccount(accountId, application);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
