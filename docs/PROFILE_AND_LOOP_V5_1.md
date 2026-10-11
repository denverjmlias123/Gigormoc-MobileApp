# Gigormoc — Profile, Roles and Loop Changes (v5.1)

Part of the blueprint. Read after `docs/REAL_LOGIC_V5.md`. Where this file and an older doc differ, **this file wins**.
Same global rules: no seed data, RLS everywhere, protected writes only through SECURITY DEFINER RPCs, own-content rule,
mode gating in the database, "done" = a second real account sees it after a fresh launch.

## 1. Both roles share one visible relationship loop
Freelancer and client must each SEE the other side of every step, in their own words and skin. One shared timeline
component (`Timeline` from the kit) shows the same stages to both, with a "You are here" marker and who must act next.

Stages: **Posted -> Applied -> Accepted (agreement) -> Milestones set -> Work submitted -> Approved -> Payment reported
-> Payment confirmed -> Done -> Reviewed**.

| Stage | Client sees (Hire) | Freelancer sees (Find Work) |
|---|---|---|
| Posted | "Your gig is live" in My gigs | The gig in Browse |
| Applied | "New applicant" under Applicants | "Proposal sent" under Proposals |
| Accepted | "Hired <name>" under Hired | "You got the job" under Jobs |
| Milestones set | "Milestones set, waiting for work" | "Your milestones" with amounts and due dates |
| Work submitted | "<name> submitted work: Review" (action) | "Submitted, waiting for review" |
| Approved / revision | "Approved" or "Revision requested (n of 2)" | Same, with the client's reason; "Resubmit" action |
| Payment reported | "Payment reported" | "Payment reported: Confirm received" (action) |
| Done | "Completed: Review <name>" | "Completed: Review <name>" |

Rules:
- Every screen in the loop has a **"Next step" banner** that names who must act (you or the other person) in plain words.
- The same agreement screen is used by both roles; actions differ by mode (database already enforces).
- Notifications and chat deep-link into the right stage. Both sides can open the chat from any stage.
- Acceptance: with two real accounts, each side's stage and "next step" banner match after a relaunch, at every stage.

## 2. Post gig: category is not locked
Today an empty `categories` table blocks posting. Fix: the poster can **pick an existing category OR type a new one**.
- UI: a searchable category picker with chips from the database, plus "Add '<typed text>' as a new category".
- DB (new migration): `categories` add `source text not null default 'admin' check (source in ('admin','user'))`,
  `created_by uuid null references profiles(id)`; unique index on `lower(trim(name))`.
- RPC `get_or_create_category(p_name text) returns uuid` (SECURITY DEFINER, authenticated only, caller from `auth.uid()`):
  - normalizes (trim, collapse spaces), 3–40 chars, letters/numbers/space and `& - + /` only; rejects URLs, emails,
    phone numbers, profanity list, all-caps shouting, and names that are just a number;
  - case-insensitive dedupe: if it already exists (admin or user), return that id instead of making a duplicate;
  - limit: max 3 NEW categories per user per 24h, max 10 per user in total; rate limit + `audit_events` row;
  - new rows are `source = 'user'` and usable immediately by the poster; admin can rename, merge or activate in the
    dashboard. Direct insert on `categories` stays denied.
- `create_draft_gig` accepts `p_category_id` OR `p_category_name` (calls `get_or_create_category` in the same transaction).
- Filters: Browse filter chips list admin categories plus user categories used by at least one open gig. No category ever
  blocks posting. The old "No categories yet" block is removed (an empty list simply shows the "Add new category" input).
- Tests: duplicate (different case/spacing) returns same id, limits, invalid characters, anon cannot execute, direct insert denied.


### 2A. Keep categories clean: suggest first, add only as a last resort (v5.3)
If every user can add categories, the list will sprawl ("Phone repair", "Cellphone repair", "Mobile fix"). So the category
field works in this order, and a new category is the LAST option:
1. **System suggests the best fit.** After the poster types a title (and/or description), the app shows "Suggested
   category" chips. Source 1 (always works, no AI needed): database fuzzy search with `pg_trgm` similarity and keyword match
   over category names plus the categories of similar open/completed gigs, RPC `suggest_categories_for_gig(p_title,
   p_description)` returns the top 3 existing categories. Source 2 (when available): Edge Function task
   `suggest_gig_category` classifies the gig text. The server loads the active categories itself and the AI may ONLY choose
   from that list (returns ids and a short reason); it never invents a category and never writes to the database.
2. **The poster picks** a suggested chip, or searches/browses the full list.
3. **Typing a new name shows "Did you mean...?" first.** While typing, show existing categories with similar names
   (similarity above a threshold, including singular/plural and common typos). The poster must choose "No, create a new
   category" explicitly to continue. If a close match exists the app recommends it.
4. **Only if nothing fits** does `get_or_create_category` create a new one (rules in section 2). The same similarity check
   runs inside the RPC: a name that is too close to an existing one (for example similarity >= 0.7) is rejected with the
   existing category returned, so the client cannot bypass the UI.
5. **Optional AI help for a new name:** if nothing fits, the AI may propose ONE short, general category name (not a job
   title; e.g. "Phone repair", not "Fix Juan's iPhone screen"), which the poster can edit and accept. It still goes through
   `get_or_create_category`.
6. **Admin cleanup:** `admin_merge_categories(p_from uuid, p_into uuid)` (admin only, audited) moves gigs and hiring
   interests to the target category and deactivates the source, so duplicates that slip through are fixed in one step. The
   admin dashboard query "user categories by usage" shows which new categories are worth keeping.
7. **Popularity guard:** a user-created category shows in the shared Browse filters only after it is used by 2 different
   posters (or the admin activates it); until then it only labels that poster's own gig. This stops one-off or joke
   categories from cluttering everyone's filter list.
8. **Fallback:** if the AI fails or is rate limited, source 1 (database similarity) still gives suggestions. No canned
   suggestions are ever shown.
Tests: similar names (case, plural, typo) return the existing category; too-close new name rejected; AI can only return ids
from the active list; merge moves gigs; category with < 2 posters is hidden from shared filters; AI failure falls back to
database suggestions.

## 3. Skills belong to freelancers only. Clients get hiring details instead
You are right: a client does not have skills. Skills describe what a freelancer can do. Fix:
- **Find Work mode:** skills (as before, with the rules in section 4).
- **Hire mode:** no Skills screen anywhere (onboarding, profile, settings). Instead a client has **Hiring details**:
  - `client_type`: Individual / Small business / Organization or school / Other (single choice)
  - `business_name` (optional, 2–60 chars; shown publicly only if filled)
  - `hiring_interests`: what they usually need help with, chosen from categories (max 8) via new table
    `profile_hiring_interests(profile_id, category_id, unique pair)`, using the same category picker and the same
    "add new category" rule as section 2
  - `about_hiring` (optional text 0–300): "What kind of work do you usually need?"
  Client public profile shows: client type, business name, hiring interests, gigs posted count, client rating.
- **Onboarding step 2 by mode:** Find Work = "Select your skills" (section 4). Hire = "What do you usually need help
  with?" (hiring interests + client type). Both skippable. AI helper: Find Work suggests skills; Hire suggests categories
  from free text (`task = "suggest_categories"`, same safety rules as `ai-assist`).
- **Gates:** apply still needs >= 1 skill (freelancer only). Publishing a gig needs NO skills and NO hiring interests.
- **Mode switching keeps data:** skills and hiring interests are stored separately and are kept (just hidden) when the
  user switches mode, so reputation and setup are never lost.
- Own-content rule still applies. Remove any leftover skills requirement or skills UI shown to clients.
- Tests: client cannot call `add_profile_skills` (mode check), hiring interests limited to 8, interests persist across a mode switch.

## 4. Onboarding step 2 (freelancer skills): show, save, manage
1. **Show what you select:** a "Your skills (n)" tray at the top of the screen lists every selected skill (catalog chips,
   AI suggestions you ticked, and typed ones) as removable chips. Nothing selected = honest hint, not an error.
2. **Save to the database** with one Save button calling `add_profile_skills(p_skill_ids, p_custom_names)`. The app
   re-fetches the saved list from the database and shows it ("Saved"). Skipping saves nothing.
3. **Shows in Manage skills** (`app/profile/skills.tsx`): the same saved skills, loaded from the database, after relaunch.
4. **Add more later, with restrictions** (same RPC in both places):
   - max 15 skills per profile; max 5 NEW custom skills per 24h; rate limit + audit
   - 2–40 chars, letters/numbers/space and `& - + . /` only; no URLs, emails, phone numbers, profanity
   - case-insensitive dedupe against catalog and other users' skills (reuse the existing row, never duplicate)
   - custom skills are `source = 'user'`, pending admin review, but usable on the owner's profile immediately
   - removal allowed through `remove_profile_skill(p_skill_id)`; if it would leave 0 skills, show a plain warning
     "You need at least 1 skill to apply for gigs" (allowed, but the apply gate then blocks)
5. Pending skills are labelled "Pending review" on the owner's screen only.
Tests: selected set equals saved set, appears in Manage skills after relaunch, limits, dedupe, remove, wrong mode denied.

## 5. Profile: complete mark, more details, photos from storage, everywhere
### 5.1 "Profile complete" mark
- Computed in the database by `get_profile_completeness(p_profile_id)` (never trusted from the client): returns a
  percent, a `complete boolean`, and the list of missing items. No stored flag that the user could edit.
- UI: a progress ring on the Profile tab and Edit profile ("70% complete: add a photo"), each missing item is a tap
  target that jumps to the field. When 100%: a check mark badge **"Profile complete"** next to the name on the owner's
  screen and on the public profile. Wording must never say "verified" or "guaranteed" (AGENTS.md); it only means the
  person filled in their profile.
- **Freelancer checklist:** photo, display name, headline, bio (>= 20 chars), area, >= 1 skill, work type
  availability, and (optional bonus, not required) one portfolio item.
- **Client checklist:** photo, display name, bio (>= 20 chars), area, client type, >= 1 hiring interest.
- Phone is optional and never part of completeness.
- Notification `profile_complete` once, the first time it reaches 100%.

### 5.2 More details in Edit profile (all via safe columns or `update_profile_details` RPC, validated in SQL)
Both roles: display name (2–50), headline (<= 80, e.g. "Phone repair and tutoring in Cogon"), bio (20–500), area
(barangay from `areas` or free text), preferred contact method note (in-app chat by default), languages (multi-select
from a small fixed list in the strings file: English, Tagalog, Bisaya, Waray, Other), optional phone (goes ONLY to
`profile_private`, never public).
Freelancer extras: work types offered (remote / face-to-face / hybrid), availability (Available now / Part-time /
Weekends / Not taking work), years of experience bucket (Less than 1 / 1–3 / 3–5 / 5+), typical starting rate note (text,
optional, never a guarantee), portfolio link to `app/profile/portfolio.tsx`.
Client extras: client type, business name, hiring interests, about hiring (section 3).
Public vs private: DOB and phone never public; the editor shows a lock icon on private fields.
Validation messages are plain words, shown under the field; unsaved-changes guard on back.

### 5.3 Photo from storage, any time, both roles
- Not only at sign-up: the avatar can be **added, changed or removed at any time** from Profile (tap the avatar) and from
  Edit profile, in BOTH modes.
- Sources: **Choose from photos/files** (device library, `expo-image-picker`; on web a file picker) and **Take a photo**
  (camera). Square crop, resize to max 1024 px, compress, jpeg/png/webp only, max 5 MB, with clear errors.
- Storage: public `avatars` bucket, path `{user_id}/avatar-{timestamp}.jpg` (timestamp avoids stale cache); after a
  successful upload set `profiles.avatar_path`, then delete the previous object. A failed upload never changes the
  profile. Storage RLS: owner writes only inside their own folder. Remove photo = clear `avatar_path` + delete object.
- Portfolio images use the same picker rules (multi-select up to the existing limit).
- Initials avatar is shown only when there is no photo (never stock faces).
- Tests: wrong folder denied, non-image denied, oversize denied, replace removes old object, remove works, both modes.

## 6. No duplicate emails at account creation
- Email is normalized (trim, lowercase) before every signup, login and reset call.
- Supabase Auth already enforces unique emails, so the app must handle it properly in Step 1:
  - handle the `user_already_exists` / "User already registered" error;
  - ALSO handle the case where `signUp` returns a user whose `identities` array is empty (Supabase's way of saying the
    email exists when email confirmation is on) and treat it as "already registered";
  - show: "This email is already registered. Log in or reset your password." with two buttons, and do NOT advance to Step 2
    or create a second profile.
- Database safety net (migration): confirm a unique index on `lower(email)` exists wherever email is mirrored
  (never store emails in `profiles` unless unique), and `handle_new_user` stays idempotent (`on conflict do nothing`) so
  one auth user can never produce two profiles.
- Also reject disposable-looking typos with simple format validation; double-tap on Sign up is safe (disable button while
  pending).
- Tradeoff to keep in mind: telling people an email exists reveals that it is registered (account enumeration). It is the
  requested behavior; protect it with CAPTCHA and rate limits on sign up and reset (already in AGENTS.md).
- Tests: same email twice (also different upper/lower case) -> second attempt blocked with the message and no new rows in
  `profiles` or `profile_private`; double tap creates one account.

## 7. AI provider note
The Edge Function `ai-assist` may use Google Gemini (current deployment) or Anthropic. The provider key is always a Supabase
secret, never in the app or repo. New task allow-list: `suggest_skills`, `draft_bio`, `polish_gig_description`,
`suggest_categories`, `suggest_gig_category`. Everything else in REAL_LOGIC_V5.md section 5 still applies.
