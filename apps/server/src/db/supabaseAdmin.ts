/**
 * Supabase Admin Client — SERVER SIDE ONLY
 *
 * Uses the service_role key which bypasses Row Level Security.
 * This file must NEVER be imported by frontend code.
 *
 * The admin client is used for:
 *  - Resolving App IDs to user UUIDs during signaling
 *  - Writing call records (trusted server operation)
 *  - Managing contacts server-side
 *  - Reading user profiles for authentication enrichment
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error(
        'Supabase admin client cannot be initialized: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.\n' +
        'Please fill in apps/server/.env'
      );
    }
    _adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        // Admin client should never persist sessions
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _adminClient;
}

/**
 * Verify Supabase connection by performing a lightweight query.
 * Called once at server startup.
 * If credentials are missing (e.g. in test/CI environments), logs a warning
 * instead of throwing so the process can still start in degraded mode.
 */
export async function verifySupabaseConnection(): Promise<void> {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.warn('[Supabase] Connection skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.');
    return;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('profiles').select('id').limit(1);
  if (error) {
    // Table might be empty — that's fine. Only throw on connection-level errors.
    if (error.code !== 'PGRST116') {
      throw new Error(`Supabase connection check failed: ${error.message}`);
    }
  }
  console.log('✅ Supabase connection verified');
}
