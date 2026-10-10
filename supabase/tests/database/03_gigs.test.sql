BEGIN;
SELECT plan(6);

-- Verify gigs table exists
SELECT has_table('public', 'gigs', 'public.gigs table should exist');
SELECT has_table('public', 'audit_events', 'public.audit_events table should exist');

-- Verify RLS is active on gigs and audit_events
SELECT row_level_security_active('public.gigs', 'RLS should be active on public.gigs');
SELECT row_level_security_active('public.audit_events', 'RLS should be active on public.audit_events');

-- Verify columns exist on gigs
SELECT has_column('public', 'gigs', 'price_min', 'gigs should have price_min');
SELECT has_column('public', 'gigs', 'work_type', 'gigs should have work_type');

SELECT * FROM finish();
ROLLBACK;
