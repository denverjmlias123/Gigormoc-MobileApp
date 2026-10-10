# AGENTS.md — Gigormoc project rules

Read this file first in every session. Then read `docs/GIGORMOC_SPEC.md` (full spec), `docs/DESIGN.md` (look and feel) and `docs/MILESTONES.md` (build order).

Gigormoc is a local freelance marketplace for Ormoc City, Philippines (18+ only). The developer is solo. Prefer a working, secure, simple product over extra features.

## Stack (fixed)
- Expo (managed), React Native, TypeScript strict, Expo Router. Mobile + web from one codebase.
- Backend is **100% Supabase**: Auth, Postgres with Row Level Security, Storage, Realtime, Postgres RPC functions, Edge Functions, pg_cron.
- Client libs: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`.
- Do NOT use, suggest, or mention Appwrite or any other backend. If Appwrite code exists in the project, list every file to remove or replace.

## How to work
1. Build ONE milestone at a time from `docs/MILESTONES.md`. Never build ahead.
2. Before coding, list the files and migrations you will create or change.
3. All schema changes are SQL files in `supabase/migrations/`. No manual database edits without a matching migration.
4. Keep screens thin: UI in components, logic in hooks/services, Supabase calls in a service layer. One client in `lib/supabase.ts`.
5. After each milestone run `npx tsc --noEmit`, `npm test`, and `supabase test db`. Report the REAL results and paste the raw output of all three. `supabase test db` is mandatory: if it cannot run (CLI or Docker missing), say so and mark the milestone NOT VERIFIED. Node tests that re-implement a rule in JavaScript do not prove database behavior and do not replace pgTAP tests. Never claim something works unless it was verified.
5a. Every protected function needs behavior tests in pgTAP: wrong user, wrong state, duplicate call, boundary case, and a direct client write being denied. "Function exists" tests are not enough.
6. End each milestone with a report: files changed, tables/policies/functions affected, tests run, manual Supabase dashboard steps the developer must do.
7. Apply schema changes through the Supabase CLI migrations (`supabase db push` or `supabase migration up`). Do not tell the developer to paste migration SQL into the dashboard SQL editor, because that desyncs migration history.
8. Never edit an old migration that was already applied. Fix forward with a new migration.

## NO DEMO DATA, NO SEED DATA (locked)
- Never create `supabase/seed.sql`, seed scripts, sample inserts, or "populate" buttons. Keep any seed setting in `supabase/config.toml` disabled.
- Migrations contain schema only (tables, constraints, indexes, RLS, functions, buckets). No sample rows.
- No fake users, gigs, reviews, categories, skills, counters, lorem ipsum, or hardcoded arrays that stand in for database content.
- No demo logins, quick-start buttons, or test accounts in the app.
- Empty database → show a real empty state. Failed query → show an error state with retry. NEVER fall back to sample data.
- Categories and skills are real rows entered by the real admin in the Supabase dashboard. The app only reads them.
- First admin: the developer registers a real account, then adds that user id to `platform_admins` once, manually.
- Tests may create temporary data only inside the test run and must roll back. Never commit test data as seeds.
- Before finishing each milestone, search the repo for seed files, sample arrays, mock services, and demo code. Report findings (must be none).

## Project history and retrofit rule
This project was started on an older version of this blueprint (Milestones 0-2 were built before mode rules, DESIGN.md and the UI kit existed). If `docs/MILESTONES.md` says the retrofit is not finished, do that first (see "Retrofit" there). Do not build the next milestone on top of a schema or UI that does not match these docs.

## Security rules (non-negotiable)
- Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` may be in the app. NEVER put the `service_role`/secret key in the app, `EXPO_PUBLIC_*` variables, or the repo.
- Enable RLS on EVERY table in `public`. Default deny. Minimal explicit policies.
- RLS is row-level, so private data (`dob`, `phone`) lives in `profile_private`, never in `profiles`.
- Never trust client-provided role, age, verification, price, status, rating, or payment state. Those change only inside `SECURITY DEFINER` Postgres functions that: use `auth.uid()`, set `search_path` explicitly, check participation and current state, lock rows with `FOR UPDATE`, are idempotent, validate input, and write an `audit_events` row.
- Revoke direct INSERT/UPDATE/DELETE on protected tables so the API cannot bypass functions. For every `SECURITY DEFINER` function: `revoke execute ... from public, anon` and grant execute only to `authenticated` (admin functions: still check `platform_admins` inside).
- Never use `user_metadata` for authorization. Admin = a row in `platform_admins`.
- Views over private data must use `security_invoker = true`.
- Private files (submissions, receipts) go in private buckets with storage policies tied to agreement participation; use signed URLs; limit file type and size.
- Rate-limit apply, message, report, upload. Use CAPTCHA on sign-up.

## Business rules
- Money = integer centavos. Display as PHP.
- One account, ONE active mode at a time: `find_work` (freelancer) or `hire` (client). There is NO "Explore Both" option. The user must pick one during onboarding.
- The mode lives in `profiles.active_mode`. It is set only by the `choose_initial_mode` and `switch_mode` database functions, never by a direct client update.
- Mode switching is restricted (full rules in `docs/GIGORMOC_SPEC.md` section 3A): 7-day cooldown; blocked while the user has an active or disputed agreement, a payment awaiting confirmation or disputed, an unresolved report against them, or a suspended account; open gigs are cancelled and pending applications withdrawn only after explicit confirmation; every switch is audited.
- Actions are enforced by mode in the database: apply, submit work and confirm payment need `find_work`; publish gig, accept/counter applicants, approve milestones and report payment need `hire`. Viewing history, messaging, reviews, reports and profile work in any mode.
- Ratings are stored separately per role (freelancer rating, client rating), so switching never resets or hides reputation.
- 18+ enforced in the database from date of birth (sign-up trigger rejects under 18). DOB is never public.
- Gates enforced in the database: apply = email confirmed + profile photo + 1 skill + 18+; publish gig = email confirmed + 18+.
- Gig: draft → open → in_progress → completed | cancelled | expired.
- Application: applied → accepted | declined | countered → (freelancer) accepted | declined | withdrawn. One counteroffer round only. One application per freelancer per gig.
- Accepting an application atomically creates exactly one agreement; the price is copied into it.
- Milestones: 1–5 per agreement, amounts must sum exactly to the agreed price, max 2 revisions each. Status: pending → submitted → approved (or revision_requested → submitted).
- Payments are external (GCash/Maya/PayPal/cash). The app only records `reported_sent` and `confirmed_received` (or `disputed`). Never label anything "verified" or "guaranteed".
- Agreement completes only when all milestones are approved and payments confirmed (or a moderator resolves it). `complete_agreement` sets `agreements.completed_at` exactly once. Nothing else may change it. Never use `updated_at` for business deadlines.
- Reviews: 1–5 stars + comment (10–1000 chars), only on `completed` agreements, participants only, one per party per agreement, within 14 days of `agreements.completed_at`, no edits or deletes by users. Reviewee and `reviewee_role` are derived from the agreement, never sent by the client. A moderator can hide a review (`reviews.hidden`); hidden reviews are excluded from public lists and from rating math. Ratings are recomputed from the `reviews` table (hidden = false) in the same transaction, never updated incrementally.
- Ratings exist ONLY per role (`freelancer_rating_avg/count`, `client_rating_avg/count`). There is no single combined rating column. If one exists from an older version, remove it in a migration.
- Gigormoc never holds money. No escrow, no wallet balances, no simulated payouts anywhere in code or UI. If any exists from an older version, list it and remove it.

## UX rules
- Mobile-first, accessible touch targets, keyboard-safe forms, visible labels (not placeholders only).
- Date picker for dates, password show/hide, clear validation messages.
- Every screen has loading, empty, error, and success states. No fake loading percentages.

## Design rules (full details in `docs/DESIGN.md`)
- Styling: **NativeWind v4 + Tailwind CSS v3** (stable). Do not use NativeWind v5 / Tailwind v4 preview setups.
- All colors, fonts, spacing and radii are tokens in `tailwind.config.js`. No raw hex values or one-off styles in screens.
- Build the shared component kit in `components/ui/` first (Button, TextInput, Card, Badge, EmptyState, ErrorState, etc.), then build screens from it.
- Verify setup with ONE token-styled test screen on phone and web before building other screens. Delete it afterwards.
- Look: trustworthy, simple, friendly, local (Ormoc, PHP ₱). Primary blue, light theme only in v1.
- Layout: phone = single column + bottom tabs; tablet = side rail/top nav; desktop web = centered content (max ~1120), card grids, two-column detail pages.
- Status badges always show text plus color. Payment wording stays "Reported" / "Confirmed by freelancer". The words "verified" and "guaranteed" never appear in any user-facing string, including for reviews (say "Reviews", not "Verified reviews").
- Use initials avatars, icons and honest empty states. No stock faces, lorem ipsum, fake ratings or counters.
- Reference screenshots in `design/reference/` are visual reference only. Never copy their code, SDKs or data.
- All user-facing text lives in one strings file (ready for Tagalog/Waray/Bisaya later).
- Accessibility: contrast 4.5:1, touch targets 44px+, labels on icon buttons, visible web focus, system font scaling.
