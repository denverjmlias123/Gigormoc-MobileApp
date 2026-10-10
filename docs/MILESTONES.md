# Gigormoc — Build milestones

Give the AI ONE milestone at a time. Do not start the next until the previous one is verified.

## Current project status (update this after every milestone)
- Built so far: Milestones 0-9 (All core features, retrofit fixes, and hardening complete).
- 100% Passing test suite (30/30 unit tests), zero TypeScript errors, clean Expo web export bundle.
- **Active Phase: Milestone 10 — Pilot Testing with ~10 real Ormoc testers.**
- See [docs/PILOT_GUIDE.md](file:///c:/Users/denverjmliaz/Documents/NewAppProject/gigormoc-antigravity/docs/PILOT_GUIDE.md) for the operator dashboard setup, tester walkthrough script, and feedback log sheet.

Every milestone prompt below assumes `AGENTS.md`, `docs/GIGORMOC_SPEC.md` and `docs/DESIGN.md` are read first.

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

## First message to send in Antigravity (once)
```
Read AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md fully. Do not write code yet.
Inspect the existing project and tell me: (1) what already exists, (2) what is missing,
(3) any Appwrite, mock, seed, or demo code that must be removed.
Then wait for me to say "Start Milestone 0".
```

## Template for every milestone
```
Start Milestone <N>: <name>.
Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
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
Start Milestone 0: Setup. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Create the Expo (TypeScript, Expo Router) app shell with 5 tabs (Home, Gigs, Activity, Messages, Profile). Set up NativeWind v4 with Tailwind CSS v3 and the color/type/spacing tokens from docs/DESIGN.md in tailwind.config.js. Verify with one token-styled test screen on phone and web, then delete it. Build the shared components/ui kit (Button, TextInput, Card, Badge, EmptyState, ErrorState, Skeleton). Add lib/supabase.ts using only the public URL and anon key from EXPO_PUBLIC_* env vars. Create supabase/migrations/ and initialize the Supabase CLI project. Show a real empty state where lists will go. Remove any Appwrite code.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 1 — Auth and onboarding
```
Start Milestone 1: Auth and onboarding. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: profiles, profile_private, platform_admins, handle_new_user trigger (idempotent, rejects under 18), RLS. App: 2-step sign-up (name/email/password/terms, then DOB via date picker), log in/out, email confirmation, password reset, 3 onboarding screens: screen 1 (choose Find Work or Hire Someone, no "Explore Both") is required and calls choose_initial_mode; screens 2 and 3 are skippable and save real preferences. profiles has active_mode, mode_changed_at and separate freelancer/client rating columns; active_mode cannot be changed by direct client update. Add pgTAP tests for the trigger and RLS.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 2 — Profile
```
Start Milestone 2: Profile. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: categories, skills, profile_skills, portfolio_items, avatars/portfolio buckets with storage policies. App: edit profile, photo upload, pick skills from database rows, portfolio, public profile view. Categories/skills come only from the database; show an empty state until the admin adds them in the Supabase dashboard.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 3 — Gigs
```
Start Milestone 3: Gigs. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: gigs table, RLS, publish_gig function enforcing gates and requiring active_mode = hire, indexes for search/filter. App: post gig (draft then publish), gig list with search and filters, gig detail, my gigs. Real empty states.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 4 — Applications and agreements
```
Start Milestone 4: Applications and agreements. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: applications, agreements, audit_events, rate_limit_events, functions submit_application (requires active_mode = find_work), respond_to_application, respond_to_counter, and switch_mode implementing every rule in docs/GIGORMOC_SPEC.md section 3A (7-day cooldown; blocked by active/disputed agreements, reported_sent/disputed payments, unresolved reports, suspended status; confirmation cancels open gigs or withdraws pending applications in one transaction; audit event; rate limit). App: Account mode screen under Profile → Settings. One application per gig, one counteroffer round, atomic agreement creation with row locks and a partial unique index. App: apply form, applicants list, accept/counter/decline, Activity tab. Tests for double-accept races.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 5 — Milestones
```
Start Milestone 5: Milestones. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: milestones, submissions, submissions bucket (private), functions define_milestones, submit_milestone, review_milestone. Sum must equal agreed price exactly; max 2 revisions. App: milestone list, submit work with files, approve/request revision.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 6 — Payments
```
Start Milestone 6: Payments. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: payments, receipts bucket (private), functions report_payment, confirm_payment, complete_agreement. App: payment reporting form (method, amount, reference, receipt), freelancer confirm/dispute. UI wording must never say verified or guaranteed.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 7 — Reviews (use R3 above if M7 was already built)
```
Start Milestone 7: Reviews. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: reviews (reviewee_role, hidden flag), agreements.completed_at if missing, submit_review (completed agreements only, participants only, one per party, 14 days from completed_at, comment 10-1000, rate limit, audit, recompute per-role rating from non-hidden reviews in the same transaction). App: review form, ReviewCard, ratings and reviews on public profile (freelancer and client reviews shown separately).
pgTAP behavior tests required (see AGENTS.md rule 5a).
First show me a plan (files + migrations). Then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and paste the raw output of all three, plus: files changed, database objects affected, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 8 — Reports and messages
```
Start Milestone 8: Reports and messages. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Migrations: reports, conversations, messages with RLS and Realtime. cancel_agreement function (sets cancelled_at, never touches completed_at; after work starts it creates a report). admin_hide_review (admin only, audited, recomputes rating). Re-create switch_mode with create or replace so the "unresolved report against the user" blocker reads the reports table. App: report flow with optional evidence image (private bucket, image type/size limits), per-application chat using Realtime (participants only), rate limits on message and report.
pgTAP behavior tests: non-participant cannot read or send messages, reporter sees only own reports, unresolved report blocks switch_mode, hiding a review changes the rating, cancel_agreement wrong user/wrong state/duplicate.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and paste the raw output of all three, plus: files changed, database objects affected, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```

### Milestone 9 — Hardening
```
Start Milestone 9: Hardening. Follow AGENTS.md, docs/GIGORMOC_SPEC.md and docs/DESIGN.md. Build only this milestone.
No demo data, no seed data, no hardcoded sample content.
Audit every table for RLS and grants; confirm direct writes are revoked on protected tables; confirm no SECURITY DEFINER function is executable by anon/public except where intended; confirm no escrow/wallet code exists; verify no service_role key anywhere; add rate limiting and CAPTCHA on sign-up; complete error/empty/loading states; expand pgTAP and function tests (every switch_mode blocker and every mode-gated action); search the repo for seed, mock, demo code. Report real results.
First show me a plan (files + migrations), then implement.
When finished run npx tsc --noEmit, npm test, supabase test db, and report files changed, database objects affected, tests actually run, repo search for seed/mock/demo code, and manual Supabase steps I still need to do.
```
