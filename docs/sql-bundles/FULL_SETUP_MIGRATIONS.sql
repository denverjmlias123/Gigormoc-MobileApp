-- ==============================================================================
-- STEP 0: CLEANUP ALL OLD & EXISTING TABLES & ROUTINES
-- (Database is confirmed empty with 0 user rows. This ensures a clean slate)
-- ==============================================================================
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.profile_private CASCADE;
DROP TABLE IF EXISTS public.profile_hiring_interests CASCADE;
DROP TABLE IF EXISTS public.profile_skills CASCADE;
DROP TABLE IF EXISTS public.portfolio_items CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.conversation_reads CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.milestones CASCADE;
DROP TABLE IF EXISTS public.agreements CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.gigs CASCADE;
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.rate_limit_events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Old prototype tables
DROP TABLE IF EXISTS public.staff_moderation_actions CASCADE;
DROP TABLE IF EXISTS public.content_reports CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;
DROP TABLE IF EXISTS public.payment_confirmations CASCADE;
DROP TABLE IF EXISTS public.payment_reports CASCADE;
DROP TABLE IF EXISTS public.payment_obligations CASCADE;
DROP TABLE IF EXISTS public.milestone_submissions CASCADE;
DROP TABLE IF EXISTS public.agreement_versions CASCADE;
DROP TABLE IF EXISTS public.gig_versions CASCADE;
DROP TABLE IF EXISTS public.freelancer_profiles CASCADE;
DROP TABLE IF EXISTS public.client_profiles CASCADE;

-- Drop obsolete prototype functions if they exist
DROP FUNCTION IF EXISTS public.deposit_wallet CASCADE;
DROP FUNCTION IF EXISTS public.ensure_wallet_account CASCADE;
DROP FUNCTION IF EXISTS public.fund_escrow CASCADE;
DROP FUNCTION IF EXISTS public.fund_escrow_for_job CASCADE;
DROP FUNCTION IF EXISTS public.release_escrow CASCADE;
DROP FUNCTION IF EXISTS public.withdraw_wallet CASCADE;
DROP FUNCTION IF EXISTS public.sync_job_knowledge_graph CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_knowledge_graph CASCADE;
DROP FUNCTION IF EXISTS public.kg_upsert_node CASCADE;
DROP FUNCTION IF EXISTS public.kg_link CASCADE;

-- Drop all functions to ensure clean slate without return type conflicts
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
DROP FUNCTION IF EXISTS public.remove_profile_skill CASCADE;
DROP FUNCTION IF EXISTS public.remove_profile_skill(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.complete_onboarding CASCADE;
DROP FUNCTION IF EXISTS public.publish_gig CASCADE;
DROP FUNCTION IF EXISTS public.create_draft_gig CASCADE;
DROP FUNCTION IF EXISTS public.submit_application CASCADE;
DROP FUNCTION IF EXISTS public.respond_to_application CASCADE;
DROP FUNCTION IF EXISTS public.respond_to_counter CASCADE;
DROP FUNCTION IF EXISTS public.define_milestones CASCADE;
DROP FUNCTION IF EXISTS public.submit_milestone CASCADE;
DROP FUNCTION IF EXISTS public.review_milestone CASCADE;
DROP FUNCTION IF EXISTS public.report_payment CASCADE;
DROP FUNCTION IF EXISTS public.confirm_payment CASCADE;
DROP FUNCTION IF EXISTS public.dispute_payment CASCADE;
DROP FUNCTION IF EXISTS public.complete_agreement CASCADE;
DROP FUNCTION IF EXISTS public.submit_review CASCADE;
DROP FUNCTION IF EXISTS public.cancel_agreement CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_category CASCADE;
DROP FUNCTION IF EXISTS public.suggest_categories_for_gig CASCADE;
DROP FUNCTION IF EXISTS public.find_similar_categories CASCADE;
DROP FUNCTION IF EXISTS public.get_browse_categories CASCADE;
DROP FUNCTION IF EXISTS public.admin_merge_categories CASCADE;
DROP FUNCTION IF EXISTS public.save_hiring_details CASCADE;
DROP FUNCTION IF EXISTS public.get_profile_completeness CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_details CASCADE;
DROP FUNCTION IF EXISTS public.set_profile_avatar CASCADE;


-- ==============================================================================
-- MIGRATION: 20261010000000_init.sql
-- ==============================================================================
-- Gigormoc Initial Migration Shell
-- Backend: 100% Supabase. RLS enabled on every public table.
-- Milestone 0: Migrations folder initialized.


-- ==============================================================================
-- MIGRATION: 20261011000001_auth_profiles.sql
-- ==============================================================================
-- Milestone 1: Auth and Profiles
-- 100% Supabase. RLS default deny. 18+ enforced in database trigger.

-- 1. platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- No client policies for platform_admins: default deny.

-- 2. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_path text,
  area text DEFAULT '',
  starting_mode text CHECK (starting_mode IN ('find_work', 'hire_someone', 'explore_both')) DEFAULT 'explore_both',
  onboarding_complete boolean NOT NULL DEFAULT false,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0.00,
  rating_count integer NOT NULL DEFAULT 0,
  completed_gigs integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view active profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (status = 'active' OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own safe profile columns" ON public.profiles;
CREATE POLICY "Users can update own safe profile columns" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Protect system-controlled columns (ratings, counts, status) from direct update
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.rating_avg <> OLD.rating_avg OR
      NEW.rating_count <> OLD.rating_count OR
      NEW.completed_gigs <> OLD.completed_gigs OR
      NEW.status <> OLD.status) THEN
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) THEN
      NEW.rating_avg := OLD.rating_avg;
      NEW.rating_count := OLD.rating_count;
      NEW.completed_gigs := OLD.completed_gigs;
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_profile_update_integrity ON public.profiles;
CREATE TRIGGER tr_check_profile_update_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_integrity();

-- 3. profile_private
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  dob date NOT NULL,
  phone text,
  terms_version text NOT NULL DEFAULT 'v1.0',
  terms_accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view own private profile" ON public.profile_private;
CREATE POLICY "Owner can view own private profile" ON public.profile_private
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Revoke direct mutations on protected tables
REVOKE INSERT, UPDATE, DELETE ON public.profile_private FROM anon, authenticated;
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;

-- 4. Trigger on auth.users for profile provisioning and 18+ gate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_dob_str text;
  v_dob date;
  v_age integer;
  v_display_name text;
  v_terms_version text;
BEGIN
  v_dob_str := NEW.raw_user_meta_data->>'dob';
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', '');
  v_terms_version := COALESCE(NEW.raw_user_meta_data->>'terms_version', 'v1.0');

  IF v_dob_str IS NULL OR trim(v_dob_str) = '' THEN
    RAISE EXCEPTION 'Date of birth is required.';
  END IF;

  BEGIN
    v_dob := v_dob_str::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid date of birth format. Expected YYYY-MM-DD.';
  END;

  v_age := date_part('year', age(current_date, v_dob));
  IF v_age < 18 THEN
    RAISE EXCEPTION 'Users must be at least 18 years old to register.';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profile_private (user_id, dob, terms_version, terms_accepted_at)
  VALUES (NEW.id, v_dob, v_terms_version, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- MIGRATION: 20261011000002_profiles_and_storage.sql
-- ==============================================================================
-- Milestone 2: Categories, Skills, Portfolio, and Storage Buckets
-- Schema only. No seed or sample rows.

-- 1. categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active categories" ON public.categories;
CREATE POLICY "Authenticated users can view active categories" ON public.categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can insert categories" ON public.categories;
CREATE POLICY "Platform admins can insert categories" ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can update categories" ON public.categories;
CREATE POLICY "Platform admins can update categories" ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can delete categories" ON public.categories;
CREATE POLICY "Platform admins can delete categories" ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 2. skills
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active skills" ON public.skills;
CREATE POLICY "Authenticated users can view active skills" ON public.skills
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can insert skills" ON public.skills;
CREATE POLICY "Platform admins can insert skills" ON public.skills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can update skills" ON public.skills;
CREATE POLICY "Platform admins can update skills" ON public.skills
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can delete skills" ON public.skills;
CREATE POLICY "Platform admins can delete skills" ON public.skills
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 3. profile_skills
CREATE TABLE IF NOT EXISTS public.profile_skills (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);

ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view profile skills" ON public.profile_skills;
CREATE POLICY "Authenticated users can view profile skills" ON public.profile_skills
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can add own skills" ON public.profile_skills;
CREATE POLICY "Users can add own skills" ON public.profile_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own skills" ON public.profile_skills;
CREATE POLICY "Users can remove own skills" ON public.profile_skills
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- 4. portfolio_items
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  file_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view portfolio items" ON public.portfolio_items;
CREATE POLICY "Authenticated users can view portfolio items" ON public.portfolio_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can insert own portfolio items" ON public.portfolio_items
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can update own portfolio items" ON public.portfolio_items
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users can delete own portfolio items" ON public.portfolio_items
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- 5. Storage Buckets: avatars and portfolio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('portfolio', 'portfolio', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies for 'avatars'
DROP POLICY IF EXISTS "Public read on avatars bucket" ON storage.objects;
CREATE POLICY "Public read on avatars bucket" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage Policies for 'portfolio'
DROP POLICY IF EXISTS "Public read on portfolio bucket" ON storage.objects;
CREATE POLICY "Public read on portfolio bucket" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "Users can upload own portfolio images" ON storage.objects;
CREATE POLICY "Users can upload own portfolio images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own portfolio images" ON storage.objects;
CREATE POLICY "Users can update own portfolio images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own portfolio images" ON storage.objects;
CREATE POLICY "Users can delete own portfolio images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ==============================================================================
-- MIGRATION: 20261011000003_gigs_and_modes.sql
-- ==============================================================================
-- Milestone 3: Gigs and Role Mode Alignment
-- Strict adherence to AGENTS.md and docs/GIGORMOC_SPEC.md

-- 1. Align profiles with new active_mode and separate ratings
DO $$
BEGIN
  -- Alter starting_mode if needed or drop default
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'starting_mode') THEN
    ALTER TABLE public.profiles DROP COLUMN starting_mode;
  END IF;
END $$;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS active_mode text CHECK (active_mode IN ('find_work', 'hire')),
  ADD COLUMN IF NOT EXISTS mode_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS freelancer_rating_avg numeric(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS freelancer_rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_rating_avg numeric(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS client_rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freelancer_completed_gigs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_completed_gigs integer NOT NULL DEFAULT 0;

-- Update profile integrity trigger to protect active_mode and separate ratings
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Non-admins cannot alter active_mode, mode_changed_at, rating columns, completed gig counts, or status directly
  IF (NEW.active_mode IS DISTINCT FROM OLD.active_mode OR
      NEW.mode_changed_at IS DISTINCT FROM OLD.mode_changed_at OR
      NEW.freelancer_rating_avg <> OLD.freelancer_rating_avg OR
      NEW.freelancer_rating_count <> OLD.freelancer_rating_count OR
      NEW.client_rating_avg <> OLD.client_rating_avg OR
      NEW.client_rating_count <> OLD.client_rating_count OR
      NEW.freelancer_completed_gigs <> OLD.freelancer_completed_gigs OR
      NEW.client_completed_gigs <> OLD.client_completed_gigs OR
      NEW.rating_avg <> OLD.rating_avg OR
      NEW.rating_count <> OLD.rating_count OR
      NEW.completed_gigs <> OLD.completed_gigs OR
      NEW.status <> OLD.status) THEN
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) THEN
      NEW.active_mode := OLD.active_mode;
      NEW.mode_changed_at := OLD.mode_changed_at;
      NEW.freelancer_rating_avg := OLD.freelancer_rating_avg;
      NEW.freelancer_rating_count := OLD.freelancer_rating_count;
      NEW.client_rating_avg := OLD.client_rating_avg;
      NEW.client_rating_count := OLD.client_rating_count;
      NEW.freelancer_completed_gigs := OLD.freelancer_completed_gigs;
      NEW.client_completed_gigs := OLD.client_completed_gigs;
      NEW.rating_avg := OLD.rating_avg;
      NEW.rating_count := OLD.rating_count;
      NEW.completed_gigs := OLD.completed_gigs;
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Audit events table (append-only, default deny)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
-- No client access policies for audit_events

-- 3. RPC Function: choose_initial_mode
CREATE OR REPLACE FUNCTION public.choose_initial_mode(target_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_current_mode text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF target_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'Invalid mode. Must be find_work or hire.';
  END IF;

  -- Lock row
  SELECT active_mode INTO v_current_mode
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  -- Allowed only while active_mode is null
  IF v_current_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Initial mode has already been chosen. Use switch_mode instead.';
  END IF;

  UPDATE public.profiles
  SET active_mode = target_mode,
      mode_changed_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'choose_initial_mode', 'profiles', v_user_id, jsonb_build_object('mode', target_mode));
END;
$$;

-- 4. Gigs table
CREATE TABLE IF NOT EXISTS public.gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  requirements text NOT NULL DEFAULT '',
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  price_min integer NOT NULL CHECK (price_min >= 0),
  price_max integer NOT NULL CHECK (price_max >= price_min),
  work_type text NOT NULL CHECK (work_type IN ('remote', 'face_to_face', 'hybrid')),
  area text DEFAULT '',
  application_deadline timestamptz NOT NULL,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for gigs
CREATE INDEX IF NOT EXISTS idx_gigs_category_id ON public.gigs (category_id);
CREATE INDEX IF NOT EXISTS idx_gigs_status ON public.gigs (status);
CREATE INDEX IF NOT EXISTS idx_gigs_client_id ON public.gigs (client_id);
CREATE INDEX IF NOT EXISTS idx_gigs_work_type ON public.gigs (work_type);
CREATE INDEX IF NOT EXISTS idx_gigs_created_at ON public.gigs (created_at DESC);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- Gigs RLS policies
-- Authenticated users can view open gigs
DROP POLICY IF EXISTS "Anyone can view open gigs" ON public.gigs;
CREATE POLICY "Anyone can view open gigs" ON public.gigs
  FOR SELECT
  TO authenticated
  USING (status = 'open' OR client_id = auth.uid());

-- Client can insert own draft gigs
DROP POLICY IF EXISTS "Clients can insert own draft gigs" ON public.gigs;
CREATE POLICY "Clients can insert own draft gigs" ON public.gigs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND
    status = 'draft'
  );

-- Client can update own draft gigs
DROP POLICY IF EXISTS "Clients can update own draft gigs" ON public.gigs;
CREATE POLICY "Clients can update own draft gigs" ON public.gigs
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() AND status = 'draft')
  WITH CHECK (client_id = auth.uid() AND status = 'draft');

-- Client can delete own draft gigs
DROP POLICY IF EXISTS "Clients can delete own draft gigs" ON public.gigs;
CREATE POLICY "Clients can delete own draft gigs" ON public.gigs
  FOR DELETE
  TO authenticated
  USING (client_id = auth.uid() AND status = 'draft');

-- 5. RPC Function: publish_gig
CREATE OR REPLACE FUNCTION public.publish_gig(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_email_confirmed boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig owner can publish this gig.';
  END IF;

  IF v_gig.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft gigs can be published.';
  END IF;

  -- Lock profile row and check gates
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- Enforce active_mode = hire
  IF v_profile.active_mode <> 'hire' THEN
    RAISE EXCEPTION 'You must be in Hire Someone mode to publish a gig.';
  END IF;

  -- Enforce active account status
  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Enforce display name set
  IF v_profile.display_name IS NULL OR trim(v_profile.display_name) = '' THEN
    RAISE EXCEPTION 'You must set a display name before publishing a gig.';
  END IF;

  -- Check email confirmation from auth.users
  SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'You must confirm your email address before publishing a gig.';
  END IF;

  -- Validate deadlines
  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'Application deadline must be in the future.';
  END IF;

  IF v_gig.deadline < v_gig.application_deadline THEN
    RAISE EXCEPTION 'Project completion deadline must be on or after the application deadline.';
  END IF;

  -- Publish gig atomically
  UPDATE public.gigs
  SET status = 'open',
      updated_at = now()
  WHERE id = p_gig_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'publish_gig', 'gigs', p_gig_id, jsonb_build_object('title', v_gig.title));
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000004_applications_and_agreements.sql
-- ==============================================================================
-- Milestone 4: Applications, Agreements, and Mode Switching Engine
-- 100% Supabase. Atomic operations with row locks and partial unique index.

-- 1. rate_limit_events table
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events ON public.rate_limit_events (user_id, action, created_at DESC);
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- No client access: default deny

-- 2. applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_price integer NOT NULL CHECK (proposed_price > 0),
  estimated_days integer NOT NULL CHECK (estimated_days > 0),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'accepted', 'declined', 'countered', 'withdrawn')),
  counter_price integer CHECK (counter_price IS NULL OR counter_price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, freelancer_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_gig_id ON public.applications (gig_id);
CREATE INDEX IF NOT EXISTS idx_applications_freelancer_id ON public.applications (freelancer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Applications RLS:
-- Visible only to applicant or gig owner
DROP POLICY IF EXISTS "Applicant can view own applications" ON public.applications;
CREATE POLICY "Applicant can view own applications" ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    freelancer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.gigs
      WHERE id = applications.gig_id AND client_id = auth.uid()
    )
  );

-- Direct client inserts, updates, deletes are denied (mutations through RPCs only)
REVOKE INSERT, UPDATE, DELETE ON public.applications FROM anon, authenticated;

-- 3. agreements table
CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  freelancer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agreed_price integer NOT NULL CHECK (agreed_price > 0),
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: exactly one active agreement per gig
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_agreement_per_gig 
  ON public.agreements (gig_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON public.agreements (client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_freelancer_id ON public.agreements (freelancer_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON public.agreements (status);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- Agreements RLS:
-- Visible only to agreement participants and admins
DROP POLICY IF EXISTS "Participants can view agreement" ON public.agreements;
CREATE POLICY "Participants can view agreement" ON public.agreements
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR
    freelancer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- Direct client writes are revoked
REVOKE INSERT, UPDATE, DELETE ON public.agreements FROM anon, authenticated;

-- 4. RPC Function: submit_application
CREATE OR REPLACE FUNCTION public.submit_application(
  p_gig_id uuid,
  p_proposed_price integer,
  p_estimated_days integer,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_has_skill boolean;
  v_email_confirmed boolean;
  v_recent_app_count integer;
  v_app_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Input validations
  IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
    RAISE EXCEPTION 'Proposed price must be greater than zero.';
  END IF;
  IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Estimated days must be greater than zero.';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Application message is required.';
  END IF;

  -- Rate limit check (max 10 applications per hour)
  SELECT count(*) INTO v_recent_app_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'submit_application'
    AND created_at > (now() - interval '1 hour');

  IF v_recent_app_count >= 10 THEN
    RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
  END IF;

  -- Lock gig and verify eligibility
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own gig.';
  END IF;

  IF v_gig.status <> 'open' THEN
    RAISE EXCEPTION 'Gig is not open for applications.';
  END IF;

  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'The application deadline for this gig has passed.';
  END IF;

  -- Check freelancer profile gates
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.active_mode <> 'find_work' THEN
    RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
    RAISE EXCEPTION 'You must add a profile photo before applying for gigs.';
  END IF;

  -- Gate: at least 1 skill in profile_skills
  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
  ) INTO v_has_skill;

  IF NOT v_has_skill THEN
    RAISE EXCEPTION 'You must add at least 1 skill to your profile before applying.';
  END IF;

  -- Gate: email confirmed
  SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'You must confirm your email address before applying.';
  END IF;

  -- Insert application
  INSERT INTO public.applications (
    gig_id,
    freelancer_id,
    proposed_price,
    estimated_days,
    message,
    status
  )
  VALUES (
    p_gig_id,
    v_user_id,
    p_proposed_price,
    p_estimated_days,
    trim(p_message),
    'applied'
  )
  RETURNING id INTO v_app_id;

  -- Record rate limit and audit events
  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'submit_application');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'submit_application',
    'applications',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id, 'price', p_proposed_price)
  );

  RETURN v_app_id;
END;
$$;

-- 5. RPC Function: respond_to_application
CREATE OR REPLACE FUNCTION public.respond_to_application(
  p_application_id uuid,
  p_action text,
  p_counter_price integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'Invalid response action. Must be accept, decline, or counter.';
  END IF;

  -- Lock application row
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the client who posted the gig can respond to applicants.';
  END IF;

  IF v_app.status <> 'applied' THEN
    RAISE EXCEPTION 'This application has already been responded to (current status: %)', v_app.status;
  END IF;

  IF p_action = 'decline' THEN
    UPDATE public.applications
    SET status = 'declined', updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'decline_application', 'applications', p_application_id, jsonb_build_object('gig_id', v_gig.id));

    RETURN NULL;

  ELSIF p_action = 'counter' THEN
    IF p_counter_price IS NULL OR p_counter_price <= 0 THEN
      RAISE EXCEPTION 'Counteroffer price must be greater than zero.';
    END IF;

    UPDATE public.applications
    SET status = 'countered',
        counter_price = p_counter_price,
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'counter_application', 'applications', p_application_id, jsonb_build_object('counter_price', p_counter_price));

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    -- Check if an active agreement already exists on this gig
    IF EXISTS (
      SELECT 1 FROM public.agreements
      WHERE gig_id = v_gig.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active agreement already exists for this gig.';
    END IF;

    -- Update application status
    UPDATE public.applications
    SET status = 'accepted', updated_at = now()
    WHERE id = p_application_id;

    -- Atomically create agreement
    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline,
      status
    )
    VALUES (
      v_gig.id,
      v_user_id,
      v_app.freelancer_id,
      v_app.proposed_price,
      v_gig.deadline,
      'active'
    )
    RETURNING id INTO v_agreement_id;

    -- Update gig status to in_progress
    UPDATE public.gigs
    SET status = 'in_progress', updated_at = now()
    WHERE id = v_gig.id;

    -- Decline all other pending applications for this gig
    UPDATE public.applications
    SET status = 'declined', updated_at = now()
    WHERE gig_id = v_gig.id AND id <> p_application_id AND status IN ('applied', 'countered');

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_application',
      'agreements',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id, 'freelancer_id', v_app.freelancer_id, 'price', v_app.proposed_price)
    );

    RETURN v_agreement_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 6. RPC Function: respond_to_counter
CREATE OR REPLACE FUNCTION public.respond_to_counter(
  p_application_id uuid,
  p_action text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'withdraw') THEN
    RAISE EXCEPTION 'Invalid counter response. Must be accept, decline, or withdraw.';
  END IF;

  -- Lock application
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.freelancer_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the applicant freelancer can respond to this counteroffer.';
  END IF;

  IF v_app.status <> 'countered' THEN
    RAISE EXCEPTION 'Application is not in countered status.';
  END IF;

  -- Lock gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF p_action IN ('decline', 'withdraw') THEN
    UPDATE public.applications
    SET status = p_action, updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, p_action || '_counter', 'applications', p_application_id, jsonb_build_object('gig_id', v_gig.id));

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    -- Check if agreement already exists
    IF EXISTS (
      SELECT 1 FROM public.agreements
      WHERE gig_id = v_gig.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active agreement already exists for this gig.';
    END IF;

    UPDATE public.applications
    SET status = 'accepted', updated_at = now()
    WHERE id = p_application_id;

    -- Create agreement with agreed_price = counter_price
    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline,
      status
    )
    VALUES (
      v_gig.client_id,
      v_user_id,
      v_gig.client_id,
      v_app.counter_price,
      v_gig.deadline,
      'active'
    )
    RETURNING id INTO v_agreement_id;

    UPDATE public.gigs
    SET status = 'in_progress', updated_at = now()
    WHERE id = v_gig.id;

    -- Decline all other pending applications
    UPDATE public.applications
    SET status = 'declined', updated_at = now()
    WHERE gig_id = v_gig.id AND id <> p_application_id AND status IN ('applied', 'countered');

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_counter',
      'agreements',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id, 'price', v_app.counter_price)
    );

    RETURN v_agreement_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 7. Helper Function: get_mode_switch_status
CREATE OR REPLACE FUNCTION public.get_mode_switch_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_days_since_switch numeric;
  v_cooldown_remaining_days integer := 0;
  v_blockers text[] := '{}';
  v_has_active_agreement boolean;
  v_pending_gigs_count integer := 0;
  v_pending_apps_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.status <> 'active' THEN
    v_blockers := array_append(v_blockers, 'Account is not in active status (' || v_profile.status || ').');
  END IF;

  -- 1. Cooldown check (7 days)
  IF v_profile.mode_changed_at IS NOT NULL THEN
    v_days_since_switch := EXTRACT(EPOCH FROM (now() - v_profile.mode_changed_at)) / 86400;
    IF v_days_since_switch < 7 THEN
      v_cooldown_remaining_days := CEIL(7 - v_days_since_switch)::integer;
      v_blockers := array_append(v_blockers, 'Cooldown period active: ' || v_cooldown_remaining_days || ' day(s) remaining.');
    END IF;
  END IF;

  -- 2. Check for active or disputed agreements
  SELECT EXISTS (
    SELECT 1 FROM public.agreements
    WHERE (client_id = v_user_id OR freelancer_id = v_user_id)
      AND status IN ('active', 'disputed')
  ) INTO v_has_active_agreement;

  IF v_has_active_agreement THEN
    v_blockers := array_append(v_blockers, 'You have an active or disputed agreement that must be completed first.');
  END IF;

  -- Count pending items that will be affected upon confirmation
  IF v_profile.active_mode = 'hire' THEN
    SELECT count(*) INTO v_pending_gigs_count
    FROM public.gigs
    WHERE client_id = v_user_id AND status IN ('draft', 'open');
  ELSIF v_profile.active_mode = 'find_work' THEN
    SELECT count(*) INTO v_pending_apps_count
    FROM public.applications
    WHERE freelancer_id = v_user_id AND status IN ('applied', 'countered');
  END IF;

  RETURN jsonb_build_object(
    'current_mode', v_profile.active_mode,
    'can_switch', (array_length(v_blockers, 1) IS NULL),
    'cooldown_remaining_days', v_cooldown_remaining_days,
    'blockers', v_blockers,
    'pending_gigs_count', v_pending_gigs_count,
    'pending_apps_count', v_pending_apps_count
  );
END;
$$;

-- 8. RPC Function: switch_mode
CREATE OR REPLACE FUNCTION public.switch_mode(
  p_target_mode text,
  p_confirm boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_status_json jsonb;
  v_can_switch boolean;
  v_blockers text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_target_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'Target mode must be find_work or hire.';
  END IF;

  -- Lock profile row
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_profile.active_mode = p_target_mode THEN
    RAISE EXCEPTION 'You are already in % mode.', p_target_mode;
  END IF;

  -- Check blockers
  v_status_json := public.get_mode_switch_status();
  v_can_switch := (v_status_json->>'can_switch')::boolean;

  IF NOT v_can_switch THEN
    RAISE EXCEPTION 'Mode switch blocked: %', v_status_json->>'blockers';
  END IF;

  IF NOT p_confirm THEN
    RAISE EXCEPTION 'Confirmation required to switch modes.';
  END IF;

  -- Single atomic transaction actions
  IF v_profile.active_mode = 'hire' THEN
    -- Cancel draft and open gigs
    UPDATE public.gigs
    SET status = 'cancelled', updated_at = now()
    WHERE client_id = v_user_id AND status IN ('draft', 'open');

  ELSIF v_profile.active_mode = 'find_work' THEN
    -- Withdraw pending proposals
    UPDATE public.applications
    SET status = 'withdrawn', updated_at = now()
    WHERE freelancer_id = v_user_id AND status IN ('applied', 'countered');
  END IF;

  -- Update active_mode and reset cooldown timer
  UPDATE public.profiles
  SET active_mode = p_target_mode,
      mode_changed_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'switch_mode',
    'profiles',
    v_user_id,
    jsonb_build_object('from_mode', v_profile.active_mode, 'to_mode', p_target_mode)
  );
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000005_milestones_and_submissions.sql
-- ==============================================================================
-- Migration: 20261011000005_milestones_and_submissions.sql
-- Milestone 5: Milestones and Submissions
-- Strictly adheres to docs/GIGORMOC_SPEC.md sections 5, 8, 9, 10 and AGENTS.md

-- 1. Create milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL CHECK (seq >= 1 AND seq <= 5),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    amount INTEGER NOT NULL CHECK (amount > 0), -- in integer centavos
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'revision_requested')),
    revision_count INTEGER NOT NULL DEFAULT 0 CHECK (revision_count >= 0 AND revision_count <= 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agreement_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_milestones_agreement_id ON public.milestones(agreement_id);

-- 2. Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submission_number INTEGER NOT NULL CHECK (submission_number >= 1 AND submission_number <= 3),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
    file_paths TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_milestone_id ON public.submissions(milestone_id);

-- 3. Set up submissions private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'submissions',
    'submissions',
    false,
    26214400, -- 25MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/zip',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/zip',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

-- 4. Enable RLS on milestones and submissions
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from public and authenticated (mutations go through RPC functions)
REVOKE INSERT, UPDATE, DELETE ON public.milestones FROM public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM public, authenticated;

-- RLS Policies: milestones
DROP POLICY IF EXISTS "Participants read agreement milestones" ON public.milestones;
CREATE POLICY "Participants read agreement milestones" ON public.milestones FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id = milestones.agreement_id
        AND (
            a.client_id = auth.uid()
            OR a.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

-- RLS Policies: submissions
DROP POLICY IF EXISTS "Participants read milestone submissions" ON public.submissions;
CREATE POLICY "Participants read milestone submissions" ON public.submissions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.milestones m
        JOIN public.agreements a ON a.id = m.agreement_id
        WHERE m.id = submissions.milestone_id
        AND (
            a.client_id = auth.uid()
            OR a.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

-- 5. Storage RLS Policies for submissions bucket
-- Files are organized as: {agreement_id}/{milestone_id}/{filename}
DROP POLICY IF EXISTS "Participants upload submission files" ON storage.objects;
CREATE POLICY "Participants upload submission files" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'submissions'
    AND EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.freelancer_id = auth.uid()
        AND a.status = 'active'
    )
);

DROP POLICY IF EXISTS "Participants read submission files" ON storage.objects;
CREATE POLICY "Participants read submission files" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'submissions'
    AND EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND (
            a.client_id = auth.uid()
            OR a.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "Freelancer delete submission files" ON storage.objects;
CREATE POLICY "Freelancer delete submission files" ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'submissions'
    AND EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.freelancer_id = auth.uid()
        AND a.status = 'active'
    )
);

-- 6. RPC Function: define_milestones
-- Client defines 1 to 5 milestones. Sum of amounts must equal agreed_price exactly.
CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_milestone_elem JSONB;
    v_total_amount BIGINT := 0;
    v_count INTEGER;
    v_seq INTEGER := 1;
    v_title TEXT;
    v_desc TEXT;
    v_amount INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    -- Only client can set up or adjust initial milestones
    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can define milestones for this agreement.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be defined on active agreements.';
    END IF;

    -- Cannot redefine if work has already begun (any milestone is submitted or approved)
    IF EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
        AND status IN ('submitted', 'approved')
    ) THEN
        RAISE EXCEPTION 'Cannot modify milestones after work has been submitted or approved.';
    END IF;

    v_count := jsonb_array_length(p_milestones);
    IF v_count < 1 OR v_count > 5 THEN
        RAISE EXCEPTION 'Milestone count must be between 1 and 5.';
    END IF;

    -- Validate each milestone and check sum
    FOR v_milestone_elem IN SELECT * FROM jsonb_array_elements(p_milestones)
    LOOP
        v_title := trim(v_milestone_elem->>'title');
        v_desc := coalesce(trim(v_milestone_elem->>'description'), '');
        v_amount := (v_milestone_elem->>'amount')::INTEGER;

        IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
            RAISE EXCEPTION 'Milestone title must be between 3 and 120 characters.';
        END IF;

        IF v_amount IS NULL OR v_amount <= 0 THEN
            RAISE EXCEPTION 'Milestone amount must be greater than 0 centavos.';
        END IF;

        v_total_amount := v_total_amount + v_amount;
    END LOOP;

    -- Exact sum equality check
    IF v_total_amount <> v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Milestone sum (%) does not equal agreed price (%).',
            v_total_amount, v_agreement.agreed_price;
    END IF;

    -- Delete existing pending milestones for this agreement
    DELETE FROM public.milestones WHERE agreement_id = p_agreement_id;

    -- Insert new milestones
    FOR v_milestone_elem IN SELECT * FROM jsonb_array_elements(p_milestones)
    LOOP
        v_title := trim(v_milestone_elem->>'title');
        v_desc := coalesce(trim(v_milestone_elem->>'description'), '');
        v_amount := (v_milestone_elem->>'amount')::INTEGER;

        INSERT INTO public.milestones (
            agreement_id,
            seq,
            title,
            description,
            amount,
            status,
            revision_count
        ) VALUES (
            p_agreement_id,
            v_seq,
            v_title,
            v_desc,
            v_amount,
            'pending',
            0
        );

        v_seq := v_seq + 1;
    END LOOP;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestones_defined',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'milestones_count', v_count,
            'total_amount', v_total_amount
        )
    );
END;
$$;

-- 7. RPC Function: submit_milestone
-- Freelancer submits work and file deliverables.
CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_message TEXT,
    p_file_paths TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
    v_sub_num INTEGER;
    v_submission_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock milestone row
    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    -- Check agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the assigned freelancer can submit milestone deliverables.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot submit work for an inactive or disputed agreement.';
    END IF;

    -- Milestone status check
    IF v_milestone.status NOT IN ('pending', 'revision_requested') THEN
        RAISE EXCEPTION 'Milestone is currently in % status and cannot receive new submissions.', v_milestone.status;
    END IF;

    IF char_length(trim(p_message)) < 10 OR char_length(trim(p_message)) > 2000 THEN
        RAISE EXCEPTION 'Submission message must be between 10 and 2000 characters.';
    END IF;

    -- Calculate submission number
    v_sub_num := v_milestone.revision_count + 1;
    IF v_sub_num > 3 THEN
        RAISE EXCEPTION 'Maximum submission limit reached for this milestone.';
    END IF;

    -- Insert submission record
    INSERT INTO public.submissions (
        milestone_id,
        freelancer_id,
        submission_number,
        message,
        file_paths
    ) VALUES (
        p_milestone_id,
        v_caller_id,
        v_sub_num,
        trim(p_message),
        coalesce(p_file_paths, '{}')
    )
    RETURNING id INTO v_submission_id;

    -- Update milestone status
    UPDATE public.milestones
    SET status = 'submitted',
        updated_at = now()
    WHERE id = p_milestone_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestone_submitted',
        v_caller_id,
        p_milestone_id,
        'milestones',
        jsonb_build_object(
            'agreement_id', v_milestone.agreement_id,
            'submission_id', v_submission_id,
            'submission_number', v_sub_num,
            'file_count', cardinality(p_file_paths)
        )
    );

    RETURN v_submission_id;
END;
$$;

-- 8. RPC Function: review_milestone
-- Client reviews milestone: 'approve' or 'request_revision' (max 2 revisions allowed).
CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id UUID,
    p_action TEXT,
    p_feedback TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('approve', 'request_revision') THEN
        RAISE EXCEPTION 'Invalid review action. Must be approve or request_revision.';
    END IF;

    -- Lock milestone row
    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    -- Check agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can review milestone submissions.';
    END IF;

    IF v_milestone.status <> 'submitted' THEN
        RAISE EXCEPTION 'Only submitted milestones can be reviewed. Current status is %.', v_milestone.status;
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.milestones
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_milestone_id;

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_approved',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object(
                'agreement_id', v_milestone.agreement_id,
                'feedback', trim(coalesce(p_feedback, ''))
            )
        );

    ELSIF p_action = 'request_revision' THEN
        IF v_milestone.revision_count >= 2 THEN
            RAISE EXCEPTION 'Maximum of 2 revisions already reached for this milestone.';
        END IF;

        IF p_feedback IS NULL OR char_length(trim(p_feedback)) < 5 THEN
            RAISE EXCEPTION 'Please provide clear revision feedback explaining what needs improvement.';
        END IF;

        UPDATE public.milestones
        SET status = 'revision_requested',
            revision_count = revision_count + 1,
            updated_at = now()
        WHERE id = p_milestone_id;

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_revision_requested',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object(
                'agreement_id', v_milestone.agreement_id,
                'new_revision_count', v_milestone.revision_count + 1,
                'feedback', trim(p_feedback)
            )
        );
    END IF;
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000006_payments.sql
-- ==============================================================================
-- Migration: 20261011000006_payments.sql
-- Milestone 6: Payments (External Evidence Only)
-- Strictly adheres to docs/GIGORMOC_SPEC.md sections 5, 8, 9, 10 and AGENTS.md

-- 1. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0), -- in integer centavos
    payment_method TEXT NOT NULL CHECK (payment_method IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other')),
    reference_number TEXT NOT NULL DEFAULT '' CHECK (char_length(reference_number) <= 100),
    receipt_path TEXT DEFAULT NULL,
    notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
    status TEXT NOT NULL DEFAULT 'reported_sent' CHECK (status IN ('reported_sent', 'confirmed_received', 'disputed')),
    dispute_reason TEXT DEFAULT NULL CHECK (dispute_reason IS NULL OR char_length(dispute_reason) BETWEEN 5 AND 1000),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    disputed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_agreement_id ON public.payments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON public.payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee_id ON public.payments(payee_id);

-- 2. Set up receipts private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    10485760, -- 10MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ];

-- 3. Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from public and authenticated (mutations go through RPC functions)
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM public, authenticated;

-- RLS Policies: payments
DROP POLICY IF EXISTS "Participants read agreement payments" ON public.payments;
CREATE POLICY "Participants read agreement payments" ON public.payments FOR SELECT
TO authenticated
USING (
    payer_id = auth.uid()
    OR payee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- 4. Storage RLS Policies for receipts bucket
-- Files are organized as: {agreement_id}/{payment_id}/{filename}
DROP POLICY IF EXISTS "Client upload receipt files" ON storage.objects;
CREATE POLICY "Client upload receipt files" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.client_id = auth.uid()
        AND a.status = 'active'
    )
);

DROP POLICY IF EXISTS "Participants read receipt files" ON storage.objects;
CREATE POLICY "Participants read receipt files" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'receipts'
    AND EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND (
            a.client_id = auth.uid()
            OR a.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

-- 5. RPC Function: report_payment
-- Client reports an external payment made to freelancer.
CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id UUID,
    p_milestone_id UUID DEFAULT NULL,
    p_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'gcash',
    p_reference_number TEXT DEFAULT '',
    p_receipt_path TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_payment_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can report payments for this agreement.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Payments can only be reported for active agreements.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0 centavos.';
    END IF;

    IF p_payment_method NOT IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method.';
    END IF;

    -- Validate milestone if provided
    IF p_milestone_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.milestones
            WHERE id = p_milestone_id AND agreement_id = p_agreement_id
        ) THEN
            RAISE EXCEPTION 'Milestone does not belong to this agreement.';
        END IF;
    END IF;

    -- Insert payment record
    INSERT INTO public.payments (
        agreement_id,
        milestone_id,
        payer_id,
        payee_id,
        amount,
        payment_method,
        reference_number,
        receipt_path,
        notes,
        status,
        reported_at
    ) VALUES (
        p_agreement_id,
        p_milestone_id,
        v_caller_id,
        v_agreement.freelancer_id,
        p_amount,
        p_payment_method,
        coalesce(trim(p_reference_number), ''),
        p_receipt_path,
        coalesce(trim(p_notes), ''),
        'reported_sent',
        now()
    )
    RETURNING id INTO v_payment_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_reported',
        v_caller_id,
        v_payment_id,
        'payments',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'amount', p_amount,
            'payment_method', p_payment_method,
            'reference_number', p_reference_number
        )
    );

    RETURN v_payment_id;
END;
$$;

-- 6. RPC Function: confirm_payment
-- Freelancer confirms receiving external payment.
CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock payment row
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the receiving freelancer can confirm payment receipt.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RETURN; -- idempotent
    END IF;

    UPDATE public.payments
    SET status = 'confirmed_received',
        confirmed_at = now(),
        disputed_at = NULL,
        dispute_reason = NULL,
        updated_at = now()
    WHERE id = p_payment_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_confirmed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object(
            'agreement_id', v_payment.agreement_id,
            'amount', v_payment.amount
        )
    );
END;
$$;

-- 7. RPC Function: dispute_payment
-- Freelancer disputes a reported payment that was not received or incorrect amount.
CREATE OR REPLACE FUNCTION public.dispute_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a clear dispute reason explaining why the payment cannot be confirmed.';
    END IF;

    -- Lock payment row
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can dispute payment reports.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RAISE EXCEPTION 'Cannot dispute a payment that was already confirmed.';
    END IF;

    UPDATE public.payments
    SET status = 'disputed',
        dispute_reason = trim(p_reason),
        disputed_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_disputed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object(
            'agreement_id', v_payment.agreement_id,
            'amount', v_payment.amount,
            'reason', trim(p_reason)
        )
    );
END;
$$;

-- 8. RPC Function: complete_agreement
-- Agreement completes when:
-- 1. All milestones on the agreement are 'approved'
-- 2. Total of confirmed payments equals or exceeds agreed_price
-- 3. No unresolved payment disputes exist
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_unapproved_count INTEGER;
    v_total_confirmed BIGINT := 0;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_milestone_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    -- Caller must be participant or admin
    IF v_agreement.client_id <> v_caller_id
       AND v_agreement.freelancer_id <> v_caller_id
       AND NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller_id)
    THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        RETURN; -- idempotent
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    -- Check milestones: must have at least 1 milestone, and all must be approved
    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    -- Check payment disputes
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    -- Check pending payment reports
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    -- Check total confirmed payments vs agreed price
    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    -- Complete agreement
    UPDATE public.agreements
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_agreement_id;

    -- Update gig status to completed
    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    -- Increment participant stats
    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000007_reviews.sql
-- ==============================================================================
-- Migration: 20261011000007_reviews.sql
-- Milestone 7: Reviews
-- Strictly adheres to docs/GIGORMOC_SPEC.md sections 5, 8, 9 and AGENTS.md

-- 1. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('client', 'freelancer')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agreement_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_agreement_id ON public.reviews(agreement_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);

-- 2. Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Revoke direct inserts, updates, deletes from public and authenticated (mutations go through submit_review function only)
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM public, authenticated;

-- RLS Policies: reviews are readable by authenticated users (public reputation feedback)
DROP POLICY IF EXISTS "Authenticated users can read reviews" ON public.reviews;
CREATE POLICY "Authenticated users can read reviews" ON public.reviews FOR SELECT
TO authenticated
USING (true);

-- 3. RPC Function: submit_review
-- Submits a 1-5 star review + comment on a completed agreement within 14 days.
-- Recalculates recipient ratings in the same transaction.
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
    v_target_avg_col TEXT;
    v_target_cnt_col TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Validate input rating and comment
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    -- Lock agreement row
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    -- 14-day window check
    IF now() > (v_agreement.updated_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    -- Check participation & determine role
    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- Check if caller already reviewed this agreement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE agreement_id = p_agreement_id AND reviewer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this agreement.';
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        rating,
        comment
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        p_rating,
        trim(p_comment)
    )
    RETURNING id INTO v_review_id;

    -- Recalculate recipient rating in the same transaction
    IF v_reviewer_role = 'client' THEN
        -- Client reviewed freelancer -> update freelancer rating
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND role = 'client';

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            rating_avg = coalesce(v_new_rating_avg, 0.00),
            rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        -- Freelancer reviewed client -> update client rating
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND role = 'freelancer';

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            rating_avg = coalesce(v_new_rating_avg, 0.00),
            rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'rating', p_rating,
            'role', v_reviewer_role
        )
    );

    RETURN v_review_id;
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000008_reports_and_messages.sql
-- ==============================================================================
-- Migration: 20261011000008_reports_and_messages.sql
-- Milestone 8: Reports and Messages
-- Strictly adheres to docs/GIGORMOC_SPEC.md sections 5, 8, 9, 10 and AGENTS.md

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE UNIQUE,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_freelancer_id ON public.conversations(freelancer_id);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 3. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('profile', 'gig', 'agreement', 'message')),
    target_id UUID NOT NULL,
    reason_category TEXT NOT NULL CHECK (reason_category IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other')),
    details TEXT NOT NULL CHECK (char_length(trim(details)) BETWEEN 10 AND 2000),
    evidence_path TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    resolution_notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 4. Enable Supabase Realtime for messages table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- publication doesn't exist if realtime is not initialized
END $$;

-- 5. Set up private reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false,
    10485760, -- 10MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ];

-- 6. Enable RLS on conversations, messages, and reports
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from public and authenticated (mutations go through RPC functions)
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reports FROM public, authenticated;

-- RLS: conversations
DROP POLICY IF EXISTS "Participants read conversations" ON public.conversations;
CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT
TO authenticated
USING (
    client_id = auth.uid()
    OR freelancer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- RLS: messages
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (
            c.client_id = auth.uid()
            OR c.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

-- RLS: reports
DROP POLICY IF EXISTS "Reporter reads own reports" ON public.reports;
CREATE POLICY "Reporter reads own reports" ON public.reports FOR SELECT
TO authenticated
USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- RLS: reports storage bucket
DROP POLICY IF EXISTS "User upload report evidence" ON storage.objects;
CREATE POLICY "User upload report evidence" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Admins and reporter read report evidence" ON storage.objects;
CREATE POLICY "Admins and reporter read report evidence" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'reports'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
    )
);

-- 7. RPC Function: get_or_create_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    p_application_id UUID DEFAULT NULL,
    p_agreement_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_app RECORD;
    v_conv_id UUID;
    v_target_app_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    v_target_app_id := p_application_id;

    -- If agreement_id is provided, resolve the accepted application
    IF v_target_app_id IS NULL AND p_agreement_id IS NOT NULL THEN
        SELECT a.id INTO v_target_app_id
        FROM public.applications a
        JOIN public.agreements agr ON agr.gig_id = a.gig_id AND agr.freelancer_id = a.freelancer_id
        WHERE agr.id = p_agreement_id
        LIMIT 1;

        -- Fallback if not found: find by gig_id
        IF v_target_app_id IS NULL THEN
            SELECT a.id INTO v_target_app_id
            FROM public.applications a
            JOIN public.agreements agr ON agr.gig_id = a.gig_id
            WHERE agr.id = p_agreement_id
            LIMIT 1;
        END IF;
    END IF;

    IF v_target_app_id IS NULL THEN
        RAISE EXCEPTION 'Could not resolve application for conversation.';
    END IF;

    -- Fetch application and gig client
    SELECT a.*, g.client_id AS gig_client_id
    INTO v_app
    FROM public.applications a
    JOIN public.gigs g ON g.id = a.gig_id
    WHERE a.id = v_target_app_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    -- Caller must be client or freelancer
    IF v_caller_id <> v_app.freelancer_id AND v_caller_id <> v_app.gig_client_id THEN
        RAISE EXCEPTION 'Only application participants can access this conversation.';
    END IF;

    -- Look up existing conversation
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE application_id = v_target_app_id;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    -- Create new conversation atomically
    INSERT INTO public.conversations (
        application_id,
        client_id,
        freelancer_id
    ) VALUES (
        v_target_app_id,
        v_app.gig_client_id,
        v_app.freelancer_id
    )
    ON CONFLICT (application_id) DO NOTHING
    RETURNING id INTO v_conv_id;

    IF v_conv_id IS NULL THEN
        SELECT id INTO v_conv_id
        FROM public.conversations
        WHERE application_id = v_target_app_id;
    END IF;

    RETURN v_conv_id;
END;
$$;

-- 8. RPC Function: send_message
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recent_count INTEGER;
    v_msg_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_content IS NULL OR char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 2000 THEN
        RAISE EXCEPTION 'Message must be between 1 and 2000 characters.';
    END IF;

    -- Verify conversation participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.';
    END IF;

    -- Rate limit check: max 30 messages in 10 minutes
    SELECT count(*) INTO v_recent_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at > now() - INTERVAL '10 minutes';

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Message rate limit exceeded. Please wait a few moments before sending more messages.';
    END IF;

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content
    ) VALUES (
        p_conversation_id,
        v_caller_id,
        trim(p_content)
    )
    RETURNING id INTO v_msg_id;

    -- Update conversation updated_at
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;

    RETURN v_msg_id;
END;
$$;

-- 9. RPC Function: submit_report
CREATE OR REPLACE FUNCTION public.submit_report(
    p_target_type TEXT,
    p_target_id UUID,
    p_reason_category TEXT,
    p_details TEXT,
    p_evidence_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_recent_reports_count INTEGER;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_target_type NOT IN ('profile', 'gig', 'agreement', 'message') THEN
        RAISE EXCEPTION 'Invalid report target type.';
    END IF;

    IF p_reason_category NOT IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other') THEN
        RAISE EXCEPTION 'Invalid reason category.';
    END IF;

    IF p_details IS NULL OR char_length(trim(p_details)) < 10 OR char_length(trim(p_details)) > 2000 THEN
        RAISE EXCEPTION 'Report details must be between 10 and 2000 characters.';
    END IF;

    -- Rate limit check: max 5 reports per hour
    SELECT count(*) INTO v_recent_reports_count
    FROM public.reports
    WHERE reporter_id = v_caller_id
      AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_reports_count >= 5 THEN
        RAISE EXCEPTION 'Report limit reached (maximum 5 reports per hour).';
    END IF;

    INSERT INTO public.reports (
        reporter_id,
        target_type,
        target_id,
        reason_category,
        details,
        evidence_path
    ) VALUES (
        v_caller_id,
        p_target_type,
        p_target_id,
        p_reason_category,
        trim(p_details),
        p_evidence_path
    )
    RETURNING id INTO v_report_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'report_submitted',
        v_caller_id,
        v_report_id,
        'reports',
        jsonb_build_object(
            'target_type', p_target_type,
            'target_id', p_target_id,
            'reason_category', p_reason_category
        )
    );

    RETURN v_report_id;
END;
$$;

-- 10. RPC Function: cancel_agreement
-- Before any milestone is submitted, either party may cancel freely.
-- After work starts, cancelling creates a report for manual review and sets status to 'disputed'.
CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_has_submitted_work BOOLEAN;
    v_result_status TEXT;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a reason for cancelling this agreement.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can initiate cancellation.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be cancelled or disputed.';
    END IF;

    -- Check if any milestone has been submitted or approved
    SELECT EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) INTO v_has_submitted_work;

    IF NOT v_has_submitted_work THEN
        -- Work has not started yet -> Free cancellation
        UPDATE public.agreements
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_agreement_id;

        -- Cancel gig
        UPDATE public.gigs
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = v_agreement.gig_id;

        v_result_status := 'cancelled';

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'agreement_cancelled_freely',
            v_caller_id,
            p_agreement_id,
            'agreements',
            jsonb_build_object('reason', trim(p_reason))
        );
    ELSE
        -- Work already started -> Flag as disputed and log a report for manual review
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = p_agreement_id;

        INSERT INTO public.reports (
            reporter_id,
            target_type,
            target_id,
            reason_category,
            details
        ) VALUES (
            v_caller_id,
            'agreement',
            p_agreement_id,
            'cancellation_request',
            'Agreement cancellation requested after deliverables started: ' || trim(p_reason)
        )
        RETURNING id INTO v_report_id;

        v_result_status := 'disputed';

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'agreement_cancelled_disputed',
            v_caller_id,
            p_agreement_id,
            'agreements',
            jsonb_build_object(
                'reason', trim(p_reason),
                'report_id', v_report_id
            )
        );
    END IF;

    RETURN v_result_status;
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000009_v3_hardening_and_retrofit.sql
-- ==============================================================================
-- Migration: 20261011000009_v3_hardening_and_retrofit.sql
-- Blueprint V3 Retrofit & Hardening Fixes
-- Covers R2, R3, and Milestone 9 database hardening requirements.

-- 1. Align agreements: add completed_at
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill completed_at for existing completed agreements
UPDATE public.agreements
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- 2. Align reviews table: add reviewee_role, hidden flag, hidden_at, hidden_by
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewee_role TEXT CHECK (reviewee_role IN ('freelancer', 'client')),
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Backfill reviewee_role if null
UPDATE public.reviews
SET reviewee_role = CASE WHEN role = 'client' THEN 'freelancer' ELSE 'client' END
WHERE reviewee_role IS NULL;

-- Update RLS on reviews: authenticated read only non-hidden reviews; admins read all
DROP POLICY IF EXISTS "Authenticated users can read active reviews" ON public.reviews;
CREATE POLICY "Authenticated users can read active reviews" ON public.reviews FOR SELECT
TO authenticated
USING (
  hidden = false
  OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- 3. Update complete_agreement RPC function to record completed_at atomically
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_unapproved_count INTEGER;
    v_total_confirmed BIGINT := 0;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_milestone_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    -- Caller must be participant or admin
    IF v_agreement.client_id <> v_caller_id
       AND v_agreement.freelancer_id <> v_caller_id
       AND NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller_id)
    THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        RETURN; -- idempotent
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    -- Check milestones: must have at least 1 milestone, and all must be approved
    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    -- Check payment disputes
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    -- Check pending payment reports
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    -- Check total confirmed payments vs agreed price
    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    -- Complete agreement with atomic completed_at timestamp
    UPDATE public.agreements
    SET status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    WHERE id = p_agreement_id;

    -- Update gig status to completed
    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    -- Increment participant stats
    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );
END;
$$;

-- 4. Update submit_review RPC function
-- Uses completed_at + 14 days, sets reviewee_role, and recomputes ratings strictly from hidden = false
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Validate input rating and comment
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    -- Lock agreement row
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    -- 14-day window check measured strictly from completed_at
    IF v_agreement.completed_at IS NOT NULL AND now() > (v_agreement.completed_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    -- Check participation & determine roles
    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_role := 'freelancer';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_role := 'client';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- Check if caller already reviewed this agreement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE agreement_id = p_agreement_id AND reviewer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this agreement.';
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        reviewee_role,
        rating,
        comment,
        hidden
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        v_reviewee_role,
        p_rating,
        trim(p_comment),
        false
    )
    RETURNING id INTO v_review_id;

    -- Recalculate recipient rating strictly from non-hidden reviews
    IF v_reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'rating', p_rating,
            'reviewer_role', v_reviewer_role,
            'reviewee_role', v_reviewee_role
        )
    );

    RETURN v_review_id;
END;
$$;

-- 5. RPC Function: admin_hide_review
-- Admin can hide an abusive review and recompute recipient ratings atomically
CREATE OR REPLACE FUNCTION public.admin_hide_review(
    p_review_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_review RECORD;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Must be admin
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller_id) THEN
        RAISE EXCEPTION 'Only platform administrators can hide reviews.';
    END IF;

    SELECT * INTO v_review
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.';
    END IF;

    IF v_review.hidden THEN
        RETURN; -- already hidden
    END IF;

    -- Hide review
    UPDATE public.reviews
    SET hidden = true,
        hidden_at = now(),
        hidden_by = v_caller_id
    WHERE id = p_review_id;

    -- Recompute recipient per-role rating
    IF v_review.reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_review.reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_review.reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_review.reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_review.reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'admin_hide_review',
        v_caller_id,
        p_review_id,
        'reviews',
        jsonb_build_object(
            'reviewee_id', v_review.reviewee_id,
            'reason', trim(p_reason)
        )
    );
END;
$$;

-- 6. Update switch_mode to read real reports table for unresolved reports
CREATE OR REPLACE FUNCTION public.get_mode_switch_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_cooldown_days integer := 7;
  v_remaining_days integer := 0;
  v_can_switch boolean := true;
  v_blockers text[] := ARRAY[]::text[];
  v_active_agreements_count integer := 0;
  v_disputed_agreements_count integer := 0;
  v_pending_payments_count integer := 0;
  v_unresolved_reports_count integer := 0;
  v_pending_gigs_count integer := 0;
  v_pending_apps_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'Account is suspended or deactivated.');
  END IF;

  IF v_profile.mode_changed_at IS NOT NULL THEN
    IF now() < (v_profile.mode_changed_at + (v_cooldown_days || ' days')::interval) THEN
      v_remaining_days := CEIL(EXTRACT(EPOCH FROM ((v_profile.mode_changed_at + (v_cooldown_days || ' days')::interval) - now())) / 86400)::integer;
      v_can_switch := false;
      v_blockers := array_append(v_blockers, 'Mode switch cooldown is active (' || v_remaining_days || ' day(s) remaining).');
    END IF;
  END IF;

  SELECT count(*) INTO v_active_agreements_count
  FROM public.agreements
  WHERE (client_id = v_user_id OR freelancer_id = v_user_id) AND status = 'active';

  IF v_active_agreements_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_active_agreements_count || ' active agreement(s). Complete or cancel them first.');
  END IF;

  SELECT count(*) INTO v_disputed_agreements_count
  FROM public.agreements
  WHERE (client_id = v_user_id OR freelancer_id = v_user_id) AND status = 'disputed';

  IF v_disputed_agreements_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_disputed_agreements_count || ' disputed agreement(s).');
  END IF;

  SELECT count(*) INTO v_pending_payments_count
  FROM public.payments
  WHERE (payer_id = v_user_id OR payee_id = v_user_id) AND status IN ('reported_sent', 'disputed');

  IF v_pending_payments_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_pending_payments_count || ' pending or disputed payment(s).');
  END IF;

  -- Read unresolved reports filed against the user from public.reports
  SELECT count(*) INTO v_unresolved_reports_count
  FROM public.reports
  WHERE target_id = v_user_id AND status = 'pending';

  IF v_unresolved_reports_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_unresolved_reports_count || ' unresolved report(s) under review.');
  END IF;

  IF v_profile.active_mode = 'hire' THEN
    SELECT count(*) INTO v_pending_gigs_count
    FROM public.gigs WHERE client_id = v_user_id AND status IN ('open', 'draft');
  ELSIF v_profile.active_mode = 'find_work' THEN
    SELECT count(*) INTO v_pending_apps_count
    FROM public.applications WHERE freelancer_id = v_user_id AND status IN ('applied', 'countered');
  END IF;

  RETURN jsonb_build_object(
    'current_mode', v_profile.active_mode,
    'can_switch', v_can_switch,
    'cooldown_remaining_days', v_remaining_days,
    'blockers', to_jsonb(v_blockers),
    'pending_gigs_count', v_pending_gigs_count,
    'pending_apps_count', v_pending_apps_count
  );
END;
$$;

-- 7. Revoke execution from public/anon and grant to authenticated on all protected functions
REVOKE EXECUTE ON FUNCTION public.choose_initial_mode FROM public, anon;
GRANT EXECUTE ON FUNCTION public.choose_initial_mode TO authenticated;

REVOKE EXECUTE ON FUNCTION public.switch_mode FROM public, anon;
GRANT EXECUTE ON FUNCTION public.switch_mode TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_mode_switch_status FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mode_switch_status TO authenticated;

REVOKE EXECUTE ON FUNCTION public.publish_gig FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_application FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_application TO authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_to_application FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application TO authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_to_counter FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter TO authenticated;

REVOKE EXECUTE ON FUNCTION public.define_milestones FROM public, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_milestone FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_milestone FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone TO authenticated;

REVOKE EXECUTE ON FUNCTION public.report_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispute_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_agreement FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_review FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_review TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_hide_review FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_hide_review TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_message FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_report FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_report TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_agreement FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000010_fix_mode_switch.sql
-- ==============================================================================
-- Fix: protected profile columns were silently reverted even when changed by trusted
-- SECURITY DEFINER functions (choose_initial_mode, switch_mode, submit_review, payments, ...)
-- because the integrity trigger only let platform admins through.
-- Fix: trusted functions run as the function owner, so only direct API writes
-- (roles authenticated / anon) are reverted.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- SECURITY INVOKER on purpose: current_user is 'authenticated'/'anon' for direct API writes
-- and the function owner when a SECURITY DEFINER function does the update.
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_platform_admin() THEN
    NEW.active_mode := OLD.active_mode;
    NEW.mode_changed_at := OLD.mode_changed_at;
    NEW.freelancer_rating_avg := OLD.freelancer_rating_avg;
    NEW.freelancer_rating_count := OLD.freelancer_rating_count;
    NEW.client_rating_avg := OLD.client_rating_avg;
    NEW.client_rating_count := OLD.client_rating_count;
    NEW.freelancer_completed_gigs := OLD.freelancer_completed_gigs;
    NEW.client_completed_gigs := OLD.client_completed_gigs;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.completed_gigs := OLD.completed_gigs;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

-- The first mode choice must NOT start the 7-day cooldown (spec section 3A).
CREATE OR REPLACE FUNCTION public.choose_initial_mode(target_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_current_mode text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF target_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'Invalid mode. Must be find_work or hire.';
  END IF;

  SELECT active_mode INTO v_current_mode
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_current_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Initial mode has already been chosen. Use switch_mode instead.';
  END IF;

  UPDATE public.profiles
  SET active_mode = target_mode
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'choose_initial_mode', 'profiles', v_user_id, jsonb_build_object('mode', target_mode));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.choose_initial_mode(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.choose_initial_mode(text) TO authenticated;

-- Existing users who only made their first choice (never switched) should not be in cooldown.
UPDATE public.profiles p
SET mode_changed_at = NULL
WHERE p.mode_changed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_events a
    WHERE a.actor_id = p.id AND a.action = 'switch_mode'
  );


-- ==============================================================================
-- MIGRATION: 20261011000010_own_content_rule.sql
-- ==============================================================================
-- Migration: 20261011000010_own_content_rule.sql
-- Retrofit R4: Own-Content Rule Audit & Enforcement
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md section 3B, and docs/ROLE_UX.md section 4.

-- 1. Table constraint: An agreement can never have client_id = freelancer_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_agreements_different_parties'
    ) THEN
        ALTER TABLE public.agreements
        ADD CONSTRAINT chk_agreements_different_parties
        CHECK (client_id <> freelancer_id);
    END IF;
END $$;

-- 2. Update submit_review: Explicit check rejecting self-reviews
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Validate input rating and comment
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    -- Lock agreement row
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    -- 14-day window check measured strictly from completed_at
    IF v_agreement.completed_at IS NOT NULL AND now() > (v_agreement.completed_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    -- Check participation & determine roles
    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_role := 'freelancer';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_role := 'client';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- Own-content rule: Cannot review yourself
    IF v_caller_id = v_reviewee_id THEN
        RAISE EXCEPTION 'You cannot review yourself.';
    END IF;

    -- Check if caller already reviewed this agreement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE agreement_id = p_agreement_id AND reviewer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this agreement.';
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        reviewee_role,
        rating,
        comment,
        hidden
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        v_reviewee_role,
        p_rating,
        trim(p_comment),
        false
    )
    RETURNING id INTO v_review_id;

    -- Recalculate recipient rating strictly from non-hidden reviews
    IF v_reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'reviewee_role', v_reviewee_role,
            'rating', p_rating
        )
    );

    RETURN v_review_id;
END;
$$;

-- 3. Update submit_report: Reject reporting own content / self
CREATE OR REPLACE FUNCTION public.submit_report(
    p_target_type TEXT,
    p_target_id UUID,
    p_reason_category TEXT,
    p_details TEXT,
    p_evidence_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_recent_reports_count INTEGER;
    v_report_id UUID;
    v_owner_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_target_type NOT IN ('profile', 'gig', 'agreement', 'message') THEN
        RAISE EXCEPTION 'Invalid report target type.';
    END IF;

    IF p_reason_category NOT IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other') THEN
        RAISE EXCEPTION 'Invalid reason category.';
    END IF;

    IF p_details IS NULL OR char_length(trim(p_details)) < 10 OR char_length(trim(p_details)) > 2000 THEN
        RAISE EXCEPTION 'Report details must be between 10 and 2000 characters.';
    END IF;

    -- Own-content rule enforcement: Cannot report own profile, own gig, own message
    IF p_target_type = 'profile' THEN
        IF p_target_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own profile.';
        END IF;
    ELSIF p_target_type = 'gig' THEN
        SELECT client_id INTO v_owner_id FROM public.gigs WHERE id = p_target_id;
        IF v_owner_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own gig.';
        END IF;
    ELSIF p_target_type = 'message' THEN
        SELECT sender_id INTO v_owner_id FROM public.messages WHERE id = p_target_id;
        IF v_owner_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own message.';
        END IF;
    END IF;

    -- Rate limit check: max 5 reports per hour
    SELECT count(*) INTO v_recent_reports_count
    FROM public.reports
    WHERE reporter_id = v_caller_id
      AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_reports_count >= 5 THEN
        RAISE EXCEPTION 'Report limit reached (maximum 5 reports per hour).';
    END IF;

    INSERT INTO public.reports (
        reporter_id,
        target_type,
        target_id,
        reason_category,
        details,
        evidence_path
    ) VALUES (
        v_caller_id,
        p_target_type,
        p_target_id,
        p_reason_category,
        trim(p_details),
        p_evidence_path
    )
    RETURNING id INTO v_report_id;

    -- Record audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'report_submitted',
        v_caller_id,
        v_report_id,
        'reports',
        jsonb_build_object(
            'target_type', p_target_type,
            'target_id', p_target_id,
            'reason_category', p_reason_category
        )
    );

    RETURN v_report_id;
END;
$$;

-- 4. Database RPC: get_available_gigs (Enforces own-content exclusion in database)
-- Freelancers can never be shown their own gigs as available work
CREATE OR REPLACE FUNCTION public.get_available_gigs(
    p_category_id UUID DEFAULT NULL,
    p_work_type TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    title TEXT,
    price_min INTEGER,
    price_max INTEGER,
    work_type TEXT,
    area TEXT,
    application_deadline TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    status TEXT,
    created_at TIMESTAMPTZ,
    category_name TEXT,
    client_display_name TEXT,
    client_rating_avg NUMERIC(3,2),
    client_rating_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();

    RETURN QUERY
    SELECT 
        g.id,
        g.client_id,
        g.title,
        g.price_min,
        g.price_max,
        g.work_type,
        g.area,
        g.application_deadline,
        g.deadline,
        g.status,
        g.created_at,
        c.name AS category_name,
        p.display_name AS client_display_name,
        p.client_rating_avg,
        p.client_rating_count
    FROM public.gigs g
    JOIN public.categories c ON c.id = g.category_id
    JOIN public.profiles p ON p.id = g.client_id
    WHERE g.status = 'open'
      AND g.application_deadline > now()
      -- Own-content rule: caller's own gigs are strictly excluded
      AND (v_caller_id IS NULL OR g.client_id <> v_caller_id)
      AND (p_category_id IS NULL OR g.category_id = p_category_id)
      AND (p_work_type IS NULL OR g.work_type = p_work_type)
      AND (
          p_search IS NULL OR
          p_search = '' OR
          g.title ILIKE '%' || p_search || '%' OR
          g.description ILIKE '%' || p_search || '%' OR
          g.area ILIKE '%' || p_search || '%'
      )
    ORDER BY g.created_at DESC;
END;
$$;

-- 5. Revoke execute on new/updated functions from anon and public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_report(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_available_gigs(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_gigs(UUID, TEXT, TEXT) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000011_notifications.sql
-- ==============================================================================
-- Migration: 20261011000011_notifications.sql
-- Milestone 11: Real In-App Notifications
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md, and docs/REAL_LOGIC_V5.md section 3

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT DEFAULT NULL,
    entity_id UUID DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries and unread counting
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Recipient can select own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Direct client writes are revoked (creation only via internal notify helper, updates via RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated, PUBLIC;

-- 2. Add notifications to Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- 3. Internal helper: notify()
-- Created inside public schema, SECURITY DEFINER, search_path fixed to public, auth, pg_temp
-- Revoked from all external callers (callable only by other DB functions)
DROP FUNCTION IF EXISTS public.notify(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB);
CREATE OR REPLACE FUNCTION public.notify(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_notification_id UUID;
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();

    -- Rule: Never notify the actor about their own action
    IF v_actor_id IS NOT NULL AND p_user_id = v_actor_id THEN
        RETURN NULL;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        data
    ) VALUES (
        p_user_id,
        p_type,
        trim(p_title),
        trim(p_body),
        p_entity_type,
        p_entity_id,
        coalesce(p_data, '{}'::jsonb)
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- Revoke execute on notify() from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.notify(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- 4. RPCs for reading / dismissing notifications
DROP FUNCTION IF EXISTS public.mark_notification_read(UUID);
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE public.notifications
    SET read_at = coalesce(read_at, now())
    WHERE id = p_id AND user_id = v_caller_id;

    RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_all_notifications_read();
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_updated_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = v_caller_id AND read_at IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- 5. Re-create lifecycle RPCs to emit real notifications
-- A. submit_application -> notifies client (application_received)
DROP FUNCTION IF EXISTS public.submit_application(uuid, integer, integer, text);
CREATE OR REPLACE FUNCTION public.submit_application(
  p_gig_id uuid,
  p_proposed_price integer,
  p_estimated_days integer,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_has_skill boolean;
  v_email_confirmed boolean;
  v_recent_app_count integer;
  v_app_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
    RAISE EXCEPTION 'Proposed price must be greater than zero.';
  END IF;
  IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Estimated days must be greater than zero.';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Application message is required.';
  END IF;

  SELECT count(*) INTO v_recent_app_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'submit_application'
    AND created_at > (now() - interval '1 hour');

  IF v_recent_app_count >= 10 THEN
    RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own gig.';
  END IF;

  IF v_gig.status <> 'open' THEN
    RAISE EXCEPTION 'Gig is not open for applications.';
  END IF;

  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'The application deadline for this gig has passed.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.active_mode <> 'find_work' THEN
    RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
    RAISE EXCEPTION 'You must upload a profile photo before applying for gigs.';
  END IF;

  SELECT email_confirmed_at IS NOT NULL INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT coalesce(v_email_confirmed, false) THEN
    RAISE EXCEPTION 'You must confirm your email before applying for gigs.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
  ) INTO v_has_skill;

  IF NOT v_has_skill THEN
    RAISE EXCEPTION 'You must have at least one skill added to your profile before applying.';
  END IF;

  INSERT INTO public.applications (
    gig_id,
    freelancer_id,
    proposed_price,
    estimated_days,
    message
  ) VALUES (
    p_gig_id,
    v_user_id,
    p_proposed_price,
    p_estimated_days,
    trim(p_message)
  )
  RETURNING id INTO v_app_id;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'submit_application');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'submit_application',
    'applications',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id, 'proposed_price', p_proposed_price)
  );

  -- Real Notification to gig client
  PERFORM public.notify(
    v_gig.client_id,
    'application_received',
    'New Application Received',
    coalesce(v_profile.display_name, 'A freelancer') || ' applied to your gig "' || v_gig.title || '".',
    'application',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id)
  );

  RETURN v_app_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) TO authenticated;

-- B. respond_to_application -> notifies freelancer
DROP FUNCTION IF EXISTS public.respond_to_application(uuid, text, integer);
CREATE OR REPLACE FUNCTION public.respond_to_application(
  p_application_id uuid,
  p_action text,
  p_counter_price integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
  v_other_app record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'Invalid response action. Must be accept, decline, or counter.';
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.status <> 'applied' THEN
    RAISE EXCEPTION 'Application is not in applied state (current: %).', v_app.status;
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig client can respond to this application.';
  END IF;

  IF p_action = 'counter' THEN
    IF p_counter_price IS NULL OR p_counter_price <= 0 THEN
      RAISE EXCEPTION 'Counter price must be greater than zero.';
    END IF;

    UPDATE public.applications
    SET status = 'countered',
        counter_price = p_counter_price,
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'counter_application', 'applications', p_application_id, jsonb_build_object('counter_price', p_counter_price));

    -- Real Notification: application_countered
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_countered',
      'Counteroffer Received',
      'The client countered your proposal on "' || v_gig.title || '".',
      'application',
      p_application_id,
      jsonb_build_object('counter_price', p_counter_price, 'gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'decline' THEN
    UPDATE public.applications
    SET status = 'declined',
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'decline_application', 'applications', p_application_id, '{}'::jsonb);

    -- Real Notification: application_declined
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_declined',
      'Application Update',
      'Your application for "' || v_gig.title || '" was not accepted.',
      'application',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    IF v_gig.status <> 'open' THEN
      RAISE EXCEPTION 'Gig is not open (current: %). Cannot accept application.', v_gig.status;
    END IF;

    UPDATE public.applications
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline
    ) VALUES (
      v_gig.id,
      v_gig.client_id,
      v_app.freelancer_id,
      v_app.proposed_price,
      v_gig.deadline
    )
    RETURNING id INTO v_agreement_id;

    UPDATE public.gigs
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = v_gig.id;

    FOR v_other_app IN
      SELECT id, freelancer_id FROM public.applications
      WHERE gig_id = v_gig.id
        AND id <> p_application_id
        AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_other_app.id;

      -- Notify other applicants
      PERFORM public.notify(
        v_other_app.freelancer_id,
        'application_declined',
        'Gig Filled',
        'Another proposal was selected for "' || v_gig.title || '".',
        'application',
        v_other_app.id,
        jsonb_build_object('gig_id', v_gig.id)
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_application',
      'agreements',
      v_agreement_id,
      jsonb_build_object('application_id', p_application_id, 'agreed_price', v_app.proposed_price)
    );

    -- Notify accepted freelancer
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_accepted',
      'Proposal Accepted!',
      'Congratulations! Your proposal for "' || v_gig.title || '" was accepted.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify both that agreement is created
    PERFORM public.notify(
      v_user_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN v_agreement_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_application(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application(uuid, text, integer) TO authenticated;

-- C. define_milestones -> notifies freelancer
DROP FUNCTION IF EXISTS public.define_milestones(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_total_amount INTEGER := 0;
    v_elem JSONB;
    v_pos INTEGER := 1;
    v_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can define milestones.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be defined for active agreements.';
    END IF;

    SELECT count(*) INTO v_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'Milestones have already been defined for this agreement.';
    END IF;

    IF jsonb_array_length(p_milestones) < 1 OR jsonb_array_length(p_milestones) > 5 THEN
        RAISE EXCEPTION 'Agreement must have between 1 and 5 milestones.';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        IF (v_elem->>'title') IS NULL OR char_length(trim(v_elem->>'title')) < 3 THEN
            RAISE EXCEPTION 'Each milestone must have a title of at least 3 characters.';
        END IF;
        IF (v_elem->>'amount') IS NULL OR (v_elem->>'amount')::integer <= 0 THEN
            RAISE EXCEPTION 'Milestone amount must be greater than zero.';
        END IF;
        v_total_amount := v_total_amount + (v_elem->>'amount')::integer;
    END LOOP;

    IF v_total_amount <> v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Sum of milestone amounts (%) must exactly equal agreed price (%).',
            v_total_amount, v_agreement.agreed_price;
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        INSERT INTO public.milestones (
            agreement_id,
            title,
            description,
            amount,
            position,
            status
        ) VALUES (
            p_agreement_id,
            trim(v_elem->>'title'),
            coalesce(trim(v_elem->>'description'), ''),
            (v_elem->>'amount')::integer,
            v_pos,
            'pending'
        );
        v_pos := v_pos + 1;
    END LOOP;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestones_defined',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object('count', jsonb_array_length(p_milestones), 'total_amount', v_total_amount)
    );

    -- Notify other party
    IF v_caller_id = v_agreement.client_id THEN
      PERFORM public.notify(
        v_agreement.freelancer_id,
        'milestones_defined',
        'Milestones Defined',
        'Milestones have been defined for your active agreement.',
        'agreement',
        p_agreement_id
      );
    ELSE
      PERFORM public.notify(
        v_agreement.client_id,
        'milestones_defined',
        'Milestones Defined',
        'Milestones have been defined for your active agreement.',
        'agreement',
        p_agreement_id
      );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) TO authenticated;

-- D. submit_milestone -> notifies client (milestone_submitted)
DROP FUNCTION IF EXISTS public.submit_milestone(UUID, TEXT, TEXT[]);
CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_message TEXT,
    p_file_paths TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
    v_submission_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_message IS NULL OR char_length(trim(p_message)) < 5 THEN
        RAISE EXCEPTION 'Submission text must be at least 5 characters.';
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the assigned freelancer can submit work for this milestone.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be submitted for active agreements.';
    END IF;

    IF v_milestone.status NOT IN ('pending', 'revision_requested') THEN
        RAISE EXCEPTION 'Milestone cannot be submitted in its current status (%).', v_milestone.status;
    END IF;

    INSERT INTO public.submissions (
        milestone_id,
        freelancer_id,
        notes,
        file_paths
    ) VALUES (
        p_milestone_id,
        v_caller_id,
        trim(p_message),
        coalesce(p_file_paths, ARRAY[]::TEXT[])
    )
    RETURNING id INTO v_submission_id;

    UPDATE public.milestones
    SET status = 'submitted',
        updated_at = now()
    WHERE id = p_milestone_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestone_submitted',
        v_caller_id,
        v_submission_id,
        'submissions',
        jsonb_build_object('milestone_id', p_milestone_id, 'agreement_id', v_agreement.id)
    );

    -- Notify client
    PERFORM public.notify(
      v_agreement.client_id,
      'milestone_submitted',
      'Milestone Submitted',
      'Work has been submitted for milestone "' || v_milestone.title || '".',
      'agreement',
      v_agreement.id,
      jsonb_build_object('milestone_id', p_milestone_id)
    );

    RETURN v_submission_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) TO authenticated;

-- E. review_milestone -> notifies freelancer (milestone_approved or revision_requested)
DROP FUNCTION IF EXISTS public.review_milestone(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id UUID,
    p_action TEXT,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('approve', 'request_revision') THEN
        RAISE EXCEPTION 'Action must be either "approve" or "request_revision".';
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can review milestone submissions.';
    END IF;

    IF v_milestone.status <> 'submitted' THEN
        RAISE EXCEPTION 'Only submitted milestones can be reviewed.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.milestones
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_approved',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id)
        );

        -- Notify freelancer
        PERFORM public.notify(
          v_agreement.freelancer_id,
          'milestone_approved',
          'Milestone Approved!',
          'Your milestone "' || v_milestone.title || '" has been approved by the client.',
          'agreement',
          v_agreement.id,
          jsonb_build_object('milestone_id', p_milestone_id)
        );

    ELSIF p_action = 'request_revision' THEN
        IF p_feedback IS NULL OR char_length(trim(p_feedback)) < 5 THEN
            RAISE EXCEPTION 'Feedback of at least 5 characters is required when requesting a revision.';
        END IF;

        IF v_milestone.revision_count >= 2 THEN
            RAISE EXCEPTION 'Maximum revisions limit (2) reached for this milestone. Please contact support or resolve via payment.';
        END IF;

        UPDATE public.milestones
        SET status = 'revision_requested',
            revision_count = revision_count + 1,
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_revision_requested',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id, 'revision_count', v_milestone.revision_count + 1)
        );

        -- Notify freelancer
        PERFORM public.notify(
          v_agreement.freelancer_id,
          'milestone_revision_requested',
          'Revision Requested',
          'The client requested a revision for "' || v_milestone.title || '".',
          'agreement',
          v_agreement.id,
          jsonb_build_object('milestone_id', p_milestone_id, 'feedback', trim(p_feedback))
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) TO authenticated;

-- F. report_payment -> notifies freelancer (payment_reported)
DROP FUNCTION IF EXISTS public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.report_payment(UUID, TEXT, INTEGER, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id UUID,
    p_milestone_id UUID DEFAULT NULL,
    p_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'gcash',
    p_reference_number TEXT DEFAULT '',
    p_receipt_path TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_payment_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    IF p_reference_number IS NULL OR char_length(trim(p_reference_number)) < 3 THEN
        RAISE EXCEPTION 'A valid transaction reference number is required.';
    END IF;

    IF p_payment_method NOT IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can report external payments.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Payments can only be reported for active agreements.';
    END IF;

    -- Validate milestone if provided
    IF p_milestone_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.milestones
            WHERE id = p_milestone_id AND agreement_id = p_agreement_id
        ) THEN
            RAISE EXCEPTION 'Milestone does not belong to this agreement.';
        END IF;
    END IF;

    INSERT INTO public.payments (
        agreement_id,
        milestone_id,
        payer_id,
        payee_id,
        amount,
        payment_method,
        reference_number,
        receipt_path,
        notes,
        status,
        reported_at
    ) VALUES (
        p_agreement_id,
        p_milestone_id,
        v_caller_id,
        v_agreement.freelancer_id,
        p_amount,
        p_payment_method,
        coalesce(trim(p_reference_number), ''),
        p_receipt_path,
        coalesce(trim(p_notes), ''),
        'reported_sent',
        now()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_reported',
        v_caller_id,
        v_payment_id,
        'payments',
        jsonb_build_object('agreement_id', p_agreement_id, 'amount', p_amount, 'method', p_payment_method)
    );

    -- Notify freelancer
    PERFORM public.notify(
      v_agreement.freelancer_id,
      'payment_reported',
      'Payment Reported',
      'Client reported an external payment of ₱' || (p_amount / 100)::text || '. Please confirm once received.',
      'agreement',
      p_agreement_id,
      jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount)
    );

    RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- G. confirm_payment & dispute_payment -> notifies client
DROP FUNCTION IF EXISTS public.confirm_payment(UUID);
DROP FUNCTION IF EXISTS public.confirm_payment(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can confirm payment receipt.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RETURN; -- idempotent
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id;

    UPDATE public.payments
    SET status = 'confirmed_received',
        confirmed_at = now(),
        disputed_at = NULL,
        dispute_reason = NULL,
        updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_confirmed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'amount', v_payment.amount)
    );

    -- Notify client
    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
          v_agreement.client_id,
          'payment_confirmed',
          'Payment Confirmed',
          'Freelancer confirmed receipt of external payment (₱' || (v_payment.amount / 100)::text || ').',
          'agreement',
          v_payment.agreement_id,
          jsonb_build_object('payment_id', p_payment_id)
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.dispute_payment(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.dispute_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear reason of at least 5 characters is required to dispute a payment.';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can dispute payment reports.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RAISE EXCEPTION 'Cannot dispute a payment that was already confirmed.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id;

    UPDATE public.payments
    SET status = 'disputed',
        dispute_reason = trim(p_reason),
        disputed_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;

    IF v_agreement IS NOT NULL THEN
        UPDATE public.agreements
        SET status = 'in_dispute',
            updated_at = now()
        WHERE id = v_agreement.id;
    END IF;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_disputed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'reason', trim(p_reason))
    );

    -- Notify client
    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
          v_agreement.client_id,
          'payment_disputed',
          'Payment Disputed',
          'Freelancer disputed payment: ' || trim(p_reason),
          'agreement',
          v_payment.agreement_id,
          jsonb_build_object('payment_id', p_payment_id)
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) TO authenticated;

-- H. complete_agreement -> notifies both parties (agreement_completed)
DROP FUNCTION IF EXISTS public.complete_agreement(UUID);
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_milestone_count INTEGER;
    v_unapproved_count INTEGER;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_total_confirmed INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        RETURN;
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    UPDATE public.agreements
    SET status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    WHERE id = p_agreement_id;

    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );

    -- Notify both parties
    PERFORM public.notify(
      v_agreement.client_id,
      'agreement_completed',
      'Agreement Completed',
      'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
      'agreement',
      p_agreement_id
    );

    PERFORM public.notify(
      v_agreement.freelancer_id,
      'agreement_completed',
      'Agreement Completed',
      'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
      'agreement',
      p_agreement_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_agreement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement(UUID) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000012_real_messaging.sql
-- ==============================================================================
-- Migration: 20261011000012_real_messaging.sql
-- Milestone 12: Real Messaging with conversation_reads, unread tracking, and new_message notification
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md, and docs/REAL_LOGIC_V5.md section 4

-- 1. Create conversation_reads table to track unread messages per user
CREATE TABLE IF NOT EXISTS public.conversation_reads (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user ON public.conversation_reads(user_id);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversation reads" ON public.conversation_reads;
CREATE POLICY "Users can manage own conversation reads" ON public.conversation_reads
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 2. RPC to mark a conversation read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Verify participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only participants can mark conversation as read.';
    END IF;

    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

-- 3. Update send_message RPC to:
--    - Verify participation and suspend check
--    - Prevent messaging oneself
--    - Update updated_at on conversation
--    - Mark conversation read for sender
--    - Emit / update collapsed new_message notification for recipient
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recipient_id UUID;
    v_sender_profile RECORD;
    v_recent_count INTEGER;
    v_msg_id UUID;
    v_preview TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Load sender profile and verify active status
    SELECT * INTO v_sender_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_sender_profile.status = 'suspended' THEN
        RAISE EXCEPTION 'Suspended accounts cannot send messages.';
    END IF;

    IF p_content IS NULL OR char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 2000 THEN
        RAISE EXCEPTION 'Message must be between 1 and 2000 characters.';
    END IF;

    -- Verify conversation participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.';
    END IF;

    -- Determine recipient
    IF v_conv.client_id = v_caller_id THEN
        v_recipient_id := v_conv.freelancer_id;
    ELSE
        v_recipient_id := v_conv.client_id;
    END IF;

    -- Own-content rule
    IF v_recipient_id = v_caller_id THEN
        RAISE EXCEPTION 'Cannot converse with yourself.';
    END IF;

    -- Rate limit check: max 30 messages per 1 minute
    SELECT count(*) INTO v_recent_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at > (now() - interval '1 minute');

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Message rate limit exceeded (max 30 messages per minute).';
    END IF;

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content
    ) VALUES (
        p_conversation_id,
        v_caller_id,
        trim(p_content)
    )
    RETURNING id INTO v_msg_id;

    -- Update conversation updated_at
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;

    -- Mark conversation read for the sender
    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = now();

    -- Notify recipient with collapsed message notification
    v_preview := substring(trim(p_content) from 1 for 100);
    IF char_length(trim(p_content)) > 100 THEN
        v_preview := v_preview || '...';
    END IF;

    PERFORM public.notify(
        v_recipient_id,
        'new_message',
        'New Message from ' || coalesce(v_sender_profile.display_name, 'User'),
        v_preview,
        'conversation',
        p_conversation_id,
        jsonb_build_object('conversation_id', p_conversation_id, 'sender_id', v_caller_id)
    );

    RETURN v_msg_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;

-- 4. Update submit_application to automatically create conversation in the database
CREATE OR REPLACE FUNCTION public.submit_application(
  p_gig_id uuid,
  p_proposed_price integer,
  p_estimated_days integer,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_has_skill boolean;
  v_email_confirmed boolean;
  v_recent_app_count integer;
  v_app_id uuid;
  v_conv_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
    RAISE EXCEPTION 'Proposed price must be greater than zero.';
  END IF;
  IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Estimated days must be greater than zero.';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Application message is required.';
  END IF;

  SELECT count(*) INTO v_recent_app_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'submit_application'
    AND created_at > (now() - interval '1 hour');

  IF v_recent_app_count >= 10 THEN
    RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own gig.';
  END IF;

  IF v_gig.status <> 'open' THEN
    RAISE EXCEPTION 'Gig is not open for applications.';
  END IF;

  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'The application deadline for this gig has passed.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.active_mode <> 'find_work' THEN
    RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
    RAISE EXCEPTION 'You must upload a profile photo before applying for gigs.';
  END IF;

  SELECT email_confirmed_at IS NOT NULL INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT coalesce(v_email_confirmed, false) THEN
    RAISE EXCEPTION 'You must confirm your email before applying for gigs.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
  ) INTO v_has_skill;

  IF NOT v_has_skill THEN
    RAISE EXCEPTION 'You must have at least one skill added to your profile before applying.';
  END IF;

  -- Create application row
  INSERT INTO public.applications (
    gig_id,
    freelancer_id,
    proposed_price,
    estimated_days,
    message
  ) VALUES (
    p_gig_id,
    v_user_id,
    p_proposed_price,
    p_estimated_days,
    trim(p_message)
  )
  RETURNING id INTO v_app_id;

  -- Automatically create conversation in the database
  INSERT INTO public.conversations (
    application_id,
    client_id,
    freelancer_id
  ) VALUES (
    v_app_id,
    v_gig.client_id,
    v_user_id
  )
  ON CONFLICT (application_id) DO NOTHING
  RETURNING id INTO v_conv_id;

  -- Insert initial proposal pitch as first message
  IF v_conv_id IS NOT NULL THEN
    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      content
    ) VALUES (
      v_conv_id,
      v_user_id,
      trim(p_message)
    );
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'submit_application');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'submit_application',
    'applications',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id, 'proposed_price', p_proposed_price)
  );

  -- Real notification to client
  PERFORM public.notify(
    v_gig.client_id,
    'application_received',
    'New Application Received',
    coalesce(v_profile.display_name, 'A freelancer') || ' applied to your gig "' || v_gig.title || '".',
    'application',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id)
  );

  RETURN v_app_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) TO authenticated;

-- 5. RPC to fetch user conversations with latest message, unread status, and partner details
CREATE OR REPLACE FUNCTION public.get_user_conversations()
RETURNS TABLE (
    id UUID,
    application_id UUID,
    gig_id UUID,
    gig_title TEXT,
    partner_id UUID,
    partner_name TEXT,
    partner_avatar TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMPTZ,
    last_message_sender_id UUID,
    is_unread BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT 
        c.id,
        c.application_id,
        g.id AS gig_id,
        g.title AS gig_title,
        CASE WHEN c.client_id = v_caller_id THEN f.id ELSE cl.id END AS partner_id,
        CASE WHEN c.client_id = v_caller_id THEN f.display_name ELSE cl.display_name END AS partner_name,
        CASE WHEN c.client_id = v_caller_id THEN f.avatar_path ELSE cl.avatar_path END AS partner_avatar,
        m.content AS last_message_content,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id,
        CASE 
            WHEN m.id IS NULL THEN false
            WHEN m.sender_id = v_caller_id THEN false
            WHEN cr.last_read_at IS NULL THEN true
            WHEN cr.last_read_at < m.created_at THEN true
            ELSE false
        END AS is_unread,
        c.updated_at
    FROM public.conversations c
    JOIN public.applications a ON a.id = c.application_id
    JOIN public.gigs g ON g.id = a.gig_id
    JOIN public.profiles cl ON cl.id = c.client_id
    JOIN public.profiles f ON f.id = c.freelancer_id
    LEFT JOIN LATERAL (
        SELECT msg.id, msg.content, msg.created_at, msg.sender_id
        FROM public.messages msg
        WHERE msg.conversation_id = c.id
        ORDER BY msg.created_at DESC
        LIMIT 1
    ) m ON true
    LEFT JOIN public.conversation_reads cr 
        ON cr.conversation_id = c.id AND cr.user_id = v_caller_id
    WHERE c.client_id = v_caller_id OR c.freelancer_id = v_caller_id
    ORDER BY coalesce(m.created_at, c.updated_at) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_conversations() TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000013_real_post_gig.sql
-- ==============================================================================
-- Migration: 20261011000013_real_post_gig.sql
-- Milestone 13: Post gig (real)
-- Strictly adheres to docs/REAL_LOGIC_V5.md section 6, docs/MILESTONES.md, and AGENTS.md

-- 1. Redefine public.publish_gig(p_gig_id uuid) with full real SQL-level validation:
-- - Idempotent double-tap: if already 'open', exit cleanly without error
-- - Title length: 5 to 80 characters (trimmed)
-- - Description length: 30 to 2000 characters (trimmed)
-- - Minimum budget: >= 10000 centavos (₱100.00 PHP)
-- - Price ceiling: price_max >= price_min
-- - Category: must reference an active row in public.categories
-- - Mode gate: caller's active_mode must be 'hire'
-- - Account status: active, non-empty display_name, email confirmed, age 18+
-- - Deadlines: application_deadline > now(), deadline >= application_deadline

CREATE OR REPLACE FUNCTION public.publish_gig(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_email_confirmed boolean;
  v_category_valid boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig owner can publish this gig.';
  END IF;

  -- Idempotent check for double-tap publish
  IF v_gig.status = 'open' THEN
    RETURN;
  END IF;

  IF v_gig.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft gigs can be published.';
  END IF;

  -- Lock profile row and check user gates
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- Mode gate: must be in hire mode
  IF v_profile.active_mode <> 'hire' THEN
    RAISE EXCEPTION 'You must be in Hire Someone mode to publish a gig.';
  END IF;

  -- Account status check
  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Display name check
  IF v_profile.display_name IS NULL OR trim(v_profile.display_name) = '' THEN
    RAISE EXCEPTION 'You must set a display name before publishing a gig.';
  END IF;

  -- Email confirmation check from auth.users
  SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'You must confirm your email address before publishing a gig.';
  END IF;

  -- SQL-level field validation (parity with app validation per V5 section 6)
  -- 1. Title length: 5 to 80 chars
  IF char_length(trim(v_gig.title)) < 5 OR char_length(trim(v_gig.title)) > 80 THEN
    RAISE EXCEPTION 'Gig title must be between 5 and 80 characters.';
  END IF;

  -- 2. Description length: 30 to 2000 chars
  IF char_length(trim(v_gig.description)) < 30 OR char_length(trim(v_gig.description)) > 2000 THEN
    RAISE EXCEPTION 'Gig description must be between 30 and 2000 characters.';
  END IF;

  -- 3. Minimum budget: at least 10,000 centavos (₱100.00 PHP)
  IF v_gig.price_min < 10000 THEN
    RAISE EXCEPTION 'Minimum budget must be at least ₱100.00 (10000 centavos).';
  END IF;

  -- 4. Price max >= price min
  IF v_gig.price_max < v_gig.price_min THEN
    RAISE EXCEPTION 'Maximum budget cannot be less than minimum budget.';
  END IF;

  -- 5. Category must exist and be active
  SELECT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = v_gig.category_id AND is_active = true
  ) INTO v_category_valid;

  IF NOT v_category_valid THEN
    RAISE EXCEPTION 'Invalid or inactive category.';
  END IF;

  -- 6. Deadlines
  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'Application deadline must be in the future.';
  END IF;

  IF v_gig.deadline < v_gig.application_deadline THEN
    RAISE EXCEPTION 'Project completion deadline must be on or after the application deadline.';
  END IF;

  -- Atomically publish gig
  UPDATE public.gigs
  SET status = 'open',
      updated_at = now()
  WHERE id = p_gig_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'publish_gig', 'gigs', p_gig_id, jsonb_build_object('title', v_gig.title));
END;
$$;

-- 2. Define cancel_gig(p_gig_id uuid, p_reason text) RPC
-- Owner cancels gig with reason; sets status = 'cancelled'; notifies all pending applicants
CREATE OR REPLACE FUNCTION public.cancel_gig(
  p_gig_id uuid,
  p_reason text DEFAULT 'Cancelled by client'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_gig record;
  v_applicant record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Reason length validation
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 OR char_length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Cancellation reason must be between 3 and 500 characters.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig owner can cancel this gig.';
  END IF;

  IF v_gig.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Only draft or open gigs can be cancelled. Active gigs with agreements must use cancel_agreement.';
  END IF;

  -- Update gig status to cancelled
  UPDATE public.gigs
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_gig_id;

  -- If gig was open, decline pending applications and notify applicants
  IF v_gig.status = 'open' THEN
    FOR v_applicant IN
      SELECT id, freelancer_id
      FROM public.applications
      WHERE gig_id = p_gig_id AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_applicant.id;

      PERFORM public.notify(
        v_applicant.freelancer_id,
        'gig_cancelled',
        'Gig Cancelled',
        'The gig "' || v_gig.title || '" has been cancelled by the client. Reason: ' || trim(p_reason),
        'gig',
        p_gig_id,
        jsonb_build_object('gig_id', p_gig_id, 'reason', trim(p_reason))
      );
    END LOOP;
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'cancel_gig',
    'gigs',
    p_gig_id,
    jsonb_build_object('title', v_gig.title, 'reason', trim(p_reason))
  );
END;
$$;

-- 3. Security grants: deny anon/public, grant authenticated
REVOKE EXECUTE ON FUNCTION public.publish_gig(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_gig(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gig(uuid, text) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000014_ai_onboarding.sql
-- ==============================================================================
-- Migration: 20261011000014_ai_onboarding.sql
-- Milestone 14: AI in Onboarding (Skills, Bio & Edge Function Backing)
-- Strictly adheres to docs/REAL_LOGIC_V5.md sections 1, 2, and 5 and AGENTS.md

-- 0. Ensure updated_at exists on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 1. Alter skills table to support user-originated custom skills
-- Add source column ('admin' or 'user') and created_by reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.skills 
      ADD COLUMN source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.skills 
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Relax category_id nullability for user-suggested custom skills (categorized by admin later)
  ALTER TABLE public.skills ALTER COLUMN category_id DROP NOT NULL;
END $$;

-- Add unique case-insensitive index on skills(lower(trim(name)))
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON public.skills (lower(trim(name)));

-- Update RLS on skills:
-- Authenticated users can view active skills OR pending user skills created by themselves
DROP POLICY IF EXISTS "Authenticated users can view active or own skills" ON public.skills;
CREATE POLICY "Authenticated users can view active or own skills" ON public.skills
  FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid());

-- Direct client write operations on skills remain denied (RPC-only via add_profile_skills)
REVOKE INSERT, UPDATE, DELETE ON public.skills FROM anon, authenticated, PUBLIC;

-- 2. Create areas reference table
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active areas" ON public.areas;
CREATE POLICY "Authenticated users can view active areas" ON public.areas
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Direct client modifications denied on areas
REVOKE INSERT, UPDATE, DELETE ON public.areas FROM anon, authenticated, PUBLIC;

-- 3. RPC: add_profile_skills(p_skill_ids uuid[], p_custom_names text[])
-- Adds verified catalog skills and/or creates custom user skills (is_active = false)
-- Links them into profile_skills for the authenticated caller
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
CREATE OR REPLACE FUNCTION public.add_profile_skills(
  p_skill_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_custom_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  out_skill_id uuid,
  out_skill_name text,
  out_is_active boolean,
  out_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_skill_id uuid;
  v_custom_name text;
  v_trimmed text;
  v_current_skills_count integer;
  v_new_skills_count integer;
  v_existing_skill_id uuid;
  v_recent_calls integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Verify active profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Rate limit check: max 15 add_profile_skills calls per hour
  SELECT count(*) INTO v_recent_calls
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'add_profile_skills'
    AND created_at > now() - interval '1 hour';

  IF v_recent_calls >= 15 THEN
    RAISE EXCEPTION 'Rate limit exceeded for adding skills. Please try again later.';
  END IF;

  -- Validate maximum custom skills per single call
  IF array_length(p_custom_names, 1) > 10 THEN
    RAISE EXCEPTION 'You may add at most 10 custom skills per request.';
  END IF;

  -- Check current skill count on profile
  SELECT count(*) INTO v_current_skills_count
  FROM public.profile_skills
  WHERE profile_id = v_user_id;

  -- 1. Process existing catalog skill IDs
  IF p_skill_ids IS NOT NULL AND array_length(p_skill_ids, 1) > 0 THEN
    FOREACH v_skill_id IN ARRAY p_skill_ids
    LOOP
      IF v_skill_id IS NOT NULL THEN
        -- Check if skill exists and is visible to caller
        IF EXISTS (
          SELECT 1 FROM public.skills
          WHERE id = v_skill_id AND (is_active = true OR created_by = v_user_id)
        ) THEN
          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Process custom skill names
  IF p_custom_names IS NOT NULL AND array_length(p_custom_names, 1) > 0 THEN
    FOREACH v_custom_name IN ARRAY p_custom_names
    LOOP
      v_trimmed := trim(v_custom_name);
      IF v_trimmed IS NOT NULL AND v_trimmed <> '' THEN
        IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 40 THEN
          RAISE EXCEPTION 'Custom skill name must be between 2 and 40 characters: %', v_trimmed;
        END IF;

        -- Check profile skills ceiling (max 15 skills per profile)
        SELECT count(*) INTO v_current_skills_count
        FROM public.profile_skills
        WHERE profile_id = v_user_id;

        IF v_current_skills_count >= 15 THEN
          RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
        END IF;

        -- Check if skill already exists (case-insensitive)
        SELECT s.id INTO v_existing_skill_id
        FROM public.skills s
        WHERE lower(trim(s.name)) = lower(v_trimmed);

        IF v_existing_skill_id IS NOT NULL THEN
          -- Link existing skill
          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        ELSE
          -- Create user skill (is_active = false, pending admin review)
          INSERT INTO public.skills (name, source, is_active, created_by)
          VALUES (v_trimmed, 'user', false, v_user_id)
          RETURNING id INTO v_existing_skill_id;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Record rate limit and audit events
  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'add_profile_skills');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'add_profile_skills',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'catalog_ids_count', coalesce(array_length(p_skill_ids, 1), 0),
      'custom_names_count', coalesce(array_length(p_custom_names, 1), 0)
    )
  );

  -- Return updated caller profile skills
  RETURN QUERY
  SELECT 
    s.id AS out_skill_id,
    s.name AS out_skill_name,
    s.is_active AS out_is_active,
    s.source AS out_source
  FROM public.profile_skills ps
  JOIN public.skills s ON s.id = ps.skill_id
  WHERE ps.profile_id = v_user_id
  ORDER BY s.name;
END;
$$;

-- 4. RPC: complete_onboarding()
-- Verifies mode chosen and marks onboarding_complete = true atomically
DROP FUNCTION IF EXISTS public.complete_onboarding CASCADE;
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.active_mode IS NULL OR v_profile.active_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'You must select an initial role mode (Find Work or Hire Someone) before completing onboarding.';
  END IF;

  UPDATE public.profiles
  SET onboarding_complete = true,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'complete_onboarding',
    'profiles',
    v_user_id,
    jsonb_build_object('active_mode', v_profile.active_mode)
  );
END;
$$;

-- 5. Revoke execute on new functions from anon and public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000015_real_loop.sql
-- ==============================================================================
-- Migration: 20261011000015_real_loop.sql
-- Milestone 15: Complete Real Loop Hardening
-- Strictly adheres to docs/REAL_LOGIC_V5.md sections 0 and 8, docs/GIGORMOC_SPEC.md, and AGENTS.md

-- 1. Fix public.respond_to_counter:
--    - Correct inverted column-to-value assignments for public.agreements
--    - Enforce own-content rule (client_id <> freelancer_id)
--    - Set gig status = 'in_progress' and decline remaining proposals
--    - Emit proper notifications:
--      * When accepted: notify client (counter_accepted), notify both (agreement_created), decline others
--      * When declined / withdrawn: notify client (counter_declined)

DROP FUNCTION IF EXISTS public.respond_to_counter(uuid, text);
CREATE OR REPLACE FUNCTION public.respond_to_counter(
  p_application_id uuid,
  p_action text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
  v_other_app record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'withdraw') THEN
    RAISE EXCEPTION 'Invalid counter response. Must be accept, decline, or withdraw.';
  END IF;

  -- Lock application
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.freelancer_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the applicant freelancer can respond to this counteroffer.';
  END IF;

  IF v_app.status <> 'countered' THEN
    RAISE EXCEPTION 'Application is not in countered status (current: %).', v_app.status;
  END IF;

  -- Lock gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF p_action IN ('decline', 'withdraw') THEN
    UPDATE public.applications
    SET status = p_action,
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      p_action || '_counter',
      'applications',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify client that counteroffer was declined/withdrawn
    PERFORM public.notify(
      v_gig.client_id,
      'counter_declined',
      'Counteroffer Declined',
      'Freelancer declined the counteroffer for "' || v_gig.title || '".',
      'application',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    IF v_gig.status <> 'open' THEN
      RAISE EXCEPTION 'Gig is not open (current: %). An active agreement may already exist.', v_gig.status;
    END IF;

    -- Check if active agreement already exists
    IF EXISTS (
      SELECT 1 FROM public.agreements
      WHERE gig_id = v_gig.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active agreement already exists for this gig.';
    END IF;

    -- Own content check: client and freelancer must be distinct
    IF v_gig.client_id = v_user_id THEN
      RAISE EXCEPTION 'Client and freelancer cannot be the same person.';
    END IF;

    UPDATE public.applications
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_application_id;

    -- Create agreement: client_id = v_gig.client_id, freelancer_id = v_user_id
    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline,
      status
    )
    VALUES (
      v_gig.id,
      v_gig.client_id,
      v_user_id,
      v_app.counter_price,
      v_gig.deadline,
      'active'
    )
    RETURNING id INTO v_agreement_id;

    -- Update gig status
    UPDATE public.gigs
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = v_gig.id;

    -- Decline all other pending applications for this gig
    FOR v_other_app IN
      SELECT id, freelancer_id FROM public.applications
      WHERE gig_id = v_gig.id
        AND id <> p_application_id
        AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_other_app.id;

      PERFORM public.notify(
        v_other_app.freelancer_id,
        'application_declined',
        'Gig Filled',
        'Another proposal was accepted for "' || v_gig.title || '".',
        'application',
        v_other_app.id,
        jsonb_build_object('gig_id', v_gig.id)
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_counter',
      'agreements',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id, 'price', v_app.counter_price)
    );

    -- Notify client that counter was accepted
    PERFORM public.notify(
      v_gig.client_id,
      'counter_accepted',
      'Counteroffer Accepted!',
      'Freelancer accepted your counteroffer for "' || v_gig.title || '". Agreement is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify both parties: agreement_created
    PERFORM public.notify(
      v_gig.client_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    PERFORM public.notify(
      v_user_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN v_agreement_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_counter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter(uuid, text) TO authenticated;

-- 2. Update public.cancel_agreement to emit agreement_cancelled notification
DROP FUNCTION IF EXISTS public.cancel_agreement(uuid, text);
CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_gig RECORD;
    v_other_party_id UUID;
    v_has_submitted_work BOOLEAN;
    v_result_status TEXT;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a reason of at least 5 characters for cancelling this agreement.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can initiate cancellation.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be cancelled or disputed (current: %).', v_agreement.status;
    END IF;

    -- Determine the other party to notify
    IF v_agreement.client_id = v_caller_id THEN
      v_other_party_id := v_agreement.freelancer_id;
    ELSE
      v_other_party_id := v_agreement.client_id;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_agreement.gig_id;

    -- Check if any milestone has been submitted or approved
    SELECT EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) INTO v_has_submitted_work;

    IF NOT v_has_submitted_work THEN
        -- Work has not started yet -> Free cancellation
        UPDATE public.agreements
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_agreement_id;

        -- Cancel gig
        UPDATE public.gigs
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = v_agreement.gig_id;

        v_result_status := 'cancelled';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_freely',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason))
        );

        -- Notify the other party
        PERFORM public.notify(
          v_other_party_id,
          'agreement_cancelled',
          'Agreement Cancelled',
          'The agreement for "' || coalesce(v_gig.title, 'gig') || '" has been cancelled. Reason: ' || trim(p_reason),
          'agreement',
          p_agreement_id,
          jsonb_build_object('reason', trim(p_reason))
        );

    ELSE
        -- Work already started -> Flag as disputed and log a report for manual review
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = p_agreement_id;

        INSERT INTO public.reports (
            reporter_id,
            target_type,
            target_id,
            reason_category,
            details
        ) VALUES (
            v_caller_id,
            'agreement',
            p_agreement_id,
            'cancellation_request',
            'Agreement cancellation requested after deliverables started: ' || trim(p_reason)
        )
        RETURNING id INTO v_report_id;

        v_result_status := 'disputed';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_disputed',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id)
        );

        -- Notify other party that cancellation was requested and dispute opened
        PERFORM public.notify(
          v_other_party_id,
          'agreement_disputed',
          'Agreement Cancellation Disputed',
          'A cancellation request was filed after work started. A dispute report has been opened for moderation review.',
          'agreement',
          p_agreement_id,
          jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id)
        );
    END IF;

    RETURN v_result_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_agreement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(uuid, text) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000016_profile_completeness_and_details.sql
-- ==============================================================================
-- Migration: 20261011000016_profile_completeness_and_details.sql
-- Milestone 16: Duplicate email safety net, richer profile details, DB-computed profile completeness, and avatar management
-- Strictly adheres to AGENTS.md and docs/PROFILE_AND_LOOP_V5_1.md sections 5 and 6. No seed data.

-- 1. Database safety net for account creation (Section 6)
-- Ensure handle_new_user normalizes email metadata and remains strictly idempotent (one auth user -> at most one profile & one profile_private)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_dob_str text;
  v_dob date;
  v_age integer;
  v_display_name text;
  v_terms_version text;
BEGIN
  v_dob_str := NEW.raw_user_meta_data->>'dob';
  v_display_name := trim(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  v_terms_version := COALESCE(NEW.raw_user_meta_data->>'terms_version', 'v1.0');

  IF v_dob_str IS NULL OR trim(v_dob_str) = '' THEN
    RAISE EXCEPTION 'Date of birth is required.';
  END IF;

  BEGIN
    v_dob := v_dob_str::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid date of birth format. Expected YYYY-MM-DD.';
  END;

  v_age := date_part('year', age(current_date, v_dob));
  IF v_age < 18 THEN
    RAISE EXCEPTION 'Users must be at least 18 years old to register.';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profile_private (user_id, dob, terms_version, terms_accepted_at)
  VALUES (NEW.id, v_dob, v_terms_version, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Expand public.profiles with richer details (Section 5.2 & Section 3)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_contact text NOT NULL DEFAULT 'In-app chat',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS work_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS availability text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS experience_years text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS starting_rate_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_hiring text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_headline_len_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_headline_len_chk CHECK (char_length(headline) <= 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_availability_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_availability_chk CHECK (
        availability IS NULL OR availability IN ('available_now', 'part_time', 'weekends', 'not_taking_work')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_experience_years_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_experience_years_chk CHECK (
        experience_years IS NULL OR experience_years IN ('lt_1', '1_3', '3_5', '5_plus')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_client_type_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_client_type_chk CHECK (
        client_type IS NULL OR client_type IN ('individual', 'business', 'organization')
      );
  END IF;
END $$;

-- 3. Create profile_hiring_interests table (used by client completeness checklist & hiring details)
CREATE TABLE IF NOT EXISTS public.profile_hiring_interests (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, category_id)
);

ALTER TABLE public.profile_hiring_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view hiring interests" ON public.profile_hiring_interests;
CREATE POLICY "Authenticated users can view hiring interests" ON public.profile_hiring_interests
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.profile_hiring_interests FROM anon, authenticated, PUBLIC;

-- 4. Ensure avatars bucket has 5MB limit and jpeg/png/webp mime types (Section 5.3)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Ensure profile_complete notification can only be emitted ONCE per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_profile_complete_once
  ON public.notifications (user_id)
  WHERE type = 'profile_complete';

-- 6. RPC: get_profile_completeness(p_profile_id uuid)
-- Computes completeness in SQL (never trusted from client).
-- Emits 'profile_complete' notification once when the owner's profile reaches 100%.
DROP FUNCTION IF EXISTS public.get_profile_completeness(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_completeness(
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile record;
  v_role text;
  v_total integer := 0;
  v_done integer := 0;
  v_missing jsonb := '[]'::jsonb;
  v_has_skill boolean := false;
  v_has_interest boolean := false;
  v_has_portfolio boolean := false;
  v_percent integer := 0;
  v_complete boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  v_role := COALESCE(v_profile.active_mode, 'find_work');

  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_items WHERE profile_id = p_profile_id
  ) INTO v_has_portfolio;

  IF v_role = 'hire' THEN
    -- Client checklist (6 items): photo, display_name, bio (>=20), area, client_type, >=1 hiring interest
    v_total := 6;

    -- 1. Photo
    IF v_profile.avatar_path IS NOT NULL AND trim(v_profile.avatar_path) <> '' THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'photo', 'label', 'Add a profile photo')
      );
    END IF;

    -- 2. Display name
    IF char_length(trim(COALESCE(v_profile.display_name, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'display_name', 'label', 'Add your display name')
      );
    END IF;

    -- 3. Bio (>= 20 chars)
    IF char_length(trim(COALESCE(v_profile.bio, ''))) >= 20 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'bio', 'label', 'Write a bio (at least 20 characters)')
      );
    END IF;

    -- 4. Area
    IF char_length(trim(COALESCE(v_profile.area, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'area', 'label', 'Add your barangay or area')
      );
    END IF;

    -- 5. Client type
    IF v_profile.client_type IS NOT NULL AND v_profile.client_type IN ('individual', 'business', 'organization') THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'client_type', 'label', 'Select your client type')
      );
    END IF;

    -- 6. >= 1 Hiring interest
    SELECT EXISTS (
      SELECT 1 FROM public.profile_hiring_interests WHERE profile_id = p_profile_id
    ) INTO v_has_interest;

    IF v_has_interest THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'hiring_interests', 'label', 'Pick at least 1 hiring interest')
      );
    END IF;

  ELSE
    -- Freelancer checklist (7 items): photo, display_name, headline, bio (>=20), area, >=1 skill, work type + availability
    v_total := 7;

    -- 1. Photo
    IF v_profile.avatar_path IS NOT NULL AND trim(v_profile.avatar_path) <> '' THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'photo', 'label', 'Add a profile photo')
      );
    END IF;

    -- 2. Display name
    IF char_length(trim(COALESCE(v_profile.display_name, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'display_name', 'label', 'Add your display name')
      );
    END IF;

    -- 3. Headline
    IF char_length(trim(COALESCE(v_profile.headline, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'headline', 'label', 'Add a short headline')
      );
    END IF;

    -- 4. Bio (>= 20 chars)
    IF char_length(trim(COALESCE(v_profile.bio, ''))) >= 20 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'bio', 'label', 'Write a bio (at least 20 characters)')
      );
    END IF;

    -- 5. Area
    IF char_length(trim(COALESCE(v_profile.area, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'area', 'label', 'Add your barangay or area')
      );
    END IF;

    -- 6. >= 1 Skill
    SELECT EXISTS (
      SELECT 1 FROM public.profile_skills WHERE profile_id = p_profile_id
    ) INTO v_has_skill;

    IF v_has_skill THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'skills', 'label', 'Add at least 1 skill')
      );
    END IF;

    -- 7. Work type & availability
    IF COALESCE(array_length(v_profile.work_types, 1), 0) >= 1 AND v_profile.availability IS NOT NULL THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'work_availability', 'label', 'Set your work types and availability')
      );
    END IF;
  END IF;

  v_percent := round((v_done::numeric / v_total::numeric) * 100)::integer;
  v_complete := (v_done = v_total);

  -- Emit one-time notification 'profile_complete' the first time the profile reaches 100%
  IF v_complete AND auth.uid() = p_profile_id THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      entity_type,
      entity_id,
      data
    ) VALUES (
      p_profile_id,
      'profile_complete',
      'Profile complete',
      'Your profile is now 100% complete.',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_role)
    )
    ON CONFLICT (user_id) WHERE type = 'profile_complete' DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'role', v_role,
    'percent', v_percent,
    'complete', v_complete,
    'missing_items', v_missing,
    'has_portfolio_bonus', v_has_portfolio
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_completeness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_completeness(uuid) TO authenticated;

-- 7. RPC: update_profile_details (Section 5.2)
-- Validates all fields in SQL, saves optional phone ONLY in profile_private, and triggers completeness check.
DROP FUNCTION IF EXISTS public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_profile_details(
  p_display_name text,
  p_headline text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_preferred_contact text DEFAULT NULL,
  p_languages text[] DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_work_types text[] DEFAULT NULL,
  p_availability text DEFAULT NULL,
  p_experience_years text DEFAULT NULL,
  p_starting_rate_note text DEFAULT NULL,
  p_client_type text DEFAULT NULL,
  p_business_name text DEFAULT NULL,
  p_about_hiring text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile public.profiles;
  v_name text;
  v_headline text;
  v_bio text;
  v_area text;
  v_contact text;
  v_phone text;
  v_rate_note text;
  v_biz_name text;
  v_about_hiring text;
  v_lang text;
  v_wt text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Validate display_name (2-50 chars)
  v_name := trim(COALESCE(p_display_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 50 THEN
    RAISE EXCEPTION 'Display name must be between 2 and 50 characters.';
  END IF;

  -- Validate headline (<= 80 chars)
  v_headline := trim(COALESCE(p_headline, v_profile.headline, ''));
  IF char_length(v_headline) > 80 THEN
    RAISE EXCEPTION 'Headline must be 80 characters or fewer.';
  END IF;

  -- Validate bio (empty or 20-500 chars)
  v_bio := trim(COALESCE(p_bio, v_profile.bio, ''));
  IF v_bio <> '' AND (char_length(v_bio) < 20 OR char_length(v_bio) > 500) THEN
    RAISE EXCEPTION 'Bio must be between 20 and 500 characters.';
  END IF;

  -- Validate area (<= 80 chars)
  v_area := trim(COALESCE(p_area, v_profile.area, ''));
  IF char_length(v_area) > 80 THEN
    RAISE EXCEPTION 'Area must be 80 characters or fewer.';
  END IF;

  -- Validate preferred contact note (<= 120 chars)
  v_contact := trim(COALESCE(p_preferred_contact, v_profile.preferred_contact, 'In-app chat'));
  IF char_length(v_contact) > 120 THEN
    RAISE EXCEPTION 'Preferred contact note must be 120 characters or fewer.';
  END IF;

  -- Validate languages
  IF p_languages IS NOT NULL THEN
    FOREACH v_lang IN ARRAY p_languages
    LOOP
      IF v_lang NOT IN ('English', 'Tagalog', 'Bisaya', 'Waray', 'Other') THEN
        RAISE EXCEPTION 'Invalid language selection: %', v_lang;
      END IF;
    END LOOP;
  END IF;

  -- Validate work_types
  IF p_work_types IS NOT NULL THEN
    FOREACH v_wt IN ARRAY p_work_types
    LOOP
      IF v_wt NOT IN ('remote', 'face_to_face', 'hybrid') THEN
        RAISE EXCEPTION 'Invalid work type selection: %', v_wt;
      END IF;
    END LOOP;
  END IF;

  -- Validate availability
  IF p_availability IS NOT NULL AND p_availability <> '' THEN
    IF p_availability NOT IN ('available_now', 'part_time', 'weekends', 'not_taking_work') THEN
      RAISE EXCEPTION 'Invalid availability selection.';
    END IF;
  END IF;

  -- Validate experience_years
  IF p_experience_years IS NOT NULL AND p_experience_years <> '' THEN
    IF p_experience_years NOT IN ('lt_1', '1_3', '3_5', '5_plus') THEN
      RAISE EXCEPTION 'Invalid years of experience selection.';
    END IF;
  END IF;

  -- Validate starting_rate_note (<= 120 chars)
  v_rate_note := trim(COALESCE(p_starting_rate_note, v_profile.starting_rate_note, ''));
  IF char_length(v_rate_note) > 120 THEN
    RAISE EXCEPTION 'Starting rate note must be 120 characters or fewer.';
  END IF;

  -- Validate client_type
  IF p_client_type IS NOT NULL AND p_client_type <> '' THEN
    IF p_client_type NOT IN ('individual', 'business', 'organization') THEN
      RAISE EXCEPTION 'Invalid client type selection.';
    END IF;
  END IF;

  -- Validate business_name (<= 80 chars)
  v_biz_name := trim(COALESCE(p_business_name, v_profile.business_name, ''));
  IF char_length(v_biz_name) > 80 THEN
    RAISE EXCEPTION 'Business name must be 80 characters or fewer.';
  END IF;

  -- Validate about_hiring (<= 300 chars)
  v_about_hiring := trim(COALESCE(p_about_hiring, v_profile.about_hiring, ''));
  IF char_length(v_about_hiring) > 300 THEN
    RAISE EXCEPTION 'About hiring note must be 300 characters or fewer.';
  END IF;

  -- Validate and update optional phone ONLY in profile_private
  IF p_phone IS NOT NULL THEN
    v_phone := trim(p_phone);
    IF v_phone <> '' AND v_phone !~ '^[0-9+() -]{7,20}$' THEN
      RAISE EXCEPTION 'Please enter a valid phone number (7 to 20 digits).';
    END IF;

    UPDATE public.profile_private
    SET phone = NULLIF(v_phone, '')
    WHERE user_id = v_user_id;
  END IF;

  UPDATE public.profiles
  SET display_name = v_name,
      headline = v_headline,
      bio = v_bio,
      area = v_area,
      preferred_contact = CASE WHEN v_contact = '' THEN 'In-app chat' ELSE v_contact END,
      languages = COALESCE(p_languages, v_profile.languages),
      work_types = COALESCE(p_work_types, v_profile.work_types),
      availability = CASE
        WHEN p_availability IS NULL THEN v_profile.availability
        WHEN p_availability = '' THEN NULL
        ELSE p_availability
      END,
      experience_years = CASE
        WHEN p_experience_years IS NULL THEN v_profile.experience_years
        WHEN p_experience_years = '' THEN NULL
        ELSE p_experience_years
      END,
      starting_rate_note = v_rate_note,
      client_type = CASE
        WHEN p_client_type IS NULL THEN v_profile.client_type
        WHEN p_client_type = '' THEN NULL
        ELSE p_client_type
      END,
      business_name = v_biz_name,
      about_hiring = v_about_hiring,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'update_profile_details',
    'profiles',
    v_user_id,
    jsonb_build_object('active_mode', v_profile.active_mode)
  );

  -- Evaluate completeness (emits one-time profile_complete notification if 100%)
  PERFORM public.get_profile_completeness(v_user_id);

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text) TO authenticated;

-- 8. RPC: set_profile_avatar(p_avatar_path text) (Section 5.3)
-- Sets or clears profiles.avatar_path after upload or removal, returns previous avatar_path so client can delete old object.
DROP FUNCTION IF EXISTS public.set_profile_avatar(text);
CREATE OR REPLACE FUNCTION public.set_profile_avatar(
  p_avatar_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_old_path text;
  v_new_path text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT avatar_path INTO v_old_path
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  v_new_path := NULLIF(trim(COALESCE(p_avatar_path, '')), '');

  -- Ensure non-null avatar_path belongs to caller's own folder
  IF v_new_path IS NOT NULL AND position(v_user_id::text || '/' in v_new_path) = 0 THEN
    RAISE EXCEPTION 'Avatar path must be inside your own user folder.';
  END IF;

  UPDATE public.profiles
  SET avatar_path = v_new_path,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    CASE WHEN v_new_path IS NULL THEN 'remove_avatar' ELSE 'update_avatar' END,
    'profiles',
    v_user_id,
    jsonb_build_object('previous_avatar_path', v_old_path, 'new_avatar_path', v_new_path)
  );

  PERFORM public.get_profile_completeness(v_user_id);

  RETURN jsonb_build_object(
    'previous_avatar_path', v_old_path,
    'avatar_path', v_new_path
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_profile_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_avatar(text) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000017_client_hiring_details.sql
-- ==============================================================================
-- Migration: 20261011000017_client_hiring_details.sql
-- Milestone 17: Client Hiring Details (Not Skills)
-- Strictly adheres to AGENTS.md, docs/MILESTONES.md (M17), and docs/PROFILE_AND_LOOP_V5_1.md Section 3.
-- No seed data. All writes go through RLS / SECURITY DEFINER RPCs.

-- 1. Expand profiles_client_type_chk to include 'other' (Individual / Small business / Organization or school / Other)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_client_type_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_client_type_chk CHECK (
    client_type IS NULL OR client_type IN ('individual', 'business', 'organization', 'other')
  );

-- 2. Allow user-created custom categories when the categories table is empty or a client adds a new hiring interest
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_lower_name
  ON public.categories (lower(trim(name)));

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view active or own categories" ON public.categories;
CREATE POLICY "Authenticated users can view active or own categories" ON public.categories
  FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.categories FROM anon, authenticated, PUBLIC;

-- 3. Lock down direct client writes on public.profile_skills so skills can ONLY be mutated via mode-checked RPCs
DROP POLICY IF EXISTS "Users can insert their own profile skills" ON public.profile_skills;
DROP POLICY IF EXISTS "Users can delete their own profile skills" ON public.profile_skills;
DROP POLICY IF EXISTS "Users can manage own profile skills" ON public.profile_skills;
REVOKE INSERT, UPDATE, DELETE ON public.profile_skills FROM anon, authenticated, PUBLIC;

-- 4. Update add_profile_skills to reject callers in 'hire' mode (Skills are strictly for Freelancer mode)
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
CREATE OR REPLACE FUNCTION public.add_profile_skills(
  p_skill_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_custom_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  out_skill_id uuid,
  out_skill_name text,
  out_is_active boolean,
  out_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_iter_skill_id uuid;
  v_custom_name text;
  v_trimmed text;
  v_current_skills_count integer;
  v_existing_skill_id uuid;
  v_recent_calls integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Enforce Freelancer mode: clients in 'hire' mode cannot add skills
  IF COALESCE(v_profile.active_mode, '') <> 'find_work' THEN
    RAISE EXCEPTION 'Skills can only be added in Find Work (Freelancer) mode.';
  END IF;

  SELECT count(*) INTO v_recent_calls
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'add_profile_skills'
    AND created_at > now() - interval '1 hour';

  IF v_recent_calls >= 15 THEN
    RAISE EXCEPTION 'Rate limit exceeded for adding skills. Please try again later.';
  END IF;

  IF array_length(p_custom_names, 1) > 10 THEN
    RAISE EXCEPTION 'You may add at most 10 custom skills per request.';
  END IF;

  SELECT count(*) INTO v_current_skills_count
  FROM public.profile_skills
  WHERE profile_id = v_user_id;

  -- 1. Process existing catalog skill IDs
  IF p_skill_ids IS NOT NULL AND array_length(p_skill_ids, 1) > 0 THEN
    FOREACH v_iter_skill_id IN ARRAY p_skill_ids
    LOOP
      IF v_iter_skill_id IS NOT NULL THEN
        SELECT count(*) INTO v_current_skills_count
        FROM public.profile_skills
        WHERE profile_id = v_user_id;

        IF v_current_skills_count >= 15 AND NOT EXISTS (
          SELECT 1 FROM public.profile_skills
          WHERE profile_id = v_user_id AND skill_id = v_iter_skill_id
        ) THEN
          RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
        END IF;

        IF EXISTS (
          SELECT 1 FROM public.skills s
          WHERE s.id = v_iter_skill_id AND (s.is_active = true OR s.created_by = v_user_id)
        ) THEN
          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_iter_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Process custom skill names
  IF p_custom_names IS NOT NULL AND array_length(p_custom_names, 1) > 0 THEN
    FOREACH v_custom_name IN ARRAY p_custom_names
    LOOP
      v_trimmed := trim(v_custom_name);
      IF v_trimmed IS NOT NULL AND v_trimmed <> '' THEN
        IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 40 THEN
          RAISE EXCEPTION 'Custom skill name must be between 2 and 40 characters: %', v_trimmed;
        END IF;

        SELECT count(*) INTO v_current_skills_count
        FROM public.profile_skills
        WHERE profile_id = v_user_id;

        SELECT s.id INTO v_existing_skill_id
        FROM public.skills s
        WHERE lower(trim(s.name)) = lower(v_trimmed);

        IF v_existing_skill_id IS NOT NULL THEN
          IF v_current_skills_count >= 15 AND NOT EXISTS (
            SELECT 1 FROM public.profile_skills
            WHERE profile_id = v_user_id AND skill_id = v_existing_skill_id
          ) THEN
            RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
          END IF;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        ELSE
          IF v_current_skills_count >= 15 THEN
            RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
          END IF;

          INSERT INTO public.skills (name, source, is_active, created_by)
          VALUES (v_trimmed, 'user', false, v_user_id)
          RETURNING id INTO v_existing_skill_id;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'add_profile_skills');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'add_profile_skills',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'catalog_ids_count', coalesce(array_length(p_skill_ids, 1), 0),
      'custom_names_count', coalesce(array_length(p_custom_names, 1), 0)
    )
  );

  PERFORM public.get_profile_completeness(v_user_id);

  RETURN QUERY
  SELECT
    s.id AS out_skill_id,
    s.name AS out_skill_name,
    s.is_active AS out_is_active,
    s.source AS out_source
  FROM public.profile_skills ps
  JOIN public.skills s ON s.id = ps.skill_id
  WHERE ps.profile_id = v_user_id
  ORDER BY s.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) TO authenticated;

-- 5. RPC: remove_profile_skill(p_skill_id uuid)
-- Allows Freelancer (find_work) to remove a skill from their profile while blocking Hire mode callers.
DROP FUNCTION IF EXISTS public.remove_profile_skill(uuid);
CREATE OR REPLACE FUNCTION public.remove_profile_skill(
  p_skill_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF COALESCE(v_profile.active_mode, '') <> 'find_work' THEN
    RAISE EXCEPTION 'Skills can only be modified in Find Work (Freelancer) mode.';
  END IF;

  DELETE FROM public.profile_skills
  WHERE profile_id = v_user_id AND skill_id = p_skill_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'remove_profile_skill',
    'profiles',
    v_user_id,
    jsonb_build_object('skill_id', p_skill_id)
  );

  PERFORM public.get_profile_completeness(v_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_profile_skill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_profile_skill(uuid) TO authenticated;

-- 6. RPC: save_hiring_details
-- Exclusively for Client ('hire') mode. Saves client_type, business_name (0 or 2-60 chars),
-- about_hiring (0-300 chars), and up to 8 hiring interest categories in profile_hiring_interests.
DROP FUNCTION IF EXISTS public.save_hiring_details(text, text, text, uuid[], text[]);
CREATE OR REPLACE FUNCTION public.save_hiring_details(
  p_client_type text DEFAULT NULL,
  p_business_name text DEFAULT NULL,
  p_about_hiring text DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_custom_category_names text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile public.profiles;
  v_client_type text;
  v_biz_name text;
  v_about text;
  v_cat_id uuid;
  v_custom_name text;
  v_trimmed text;
  v_slug text;
  v_existing_cat_id uuid;
  v_final_cat_ids uuid[] := ARRAY[]::uuid[];
  v_interests jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF COALESCE(v_profile.active_mode, '') <> 'hire' THEN
    RAISE EXCEPTION 'Hiring details can only be saved in Hire Someone (Client) mode.';
  END IF;

  -- Validate client_type
  IF p_client_type IS NULL THEN
    v_client_type := v_profile.client_type;
  ELSIF trim(p_client_type) = '' THEN
    v_client_type := NULL;
  ELSE
    v_client_type := lower(trim(p_client_type));
    IF v_client_type NOT IN ('individual', 'business', 'organization', 'other') THEN
      RAISE EXCEPTION 'Invalid client type selection.';
    END IF;
  END IF;

  -- Validate business_name (optional, 2-60 chars if provided)
  v_biz_name := trim(COALESCE(p_business_name, v_profile.business_name, ''));
  IF v_biz_name <> '' AND (char_length(v_biz_name) < 2 OR char_length(v_biz_name) > 60) THEN
    RAISE EXCEPTION 'Business or organization name must be between 2 and 60 characters.';
  END IF;

  -- Validate about_hiring (optional, 0-300 chars)
  v_about := trim(COALESCE(p_about_hiring, v_profile.about_hiring, ''));
  IF char_length(v_about) > 300 THEN
    RAISE EXCEPTION 'About hiring note must be 300 characters or fewer.';
  END IF;

  -- Update hiring interests if category arrays were passed
  IF p_category_ids IS NOT NULL OR p_custom_category_names IS NOT NULL THEN
    -- 1. Collect valid catalog category IDs
    IF p_category_ids IS NOT NULL AND array_length(p_category_ids, 1) > 0 THEN
      FOREACH v_cat_id IN ARRAY p_category_ids
      LOOP
        IF v_cat_id IS NOT NULL AND NOT (v_cat_id = ANY(v_final_cat_ids)) THEN
          IF EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.id = v_cat_id AND (c.is_active = true OR c.created_by = v_user_id)
          ) THEN
            v_final_cat_ids := array_append(v_final_cat_ids, v_cat_id);
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- 2. Process custom category names (if catalog is empty or user typed a custom category)
    IF p_custom_category_names IS NOT NULL AND array_length(p_custom_category_names, 1) > 0 THEN
      FOREACH v_custom_name IN ARRAY p_custom_category_names
      LOOP
        v_trimmed := trim(COALESCE(v_custom_name, ''));
        IF v_trimmed <> '' THEN
          IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 50 THEN
            RAISE EXCEPTION 'Category name must be between 2 and 50 characters: %', v_trimmed;
          END IF;

          SELECT c.id INTO v_existing_cat_id
          FROM public.categories c
          WHERE lower(trim(c.name)) = lower(v_trimmed)
          LIMIT 1;

          IF v_existing_cat_id IS NULL THEN
            v_slug := regexp_replace(lower(v_trimmed), '[^a-z0-9]+', '-', 'g');
            v_slug := trim(both '-' from v_slug);
            IF v_slug = '' THEN
              v_slug := 'cat';
            END IF;
            v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

            INSERT INTO public.categories (name, slug, is_active, source, created_by)
            VALUES (v_trimmed, v_slug, true, 'user', v_user_id)
            RETURNING id INTO v_existing_cat_id;
          END IF;

          IF v_existing_cat_id IS NOT NULL AND NOT (v_existing_cat_id = ANY(v_final_cat_ids)) THEN
            v_final_cat_ids := array_append(v_final_cat_ids, v_existing_cat_id);
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Enforce max 8 hiring interests per profile
    IF COALESCE(array_length(v_final_cat_ids, 1), 0) > 8 THEN
      RAISE EXCEPTION 'You can select at most 8 hiring interests.';
    END IF;

    -- Replace profile_hiring_interests atomically
    DELETE FROM public.profile_hiring_interests
    WHERE profile_id = v_user_id;

    IF COALESCE(array_length(v_final_cat_ids, 1), 0) > 0 THEN
      FOREACH v_cat_id IN ARRAY v_final_cat_ids
      LOOP
        INSERT INTO public.profile_hiring_interests (profile_id, category_id)
        VALUES (v_user_id, v_cat_id)
        ON CONFLICT (profile_id, category_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.profiles
  SET client_type = v_client_type,
      business_name = v_biz_name,
      about_hiring = v_about,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'save_hiring_details',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'client_type', v_client_type,
      'interests_count', (SELECT count(*) FROM public.profile_hiring_interests WHERE profile_id = v_user_id)
    )
  );

  PERFORM public.get_profile_completeness(v_user_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'is_active', c.is_active
      ) ORDER BY c.name
    ),
    '[]'::jsonb
  ) INTO v_interests
  FROM public.profile_hiring_interests phi
  JOIN public.categories c ON c.id = phi.category_id
  WHERE phi.profile_id = v_user_id;

  RETURN jsonb_build_object(
    'profile_id', v_user_id,
    'client_type', v_profile.client_type,
    'business_name', v_profile.business_name,
    'about_hiring', v_profile.about_hiring,
    'hiring_interests', v_interests
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_hiring_details(text, text, text, uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_hiring_details(text, text, text, uuid[], text[]) TO authenticated;

-- 7. Update get_profile_completeness so 'other' is recognized as a valid client_type
DROP FUNCTION IF EXISTS public.get_profile_completeness(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_completeness(
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile record;
  v_role text;
  v_total integer := 0;
  v_done integer := 0;
  v_missing jsonb := '[]'::jsonb;
  v_has_skill boolean := false;
  v_has_interest boolean := false;
  v_has_portfolio boolean := false;
  v_percent integer := 0;
  v_complete boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  v_role := COALESCE(v_profile.active_mode, 'find_work');

  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_items WHERE profile_id = p_profile_id
  ) INTO v_has_portfolio;

  IF v_role = 'hire' THEN
    -- Client checklist (6 items): photo, display_name, bio (>=20), area, client_type, >=1 hiring interest (never skills)
    v_total := 6;

    -- 1. Photo
    IF v_profile.avatar_path IS NOT NULL AND trim(v_profile.avatar_path) <> '' THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'photo', 'label', 'Add a profile photo')
      );
    END IF;

    -- 2. Display name
    IF char_length(trim(COALESCE(v_profile.display_name, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'display_name', 'label', 'Add your display name')
      );
    END IF;

    -- 3. Bio (>= 20 chars)
    IF char_length(trim(COALESCE(v_profile.bio, ''))) >= 20 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'bio', 'label', 'Write a bio (at least 20 characters)')
      );
    END IF;

    -- 4. Area
    IF char_length(trim(COALESCE(v_profile.area, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'area', 'label', 'Add your barangay or area')
      );
    END IF;

    -- 5. Client type
    IF v_profile.client_type IS NOT NULL AND v_profile.client_type IN ('individual', 'business', 'organization', 'other') THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'client_type', 'label', 'Select your client type')
      );
    END IF;

    -- 6. >= 1 Hiring interest
    SELECT EXISTS (
      SELECT 1 FROM public.profile_hiring_interests WHERE profile_id = p_profile_id
    ) INTO v_has_interest;

    IF v_has_interest THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'hiring_interests', 'label', 'Pick at least 1 hiring interest')
      );
    END IF;

  ELSE
    -- Freelancer checklist (7 items): photo, display_name, headline, bio (>=20), area, >=1 skill, work type + availability
    v_total := 7;

    -- 1. Photo
    IF v_profile.avatar_path IS NOT NULL AND trim(v_profile.avatar_path) <> '' THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'photo', 'label', 'Add a profile photo')
      );
    END IF;

    -- 2. Display name
    IF char_length(trim(COALESCE(v_profile.display_name, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'display_name', 'label', 'Add your display name')
      );
    END IF;

    -- 3. Headline
    IF char_length(trim(COALESCE(v_profile.headline, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'headline', 'label', 'Add a short headline')
      );
    END IF;

    -- 4. Bio (>= 20 chars)
    IF char_length(trim(COALESCE(v_profile.bio, ''))) >= 20 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'bio', 'label', 'Write a bio (at least 20 characters)')
      );
    END IF;

    -- 5. Area
    IF char_length(trim(COALESCE(v_profile.area, ''))) >= 2 THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'area', 'label', 'Add your barangay or area')
      );
    END IF;

    -- 6. >= 1 Skill
    SELECT EXISTS (
      SELECT 1 FROM public.profile_skills WHERE profile_id = p_profile_id
    ) INTO v_has_skill;

    IF v_has_skill THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'skills', 'label', 'Add at least 1 skill')
      );
    END IF;

    -- 7. Work type & availability
    IF COALESCE(array_length(v_profile.work_types, 1), 0) >= 1 AND v_profile.availability IS NOT NULL THEN
      v_done := v_done + 1;
    ELSE
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('key', 'work_availability', 'label', 'Set your work types and availability')
      );
    END IF;
  END IF;

  v_percent := round((v_done::numeric / v_total::numeric) * 100)::integer;
  v_complete := (v_done = v_total);

  IF v_complete AND auth.uid() = p_profile_id THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      entity_type,
      entity_id,
      data
    ) VALUES (
      p_profile_id,
      'profile_complete',
      'Profile complete',
      'Your profile is now 100% complete.',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_role)
    )
    ON CONFLICT (user_id) WHERE type = 'profile_complete' DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'role', v_role,
    'percent', v_percent,
    'complete', v_complete,
    'missing_items', v_missing,
    'has_portfolio_bonus', v_has_portfolio
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_completeness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_completeness(uuid) TO authenticated;

-- 8. Update update_profile_details to support client_type = 'other' and 2-60 char business_name rule
DROP FUNCTION IF EXISTS public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_profile_details(
  p_display_name text,
  p_headline text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_preferred_contact text DEFAULT NULL,
  p_languages text[] DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_work_types text[] DEFAULT NULL,
  p_availability text DEFAULT NULL,
  p_experience_years text DEFAULT NULL,
  p_starting_rate_note text DEFAULT NULL,
  p_client_type text DEFAULT NULL,
  p_business_name text DEFAULT NULL,
  p_about_hiring text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile public.profiles;
  v_name text;
  v_headline text;
  v_bio text;
  v_area text;
  v_contact text;
  v_phone text;
  v_rate_note text;
  v_biz_name text;
  v_about_hiring text;
  v_lang text;
  v_wt text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  v_name := trim(COALESCE(p_display_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 50 THEN
    RAISE EXCEPTION 'Display name must be between 2 and 50 characters.';
  END IF;

  v_headline := trim(COALESCE(p_headline, v_profile.headline, ''));
  IF char_length(v_headline) > 80 THEN
    RAISE EXCEPTION 'Headline must be 80 characters or fewer.';
  END IF;

  v_bio := trim(COALESCE(p_bio, v_profile.bio, ''));
  IF v_bio <> '' AND (char_length(v_bio) < 20 OR char_length(v_bio) > 500) THEN
    RAISE EXCEPTION 'Bio must be between 20 and 500 characters.';
  END IF;

  v_area := trim(COALESCE(p_area, v_profile.area, ''));
  IF char_length(v_area) > 80 THEN
    RAISE EXCEPTION 'Area must be 80 characters or fewer.';
  END IF;

  v_contact := trim(COALESCE(p_preferred_contact, v_profile.preferred_contact, 'In-app chat'));
  IF char_length(v_contact) > 120 THEN
    RAISE EXCEPTION 'Preferred contact note must be 120 characters or fewer.';
  END IF;

  IF p_languages IS NOT NULL THEN
    FOREACH v_lang IN ARRAY p_languages
    LOOP
      IF v_lang NOT IN ('English', 'Tagalog', 'Bisaya', 'Waray', 'Other') THEN
        RAISE EXCEPTION 'Invalid language selection: %', v_lang;
      END IF;
    END LOOP;
  END IF;

  IF p_work_types IS NOT NULL THEN
    FOREACH v_wt IN ARRAY p_work_types
    LOOP
      IF v_wt NOT IN ('remote', 'face_to_face', 'hybrid') THEN
        RAISE EXCEPTION 'Invalid work type selection: %', v_wt;
      END IF;
    END LOOP;
  END IF;

  IF p_availability IS NOT NULL AND p_availability <> '' THEN
    IF p_availability NOT IN ('available_now', 'part_time', 'weekends', 'not_taking_work') THEN
      RAISE EXCEPTION 'Invalid availability selection.';
    END IF;
  END IF;

  IF p_experience_years IS NOT NULL AND p_experience_years <> '' THEN
    IF p_experience_years NOT IN ('lt_1', '1_3', '3_5', '5_plus') THEN
      RAISE EXCEPTION 'Invalid years of experience selection.';
    END IF;
  END IF;

  v_rate_note := trim(COALESCE(p_starting_rate_note, v_profile.starting_rate_note, ''));
  IF char_length(v_rate_note) > 120 THEN
    RAISE EXCEPTION 'Starting rate note must be 120 characters or fewer.';
  END IF;

  IF p_client_type IS NOT NULL AND p_client_type <> '' THEN
    IF p_client_type NOT IN ('individual', 'business', 'organization', 'other') THEN
      RAISE EXCEPTION 'Invalid client type selection.';
    END IF;
  END IF;

  v_biz_name := trim(COALESCE(p_business_name, v_profile.business_name, ''));
  IF v_biz_name <> '' AND (char_length(v_biz_name) < 2 OR char_length(v_biz_name) > 60) THEN
    RAISE EXCEPTION 'Business or organization name must be between 2 and 60 characters.';
  END IF;

  v_about_hiring := trim(COALESCE(p_about_hiring, v_profile.about_hiring, ''));
  IF char_length(v_about_hiring) > 300 THEN
    RAISE EXCEPTION 'About hiring note must be 300 characters or fewer.';
  END IF;

  IF p_phone IS NOT NULL THEN
    v_phone := trim(p_phone);
    IF v_phone <> '' AND v_phone !~ '^[0-9+() -]{7,20}$' THEN
      RAISE EXCEPTION 'Please enter a valid phone number (7 to 20 digits).';
    END IF;

    UPDATE public.profile_private
    SET phone = NULLIF(v_phone, '')
    WHERE user_id = v_user_id;
  END IF;

  UPDATE public.profiles
  SET display_name = v_name,
      headline = v_headline,
      bio = v_bio,
      area = v_area,
      preferred_contact = CASE WHEN v_contact = '' THEN 'In-app chat' ELSE v_contact END,
      languages = COALESCE(p_languages, v_profile.languages),
      work_types = COALESCE(p_work_types, v_profile.work_types),
      availability = CASE
        WHEN p_availability IS NULL THEN v_profile.availability
        WHEN p_availability = '' THEN NULL
        ELSE p_availability
      END,
      experience_years = CASE
        WHEN p_experience_years IS NULL THEN v_profile.experience_years
        WHEN p_experience_years = '' THEN NULL
        ELSE p_experience_years
      END,
      starting_rate_note = v_rate_note,
      client_type = CASE
        WHEN p_client_type IS NULL THEN v_profile.client_type
        WHEN p_client_type = '' THEN NULL
        ELSE p_client_type
      END,
      business_name = v_biz_name,
      about_hiring = v_about_hiring,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'update_profile_details',
    'profiles',
    v_user_id,
    jsonb_build_object('active_mode', v_profile.active_mode)
  );

  PERFORM public.get_profile_completeness(v_user_id);

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_details(text, text, text, text, text, text[], text, text[], text, text, text, text, text, text) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000018_post_gig_category_unlocked.sql
-- ==============================================================================
-- Migration: 20261011000018_post_gig_category_unlocked.sql
-- Milestone 18: Post Gig Category Is Not Locked (Suggest First, Create Last)
-- Strictly adheres to AGENTS.md, docs/MILESTONES.md (M18), and docs/PROFILE_AND_LOOP_V5_1.md Sections 2 & 2A.
-- Zero seed categories. All writes go through RLS / SECURITY DEFINER RPCs.

-- 1. Enable pg_trgm for fuzzy similarity matching on categories and gigs
SET search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Ensure categories has source, created_by, unique lower(trim(name)) index, and trigram index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_lower_name
  ON public.categories (lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_categories_trgm_name
  ON public.categories USING gin (lower(name) gin_trgm_ops);

-- RLS on categories: authenticated users can read active categories or categories they created.
-- Direct INSERT / UPDATE / DELETE remain strictly revoked.
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view active or own categories" ON public.categories;
CREATE POLICY "Authenticated users can view active or own categories" ON public.categories
  FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.categories FROM anon, authenticated, PUBLIC;

-- 3. Helper: normalize_category_stem(p_text text)
-- Normalizes case, collapses spaces, and strips simple plural suffixes ('es'/'s' on words >= 4 chars)
-- so singular/plural variants ("Phone repair" vs "Phone repairs") match cleanly.
DROP FUNCTION IF EXISTS public.normalize_category_stem(text);
CREATE OR REPLACE FUNCTION public.normalize_category_stem(
  p_text text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean text;
  v_words text[];
  v_word text;
  v_out text[] := ARRAY[]::text[];
BEGIN
  v_clean := lower(regexp_replace(trim(COALESCE(p_text, '')), '\s+', ' ', 'g'));
  IF v_clean = '' THEN
    RETURN '';
  END IF;

  v_words := string_to_array(v_clean, ' ');
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF char_length(v_word) >= 5 AND right(v_word, 3) = 'ies' THEN
      v_word := left(v_word, char_length(v_word) - 3) || 'y';
    ELSIF char_length(v_word) >= 5 AND right(v_word, 2) IN ('es') AND right(v_word, 3) IN ('ses', 'xes', 'zes', 'ches', 'shes') THEN
      v_word := left(v_word, char_length(v_word) - 2);
    ELSIF char_length(v_word) >= 4 AND right(v_word, 1) = 's' AND right(v_word, 2) <> 'ss' THEN
      v_word := left(v_word, char_length(v_word) - 1);
    END IF;
    v_out := array_append(v_out, v_word);
  END LOOP;

  RETURN array_to_string(v_out, ' ');
END;
$$;

-- 4. RPC: get_or_create_category(p_name text) RETURNS uuid
-- Section 2 & 2A:
-- - Authenticated only (caller from auth.uid())
-- - Normalizes (trim, collapse spaces), 3-40 chars
-- - Allowed chars: letters, numbers, space, and & - + / only
-- - Rejects URLs, emails, phone numbers, profanity, all-caps shouting, and pure numbers
-- - Case-insensitive + stem + pg_trgm similarity (>= 0.7) dedupe: returns existing category ID instead of creating near-duplicates
-- - Limits for genuinely new categories: max 3 per 24h per user, max 10 total per user; rate limit + audit_events
DROP FUNCTION IF EXISTS public.get_or_create_category(text);
CREATE OR REPLACE FUNCTION public.get_or_create_category(
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_norm text;
  v_stem text;
  v_existing_id uuid;
  v_recent_24h integer;
  v_total_user_cats integer;
  v_slug text;
  v_new_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Normalize whitespace
  v_norm := regexp_replace(trim(COALESCE(p_name, '')), '\s+', ' ', 'g');

  -- Length 3-40 chars
  IF char_length(v_norm) < 3 OR char_length(v_norm) > 40 THEN
    RAISE EXCEPTION 'Category name must be between 3 and 40 characters.';
  END IF;

  -- Reject emails and URLs before character check so error message is specific
  IF position('@' in v_norm) > 0 THEN
    RAISE EXCEPTION 'Category name cannot contain an email address.';
  END IF;

  IF v_norm ~* '(https?://|www\.|\.[a-z]{2,4}/|\.(com|net|org|ph|io)\y)' THEN
    RAISE EXCEPTION 'Category name cannot contain a website or URL.';
  END IF;

  -- Reject phone numbers (7+ digits)
  IF char_length(regexp_replace(v_norm, '[^0-9]', '', 'g')) >= 7 THEN
    RAISE EXCEPTION 'Category name cannot contain a phone number.';
  END IF;

  -- Reject names that are only numbers/symbols (must have at least 2 letters)
  IF char_length(regexp_replace(v_norm, '[^A-Za-z]', '', 'g')) < 2 THEN
    RAISE EXCEPTION 'Category name must include letters and cannot be just a number.';
  END IF;

  -- Allowed characters: letters, numbers, space, and & - + /
  IF v_norm !~ '^[A-Za-z0-9 &+\-/]+$' THEN
    RAISE EXCEPTION 'Category name may only contain letters, numbers, spaces, and & - + /.';
  END IF;

  -- Reject all-caps shouting (when 4+ letters and all letters are uppercase)
  IF char_length(regexp_replace(v_norm, '[^A-Za-z]', '', 'g')) >= 4
     AND v_norm = upper(v_norm)
     AND v_norm <> lower(v_norm) THEN
    RAISE EXCEPTION 'Please use normal capitalization instead of all caps.';
  END IF;

  -- Reject profanity / abusive terms
  IF v_norm ~* '\y(fuck|shit|bitch|asshole|puta|putangina|gago|tarantado|ulol|bobo|scam|scammer|porn|sex|shabu)\y' THEN
    RAISE EXCEPTION 'Category name contains inappropriate language.';
  END IF;

  -- 1. Exact case-insensitive match (admin or user)
  SELECT c.id INTO v_existing_id
  FROM public.categories c
  WHERE lower(trim(c.name)) = lower(v_norm)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 2. Singular/plural stem match or high trigram similarity match (Section 2A rule 4)
  v_stem := public.normalize_category_stem(v_norm);

  SELECT c.id INTO v_existing_id
  FROM public.categories c
  WHERE c.is_active = true
    AND (
      public.normalize_category_stem(c.name) = v_stem
      OR similarity(lower(c.name), lower(v_norm)) >= 0.68
      OR similarity(public.normalize_category_stem(c.name), v_stem) >= 0.68
    )
  ORDER BY
    (public.normalize_category_stem(c.name) = v_stem) DESC,
    similarity(public.normalize_category_stem(c.name), v_stem) DESC,
    (c.source = 'admin') DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 3. Quota & Rate Limit checks for creating a genuinely NEW category
  SELECT count(*) INTO v_recent_24h
  FROM public.categories c
  WHERE c.created_by = v_user_id
    AND c.source = 'user'
    AND c.created_at > now() - interval '24 hours';

  IF v_recent_24h >= 3 THEN
    RAISE EXCEPTION 'You can create at most 3 new categories per 24 hours. Please pick an existing category.';
  END IF;

  SELECT count(*) INTO v_total_user_cats
  FROM public.categories c
  WHERE c.created_by = v_user_id
    AND c.source = 'user';

  IF v_total_user_cats >= 10 THEN
    RAISE EXCEPTION 'You have reached the maximum of 10 custom categories per account. Please pick an existing category.';
  END IF;

  -- Generate unique slug
  v_slug := regexp_replace(lower(v_norm), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'category';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categories WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;

  INSERT INTO public.categories (name, slug, is_active, source, created_by)
  VALUES (v_norm, v_slug, true, 'user', v_user_id)
  RETURNING id INTO v_new_id;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'create_category');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'create_category',
    'categories',
    v_new_id,
    jsonb_build_object('name', v_norm, 'slug', v_slug, 'source', 'user')
  );

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_category(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_category(text) TO authenticated;

-- 5. RPC: suggest_categories_for_gig(p_title text, p_description text)
-- Section 2A rule 1 (Source 1 — always works, no AI needed):
-- Fuzzy search with pg_trgm similarity and keyword match over active category names
-- plus the categories of similar open/completed gigs. Returns top 3 existing categories.
DROP FUNCTION IF EXISTS public.suggest_categories_for_gig(text, text);
CREATE OR REPLACE FUNCTION public.suggest_categories_for_gig(
  p_title text,
  p_description text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  similarity_score real,
  match_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_query text;
  v_stem text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_query := lower(trim(COALESCE(p_title, '') || ' ' || COALESCE(p_description, '')));
  IF char_length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_stem := public.normalize_category_stem(v_query);

  RETURN QUERY
  WITH scored AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      GREATEST(
        similarity(lower(c.name), lower(trim(COALESCE(p_title, '')))),
        word_similarity(lower(c.name), v_query),
        similarity(public.normalize_category_stem(c.name), v_stem),
        COALESCE((
          SELECT max(similarity(lower(g.title), lower(trim(COALESCE(p_title, ''))))) * 0.85
          FROM public.gigs g
          WHERE g.category_id = c.id
            AND g.status IN ('open', 'in_progress', 'completed')
        ), 0::real)
      )::real AS score,
      CASE
        WHEN word_similarity(lower(c.name), v_query) >= 0.45 THEN 'Matches keywords in your gig'
        ELSE 'Similar to existing gigs in Ormoc'
      END AS reason
    FROM public.categories c
    WHERE c.is_active = true
  )
  SELECT
    s.id,
    s.name,
    s.slug,
    s.score AS similarity_score,
    s.reason AS match_reason
  FROM scored s
  WHERE s.score >= 0.15
  ORDER BY s.score DESC, s.name ASC
  LIMIT 3;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.suggest_categories_for_gig(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_categories_for_gig(text, text) TO authenticated;

-- 6. RPC: find_similar_categories(p_query text)
-- Section 2A rule 3: Powers "Did you mean...?" while typing a new category name.
DROP FUNCTION IF EXISTS public.find_similar_categories(text);
CREATE OR REPLACE FUNCTION public.find_similar_categories(
  p_query text
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  similarity_score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_norm text;
  v_stem text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_norm := lower(regexp_replace(trim(COALESCE(p_query, '')), '\s+', ' ', 'g'));
  IF char_length(v_norm) < 2 THEN
    RETURN;
  END IF;

  v_stem := public.normalize_category_stem(v_norm);

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    GREATEST(
      similarity(lower(c.name), v_norm),
      similarity(public.normalize_category_stem(c.name), v_stem),
      word_similarity(v_norm, lower(c.name)) * 0.85
    )::real AS similarity_score
  FROM public.categories c
  WHERE c.is_active = true
    AND (
      public.normalize_category_stem(c.name) = v_stem
      OR similarity(lower(c.name), v_norm) >= 0.3
      OR similarity(public.normalize_category_stem(c.name), v_stem) >= 0.3
      OR lower(c.name) LIKE '%' || v_norm || '%'
    )
  ORDER BY
    (public.normalize_category_stem(c.name) = v_stem) DESC,
    GREATEST(
      similarity(lower(c.name), v_norm),
      similarity(public.normalize_category_stem(c.name), v_stem)
    ) DESC,
    c.name ASC
  LIMIT 5;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_similar_categories(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_categories(text) TO authenticated;

-- 7. RPC: get_browse_categories()
-- Section 2A rule 7 (Popularity guard):
-- Browse filter chips list active admin categories plus active user categories used by >= 2 different posters.
DROP FUNCTION IF EXISTS public.get_browse_categories();
CREATE OR REPLACE FUNCTION public.get_browse_categories()
RETURNS SETOF public.categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT c.*
  FROM public.categories c
  WHERE c.is_active = true
    AND (
      c.source = 'admin'
      OR (
        SELECT count(DISTINCT g.client_id)
        FROM public.gigs g
        WHERE g.category_id = c.id
          AND g.status IN ('open', 'in_progress', 'completed')
      ) >= 2
    )
  ORDER BY c.name ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_browse_categories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_browse_categories() TO authenticated;

-- 8. RPC: create_draft_gig
-- Accepts p_category_id OR p_category_name (calls get_or_create_category in the same transaction).
DROP FUNCTION IF EXISTS public.create_draft_gig(text, text, text, integer, integer, text, text, timestamptz, timestamptz, uuid, text);
CREATE OR REPLACE FUNCTION public.create_draft_gig(
  p_title text,
  p_description text,
  p_requirements text DEFAULT '',
  p_price_min integer DEFAULT 10000,
  p_price_max integer DEFAULT 10000,
  p_work_type text DEFAULT 'remote',
  p_area text DEFAULT '',
  p_application_deadline timestamptz DEFAULT (now() + interval '7 days'),
  p_deadline timestamptz DEFAULT (now() + interval '14 days'),
  p_category_id uuid DEFAULT NULL,
  p_category_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_resolved_category_id uuid;
  v_gig_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF COALESCE(v_profile.active_mode, '') <> 'hire' THEN
    RAISE EXCEPTION 'You must be in Hire Someone mode to create a gig.';
  END IF;

  -- Resolve category: p_category_id OR p_category_name
  IF p_category_id IS NOT NULL THEN
    SELECT c.id INTO v_resolved_category_id
    FROM public.categories c
    WHERE c.id = p_category_id AND c.is_active = true;

    IF v_resolved_category_id IS NULL THEN
      RAISE EXCEPTION 'Selected category was not found or is inactive.';
    END IF;
  ELSIF p_category_name IS NOT NULL AND trim(p_category_name) <> '' THEN
    v_resolved_category_id := public.get_or_create_category(p_category_name);
  ELSE
    RAISE EXCEPTION 'Please select an existing category or enter a new category name.';
  END IF;

  -- Validate basic draft bounds
  IF char_length(trim(COALESCE(p_title, ''))) < 5 OR char_length(trim(COALESCE(p_title, ''))) > 80 THEN
    RAISE EXCEPTION 'Gig title must be between 5 and 80 characters.';
  END IF;

  IF char_length(trim(COALESCE(p_description, ''))) < 30 OR char_length(trim(COALESCE(p_description, ''))) > 2000 THEN
    RAISE EXCEPTION 'Gig description must be between 30 and 2000 characters.';
  END IF;

  IF p_price_min < 10000 THEN
    RAISE EXCEPTION 'Minimum budget must be at least ₱100.00 (10000 centavos).';
  END IF;

  IF p_price_max < p_price_min THEN
    RAISE EXCEPTION 'Maximum budget cannot be less than minimum budget.';
  END IF;

  IF p_work_type NOT IN ('remote', 'face_to_face', 'hybrid') THEN
    RAISE EXCEPTION 'Invalid work type.';
  END IF;

  INSERT INTO public.gigs (
    client_id,
    title,
    description,
    requirements,
    category_id,
    price_min,
    price_max,
    work_type,
    area,
    application_deadline,
    deadline,
    status
  ) VALUES (
    v_user_id,
    trim(p_title),
    trim(p_description),
    trim(COALESCE(p_requirements, '')),
    v_resolved_category_id,
    p_price_min,
    p_price_max,
    p_work_type,
    trim(COALESCE(p_area, '')),
    p_application_deadline,
    p_deadline,
    'draft'
  )
  RETURNING id INTO v_gig_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'create_draft_gig',
    'gigs',
    v_gig_id,
    jsonb_build_object(
      'category_id', v_resolved_category_id,
      'used_category_name', (p_category_id IS NULL AND p_category_name IS NOT NULL)
    )
  );

  RETURN v_gig_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_draft_gig(text, text, text, integer, integer, text, text, timestamptz, timestamptz, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_draft_gig(text, text, text, integer, integer, text, text, timestamptz, timestamptz, uuid, text) TO authenticated;

-- 9. RPC: admin_merge_categories(p_from uuid, p_into uuid)
-- Section 2A rule 6: Admin only, audited. Moves gigs, hiring interests, and skills to p_into and deactivates p_from.
DROP FUNCTION IF EXISTS public.admin_merge_categories(uuid, uuid);
CREATE OR REPLACE FUNCTION public.admin_merge_categories(
  p_from uuid,
  p_into uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_from_cat record;
  v_into_cat record;
  v_moved_gigs integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can merge categories.';
  END IF;

  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RAISE EXCEPTION 'Source and target categories must be two different valid categories.';
  END IF;

  SELECT * INTO v_from_cat FROM public.categories WHERE id = p_from FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source category not found.';
  END IF;

  SELECT * INTO v_into_cat FROM public.categories WHERE id = p_into FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target category not found.';
  END IF;

  -- Move gigs from p_from to p_into
  WITH updated AS (
    UPDATE public.gigs
    SET category_id = p_into,
        updated_at = now()
    WHERE category_id = p_from
    RETURNING id
  )
  SELECT count(*)::integer INTO v_moved_gigs FROM updated;

  -- Move hiring interests (avoiding duplicate primary key)
  INSERT INTO public.profile_hiring_interests (profile_id, category_id)
  SELECT profile_id, p_into
  FROM public.profile_hiring_interests
  WHERE category_id = p_from
  ON CONFLICT (profile_id, category_id) DO NOTHING;

  DELETE FROM public.profile_hiring_interests
  WHERE category_id = p_from;

  -- Move skills referencing source category
  UPDATE public.skills
  SET category_id = p_into
  WHERE category_id = p_from;

  -- Deactivate source category and ensure target category is active
  UPDATE public.categories
  SET is_active = false
  WHERE id = p_from;

  UPDATE public.categories
  SET is_active = true
  WHERE id = p_into;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'admin_merge_categories',
    'categories',
    p_into,
    jsonb_build_object(
      'from_category_id', p_from,
      'from_category_name', v_from_cat.name,
      'into_category_id', p_into,
      'into_category_name', v_into_cat.name,
      'moved_gigs_count', v_moved_gigs
    )
  );

  RETURN jsonb_build_object(
    'from_category_id', p_from,
    'into_category_id', p_into,
    'moved_gigs_count', v_moved_gigs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_merge_categories(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_categories(uuid, uuid) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000019_skills_flow_show_save_manage.sql
-- ==============================================================================
-- Migration: 20261011000019_skills_flow_show_save_manage.sql
-- Milestone 19: Skills Flow — Show, Save, Manage (Freelancer Mode)
-- Strictly adheres to AGENTS.md, docs/MILESTONES.md (M19), and docs/PROFILE_AND_LOOP_V5_1.md Section 4.
-- Zero seed skills. All writes go through RLS / SECURITY DEFINER RPCs.

SET search_path = public, extensions;

-- 1. Ensure skills table has source, created_by, and unique lower(trim(name)) index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skills' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.skills
      ADD COLUMN source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.skills
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name
  ON public.skills (lower(trim(name)));

-- 2. RLS on public.skills:
-- Authenticated users can read active catalog skills, skills they created, OR skills attached to their own profile_skills
-- (so when User B's custom skill deduplicates to User A's pending custom skill row, User B can still read it after relaunch).
DROP POLICY IF EXISTS "Anyone can view active skills" ON public.skills;
DROP POLICY IF EXISTS "Authenticated users can view active skills" ON public.skills;
DROP POLICY IF EXISTS "Authenticated users can view active or own skills" ON public.skills;
CREATE POLICY "Authenticated users can view active or own skills" ON public.skills
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profile_skills ps
      WHERE ps.skill_id = skills.id
        AND ps.profile_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.skills FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.profile_skills FROM anon, authenticated, PUBLIC;

-- 3. Upgrade add_profile_skills(p_skill_ids uuid[], p_custom_names text[])
-- Enforces Section 4 rules:
-- - Freelancer mode ('find_work') only; rejects 'hire' mode
-- - Max 15 skills per profile
-- - Max 5 NEW custom skills per 24h per user (rate limit + audit)
-- - Custom skill validation: 2-40 chars, letters/numbers/space and & - + . / only, must include letters
-- - Rejects URLs, emails, phone numbers, and profanity
-- - Case-insensitive dedupe against catalog and other users' skills (reuses existing row, never duplicates)
-- - New custom skills are source = 'user', is_active = false (pending admin review), usable on owner's profile immediately
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
CREATE OR REPLACE FUNCTION public.add_profile_skills(
  p_skill_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_custom_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  out_skill_id uuid,
  out_skill_name text,
  out_is_active boolean,
  out_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_iter_skill_id uuid;
  v_custom_name text;
  v_trimmed text;
  v_current_skills_count integer;
  v_existing_skill_id uuid;
  v_recent_calls integer;
  v_new_custom_24h integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Enforce Freelancer mode: clients in 'hire' mode cannot add skills
  IF COALESCE(v_profile.active_mode, '') <> 'find_work' THEN
    RAISE EXCEPTION 'Skills can only be added in Find Work (Freelancer) mode.';
  END IF;

  SELECT count(*) INTO v_recent_calls
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'add_profile_skills'
    AND created_at > now() - interval '1 hour';

  IF v_recent_calls >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded for adding skills. Please try again later.';
  END IF;

  IF p_custom_names IS NOT NULL AND array_length(p_custom_names, 1) > 15 THEN
    RAISE EXCEPTION 'You may add at most 15 skills per profile.';
  END IF;

  -- 1. Process existing catalog/known skill IDs
  IF p_skill_ids IS NOT NULL AND array_length(p_skill_ids, 1) > 0 THEN
    FOREACH v_iter_skill_id IN ARRAY p_skill_ids
    LOOP
      IF v_iter_skill_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.skills s
          WHERE s.id = v_iter_skill_id
        ) THEN
          RAISE EXCEPTION 'Selected skill does not exist.';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.profile_skills ps
          WHERE ps.profile_id = v_user_id AND ps.skill_id = v_iter_skill_id
        ) THEN
          SELECT count(*) INTO v_current_skills_count
          FROM public.profile_skills
          WHERE profile_id = v_user_id;

          IF v_current_skills_count >= 15 THEN
            RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
          END IF;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_iter_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Process custom skill names
  IF p_custom_names IS NOT NULL AND array_length(p_custom_names, 1) > 0 THEN
    FOREACH v_custom_name IN ARRAY p_custom_names
    LOOP
      -- Normalize whitespace (trim + collapse internal spaces)
      v_trimmed := regexp_replace(trim(COALESCE(v_custom_name, '')), '\s+', ' ', 'g');

      IF v_trimmed <> '' THEN
        -- Length: 2-40 characters
        IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 40 THEN
          RAISE EXCEPTION 'Custom skill name must be between 2 and 40 characters: %', v_trimmed;
        END IF;

        -- Reject emails first (before domain check)
        IF position('@' in v_trimmed) > 0 THEN
          RAISE EXCEPTION 'Skill name cannot contain an email address.';
        END IF;

        -- Reject URLs / websites
        IF v_trimmed ~* '(https?://|www\.|\.[a-z]{2,4}/|\.(com|net|org|ph|io)\y)' THEN
          RAISE EXCEPTION 'Skill name cannot contain a website or URL.';
        END IF;

        -- Reject phone numbers (7+ digits)
        IF char_length(regexp_replace(v_trimmed, '[^0-9]', '', 'g')) >= 7 THEN
          RAISE EXCEPTION 'Skill name cannot contain a phone number.';
        END IF;

        -- Must contain at least 1 letter (not pure numbers/symbols)
        IF char_length(regexp_replace(v_trimmed, '[^A-Za-z]', '', 'g')) < 1 THEN
          RAISE EXCEPTION 'Skill name must include letters.';
        END IF;

        -- Allowed characters: letters, numbers, space, and & - + . /
        IF v_trimmed !~ '^[A-Za-z0-9 &+\-./]+$' THEN
          RAISE EXCEPTION 'Skill name may only contain letters, numbers, spaces, and & - + . /.';
        END IF;

        -- Reject profanity / abusive terms
        IF v_trimmed ~* '\y(fuck|shit|bitch|asshole|puta|putangina|gago|tarantado|ulol|bobo|scam|scammer|porn|sex|shabu)\y' THEN
          RAISE EXCEPTION 'Skill name contains inappropriate language.';
        END IF;

        -- Case-insensitive dedupe against catalog AND other users' skills
        SELECT s.id INTO v_existing_skill_id
        FROM public.skills s
        WHERE lower(trim(s.name)) = lower(v_trimmed)
        LIMIT 1;

        IF v_existing_skill_id IS NOT NULL THEN
          -- Reuse existing skill row
          IF NOT EXISTS (
            SELECT 1 FROM public.profile_skills ps
            WHERE ps.profile_id = v_user_id AND ps.skill_id = v_existing_skill_id
          ) THEN
            SELECT count(*) INTO v_current_skills_count
            FROM public.profile_skills
            WHERE profile_id = v_user_id;

            IF v_current_skills_count >= 15 THEN
              RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
            END IF;

            INSERT INTO public.profile_skills (profile_id, skill_id)
            VALUES (v_user_id, v_existing_skill_id)
            ON CONFLICT (profile_id, skill_id) DO NOTHING;
          END IF;
        ELSE
          -- Creating a genuinely NEW custom skill
          SELECT count(*) INTO v_current_skills_count
          FROM public.profile_skills
          WHERE profile_id = v_user_id;

          IF v_current_skills_count >= 15 THEN
            RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
          END IF;

          -- Quota: max 5 NEW custom skills per 24h per user
          SELECT count(*) INTO v_new_custom_24h
          FROM public.skills s
          WHERE s.created_by = v_user_id
            AND s.source = 'user'
            AND s.created_at > now() - interval '24 hours';

          IF v_new_custom_24h >= 5 THEN
            RAISE EXCEPTION 'You can create at most 5 new custom skills per 24 hours.';
          END IF;

          INSERT INTO public.skills (name, source, is_active, created_by)
          VALUES (v_trimmed, 'user', false, v_user_id)
          RETURNING id INTO v_existing_skill_id;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'add_profile_skills');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'add_profile_skills',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'catalog_ids_count', coalesce(array_length(p_skill_ids, 1), 0),
      'custom_names_count', coalesce(array_length(p_custom_names, 1), 0)
    )
  );

  PERFORM public.get_profile_completeness(v_user_id);

  RETURN QUERY
  SELECT
    s.id AS out_skill_id,
    s.name AS out_skill_name,
    s.is_active AS out_is_active,
    s.source AS out_source
  FROM public.profile_skills ps
  JOIN public.skills s ON s.id = ps.skill_id
  WHERE ps.profile_id = v_user_id
  ORDER BY s.name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) TO authenticated;

-- 4. Ensure remove_profile_skill(p_skill_id uuid) enforces find_work mode, audits, and recomputes completeness
DROP FUNCTION IF EXISTS public.remove_profile_skill(uuid);
CREATE OR REPLACE FUNCTION public.remove_profile_skill(
  p_skill_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF COALESCE(v_profile.active_mode, '') <> 'find_work' THEN
    RAISE EXCEPTION 'Skills can only be modified in Find Work (Freelancer) mode.';
  END IF;

  DELETE FROM public.profile_skills
  WHERE profile_id = v_user_id AND skill_id = p_skill_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'remove_profile_skill',
    'profiles',
    v_user_id,
    jsonb_build_object('skill_id', p_skill_id)
  );

  PERFORM public.get_profile_completeness(v_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_profile_skill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_profile_skill(uuid) TO authenticated;

-- Migration: 20261011000022_anti_spam_and_idempotency.sql
-- Milestone 24: Stop Spam Clicks and Two-Device Duplicates
-- Strictly adheres to docs/RESILIENCE_V5_4.md Section 3B & 3C and docs/MILESTONES.md (M24)

-- ============================================================================
-- 1. Idempotency Keys Table & Internal Helpers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    rpc_name TEXT NOT NULL,
    result JSONB NOT NULL DEFAULT 'null'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
    ON public.idempotency_keys (created_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Internal only: RLS enabled with zero policies and all privileges revoked from client roles
REVOKE ALL ON public.idempotency_keys FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_idempotency_result(
    p_user_id UUID,
    p_request_id UUID,
    OUT p_found BOOLEAN,
    OUT p_result JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    p_found := false;
    p_result := NULL;
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RETURN;
    END IF;

    SELECT true, ik.result
    INTO p_found, p_result
    FROM public.idempotency_keys ik
    WHERE ik.user_id = p_user_id AND ik.request_id = p_request_id;

    IF NOT FOUND THEN
        p_found := false;
        p_result := NULL;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_idempotency_result(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.store_idempotency_result(
    p_user_id UUID,
    p_request_id UUID,
    p_rpc_name TEXT,
    p_result JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.idempotency_keys (user_id, request_id, rpc_name, result)
    VALUES (p_user_id, p_request_id, p_rpc_name, coalesce(p_result, 'null'::jsonb))
    ON CONFLICT (user_id, request_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.store_idempotency_result(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.idempotency_keys
    WHERE created_at < (now() - interval '24 hours');
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_idempotency_keys() FROM PUBLIC, anon, authenticated;

-- Schedule 24h cleanup in pg_cron when available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cleanup-idempotency-keys-hourly',
            '0 * * * *',
            $cron$SELECT public.cleanup_expired_idempotency_keys();$cron$
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- ============================================================================
-- 2. Unique Indexes & Notification Deduplication
-- ============================================================================

-- Backfill any null submission_number values deterministically before creating unique index
WITH numbered AS (
    SELECT id,
           row_number() OVER (PARTITION BY milestone_id ORDER BY created_at ASC, id ASC) AS rn
    FROM public.submissions
    WHERE submission_number IS NULL
)
UPDATE public.submissions s
SET submission_number = n.rn
FROM numbered n
WHERE s.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_milestone_submission_number
    ON public.submissions (milestone_id, submission_number)
    WHERE submission_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_open_per_milestone
    ON public.payments (
        agreement_id,
        COALESCE(milestone_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE status IN ('reported_sent', 'confirmed_received');

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_agreement_reviewer
    ON public.reviews (agreement_id, reviewer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_active_per_gig
    ON public.applications (gig_id, freelancer_id)
    WHERE status IN ('applied', 'countered', 'accepted');

-- Add dedupe_key to notifications and unique partial index per user
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS dedupe_key TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe_key
    ON public.notifications (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

-- Update public.notify() to compute/use dedupe_key and ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.notify(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_notification_id UUID;
    v_actor_id UUID;
    v_dedupe_key TEXT;
    v_state_suffix TEXT;
BEGIN
    v_actor_id := auth.uid();

    -- Rule: Never notify the actor about their own action
    IF v_actor_id IS NOT NULL AND p_user_id = v_actor_id THEN
        RETURN NULL;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Derive deterministic dedupe_key (type:entity_id:state) when entity_id is present
    IF p_data IS NOT NULL AND (p_data ? 'dedupe_key') THEN
        v_dedupe_key := NULLIF(trim(p_data->>'dedupe_key'), '');
    ELSIF p_entity_id IS NOT NULL AND p_type <> 'new_message' THEN
        v_state_suffix := coalesce(
            p_data->>'submission_id',
            p_data->>'revision_count',
            p_data->>'payment_id',
            p_data->>'counter_price',
            ''
        );
        IF v_state_suffix <> '' THEN
            v_dedupe_key := p_type || ':' || p_entity_id::text || ':' || v_state_suffix;
        ELSE
            v_dedupe_key := p_type || ':' || p_entity_id::text;
        END IF;
    ELSIF p_type = 'new_message' AND p_data IS NOT NULL AND (p_data ? 'message_id') THEN
        v_dedupe_key := 'new_message:' || (p_data->>'message_id');
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        data,
        dedupe_key
    ) VALUES (
        p_user_id,
        p_type,
        trim(p_title),
        trim(p_body),
        p_entity_type,
        p_entity_id,
        coalesce(p_data, '{}'::jsonb),
        v_dedupe_key
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. State-Changing RPCs with Idempotency Keys & State-Machine Guards
-- ============================================================================

-- 3.1 review_milestone
CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id UUID,
    p_action TEXT,
    p_feedback TEXT,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_milestone RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('approve', 'request_revision') THEN
        RAISE EXCEPTION 'Action must be either "approve" or "request_revision".';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id
    FOR UPDATE;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can review milestone submissions.';
    END IF;

    -- State-machine idempotent guard: approving twice or requesting revision twice does nothing
    IF (p_action = 'approve' AND v_milestone.status = 'approved')
       OR (p_action = 'request_revision' AND v_milestone.status = 'revision_requested') THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'review_milestone',
            jsonb_build_object('already_done', true, 'status', v_milestone.status)
        );
        RETURN;
    END IF;

    IF v_milestone.status <> 'submitted' THEN
        RAISE EXCEPTION 'Only submitted milestones can be reviewed.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.milestones
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_approved',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id)
        );

        PERFORM public.notify(
            v_agreement.freelancer_id,
            'milestone_approved',
            'Milestone Approved!',
            'Your milestone "' || v_milestone.title || '" has been approved by the client.',
            'agreement',
            v_agreement.id,
            jsonb_build_object(
                'milestone_id', p_milestone_id,
                'dedupe_key', 'milestone_approved:' || p_milestone_id::text
            )
        );

        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'review_milestone',
            jsonb_build_object('already_done', false, 'status', 'approved')
        );

    ELSIF p_action = 'request_revision' THEN
        IF p_feedback IS NULL OR char_length(trim(p_feedback)) < 5 THEN
            RAISE EXCEPTION 'Feedback of at least 5 characters is required when requesting a revision.';
        END IF;

        IF v_milestone.revision_count >= 2 THEN
            RAISE EXCEPTION 'Maximum revisions limit (2) reached for this milestone. Please contact support or resolve via payment.';
        END IF;

        UPDATE public.milestones
        SET status = 'revision_requested',
            revision_count = revision_count + 1,
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_revision_requested',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id, 'revision_count', v_milestone.revision_count + 1)
        );

        PERFORM public.notify(
            v_agreement.freelancer_id,
            'milestone_revision_requested',
            'Revision Requested',
            'The client requested a revision for "' || v_milestone.title || '".',
            'agreement',
            v_agreement.id,
            jsonb_build_object(
                'milestone_id', p_milestone_id,
                'feedback', trim(p_feedback),
                'revision_count', v_milestone.revision_count + 1,
                'dedupe_key', 'milestone_revision_requested:' || p_milestone_id::text || ':' || (v_milestone.revision_count + 1)::text
            )
        );

        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'review_milestone',
            jsonb_build_object('already_done', false, 'status', 'revision_requested', 'revision_count', v_milestone.revision_count + 1)
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id UUID,
    p_action TEXT,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.review_milestone(p_milestone_id, p_action, p_feedback, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) TO authenticated;

-- 3.2 submit_milestone
CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_message TEXT,
    p_file_paths TEXT[],
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_milestone RECORD;
    v_agreement RECORD;
    v_submission_id UUID;
    v_next_sub_num INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_message IS NULL OR char_length(trim(p_message)) < 5 THEN
        RAISE EXCEPTION 'Submission text must be at least 5 characters.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'submission_id') THEN
        RETURN (v_idem_result->>'submission_id')::UUID;
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id
    FOR UPDATE;

    IF v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the assigned freelancer can submit work for this milestone.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be submitted for active agreements.';
    END IF;

    -- State-machine idempotent guard: if already submitted, return existing latest submission_id
    IF v_milestone.status = 'submitted' THEN
        SELECT s.id INTO v_submission_id
        FROM public.submissions s
        WHERE s.milestone_id = p_milestone_id
        ORDER BY s.submission_number DESC NULLS LAST, s.created_at DESC
        LIMIT 1;

        IF v_submission_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(
                v_caller_id,
                p_request_id,
                'submit_milestone',
                jsonb_build_object('already_done', true, 'submission_id', v_submission_id)
            );
            RETURN v_submission_id;
        END IF;
    END IF;

    IF v_milestone.status NOT IN ('pending', 'revision_requested') THEN
        RAISE EXCEPTION 'Milestone cannot be submitted in its current status (%).', v_milestone.status;
    END IF;

    SELECT coalesce(max(s.submission_number), 0) + 1
    INTO v_next_sub_num
    FROM public.submissions s
    WHERE s.milestone_id = p_milestone_id;

    INSERT INTO public.submissions (
        milestone_id,
        freelancer_id,
        submission_number,
        message,
        notes,
        file_paths
    ) VALUES (
        p_milestone_id,
        v_caller_id,
        v_next_sub_num,
        trim(p_message),
        trim(p_message),
        coalesce(p_file_paths, ARRAY[]::TEXT[])
    )
    RETURNING id INTO v_submission_id;

    UPDATE public.milestones
    SET status = 'submitted',
        updated_at = now()
    WHERE id = p_milestone_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestone_submitted',
        v_caller_id,
        v_submission_id,
        'submissions',
        jsonb_build_object('milestone_id', p_milestone_id, 'agreement_id', v_agreement.id, 'submission_number', v_next_sub_num)
    );

    PERFORM public.notify(
        v_agreement.client_id,
        'milestone_submitted',
        'Milestone Submitted',
        'Work has been submitted for milestone "' || v_milestone.title || '".',
        'agreement',
        v_agreement.id,
        jsonb_build_object(
            'milestone_id', p_milestone_id,
            'submission_id', v_submission_id,
            'dedupe_key', 'milestone_submitted:' || p_milestone_id::text || ':' || v_next_sub_num::text
        )
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'submit_milestone',
        jsonb_build_object('already_done', false, 'submission_id', v_submission_id)
    );

    RETURN v_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_message TEXT,
    p_file_paths TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.submit_milestone(p_milestone_id, p_message, coalesce(p_file_paths, ARRAY[]::TEXT[]), NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[], UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[], UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) TO authenticated;

-- 3.3 define_milestones
CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_agreement RECORD;
    v_total_amount INTEGER := 0;
    v_elem JSONB;
    v_pos INTEGER := 1;
    v_existing_count INTEGER;
    v_non_pending_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can define milestones.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be defined on active agreements.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE status <> 'pending')
    INTO v_existing_count, v_non_pending_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_non_pending_count > 0 THEN
        RAISE EXCEPTION 'Milestones cannot be modified after work has been submitted or approved.';
    END IF;

    -- If milestones are already defined and all pending, second concurrent call is a no-op (already_done)
    IF v_existing_count > 0 THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'define_milestones',
            jsonb_build_object('already_done', true, 'milestone_count', v_existing_count)
        );
        RETURN;
    END IF;

    IF jsonb_array_length(p_milestones) < 1 OR jsonb_array_length(p_milestones) > 5 THEN
        RAISE EXCEPTION 'Agreement must have between 1 and 5 milestones.';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        IF (v_elem->>'title') IS NULL OR char_length(trim(v_elem->>'title')) < 3 THEN
            RAISE EXCEPTION 'Each milestone must have a title of at least 3 characters.';
        END IF;
        IF (v_elem->>'amount') IS NULL OR (v_elem->>'amount')::integer <= 0 THEN
            RAISE EXCEPTION 'Milestone amount must be greater than zero.';
        END IF;
        v_total_amount := v_total_amount + (v_elem->>'amount')::integer;
    END LOOP;

    IF v_total_amount <> v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Sum of milestone amounts (%) must exactly equal agreed price (%).',
            v_total_amount, v_agreement.agreed_price;
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        INSERT INTO public.milestones (
            agreement_id,
            seq,
            position,
            title,
            description,
            amount,
            status
        ) VALUES (
            p_agreement_id,
            v_pos,
            v_pos,
            trim(v_elem->>'title'),
            coalesce(trim(v_elem->>'description'), ''),
            (v_elem->>'amount')::integer,
            'pending'
        );
        v_pos := v_pos + 1;
    END LOOP;

    INSERT INTO public.audit_events (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        v_caller_id,
        'define_milestones',
        'agreements',
        p_agreement_id,
        jsonb_build_object('milestone_count', jsonb_array_length(p_milestones), 'total_amount', v_total_amount)
    );

    PERFORM public.notify(
        v_agreement.freelancer_id,
        'milestones_defined',
        'Milestones Defined',
        'Milestones have been defined for your active agreement.',
        'agreement',
        p_agreement_id,
        jsonb_build_object('dedupe_key', 'milestones_defined:' || p_agreement_id::text)
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'define_milestones',
        jsonb_build_object('already_done', false, 'milestone_count', jsonb_array_length(p_milestones))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.define_milestones(p_agreement_id, p_milestones, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) TO authenticated;

-- 3.4 respond_to_application
CREATE OR REPLACE FUNCTION public.respond_to_application(
    p_application_id UUID,
    p_action TEXT,
    p_counter_price INTEGER,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_app RECORD;
    v_gig RECORD;
    v_agreement_id UUID;
    v_other_app RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('accept', 'decline', 'counter') THEN
        RAISE EXCEPTION 'Invalid response action. Must be accept, decline, or counter.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_user_id, p_request_id);
    IF v_idem_found THEN
        IF v_idem_result IS NOT NULL AND (v_idem_result ? 'agreement_id') AND v_idem_result->>'agreement_id' IS NOT NULL THEN
            RETURN (v_idem_result->>'agreement_id')::UUID;
        END IF;
        RETURN NULL;
    END IF;

    SELECT * INTO v_app
    FROM public.applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_app.gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gig not found.';
    END IF;

    IF v_gig.client_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the gig client can respond to this application.';
    END IF;

    -- State-machine idempotent guard for second concurrent call
    IF p_action = 'accept' AND v_app.status = 'accepted' THEN
        SELECT id INTO v_agreement_id
        FROM public.agreements
        WHERE gig_id = v_gig.id AND status = 'active'
        LIMIT 1;

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', true, 'agreement_id', v_agreement_id)
        );
        RETURN v_agreement_id;
    ELSIF p_action = 'decline' AND v_app.status = 'declined' THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', true, 'agreement_id', NULL)
        );
        RETURN NULL;
    ELSIF p_action = 'counter' AND v_app.status = 'countered' THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', true, 'agreement_id', NULL)
        );
        RETURN NULL;
    END IF;

    IF v_app.status <> 'applied' THEN
        RAISE EXCEPTION 'Application is not in applied state (current: %).', v_app.status;
    END IF;

    IF p_action = 'counter' THEN
        IF p_counter_price IS NULL OR p_counter_price <= 0 THEN
            RAISE EXCEPTION 'Counter price must be greater than zero.';
        END IF;

        UPDATE public.applications
        SET status = 'countered',
            counter_price = p_counter_price,
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
        VALUES (v_user_id, 'counter_application', 'applications', p_application_id, jsonb_build_object('counter_price', p_counter_price));

        PERFORM public.notify(
            v_app.freelancer_id,
            'application_countered',
            'Counteroffer Received',
            'The client countered your proposal on "' || v_gig.title || '".',
            'application',
            p_application_id,
            jsonb_build_object('counter_price', p_counter_price, 'gig_id', v_gig.id)
        );

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', false, 'agreement_id', NULL)
        );

        RETURN NULL;

    ELSIF p_action = 'decline' THEN
        UPDATE public.applications
        SET status = 'declined',
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
        VALUES (v_user_id, 'decline_application', 'applications', p_application_id, '{}'::jsonb);

        PERFORM public.notify(
            v_app.freelancer_id,
            'application_declined',
            'Application Update',
            'Your application for "' || v_gig.title || '" was not accepted.',
            'application',
            p_application_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', false, 'agreement_id', NULL)
        );

        RETURN NULL;

    ELSIF p_action = 'accept' THEN
        IF v_gig.status <> 'open' THEN
            RAISE EXCEPTION 'Gig is not open (current: %). Cannot accept application.', v_gig.status;
        END IF;

        UPDATE public.applications
        SET status = 'accepted',
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.agreements (
            gig_id,
            client_id,
            freelancer_id,
            agreed_price,
            deadline
        ) VALUES (
            v_gig.id,
            v_gig.client_id,
            v_app.freelancer_id,
            v_app.proposed_price,
            v_gig.deadline
        )
        RETURNING id INTO v_agreement_id;

        UPDATE public.gigs
        SET status = 'in_progress',
            updated_at = now()
        WHERE id = v_gig.id;

        FOR v_other_app IN
            SELECT id, freelancer_id FROM public.applications
            WHERE gig_id = v_gig.id
              AND id <> p_application_id
              AND status IN ('applied', 'countered')
        LOOP
            UPDATE public.applications
            SET status = 'declined',
                updated_at = now()
            WHERE id = v_other_app.id;

            PERFORM public.notify(
                v_other_app.freelancer_id,
                'application_declined',
                'Gig Filled',
                'Another proposal was selected for "' || v_gig.title || '".',
                'application',
                v_other_app.id,
                jsonb_build_object('gig_id', v_gig.id)
            );
        END LOOP;

        INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            v_user_id,
            'accept_application',
            'agreements',
            v_agreement_id,
            jsonb_build_object('application_id', p_application_id, 'agreed_price', v_app.proposed_price)
        );

        PERFORM public.notify(
            v_app.freelancer_id,
            'application_accepted',
            'Proposal Accepted!',
            'Congratulations! Your proposal for "' || v_gig.title || '" was accepted.',
            'agreement',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.notify(
            v_user_id,
            'agreement_created',
            'Agreement Created',
            'Agreement for "' || v_gig.title || '" is now active.',
            'agreement',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_application',
            jsonb_build_object('already_done', false, 'agreement_id', v_agreement_id)
        );

        RETURN v_agreement_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_application(
    p_application_id UUID,
    p_action TEXT,
    p_counter_price INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.respond_to_application(p_application_id, p_action, p_counter_price, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_application(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application(UUID, TEXT, INTEGER, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_application(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application(UUID, TEXT, INTEGER) TO authenticated;

-- 3.5 respond_to_counter
CREATE OR REPLACE FUNCTION public.respond_to_counter(
    p_application_id UUID,
    p_action TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_app RECORD;
    v_gig RECORD;
    v_agreement_id UUID;
    v_other_app RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('accept', 'decline', 'withdraw') THEN
        RAISE EXCEPTION 'Invalid counter response. Must be accept, decline, or withdraw.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_user_id, p_request_id);
    IF v_idem_found THEN
        IF v_idem_result IS NOT NULL AND (v_idem_result ? 'agreement_id') AND v_idem_result->>'agreement_id' IS NOT NULL THEN
            RETURN (v_idem_result->>'agreement_id')::UUID;
        END IF;
        RETURN NULL;
    END IF;

    SELECT * INTO v_app
    FROM public.applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF v_app.freelancer_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the applicant freelancer can respond to this counteroffer.';
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_app.gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gig not found.';
    END IF;

    -- State-machine idempotent guard
    IF p_action = 'accept' AND v_app.status = 'accepted' THEN
        SELECT id INTO v_agreement_id
        FROM public.agreements
        WHERE gig_id = v_gig.id AND status = 'active'
        LIMIT 1;

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_counter',
            jsonb_build_object('already_done', true, 'agreement_id', v_agreement_id)
        );
        RETURN v_agreement_id;
    ELSIF p_action IN ('decline', 'withdraw') AND v_app.status IN ('decline', 'declined', 'withdraw', 'withdrawn') THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_counter',
            jsonb_build_object('already_done', true, 'agreement_id', NULL)
        );
        RETURN NULL;
    END IF;

    IF v_app.status <> 'countered' THEN
        RAISE EXCEPTION 'Application is not in countered status (current: %).', v_app.status;
    END IF;

    IF p_action IN ('decline', 'withdraw') THEN
        UPDATE public.applications
        SET status = CASE WHEN p_action = 'decline' THEN 'declined' ELSE 'withdrawn' END,
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            v_user_id,
            p_action || '_counter',
            'applications',
            p_application_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.notify(
            v_gig.client_id,
            'counter_declined',
            'Counteroffer Declined',
            'Freelancer declined the counteroffer for "' || v_gig.title || '".',
            'application',
            p_application_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_counter',
            jsonb_build_object('already_done', false, 'agreement_id', NULL)
        );

        RETURN NULL;

    ELSIF p_action = 'accept' THEN
        IF v_gig.status <> 'open' THEN
            RAISE EXCEPTION 'Gig is not open (current: %). An active agreement may already exist.', v_gig.status;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.agreements
            WHERE gig_id = v_gig.id AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'An active agreement already exists for this gig.';
        END IF;

        IF v_gig.client_id = v_user_id THEN
            RAISE EXCEPTION 'Client and freelancer cannot be the same person.';
        END IF;

        UPDATE public.applications
        SET status = 'accepted',
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.agreements (
            gig_id,
            client_id,
            freelancer_id,
            agreed_price,
            deadline,
            status
        )
        VALUES (
            v_gig.id,
            v_gig.client_id,
            v_user_id,
            v_app.counter_price,
            v_gig.deadline,
            'active'
        )
        RETURNING id INTO v_agreement_id;

        UPDATE public.gigs
        SET status = 'in_progress',
            updated_at = now()
        WHERE id = v_gig.id;

        FOR v_other_app IN
            SELECT id, freelancer_id FROM public.applications
            WHERE gig_id = v_gig.id
              AND id <> p_application_id
              AND status IN ('applied', 'countered')
        LOOP
            UPDATE public.applications
            SET status = 'declined',
                updated_at = now()
            WHERE id = v_other_app.id;

            PERFORM public.notify(
                v_other_app.freelancer_id,
                'application_declined',
                'Gig Filled',
                'Another proposal was accepted for "' || v_gig.title || '".',
                'application',
                v_other_app.id,
                jsonb_build_object('gig_id', v_gig.id)
            );
        END LOOP;

        INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            v_user_id,
            'accept_counter',
            'agreements',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id, 'price', v_app.counter_price)
        );

        PERFORM public.notify(
            v_gig.client_id,
            'counter_accepted',
            'Counteroffer Accepted!',
            'Freelancer accepted your counteroffer for "' || v_gig.title || '". Agreement is now active.',
            'agreement',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.notify(
            v_gig.client_id,
            'agreement_created',
            'Agreement Created',
            'Agreement for "' || v_gig.title || '" is now active.',
            'agreement',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.notify(
            v_user_id,
            'agreement_created',
            'Agreement Created',
            'Agreement for "' || v_gig.title || '" is now active.',
            'agreement',
            v_agreement_id,
            jsonb_build_object('gig_id', v_gig.id)
        );

        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'respond_to_counter',
            jsonb_build_object('already_done', false, 'agreement_id', v_agreement_id)
        );

        RETURN v_agreement_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_counter(
    p_application_id UUID,
    p_action TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.respond_to_counter(p_application_id, p_action, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_counter(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter(UUID, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_counter(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter(UUID, TEXT) TO authenticated;

-- 3.6 report_payment
CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id UUID,
    p_milestone_id UUID,
    p_amount INTEGER,
    p_payment_method TEXT,
    p_reference_number TEXT,
    p_receipt_path TEXT,
    p_notes TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_agreement RECORD;
    v_payment_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    IF p_reference_number IS NULL OR char_length(trim(p_reference_number)) < 3 THEN
        RAISE EXCEPTION 'A valid transaction reference number is required.';
    END IF;

    IF p_payment_method NOT IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'payment_id') THEN
        RETURN (v_idem_result->>'payment_id')::UUID;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can report external payments.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Payments can only be reported for active agreements.';
    END IF;

    IF p_milestone_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.milestones
            WHERE id = p_milestone_id AND agreement_id = p_agreement_id
        ) THEN
            RAISE EXCEPTION 'Milestone does not belong to this agreement.';
        END IF;
    END IF;

    -- State-machine idempotent guard: unique open payment per (agreement, milestone) while reported_sent or confirmed_received
    SELECT p.id INTO v_payment_id
    FROM public.payments p
    WHERE p.agreement_id = p_agreement_id
      AND COALESCE(p.milestone_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(p_milestone_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND p.status IN ('reported_sent', 'confirmed_received')
    LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'report_payment',
            jsonb_build_object('already_done', true, 'payment_id', v_payment_id)
        );
        RETURN v_payment_id;
    END IF;

    INSERT INTO public.payments (
        agreement_id,
        milestone_id,
        payer_id,
        payee_id,
        amount,
        payment_method,
        reference_number,
        receipt_path,
        notes,
        status,
        reported_at
    ) VALUES (
        p_agreement_id,
        p_milestone_id,
        v_caller_id,
        v_agreement.freelancer_id,
        p_amount,
        p_payment_method,
        coalesce(trim(p_reference_number), ''),
        p_receipt_path,
        coalesce(trim(p_notes), ''),
        'reported_sent',
        now()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_reported',
        v_caller_id,
        v_payment_id,
        'payments',
        jsonb_build_object('agreement_id', p_agreement_id, 'amount', p_amount, 'method', p_payment_method)
    );

    PERFORM public.notify(
        v_agreement.freelancer_id,
        'payment_reported',
        'Payment Reported',
        'Client reported an external payment of ₱' || (p_amount / 100)::text || '. Please confirm once received.',
        'agreement',
        p_agreement_id,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'amount', p_amount,
            'dedupe_key', 'payment_reported:' || v_payment_id::text
        )
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'report_payment',
        jsonb_build_object('already_done', false, 'payment_id', v_payment_id)
    );

    RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id UUID,
    p_milestone_id UUID DEFAULT NULL,
    p_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'gcash',
    p_reference_number TEXT DEFAULT '',
    p_receipt_path TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.report_payment(
        p_agreement_id,
        p_milestone_id,
        p_amount,
        p_payment_method,
        p_reference_number,
        p_receipt_path,
        p_notes,
        NULL::UUID
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 3.7 confirm_payment
CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id UUID,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can confirm payment receipt.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'confirm_payment',
            jsonb_build_object('already_done', true, 'status', 'confirmed_received')
        );
        RETURN;
    END IF;

    IF v_payment.status <> 'reported_sent' THEN
        RAISE EXCEPTION 'Payment can only be confirmed when status is reported_sent (current: %).', v_payment.status;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id;

    UPDATE public.payments
    SET status = 'confirmed_received',
        confirmed_at = now(),
        disputed_at = NULL,
        dispute_reason = NULL,
        updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_confirmed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'amount', v_payment.amount)
    );

    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
            v_agreement.client_id,
            'payment_confirmed',
            'Payment Confirmed',
            'Freelancer confirmed receipt of external payment (₱' || (v_payment.amount / 100)::text || ').',
            'agreement',
            v_payment.agreement_id,
            jsonb_build_object(
                'payment_id', p_payment_id,
                'dedupe_key', 'payment_confirmed:' || p_payment_id::text
            )
        );
    END IF;

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'confirm_payment',
        jsonb_build_object('already_done', false, 'status', 'confirmed_received')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.confirm_payment(p_payment_id, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID) TO authenticated;

-- 3.8 dispute_payment
CREATE OR REPLACE FUNCTION public.dispute_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear reason of at least 5 characters is required to dispute a payment.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can dispute payment reports.';
    END IF;

    IF v_payment.status = 'disputed' THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'dispute_payment',
            jsonb_build_object('already_done', true, 'status', 'disputed')
        );
        RETURN;
    END IF;

    IF v_payment.status <> 'reported_sent' THEN
        RAISE EXCEPTION 'Cannot dispute a payment that was already confirmed.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id
    FOR UPDATE;

    UPDATE public.payments
    SET status = 'disputed',
        dispute_reason = trim(p_reason),
        disputed_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;

    IF v_agreement IS NOT NULL THEN
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = v_agreement.id;
    END IF;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_disputed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'reason', trim(p_reason))
    );

    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
            v_agreement.client_id,
            'payment_disputed',
            'Payment Disputed',
            'Freelancer disputed payment: ' || trim(p_reason),
            'agreement',
            v_payment.agreement_id,
            jsonb_build_object(
                'payment_id', p_payment_id,
                'dedupe_key', 'payment_disputed:' || p_payment_id::text
            )
        );
    END IF;

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'dispute_payment',
        jsonb_build_object('already_done', false, 'status', 'disputed')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispute_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.dispute_payment(p_payment_id, p_reason, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) TO authenticated;

-- 3.9 complete_agreement
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_agreement RECORD;
    v_milestone_count INTEGER;
    v_unapproved_count INTEGER;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_total_confirmed INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'complete_agreement',
            jsonb_build_object('already_done', true, 'status', 'completed')
        );
        RETURN;
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    UPDATE public.agreements
    SET status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    WHERE id = p_agreement_id;

    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );

    PERFORM public.notify(
        v_agreement.client_id,
        'agreement_completed',
        'Agreement Completed',
        'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
        'agreement',
        p_agreement_id,
        jsonb_build_object('dedupe_key', 'agreement_completed:' || p_agreement_id::text)
    );

    PERFORM public.notify(
        v_agreement.freelancer_id,
        'agreement_completed',
        'Agreement Completed',
        'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
        'agreement',
        p_agreement_id,
        jsonb_build_object('dedupe_key', 'agreement_completed:' || p_agreement_id::text)
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'complete_agreement',
        jsonb_build_object('already_done', false, 'status', 'completed')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.complete_agreement(p_agreement_id, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_agreement(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_agreement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement(UUID) TO authenticated;

-- 3.10 cancel_agreement
CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT,
    p_request_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_agreement RECORD;
    v_gig RECORD;
    v_other_party_id UUID;
    v_has_submitted_work BOOLEAN;
    v_result_status TEXT;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a reason of at least 5 characters for cancelling this agreement.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'status') THEN
        RETURN v_idem_result->>'status';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can initiate cancellation.';
    END IF;

    IF v_agreement.status IN ('cancelled', 'disputed') THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'cancel_agreement',
            jsonb_build_object('already_done', true, 'status', v_agreement.status)
        );
        RETURN v_agreement.status;
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be cancelled or disputed (current: %).', v_agreement.status;
    END IF;

    IF v_agreement.client_id = v_caller_id THEN
        v_other_party_id := v_agreement.freelancer_id;
    ELSE
        v_other_party_id := v_agreement.client_id;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_agreement.gig_id;

    SELECT EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) INTO v_has_submitted_work;

    IF NOT v_has_submitted_work THEN
        UPDATE public.agreements
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_agreement_id;

        UPDATE public.gigs
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = v_agreement.gig_id;

        v_result_status := 'cancelled';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_freely',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason))
        );

        PERFORM public.notify(
            v_other_party_id,
            'agreement_cancelled',
            'Agreement Cancelled',
            'The agreement for "' || coalesce(v_gig.title, 'gig') || '" has been cancelled. Reason: ' || trim(p_reason),
            'agreement',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason), 'dedupe_key', 'agreement_cancelled:' || p_agreement_id::text)
        );
    ELSE
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = p_agreement_id;

        INSERT INTO public.reports (
            reporter_id,
            target_type,
            target_id,
            reason_category,
            details
        ) VALUES (
            v_caller_id,
            'agreement',
            p_agreement_id,
            'cancellation_request',
            'Agreement cancellation requested after deliverables started: ' || trim(p_reason)
        )
        RETURNING id INTO v_report_id;

        v_result_status := 'disputed';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_disputed',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id)
        );

        PERFORM public.notify(
            v_other_party_id,
            'agreement_disputed',
            'Agreement Cancellation Disputed',
            'A cancellation request was filed after work started. A dispute report has been opened for moderation review.',
            'agreement',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id, 'dedupe_key', 'agreement_disputed:' || p_agreement_id::text)
        );
    END IF;

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'cancel_agreement',
        jsonb_build_object('already_done', false, 'status', v_result_status)
    );

    RETURN v_result_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.cancel_agreement(p_agreement_id, p_reason, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_agreement(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(UUID, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_agreement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(UUID, TEXT) TO authenticated;

-- 3.11 publish_gig
CREATE OR REPLACE FUNCTION public.publish_gig(
    p_gig_id UUID,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_profile RECORD;
    v_gig RECORD;
    v_email_confirmed BOOLEAN;
    v_category_valid BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_user_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = p_gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gig not found.';
    END IF;

    IF v_gig.client_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the gig owner can publish this gig.';
    END IF;

    IF v_gig.status = 'open' THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'publish_gig',
            jsonb_build_object('already_done', true, 'status', 'open')
        );
        RETURN;
    END IF;

    IF v_gig.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft gigs can be published.';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_profile.active_mode <> 'hire' THEN
        RAISE EXCEPTION 'You must be in Hire Someone mode to publish a gig.';
    END IF;

    IF v_profile.status <> 'active' THEN
        RAISE EXCEPTION 'Your account is not active.';
    END IF;

    IF v_profile.display_name IS NULL OR trim(v_profile.display_name) = '' THEN
        RAISE EXCEPTION 'You must set a display name before publishing a gig.';
    END IF;

    SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users
    WHERE id = v_user_id;

    IF v_email_confirmed IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'You must confirm your email address before publishing a gig.';
    END IF;

    IF char_length(trim(v_gig.title)) < 5 OR char_length(trim(v_gig.title)) > 80 THEN
        RAISE EXCEPTION 'Gig title must be between 5 and 80 characters.';
    END IF;

    IF char_length(trim(v_gig.description)) < 30 OR char_length(trim(v_gig.description)) > 2000 THEN
        RAISE EXCEPTION 'Gig description must be between 30 and 2000 characters.';
    END IF;

    IF v_gig.price_min < 10000 THEN
        RAISE EXCEPTION 'Minimum budget must be at least ₱100.00 (10000 centavos).';
    END IF;

    IF v_gig.price_max < v_gig.price_min THEN
        RAISE EXCEPTION 'Maximum budget cannot be less than minimum budget.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = v_gig.category_id AND is_active = true
    ) INTO v_category_valid;

    IF NOT v_category_valid THEN
        RAISE EXCEPTION 'Invalid or inactive category.';
    END IF;

    IF v_gig.application_deadline <= now() THEN
        RAISE EXCEPTION 'Application deadline must be in the future.';
    END IF;

    IF v_gig.deadline < v_gig.application_deadline THEN
        RAISE EXCEPTION 'Project completion deadline must be on or after the application deadline.';
    END IF;

    UPDATE public.gigs
    SET status = 'open',
        updated_at = now()
    WHERE id = p_gig_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'publish_gig', 'gigs', p_gig_id, jsonb_build_object('title', v_gig.title));

    PERFORM public.store_idempotency_result(
        v_user_id,
        p_request_id,
        'publish_gig',
        jsonb_build_object('already_done', false, 'status', 'open')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_gig(p_gig_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.publish_gig(p_gig_id, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_gig(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_gig(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig(UUID) TO authenticated;

-- 3.12 cancel_gig
CREATE OR REPLACE FUNCTION public.cancel_gig(
    p_gig_id UUID,
    p_reason TEXT,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_gig RECORD;
    v_applicant RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 OR char_length(trim(p_reason)) > 500 THEN
        RAISE EXCEPTION 'Cancellation reason must be between 3 and 500 characters.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_user_id, p_request_id);
    IF v_idem_found THEN
        RETURN;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = p_gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gig not found.';
    END IF;

    IF v_gig.client_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the gig owner can cancel this gig.';
    END IF;

    IF v_gig.status = 'cancelled' THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'cancel_gig',
            jsonb_build_object('already_done', true, 'status', 'cancelled')
        );
        RETURN;
    END IF;

    IF v_gig.status NOT IN ('draft', 'open') THEN
        RAISE EXCEPTION 'Only draft or open gigs can be cancelled. Active gigs with agreements must use cancel_agreement.';
    END IF;

    UPDATE public.gigs
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_gig_id;

    IF v_gig.status = 'open' THEN
        FOR v_applicant IN
            SELECT id, freelancer_id
            FROM public.applications
            WHERE gig_id = p_gig_id AND status IN ('applied', 'countered')
        LOOP
            UPDATE public.applications
            SET status = 'declined',
                updated_at = now()
            WHERE id = v_applicant.id;

            PERFORM public.notify(
                v_applicant.freelancer_id,
                'gig_cancelled',
                'Gig Cancelled',
                'The gig "' || v_gig.title || '" has been cancelled by the client. Reason: ' || trim(p_reason),
                'gig',
                p_gig_id,
                jsonb_build_object('gig_id', p_gig_id, 'reason', trim(p_reason), 'dedupe_key', 'gig_cancelled:' || p_gig_id::text)
            );
        END LOOP;
    END IF;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_user_id,
        'cancel_gig',
        'gigs',
        p_gig_id,
        jsonb_build_object('title', v_gig.title, 'reason', trim(p_reason))
    );

    PERFORM public.store_idempotency_result(
        v_user_id,
        p_request_id,
        'cancel_gig',
        jsonb_build_object('already_done', false, 'status', 'cancelled')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_gig(
    p_gig_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by client'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    PERFORM public.cancel_gig(p_gig_id, p_reason, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_gig(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gig(UUID, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_gig(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gig(UUID, TEXT) TO authenticated;

-- 3.13 submit_review
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'review_id') THEN
        RETURN (v_idem_result->>'review_id')::UUID;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    IF v_agreement.completed_at IS NOT NULL AND now() > (v_agreement.completed_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_role := 'freelancer';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_role := 'client';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- State-machine idempotent guard: if caller already reviewed this agreement, return existing review_id
    SELECT r.id INTO v_review_id
    FROM public.reviews r
    WHERE r.agreement_id = p_agreement_id AND r.reviewer_id = v_caller_id
    LIMIT 1;

    IF v_review_id IS NOT NULL THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'submit_review',
            jsonb_build_object('already_done', true, 'review_id', v_review_id)
        );
        RETURN v_review_id;
    END IF;

    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        reviewee_role,
        rating,
        comment,
        hidden
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        v_reviewee_role,
        p_rating,
        trim(p_comment),
        false
    )
    RETURNING id INTO v_review_id;

    IF v_reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'rating', p_rating,
            'reviewer_role', v_reviewer_role,
            'reviewee_role', v_reviewee_role
        )
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'submit_review',
        jsonb_build_object('already_done', false, 'review_id', v_review_id)
    );

    RETURN v_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.submit_review(p_agreement_id, p_rating, p_comment, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) TO authenticated;

-- 3.14 submit_application
CREATE OR REPLACE FUNCTION public.submit_application(
    p_gig_id UUID,
    p_proposed_price INTEGER,
    p_estimated_days INTEGER,
    p_message TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_profile RECORD;
    v_gig RECORD;
    v_has_skill BOOLEAN;
    v_email_confirmed BOOLEAN;
    v_recent_app_count INTEGER;
    v_app_id UUID;
    v_conv_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
        RAISE EXCEPTION 'Proposed price must be greater than zero.';
    END IF;
    IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
        RAISE EXCEPTION 'Estimated days must be greater than zero.';
    END IF;
    IF p_message IS NULL OR trim(p_message) = '' THEN
        RAISE EXCEPTION 'Application message is required.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_user_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'application_id') THEN
        RETURN (v_idem_result->>'application_id')::UUID;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = p_gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gig not found.';
    END IF;

    IF v_gig.client_id = v_user_id THEN
        RAISE EXCEPTION 'You cannot apply to your own gig.';
    END IF;

    -- State-machine idempotent guard: if active application already exists for (gig_id, freelancer_id), return it
    SELECT a.id INTO v_app_id
    FROM public.applications a
    WHERE a.gig_id = p_gig_id
      AND a.freelancer_id = v_user_id
      AND a.status IN ('applied', 'countered', 'accepted')
    LIMIT 1;

    IF v_app_id IS NOT NULL THEN
        PERFORM public.store_idempotency_result(
            v_user_id,
            p_request_id,
            'submit_application',
            jsonb_build_object('already_done', true, 'application_id', v_app_id)
        );
        RETURN v_app_id;
    END IF;

    SELECT count(*) INTO v_recent_app_count
    FROM public.rate_limit_events
    WHERE user_id = v_user_id
      AND action = 'submit_application'
      AND created_at > (now() - interval '1 hour');

    IF v_recent_app_count >= 10 THEN
        RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
    END IF;

    IF v_gig.status <> 'open' THEN
        RAISE EXCEPTION 'Gig is not open for applications.';
    END IF;

    IF v_gig.application_deadline <= now() THEN
        RAISE EXCEPTION 'The application deadline for this gig has passed.';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_profile.active_mode <> 'find_work' THEN
        RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
    END IF;

    IF v_profile.status <> 'active' THEN
        RAISE EXCEPTION 'Your account is not active.';
    END IF;

    IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
        RAISE EXCEPTION 'You must upload a profile photo before applying for gigs.';
    END IF;

    SELECT email_confirmed_at IS NOT NULL INTO v_email_confirmed
    FROM auth.users
    WHERE id = v_user_id;

    IF NOT coalesce(v_email_confirmed, false) THEN
        RAISE EXCEPTION 'You must confirm your email before applying for gigs.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
    ) INTO v_has_skill;

    IF NOT v_has_skill THEN
        RAISE EXCEPTION 'You must have at least one skill added to your profile before applying.';
    END IF;

    INSERT INTO public.applications (
        gig_id,
        freelancer_id,
        proposed_price,
        estimated_days,
        message
    ) VALUES (
        p_gig_id,
        v_user_id,
        p_proposed_price,
        p_estimated_days,
        trim(p_message)
    )
    RETURNING id INTO v_app_id;

    INSERT INTO public.conversations (
        application_id,
        client_id,
        freelancer_id
    ) VALUES (
        v_app_id,
        v_gig.client_id,
        v_user_id
    )
    ON CONFLICT (application_id) DO NOTHING
    RETURNING id INTO v_conv_id;

    IF v_conv_id IS NOT NULL THEN
        INSERT INTO public.messages (
            conversation_id,
            sender_id,
            content
        ) VALUES (
            v_conv_id,
            v_user_id,
            trim(p_message)
        );
    END IF;

    INSERT INTO public.rate_limit_events (user_id, action)
    VALUES (v_user_id, 'submit_application');

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_user_id,
        'submit_application',
        'applications',
        v_app_id,
        jsonb_build_object('gig_id', p_gig_id, 'proposed_price', p_proposed_price)
    );

    PERFORM public.notify(
        v_gig.client_id,
        'application_received',
        'New Application Received',
        coalesce(v_profile.display_name, 'A freelancer') || ' applied to your gig "' || v_gig.title || '".',
        'application',
        v_app_id,
        jsonb_build_object('gig_id', p_gig_id, 'dedupe_key', 'application_received:' || v_app_id::text)
    );

    PERFORM public.store_idempotency_result(
        v_user_id,
        p_request_id,
        'submit_application',
        jsonb_build_object('already_done', false, 'application_id', v_app_id)
    );

    RETURN v_app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_application(
    p_gig_id UUID,
    p_proposed_price INTEGER,
    p_estimated_days INTEGER,
    p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.submit_application(p_gig_id, p_proposed_price, p_estimated_days, p_message, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_application(UUID, INTEGER, INTEGER, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(UUID, INTEGER, INTEGER, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_application(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- 3.15 send_message
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_idem_found BOOLEAN;
    v_idem_result JSONB;
    v_conv RECORD;
    v_recipient_id UUID;
    v_sender_profile RECORD;
    v_recent_count INTEGER;
    v_msg_id UUID;
    v_preview TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT p_found, p_result INTO v_idem_found, v_idem_result
    FROM public.get_idempotency_result(v_caller_id, p_request_id);
    IF v_idem_found AND v_idem_result IS NOT NULL AND (v_idem_result ? 'message_id') THEN
        RETURN (v_idem_result->>'message_id')::UUID;
    END IF;

    SELECT * INTO v_sender_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_sender_profile.status = 'suspended' THEN
        RAISE EXCEPTION 'Suspended accounts cannot send messages.';
    END IF;

    IF p_content IS NULL OR char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 2000 THEN
        RAISE EXCEPTION 'Message must be between 1 and 2000 characters.';
    END IF;

    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.';
    END IF;

    IF v_conv.client_id = v_caller_id THEN
        v_recipient_id := v_conv.freelancer_id;
    ELSE
        v_recipient_id := v_conv.client_id;
    END IF;

    IF v_recipient_id = v_caller_id THEN
        RAISE EXCEPTION 'Cannot converse with yourself.';
    END IF;

    -- Guard against two-device / rapid double-tap identical message within 2 seconds
    SELECT m.id INTO v_msg_id
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.sender_id = v_caller_id
      AND m.content = trim(p_content)
      AND m.created_at > (now() - interval '2 seconds')
    ORDER BY m.created_at DESC
    LIMIT 1;

    IF v_msg_id IS NOT NULL THEN
        PERFORM public.store_idempotency_result(
            v_caller_id,
            p_request_id,
            'send_message',
            jsonb_build_object('already_done', true, 'message_id', v_msg_id)
        );
        RETURN v_msg_id;
    END IF;

    SELECT count(*) INTO v_recent_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at > (now() - interval '1 minute');

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Message rate limit exceeded (max 30 messages per minute).';
    END IF;

    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content
    ) VALUES (
        p_conversation_id,
        v_caller_id,
        trim(p_content)
    )
    RETURNING id INTO v_msg_id;

    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;

    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = now();

    v_preview := substring(trim(p_content) from 1 for 100);
    IF char_length(trim(p_content)) > 100 THEN
        v_preview := v_preview || '...';
    END IF;

    PERFORM public.notify(
        v_recipient_id,
        'new_message',
        'New Message from ' || coalesce(v_sender_profile.display_name, 'User'),
        v_preview,
        'conversation',
        p_conversation_id,
        jsonb_build_object(
            'conversation_id', p_conversation_id,
            'sender_id', v_caller_id,
            'message_id', v_msg_id
        )
    );

    PERFORM public.store_idempotency_result(
        v_caller_id,
        p_request_id,
        'send_message',
        jsonb_build_object('already_done', false, 'message_id', v_msg_id)
    );

    RETURN v_msg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.send_message(p_conversation_id, p_content, NULL::UUID);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.send_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;
-- ============================================================================
-- Milestone 25: Notifications Coverage and Scheduled Reminders (v5.4 Section 1)
--
-- 1. Covers every action in Section 1 with notifications for counterparty
--    (proposal_withdrawn, milestones_updated, report_resolved, account_status_changed).
-- 2. Creates run_scheduled_reminders() emitting all 7 deduped reminders:
--    - Milestone awaiting review for 3 days & 7 days
--    - Payment awaiting confirmation for 2 days
--    - Review window closing (3 days remaining of 14-day window)
--    - Gig application deadline in 24 hours
--    - Gig expired / closed
--    - Agreement deadline in 48 hours
-- 3. Schedules run_scheduled_reminders() via pg_cron (hourly).
-- ============================================================================

-- 1. Enhance respond_to_counter to notify client on proposal withdrawal
CREATE OR REPLACE FUNCTION public.respond_to_counter(
    p_application_id UUID,
    p_action TEXT,
    p_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_cached JSONB;
    v_app RECORD;
    v_gig RECORD;
    v_agreement_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('accept', 'decline', 'withdraw') THEN
        RAISE EXCEPTION 'Invalid action. Must be accept, decline, or withdraw.';
    END IF;

    IF p_request_id IS NOT NULL THEN
        v_cached := public.get_idempotency_result(v_user_id, p_request_id);
        IF v_cached IS NOT NULL THEN
            IF v_cached ? 'agreement_id' THEN
                RETURN (v_cached->>'agreement_id')::UUID;
            END IF;
            RETURN NULL;
        END IF;
    END IF;

    SELECT * INTO v_app
    FROM public.applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF v_app.freelancer_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the freelancer who submitted this proposal can respond to the counteroffer.';
    END IF;

    IF p_action = 'withdraw' THEN
        IF v_app.status = 'withdrawn' THEN
            v_result := jsonb_build_object('ok', true, 'already_done', true, 'agreement_id', null);
            IF p_request_id IS NOT NULL THEN
                PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
            END IF;
            RETURN NULL;
        END IF;

        IF v_app.status NOT IN ('applied', 'countered') THEN
            RAISE EXCEPTION 'Cannot withdraw application in status "%".', v_app.status;
        END IF;

        UPDATE public.applications
        SET status = 'withdrawn',
            updated_at = now()
        WHERE id = p_application_id;

        -- Notify client that proposal was withdrawn
        SELECT * INTO v_gig FROM public.gigs WHERE id = v_app.gig_id;
        IF FOUND AND v_gig.client_id IS NOT NULL THEN
            PERFORM public.notify(
                v_gig.client_id,
                'proposal_withdrawn',
                'Application Withdrawn',
                'A freelancer has withdrawn their application for "' || v_gig.title || '".',
                'gig',
                v_gig.id,
                jsonb_build_object('gig_id', v_gig.id, 'application_id', p_application_id, 'dedupe_key', 'proposal_withdrawn:' || p_application_id::text)
            );
        END IF;

        v_result := jsonb_build_object('ok', true, 'already_done', false, 'agreement_id', null);
        IF p_request_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
        END IF;
        RETURN NULL;
    END IF;

    IF v_app.status = 'accepted' THEN
        SELECT id INTO v_agreement_id
        FROM public.agreements
        WHERE gig_id = v_app.gig_id AND freelancer_id = v_app.freelancer_id
        LIMIT 1;

        v_result := jsonb_build_object('ok', true, 'already_done', true, 'agreement_id', v_agreement_id);
        IF p_request_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
        END IF;
        RETURN v_agreement_id;
    END IF;

    IF v_app.status = 'declined' AND p_action = 'decline' THEN
        v_result := jsonb_build_object('ok', true, 'already_done', true, 'agreement_id', null);
        IF p_request_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
        END IF;
        RETURN NULL;
    END IF;

    IF v_app.status <> 'countered' THEN
        RAISE EXCEPTION 'This application has not been countered (status: %).', v_app.status;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_app.gig_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated gig not found.';
    END IF;

    IF p_action = 'decline' THEN
        UPDATE public.applications
        SET status = 'declined',
            updated_at = now()
        WHERE id = p_application_id;

        PERFORM public.notify(
            v_gig.client_id,
            'counter_declined',
            'Counteroffer Declined',
            'The freelancer declined your counteroffer of ' || (coalesce(v_app.counter_price, 0) / 100)::text || ' PHP for "' || v_gig.title || '".',
            'gig',
            v_gig.id,
            jsonb_build_object('gig_id', v_gig.id, 'application_id', p_application_id, 'dedupe_key', 'counter_declined:' || p_application_id::text)
        );

        v_result := jsonb_build_object('ok', true, 'already_done', false, 'agreement_id', null);
        IF p_request_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
        END IF;
        RETURN NULL;
    END IF;

    IF p_action = 'accept' THEN
        IF v_gig.status <> 'open' THEN
            RAISE EXCEPTION 'This gig is no longer open for hire.';
        END IF;

        IF EXISTS (SELECT 1 FROM public.agreements WHERE gig_id = v_gig.id) THEN
            RAISE EXCEPTION 'An agreement has already been created for this gig.';
        END IF;

        UPDATE public.applications
        SET status = 'accepted',
            updated_at = now()
        WHERE id = p_application_id;

        UPDATE public.applications
        SET status = 'declined',
            updated_at = now()
        WHERE gig_id = v_app.gig_id
          AND id <> p_application_id
          AND status IN ('applied', 'countered');

        UPDATE public.gigs
        SET status = 'in_progress',
            updated_at = now()
        WHERE id = v_app.gig_id;

        INSERT INTO public.agreements (
            gig_id,
            client_id,
            freelancer_id,
            agreed_price,
            deadline,
            status
        ) VALUES (
            v_app.gig_id,
            v_gig.client_id,
            v_app.freelancer_id,
            coalesce(v_app.counter_price, v_app.proposed_price),
            v_gig.deadline,
            'active'
        )
        RETURNING id INTO v_agreement_id;

        PERFORM public.notify(
            v_gig.client_id,
            'application_accepted',
            'Agreement Created!',
            'The freelancer accepted your counteroffer. Agreement created for "' || v_gig.title || '".',
            'agreement',
            v_agreement_id,
            jsonb_build_object('agreement_id', v_agreement_id, 'gig_id', v_gig.id, 'dedupe_key', 'application_accepted:' || v_agreement_id::text)
        );

        v_result := jsonb_build_object('ok', true, 'already_done', false, 'agreement_id', v_agreement_id);
        IF p_request_id IS NOT NULL THEN
            PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'respond_to_counter', v_result);
        END IF;
        RETURN v_agreement_id;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Enhance define_milestones to notify freelancer when milestones are updated (vs initial definition)
CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB,
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_cached JSONB;
    v_agreement RECORD;
    v_elem JSONB;
    v_total_amount BIGINT := 0;
    v_elem_amount BIGINT;
    v_elem_title TEXT;
    v_elem_desc TEXT;
    v_seq INT := 0;
    v_count INT;
    v_existing_count INT;
    v_result JSONB;
    v_notif_type TEXT;
    v_notif_title TEXT;
    v_notif_body TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_request_id IS NOT NULL THEN
        v_cached := public.get_idempotency_result(v_user_id, p_request_id);
        IF v_cached IS NOT NULL THEN
            RETURN;
        END IF;
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the client can define milestones.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot define milestones on non-active agreement (status: %).', v_agreement.status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) THEN
        RAISE EXCEPTION 'Cannot redefine milestones once work has been submitted or approved.';
    END IF;

    SELECT count(*) INTO v_existing_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    v_count := jsonb_array_length(p_milestones);
    IF v_count < 1 OR v_count > 5 THEN
        RAISE EXCEPTION 'An agreement must have between 1 and 5 milestones (got %).', v_count;
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        v_elem_amount := (v_elem->>'amount')::BIGINT;
        v_elem_title  := trim(v_elem->>'title');

        IF v_elem_title IS NULL OR length(v_elem_title) < 3 THEN
            RAISE EXCEPTION 'Each milestone must have a title of at least 3 characters.';
        END IF;
        IF v_elem_amount IS NULL OR v_elem_amount <= 0 THEN
            RAISE EXCEPTION 'Each milestone must have a positive amount in centavos.';
        END IF;

        v_total_amount := v_total_amount + v_elem_amount;
    END LOOP;

    IF v_total_amount <> v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Milestone sum (%) must exactly equal agreed price (%).',
            v_total_amount, v_agreement.agreed_price;
    END IF;

    DELETE FROM public.milestones WHERE agreement_id = p_agreement_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        v_seq := v_seq + 1;
        v_elem_amount := (v_elem->>'amount')::BIGINT;
        v_elem_title  := trim(v_elem->>'title');
        v_elem_desc   := coalesce(trim(v_elem->>'description'), '');

        INSERT INTO public.milestones (
            agreement_id,
            seq,
            title,
            description,
            amount,
            status
        ) VALUES (
            p_agreement_id,
            v_seq,
            v_elem_title,
            v_elem_desc,
            v_elem_amount,
            'pending'
        );
    END LOOP;

    IF v_existing_count > 0 THEN
        v_notif_type := 'milestones_updated';
        v_notif_title := 'Milestones Updated';
        v_notif_body := 'The client updated the project milestones for your active agreement.';
    ELSE
        v_notif_type := 'milestones_defined';
        v_notif_title := 'Milestones Set';
        v_notif_body := 'The client defined ' || v_seq::text || ' milestone(s) for your active agreement.';
    END IF;

    PERFORM public.notify(
        v_agreement.freelancer_id,
        v_notif_type,
        v_notif_title,
        v_notif_body,
        'agreement',
        p_agreement_id,
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'milestone_count', v_seq,
            'dedupe_key', v_notif_type || ':' || p_agreement_id::text || ':' || v_seq::text
        )
    );

    v_result := jsonb_build_object('ok', true, 'count', v_seq);
    IF p_request_id IS NOT NULL THEN
        PERFORM public.store_idempotency_result(v_user_id, p_request_id, 'define_milestones', v_result);
    END IF;
END;
$$;

-- 3. Resolve report helper with counterparty notification
CREATE OR REPLACE FUNCTION public.resolve_report(
    p_report_id UUID,
    p_status TEXT,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_report RECORD;
BEGIN
    IF p_status NOT IN ('reviewed', 'dismissed', 'action_taken') THEN
        RAISE EXCEPTION 'Invalid resolution status: %', p_status;
    END IF;

    SELECT * INTO v_report
    FROM public.reports
    WHERE id = p_report_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found.';
    END IF;

    UPDATE public.reports
    SET status = p_status,
        resolution_notes = p_resolution_notes,
        resolved_at = now()
    WHERE id = p_report_id;

    -- Notify the reporter that their report has been reviewed
    IF v_report.reporter_id IS NOT NULL THEN
        PERFORM public.notify(
            v_report.reporter_id,
            'report_resolved',
            'Report Update',
            'Your report regarding ' || v_report.target_type || ' has been reviewed and resolved.',
            'report',
            p_report_id,
            jsonb_build_object(
                'report_id', p_report_id,
                'status', p_status,
                'dedupe_key', 'report_resolved:' || p_report_id::text || ':' || p_status
            )
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_report(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(UUID, TEXT, TEXT) TO authenticated;

-- 4. Scheduled Reminders (pg_cron)
CREATE OR REPLACE FUNCTION public.run_scheduled_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_count INTEGER := 0;
    r RECORD;
BEGIN
    -- 1. Milestone awaiting client review for >= 3 days and < 7 days
    FOR r IN
        SELECT m.id AS milestone_id, m.title, m.agreement_id, m.updated_at, a.client_id
        FROM public.milestones m
        JOIN public.agreements a ON a.id = m.agreement_id
        WHERE m.status = 'submitted'
          AND m.updated_at <= (now() - interval '3 days')
          AND m.updated_at > (now() - interval '7 days')
          AND a.status = 'active'
    LOOP
        IF public.notify(
            r.client_id,
            'milestone_review_reminder_3d',
            'Milestone Awaiting Review (3 Days)',
            'Deliverables for "' || r.title || '" have been awaiting your review for 3 days.',
            'milestone',
            r.milestone_id,
            jsonb_build_object(
                'milestone_id', r.milestone_id,
                'agreement_id', r.agreement_id,
                'dedupe_key', 'milestone_review_reminder_3d:' || r.milestone_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 2. Milestone awaiting client review for >= 7 days
    FOR r IN
        SELECT m.id AS milestone_id, m.title, m.agreement_id, m.updated_at, a.client_id
        FROM public.milestones m
        JOIN public.agreements a ON a.id = m.agreement_id
        WHERE m.status = 'submitted'
          AND m.updated_at <= (now() - interval '7 days')
          AND a.status = 'active'
    LOOP
        IF public.notify(
            r.client_id,
            'milestone_review_reminder_7d',
            'Milestone Awaiting Review (7 Days)',
            'Deliverables for "' || r.title || '" have been awaiting your review for 7 days.',
            'milestone',
            r.milestone_id,
            jsonb_build_object(
                'milestone_id', r.milestone_id,
                'agreement_id', r.agreement_id,
                'dedupe_key', 'milestone_review_reminder_7d:' || r.milestone_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 3. Payment awaiting payee confirmation for >= 2 days
    FOR r IN
        SELECT p.id AS payment_id, p.agreement_id, p.payee_id, p.amount, p.reported_at
        FROM public.payments p
        JOIN public.agreements a ON a.id = p.agreement_id
        WHERE p.status = 'reported_sent'
          AND p.reported_at <= (now() - interval '2 days')
          AND a.status = 'active'
    LOOP
        IF public.notify(
            r.payee_id,
            'payment_confirm_reminder_2d',
            'Payment Awaiting Confirmation',
            'A payment report of ' || (r.amount / 100)::text || ' PHP has been awaiting your confirmation for 2 days.',
            'payment',
            r.payment_id,
            jsonb_build_object(
                'payment_id', r.payment_id,
                'agreement_id', r.agreement_id,
                'dedupe_key', 'payment_confirm_reminder_2d:' || r.payment_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 4. Review window closing (agreement completed between 11 and 14 days ago)
    FOR r IN
        SELECT a.id AS agreement_id, a.client_id, a.freelancer_id, a.completed_at
        FROM public.agreements a
        WHERE a.status = 'completed'
          AND a.completed_at IS NOT NULL
          AND a.completed_at <= (now() - interval '11 days')
          AND a.completed_at > (now() - interval '14 days')
    LOOP
        -- Client reminder if client hasn't reviewed yet
        IF NOT EXISTS (
            SELECT 1 FROM public.reviews
            WHERE agreement_id = r.agreement_id AND reviewer_id = r.client_id
        ) THEN
            IF public.notify(
                r.client_id,
                'review_window_closing_3d',
                'Review Window Closing Soon',
                'Only 3 days remain to submit your feedback for this completed agreement.',
                'agreement',
                r.agreement_id,
                jsonb_build_object(
                    'agreement_id', r.agreement_id,
                    'dedupe_key', 'review_window_closing_3d:' || r.agreement_id::text || ':' || r.client_id::text
                )
            ) IS NOT NULL THEN
                v_count := v_count + 1;
            END IF;
        END IF;

        -- Freelancer reminder if freelancer hasn't reviewed yet
        IF NOT EXISTS (
            SELECT 1 FROM public.reviews
            WHERE agreement_id = r.agreement_id AND reviewer_id = r.freelancer_id
        ) THEN
            IF public.notify(
                r.freelancer_id,
                'review_window_closing_3d',
                'Review Window Closing Soon',
                'Only 3 days remain to submit your feedback for this completed agreement.',
                'agreement',
                r.agreement_id,
                jsonb_build_object(
                    'agreement_id', r.agreement_id,
                    'dedupe_key', 'review_window_closing_3d:' || r.agreement_id::text || ':' || r.freelancer_id::text
                )
            ) IS NOT NULL THEN
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- 5. Gig application deadline within 24 hours
    FOR r IN
        SELECT g.id AS gig_id, g.title, g.client_id, g.application_deadline
        FROM public.gigs g
        WHERE g.status = 'open'
          AND g.application_deadline > now()
          AND g.application_deadline <= (now() + interval '24 hours')
    LOOP
        IF public.notify(
            r.client_id,
            'gig_application_deadline_24h',
            'Application Deadline in 24 Hours',
            'The application deadline for "' || r.title || '" will close in less than 24 hours.',
            'gig',
            r.gig_id,
            jsonb_build_object(
                'gig_id', r.gig_id,
                'dedupe_key', 'gig_application_deadline_24h:' || r.gig_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 6. Gig expired / application window closed
    FOR r IN
        SELECT g.id AS gig_id, g.title, g.client_id, g.application_deadline
        FROM public.gigs g
        WHERE g.status = 'open'
          AND g.application_deadline <= now()
    LOOP
        IF public.notify(
            r.client_id,
            'gig_expired',
            'Gig Application Window Closed',
            'The application deadline for "' || r.title || '" has passed.',
            'gig',
            r.gig_id,
            jsonb_build_object(
                'gig_id', r.gig_id,
                'dedupe_key', 'gig_expired:' || r.gig_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 7. Agreement deadline in 48 hours
    FOR r IN
        SELECT a.id AS agreement_id, a.client_id, a.freelancer_id, a.deadline, g.title AS gig_title
        FROM public.agreements a
        LEFT JOIN public.gigs g ON g.id = a.gig_id
        WHERE a.status = 'active'
          AND a.deadline > now()
          AND a.deadline <= (now() + interval '48 hours')
    LOOP
        -- Notify client
        IF public.notify(
            r.client_id,
            'agreement_deadline_48h',
            'Agreement Deadline in 48 Hours',
            'The completion deadline for "' || coalesce(r.gig_title, 'your project') || '" is in 48 hours.',
            'agreement',
            r.agreement_id,
            jsonb_build_object(
                'agreement_id', r.agreement_id,
                'dedupe_key', 'agreement_deadline_48h:' || r.agreement_id::text || ':' || r.client_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;

        -- Notify freelancer
        IF public.notify(
            r.freelancer_id,
            'agreement_deadline_48h',
            'Agreement Deadline in 48 Hours',
            'The completion deadline for "' || coalesce(r.gig_title, 'your project') || '" is in 48 hours.',
            'agreement',
            r.agreement_id,
            jsonb_build_object(
                'agreement_id', r.agreement_id,
                'dedupe_key', 'agreement_deadline_48h:' || r.agreement_id::text || ':' || r.freelancer_id::text
            )
        ) IS NOT NULL THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.run_scheduled_reminders() FROM PUBLIC, anon, authenticated;

-- Schedule reminders hourly via pg_cron when extension is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'run-scheduled-reminders-hourly',
            '0 * * * *',
            $cron$SELECT public.run_scheduled_reminders();$cron$
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
