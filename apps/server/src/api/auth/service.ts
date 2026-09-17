import crypto from 'crypto';
import { getSupabaseAdmin } from '../../db/supabaseAdmin';
import { UserRepository } from '../../repositories/userRepository';
import { ApiClientInfo, AccountType } from '@callapp/shared';

export interface GeneratedApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  appId: string;
  name: string;
  permissions: string[];
  createdAt: string;
}

export interface ApiKeyMetadata {
  id: string;
  name: string;
  keyPrefix: string;
  appId: string;
  permissions: string[];
  createdAt: string;
  revokedAt?: string | null;
}

export class ApiAuthService {
  /**
   * Generate a new secure API Key for an App ID.
   * The raw API key (call_live_...) is returned ONCE and only its SHA-256 hash is persisted.
   */
  static async generateApiKey(
    appId: string,
    name: string,
    permissions: string[] = ['calls:read', 'calls:write', 'accounts:read', 'devices:write']
  ): Promise<GeneratedApiKey> {
    const admin = getSupabaseAdmin();

    // Verify the appId exists in profiles
    const user = await UserRepository.findByAppId(appId);
    if (!user) {
      throw new Error(`Account with App ID ${appId} does not exist`);
    }

    const randomEntropy = crypto.randomBytes(24).toString('hex');
    const rawKey = `call_live_${randomEntropy}`;
    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await admin
      .from('api_keys')
      .insert({
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        app_id: appId,
        permissions,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to generate API Key: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      key: rawKey,
      keyPrefix: data.key_prefix,
      appId: data.app_id,
      name: data.name,
      permissions: data.permissions,
      createdAt: data.created_at,
    };
  }

  /**
   * Verify an incoming raw API Key against the stored SHA-256 hashes.
   */
  static async verifyApiKey(rawKey: string): Promise<ApiClientInfo | null> {
    if (!rawKey || !rawKey.startsWith('call_live_')) {
      return null;
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('api_keys')
      .select('id, name, app_id, permissions, revoked_at')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    const user = await UserRepository.findByAppId(data.app_id);
    if (!user) {
      return null;
    }

    return {
      keyId: data.id,
      identityId: data.id,
      appId: data.app_id,
      name: user.name || data.name,
      accountType: (user.accountType as AccountType) || 'human',
      permissions: data.permissions || [],
    };
  }

  /**
   * List API Key metadata for an App ID.
   */
  static async listApiKeys(appId: string): Promise<ApiKeyMetadata[]> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('api_keys')
      .select('id, name, key_prefix, app_id, permissions, created_at, revoked_at')
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      appId: row.app_id,
      permissions: row.permissions,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    }));
  }

  /**
   * Revoke an API Key.
   */
  static async revokeApiKey(keyId: string, appId: string): Promise<boolean> {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('app_id', appId);

    return !error;
  }
}
