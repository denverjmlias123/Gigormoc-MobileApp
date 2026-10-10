-- pgTAP test for Milestone 14: AI in Onboarding (Skills, Bio & Edge Function Backing)
-- Tests:
-- 1. Check add_profile_skills function signature and grants
-- 2. Check complete_onboarding function signature and grants
-- 3. Anonymous execution denied for add_profile_skills and complete_onboarding
-- 4. Check areas table exists with RLS
-- 5. Verify direct client modifications denied on areas and skills

BEGIN;
SELECT plan(8);

-- 1. Check add_profile_skills function signature
SELECT has_function(
    'public',
    'add_profile_skills',
    ARRAY['uuid[]', 'text[]'],
    'add_profile_skills(uuid[], text[]) function must exist'
);

-- 2. Check complete_onboarding function signature
SELECT has_function(
    'public',
    'complete_onboarding',
    ARRAY[]::text[],
    'complete_onboarding() function must exist'
);

-- 3. Check areas table exists with RLS enabled
SELECT has_table('public', 'areas', 'areas table must exist');
SELECT row_level_security_active('public.areas', 'RLS must be enabled on areas');

-- 4. Verify anon cannot execute add_profile_skills or complete_onboarding
SELECT throws_ok(
    'SELECT public.add_profile_skills(ARRAY[]::uuid[], ARRAY[''Skill''])',
    'permission denied for function add_profile_skills'
);

SELECT throws_ok(
    'SELECT public.complete_onboarding()',
    'permission denied for function complete_onboarding'
);

-- 5. Verify direct modifications denied on areas table
SELECT throws_ok(
    'INSERT INTO public.areas (name) VALUES (''Test Area'')',
    'permission denied for table areas'
);

-- 6. Verify direct modifications denied on skills table
SELECT throws_ok(
    'INSERT INTO public.skills (name) VALUES (''Direct Skill Insert'')',
    'permission denied for table skills'
);

SELECT * FROM finish();
ROLLBACK;
