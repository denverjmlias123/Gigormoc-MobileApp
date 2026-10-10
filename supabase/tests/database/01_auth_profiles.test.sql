BEGIN;
SELECT plan(6);

-- Verify tables exist
SELECT has_table('public', 'profiles', 'public.profiles table should exist');
SELECT has_table('public', 'profile_private', 'public.profile_private table should exist');
SELECT has_table('public', 'platform_admins', 'public.platform_admins table should exist');

-- Verify RLS is enabled on all tables
SELECT row_level_security_active('public.profiles', 'RLS should be active on public.profiles');
SELECT row_level_security_active('public.profile_private', 'RLS should be active on public.profile_private');
SELECT row_level_security_active('public.platform_admins', 'RLS should be active on public.platform_admins');

SELECT * FROM finish();
ROLLBACK;
