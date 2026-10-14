-- Read-only post-apply checks for the two pending M26 migrations.
-- Run only after applying both migrations. Any failed condition raises an error.
DO $$
DECLARE
  v_function_signature text;
  v_legacy_function_source boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('rating_avg', 'rating_count', 'completed_gigs')
  ) THEN
    RAISE EXCEPTION 'M26 check failed: combined rating columns remain on public.profiles.';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN (
        'freelancer_rating_avg', 'freelancer_rating_count',
        'client_rating_avg', 'client_rating_count'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'M26 check failed: role-specific rating columns are missing.';
  END IF;

  SELECT prosrc ~* '(NEW|OLD)\.(rating_avg|rating_count|completed_gigs)'
  INTO v_legacy_function_source
  FROM pg_proc
  WHERE oid = 'public.check_profile_update_integrity()'::regprocedure;

  IF coalesce(v_legacy_function_source, true) THEN
    RAISE EXCEPTION 'M26 check failed: profile update trigger still references removed columns.';
  END IF;

  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.notify(uuid,text,text,text,jsonb)',
    'public.rls_auto_enable()'
  ] LOOP
    IF to_regprocedure(v_function_signature) IS NULL THEN
      RAISE EXCEPTION 'M26 check failed: expected helper % does not exist.', v_function_signature;
    END IF;
    IF has_function_privilege('anon', v_function_signature, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'M26 check failed: anon or authenticated can execute %.', v_function_signature;
    END IF;
  END LOOP;

  -- The seven-argument helper is also internal; if present, it must stay private.
  IF to_regprocedure('public.notify(uuid,text,text,text,text,uuid,jsonb)') IS NOT NULL
    AND (
      has_function_privilege('anon', 'public.notify(uuid,text,text,text,text,uuid,jsonb)', 'EXECUTE')
      OR has_function_privilege('authenticated', 'public.notify(uuid,text,text,text,text,uuid,jsonb)', 'EXECUTE')
    ) THEN
    RAISE EXCEPTION 'M26 check failed: anon or authenticated can execute the seven-argument notify helper.';
  END IF;
END;
$$;

SELECT
  'PASS' AS result,
  'M26 schema and helper permissions match the updated app migrations' AS detail;
