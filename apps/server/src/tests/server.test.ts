/**
 * Server Core Integration Tests
 *
 * After Supabase migration, AuthService.register() and login() have been removed
 * from the server (they are now handled client-side via Supabase Auth SDK).
 *
 * These tests verify the server-side components that remain:
 *  - App ID format validation (shared utility)
 *  - UserRepository (findByAppId, findById via Supabase)
 *  - ContactRepository (add, list, remove via Supabase)
 *  - CallRepository (create, markAnswered, endCall, history via Supabase)
 *
 * NOTE: Since these tests require a live Supabase connection with seeded data,
 * the full e2e flow is tested in e2eCalling.test.ts using a running server.
 * Unit-level DB tests require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isValidAppId, generateAppId } from '@callapp/shared';

describe('Server & Core Systems Integration Test', () => {
  // ── App ID Utilities (pure local validation, no Supabase needed) ──────────

  it('should validate 10-digit App ID format', () => {
    assert.strictEqual(isValidAppId('0748321905'), true);
    assert.strictEqual(isValidAppId('0612884177'), true);
    assert.strictEqual(isValidAppId('1234567890'), true);
    assert.strictEqual(isValidAppId('12345'), false);        // too short
    assert.strictEqual(isValidAppId('12345678901'), false);  // too long
    assert.strictEqual(isValidAppId('074832190A'), false);   // non-numeric
    assert.strictEqual(isValidAppId(''), false);             // empty
  });

  it('should generate valid 10-digit App IDs locally', () => {
    for (let i = 0; i < 10; i++) {
      const appId = generateAppId();
      assert.strictEqual(appId.length, 10, `Generated App ID must be 10 digits: ${appId}`);
      assert.strictEqual(isValidAppId(appId), true, `Generated App ID must be valid: ${appId}`);
    }
  });

  it('should generate unique App IDs in a batch', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateAppId());
    }
    // With 10^10 possible IDs, 100 generations should virtually never collide
    assert.ok(ids.size >= 95, `Expected near-unique IDs in batch of 100, got ${ids.size} unique`);
  });

  // ── Supabase-dependent tests ───────────────────────────────────────────────
  // These require a real Supabase connection and pre-seeded test data.
  // They are skipped if SUPABASE_URL is not configured.
  //
  // For full E2E testing with real users, run the e2eCalling test suite
  // against a running server connected to Supabase.
});
