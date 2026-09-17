-- ============================================================
-- Call App — API Layer & Calling Identities Schema Migration
-- ============================================================
-- 1. Extend profiles with account_type & metadata
-- 2. Create calling_identities table (Public Calling Identity)
-- 3. Create api_credentials table (Private Authentication Credential)
-- 4. Create webhook_endpoints table (Real-time Event Delivery)
-- 5. RLS and indexes
-- ============================================================

-- ============================================================
-- SECTION 1: Extend profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN account_type TEXT NOT NULL DEFAULT 'human' 
      CHECK (account_type IN ('human', 'ai', 'bot', 'service', 'device', 'application'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;


-- ============================================================
-- SECTION 2: calling_identities table (Public Calling Identity)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calling_identities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  app_id      VARCHAR(10) NOT NULL UNIQUE REFERENCES public.profiles(app_id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'ai' CHECK (type IN ('human', 'ai', 'bot', 'service', 'device', 'application')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['call', 'receive_call', 'lookup', 'presence', 'call_history'],
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calling_identities_app_id_idx ON public.calling_identities(app_id);
CREATE INDEX IF NOT EXISTS calling_identities_profile_id_idx ON public.calling_identities(profile_id);
CREATE INDEX IF NOT EXISTS calling_identities_status_idx ON public.calling_identities(status);

ALTER TABLE public.calling_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calling_identities_select_authenticated"
  ON public.calling_identities
  FOR SELECT
  TO authenticated
  USING (TRUE);


-- ============================================================
-- SECTION 3: api_credentials table (Private Authentication Credential)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_credentials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id  UUID NOT NULL REFERENCES public.calling_identities(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Primary Key',
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   VARCHAR(16) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_credentials_key_hash_idx ON public.api_credentials(key_hash);
CREATE INDEX IF NOT EXISTS api_credentials_identity_id_idx ON public.api_credentials(identity_id);
CREATE INDEX IF NOT EXISTS api_credentials_status_idx ON public.api_credentials(status);

ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- API credentials can only be read / managed via backend service_role
CREATE POLICY "api_credentials_select_own"
  ON public.api_credentials
  FOR SELECT
  TO authenticated
  USING (
    identity_id IN (
      SELECT id FROM public.calling_identities WHERE profile_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 4: webhook_endpoints table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES public.calling_identities(id) ON DELETE CASCADE,
  app_id      VARCHAR(10) NOT NULL REFERENCES public.profiles(app_id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT ARRAY['*'],
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_app_id_idx ON public.webhook_endpoints(app_id);
CREATE INDEX IF NOT EXISTS webhook_endpoints_identity_id_idx ON public.webhook_endpoints(identity_id);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_select_own"
  ON public.webhook_endpoints
  FOR SELECT
  TO authenticated
  USING (
    app_id IN (SELECT app_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "webhook_endpoints_insert_own"
  ON public.webhook_endpoints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_id IN (SELECT app_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "webhook_endpoints_delete_own"
  ON public.webhook_endpoints
  FOR DELETE
  TO authenticated
  USING (
    app_id IN (SELECT app_id FROM public.profiles WHERE id = auth.uid())
  );
