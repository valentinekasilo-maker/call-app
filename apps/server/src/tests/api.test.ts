import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { PresenceManager } from '../presence/presenceManager';
import { createRateLimiter } from '../api/middleware/rateLimit';
import { IdentityService } from '../api/identities/service';

describe('Calling Identity & API Credential (/api/v1) Unit Tests', () => {
  it('should generate secure sk_live_ API credentials with SHA-256 hash', () => {
    const { rawKey, keyPrefix, keyHash } = IdentityService.generateSecretKey();

    assert.ok(rawKey.startsWith('sk_live_'), 'Key must start with sk_live_');
    assert.strictEqual(keyPrefix.length, 16);
    assert.strictEqual(keyHash.length, 64);

    // Verify SHA-256 hash match
    const computedHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    assert.strictEqual(computedHash, keyHash);
  });

  it('should correctly compute and verify Webhook HMAC-SHA256 signatures', () => {
    const secret = 'whsec_test_secret_key_1234567890';
    const payload = JSON.stringify({
      event: 'incoming_call',
      call_id: 'test-call-uuid',
      caller: { app_id: '0834567123', name: 'Lucia', type: 'ai' },
      receiver: { app_id: '0748321905', name: 'Valence', type: 'human' },
      status: 'ringing',
      timestamp: '2026-09-17T22:00:00.000Z',
    });

    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(signature.length, 64);

    // Verifier side check
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(signature, expectedSig);

    // Tampered payload fails verification
    const tamperedPayload = payload.replace('0748321905', '0111111111');
    const tamperedSig = crypto.createHmac('sha256', secret).update(tamperedPayload).digest('hex');
    assert.notStrictEqual(signature, tamperedSig);
  });

  it('should handle API presence registration and transitions in PresenceManager', () => {
    const testAppId = '0834567123'; // Lucia App ID

    // Initially offline
    assert.strictEqual(PresenceManager.getPresence(testAppId), 'offline');
    assert.strictEqual(PresenceManager.isUserOnline(testAppId), false);

    // Set online via API
    PresenceManager.setApiPresence(testAppId, 'online', 'lucia-agent');
    assert.strictEqual(PresenceManager.getPresence(testAppId), 'online');
    assert.strictEqual(PresenceManager.isUserOnline(testAppId), true);
    assert.strictEqual(PresenceManager.isUserInCall(testAppId), false);

    // Set busy via API
    PresenceManager.setApiPresence(testAppId, 'busy', 'lucia-agent');
    assert.strictEqual(PresenceManager.getPresence(testAppId), 'in_call');
    assert.strictEqual(PresenceManager.isUserInCall(testAppId), true);

    // Clear API presence
    PresenceManager.clearApiPresence(testAppId);
    assert.strictEqual(PresenceManager.getPresence(testAppId), 'offline');
    assert.strictEqual(PresenceManager.isUserOnline(testAppId), false);
  });

  it('should enforce sliding-window rate limiting per identity / IP', () => {
    const limiter = createRateLimiter(1000, 3); // Max 3 requests per second
    const mockReq: any = { identity: { appId: '0834567123' }, headers: {} };
    let rateLimited = false;
    const mockRes: any = {
      setHeader: () => {},
      status: (code: number) => {
        if (code === 429) rateLimited = true;
        return mockRes;
      },
      json: () => {},
    };
    const next = () => {};

    // 1st request - ok
    limiter(mockReq, mockRes, next);
    assert.strictEqual(rateLimited, false);

    // 2nd request - ok
    limiter(mockReq, mockRes, next);
    assert.strictEqual(rateLimited, false);

    // 3rd request - ok
    limiter(mockReq, mockRes, next);
    assert.strictEqual(rateLimited, false);

    // 4th request - rate limited
    limiter(mockReq, mockRes, next);
    assert.strictEqual(rateLimited, true);
  });
});
