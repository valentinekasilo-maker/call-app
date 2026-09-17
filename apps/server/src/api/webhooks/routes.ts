import { Router, Request, Response } from 'express';
import { WebhookService } from './webhookService';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';

const router = Router();

/**
 * POST /api/v1/webhooks
 * Register a webhook endpoint to receive real-time call events.
 */
router.post('/', requireApiAuth, requirePermission('accounts:write'), async (req: Request, res: Response) => {
  try {
    const { url, secret, events } = req.body;

    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      res.status(400).json({
        error: { code: 'INVALID_URL', message: 'Field "url" must be a valid HTTP or HTTPS URL.' },
      });
      return;
    }

    const endpoint = await WebhookService.registerEndpoint(
      req.apiClient!.appId,
      url,
      secret,
      Array.isArray(events) ? events : ['*']
    );

    res.status(201).json({
      id: endpoint.id,
      app_id: endpoint.app_id,
      url: endpoint.url,
      secret: endpoint.secret,
      events: endpoint.events,
      is_active: endpoint.is_active,
      created_at: endpoint.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/webhooks
 * List registered webhook endpoints for this application.
 */
router.get('/', requireApiAuth, async (req: Request, res: Response) => {
  try {
    const endpoints = await WebhookService.listEndpoints(req.apiClient!.appId);
    res.json({ webhooks: endpoints });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/v1/webhooks/:id
 * Delete a registered webhook endpoint.
 */
router.delete('/:id', requireApiAuth, requirePermission('accounts:write'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await WebhookService.deleteEndpoint(id, req.apiClient!.appId);
    if (!success) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } });
      return;
    }
    res.json({ success: true, message: 'Webhook endpoint deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
