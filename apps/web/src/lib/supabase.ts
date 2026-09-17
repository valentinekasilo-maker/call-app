/**
 * Supabase Client — Frontend (Browser) only
 *
 * Uses ONLY the public/anon key (VITE_SUPABASE_PUBLISHABLE_KEY).
 * Row Level Security enforces data access on the Supabase side.
 *
 * This file must NEVER import or use:
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPABASE_JWT_SECRET
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing environment variables.\n' +
    'Create apps/web/.env with:\n' +
    '  VITE_SUPABASE_URL=...\n' +
    '  VITE_SUPABASE_PUBLISHABLE_KEY=...'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Use localStorage to persist session across browser refreshes
    persistSession: true,
    storageKey: 'callapp-auth-token',
    // Automatically refresh the access token before expiry
    autoRefreshToken: true,
    // Don't detect OAuth callback URLs (we're using email/password only)
    detectSessionInUrl: false,
  },
});
