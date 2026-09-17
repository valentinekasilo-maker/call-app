import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(windowMs: number = 60000, maxRequests: number = 120) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup old entries every 5 minutes (unref'd so it does not prevent clean process exit)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 300000);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Key by Calling Identity App ID if authenticated, else IP address
    const clientKey =
      req.identity?.appId ||
      req.apiClient?.appId ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();

    let record = store.get(clientKey);
    if (!record) {
      record = { timestamps: [] };
      store.set(clientKey, record);
    }

    record.timestamps = record.timestamps.filter(t => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);

      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Rate limit is ${maxRequests} requests per ${windowMs / 1000}s. Please retry after ${retryAfterSec} seconds.`,
        },
      });
      return;
    }

    record.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.timestamps.length);
    next();
  };
}

export const defaultApiRateLimit = createRateLimiter(60000, 120); // 120 req / min
export const strictCallRateLimit = createRateLimiter(60000, 30);  // 30 call inits / min
