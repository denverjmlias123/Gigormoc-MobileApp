# Gigormoc — Role UX (freelancer and client)

Part of the blueprint. Read it after `docs/DESIGN.md`. It does not change any rule in `AGENTS.md` or
`docs/GIGORMOC_SPEC.md` (one account, one active mode, mode-gated actions in the database, per-role ratings).
It defines how each mode **looks and behaves**, so switching mode feels like switching sides of the marketplace.
Where this file and DESIGN.md differ on a role-specific screen, this file wins. Everywhere else DESIGN.md wins.

## 1. Principles
1. **Two sides, one marketplace.** Freelancer and client see different Home screens, tab labels, gig actions and
   Activity wording. The 5 tab routes stay the same (Home, Gigs, Activity, Messages, Profile).
2. **The mode decides the skin.** Colors, tab labels and screen content come from `profiles.active_mode`.
   No screen picks a role color or role wording by hand.
3. **Never recommend people their own content** (section 4).
4. **Same rules, same kit.** Role skins reuse `components/ui/`. Honest empty states, no fake content, no
   "verified" or "guaranteed" anywhere.

## 2. Role map

| Area | Freelancer (`find_work`) | Client (`hire`) |
|---|---|---|
| Feel | Bright, energetic: discover and apply | Calm, steady: post, review, hire |
| Skin | Cobalt blue | Deep navy blue |
| Tab labels | Discover, Browse, My work, Messages, Profile | Dashboard, My gigs, Hires, Messages, Profile |
| Home | Hero with a search shortcut; new open gigs from other people | Hero with Open / Drafts / All gigs counts and a "Post a gig" button; my gigs |
| Gigs tab | Browse open gigs, search, work-type filters | "My gigs" with status filters (All, Open, Drafts, In progress, Closed) and "Post a gig"; a read-only "Marketplace" segment |
| Gig detail, bottom action | **Apply** (disabled with a reason if the gig is not open) | **View applicants** on own gig; disabled "Apply" with a reason on other people's gigs |
| Activity | Proposals, Jobs | Applicants, Hired |
| Profile | Skills and Portfolio first; freelancer rating shown first | Edit profile and public profile first; client rating shown first |
| Words | Proposal, Job, Apply, Browse | Applicant, Hire, Post a gig, My gigs |

## 3. How the two sides interact (the core loop, screen by screen)

| Step | Client does (Hire mode) | Freelancer does (Find Work mode) |
|---|---|---|
| 1 | Post gig, then publish | Sees it in Browse (never their own gigs) |
| 2 | Sees the proposal under Applicants | Apply: price, estimated days, message |
| 3 | Accept, Counter (one round) or Decline | Sees the result under Proposals; if countered: Accept or Decline |
| 4 | Agreement appears under Hired | Agreement appears under Jobs |
| 5 | Define 1 to 5 milestones (sum = agreed price) | Sees the milestone timeline |
| 6 | Approve, or request revision (max 2) | Submit work for each milestone |
| 7 | Report payment ("Reported") | Confirm ("Confirmed by freelancer") or dispute |
| 8 | Review the freelancer (within 14 days) | Review the client (within 14 days) |

Payments stay external. The UI note stays: "Payments happen outside Gigormoc. Gigormoc only records them."

## 4. Own-content rule (locked)
A person never sees or acts on their own content as if it were someone else's. This matters because one account
can be both roles over time.
1. Gigs you posted never appear in the freelancer feed (Home, Browse) or in the client "Marketplace" segment.
   They live under "My gigs".
2. You cannot apply to your own gig. The Apply action becomes a disabled "This is your gig" state, and the apply
   screen refuses to submit even if opened by link.
3. You cannot hire yourself: an agreement never has the same person as client and freelancer.
4. You cannot review or report yourself.
5. Switching mode never copies content across roles. Freelancer and client ratings stay separate.
6. If a future "recommended gigs" or "suggested freelancers" feature is added, it must exclude the viewer.

The app hides these in the UI. **The database must enforce them** (hiding in the UI is not security). Use prompt R4
in `docs/MILESTONES.md`.

## 5. Skins (tokens)
Role skins are token sets, not new components. Implement with NativeWind CSS variables (`vars()`) set once at the
root from `profiles.active_mode`, so screens keep using token classes such as `bg-primary` and `bg-hero`.
Add these tokens to the existing list in DESIGN.md section 2:

| Token | Freelancer skin | Client skin | Use |
|---|---|---|---|
| `primary` | `#1F5FFF` | `#1B4DB1` | Buttons, links, active tab |
| `primary-dark` | `#1239B3` | `#0A1F4D` | Pressed state |
| `primary-soft` | `#E4ECFF` | `#E6ECF8` | Selected chips, soft fills |
| `hero` | `#1F5FFF` | `#0A1F4D` | Large header surfaces |
| `hero-muted` | `#CFDDFF` | `#AFC2E8` | Secondary text on hero |

Shared by both skins: `bg #F4F7FC`, `surface #FFFFFF`, `surface-alt #EEF2FA`, `text #0B1B3A`, `muted #5B6B8C`,
`border #DCE4F2`, `border-strong #B9C6E0`, `success #12805C`, `warning #B45309`, `danger #D92D3E`,
`danger-text #A31F2D`. Status colors stay as in DESIGN.md section 3.

Brand colors: the real logo is navy and orange. When the logo file is in `assets/`, set the client skin navy
(`hero`, `primary-dark`) from the logo navy, and set `accent` from the logo orange. Do not use orange text on white
if it fails 4.5:1. The values above are placeholders until then. Check 4.5:1 for white text on both `primary` values.

Radius steps up with importance: chip 10, input 12, button 14, card 20, sheet 28, pill fully rounded.
Shadow: one very light card shadow only.

## 6. Screen guidance per role
- **Home (freelancer):** greeting + mode label, hero with search shortcut, "Available gigs" (other people's open
  gigs only), banner if photo or skill is missing.
- **Home (client):** greeting + mode label, hero with counts and "Post a gig", "My gigs" list, empty state with
  one "Post a gig" action.
- **Gig card:** unchanged from DESIGN.md. For clients the status pill is always shown. For freelancers an "Open"
  pill is hidden (it is noise) and the poster rating is shown instead.
- **Gig detail:** hero with category, title, price. Info rows (work type, area, apply by, finish by). Posted-by card
  opens the poster's public profile. One bottom action decided by who is looking and which mode they are in
  (table in section 2). A disabled action always shows the reason in plain words.
- **Gigs tab (client):** segmented control "My gigs" / "Marketplace". Marketplace never shows the viewer's gigs.
- **Account mode screen:** unchanged. The mode label on Home still opens it. No quick toggle.
- **Onboarding mode choice:** two large cards, each shown in its own skin so the choice previews the experience.

## 7. Not yet role-shaped (do in R5)
Applicants, Post gig, Agreement detail, Milestones (setup, submit, review), Payments, Chat, Public profile,
Settings. Until R5 they use the shared kit and the active skin but keep their existing layout.

## 8. Accessibility for role UI
A disabled action always explains why. Role is never shown by color alone: the mode label, tab labels and
headings carry the role in words too. Tab icons also change by role.
