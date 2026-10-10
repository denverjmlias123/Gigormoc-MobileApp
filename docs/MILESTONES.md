# Gigormoc — Build milestones

Give the AI ONE milestone at a time. Do not start the next until the previous one is verified.

## v5 status
Milestones 0-9 and retrofits R1-R5 are built. Next, in this order: **R6 (wiring audit)**, **M11 (notifications)**, **M12 (messaging)**, **M13 (Post gig real)**, **M14 (AI onboarding)**. See `docs/REAL_LOGIC_V5.md`. One at a time, verified with real `supabase test db` output.

## Current project status (update this after every milestone)
- Built so far: Milestones 0-7.
- M0-M2 were built on the OLD blueprint (before mode rules, DESIGN.md and the UI kit). M7 was built before these fixes.
- **Next, in this order:** (1) Retrofit audit, (2) Retrofit fix, (3) M7 fix, (4) Milestone 8. Do not start Milestone 8 before 1-3 are verified with real `supabase test db` output.
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
Migration: skills.source/created_by + unique lower(name) index, add_profile_skills RPC (limits, dedupe, audit, rate limit), complete_onboarding RPC; areas table (empty; do NOT insert barangays unless I approve - ask me first). Edge Function supabase/functions/ai-assist (JWT check, allow-listed tasks suggest_skills + draft_bio, server-built prompts, JSON validation, rate limit via rate_limit_events, audit, no personal data sent). Tell me the exact command to set the secret: supabase secrets set ANTHROPIC_API_KEY=... and supabase functions deploy ai-assist. App: step2-skills with catalog chips + "What kind of work do you do?" + Suggest skills + manual add; step3-profile with Barangay (areas table or free text) + bio with "Help me write this" + real photo upload, then complete_onboarding. Errors show Retry; no canned fallback.
Tests: pgTAP for add_profile_skills and complete_onboarding; Edge Function 401/429/400/malformed-output cases. Done when a brand-new account with an EMPTY skills table gets AI suggestions, saves them, and sees them on its profile after relaunch.
First show me a plan, then implement. Run tsc, npm test, supabase test db (paste raw output), repo search, manual steps.
```
