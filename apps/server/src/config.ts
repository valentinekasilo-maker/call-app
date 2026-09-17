import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5055', 10),

  // Supabase — server-side only, NEVER expose to frontend
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // JWT secret from Supabase dashboard (optional if using supabase.auth.getUser)
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || '',

  // ICE / STUN / TURN
  stunServers: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  turn: {
    url: process.env.TURN_URL || '',
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || '',
  },
};

// Fail fast in production if required Supabase vars are missing
if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  console.warn(
    '[Config] WARNING: One or more required Supabase environment variables are missing.\n' +
    '  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)\n' +
    '  Check apps/server/.env — the server may not function correctly.'
  );
}
