# Gigormoc — Course Requirements Sync (v5.5)

Part of the blueprint. Read after `docs/RESILIENCE_V5_4.md`. It maps the professor's requirements (Mobile App Dev increments
and IAS) onto Gigormoc and adds only what is missing. Everything here is ADDITIVE: do not rewrite working code. Follow the
safety rules in `docs/RESILIENCE_V5_4.md` section 0 (explore read-only first, baseline tests + git tag, new migrations only,
regression test per change, re-run all tests).

**Deadline context:** 3rd increment checking is Oct 15–16, 2026 (computer lab 2). Build P0 first (section 9).

## 1. Requirements -> Gigormoc traceability

| Professor requirement | Gigormoc mapping | Status / work |
|---|---|---|
| Login + Logout, dashboard after login | Supabase Auth, role-adaptive Home | Exists. Add logout confirmation (section 2) |
| Authentication against a cloud database | Supabase Auth + Postgres | Exists |
| Login validation messages: success, wrong user/password, empty fields, account does not exist | `login.tsx` | Add all four, in-app (section 2) |
| Show/hide password, animations, loading, form validation | UI kit | Exists; verify |
| Logout confirmation "Are you sure you want to logout?" Yes / Cancel | `lib/dialog.ts` | Make an in-app modal; no browser dialog (section 2) |
| Working account ready for demo | Real accounts registered through normal sign-up | Prepare checklist (section 8). No demo logins in code |
| Create account / registration | 2-step signup | Exists |
| 2 of 3 user roles connected in one transaction | Client (Hire) + Freelancer (Find Work) + Admin | Exists (post gig -> apply -> accept) |
| One complete transaction cycle | 10-stage loop (post -> apply -> accept -> milestones -> submit -> approve -> payment -> complete -> review) | Exists; re-verify on two devices |
| New tables, data stored in proper tables | 30+ tables with relations | Exists; document (section 7) |
| NO browser alerts ("localhost says"); all notifications/success in-system | Toast + in-app modal | Ban `alert`, `confirm`, `prompt`, `window.*` dialogs, `Alert.alert` on web (section 2) |
| IAS: database structure + proper table relationships | Supabase schema | Document ERD + data dictionary (section 7) |
| IAS: Login UI | `login.tsx` | Polish + lockout messages |
| IAS: User CRUD | Admin user management | New (section 5) |
| IAS: Admin and User dashboards | Admin dashboard + user Home | Admin dashboard new (section 5) |
| Password >= 8 chars, upper + lower + number + special | signup / reset | Enforce in UI and server (section 3) |
| Confirm password | signup, reset | Verify present; server-side rule |
| 3-attempt lockout with increasing time | none | New (section 4) |
| Sessions for login and logout | Supabase session | Add tracked sessions + idle timeout (section 6) |
| Log Trail: all user activities logged, only admin/super admin can view | `audit_events` (partial) | Extend to every activity + admin-only viewer (section 6A) |

## 2. Login, logout and in-system messages
- **Login messages (all shown in the app, never a browser dialog):**
  - Empty username/password: field-level "Email is required" / "Password is required"; no network call.
  - Success: toast "Login successful. Welcome, <name>" then the dashboard (`router.replace`).
  - Wrong password: "Incorrect email or password." (with remaining attempts: "2 attempts left").
  - Account does not exist: "No account found for this email. Create one?" with a Sign up button. Supabase itself returns the
    same error for unknown email and wrong password, so this needs a server check (Edge Function `login-guard`, section 4).
    Note the tradeoff: it reveals which emails are registered (the professor requires it; keep CAPTCHA and the lockout, and keep a
    config flag `SHOW_ACCOUNT_NOT_FOUND` so it can be switched to the safer generic message).
  - Locked: "Too many failed attempts. Try again in 01:00" with a live countdown (section 4).
  - Suspended/deleted account, unconfirmed email (with Resend), offline, server error: friendly messages (RESILIENCE 2A).
- **Logout confirmation:** tapping Logout opens an in-app modal "Are you sure you want to logout?" with **Yes, log out** and
  **Cancel**. Only Yes runs the cleanup (RESILIENCE 2B) and `router.replace` to Login. Cancel closes the modal and changes nothing.
  Same modal on web and mobile.
- **No browser/system dialogs anywhere:** no `window.alert/confirm/prompt`, no `Alert.alert` (on web it becomes a browser
  alert). All confirmations use the in-app `ConfirmDialog` and all success/error messages use `Toast` or inline banners.
  A repo test fails the build if any of these appear in `app/`, `components/`, `services/`, `lib/`, `utils/`.

## 3. Password policy and validation
- Rule: at least 8 characters, with at least one lowercase, one uppercase, one number and one special character; no spaces;
  not equal to the email or name. Confirm password required and must match.
- Enforced in the UI (live checklist with ticks as the user types, strength meter) AND on the server: Supabase Auth password
  settings (minimum length and required characters) plus a server check so a hand-made API call cannot create a weak password.
  Same rule for sign up, reset password, change password and admin-created users.
- Change password screen (Profile > Security): current password, new, confirm; logs an event; ends other sessions optionally.
- Other validations: email format and typo guard (exists), name 2–50 chars, DOB 18+ (exists), phone format, trimmed inputs,
  maximum lengths everywhere, plain-words messages under each field.

## 4. Lockout: 3 attempts, increasing wait time (server-side)
Client-only lockouts are bypassable (reinstall, second device), so the counter lives in the database.
- Table `login_attempts(email_normalized text pk, failed_count int, lock_level int, locked_until timestamptz, last_failed_at,
  last_ip text null, updated_at)`. RLS on, no client access.
- Edge Function `login-guard` (service role secret stays in the function, never in the app) with three actions:
  `check(email)` before login -> `{locked, seconds_left, attempts_left, account_exists}`;
  `failure(email)` after a failed sign-in; `success(email)` after a good one (resets counters).
- Policy: after **3** consecutive failures lock for **1 minute**; each further round of 3 failures increases it:
  1 min -> 5 min -> 15 min -> 30 min -> 60 min (cap 60). Counter resets after a successful login or 24h without failures.
  Locks apply per email (and also per IP when available) and use the same message for unknown emails so the lock itself does
  not leak anything. A locked account cannot log in even with the correct password until the timer ends.
- Every failure, lockout and unlock is written to the log trail (section 6A). Admin can see locked accounts and unlock one
  from User Management (audited).
- UI: attempts-left hint, disabled button with countdown, countdown survives app restart (read from the server).
- Tests: 3 failures lock; correct password during the lock is rejected; wait times escalate; success resets; unknown email
  locks the same way; double-tap does not count twice.

## 5. Admin role, dashboards and User CRUD
Roles: **user** (everyone; active mode client or freelancer), **admin**, **super_admin**. Admin is NOT a mode; it is a row in
`platform_admins` with `role in ('admin','super_admin')` (never from `user_metadata`). Only a super_admin can grant/revoke admin.
The first super_admin is added once manually by the developer (existing rule).
- Route guard: everything under `app/admin/` calls `is_admin()` (database function) on entry and every RPC re-checks it;
  non-admins see "You don't have access" and are redirected. Admin entry appears in Profile only for admins.
- **Admin dashboard** (all numbers from queries): total users, new users (7 days), active gigs, agreements in progress, completed
  agreements, open reports, locked accounts, today's log events, latest activity.
- **User Management (CRUD)** via admin RPCs/Edge Functions, each audited:
  - Create: admin creates a user (Edge Function using the service role; email, name, temporary password meeting the policy,
    initial role); user must change password at first login (`must_change_password`).
  - Read: searchable, filterable, paginated list (name, email, mode, status, created, last login, rating) and a detail view.
  - Update: edit display name/area/status (`active | suspended`), reset lockout, force password reset email, change admin role
    (super_admin only).
  - Delete: **soft delete** (`status = 'deleted'`, personal fields anonymized, sessions ended, login blocked) so agreements,
    reviews and logs stay intact; blocked while the user has active agreements or payments awaiting confirmation. Hard delete is not
    offered. Confirmation uses the in-app dialog and requires typing the user's email.
  - An admin cannot suspend/delete themselves or the last super_admin.
- **User dashboard:** the existing role-adaptive Home (counts and lists from the database).
- Existing admin tools (hide review, merge categories, approve skills, resolve reports) are linked from the admin dashboard.

## 6. Sessions
- Table `user_sessions(id uuid pk, user_id fk, started_at, last_seen_at, ended_at, end_reason ('logout','expired','revoked',
  'locked','password_changed'), device_label text, platform text, ip text null)`.
- On login the app calls RPC `start_session(device_label, platform)`; a heartbeat updates `last_seen_at` (throttled, e.g. every
  5 minutes); logout calls `end_session`. Idle timeout: after 30 minutes without activity (config) the session ends,
  the user sees "Your session expired due to inactivity" on the Login screen. Suspended or deleted users are signed out
  within the next heartbeat.
- Profile > Security > **Active sessions**: list of the user's sessions (device, last active, current), "Log out this device",
  "Log out all other devices" (audited). Admin can see a user's sessions and end them.
- Supabase's own JWT/refresh handling remains the transport; this table is the record and the control point. Logging in and
  out always writes the log trail.

### 6A. Log Trail module (admin-only)
- Extend the existing append-only `audit_events` (or a new `activity_logs` that it feeds) so EVERY user activity is recorded by
  the database in the same transaction as the action: sign up, login success/failure, lockout, logout, session expiry, password
  change/reset, profile edits, avatar changes, skills/hiring details, gig post/edit/publish/cancel, apply/withdraw, accept/
  counter/decline, agreement create/cancel/complete, milestone define/submit/approve/revision, payment report/confirm/dispute,
  review, message sent (metadata only, never the text), reports, mode switch, admin actions (create/edit/suspend/delete user,
  unlock, merge category, hide review), and view of the log trail itself.
- Columns: `id`, `created_at`, `actor_id` (nullable for failed logins), `actor_email` snapshot, `actor_role`, `action` (stable
  code), `entity_type`, `entity_id`, `status` (success|failure), `ip/device` when known, `metadata jsonb`. Never store passwords,
  tokens or message bodies.
- Append-only: no update/delete for anyone (trigger blocks it); RLS denies all direct client access.
- Viewing: only RPC `get_log_trail(filters, page)` which checks `is_admin()` (super_admin and admin). Screen `app/admin/
  log-trail.tsx`: table/list with search, filters (user, action, status, date range, entity), pagination, row detail, export
  current filter to CSV (admin only). Non-admins cannot reach it by URL or API.
- Tests: each listed activity creates exactly one log row; failed login is logged without an actor; a non-admin gets denied from
  `get_log_trail` and from direct table reads; update/delete on the log fails.

## 7. Database structure document (IAS)
Create `docs/DATABASE_STRUCTURE.md` generated from the LIVE database (not from memory): table list with purpose, columns with
types and constraints, primary and foreign keys, unique and check constraints, indexes, RLS policy summary, functions, storage
buckets, and an ERD (Mermaid `erDiagram`) grouped by area: identity (auth.users, profiles, profile_private, platform_admins,
user_sessions, login_attempts), catalog (categories, skills, areas, profile_skills, profile_hiring_interests), marketplace
(gigs, applications, agreements, milestones, submissions, payments, reviews, reports), communication (conversations, messages,
conversation_reads, notifications), security (audit_events/log trail, rate_limit_events, idempotency_keys). Show every
relationship with its cardinality. Also add a one-page "how to demo the relationships" script. Checker: every FK has an index and
no table lacks a primary key.

## 8. Checking-day readiness checklist (Oct 15–16)
- Run the verification prompts (V1 and V2, then V3 below) at least one day before; fix only what fails, by new migrations.
- Prepare REAL accounts through normal sign-up (never seeded or hard-coded): 1 super_admin, 1 client, 1 freelancer (plus 1 spare);
  keep the credentials in a private note, not in the repo. Confirm each can log in on the demo machine.
- The professor's "one complete cycle" demo: sign up (or log in) as freelancer and client, client posts gig, freelancer applies,
  client accepts, milestones, submit work, approve, payment reported and confirmed, complete, reviews; then show the admin
  dashboard and the log trail containing every step. Also demo: wrong password x3 -> lockout countdown, logout confirmation, and
  the session list.
- Run on the lab machine beforehand: internet, Supabase project awake (free projects pause), env variables present, `npm install`
  done, app opens in the browser and on a phone; no "localhost says" popups anywhere (test by clicking every button once).
- Have a backup: screenshots/video of the full cycle and a database backup/export before the demo.

## 9. Priority for the Oct 15–16 checking
P0 (must): in-app logout confirmation and no browser dialogs; password policy + confirm; 3-attempt escalating lockout; login
messages; sessions with login/logout records; log trail (admin-only); admin dashboard; User CRUD; DB structure document;
V3 pass. P1: idle timeout, active sessions screen, CSV export, change password screen. P2: log out of all devices, per-IP
locks.
