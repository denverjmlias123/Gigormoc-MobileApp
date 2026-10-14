# AGENTS.md — Gigormoc project rules

Read this file first in every session. Then read `docs/GIGORMOC_SPEC.md` (full spec), `docs/DESIGN.md` (look and feel), `docs/ROLE_UX.md` (freelancer and client experiences), `docs/REAL_LOGIC_V5.md` (AI onboarding, notifications, messaging, Post gig), `docs/GIG_DELETE_V5_6.md` (deleting a gig: no applicants, pending applicants notified, hired = blocked), `docs/COURSE_REQUIREMENTS_V5_5.md` (course requirements: lockout, password policy, sessions, log trail, admin + user CRUD, in-app dialogs, DB structure doc), `docs/RESILIENCE_V5_4.md` (toasts + notifications, error handling, login/logout, anti-spam, idempotency), `docs/UX_REAL_LOGIC.md` (every UI control must be real logic), `docs/PROFILE_AND_LOOP_V5_1.md` (profile, client details, categories, skills, photos, email, shared loop; it wins over older docs) and `docs/MILESTONES.md` (build order).

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
- **Own-content rule:** nobody applies to, hires, reviews, or reports themselves, and nobody is shown their own gigs as available work. Enforced in the database (not only hidden in the UI). See `docs/ROLE_UX.md` section 4.
- Ratings are stored separately per role (freelancer rating, client rating), so switching never resets or hides reputation.
- 18+ enforced in the database from date of birth (sign-up trigger rejects under 18). DOB is never public.
- Gates enforced in the database: apply (freelancer only) = email confirmed + profile photo + 1 skill + 18+; publish gig = email confirmed + 18+.
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

## Design rules (full details in `docs/DESIGN.md` and `docs/ROLE_UX.md`)
- **Two role experiences:** Find Work (freelancer) and Hire Someone (client) have their own skin, tab labels, Home, Gigs tab, gig action and Activity wording (`docs/ROLE_UX.md`). The skin comes from `profiles.active_mode` through tokens; screens never choose role colors or role wording by hand.
- Styling: **NativeWind v4 + Tailwind CSS v3** (stable). Do not use NativeWind v5 / Tailwind v4 preview setups.
- All colors, fonts, spacing and radii are tokens in `tailwind.config.js`. No raw hex values or one-off styles in screens.
- Build the shared component kit in `components/ui/` first (Button, TextInput, Card, Badge, EmptyState, ErrorState, etc.), then build screens from it.
- Verify setup with ONE token-styled test screen on phone and web before building other screens. Delete it afterwards.
- Look: trustworthy, simple, friendly, local (Ormoc, PHP ₱). Blue family (cobalt for freelancer, navy for client), light theme only in v1.
- Layout: phone = single column + bottom tabs; tablet = side rail/top nav; desktop web = centered content (max ~1120), card grids, two-column detail pages.
- Status badges always show text plus color. Payment wording stays "Reported" / "Confirmed by freelancer". The words "verified" and "guaranteed" never appear in any user-facing string, including for reviews (say "Reviews", not "Verified reviews").
- Use initials avatars, icons and honest empty states. No stock faces, lorem ipsum, fake ratings or counters.
- Reference screenshots in `design/reference/` are visual reference only. Never copy their code, SDKs or data.
- All user-facing text lives in one strings file (ready for Tagalog/Waray/Bisaya later).
- Accessibility: contrast 4.5:1, touch targets 44px+, labels on icon buttons, visible web focus, system font scaling.

## AI, notifications, messaging (v5, see `docs/REAL_LOGIC_V5.md`)
- AI features run ONLY in the Supabase Edge Function `ai-assist` through OpenRouter. `OPENROUTER_API_KEY` is a Supabase secret and `OPENROUTER_MODELS` is an ordered list of three model IDs configured server-side; neither belongs in the app or repo. Auth + per-user rate limit + audit on every call. AI suggests, the user confirms; AI output is never saved without an explicit Save. Never send DOB, phone, email or other users' data to the AI. No canned fallback text when the AI fails: show an error with Retry.
- User-entered skills are real rows (`skills.source = 'user'`, pending admin review) created only through the `add_profile_skills` RPC. This does not break the no-seed rule. Do not create seed skills or categories.
- Reference data such as the Ormoc barangay list (`areas`) is added ONLY if the owner explicitly approves it as an exception; otherwise the admin enters it, and the app uses free text when the table is empty.
- Notifications are rows in `notifications`, created only inside SECURITY DEFINER functions through the internal `notify()` helper. Clients cannot insert or update them (except marking own as read via RPC).
- Messages are sent only through `send_message` (participant check, length, rate limit). Direct inserts are denied.
- "Done" means a second real account sees the result after a fresh launch (REAL_LOGIC_V5.md section 0). Remove any button that is not wired; no dead UI, no in-memory stand-ins for tables.
- The core loop (apply -> accept/counter -> milestones -> submit -> approve -> payment -> review) must work end to end with two real accounts (REAL_LOGIC_V5.md section 8). Status shown in the UI always comes from the database row returned after an RPC, never from local state.

## v5.1 rules (see `docs/PROFILE_AND_LOOP_V5_1.md`)
- Skills are for freelancers only. Clients never see a Skills screen; they have Hiring details (client type, business name, hiring interests) instead. Both are kept when the mode is switched.
- Categories are never a blocker: the poster can pick or type one. New categories are created only through `get_or_create_category` (dedupe, similarity check, limits, audit); the app suggests the best existing category first and a new one is the last resort (PROFILE_AND_LOOP_V5_1.md 2A). No seed categories.
- Profile completeness is computed in the database (`get_profile_completeness`), never stored or trusted from the client. The badge says "Profile complete", never "verified".
- Photos (avatar, portfolio) can be added, changed and removed at any time in both modes, from device storage or camera, with type/size limits.
- Duplicate emails are blocked in the app (handle `user_already_exists` and empty `identities`) and the database stays idempotent.
- Both roles see the same loop stages with a "Next step" banner (who must act).

## v5.2 rule (see `docs/UX_REAL_LOGIC.md`)
- UX is real logic. Every button, filter, badge, counter, banner and state is driven by database data or an RPC result; unwired UI is removed. After any write the screen re-reads the database. No fake loading, no hardcoded counts, no local-only state for database data. Prove each control with two real accounts.

## v5.4 rules (see `docs/RESILIENCE_V5_4.md`)
- Do not break working code: explore read-only first, baseline tests + git tag, small additive changes, NEW migrations only, regression test for every guard, re-run all tests after each step.
- Every write goes through the shared `runOnce()/useAction()` wrapper (in-flight ref lock, disabled button, request_id). Every state-changing RPC is idempotent: row lock, state check, `already_done` result, optional `p_request_id` idempotency key, deduped notifications.
- Every error goes through `AppError` + friendly messages. Login and logout have specific handling; logout always works offline and clears all user data, channels and caches.
- Success is a toast for the actor (after the database confirms); the other person gets an in-app notification. No silent steps.

## v5.5 rules (see `docs/COURSE_REQUIREMENTS_V5_5.md`)
- Additive only: do not rewrite working code. Same safety steps as v5.4 (explore read-only, baseline, new migrations, regression tests).
- No browser/system dialogs (`alert`, `confirm`, `prompt`, `window.*`, `Alert.alert` on web). Use the in-app `ConfirmDialog`, `Toast` and inline banners. A test enforces it.
- Logout always asks "Are you sure you want to logout?" (Yes / Cancel) in-app.
- Password: min 8, upper + lower + number + special, confirm password, enforced in UI and server. Lockout after 3 failures with escalating wait (1/5/15/30/60 min) kept in the database via the `login-guard` Edge Function (service role key only inside the function).
- Admin = `platform_admins.role` (`admin` | `super_admin`), never a mode and never from `user_metadata`. Only admins can read the log trail (via `get_log_trail`); the log is append-only. Users are soft-deleted, never hard-deleted.
- Demo/checking accounts are real accounts created through normal sign-up. Never hard-code or seed accounts.

## v5.6 rule (see `docs/GIG_DELETE_V5_6.md`)
- Gig deletion is a soft delete through `delete_gig` only. Allowed with no applicants, or with pending (`applied`/`countered`) applicants who are each notified once and see their proposal marked "Gig deleted"; blocked when a freelancer is hired or the gig is completed. Idempotent, row-locked, audited, in-app confirmation only.
