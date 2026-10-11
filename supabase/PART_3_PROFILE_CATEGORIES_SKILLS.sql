
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

