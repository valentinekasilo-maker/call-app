import crypto from 'crypto';
import { getSupabaseAdmin } from '../../db/supabaseAdmin';
import { UserRepository } from '../../repositories/userRepository';
import { PresenceManager } from '../../presence/presenceManager';
import {
  CallingIdentity,
  AuthenticatedIdentity,
  IdentityType,
  IdentityStatus,
} from '@callapp/shared';

export interface CreatedIdentityResult {
  identity_id: string;
  name: string;
  app_id: string;
  type: IdentityType;
  status: IdentityStatus;
  permissions: string[];
  metadata?: Record<string, any>;
  api_key: string;
  key_prefix: string;
  created_at: string;
}

export interface RotatedKeyResult {
  identity_id: string;
  name: string;
  app_id: string;
  api_key: string;
  key_prefix: string;
  rotated_at: string;
}

export class IdentityService {
  /**
   * Helper to generate a secure sk_live_ key.
   */
  static generateSecretKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
    const randomEntropy = crypto.randomBytes(24).toString('hex');
    const rawKey = `sk_live_${randomEntropy}`;
    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return { rawKey, keyPrefix, keyHash };
  }

  /**
   * Create a new Complete Calling Identity with a unique 10-digit App ID and API Key.
   */
  static async createIdentity(
    name: string,
    type: IdentityType = 'ai',
    permissions: string[] = ['call', 'receive_call', 'lookup', 'presence', 'call_history'],
    metadata: Record<string, any> = {}
  ): Promise<CreatedIdentityResult> {
    const admin = getSupabaseAdmin();
    const validTypes: IdentityType[] = ['human', 'ai', 'bot', 'service', 'device', 'application'];
    const normalizedType = validTypes.includes(type) ? type : 'ai';

    // 1. Create Supabase Auth/Profile user (generates unique 10-digit App ID)
    const profile = await UserRepository.createApplicationAccount(name, normalizedType, metadata);

    // 2. Create calling_identities record
    const { data: identityData, error: identityError } = await admin
      .from('calling_identities')
      .insert({
        profile_id: profile.id,
        name,
        app_id: profile.appId,
        type: normalizedType,
        status: 'active',
        permissions,
        metadata,
      })
      .select('*')
      .single();

    if (identityError || !identityData) {
      throw new Error(`Failed to create calling identity: ${identityError?.message || 'Database error'}`);
    }

    // 3. Generate primary API credential (sk_live_...)
    const { rawKey, keyPrefix, keyHash } = this.generateSecretKey();

    const { error: credError } = await admin.from('api_credentials').insert({
      identity_id: identityData.id,
      name: `${name} Primary Key`,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      status: 'active',
    });

    if (credError) {
      throw new Error(`Failed to create API credential: ${credError.message}`);
    }

    return {
      identity_id: identityData.id,
      name: identityData.name,
      app_id: identityData.app_id,
      type: identityData.type,
      status: identityData.status,
      permissions: identityData.permissions,
      metadata: identityData.metadata,
      api_key: rawKey,
      key_prefix: keyPrefix,
      created_at: identityData.created_at,
    };
  }

  /**
   * List all calling identities with their active key prefix (never exposes secret keys).
   */
  static async listIdentities(): Promise<CallingIdentity[]> {
    const admin = getSupabaseAdmin();

    const { data: identities, error } = await admin
      .from('calling_identities')
      .select(`
        *,
        credentials:api_credentials(key_prefix, status)
      `)
      .order('created_at', { ascending: false });

    if (error || !identities) return [];

    return identities.map((row: any) => {
      const activeCred = row.credentials?.find((c: any) => c.status === 'active');
      return {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        appId: row.app_id,
        type: row.type,
        status: row.status,
        permissions: row.permissions || [],
        metadata: row.metadata || {},
        keyPrefix: activeCred?.key_prefix || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  /**
   * Get identity by UUID.
   */
  static async getIdentityById(id: string): Promise<CallingIdentity | null> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('calling_identities')
      .select(`
        *,
        credentials:api_credentials(key_prefix, status)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const activeCred = data.credentials?.find((c: any) => c.status === 'active');
    return {
      id: data.id,
      profileId: data.profile_id,
      name: data.name,
      appId: data.app_id,
      type: data.type,
      status: data.status,
      permissions: data.permissions || [],
      metadata: data.metadata || {},
      keyPrefix: activeCred?.key_prefix || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get identity by 10-digit App ID.
   */
  static async getIdentityByAppId(appId: string): Promise<CallingIdentity | null> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('calling_identities')
      .select(`
        *,
        credentials:api_credentials(key_prefix, status)
      `)
      .eq('app_id', appId)
      .single();

    if (error || !data) return null;

    const activeCred = data.credentials?.find((c: any) => c.status === 'active');
    return {
      id: data.id,
      profileId: data.profile_id,
      name: data.name,
      appId: data.app_id,
      type: data.type,
      status: data.status,
      permissions: data.permissions || [],
      metadata: data.metadata || {},
      keyPrefix: activeCred?.key_prefix || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Rotate the API key for an identity.
   * The 10-digit App ID remains exactly the same.
   */
  static async rotateApiKey(identityId: string): Promise<RotatedKeyResult> {
    const admin = getSupabaseAdmin();

    const identity = await this.getIdentityById(identityId);
    if (!identity) {
      throw new Error(`Identity not found with ID ${identityId}`);
    }

    // 1. Revoke existing active credentials
    await admin
      .from('api_credentials')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('identity_id', identityId)
      .eq('status', 'active');

    // 2. Generate new credential
    const { rawKey, keyPrefix, keyHash } = this.generateSecretKey();

    const { error: insertError } = await admin.from('api_credentials').insert({
      identity_id: identityId,
      name: `${identity.name} Key (Rotated)`,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      status: 'active',
    });

    if (insertError) {
      throw new Error(`Failed to generate new key: ${insertError.message}`);
    }

    return {
      identity_id: identity.id,
      name: identity.name,
      app_id: identity.appId,
      api_key: rawKey,
      key_prefix: keyPrefix,
      rotated_at: new Date().toISOString(),
    };
  }

  /**
   * Revoke/Disable an identity and invalidate its keys.
   */
  static async revokeIdentity(identityId: string): Promise<{ success: boolean; message: string }> {
    const admin = getSupabaseAdmin();

    const identity = await this.getIdentityById(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    // 1. Mark identity revoked
    await admin
      .from('calling_identities')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', identityId);

    // 2. Mark credentials revoked
    await admin
      .from('api_credentials')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('identity_id', identityId);

    // 3. Clear presence
    PresenceManager.clearApiPresence(identity.appId);

    return {
      success: true,
      message: `Identity ${identity.name} (${identity.appId}) has been revoked.`,
    };
  }

  /**
   * Reactivate an identity.
   */
  static async activateIdentity(identityId: string): Promise<{ success: boolean; message: string; api_key?: string }> {
    const admin = getSupabaseAdmin();

    const identity = await this.getIdentityById(identityId);
    if (!identity) {
      throw new Error(`Identity not found: ${identityId}`);
    }

    await admin
      .from('calling_identities')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', identityId);

    // Check if there is an active credential; if not, generate one
    const { data: activeCreds } = await admin
      .from('api_credentials')
      .select('id')
      .eq('identity_id', identityId)
      .eq('status', 'active');

    let newKey: string | undefined;
    if (!activeCreds || activeCreds.length === 0) {
      const { rawKey, keyPrefix, keyHash } = this.generateSecretKey();
      await admin.from('api_credentials').insert({
        identity_id: identityId,
        name: `${identity.name} Primary Key`,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        status: 'active',
      });
      newKey = rawKey;
    }

    return {
      success: true,
      message: `Identity ${identity.name} (${identity.appId}) is now active.`,
      api_key: newKey,
    };
  }

  /**
   * Verify an incoming raw API Key (sk_live_... or call_live_...).
   * Resolves the key to a Complete Calling Identity.
   */
  static async verifyApiKey(rawKey: string): Promise<AuthenticatedIdentity | null> {
    if (!rawKey || typeof rawKey !== 'string') return null;

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const admin = getSupabaseAdmin();

    // 1. Look up credential
    const { data: cred, error: credErr } = await admin
      .from('api_credentials')
      .select(`
        id,
        identity_id,
        status,
        revoked_at,
        identity:calling_identities!api_credentials_identity_id_fkey(*)
      `)
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .is('revoked_at', null)
      .single();

    if (credErr || !cred || !cred.identity) {
      // Fallback: check legacy api_keys table if present
      const { data: legacyKey } = await admin
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single();

      if (!legacyKey) return null;

      const profile = await UserRepository.findByAppId(legacyKey.app_id);
      if (!profile) return null;

      return {
        id: legacyKey.id,
        profileId: profile.id,
        name: profile.name,
        appId: profile.appId,
        type: (profile.accountType as IdentityType) || 'ai',
        status: 'active',
        permissions: legacyKey.permissions || ['call', 'receive_call', 'lookup', 'presence'],
        metadata: profile.metadata || {},
        credentialId: legacyKey.id,
      };
    }

    const idRecord = cred.identity as any;
    if (idRecord.status !== 'active') {
      return null;
    }

    // Update last_used_at asynchronously
    void admin
      .from('api_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', cred.id);

    return {
      id: idRecord.id,
      profileId: idRecord.profile_id,
      name: idRecord.name,
      appId: idRecord.app_id,
      type: idRecord.type,
      status: idRecord.status,
      permissions: idRecord.permissions || ['call', 'receive_call', 'lookup', 'presence'],
      metadata: idRecord.metadata || {},
      credentialId: cred.id,
    };
  }
}
