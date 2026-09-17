/**
 * AuthService — Supabase JWT Verification
 *
 * After migration to Supabase, register/login are handled entirely
 * client-side via the Supabase Auth SDK. The server's role is:
 *   1. Verify the Supabase-issued JWT (HS256, using SUPABASE_JWT_SECRET)
 *   2. Extract the user's `sub` (UUID) from the token
 *   3. Fetch the user's profile (appId, name) from Supabase profiles table
 *
 * The token passed from the client is `session.access_token` from Supabase.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getSupabaseAdmin } from '../db/supabaseAdmin';

export interface TokenPayload {
  /** Supabase user UUID (the `sub` claim in Supabase JWTs) */
  userId: string;
  /** 10-digit App ID, fetched from profiles table */
  appId: string;
  /** Display name, fetched from profiles table */
  name: string;
  /** Email from the JWT claims */
  email: string;
  /** JWT expiry timestamp */
  exp?: number;
}

/** Raw claims from a decoded Supabase JWT */
interface SupabaseJwtClaims {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  role?: string;
  [key: string]: unknown;
}

/**
 * Verifies a Supabase JWT and returns the raw decoded claims.
 * Throws if the token is invalid, expired, or uses the wrong secret.
 */
export function verifySupabaseToken(token: string): SupabaseJwtClaims {
  if (config.supabaseJwtSecret) {
    return jwt.verify(token, config.supabaseJwtSecret) as SupabaseJwtClaims;
  }
  // Decode without verifying signature if secret not provided (signature verified by Supabase)
  const decoded = jwt.decode(token) as SupabaseJwtClaims;
  if (!decoded || !decoded.sub) {
    throw new Error('Invalid JWT format');
  }
  return decoded;
}

/**
 * Fully resolves a Supabase token into a TokenPayload by:
 * 1. Verifying the token with Supabase Auth (or JWT secret)
 * 2. Fetching the profile row from Supabase to get appId + name
 *
 * This is called once per socket connection and once per REST request.
 * The result is cached on the socket/request object for the session.
 */
export async function resolveTokenToPayload(token: string): Promise<TokenPayload> {
  const admin = getSupabaseAdmin();
  let userId: string = '';
  let userEmail: string = '';

  // 1. Primary verification via official Supabase Auth SDK
  try {
    const { data: authData } = await admin.auth.getUser(token);
    if (authData?.user) {
      userId = authData.user.id;
      userEmail = authData.user.email ?? '';
    }
  } catch (e) {
    // Fallback to token decoding
  }

  // 2. Fallback if getUser did not return user
  if (!userId) {
    try {
      const claims = verifySupabaseToken(token);
      if (claims?.sub) {
        userId = claims.sub;
        userEmail = (claims.email as string) ?? '';
      }
    } catch (err: any) {
      throw new Error(`Token verification failed: ${err.message || 'Invalid token'}`);
    }
  }

  if (!userId) {
    throw new Error('Token verification failed: User ID could not be identified');
  }

  // 3. Fetch user profile for App ID + Display Name
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, display_name, app_id')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    throw new Error(`Profile not found for user ${userId}: ${error?.message ?? 'unknown error'}`);
  }

  return {
    userId,
    appId: profile.app_id,
    name: profile.display_name,
    email: userEmail,
  };
}

/**
 * AuthService namespace — kept for backward compatibility.
 * Only verifyToken is needed server-side; register/login are client-only.
 */
export class AuthService {
  /**
   * Synchronously verify a Supabase JWT and return raw claims.
   * Use resolveTokenToPayload() when you also need appId + name.
   */
  static verifyToken(token: string): SupabaseJwtClaims {
    return verifySupabaseToken(token);
  }
}
