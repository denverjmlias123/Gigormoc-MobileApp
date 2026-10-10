BEGIN;
SELECT plan(8);

-- Verify tables exist
SELECT has_table('public', 'categories', 'public.categories table should exist');
SELECT has_table('public', 'skills', 'public.skills table should exist');
SELECT has_table('public', 'profile_skills', 'public.profile_skills table should exist');
SELECT has_table('public', 'portfolio_items', 'public.portfolio_items table should exist');

-- Verify RLS is active on all tables
SELECT row_level_security_active('public.categories', 'RLS should be active on public.categories');
SELECT row_level_security_active('public.skills', 'RLS should be active on public.skills');
SELECT row_level_security_active('public.profile_skills', 'RLS should be active on public.profile_skills');
SELECT row_level_security_active('public.portfolio_items', 'RLS should be active on public.portfolio_items');

SELECT * FROM finish();
ROLLBACK;
