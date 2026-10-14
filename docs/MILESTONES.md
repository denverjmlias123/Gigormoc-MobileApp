# Gigormoc — Build milestones

Give the AI ONE milestone at a time. Do not start the next until the previous one is verified.

## v5.6 status
Add **M31 (delete gig + notify applicants)**. Spec: `docs/GIG_DELETE_V5_6.md`. It can run any time after M24 (idempotency) is in place, and its notification must follow M25 wording.

## v5.5 status (course requirements, deadline Oct 15-16)
Run **M26 (explore + auth hardening)**, **M27 (lockout + sessions)**, **M28 (log trail)**, **M29 (admin dashboard + user CRUD)**, **M30 (database structure doc)**, then **V3 (checking-day verification)**. These can run before or alongside M22-M25; if time is short do v5.5 first (P0 list in `docs/COURSE_REQUIREMENTS_V5_5.md` section 9). Spec: `docs/COURSE_REQUIREMENTS_V5_5.md`.

## v5.4 status
Project is semi fully working (M0-M21, V2 passed). Next, in this order: **M22 (explore, read-only)**, **M23 (errors + login/logout)**, **M24 (anti-spam + idempotency)**, **M25 (success feedback + notifications)**, then V1 and V2 again. Spec: `docs/RESILIENCE_V5_4.md`.

## v5.2 status
After M16-M20 run **M21 (UX real-logic audit and fix)**, then **V1**. Spec: `docs/UX_REAL_LOGIC.md`.

## v5.1 status
v5 milestones M11-M15 are built. Next, in this order: **M16 (email + profile + photos)**, **M17 (client hiring details, skills fix)**, **M18 (categories not locked)**, **M19 (skills flow)**, **M20 (shared loop banner)**, then re-run **V1**, and finish with **V2 (final live check)**. Spec: `docs/PROFILE_AND_LOOP_V5_1.md`.

## v5 status
Milestones 0-9 and retrofits R1-R5 are built. Next, in this order: **R6 (wiring audit)**, **M11 (notifications)**, **M12 (messaging)**, **M13 (Post gig real)**, **M14 (AI onboarding)**, **M15 (complete real loop, final proof)**. If everything is already built, skip straight to **V1 (full verification)** at the bottom of this file. See `docs/REAL_LOGIC_V5.md`. One at a time, verified with real `supabase test db` output.

## Current project status (update this after every milestone)
  - Historical v3 build: Milestones 0-7. The current v5 milestones below are the active plan.
  - M26 auth UI and M27 lockout/session work are implemented. M27's migration and `login-guard` Edge Function are deployed to the linked Supabase project. M28's audit trail migration and admin log trail are deployed.
  - M29 admin dashboard and user management are implemented. The M29 migration and `admin-users` Edge Function are deployed to the linked Supabase project. Live catalog checks confirm the M29 migration, admin RPCs, and forced-password field are present.
  - M30 `docs/DATABASE_STRUCTURE.md` was generated read-only from the linked live catalog on 2026-10-13 (27 public tables, 124 public routines, 5 Storage buckets). It reports no public tables without a primary key or RLS, no missing core FK relationships, and ten FKs without a full leading-column index. Proposed additive SQL is documented for approval and has not been applied.
  - V3 follow-up: added nested Expo Router layouts for `(auth)` and `(onboarding)` after the root Stack emitted missing-route warnings. `npx expo export --platform web` and `npx expo export --platform android` both passed without those route warnings; localhost returned HTTP 200.
  - M31 delete-gig flow is implemented with additive migrations `20261013110000_m31_delete_gig.sql` and `20261013120000_m31_deleted_state_realtime.sql`; both are applied locally and to the linked Supabase project. The client action soft-deletes only, blocks hired/completed work, closes pending proposals, sends deduplicated notifications, preserves title snapshots, and makes related chats read-only. Manual two-account app verification is still pending; M31 is NOT VERIFIED until the applicant sees the notification/proposal and read-only chat after a fresh launch.
  - Latest local verification after M31: `npx tsc --noEmit` passed; `npm test` passed (165 tests); `npx supabase test db` passed (419 assertions across 28 files). Manual app and two-account verification remains required; V3 is NOT VERIFIED.
  - First admin still must be a real account added to `platform_admins` once. No seed/sample/demo implementation files were found in the repository filename search; test fixtures are temporary and rollback-scoped.
  - **Next:** Manually verify M31 with two real accounts first, then complete V3 checking-day verification. Do not claim full project completion until both have been verified with the real app and two real accounts.
- Skip the "First message" prompt below: the project already exists, so start with R1.
- **Blueprint v4 added role UX and the own-content rule.** If the build is already finished, run **R4** (database) and **R5** (screens) after R1-R3, then repeat Milestone 9 hardening. R4 also tells you what is really built.

Every milestone prompt below assumes `AGENTS.md`, `docs/GIGORMOC_SPEC.md`, `docs/DESIGN.md` and `docs/ROLE_UX.md` are read first.

| # | Milestone | Done when |
|---|---|---|
| 0 | Expo setup, Supabase client, NativeWind v4 theme tokens, shared UI kit, navigation shell, migrations folder | App runs on phone and web; one token-styled test screen proves NativeWind works (then deleted); a read query works under RLS and returns an honest empty state; no seed or sample data anywhere |
| 1 | Auth: sign up, log in/out, email confirmation, profile trigger, onboarding with required mode choice (`choose_initial_mode`) | Real user registers; exactly one profile + one private row; under-18 rejected; cannot reach Home without choosing Find Work or Hire Someone; mode cannot be changed by a direct client update |
| 2 | Profile: photo, bio, skills, portfolio, public view | Persists after logout/login; DOB never in public queries |
| 3 | Gigs: post, list, search/filter, detail | A real gig is visible to a second user; a user in Find Work mode cannot publish |
| 4 | Applications, counteroffer, agreement creation, `switch_mode` with all restrictions | Accepting creates exactly one agreement, even on double tap; a user in Hire mode cannot apply; mode switch is blocked by cooldown, active agreements, pending payments, reports and suspension, and works with confirmation otherwise |
| 5 | Milestones, submissions, approve/revision | Sum validation and revision limit work |
| 6 | Payment reporting and confirmation | Both sides see correct status; receipts private |
| 7 | Reviews and ratings | Rating updates only after completed agreement; 14-day window measured from `completed_at`; ratings recomputed from non-hidden reviews; pgTAP behavior tests pass |
| 8 | Reports and simple messages (Realtime), `admin_hide_review`, `switch_mode` report blocker | Reports saved; chat only between the two parties; a user with an unresolved report cannot switch mode; hiding a review updates the rating |
| 9 | Hardening: RLS audit, rate limits, error states, tests | `tsc`, `npm test`, `supabase test db` pass, including tests for every mode-switch blocker and every mode-gated action |
| 10 | Pilot with ~10 real Ormoc testers | Written list of what confused them |

## Retrofit and fix prompts (run BEFORE Milestone 8, in this order)

### R1 — Retrofit audit (read-only)
```
Do not write code. Read AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md (current versions). This repo was started under an older version of these files. Audit it and give me a gap list with file paths, then wait:
1. profiles columns vs the spec: active_mode, mode_changed_at, per-role rating/count columns, completed-gig counts, and any leftover single rating_avg/rating_count columns.
2. Is active_mode protected from direct client updates? Do choose_initial_mode and switch_mode exist and match spec section 3A (cooldown, blockers, confirmation, audit, rate limit)?
3. Onboarding: is "Explore Both" still present? Is the mode choice required before Home?
4. Are NativeWind v4, tailwind.config.js tokens and components/ui present? List every screen using raw hex colors, inline styles, or its own one-off components.
5. Mode gating inside the database for: submit_application, publish_gig, respond_to_application, define_milestones, submit_milestone, review_milestone, report_payment, confirm_payment.
6. Any simulated escrow, wallet, or payout code or tables (must not exist).
7. The words "verified" or "guaranteed" in any user-facing string.
8. Any seed, mock, demo, or sample-data code.
9. Execute grants: which SECURITY DEFINER functions are executable by anon/public?
10. Run supabase test db and paste the raw output.
```

### R2 — Retrofit fix
```
Fix only the gaps from your R1 audit that I approve below. Use NEW migrations (never edit applied ones). Apply through the Supabase CLI. Follow AGENTS.md rules 5, 5a, 7 and 8. Brand colors: read the exact navy and orange from the logo in assets/ and set them once in tailwind.config.js.
Approved gaps: <paste the numbers/items you approve>
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db and paste the raw output of all three, plus the repo search for seed/mock/demo code.
```

### R3 — Milestone 7 fix
```
Fix Milestone 7 (Reviews). Do not start Milestone 8. Use new migrations only.
1. Add agreements.completed_at (set once inside complete_agreement; backfill existing completed rows from the best available timestamp and tell me what you used). Make sure cancel_agreement and moderator actions never change it.
2. reviews: rename/add reviewee_role (freelancer | client, derived from the agreement), add hidden boolean not null default false, hidden_at, hidden_by. RLS: authenticated read of hidden = false; admins read all; no client insert/update/delete.
3. submit_review: SECURITY DEFINER, explicit search_path, auth.uid(), FOR UPDATE lock on the agreement, completed agreements only, participants only, window = completed_at + 14 days, one review per party, comment 10-1000 chars, rate limit, audit_events row, then recompute the reviewee's per-role avg/count FROM reviews WHERE hidden = false in the same transaction. Revoke execute from public/anon, grant to authenticated.
4. Remove any combined rating_avg/rating_count columns if they exist (after confirming nothing reads them).
5. Replace the shallow pgTAP file with behavior tests: non-participant, agreement not completed, review after 14 days, review at day 14 boundary, duplicate, rating math for both roles, hidden review excluded from the average, direct insert/update/delete denied for authenticated, anon cannot execute submit_review.
6. Replace the word "verified" in any review UI or string with "Reviews".
7. Run npx tsc --noEmit, npm test, supabase test db and paste the raw output.
```

### R4 — Own-content rule audit and fix (database)
```
Read AGENTS.md, docs/GIGORMOC_SPEC.md section 3B and docs/ROLE_UX.md section 4.
Step 1 (read-only): tell me which of these already hold, with file paths, and wait for my approval:
1. submit_application rejects an application to the caller's own gig.
2. An agreement cannot have client_id = freelancer_id (CHECK constraint).
3. submit_review and the report function reject the caller as reviewee / reported user.
4. No query or function returns the caller's own gigs as available work to freelancers.
Step 2 (after I approve): add what is missing in a NEW migration (never edit applied ones). Apply with the Supabase CLI.
Write pgTAP behavior tests for each rule: own gig, wrong state, duplicate call, and a direct client write denied.
Run npx tsc --noEmit, npm test, supabase test db and paste the raw output of all three, plus the repo search for seed/mock/demo code.
```

### R5 — Role UX retrofit (screens)
```
Read docs/ROLE_UX.md fully. Do not change database rules. Show me a plan (files) first, then implement.
1. Add the freelancer and client skin tokens (ROLE_UX.md section 5) in tailwind.config.js and switch them with NativeWind vars() at the root from profiles.active_mode.
2. Tabs: labels and icons by role (section 2). Home by role (section 6).
3. Gigs tab: freelancer browse; client "My gigs" (status filters + Post a gig) and a read-only "Marketplace" segment. Both exclude the viewer's own gigs.
4. Gig detail: one bottom action by viewer and mode (Apply, View applicants, or a disabled action with the reason). Apply screen refuses own gigs.
5. Activity: Proposals / Jobs for freelancers, Applicants / Hired for clients.
6. Then reshape, in this order, using the shared kit: Applicants, Agreement detail, Milestones, Payments, Chat, Public profile, Settings (ROLE_UX.md section 3 is the flow).
Rules: no raw hex or inline one-off styles, copy from the strings file, role is never shown by color alone, every screen keeps loading / empty / error / success states.
Run npx tsc --noEmit, npm test, supabase test db and paste the raw output of all three.
```

## First message to send in Antigravity (once)
```
Read AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md fully. Do not write code yet.
Inspect the existing project and tell me: (1) what already exists, (2) what is missing,
(3) any Appwrite, mock, seed, or demo code that must be removed.
Then wait for me to say "Start Milestone 0".
```

## Template for every milestone
```
Start Milestone <N>: <name>.
Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
Done when: <paste the "Done when" cell>.
Use only the shared UI kit and theme tokens from docs/DESIGN.md. If reference screenshots exist in design/reference/, use them as visual reference only.
No demo data, no seed data, no hardcoded sample content: all data comes from real database rows.
Include the migrations, RLS policies, RPC functions, and tests this milestone needs.
First show me a plan (files + migrations). Then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report: files changed,
database objects affected, tests actually run, repo search result for seed/mock/demo code,
and manual Supabase dashboard steps I still need to do.
```

## Ready-to-paste prompts

### Milestone 0 — Setup
```
Start Milestone 0: Setup. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Create the Expo (TypeScript, Expo Router) app shell with 5 tabs (Home, Gigs, Activity, Messages, Profile). Set up NativeWind v4 with Tailwind CSS v3 and the color/type/spacing tokens from docs/DESIGN.md in tailwind.config.js. Verify with one token-styled test screen on phone and web, then delete it. Build the shared components/ui kit (Button, TextInput, Card, Badge, EmptyState, ErrorState, Skeleton). Add lib/supabase.ts using only the public URL and anon key from EXPO_PUBLIC_* env vars. Create supabase/migrations/ and initialize the Supabase CLI project. Show a real empty state where lists will go. Remove any Appwrite code.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 1 — Auth and onboarding
```
Start Milestone 1: Auth and onboarding. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: profiles, profile_private, platform_admins, handle_new_user trigger (idempotent, rejects under 18), RLS. App: 2-step sign-up (name/email/password/terms, then DOB via date picker), log in/out, email confirmation, password reset, 3 onboarding screens: screen 1 (choose Find Work or Hire Someone, no "Explore Both") is required and calls choose_initial_mode; screens 2 and 3 are skippable and save real preferences. profiles has active_mode, mode_changed_at and separate freelancer/client rating columns; active_mode cannot be changed by direct client update. Add pgTAP tests for the trigger and RLS.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 2 — Profile
```
Start Milestone 2: Profile. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: categories, skills, profile_skills, portfolio_items, avatars/portfolio buckets with storage policies. App: edit profile, photo upload, pick skills from database rows, portfolio, public profile view. Categories/skills come only from the database; show an empty state until the admin adds them in the Supabase dashboard.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 3 — Gigs
```
Start Milestone 3: Gigs. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: gigs table, RLS, publish_gig function enforcing gates and requiring active_mode = hire, indexes for search/filter. App: post gig (draft then publish), gig list with search and filters, gig detail, my gigs. Real empty states.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 4 — Applications and agreements
```
Start Milestone 4: Applications and agreements. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: applications, agreements, audit_events, rate_limit_events, functions submit_application (requires active_mode = find_work), respond_to_application, respond_to_counter, and switch_mode implementing every rule in docs/GIGORMOC_SPEC.md section 3A (7-day cooldown; blocked by active/disputed agreements, reported_sent/disputed payments, unresolved reports, suspended status; confirmation cancels open gigs or withdraws pending applications in one transaction; audit event; rate limit). App: Account mode screen under Profile → Settings. One application per gig, one counteroffer round, atomic agreement creation with row locks and a partial unique index. App: apply form, applicants list, accept/counter/decline, Activity tab. Tests for double-accept races.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 5 — Milestones
```
Start Milestone 5: Milestones. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: milestones, submissions, submissions bucket (private), functions define_milestones, submit_milestone, review_milestone. Sum must equal agreed price exactly; max 2 revisions. App: milestone list, submit work with files, approve/request revision.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 6 — Payments
```
Start Milestone 6: Payments. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: payments, receipts bucket (private), functions report_payment, confirm_payment, complete_agreement. App: payment reporting form (method, amount, reference, receipt), freelancer confirm/dispute. UI wording must never say verified or guaranteed.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 7 — Reviews (use R3 above if M7 was already built)
```
Start Milestone 7: Reviews. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: reviews (reviewee_role, hidden flag), agreements.completed_at if missing, submit_review (completed agreements only, participants only, one per party, 14 days from completed_at, comment 10-1000, rate limit, audit, recompute per-role rating from non-hidden reviews in the same transaction). App: review form, ReviewCard, ratings and reviews on public profile (freelancer and client reviews shown separately).
pgTAP behavior tests required (see AGENTS.md rule 5a).
First show me a plan (files + migrations). Then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and paste the raw output of all three, plus: files changed, database objects affected, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 8 — Reports and messages
```
Start Milestone 8: Reports and messages. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: reports, conversations, messages with RLS and Realtime. cancel_agreement function (sets cancelled_at, never touches completed_at; after work starts it creates a report). admin_hide_review (admin only, audited, recomputes rating). Re-create switch_mode with create or replace so the "unresolved report against the user" blocker reads the reports table. App: report flow with optional evidence image (private bucket, image type/size limits), per-application chat using Realtime (participants only), rate limits on message and report.
pgTAP behavior tests: non-participant cannot read or send messages, reporter sees only own reports, unresolved report blocks switch_mode, hiding a review changes the rating, cancel_agreement wrong user/wrong state/duplicate.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and paste the raw output of all three, plus: files changed, database objects affected, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 9 — Hardening
```
Start Milestone 9: Hardening. Follow AGENTS.md, docs/GIGORMOC_SPEC.md, docs/DESIGN.md and docs/ROLE_UX.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Audit every table for RLS and grants; confirm direct writes are revoked on protected tables; confirm no SECURITY DEFINER function is executable by anon/public except where intended; confirm no escrow/wallet code exists; verify no service_role key anywhere; add rate limiting and CAPTCHA on sign-up; complete error/empty/loading states; expand pgTAP and function tests (every switch_mode blocker and every mode-gated action); search the repo for seed, mock, demo code. Report real results.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```


## v5 prompts (real logic)

### R6 — Wiring audit (read-only, run first)
```
Do not write code. Read AGENTS.md, docs/GIGORMOC_SPEC.md, docs/ROLE_UX.md and docs/REAL_LOGIC_V5.md. Audit the running code and give me a table, with file paths, then wait:
For each of: onboarding step 2 (skills), onboarding step 3 (barangay + bio + photo), Post gig, Browse gigs, Apply, Applicants, Messages list, Chat, Notifications, Activity tabs, Profile edit:
 (a) is it wired to Supabase through services/ (table or RPC)? (b) does anything use in-memory arrays, setTimeout fakes, hardcoded text in place of rows, or dead buttons? (c) does a second real account see the result after a fresh launch? (d) what is missing in the database (table, policy, RPC, trigger, Realtime publication)?
Also report: do the tables notifications, conversations, messages, areas exist? Is Realtime enabled on messages? Is the skills table empty in the dashboard, and why does the app say "No skills catalog available yet"? Run supabase test db and paste the raw output.
```

### M11 — Notifications
```
Start Milestone 11: Notifications. Follow AGENTS.md and docs/REAL_LOGIC_V5.md section 3. Build only this milestone. No seed data.
Migration: notifications table + RLS (recipient select only) + Realtime, internal notify() helper (revoked from public/anon/authenticated), mark_notification_read and mark_all_notifications_read RPCs, and re-create the existing RPCs with create or replace so every event in section 3 inserts the right notification in the same transaction (never to the actor). pg_cron 7-day milestone reminder. App: bell + unread badge (live), Notifications screen with deep links, mark read, empty/error/loading states, strings in the strings file.
pgTAP behavior tests per REAL_LOGIC_V5.md section 7. Done when: client applies/accepts/submits etc. with two real accounts and the other account's bell updates live and survives a fresh launch.
First show me a plan (files + migrations), then implement. Run npx tsc --noEmit, npm test, supabase test db and paste raw output, plus repo search for seed/mock/demo code and manual steps.
```

### M12 — Messaging (real)
```
Start Milestone 12: Messaging. Follow AGENTS.md and docs/REAL_LOGIC_V5.md section 4. Build only this milestone. No seed data.
Make conversations created by the database inside submit_application; add send_message and mark_conversation_read RPCs, conversation_reads table, deny direct inserts on messages, rate limit, new_message notification (collapsed). App: Messages list (name, gig title, last message, unread, ordered by last message), Chat screen on Realtime with failed-send retry, tab badge. Remove any local/in-memory message code.
pgTAP: non-participant read/send denied, direct insert denied, rate limit, unread counts, no self-conversation. Done when two real phones chat live and history persists after relaunch.
First show me a plan, then implement. Run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M13 — Post gig (real)
```
Start Milestone 13: Post gig, real. Follow AGENTS.md and docs/REAL_LOGIC_V5.md section 6. Build only this milestone. No seed data.
Verify and fix app/gigs/post.tsx and services/gigs.ts so every field is validated in the app AND in SQL (publish_gig), pesos -> integer centavos, draft save, publish (idempotent on double tap), edit draft, cancel gig RPC (notifies applicants), pg_cron expiry. Hire mode only; Find Work shows a disabled state with reason. Real empty state if no categories exist. Gig appears for a second account in Browse and never for its owner.
pgTAP: every invalid field, wrong mode, unconfirmed email, duplicate publish, non-owner edit denied, direct status update denied.
First show me a plan, then implement. Run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M14 — AI in onboarding (skills, bio) 
```
Start Milestone 14: AI onboarding. Follow AGENTS.md and docs/REAL_LOGIC_V5.md sections 1, 2 and 5. Build only this milestone. No seed data, no seed skills.
Migration: skills.source/created_by + unique lower(name) index, add_profile_skills RPC (limits, dedupe, audit, rate limit), complete_onboarding RPC; areas table (empty; do NOT insert barangays unless I approve - ask me first). Edge Function supabase/functions/ai-assist (JWT check, allow-listed tasks suggest_skills + draft_bio, server-built prompts, JSON validation, rate limit via rate_limit_events, audit, no personal data sent). Tell me the exact command to set the secret: supabase secrets set <PROVIDER>_API_KEY (GEMINI_API_KEY or ANTHROPIC_API_KEY)=... and supabase functions deploy ai-assist. App: step2-skills with catalog chips + "What kind of work do you do?" + Suggest skills + manual add; step3-profile with Barangay (areas table or free text) + bio with "Help me write this" + real photo upload, then complete_onboarding. Errors show Retry; no canned fallback.
Tests: pgTAP for add_profile_skills and complete_onboarding; Edge Function 401/429/400/malformed-output cases. Done when a brand-new account with an EMPTY skills table gets AI suggestions, saves them, and sees them on its profile after relaunch.
First show me a plan, then implement. Run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M15 — Complete real loop (apply, accept, submit, approve, pay, review)
```
Start Milestone 15: Complete real loop. Follow AGENTS.md and docs/REAL_LOGIC_V5.md sections 0 and 8. Do this AFTER M11-M14. No seed data, no mock data.
Part 1 (read-only): walk the table in section 8 step by step against the code and database. For each step list: screen file, service function, RPC, whether it is wired, whether the notification is created, whether the other account sees it after relaunch, and the gap. Wait for my approval.
Part 2: fix every gap with NEW migrations and thin screens (no edits to applied migrations). Specifically make real: apply (price/days/message), accept / counter / decline and counter response, atomic agreement creation, define milestones (sum check), submit work with real file upload to the private submissions bucket and signed-URL viewing, approve / request revision (max 2), report payment with optional receipt, confirm / dispute payment, complete_agreement, reviews, cancel_agreement. Status always comes from the database after each RPC; remove any local status logic.
Part 3: write docs/E2E_LOOP.md with a two-account test script (steps 1-10 plus a revision round, a counteroffer, a dispute and a cancellation) and pgTAP behavior tests for every RPC in the loop: wrong user, wrong mode, wrong state, duplicate call, own gig, direct write denied.
Run npx tsc --noEmit, npm test, supabase test db and paste raw output, plus repo search for seed/mock/demo code, dead buttons and local-only state, and manual steps. Mark NOT VERIFIED if anything could not run.
```

### V1 — Full verification (run when everything is implemented; read-only)
```
Do NOT write or change any code yet. This is a full verification of the whole app.
Read AGENTS.md, docs/GIGORMOC_SPEC.md, docs/ROLE_UX.md and docs/REAL_LOGIC_V5.md first.
Everything is supposedly implemented. Prove it. Never claim something works unless you actually ran or inspected it. If something cannot be run, mark it NOT VERIFIED and say why.

PART 1 - Run and paste the RAW output of:
  npx tsc --noEmit
  npm test
  supabase test db
  supabase db lint (or the security advisor) and a list of every table with RLS on/off
  supabase functions list (is ai-assist deployed? is <PROVIDER>_API_KEY (GEMINI_API_KEY or ANTHROPIC_API_KEY) set as a secret? never print the secret)

PART 2 - Repo search (list file paths, expected result is NONE):
  seed.sql or seed scripts, hardcoded sample arrays standing in for database rows, mock services, demo logins,
  setTimeout fake loading, "TODO"/"coming soon"/dead buttons with no handler, local-only state used instead of
  database state, the words "verified" or "guaranteed" in user-facing strings, any service_role key or AI key in
  the app or EXPO_PUBLIC_* variables, any Appwrite code, any escrow/wallet code, raw hex colors in screens, and every forbidden pattern in docs/UX_REAL_LOGIC.md section 2.

PART 3 - Feature wiring table. For EACH row give: screen file, service function, table/RPC used, wired
(yes/no), notification created (yes/no), shows loading/empty/error states (yes/no), and what is missing:
  Onboarding 1 mode choice | Onboarding 2 skills + AI suggestions | Onboarding 3 barangay + bio + AI help + photo
  Post gig (draft, publish, edit, cancel) | Browse and search gigs (own gigs excluded) | Apply
  Applicants: accept / counter / decline | Counter response | Agreement creation (exactly one)
  Define milestones | Submit work with real file upload | Approve / request revision (max 2)
  Report payment + receipt | Confirm / dispute payment | Complete agreement | Reviews + per-role ratings
  Cancel agreement | Messages list + Chat (Realtime, unread) | Notifications (bell, list, mark read, deep links)
  Reports | Mode switch (cooldown + every blocker + confirmation) | Profile edit, skills, portfolio
  Activity tabs for both roles | Role skin and tab labels per mode

PART 4 - Database and security checks (prove with queries or pgTAP, not by reading):
  Every protected RPC rejects: wrong user, wrong mode, wrong state, duplicate call. Direct client writes are
  denied on gigs status, applications, agreements, milestones, payments, reviews, notifications, messages,
  profiles.active_mode, skills. anon cannot execute any SECURITY DEFINER function. Own-content rule holds
  (self-apply, self-hire, self-review, self-report). Money is integer centavos. completed_at is set once.
  Private buckets (submissions, receipts) are not readable by non-participants. 18+ gate rejects a bad DOB.
  AI function: 401 without login, 429 over limit, no personal data sent, no saving without user confirmation.

PART 5 - Two-account end-to-end test (follow docs/E2E_LOOP.md or create it): Account A (Hire) and Account B
  (Find Work). Walk: publish gig, apply, accept, milestones, submit with file, revision round, approve,
  report payment, confirm, complete, both reviews, chat at every step, notification at every step. Also run one
  counteroffer, one dispute and one cancellation. Record PASS/FAIL per step against the real tables.

OUTPUT: one report with (1) a PASS / FAIL / NOT VERIFIED table for every item above, (2) a prioritized
list of bugs and gaps with file paths, (3) the exact manual Supabase dashboard steps I still must do.
Then STOP and wait for me to say which fixes to make. Fix only with NEW migrations, never edit applied ones.
```


## v5.1 prompts

### M16 — Duplicate emails, profile details, completeness mark, photos
```
Start Milestone 16. Follow AGENTS.md and docs/PROFILE_AND_LOOP_V5_1.md sections 5 and 6. Build only this. No seed data.
1) Email: normalize (trim, lowercase); handle user_already_exists AND signUp returning empty identities; show "This email is already registered. Log in or reset your password." with buttons; never advance to step 2 or create a second profile; disable the button while pending. Add pgTAP/Node tests (same email twice, different case, double tap).
2) get_profile_completeness(p_profile_id) in SQL (percent, complete boolean, missing items) per role checklist; progress ring + tappable missing items + "Profile complete" check badge (own and public profile). Never use the words verified/guaranteed. Notification profile_complete once.
3) Expand Edit profile with the fields in section 5.2 (new migration for new columns/RPC update_profile_details, validation in SQL, phone only in profile_private, unsaved-changes guard).
4) Photos: add/change/remove avatar at any time from Profile and Edit profile in BOTH modes using expo-image-picker (library + camera, web file picker), crop square, resize 1024px, jpeg/png/webp, max 5MB, path {user_id}/avatar-{timestamp}.jpg, delete old object, failed upload never changes profile. Same picker for portfolio.
Show plan first. Then run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M17 — Clients have no skills (hiring details instead)
```
Start Milestone 17. Follow AGENTS.md and docs/PROFILE_AND_LOOP_V5_1.md section 3. Build only this. No seed data.
Remove every Skills screen, requirement and mention shown to clients (onboarding step 2, profile, settings, public profile). Add client_type, business_name, about_hiring columns and profile_hiring_interests (max 8, categories) with RLS and an RPC, hiring-details UI in onboarding step 2 (hire mode) and Edit profile, AI task suggest_categories in ai-assist, client public profile fields. Skills and hiring interests are kept (hidden) on mode switch. add_profile_skills must reject hire mode. Publishing a gig needs no skills.
Tests: client cannot add skills, interests limit, persist across mode switch.
Show plan first. Then run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M18 — Post gig category is not locked
```
Start Milestone 18. Follow AGENTS.md and docs/PROFILE_AND_LOOP_V5_1.md section 2. Build only this. No seed categories.
Migration: categories.source/created_by, unique lower(trim(name)), get_or_create_category RPC (3-40 chars, allowed characters, no URL/phone/email/profanity, case-insensitive dedupe returns existing id, 3 new per 24h and 10 per user, audit, rate limit), create_draft_gig accepts p_category_id OR p_category_name. UI: searchable category picker with "Add '<text>' as new category". Remove the "No categories yet" block. Browse filters list admin categories plus user categories used by 2 different posters (or admin-activated).
Suggest first, create last (docs/PROFILE_AND_LOOP_V5_1.md section 2A): enable pg_trgm, RPC suggest_categories_for_gig (top 3 existing categories by similarity/keywords), Edge Function task suggest_gig_category (server loads active categories; AI may only return ids from that list; never writes), "Did you mean...?" while typing, similarity check inside get_or_create_category (reject names too close to an existing one and return the existing id), optional AI-proposed general name for a new category, admin_merge_categories (admin only, audited), fallback to database suggestions when the AI fails.
Extra tests: similar names (case/plural/typo) return existing, too-close new name rejected, AI ids limited to active list, merge moves gigs, <2 posters hidden from shared filters, AI failure falls back to DB suggestions.
Tests: dedupe across case/spacing, limits, invalid input, anon denied, direct insert denied.
Show plan first. Then run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M19 — Skills flow: show, save, manage
```
Start Milestone 19. Follow AGENTS.md and docs/PROFILE_AND_LOOP_V5_1.md section 4. Build only this. No seed skills.
Onboarding step2-skills (Find Work only): "Your skills (n)" tray showing every selected skill (catalog, AI, typed) as removable chips; Save calls add_profile_skills then re-fetches from the database and shows Saved. app/profile/skills.tsx loads the same saved skills after relaunch, lets the user add more with the restrictions (max 15 per profile, 5 new custom per 24h, 2-40 chars, allowed characters, no URL/email/phone/profanity, case-insensitive dedupe) and remove via remove_profile_skill (warn if it leaves 0).
Tests: selected set equals saved set, appears in Manage skills after relaunch, limits, dedupe, remove, wrong mode denied.
Show plan first. Then run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```

### M20 — Shared loop view for both roles
```
Start Milestone 20. Follow docs/PROFILE_AND_LOOP_V5_1.md section 1 and docs/ROLE_UX.md. Build only this.
Add the shared Timeline with the stages and a "Next step" banner (who must act) to the agreement screen, Activity rows and gig detail, for both roles, driven only by database status. Notifications and chat deep-link to the right stage. Do not change database rules.
Verify with two accounts that both banners and stages match after a relaunch at every stage. Show plan first. Then run tsc, npm test, supabase test db (paste raw output), repo search.
```


### M21 — UX real-logic audit and fix
```
Start Milestone 21. Follow AGENTS.md and docs/UX_REAL_LOGIC.md fully.
Part 1 (read-only): go screen by screen under app/ for BOTH modes. For every interactive control, filter, badge, counter, banner and form, list: file, handler, service/RPC, table read, and whether it meets the 10-point control contract (section 1). Run the forbidden-pattern repo searches (section 2) and list every hit with file:line. Fill the section 3 table. Wait for my approval.
Part 2: fix every failing item with thin screens and NEW migrations only (never edit applied ones): wire it, or remove it. Add missing loading/empty/error/success states, pending-disable, SQL-error-to-friendly-message mapping from the strings file, re-fetch after writes, cache and Realtime cleanup on logout and mode switch, safe back navigation.
Part 3: prove with two real accounts (A in Hire, B in Find Work): for each row in the section 3 table record the table + row id that changed and what the other account saw after a fresh launch. Mark PASS / FAIL / NOT VERIFIED. Fix FAILs.
Run npx tsc --noEmit, npm test, supabase test db and paste raw output, plus the repo search results (must be none) and manual Supabase steps.
```

### V2 — Final live check (read-only first; run against the real Supabase project and the running app)
```
Do NOT change code or data until I approve. Prove each item with real queries, real app runs and raw output. Never claim PASS without evidence; use NOT VERIFIED if you could not run it. Never print secrets or keys.

A. DATABASE RELATIONS AND BACKEND
 1. List every table in public with its primary key, foreign keys (table.column -> table.column), unique constraints and RLS on/off. Flag any table without RLS, any expected relation missing, any orphan-prone column without a FK (check at least: profiles, profile_private, profile_skills, profile_hiring_interests, skills, categories, gigs, applications, agreements, milestones, submissions, payments, reviews, conversations, messages, conversation_reads, notifications, reports, audit_events).
 2. Run orphan queries (rows whose parent is missing) for every FK and paste counts (expected 0).
 3. List every RPC with SECURITY DEFINER, its search_path, and who can execute it (anon/public must be none). List Realtime publication tables, storage buckets and their policies, pg_cron jobs, and whether Edge Function ai-assist is deployed and its secret is set (do not print it).
 4. Run npx tsc --noEmit, npm test, supabase test db and paste raw output.

B. ACCOUNT CREATION AND SKILLS
 5. Create a NEW real freelancer account in the running app. Try the same email again (and with different upper/lower case): it must be blocked with the "already registered" message and create no new profiles/profile_private rows.
 6. Onboarding step 2: use the AI suggestion, pick several suggested skills plus one typed skill, Save. Show the rows created in skills and profile_skills (ids, source, is_active), the "Your skills" tray content, and that the SAME skills appear in Profile > Manage skills and on the public profile after a full app relaunch. Show a restriction being enforced (duplicate or over-limit) and a skill removal.
 7. Create a NEW real client account: confirm there is NO skills screen, hiring details are saved (client type, interests) and shown on the profile; check the profile-complete mark/percentage for both accounts and that photo add/change/remove works from device storage in both modes.

C. THE FULL JOB LOOP (Account A = client in Hire mode, Account B = freelancer in Find Work mode, two separate sessions)
 8. A posts a gig (pick a suggested category, then also test typing a new one that is similar to an existing one: it must propose the existing one). Show the gigs row, A's Dashboard / My gigs showing it as Open, and B's Browse showing it (A's own gig must not appear for A in Browse).
 9. B applies (price, days, message). Show applications + conversations rows, A's Applicants list and A's bell notification arriving live.
 10. A accepts. Show exactly ONE agreement (price copied, client_id <> freelancer_id), gig status in_progress, B's Jobs tab, notifications to both. Test double-tap accept and a counteroffer path.
 11. A defines milestones (sum must equal price), B submits work with a real file upload (check the private submissions bucket path and that a non-participant cannot read it), A requests one revision then approves, A reports payment, B confirms, agreement completes (completed_at set once), both leave reviews, ratings recomputed per role. Chat both ways at each stage.
 12. For every step record: the table/row id that changed, the notification created, and what the OTHER account saw after a fresh app relaunch. Show the Timeline stage and "Next step" banner match for both roles.

D. SECURITY SPOT CHECKS (prove with queries as an authenticated non-owner)
 13. Direct client writes denied on gigs.status, applications, agreements, milestones, payments, reviews, notifications, messages, profiles.active_mode, skills, categories. Self-apply, self-hire, self-review and self-report are rejected. Wrong-mode actions are rejected.

OUTPUT: a table of every numbered item with PASS / FAIL / NOT VERIFIED and evidence, a prioritized bug list with file paths, and the manual Supabase steps still needed. Then STOP and wait for my approval before fixing (new migrations only; never edit applied ones).
```


## v5.4 prompts (do not break current code)

### M22 — Explore first (read-only; run this before anything else)
```
Do NOT write or change any code. Read AGENTS.md and docs/RESILIENCE_V5_4.md fully. Then explore the whole repo and the live database and tell me exactly what to add. First record the baseline: run npx tsc --noEmit, npm test and supabase test db and paste raw output; tell me whether the repo is under git and suggest the baseline commit/tag command.
Produce four lists with file:line evidence:
1. FEEDBACK GAPS: every RPC and every screen that changes state but gives the actor no toast, or gives the other person no notification (check every RPC in the v5 list: publish_gig, cancel_gig, submit_application, respond_to_application, respond_to_counter, define_milestones, submit_milestone, review_milestone, report_payment, confirm_payment, dispute_payment, complete_agreement, cancel_agreement, submit_review, send_message, switch_mode, profile/skills/photo saves, reports). List which reminders (section 1) are missing.
2. ERROR GAPS: places with raw error text, silent catch, alert(), missing loading/error states, missing offline handling, missing timeout, session-expiry handling, missing root error boundary. Read login, signup, forgot-password, logout and onAuthStateChange code line by line: what happens on wrong password, unconfirmed email, offline, expired session, double tap on login, double tap on logout, logout while offline, logout then login as another user (stale data? stale Realtime channels? stale caches?).
3. DUPLICATE RISKS: for every state-changing RPC and button, can it run twice? Show how a double tap or two devices could produce a duplicate (double approve milestone, double submit/deliver, double payment report, double accept, double review, double message, double notification). Look at the real SQL: is there FOR UPDATE, a state check, a unique constraint, a dedupe key? Try it for real with parallel calls on two sessions of the same user and report what happened.
4. RISK TO EXISTING CODE: which of the proposed changes touch shared code (Button, services, RPCs) and what regression tests protect them.
Then give me a prioritized plan with the exact files and migrations for M23, M24 and M25, and STOP and wait for my approval.
```

### M23 — Error handling and login/logout
```
Start Milestone 23. Follow AGENTS.md and docs/RESILIENCE_V5_4.md sections 0 and 2. Baseline first (tests + git tag). Build only this milestone, additive and small.
Add AppError + central handler (extend mapSqlErrorToFriendlyMessage), offline banner, request timeout with Retry, single-flight session refresh and one retry on 401, root error boundary, field-level form errors. Login (section 2A): specific safe messages, resend confirmation (rate limited), in-flight lock, single replace navigation. Logout (section 2B): in-flight lock, signOut local scope so it works offline, one shared cleanup routine (session, caches, Realtime channels, private image caches, drafts, badge counts) also used by mode switch, router.replace to Welcome, SIGNED_OUT handled once with "You were logged out", optional log out of all devices.
Tests: each error kind maps to the right message, login double tap = one request, logout offline still logs out, logout then login as another user shows no previous data and no old channels.
Show plan first. Then run tsc, npm test (must still include all earlier tests), supabase test db, paste raw output.
```

### M24 — Anti-spam clicks and two-device idempotency
```
Start Milestone 24. Follow AGENTS.md and docs/RESILIENCE_V5_4.md sections 0 and 3. Baseline first. Build only this milestone, additive, NEW migrations only (create or replace function that keeps existing behavior).
Client: shared runOnce()/useAction() with an in-flight ref lock, Button ignores presses while loading and has a short cooldown, request_id per attempt reused on retry, navigate with replace after success, dedupe Realtime events by id, debounce refresh/search. Apply it to EVERY write button (approve/request revision, submit work, report/confirm payment, accept/counter/decline, apply, publish, cancel, review, send message, profile saves, uploads).
Database: idempotency_keys table (internal, RLS on, pg_cron cleanup after 24h) and optional p_request_id on state-changing RPCs; state-machine guards with FOR UPDATE returning already_done instead of repeating or raising; unique constraints listed in section 3B (milestone submission number, open payment per agreement/milestone, one review per agreement+reviewer, etc.); notifications.dedupe_key with unique index and on conflict do nothing. App shows "Already done on your other device" and refreshes on already_done.
Tests (section 3C): parallel calls from the same user and from two sessions give exactly one effect per RPC; 10 rapid presses call the service once; replay with same request_id returns the original result. Include existing duplicate rows check: report any existing duplicates in the database and propose a cleanup migration for approval.
Show plan first. Then run tsc, npm test, supabase test db, paste raw output.
```

### M25 — Success feedback and notifications for every step
```
Start Milestone 25. Follow AGENTS.md and docs/RESILIENCE_V5_4.md section 1. Baseline first. Build only this, additive.
Add a Toast component (success/error/info, accessible, auto-dismiss, one at a time) shown only after the database confirms a write, for every action in section 1 (publish gig, send application, accept/counter/decline, define milestones, submit work, approve/revision, report/confirm payment, complete, cancel, review, message, profile/skills/photo saves, mode switch, report filed). Fill every notification gap from the M22 list through notify() with dedupe keys, role wording from the strings file and deep links. Add the pg_cron reminders (milestone awaiting review 3/7 days, payment awaiting confirmation 2 days, review window closing, application deadline 24h, gig expired, agreement deadline 48h), each deduped.
Tests: each RPC creates exactly one notification for the right recipient and none for the actor; reminders do not repeat; toast not shown on error.
Show plan first. Then run tsc, npm test, supabase test db, paste raw output, then re-run V1 and V2.
```


## v5.5 prompts (course requirements; do not break current code)

### M26 — Explore + login, logout, password, in-app dialogs
```
Start Milestone 26. Follow AGENTS.md and docs/COURSE_REQUIREMENTS_V5_5.md sections 1-3 and docs/RESILIENCE_V5_4.md section 0. FIRST do a read-only exploration and wait for my approval: record the baseline (tsc, npm test, supabase test db, git tag), then list for the traceability table in section 1 what already exists with file paths, and every use of alert, confirm, prompt, window.* dialogs or Alert.alert in app/, components/, services/, lib/, utils/ (including lib/dialog.ts). Show a plan of files and migrations.
After approval implement additively: in-app ConfirmDialog and Toast everywhere (replace every browser/system dialog), logout confirmation "Are you sure you want to logout?" with Yes, log out / Cancel then the cleanup and router.replace to Login, login messages (empty fields, success toast, incorrect email or password, account not found with Sign up button via a flag SHOW_ACCOUNT_NOT_FOUND, locked, unconfirmed with resend, suspended, offline), password policy (min 8, upper, lower, number, special, no spaces, confirm password, live checklist and strength meter) in the UI and enforced on the server for signup, reset, change password; add a Change password screen.
Tests: a repo test fails if any browser/system dialog API is used; password rule matrix; logout Cancel changes nothing; each login message appears. Run tsc, npm test (all earlier tests must pass), supabase test db, paste raw output.
```

### M27 — Lockout and sessions
```
Start Milestone 27. Follow AGENTS.md and docs/COURSE_REQUIREMENTS_V5_5.md sections 4 and 6. Baseline first. Additive, NEW migrations only.
Database: login_attempts (RLS on, no client access) and user_sessions tables, RPCs start_session / heartbeat / end_session / list_my_sessions / end_other_sessions, admin RPC to unlock an account. Edge Function login-guard with actions check / failure / success (service role key only inside the function, never in the app): lock after 3 consecutive failures for 1 min, then 5, 15, 30, 60 min (cap), reset on success or after 24h; same behavior for unknown emails; a locked account cannot log in even with the correct password; double tap counts once. App: attempts-left hint, disabled button with live countdown that survives restart, idle timeout 30 min with "Your session expired due to inactivity", heartbeat throttled to 5 min, Active sessions screen (log out this device / other devices), suspended or deleted users signed out on next heartbeat.
Tests per section 4 plus session lifecycle. Run tsc, npm test, supabase test db, paste raw output.
```

### M28 — Log trail (admin-only)
```
Start Milestone 28. Follow AGENTS.md and docs/COURSE_REQUIREMENTS_V5_5.md section 6A. Baseline first. Additive, NEW migrations only.
First read-only: list which activities already write audit_events and which do not (every activity in section 6A). Then extend so every activity is logged by the database in the same transaction (use create or replace on the existing RPCs, keeping behavior), including failed logins (via login-guard), logins, logouts, session expiry, password changes, admin actions and viewing the log trail. Never store passwords, tokens or message text. Make the log append-only (trigger blocks update/delete), RLS denies direct client access, and add RPC get_log_trail(filters, page) that checks is_admin(). Screen app/admin/log-trail.tsx with search, filters (user, action, status, date range, entity), pagination, row detail and CSV export for admins; non-admins get "You don't have access" by URL or API.
Tests: each activity creates exactly one row, failed login logged without actor, non-admin denied, update/delete blocked. Run tsc, npm test, supabase test db, paste raw output.
```

### M29 — Admin role, dashboard and User CRUD
```
Start Milestone 29. Follow AGENTS.md and docs/COURSE_REQUIREMENTS_V5_5.md section 5. Baseline first. Additive, NEW migrations only.
Add platform_admins.role (admin | super_admin) and is_admin() / is_super_admin() functions (never user_metadata). Admin dashboard (all numbers from queries: total users, new users 7 days, active gigs, agreements in progress, completed, open reports, locked accounts, today's log events, latest activity) and links to existing admin tools. User Management: create user (Edge Function with service role, temporary password meeting the policy, must_change_password at first login), searchable filterable paginated list and detail, update (name, area, status active/suspended, reset lockout, send password reset, change admin role only by super_admin), soft delete (status deleted, anonymize personal fields, end sessions, block login, blocked while active agreements or payments awaiting confirmation, confirm by typing the email in the in-app dialog). Admin cannot suspend or delete themselves or the last super_admin. Every action is audited and toasts on success. Route guard for app/admin/*.
Tests: non-admin denied on every admin RPC, last super_admin protected, soft delete keeps agreements and logs, deleted user cannot log in. Run tsc, npm test, supabase test db, paste raw output.
```

### M30 — Database structure document (IAS)
```
Start Milestone 30. Follow docs/COURSE_REQUIREMENTS_V5_5.md section 7. Read-only against the live database. Generate docs/DATABASE_STRUCTURE.md from the LIVE schema (queries on information_schema and pg_catalog, not from memory): every table with purpose, columns, types, constraints, primary and foreign keys, unique and check constraints, indexes, RLS policy summary, functions and buckets, plus a Mermaid erDiagram grouped by area with cardinalities, and a one-page script for demonstrating the relationships. Report any table without a primary key, any FK without an index, and any missing relationship, and propose fixes as new migrations for my approval. Do not change data.
```

### V3 — Checking-day verification (Oct 15-16)
```
Read-only first. Verify with real evidence (queries, app runs on two devices, raw output) and mark PASS / FAIL / NOT VERIFIED:
1. Login: empty fields, wrong password (attempts left), unknown email, success toast then dashboard; show/hide password; loading indicator.
2. Lockout: 3 wrong passwords lock for 1 min with countdown; correct password rejected during the lock; next lock is longer; success resets; survives app restart.
3. Password policy and confirm password on signup, reset, change password and admin-created user (weak passwords rejected in UI and by a direct API call).
4. Logout: confirmation dialog Yes / Cancel; cancel does nothing; yes ends the session and returns to Login; Back cannot return; works offline.
5. No browser/system dialogs anywhere: click every button once on web and mobile; run the repo test.
6. Sessions: login/logout rows, idle timeout, active sessions list, end other sessions.
7. Log trail: perform one action of every type and show one log row each; non-admin cannot read it by UI, URL or API; rows cannot be edited or deleted.
8. Admin: dashboard numbers match the database; User CRUD (create, read/search, update, suspend, soft delete) with in-app confirmations and audit rows; admin cannot delete self or last super_admin.
9. Full transaction cycle on two devices (post gig -> apply -> accept -> milestones -> submit -> approve -> payment -> complete -> review), each step stored in its table and visible to the other role, with in-app toasts and notifications only.
10. docs/DATABASE_STRUCTURE.md matches the live schema.
Also run tsc, npm test, supabase test db and paste raw output. Then STOP and give me a prioritized fix list; fix only with new migrations after my approval.
```


### M31 — Delete a posted gig and notify applicants
```
Start Milestone 31. Follow AGENTS.md and docs/GIG_DELETE_V5_6.md and docs/RESILIENCE_V5_4.md section 0. FIRST read-only: show how cancel_gig, gigs RLS, applications, conversations and the Proposals/My gigs screens work today, and wait for my approval of the plan (files + one NEW migration). Baseline first (tsc, npm test, supabase test db, git tag).
Implement additively: gigs.deleted_at/deleted_by/delete_reason, applications.status_reason + gig_title_snapshot, conversations.closed_at/closed_reason, RPC delete_gig(p_gig_id, p_reason, p_request_id) per section 2 (row lock, owner check, already_done, block when an agreement exists, decline pending applicants, one deduped gig_deleted notification each, close conversations with a system message, audit row), gig_unavailable error in submit_application and respond_to_*, hide deleted gigs from browse/search/counts/categories, applicant-readable closed proposal without opening gig RLS. App: Delete gig action with in-app ConfirmDialog variants (no applicants / N applicants / hired = disabled with reason), success toast with applicant count, "Gig deleted" badge in Proposals, read-only chat, friendly screen when opening a deleted gig, Apply screen handles gig_unavailable.
Tests per section 5 including parallel calls. Run tsc, npm test (all earlier tests must pass), supabase test db and paste raw output. Then verify with two real accounts: applicant applies, client deletes, applicant gets the live notification and sees the closed proposal.
```
