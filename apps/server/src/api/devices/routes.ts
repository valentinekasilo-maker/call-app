import { Router, Request, Response } from 'express';
import { DeviceService } from './service';
import { requireApiAuth, requirePermission } from '../middleware/apiAuth';

const router = Router();

/**
 * POST /api/v1/devices
 * Register or heartbeat external application / device presence (online, offline, busy).
 */
router.post('/', requireApiAuth, requirePermission('devices:write'), async (req: Request, res: Response) => {
  try {
    const { status, platform } = req.body || {};
    const validStatuses = ['online', 'offline', 'busy'];
    const deviceStatus = validStatuses.includes(status) ? status : 'online';

    const result = await DeviceService.registerDevicePresence(
      req.apiClient!.appId,
      deviceStatus as any,
      typeof platform === 'string' ? platform : req.apiClient!.accountType
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
