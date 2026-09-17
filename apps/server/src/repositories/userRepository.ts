/**
 * UserRepository — Supabase implementation
 *
 * Reads user profiles from the Supabase `profiles` table using the admin client.
 * Profile creation is handled automatically by the database trigger
 * (handle_new_user) on auth.users insert — not by this code.
 *
 * All methods are now async since Supabase is a remote database.
 */
import { getSupabaseAdmin } from '../db/supabaseAdmin';
import { User } from '@callapp/shared';

interface ProfileRow {
  id: string;
  display_name: string;
  app_id: string;
  avatar_url: string | null;
  account_type?: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

function mapProfileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.display_name,
    appId: row.app_id,
    email: '',
    accountType: (row.account_type as any) || 'human',
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

export class UserRepository {
  /**
   * Find a user profile by their Supabase user UUID.
   */
  static async findById(id: string): Promise<User | null> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .select('id, display_name, app_id, avatar_url, account_type, metadata, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapProfileToUser(data as ProfileRow);
  }

  /**
   * Find a user profile by their 10-digit App ID.
   * Used by the signaling server to validate call targets.
   */
  static async findByAppId(appId: string): Promise<User | null> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .select('id, display_name, app_id, avatar_url, account_type, metadata, created_at, updated_at')
      .eq('app_id', appId)
      .single();

    if (error || !data) return null;
    return mapProfileToUser(data as ProfileRow);
  }

  /**
   * Create an application/AI calling account in Supabase.
   */
  static async createApplicationAccount(
    name: string,
    accountType: string = 'ai',
    metadata: Record<string, any> = {}
  ): Promise<User> {
    const admin = getSupabaseAdmin();
    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const email = `${cleanSlug || 'app'}_${randomSuffix}@internal.callapp`;
    const tempPassword = `App_${Math.random().toString(36).substring(2)}${Date.now()}!`;

    // 1. Create auth user in Supabase (triggers profile creation + 10-digit App ID assignment)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create application user: ${authError?.message || 'Unknown error'}`);
    }

    const userId = authData.user.id;

    // 2. Wait a moment or fetch the profile created by trigger
    let profile = await this.findById(userId);
    let retries = 0;
    while (!profile && retries < 5) {
      await new Promise(r => setTimeout(r, 150));
      profile = await this.findById(userId);
      retries++;
    }

    if (!profile) {
      throw new Error('Profile was not generated for the application account');
    }

    // 3. Update account_type and metadata
    await admin
      .from('profiles')
      .update({
        account_type: accountType,
        metadata: metadata,
      })
      .eq('id', userId);

    return {
      ...profile,
      accountType: accountType as any,
      metadata,
    };
  }
}

