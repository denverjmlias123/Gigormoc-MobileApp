BEGIN;
SELECT plan(6);

-- Verify applications and agreements tables exist
SELECT has_table('public', 'applications', 'public.applications table should exist');
SELECT has_table('public', 'agreements', 'public.agreements table should exist');

-- Verify RLS is active on applications and agreements
SELECT row_level_security_active('public.applications', 'RLS should be active on public.applications');
SELECT row_level_security_active('public.agreements', 'RLS should be active on public.agreements');

-- Verify unique constraints exist
SELECT col_is_pk('public', 'agreements', 'id', 'agreements should have primary key on id');
SELECT col_is_pk('public', 'applications', 'id', 'applications should have primary key on id');

SELECT * FROM finish();
ROLLBACK;
