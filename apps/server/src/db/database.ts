/**
 * database.ts — Supabase Migration Shim
 *
 * Previously this file contained the sql.js SQLite database wrapper.
 * After migration to Supabase, the database layer is now handled by:
 *   - apps/server/src/db/supabaseAdmin.ts  (server-side admin client)
 *   - apps/web/src/lib/supabase.ts          (frontend anon client)
 *
 * This file is kept for backward compatibility with the server.ts bootstrap
 * sequence. The `initDatabase()` export now verifies the Supabase connection.
 */
import { verifySupabaseConnection } from './supabaseAdmin';

export async function initDatabase(): Promise<void> {
  await verifySupabaseConnection();
}
