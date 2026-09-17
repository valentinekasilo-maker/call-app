-- ============================================================
-- Call App — Initial Supabase Schema Migration
-- ============================================================
-- Tables: profiles, calls, contacts
-- Functions: generate_unique_app_id(), handle_new_user()
-- Triggers: on_auth_user_created (auto-create profile on signup)
-- RLS: enabled on all public tables
-- ============================================================


-- ============================================================
-- SECTION 1: App ID Generator
-- ============================================================

-- Generates a random 10-digit numeric string that is unique
-- within the profiles table. Retries on collision.
CREATE OR REPLACE FUNCTION public.generate_unique_app_id()
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id VARCHAR(10);
  collision BOOLEAN := TRUE;
  attempts INT := 0;
BEGIN
  WHILE collision AND attempts < 100 LOOP
    -- Pad with leading zeros to always produce exactly 10 digits
    new_id := LPAD((FLOOR(RANDOM() * 9000000000) + 1000000000)::BIGINT::TEXT, 10, '0');
    collision := EXISTS(SELECT 1 FROM public.profiles WHERE app_id = new_id);
    attempts := attempts + 1;
  END LOOP;

  IF collision THEN
    RAISE EXCEPTION 'Could not generate unique App ID after 100 attempts';
  END IF;

  RETURN new_id;
END;
$$;


-- ============================================================
-- SECTION 2: profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  app_id      VARCHAR(10) NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint + index on app_id (used for lookups by App ID)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_app_id_idx ON public.profiles(app_id);

-- Enforce exactly 10 numeric digits
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_app_id_format
  CHECK (app_id ~ '^[0-9]{10}$');


-- ============================================================
-- SECTION 3: calls table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  receiver_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'ringing',
  started_at       TIMESTAMPTZ,
  answered_at      TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce valid statuses
ALTER TABLE public.calls
  ADD CONSTRAINT calls_status_values
  CHECK (status IN ('ringing', 'accepted', 'declined', 'missed', 'cancelled', 'completed', 'failed'));

-- Index for call history queries (most common access pattern)
CREATE INDEX IF NOT EXISTS calls_caller_id_idx    ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS calls_receiver_id_idx  ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS calls_created_at_idx   ON public.calls(created_at DESC);


-- ============================================================
-- SECTION 4: contacts table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate contacts (one row per user–contact pair)
  UNIQUE(user_id, contact_user_id),
  -- Prevent self-contact
  CONSTRAINT contacts_no_self CHECK (user_id <> contact_user_id)
);

-- Index for listing a user's contacts
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts(user_id);


-- ============================================================
-- SECTION 5: Auto-create profile on user signup trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, app_id)
  VALUES (
    NEW.id,
    -- Prefer the 'name' metadata field set during signUp; fall back to email prefix
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    public.generate_unique_app_id()
  )
  -- On conflict (e.g. re-trigger from email confirmation), do nothing
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists so the migration is idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 6: updated_at auto-update trigger for profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- SECTION 7: Row Level Security
-- ============================================================

-- ----- profiles -----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read public profile fields (name + app_id) for lookup
-- This is intentionally limited — no email, no private data
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- A user can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No client-side inserts: profiles are created by the trigger (SECURITY DEFINER)
-- No client-side deletes: managed by CASCADE from auth.users deletion

-- ----- calls -----
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Users can see only calls they participated in
CREATE POLICY "calls_select_participant"
  ON public.calls
  FOR SELECT
  TO authenticated
  USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- No client INSERT/UPDATE/DELETE for calls — the server uses service_role
-- which bypasses RLS entirely. This prevents clients from forging call records.

-- ----- contacts -----
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own contact list
CREATE POLICY "contacts_select_own"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can add contacts (only for themselves)
CREATE POLICY "contacts_insert_own"
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own contacts
CREATE POLICY "contacts_delete_own"
  ON public.contacts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ----- devices -----
CREATE TABLE IF NOT EXISTS public.devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_type       TEXT NOT NULL CHECK (client_type IN ('web', 'desktop')),
  connection_status TEXT NOT NULL DEFAULT 'offline' CHECK (connection_status IN ('online', 'offline', 'in_call')),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices(user_id);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices_select_own"
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "devices_insert_own"
  ON public.devices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "devices_update_own"
  ON public.devices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "devices_delete_own"
  ON public.devices
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- SECTION 8: Verification queries
-- (Run these after applying the migration to confirm setup)
-- ============================================================

-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Expected: profiles=true, calls=true, contacts=true, devices=true

-- SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'profiles_app_id_idx';
-- Expected: 1

-- SELECT proname FROM pg_proc WHERE proname IN ('generate_unique_app_id', 'handle_new_user', 'handle_updated_at');
-- Expected: 3 rows

-- SELECT tgname FROM pg_trigger WHERE tgname IN ('on_auth_user_created', 'profiles_updated_at');
-- Expected: 2 rows

