# Gigormoc — MVP Spec v3 (Expo + Supabase)

Solo-developer edition. Ormoc City only. 18+ only. Backend is 100% Supabase. No demo data and no seed data.

## 1. Product
Gigormoc is a local, skills-first freelance marketplace. People with real skills but little formal credentials find gigs, complete them, and build a trusted work history through completed gigs and reviews. Each account has one active mode at a time, **Find Work** or **Hire Someone**, and switching is restricted. Gigormoc does not hold money (no escrow, no wallet balances, no simulated payouts). Payments happen outside the app (GCash, Maya, PayPal, cash) and are only **reported and confirmed** in the app.

**Core loop (only thing v1 must do well):** Post gig → Apply with a price → Client accepts (or counters once) → Milestones → Client reports payment → Freelancer confirms → Both review.

## 2. Audience and launch
Students, fresh graduates, part-timers, self-taught workers, small business owners in Ormoc. Smartphone-first; web uses the same Expo codebase. Initial categories (admin-entered rows, never hardcoded): tutoring, graphic design, social media help, repair/services, photography, data entry.

## 3. Accounts, modes, gates
- Supabase Auth, email + password. Sign-up collects name, email, password, date of birth, terms acceptance.
- Each user has ONE active mode at a time: **Find Work** (freelancer) or **Hire Someone** (client). There is no "Explore Both". Switching is restricted (section 3A).
- Platform admin = row in `platform_admins` (no client write access).
- Onboarding: (1) **required**: choose Find Work or Hire Someone, with the note "You can switch later, but only under certain conditions." (2) Find Work: pick skills; Hire Someone: hiring details (client type, what you usually need) - skippable, (3) photo, area and short intro (skippable). Clients have NO skills (see `docs/PROFILE_AND_LOOP_V5_1.md`).

| Action | Requirement (enforced in DB) |
|---|---|
| Browse gigs | Logged in |
| Apply | Mode = Find Work, email confirmed, profile photo, ≥1 skill, 18+, account active |
| Publish gig | Mode = Hire Someone, email confirmed, 18+, display name set, account active |
| Review | Participant of a completed agreement, within 14 days |

Phone OTP is deferred to v1.1.

## 3A. Role mode rules (locked)
One account, one active mode. The mode is stored in `profiles.active_mode` (`find_work` or `hire`), is empty until the user chooses at onboarding, and changes only through two database functions: `choose_initial_mode` (allowed only while the mode is empty) and `switch_mode`.

**What each mode can do (enforced in the database)**
| Mode | Allowed | Not allowed |
|---|---|---|
| Find Work | Browse, apply, withdraw application, accept/decline counteroffer, submit milestone work, confirm or dispute a received payment | Publish gigs, accept applicants, approve milestones, report payments |
| Hire Someone | Browse, publish and manage gigs, accept/counter/decline applicants, define milestones, approve or request revision, report payment | Apply to gigs, submit work, confirm payments |

In any mode the user can view their own history, message participants, leave reviews, file reports, and edit their profile.

**Switching is blocked when any of these is true** (`switch_mode` returns a clear reason shown in the app)
1. The cooldown has not passed: **7 days** since the last switch (constant `MODE_SWITCH_COOLDOWN_DAYS = 7`). The first choice at onboarding does not start the cooldown.
2. The user is a participant in any agreement with status `active` or `disputed`.
3. The user is a participant in any payment with status `reported_sent` (awaiting confirmation) or `disputed`.
4. There is an unresolved report or dispute against the user.
5. The account is not `active` (for example suspended).

**Switching needs explicit confirmation when**
- Switching from Hire Someone: all of the user's `draft` and `open` gigs are cancelled and their pending applicants are notified.
- Switching from Find Work: all of the user's pending applications (`applied`, `countered`) are withdrawn.

The confirmation screen lists exactly what will happen. Everything happens in one transaction, writes an `audit_events` row, and is rate-limited.

**Reputation stays with the role.** Ratings and completed-gig counts are tracked separately for the freelancer role and the client role, so switching modes never resets, hides or transfers reputation. Public profiles show both histories.

**Where the user switches:** Profile → Settings → Account mode. There is no quick toggle on Home. Home only shows the current mode label, which opens the Account mode screen. The screen shows the current mode, the cooldown status, and any blockers in plain words (for example "Finish your active agreement first").

## 3B. Own-content rule (locked)
Because one account can be both roles over time, nobody is shown or allowed to act on their own content as someone else's.
- Gigs posted by the user are excluded from the freelancer feed and from the client Marketplace view; they appear under "My gigs".
- `submit_application` rejects an application to the caller's own gig.
- An agreement can never have the same user as client and freelancer (CHECK constraint).
- `submit_review` and the report function reject the caller as reviewee / reported user.
- Any future recommendation or suggestion feature must exclude the viewer.
The UI hides these cases, and the database enforces them. Details: `docs/ROLE_UX.md` section 4.

## 4. Screens
Tabs (routes): Home · Gigs · Activity · Messages · Profile. Labels and content depend on the mode: freelancer = Discover, Browse, My work; client = Dashboard, My gigs, Hires (`docs/ROLE_UX.md`).
- Auth: Welcome, Sign up (2 steps), Log in, Confirm email, Forgot password
- Onboarding: 3 screens (mode choice is required, the other two can be skipped)
- Home: mode-aware (Find Work: new gigs by category; Hire Someone: my gigs + Post a gig). Shows the current mode label only; no switch toggle
- Account mode (Profile → Settings): current mode, cooldown, blockers, confirmed switch flow
- Gigs: freelancer = browse list, search, filter (category, remote / face-to-face / hybrid), detail, apply. Client = My gigs (status filters, post) plus a read-only Marketplace view
- Post Gig: title, category, description, requirements, price or range, deadline, work type, general area
- Applicants (client): list, applicant profile, Accept / Counter / Decline
- Activity: freelancer = Proposals and Jobs; client = Applicants and Hired
- Agreement detail: price, deadline, milestones, status, payments, submit/approve
- Profile: public profile (photo, bio, skills, portfolio, completed gigs, rating, reviews), edit, settings
- Report: user or gig report with reason, notes, optional evidence image
- Messages: per-application text chat

Every screen: loading, empty, error-with-retry, success.

## 4A. Design and look (summary; full details in `docs/DESIGN.md` and `docs/ROLE_UX.md`)
- **Feel:** trustworthy, simple, friendly, local. Plain words. Honest empty states, never fake content.
- **Styling:** NativeWind v4 + Tailwind CSS v3, all colors/fonts/spacing as tokens in `tailwind.config.js`.
- **Colors (defaults, change once in config):** primary blue `#2563EB`, accent amber `#F59E0B`, success `#16A34A`, warning `#D97706`, danger `#DC2626`, background `#F8FAFC`, surface `#FFFFFF`, text `#0F172A`, muted `#64748B`, border `#E2E8F0`. Light theme only in v1.
- **Type and spacing:** Inter or system font, body at least 16, 4-point spacing grid, radius 12 (inputs/buttons) and 16 (cards).
- **Layout:** phone = single column + bottom tabs; tablet = side rail/top nav; desktop web = centered content (max ~1120), 2–3 column card grids, two-column gig and agreement detail pages.
- **Role skins:** freelancer = cobalt blue, client = deep navy blue, chosen from `profiles.active_mode` through tokens (`docs/ROLE_UX.md` section 5).
- **Shared kit:** one `components/ui/` library (Button, TextInput, Card, GigCard, Badge, Avatar, RatingStars, StepIndicator, Timeline, Banner, EmptyState, ErrorState, Skeleton, Toast, BottomSheet, FileAttachment, ReviewCard). Screens are built from it.
- **Status badges:** open/in progress = blue, pending/countered/revision = amber, approved/confirmed/completed = green, declined/cancelled/disputed = red, draft/withdrawn = gray; always with a text label.
- **Accessibility:** contrast 4.5:1, touch targets 44px+, labels on icon buttons, web keyboard focus, system font scaling.
- **Brand:** the owner's real logo from `assets/` for app icon, splash and favicon. Do not invent a logo.

## 5. Business rules
**Gig:** draft → open → in_progress → completed | cancelled | expired. Owner edits only; price/scope frozen after acceptance. pg_cron expires gigs past application deadline.

**Application:** applied → accepted | declined | countered → (freelancer) accepted | declined | withdrawn. Freelancer proposes price, estimated days, message. One counteroffer round. One application per freelancer per gig. Client cannot apply to own gig.

**Agreement:** created on acceptance; gig, client, freelancer, agreed price (centavos), deadline, status (active → completed | cancelled | disputed), `completed_at` (set once by `complete_agreement`), `cancelled_at` (set once by `cancel_agreement`). One active agreement per gig (partial unique index). Price is copied at acceptance.

**Milestones:** 1–5 per agreement; amounts sum exactly to agreed price; status pending → submitted → approved (or revision_requested → submitted); max 2 revisions; 7-day client-response reminder. Progress ≠ approval ≠ payment.

**Payments (external, evidence only):** record per milestone (or one full payment): method, amount, reference no., optional receipt. pending → reported_sent (client) → confirmed_received (freelancer), or disputed. UI says "Reported" and "Confirmed by freelancer", never "verified"/"guaranteed". Agreement completes when all milestones approved and all payments confirmed (or moderator resolves).

**Cancellation:** before any milestone is submitted, either party may cancel freely. After work starts, cancelling creates a report for manual review. No automatic partial settlement.

**Reviews:** 1–5 stars + comment (10–1000 chars), after completion only, one per party per agreement, within 14 days of `agreements.completed_at` (checked inside `submit_review`; no cron needed), no edits or deletes. Reviewee and `reviewee_role` come from the agreement. Moderators can hide a review via `admin_hide_review`; hidden reviews are not shown publicly and are excluded from ratings. Ratings are recomputed from non-hidden reviews in the same transaction as any review change.

**Reports/disputes:** `reports` table, reviewed manually in the Supabase dashboard (warn, suspend, hide review, resolution note).

## 6. Supabase architecture
| Component | Use |
|---|---|
| Auth | Email/password, email confirmation, reset; session in AsyncStorage (native) |
| Postgres | All data. Integer centavos, UUID PKs, enums/CHECKs, `timestamptz` |
| RLS | On every `public` table, default deny |
| RPC functions | All protected state changes (section 9) |
| Edge Functions | Only for email/notifications or third-party APIs; secret key lives here only |
| Storage | `avatars`, `portfolio` (public); `submissions`, `receipts` (private) |
| Realtime | `messages` (and optionally status changes), filtered by RLS |
| pg_cron | Expire gigs, 7-day reminders, close review windows |
| CLI | Versioned SQL in `supabase/migrations`; generate types with `supabase gen types typescript` |

Expo: one client in `lib/supabase.ts`; env = `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` only.

## 7. Data model (schema `public`)
| Table | Key columns |
|---|---|
| profiles | id (= auth.users.id), display_name, bio, avatar_path, area, active_mode (find_work | hire, null until chosen), mode_changed_at, onboarding_complete, freelancer_rating_avg, freelancer_rating_count, client_rating_avg, client_rating_count, freelancer_completed_gigs, client_completed_gigs, status, created_at |
| profile_private | user_id, dob, phone, terms_version, terms_accepted_at (owner-only) |
| platform_admins | user_id (no client policies) |
| categories | id, name, slug, is_active |
| skills | id, name, category_id, is_active |
| profile_skills | profile_id, skill_id (unique pair) |
| portfolio_items | id, profile_id, title, description, file_paths |
| gigs | id, client_id, title, description, requirements, category_id, price_min, price_max, work_type, area, application_deadline, deadline, status |
| applications | id, gig_id, freelancer_id, proposed_price, estimated_days, message, status, counter_price; unique (gig_id, freelancer_id) |
| agreements | id, gig_id, client_id, freelancer_id, agreed_price, deadline, status, completed_at, cancelled_at; partial unique: one active per gig |
| milestones | id, agreement_id, title, description, amount, position, status, revision_count |
| submissions | id, milestone_id, text, file_paths, created_at |
| payments | id, agreement_id, milestone_id?, method, amount, reference_no, receipt_path, status, reported_at, confirmed_at |
| reviews | id, agreement_id, reviewer_id, reviewee_id, reviewee_role (freelancer \| client), rating 1–5, comment (10–1000), hidden (default false), hidden_at, hidden_by, created_at; unique (agreement_id, reviewer_id) |
| reports | id, reporter_id, target_type, target_id, reason, notes, evidence_path, status |
| conversations | id, application_id (unique), client_id, freelancer_id |
| messages | id, conversation_id, sender_id, text, created_at |
| audit_events | id, actor_id, action, entity_type, entity_id, metadata jsonb, created_at (append-only) |
| rate_limit_events | user_id, action, created_at |

**Profile provisioning:** trigger on `auth.users` insert runs `handle_new_user`: creates `profiles` + `profile_private`, idempotent (`on conflict do nothing`), reads DOB and terms version from sign-up metadata, **rejects under-18** by raising an exception. Age is always computed from `profile_private.dob`.

## 8. RLS strategy
| Area | Policy |
|---|---|
| profiles | Authenticated read. Owner updates safe columns only (bio, display_name, avatar_path, area, onboarding_complete). `active_mode`, `mode_changed_at`, ratings, counts and status via functions only |
| profile_private | Owner read. Insert by trigger only |
| categories, skills | Authenticated read where active. Admin write |
| gigs | Authenticated read of `open` gigs. Owner edits own `draft`. Publish/status/price via functions |
| applications | Visible to applicant and gig owner. Created via function |
| agreements, milestones, submissions, payments | Participants (and admins) only. Writes via functions |
| reviews | Authenticated read of non-hidden rows (admins read all). Created via function only. No client update or delete |
| conversations, messages | Participants only; sender must be a participant |
| reports | Reporter inserts/reads own. Admin reads all |
| audit_events, rate_limit_events, platform_admins | No client access |

Also: revoke direct writes on protected tables; admin check = `exists (select 1 from platform_admins where user_id = auth.uid())`; never authorize from `user_metadata`; views use `security_invoker = true`.

## 9. Protected RPC functions
Each: reads caller from `auth.uid()`, checks participation and current state, locks rows (`FOR UPDATE`), idempotent, validates input, writes `audit_events`, applies rate limit where relevant.

`choose_initial_mode`, `switch_mode` (all restrictions in 3A; re-created with `create or replace` when the `payments` table arrives in M6 and when the `reports` table arrives in M8, so every blocker is real), `publish_gig` (needs Hire mode), `submit_application` (needs Find Work mode), `respond_to_application` (accept creates agreement atomically, closes gig to new applicants), `respond_to_counter`, `define_milestones` (sum must equal agreed price), `submit_milestone`, `review_milestone`, `report_payment`, `confirm_payment`, `complete_agreement`, `cancel_agreement`, `submit_review` (recalculates the reviewee's per-role rating from non-hidden reviews in the same transaction), `admin_hide_review` (admin only, sets hidden, audited, recalculates rating).

## 10. Storage
| Bucket | Access | Path / rules |
|---|---|---|
| avatars | public read | `{user_id}/avatar.jpg`, owner writes, images only |
| portfolio | public read | `{user_id}/{file}`, owner writes, images only |
| submissions | private | `{agreement_id}/{milestone_id}/{file}`, participants only |
| receipts | private | `{agreement_id}/{payment_id}/{file}`, participants only, images only |

## 11. Security checklist
RLS everywhere · never trust client for role/age/price/status/rating/payment · object-level authorization (no IDOR) · explicit params, no mass assignment · idempotency via unique constraints · atomic transitions with row locks · file type/size limits and signed URLs · input validation with CHECKs · rate limits + CAPTCHA · no exact addresses, no public DOB · no secret key in app · explicit `search_path` on `SECURITY DEFINER` functions · no mock fallback · **no demo data, no seed data**.

## 12. Testing
`supabase test db` (pgTAP) proves users cannot read others' agreements, payments, or private profile and cannot update protected columns. Function tests: happy path, wrong user, wrong state, duplicate call, double-accept race. App: `npx tsc --noEmit`, `npm test`. Manual: two real phones walk the whole loop. Test data lives only inside the test run and rolls back.

## 13. Cut from v1 (add later, in order)
Phone OTP → moderator dashboard → gig versioning/change requests → client invitations → blind review windows → partial settlements → push notifications → advanced search → receipt OCR/payment integrations.

## 14. Launch checklist
- RLS on every table, tested with two users; Supabase security advisor clean
- No `service_role` key in app or repo
- Repo search: no seed.sql, no sample arrays, no mock services, no demo login code
- Terms of Service and Privacy Notice (Philippine Data Privacy Act basics)
- 18+ gate tested with a bad DOB and a retry
- Email confirmation, password reset, CAPTCHA tested
- Two real phones tested end to end
- Current Supabase plan limits checked (database, storage, bandwidth, Free-plan project pausing)
- Backups confirmed for your plan
- Named person reviews reports with a response target
- 10–20 real freelancers and 3–5 real clients lined up before public launch
- Payment wording never implies a guarantee
