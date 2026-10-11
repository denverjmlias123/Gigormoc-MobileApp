# Gigormoc — Deleting a Posted Gig (v5.6)

Part of the blueprint. Read after `docs/COURSE_REQUIREMENTS_V5_5.md`. Additive: keep `cancel_gig` and every existing behavior
working; follow the safety rules in `docs/RESILIENCE_V5_4.md` section 0 (explore read-only first, baseline, new migration only).

## 1. Who can delete and when
Only the gig owner (own-content rule, Hire mode for the action; viewing history works in any mode). Decision by the gig's state:

| Situation | Result |
|---|---|
| **A. No applicants** (no application rows) | Allowed. Confirm dialog, then the gig is removed. Nobody to notify. |
| **B. Applicants exist but none approved** (applications `applied` or `countered`, no agreement) | Allowed after a stronger confirmation that shows the number of people. Every pending applicant is notified that the gig was deleted. |
| **C. A freelancer is hired** (accepted application / agreement `active`, `disputed`, or `completed`) | **Blocked.** Message: "A freelancer is already hired for this gig. Cancel the agreement first." (link to the existing cancel-agreement flow). Completed gigs can never be deleted (reviews and history stay). |
| Draft, cancelled or expired gig with no agreement | Allowed like A or B. |

## 2. What "delete" means in the database
- Soft delete: `gigs.deleted_at timestamptz`, `deleted_by`, `delete_reason text null` (and `status` stays a valid lifecycle value).
  Rows are kept so the log trail, applicant history and foreign keys stay intact. A deleted gig is hidden everywhere:
  Browse, search, Home counts, My gigs, Marketplace, category usage counts, and cannot be applied to.
- New RPC `delete_gig(p_gig_id uuid, p_reason text default null, p_request_id uuid default null) returns jsonb`
  (SECURITY DEFINER, authenticated only, `auth.uid()`, explicit `search_path`, rate limited, audited):
  1. `select ... from gigs where id = p_gig_id for update` (this lock also serializes against a simultaneous apply or accept).
  2. Owner check; if already deleted return `{ already_done: true }` (idempotent, double tap and two devices safe).
  3. If an agreement exists for the gig (any status except cancelled) -> raise a typed error `gig_has_agreement` (case C).
  4. Set `deleted_at`, `deleted_by`, `delete_reason`.
  5. For every application in `applied` or `countered`: set status to `declined` with `status_reason = 'gig_deleted'`,
     `responded_at = now()`; keep a snapshot `gig_title_snapshot` on the application (or on the notification data) so the
     applicant can still see which gig it was.
  6. Insert one notification per affected applicant through `notify()` with type `gig_deleted`, dedupe key
     `gig_deleted:<gig_id>:<applicant_id>`, deep link to their Proposals tab, and data `{ gig_title, reason }`.
  7. Close the related conversations (`conversations.closed_at`, `closed_reason = 'gig_deleted'`), add one system message
     "This gig was deleted by the client", and make the chat read-only.
  8. Write the `audit_events` / log trail row `gig_deleted` with metadata `{ applicants_notified, had_applicants }`.
  9. Return `{ deleted: true, applicants_notified: n }`.
- `submit_application` and `respond_to_*` re-check `deleted_at is null` after taking the gig row lock and return a typed error
  `gig_unavailable` ("This gig is no longer available") if deleted, so an applicant who is on the Apply screen at the moment of
  deletion gets a friendly message, not a crash or an orphan application.
- Applicants must still be able to read their own application's gig title and the removal state even though the gig is hidden:
  expose it through the application row (snapshot columns) or a small `security_invoker` view, never by opening gig RLS.
- `cancel_gig` stays as it is (keeps the gig visible in My gigs as Cancelled with history). Delete removes it from the list.
  Both use the same applicant-notification pipeline so wording and behavior match.

## 3. What each person sees
**Client (owner):**
- "Delete gig" in the gig detail menu and My gigs row. In-app `ConfirmDialog` (never a browser dialog):
  - Case A: "Delete this gig? This can't be undone."
  - Case B: "3 people applied. They will be notified that this gig was deleted. Delete anyway?" with the applicant count from the
    database (loaded when the dialog opens, re-checked server-side).
  - Case C: the button explains why it is disabled ("A freelancer is already hired. Cancel the agreement first.").
- Success toast: "Gig deleted" or "Gig deleted. 3 applicants were notified." The list refreshes from the database.

**Applicant (freelancer) in case B:**
- A notification: "The gig '<title>' was deleted by the client. Your proposal was closed." (live bell, deep link to Proposals).
- In Proposals the proposal remains visible with a gray badge **"Gig deleted"** and no actions, so it does not silently disappear.
  The chat is read-only with the system message. They can apply to other gigs; this one cannot be re-applied.

## 4. Edge cases (must be handled)
- Delete and apply at the same instant: the row lock decides; either the application exists and gets notified, or the apply
  returns `gig_unavailable`. Never a pending application left on a deleted gig.
- Counter-offer in progress (`countered`): treated as pending, notified and closed.
- Applicant withdrew earlier: not notified (status `withdrawn` is final).
- Owner switches mode: existing `switch_mode` cancellation keeps working; deleting is separate.
- Gig appears in saved lists, notifications or chat deep links: opening a deleted gig shows "This gig was deleted" with a Back
  button, not an error screen.
- Dashboard and category popularity counts exclude deleted gigs (RESILIENCE category rules).
- Admin may delete or hide a gig through moderation using the same function path with an audit entry (optional).

## 5. Tests (pgTAP and Node)
- Case A deletes and notifies nobody. Case B declines every `applied`/`countered` application, creates exactly one notification per
  applicant (re-running creates none), closes conversations, logs one audit row.
- Case C raises `gig_has_agreement`; completed gig cannot be deleted; non-owner and wrong user denied; anon cannot execute.
- Second call returns `already_done`; two parallel calls produce one effect.
- Apply after delete returns `gig_unavailable`; deleted gig absent from browse, counts and categories.
- Applicant can still see the closed proposal with the title and "Gig deleted" state; chat is read-only.
