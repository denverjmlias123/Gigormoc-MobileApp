# Gigormoc — Feedback, Errors and Anti-Spam (v5.4)

Part of the blueprint. Read after `docs/UX_REAL_LOGIC.md`. The app already works end to end (M0–M21 passed V2). This file
adds three things WITHOUT breaking what works: (1) clear success/notify feedback for every action, (2) proper error handling in
every situation, especially login/logout, (3) protection against spam clicks and two-device races that cause duplicates
(double approve, double deliver, double payment, double notification).

## 0. Safety rules: do not break the current code (apply to every task below)
1. **Explore first, read-only.** Before any change the assistant explores the code and database (prompt M22) and lists what to
   add. No code until the owner approves the list.
2. **Baseline first.** Run `npx tsc --noEmit`, `npm test` (currently 90/90) and `supabase test db`, record the results, and
   make a git commit/tag (e.g. `baseline-before-v5.4`) so any step can be rolled back.
3. **Small, additive changes.** Prefer new helpers/wrappers and `create or replace function` in NEW migrations that keep the
   old behavior and only add guards. Never edit applied migrations. No refactors of unrelated code. One feature per commit.
4. **Regression tests.** For every bug fixed or guard added, add a test that fails before and passes after. Re-run the full
   suite after each step; if the count drops or anything fails, stop and fix before continuing.
5. **Idempotent by default.** Calling any action twice must give the same final state as calling it once.
6. **Report honestly.** Paste raw outputs; mark NOT VERIFIED if something could not be run.

## 1. Success and notification feedback for every action
Two channels, never confused:
- **Toast for the person who acted** (instant, after the real write returns): "Gig published", "Application sent", "Milestone
  approved", "Work submitted", "Payment reported", "Review posted", "Profile saved". Never shown before the database confirms.
  Never shown on error.
- **In-app notification for the other person** (already built via `notify()`): extend coverage so no step is silent.
- Self-notifications stay suppressed (the actor gets a toast, not a notification).

Required toasts (success) and notifications (counterparty), checked against the RPC list:
`publish_gig` (toast; applicants none yet) · `cancel_gig` (toast; notify applicants) · `submit_application` (toast; notify client) ·
`respond_to_application` / `respond_to_counter` (toast; notify other side) · `define_milestones` · `submit_milestone` ·
`review_milestone` approve/revision · `report_payment` · `confirm_payment` / dispute · `complete_agreement` · `cancel_agreement` ·
`submit_review` · `send_message` · profile/skills/photo saves · `switch_mode` · report filed.
New reminders (pg_cron, deduped): milestone awaiting client review for 3 and 7 days, payment awaiting confirmation 2 days,
review window closing (3 days left), gig application deadline in 24h, gig expired, agreement deadline in 48h.
Rules: one notification per event (dedupe key, see section 3), role-appropriate wording from the strings file, deep link to the
exact screen, push later (not required now).
The assistant must AUDIT and list every RPC that changes state but sends no toast and no notification, and every screen that
saves without confirmation.

## 2. Error handling in every situation
One central layer, used by every service and screen (no ad-hoc `alert()` or silent catch):
- `AppError` type with `kind`: `offline | timeout | unauthorized | session_expired | forbidden | not_found | conflict | rate_limited |
  validation | server | unknown`, a friendly message from `mapSqlErrorToFriendlyMessage` (extend it), a `retryable` flag, and
  a `requestId` for support.
- **Network:** offline banner (NetInfo) and write buttons disabled with the reason; request timeout (e.g. 20s) with a Retry;
  reads may auto-retry with backoff; writes NEVER auto-retry unless they carry an idempotency key (section 3).
- **Session expiry / 401 / JWT expired:** refresh once, retry the call once, otherwise sign out cleanly and go to Login with
  "Your session expired. Please log in again." Refresh must be single-flight (no parallel refresh storm).
- **Rate limit (429 / RPC limit):** friendly "Too many tries. Please wait N seconds", button disabled until then.
- **Conflict / stale state (other device already acted):** "This was already updated. Showing the latest." then re-fetch; never
  a raw SQL message.
- **Forbidden / wrong mode / suspended account / deleted:** plain explanation and the next step (switch mode, contact support).
- **Storage upload errors:** type/size/permission/network each have a message; a failed upload never marks the action done and
  never leaves a half record (upload first, then RPC; on RPC failure clean up the object).
- **Root error boundary** with "Something went wrong. Reload" (no blank screen), logs a request id, and screens keep
  loading / empty / error-with-Retry states.
- **Forms:** field-level errors under the field, first invalid field focused, values kept after an error, unsaved-changes guard.

### 2A. Login
Email normalized; show specific, safe messages: wrong email or password; email not confirmed (with "Resend confirmation" button,
rate limited); too many attempts; no internet; account suspended; server error. Login button locked while in flight (no double
submit). "Show password" toggle. After success: single navigation (`replace`) to the right place (onboarding if incomplete, else
Home), never two redirects. Forgot password errors handled the same way.

### 2B. Logout
- One tap = one logout (in-flight lock). Works even if the network fails: do `signOut({ scope: 'local' })` so the device is always
  logged out, and try the server revoke best-effort.
- Clears everything tied to the user: Supabase session, in-memory/query caches, Realtime channels (notifications, chat,
  conversation unread), image caches for private files, any stored drafts that contain private data, notification badge counts.
- Navigates with `router.replace` to Welcome/Login so Back cannot return to a private screen; no flash of the previous user's data
  when the next user logs in.
- `onAuthStateChange` handles `SIGNED_OUT` (also when the session is revoked elsewhere or expires) exactly once and shows
  "You were logged out".
- Optional: "Log out of all devices" (`scope: 'global'`).
- Mode switch and logout both run the same cleanup routine.

## 3. Stop spam clicks and two-device duplicates
Duplicates (double approve milestone, double deliver, double payment, doubled notifications) come from two causes: the same device
sending the request twice, and two devices acting at the same time. Fix BOTH, client and database.

### 3A. Client (same device)
- A shared `useAction()` / `runOnce()` wrapper for EVERY write: an in-flight **ref** lock (not only React state, because state
  updates are async and a fast double tap gets through), ignores presses while pending, disables the button and shows a spinner
  until the write finishes, then refreshes the data.
- `Button` ignores `onPress` while `loading` or `disabled`, and has a short cooldown (e.g. 800 ms) after a successful press.
- Each user attempt generates one `request_id` (uuid). A retry of the SAME attempt reuses the same id; a new deliberate action
  makes a new id.
- Navigate after success with `replace`, so Back cannot resubmit a finished form. Disable the form after success.
- Dedupe Realtime events by row id; do not stack listeners (unique channel names, cleanup on unmount/logout); debounce
  pull-to-refresh and search inputs.

### 3B. Database (the real protection, works across devices)
- **Idempotency table** `idempotency_keys(user_id, request_id, rpc_name, result jsonb, created_at, unique(user_id, request_id))`.
  State-changing RPCs accept an optional `p_request_id uuid`: if the key exists, return the stored result (same response, no second
  effect); otherwise run and store. Old keys cleaned by pg_cron after 24h. Internal only (RLS on, no client access).
- **State-machine guards inside every RPC** (`select ... for update`, then check current state): a second call arriving after the
  first returns a clear "already done" result (`already_done: true`) instead of repeating the effect or raising a confusing error:
  - `review_milestone`: only `submitted` can be approved or sent back; approving twice does nothing; revision count increments once.
  - `submit_milestone`: not allowed while status is `submitted` or `approved`; `unique(milestone_id, submission_number)`.
  - `define_milestones`: only when none are defined or all still pending; replace is atomic.
  - `respond_to_application` / `respond_to_counter`: only from the right status; one agreement (existing partial unique index).
  - `report_payment`: unique open payment per (agreement, milestone) while `reported_sent` or `confirmed_received`.
  - `confirm_payment` / dispute: only from `reported_sent`.
  - `complete_agreement`, `cancel_agreement`, `publish_gig`, `cancel_gig`, `submit_review` (unique per agreement and reviewer),
    `submit_application` (unique per gig and freelancer), `send_message` (rate limit plus idempotency key so a double tap does
    not post twice).
- **Notification dedupe:** `notifications.dedupe_key` (for example `type:entity_id:state`) with a unique index per user, so a
  repeated call or retry cannot create the same notification twice (use `on conflict do nothing`).
- **Two devices at once:** the row lock makes the second call wait, then see the new state and return `already_done`; the app
  then shows "Already done on your other device" and refreshes. Never a duplicate row, never a crash.
- Storage: deterministic object paths with a request id or submission number, upsert false, so a double upload cannot create
  two deliverables for one submission.

### 3C. Proof tests (must exist and pass)
- Two parallel calls (same user) to each RPC above produce exactly one effect (one approval, one submission, one payment, one
  agreement, one review, one notification).
- Two sessions of the same user (two devices) acting at once: one succeeds, the other gets `already_done`.
- Client wrapper test: 10 rapid presses call the service once.
- Replay with the same `request_id` returns the original result.

## 4. Order of work
M22 explore (read-only) -> M23 error and auth layer -> M24 anti-spam and idempotency -> M25 feedback and notifications ->
re-run V1 and V2. After each: baseline comparison (all earlier tests still pass).
