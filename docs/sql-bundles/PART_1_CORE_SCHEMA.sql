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

