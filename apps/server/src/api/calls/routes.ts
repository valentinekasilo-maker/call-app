import { Router, Request, Response } from 'express';
import { CallService } from './service';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';
import { strictCallRateLimit } from '../middleware/rateLimit';
import { isValidAppId } from '@callapp/shared';

const router = Router();

/**
 * POST /api/v1/calls
 * Initiate a call to a target 10-digit App ID.
 * The caller identity (from) is automatically resolved from the authenticated API Key.
 */
router.post(
  '/',
  requireApiAuth,
  requirePermission('calls:write'),
  strictCallRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { to, from } = req.body;

      if (!to || typeof to !== 'string') {
        res.status(400).json({
          error: { code: 'INVALID_INPUT', message: 'Field "to" (target 10-digit App ID) is required.' },
        });
        return;
      }

      // Automatically resolve caller identity from the authenticated credential
      const callerAppId = req.identity?.appId || req.apiClient!.appId;

      // Prevent spoofing if a client attempts to pass a different 'from'
      if (from && from.trim() !== callerAppId) {
        res.status(403).json({
          error: {
            code: 'IDENTITY_SPOOFING_FORBIDDEN',
            message: `You cannot initiate calls on behalf of App ID ${from}. Your authenticated identity is ${callerAppId}.`,
          },
        });
        return;
      }

      if (!isValidAppId(to.trim())) {
        res.status(400).json({
          error: { code: 'INVALID_APP_ID', message: 'Target "to" must be a valid 10-digit App ID.' },
        });
        return;
      }

      const result = await CallService.initiateCall(callerAppId, to.trim());
      res.status(201).json(result);
    } catch (err: any) {
      console.error('[API calls] Error initiating call:', err.message);
      const statusCode =
        err.message.includes('offline') || err.message.includes('busy') || err.message.includes('not found')
          ? 400
          : 500;
      res.status(statusCode).json({
        error: { code: 'CALL_INITIATION_FAILED', message: err.message },
      });
    }
  }
);

/**
 * GET /api/v1/calls
 * List call history for the authenticated calling identity.
 */
router.get('/', requireApiAuth, requirePermission('calls:read'), async (req: Request, res: Response) => {
  try {
    const appId = req.identity?.appId || req.apiClient!.appId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const calls = await CallService.listCallsForAppId(appId, Math.min(limit, 100));
    res.json({ calls });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/calls/:callId
 * Get details of a specific call.
 */
router.get('/:callId', requireApiAuth, requirePermission('calls:read'), async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const appId = req.identity?.appId || req.apiClient!.appId;
    const call = await CallService.getCallById(callId, appId);

    if (!call) {
      res.status(404).json({ error: { code: 'CALL_NOT_FOUND', message: 'Call not found.' } });
      return;
    }

    res.json(call);
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED_CALL_ACCESS') {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You are not authorized to view this call.' },
      });
      return;
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * POST /api/v1/calls/:callId/accept
 * Accept an incoming call.
 */
router.post('/:callId/accept', requireApiAuth, requirePermission('calls:write'), async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const appId = req.identity?.appId || req.apiClient!.appId;
    const result = await CallService.acceptCall(callId, appId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CALL_ACCEPT_FAILED', message: err.message } });
  }
});

/**
 * POST /api/v1/calls/:callId/decline
 * Decline an incoming call.
 */
router.post('/:callId/decline', requireApiAuth, requirePermission('calls:write'), async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { reason } = req.body || {};
    const appId = req.identity?.appId || req.apiClient!.appId;
    await CallService.declineCall(callId, appId, reason);
    res.json({ success: true, message: 'Call declined.' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CALL_DECLINE_FAILED', message: err.message } });
  }
});

/**
 * POST /api/v1/calls/:callId/end
 * End an active call.
 */
router.post('/:callId/end', requireApiAuth, requirePermission('calls:write'), async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { reason } = req.body || {};
    const appId = req.identity?.appId || req.apiClient!.appId;
    const result = await CallService.endCall(callId, appId, reason);
    res.json({ success: true, ...result, message: 'Call ended.' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CALL_END_FAILED', message: err.message } });
  }
});

export default router;
