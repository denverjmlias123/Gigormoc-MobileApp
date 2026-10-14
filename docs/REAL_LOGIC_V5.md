# Gigormoc — Real Logic Spec (v5)

Part of the blueprint. Read after `docs/GIGORMOC_SPEC.md`. It adds four things the app must do for REAL, with real
database rows and no mock fallbacks: **AI assist in onboarding, notifications, messaging, Post gig**. It does not
change any rule in `AGENTS.md` (no seed data, RLS everywhere, RPC-only protected writes, mode gating, own-content rule).

## 0. What "real" means (acceptance rule for every feature below)
A feature is done only when a REAL account, on a REAL phone, performs the action and a SECOND real account sees
the result after a fresh app launch, with the row visible in the Supabase table editor.
- No in-memory arrays, no `useState` lists standing in for tables, no `setTimeout` fake loading, no hardcoded text
  where a row should be, no "TODO: wire later" buttons. A button that is not wired is removed, not left dead.
- Every list has loading, empty, error-with-retry. Every write shows success or a plain-words error.
- Every write goes through a service in `services/` that calls Supabase (table with RLS, or RPC for protected state).

## 1. Onboarding screen 2 of 3 — Select Your Skills (with AI)
Problem: the screen shows "No skills catalog available yet" when `skills` is empty. Seeding fake skills is forbidden
(AGENTS.md), so the fix is two real paths:

1. **Catalog path (admin):** if `categories`/`skills` rows exist, show them as chips grouped by category (unchanged).
2. **AI path (always available, even with an empty catalog):** a text box "What kind of work do you do?" (free text,
   e.g. "I fix phones and aircons, and tutor math"). Button "Suggest skills". The app calls Edge Function
   `ai-assist` (section 5) with `task = "suggest_skills"`. The AI returns up to 8 short skill names (and, if the
   catalog has matching rows, the matching `skill_id`s). The user ticks/edits the suggestions, then Save.
3. **Saving AI skills:** new RPC `add_profile_skills(p_skill_ids uuid[], p_custom_names text[])`:
   - existing `skill_id`s -> `profile_skills` rows;
   - custom names (trimmed, 2–40 chars, max 10 per call, max 15 per profile) -> `skills` row with
     `source = 'user'`, `is_active = false` (pending admin review), `created_by = auth.uid()`, deduped
     case-insensitively, then linked in `profile_skills`;
   - `profile_skills` for the caller only; audit row; rate limit.
   These are real rows entered by real users, so the no-seed rule holds. The admin can later activate, rename, merge or
   categorize them in the dashboard. Pending skills show on the owner's profile and count toward the "≥1 skill" apply gate.
   Public listings show a pending skill only on that owner's profile card as plain text, never as a catalog entry.
4. Skip stays allowed. If the AI call fails: show an error with Retry and a manual "Type a skill" input (same RPC).
   Never fall back to canned suggestions.

Schema (new migration): `skills` add `source text not null default 'admin' check (source in ('admin','user'))`,
`created_by uuid null references profiles(id)`; unique index on `lower(name)` for active+pending; RLS: authenticated read
of `is_active` rows plus own `created_by` rows; no direct client insert (RPC only).

## 2. Onboarding screen 3 of 3 — Introduce Yourself (Barangay + Short Bio)
- **Barangay / Area in Ormoc:** reads a real `areas` table (id, name, is_active). Ormoc's barangays are public
  geographic reference data, not demo data, so the DEVELOPER (not the AI) adds them as a one-time real data
  migration `..._areas_reference.sql` ONLY after the owner explicitly approves that exception to the no-seed rule
  (ask first; otherwise the admin enters them in the dashboard). Empty table -> the field becomes free text
  (max 60 chars) saved to `profiles.area`, so the screen is never blocked.
- **Short bio:** 20–300 chars, counter shown. Button **"Help me write this"** calls `ai-assist`
  `task = "draft_bio"` using ONLY: the user's chosen mode, selected skills, area, and what they typed. Returns 2
  short drafts in plain, honest English (Taglish allowed if the user typed Taglish). The user edits and accepts;
  the AI never saves anything by itself. The AI must not claim credentials, years of experience, ratings or
  "verified/guaranteed" wording (see AGENTS.md).
- Save via direct update of safe columns (`bio`, `area`, `avatar_path`) then `complete_onboarding()` RPC sets
  `onboarding_complete = true` (needs mode chosen). Photo upload is real (avatars bucket) and optional.

## 3. Notifications (real, in-app first)
Table `notifications`: `id uuid pk`, `user_id` (recipient), `type text` (check list below), `title text`,
`body text`, `entity_type text`, `entity_id uuid`, `data jsonb`, `read_at timestamptz null`, `created_at`.
Index `(user_id, created_at desc)` and partial index on `read_at is null`.
RLS: recipient can `select` own rows; NO client insert/update/delete. Realtime enabled on the table (filtered by RLS).
Rows are created ONLY inside the existing SECURITY DEFINER functions through one internal helper
`notify(p_user uuid, p_type text, p_title text, p_body text, p_entity_type text, p_entity_id uuid)` (not executable
by `authenticated`; revoked from public/anon). Never notify the actor about their own action.

Events (type -> recipient): `application_received` -> client (submit_application) · `application_accepted`,
`application_declined`, `application_countered` -> freelancer (respond_to_application) · `counter_accepted`,
`counter_declined` -> client (respond_to_counter) · `application_withdrawn` -> client · `agreement_created` -> both ·
`milestones_defined` -> freelancer · `milestone_submitted` -> client · `milestone_approved`,
`milestone_revision_requested` -> freelancer · `payment_reported` -> freelancer · `payment_confirmed`,
`payment_disputed` -> client · `agreement_completed` -> both · `agreement_cancelled` -> other party · `review_received`
-> reviewee · `new_message` -> other participant (see section 4) · `gig_cancelled_by_mode_switch` -> pending applicants ·
`report_update` -> reporter (when admin resolves) · `milestone_reminder` (pg_cron, 7 days no client response) -> client.

RPCs: `mark_notification_read(p_id)`, `mark_all_notifications_read()` (own rows only, idempotent).
App: bell with unread badge in the Home header (count from `read_at is null`, live via Realtime), Notifications
screen (list, tap = open the right screen by `entity_type/entity_id`, mark read, empty state "You're all caught up",
error + retry). Role wording follows ROLE_UX.md. Notification text lives in the strings file.
Push notifications (Expo push through an Edge Function) are a LATER step; in-app notifications come first and must work.

## 4. Messaging (real, Realtime)
Spec already has `conversations` + `messages`. Make it real:
- Conversation is created by the database (inside `submit_application`, `unique(application_id)`), never by the client.
  The chat is open to the two parties from application onward, stays readable after completion, and is read-only if
  an account is suspended.
- `send_message(p_conversation_id, p_text)` RPC: caller must be a participant, text 1–2000 chars trimmed, rate limit
  (e.g. 30/min), inserts the message and a `new_message` notification (collapse: one unread notification per
  conversation, updated not duplicated). Direct insert on `messages` is denied.
- `conversation_reads(conversation_id, user_id, last_read_at)` + `mark_conversation_read(p_conversation_id)` RPC for
  real unread counts on the Messages tab and tab-bar badge.
- Realtime: the chat screen subscribes to `messages` filtered by `conversation_id`; the Messages list subscribes for
  new rows. Optimistic send is allowed only if it reconciles with the real row and shows a failed state with Retry.
- Messages list shows the other person's name/initials avatar, the gig title, last message preview, time, unread dot,
  ordered by last message. Empty state is honest.
- Block/report from chat uses the existing report flow. Own-content rule: no conversation with yourself.

## 5. AI assist (Supabase Edge Function only)
- One Edge Function `ai-assist` (Deno) calls OpenRouter's chat-completions API with an ordered list of three model
  IDs in `OPENROUTER_MODELS`. `OPENROUTER_API_KEY` is a Supabase **secret**. For hosted functions set both with
  `supabase secrets set OPENROUTER_API_KEY=... OPENROUTER_MODELS=google/gemini-3-flash-preview,openai/gpt-4.1-mini,qwen/qwen3.5-9b`;
  for local functions, put both in the ignored `supabase/functions/.env` file. Neither belongs in the app,
  `EXPO_PUBLIC_*`, or the repo. OpenRouter tries the models in order on errors such as rate limits or downtime;
  this improves availability but cannot guarantee success if all providers or the account credentials fail.
- Auth: verify the caller's JWT, load `profiles.status = 'active'`, reject otherwise. Rate limit per user (e.g. 10
  calls/hour, 30/day) using `rate_limit_events`; return a clear 429 message.
- Input: `task` in an allow-list (`suggest_skills`, `draft_bio`, `polish_gig_description`), plus bounded fields
  (each max 600 chars). Server builds the prompt; the client never sends a system prompt. Never send DOB, phone, email,
  or other users' data to the AI.
- Output: strict JSON validated server-side (zod-style), length-capped, profanity/URL/phone-number stripped.
  On any failure return a typed error; the app shows Retry. No canned fallback text.
- Log one `audit_events` row per call (task, success, no prompt text). Cost guard: max tokens per call, small model.
- AI suggests; humans confirm. AI output is never written to the database without the user pressing Save.
- (Optional later) `polish_gig_description` on the Post gig screen: "Improve my description" returns a rewrite the
  user can accept or ignore.

## 6. Post gig (real, end to end)
Screen `app/gigs/post.tsx` (Hire mode only; Find Work users see a disabled state with the reason + link to Account mode).
Fields: title (5–80), category (from DB; if none exist show the real empty state "No categories yet" and block publish),
description (30–2000), requirements (optional), price min/max in PHP entered as pesos and stored as integer centavos
(max >= min, min >= 100 PHP), work type (remote / face-to-face / hybrid), area (from `areas` or free text), application
deadline (date picker, future), finish-by date (>= application deadline).
Flow: `Save draft` (insert/update own draft via RLS) -> `Publish` calls `publish_gig` (gates: Hire mode, email confirmed,
18+, display name set, active, and all required fields valid; re-validate in SQL, not only in the app).
After publish: appears in My gigs (Open), in other users' Browse (never the owner's), visible to a second account.
Edit own draft; open gigs may only change description/requirements (price/scope freeze rules per spec); cancel gig via RPC
with notification to pending applicants. pg_cron expires gigs after `application_deadline`. Double-tap on Publish is safe
(idempotent).

## 7. Cross-cutting
- Types: regenerate with `supabase gen types typescript` after each migration; no `any` for rows.
- Strings: all new user-facing text in the strings file.
- Tests (pgTAP behavior, AGENTS.md rule 5a): notification created for the right recipient only; direct insert/update/delete
  on `notifications` and `messages` denied; non-participant cannot read/send; `send_message` rate limit; `add_profile_skills`
  dedupe, limits, direct insert on `skills` denied, anon cannot execute; `mark_*` cannot touch others' rows; publish_gig
  rejects each invalid field and Find Work mode.
- Edge Function tests: unauthenticated -> 401; over rate limit -> 429; invalid task -> 400; malformed AI output -> typed error.
- Repo search at the end of each milestone: no seed files, sample arrays, mock services, demo code, dead buttons.

## 8. The complete real loop (M15)
The core loop from the spec must run end to end with two REAL accounts (A = client in Hire mode, B = freelancer in Find Work mode), each on its own phone or browser, through the real database only. Each step lists who acts, the RPC/table, the state change, the notification, and what the other side must see after a fresh launch.

| # | Actor | Action (RPC) | State change | Notifies | Other side sees |
|---|---|---|---|---|---|
| 1 | A | `publish_gig` | gig draft -> open | - | B sees it in Browse (A never does) |
| 2 | B | `submit_application` (price, days, message; gate: email, photo, skill, 18+) | application = applied; conversation created | A: application_received | A sees it under Applicants |
| 3a | A | `respond_to_application(accept)` | application accepted, ONE agreement created (price copied), gig -> in_progress, other applicants declined | B: application_accepted; B + A: agreement_created; declined applicants: application_declined | B sees Job; gig gone from Browse |
| 3b | A | `respond_to_application(counter)` | application = countered (one round) | B: application_countered | B sees Counter with Accept/Decline |
| 3c | B | `respond_to_counter(accept/decline)` | agreement created, or declined | A: counter_accepted / counter_declined | A sees result |
| 4 | A | `define_milestones` (1-5, sum = agreed price exactly) | milestones pending | B: milestones_defined | B sees timeline |
| 5 | B | `submit_milestone` (text + files/links) | milestone submitted; files in private `submissions` bucket under `{agreement_id}/{milestone_id}/` | A: milestone_submitted | A sees submission, opens files by signed URL |
| 6 | A | `review_milestone` approve / request revision (max 2, reason required) | approved or revision_requested | B: milestone_approved / milestone_revision_requested | B sees decision; can resubmit |
| 7 | A | `report_payment` (method, amount, reference, optional receipt image in private `receipts`) | payment reported_sent ("Reported") | B: payment_reported | B sees it |
| 8 | B | `confirm_payment` or dispute | confirmed_received ("Confirmed by freelancer") or disputed | A: payment_confirmed / payment_disputed | A sees it |
| 9 | either | `complete_agreement` (all milestones approved + payments confirmed) | completed, `completed_at` set once, gig -> completed, completed-gig counts per role | both: agreement_completed | both see Completed |
| 10 | A and B | `submit_review` within 14 days | review row, per-role rating recomputed from non-hidden reviews | reviewee: review_received | rating appears on public profile |
| - | either | `cancel_agreement` before any submission is free; after work started it creates a report | agreement cancelled | other party: agreement_cancelled | both see Cancelled |
| - | any | chat via `send_message` at every step | - | other party: new_message | live |

Rules that must hold at every step (verify, do not assume):
- Wrong mode, wrong user, wrong state, duplicate call and double tap are all rejected or idempotent in SQL, with a plain-words error shown in the app.
- Own-content rule: A can never apply to A's own gig; no agreement with the same person on both sides.
- Money is integer centavos everywhere; UI wording is only "Reported" / "Confirmed by freelancer"; never "verified" or "guaranteed"; note "Payments happen outside Gigormoc. Gigormoc only records them."
- Every step has loading, empty, error-with-retry and success states, and every screen re-fetches (or listens via Realtime) so state is never stale or local-only.
- File upload: type allow-list, size limit, private bucket, signed URL with short expiry, participants only. A failed upload never marks a milestone submitted.
- No screen computes a status locally; status always comes from the database row after the RPC returns.

Acceptance: a written two-account test script (docs/E2E_LOOP.md, created by the assistant) walking steps 1-10 plus one revision round, one counteroffer, one dispute and one cancellation, with the result of each step recorded as PASS/FAIL against the Supabase table editor. Any FAIL is fixed before the milestone is marked done.
