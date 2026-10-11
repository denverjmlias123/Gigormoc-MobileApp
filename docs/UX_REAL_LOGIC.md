# Gigormoc — UX Must Be Real Logic (v5.2)

Part of the blueprint. Read after `docs/PROFILE_AND_LOOP_V5_1.md`. Rule: **no UX element is decoration.** Every visible
control, number, badge, banner, tab, filter, empty state and message must be driven by a real database row or a real
RPC result, for the signed-in user and their active mode. If it is not wired, it is removed, not left looking real.

## 1. The control contract (applies to every screen, both roles)
Each interactive element must satisfy all of these, or be deleted:
1. **Has a handler** that calls a service (table with RLS or RPC). No empty `onPress`, no `console.log`, no "coming soon".
2. **Shows the four states:** loading (skeleton, no fake percentages), empty (honest, with the one useful action), error
   (plain words + Retry), success (visible confirmation and the new data on screen).
3. **Disables while pending** (no double submit) and is idempotent in SQL if double-tapped anyway.
4. **Reads state from the database after every write** (re-fetch or Realtime). Never flip local state and assume it worked.
   Optimistic UI is allowed only if it reconciles with the real row and shows a failed state with Retry.
5. **Explains why it is disabled** in plain words (wrong mode, missing step, own gig, cooldown).
6. **Validates in the app AND in SQL** with the same limits; the SQL error is mapped to a friendly message from the strings file.
7. **Respects mode:** what shows, what is enabled and the words used come from `profiles.active_mode` (ROLE_UX.md).
8. **Survives relaunch and a second device:** a second real account sees the result after a fresh launch.
9. **Back navigation is safe:** `router.canGoBack() ? back() : replace(fallback)`; unsaved-changes guard on forms.
10. **Numbers are real:** every counter, badge, rating, progress ring, unread dot and "n of m" comes from a query/RPC. No
    hardcoded counts, no placeholder text standing in for a row, no random or time-based fake values.

## 2. Forbidden UX patterns (search the repo for each; expected result NONE)
`setTimeout` used to fake loading or success · hardcoded arrays rendering lists · `Math.random()` for displayed values ·
`onPress={() => {}}` or TODO handlers · buttons that only navigate but pretend to save · toasts that say "Saved" before the
write returns · local-only state for data that belongs to the database · tabs/filters that do not change the query ·
search boxes that filter a stale in-memory list instead of the query · badges not tied to a status column · progress that
is not computed from data · screens that show data from a previous user after logout (clear caches and Realtime channels on
sign out and on mode switch).

## 3. Screen-by-screen real-logic checklist
For each row the assistant must show: the control, the service/RPC, the table it reads, and PASS/FAIL after a relaunch.

| Area | Must be real |
|---|---|
| Auth | Duplicate email blocked, 18+ gate from DB, session restored on relaunch, logout clears caches |
| Onboarding | Mode saved via RPC; skills/hiring details saved and re-read; bio/area/photo saved; completeness recalculated |
| Home (both) | Counts, my gigs / available gigs, bell badge: all from queries; mode label opens Account mode |
| Gigs | Search, category, work-type and status filters change the query; own gigs excluded; pagination or "no more" is real |
| Post gig | Draft saved, publish validated in SQL, category pick/add, double tap safe, appears for second account |
| Gig detail | Bottom action by viewer + mode + gig state, with disabled reason; poster card opens real profile |
| Apply / Applicants | One application per gig, counter round, accept creates ONE agreement, results visible to the other side |
| Agreement | Timeline stage + "Next step" banner from status; milestone sums; submit with real upload; approve/revision count (n of 2) |
| Payments | Reported / Confirmed by freelancer / Disputed from rows; receipt upload private; wording rules |
| Reviews | Only after completion, 14-day window from `completed_at`, per-role ratings recomputed, hidden excluded |
| Messages | List ordered by last message, unread from `conversation_reads`, live updates, send failure + Retry |
| Notifications | Created by DB events, live bell, tap deep-links, mark read persists |
| Profile | Completeness ring/badge from DB, edit saves all fields, photo add/change/remove, skills (freelancer) / hiring details (client) |
| Settings / Mode | Cooldown date and blockers computed from DB; confirm lists real affected gigs/applications |
| Reports | Saved row, reporter sees only own reports, cannot report self |

## 4. Proof rule
"Real" is proven, not claimed: for every row above the assistant runs the action with two real accounts and records the
database row that changed (table + id) and what the second account saw after a fresh launch. A control with no proof is
marked NOT VERIFIED and treated as broken.
