/**
 * AuthContext — Supabase Auth integration
 *
 * Replaces the previous custom JWT fetch-based auth with Supabase Auth SDK.
 *
 * Flow:
 *  1. supabase.auth.signUp() / signInWithPassword() on the client
 *  2. Supabase issues a JWT (session.access_token)
 *  3. On sign-up: the DB trigger auto-creates a profile with a unique 10-digit App ID
 *  4. After auth, we fetch the profile to get the App ID and display name
 *  5. The Supabase session is persisted to localStorage automatically
 *  6. supabase.auth.onAuthStateChange() restores the session after page refresh
 *  7. The access_token is passed to the Socket.io signaling server as the auth token
 *
 * The signaling server verifies the token using SUPABASE_JWT_SECRET.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@callapp/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetch the user's profile from Supabase after authentication.
 * The profile contains the App ID and display name.
 * Retries up to 5 times to handle the trigger propagation delay.
 */
async function fetchProfile(userId: string): Promise<{ appId: string; name: string } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, app_id, created_at')
      .eq('id', userId)
      .single();

    if (data && !error) {
      return {
        appId: (data as any).app_id,
        name: (data as any).display_name,
      };
    }

    // Profile may not exist yet (trigger propagation delay) — wait and retry
    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Build a User object from a Supabase auth user + profile data.
   */
  const buildUser = async (
    supabaseUser: { id: string; email?: string; created_at?: string }
  ): Promise<User | null> => {
    const profile = await fetchProfile(supabaseUser.id);
    if (!profile) return null;

    return {
      id: supabaseUser.id,
      name: profile.name,
      appId: profile.appId,
      email: supabaseUser.email ?? '',
      createdAt: supabaseUser.created_at ?? new Date().toISOString(),
    };
  };

  // Restore session on mount + subscribe to auth state changes
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // Get current session (restored from localStorage by Supabase)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && session.access_token) {
          const resolvedUser = await buildUser(session.user);
          if (mounted) {
            setUser(resolvedUser);
            setToken(session.access_token);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Session initialization error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initialize();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user && session.access_token) {
          // TOKEN_REFRESHED: update token without re-fetching profile
          if (event === 'TOKEN_REFRESHED') {
            setToken(session.access_token);
            return;
          }

          const resolvedUser = await buildUser(session.user);
          if (mounted) {
            setUser(resolvedUser);
            setToken(session.access_token);
          }
        } else {
          // Signed out or session expired
          if (mounted) {
            setUser(null);
            setToken(null);
          }
        }

        if (mounted && isLoading) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message || 'Login failed');
    }

    if (!data.session || !data.user) {
      throw new Error('Login succeeded but no session was returned');
    }

    const resolvedUser = await buildUser(data.user);
    if (!resolvedUser) {
      throw new Error('Login succeeded but profile could not be loaded. Please try again.');
    }

    setUser(resolvedUser);
    setToken(data.session.access_token);
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    if (!name || name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Valid email address is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Pass the display name in metadata — the DB trigger reads this
        // via NEW.raw_user_meta_data->>'name'
        data: { name: name.trim() },
      },
    });

    if (error) {
      throw new Error(error.message || 'Registration failed');
    }

    if (!data.user) {
      throw new Error('Registration failed: no user returned');
    }

    // Check if email confirmation is required (session will be null)
    if (!data.session) {
      throw new Error(
        'Registration successful! Please check your email to confirm your account, then log in.'
      );
    }

    // Profile is created by the DB trigger on auth.users insert.
    // Fetch it with retry to handle propagation delay.
    const resolvedUser = await buildUser(data.user);
    if (!resolvedUser) {
      throw new Error('Account created but profile is still initializing. Please log in again in a moment.');
    }

    setUser(resolvedUser);
    setToken(data.session.access_token);
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
