import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateAppId, isValidAppId, cleanAppId, formatAppId } from '../utils/appId';

describe('App ID Utilities', () => {
  it('should generate a valid 10-digit App ID', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateAppId();
      assert.strictEqual(id.length, 10, `Generated ID length must be 10: ${id}`);
      assert.strictEqual(isValidAppId(id), true, `Generated ID must be valid: ${id}`);
    }
  });

  it('should validate 10-digit numeric strings properly', () => {
    assert.strictEqual(isValidAppId('0748321905'), true);
    assert.strictEqual(isValidAppId('0612884177'), true);
    assert.strictEqual(isValidAppId('1234567890'), true);

    // Invalid cases
    assert.strictEqual(isValidAppId('12345'), false); // Too short
    assert.strictEqual(isValidAppId('12345678901'), false); // Too long
    assert.strictEqual(isValidAppId('074832190a'), false); // Non-digit
    assert.strictEqual(isValidAppId('+1234567890'), false); // Plus symbol
    assert.strictEqual(isValidAppId(''), false);
  });

  it('should clean and format App IDs', () => {
    assert.strictEqual(cleanAppId('0748-321-905'), '0748321905');
    assert.strictEqual(cleanAppId('(0748) 321 905'), '0748321905');
    assert.strictEqual(formatAppId('0748321905'), '0748 321 905');
    assert.strictEqual(formatAppId('0748321905', '-'), '0748-321-905');
  });
});
