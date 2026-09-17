/**
 * Supabase Client — Frontend (Browser) only
 *
 * Uses ONLY the public/anon key (VITE_SUPABASE_PUBLISHABLE_KEY).
 * Supports build-time Vite env, server-injected window.__APP_CONFIG__, and public project defaults.
 *
 * This file must NEVER import or use:
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPABASE_JWT_SECRET
 */
import { createClient } from '@supabase/supabase-js';

const winConfig = typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ : null;

const supabaseUrl =
  winConfig?.supabaseUrl ||
  import.meta.env.VITE_SUPABASE_URL ||
  'https://lptsuupxamkbsltbbzaj.supabase.co';

const supabaseAnonKey =
  winConfig?.supabaseAnonKey ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_zeQ-yD7h0akTUEZfCjlFDQ_K2tKuX1U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
