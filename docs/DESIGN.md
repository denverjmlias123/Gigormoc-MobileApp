# Gigormoc — Design System (look and feel)

Applies to the mobile app (iOS/Android) and the web version. One Expo codebase, one design system.
Visual reference screenshots (from Base44, Figma or sketches) go in `design/reference/`. They are **visual reference only**: copy the look and layout, never code, SDKs or data from them.

> The colors and fonts below are sensible defaults. If the owner's logo uses different colors, change them ONCE in `tailwind.config.js` (section 2) and the whole app updates. Do not hardcode colors anywhere else.

## 1. Design principles
1. **Trustworthy first.** Users are wary of scams. Show trust cues everywhere: confirmed email badge, completed gigs, star rating, clear status labels, and honest wording ("Reported", "Confirmed by freelancer", never "verified" or "guaranteed").
2. **Simple and friendly.** Plain words, short sentences, one main action per screen. Written for first-time app users, students, and people who are not tech-savvy.
3. **Local.** Ormoc City context: area names, PHP currency (₱), local service categories. Keep all text in one strings file so Tagalog, Waray or Bisaya can be added later.
4. **Mobile-first, web-ready.** Design for a phone in one hand first. The web layout expands the same screens, it does not invent new ones.
5. **Honest empty states.** No fake people, gigs, reviews, counters or sample content, ever. Empty screens use a simple icon, a short message, and one clear action.

## 2. Tokens (NativeWind v4 + Tailwind CSS v3)
**Brand colors:** Gigormoc's real logo (map pin) uses navy and orange. Read the exact colors from the logo file in `assets/` and set `primary` (navy) and `accent` (orange) once in `tailwind.config.js`. The blue/amber values in the table are placeholders only until that is done. Check 4.5:1 contrast for white text on `primary` and for `muted` text, and do not use orange text on white if it fails contrast.
Define in `tailwind.config.js` under `theme.extend`. Screens use token class names only (for example `bg-primary`, `text-muted`), never raw hex values.

| Token | Default value | Use |
|---|---|---|
| `primary` | `#2563EB` | Main buttons, links, active tab |
| `primary-dark` | `#1E40AF` | Pressed state, headers |
| `primary-soft` | `#DBEAFE` | Selected chips, light highlights |
| `accent` | `#F59E0B` | Stars, small highlights (not for main buttons) |
| `success` | `#16A34A` | Confirmed, approved, completed |
| `warning` | `#D97706` | Waiting, needs attention, revision requested |
| `danger` | `#DC2626` | Errors, disputes, cancel, delete |
| `bg` | `#F8FAFC` | App background |
| `surface` | `#FFFFFF` | Cards, inputs, sheets |
| `text` | `#0F172A` | Main text |
| `muted` | `#64748B` | Secondary text, hints |
| `border` | `#E2E8F0` | Dividers, input borders |

- **Typography:** Inter if loaded through `expo-font`, otherwise the system font. Sizes: 12, 14, 16, 18, 20, 24, 30. Body text and input text at least 16. Headings bold, body regular. Support the user's system font scaling.
- **Spacing:** 4-point grid (4, 8, 12, 16, 24, 32, 48). Screen side padding 16 on mobile, 24 on tablet/web.
- **Radius:** inputs and buttons 12, cards 16, chips and badges fully rounded.
- **Shadow:** very light on cards only. Prefer borders over heavy shadows.
- **Icons:** one set only (`lucide-react-native` or `@expo/vector-icons`). Never mix sets.
- **Dark mode:** light theme only in v1. Keep colors as tokens so dark mode can be added later without rewrites.
- **Brand:** use the owner's real logo file from `assets/`. Generate app icon, splash screen and web favicon from it. Do not invent a logo. If none exists yet, show the text "Gigormoc" in the primary color as a placeholder wordmark.

## 3. Status colors (badges / pills)
Always show a text label with the color, never color alone.

| Status | Color | Label examples |
|---|---|---|
| Open, active, in progress | `primary` | Open, In progress |
| Waiting, pending, countered, revision requested | `warning` | Pending, Countered, Needs revision |
| Approved, confirmed, completed | `success` | Approved, Payment confirmed, Completed |
| Declined, cancelled, expired, disputed | `danger` | Declined, Cancelled, Disputed |
| Draft, withdrawn, inactive | `muted` | Draft, Withdrawn |

## 4. Shared component kit (`components/ui/`)
Build these once, reuse everywhere. Screens must not restyle them ad hoc.

Button (primary, secondary, ghost, danger; loading and disabled states) · TextInput (visible label, helper text, error text, password show/hide) · Select · DatePicker · Chip · Badge/StatusPill · Avatar (photo or initials, never fake faces) · RatingStars · Card · GigCard · ApplicationCard · MilestoneCard · PaymentStatusRow · StepIndicator · Timeline · TabBar · Banner (for example "Confirm your email to apply") · EmptyState · ErrorState (with retry) · Skeleton loader · Toast · BottomSheet/Modal · FileAttachment (upload, preview, remove) · ReviewCard.

Every data screen implements four states: **loading** (skeletons, no fake percentages), **empty**, **error with retry**, **success**.

## 5. Layout: mobile, tablet, web
Use Tailwind breakpoints. Build a small `useBreakpoint` hook if needed.

| Screen width | Layout |
|---|---|
| Phone (under 640) | Single column. Bottom tab bar: Home, Gigs, Activity, Messages, Profile. Sticky primary action button where needed. |
| Tablet (640 to 1023) | Single or two columns. Tab bar becomes a left side rail or top navigation. |
| Desktop web (1024+) | Top navigation or left sidebar. Content centered, max width about 1120. Gig list as a 2 to 3 column card grid. |

- **Reviews:** call them "Reviews", never "Verified reviews". Show the star rating, the comment, the reviewer's initials avatar and display name, and the date. Public profile shows freelancer reviews and client reviews as two separate groups with separate averages.
- **Gig detail:** phone = stacked, with a sticky "Apply" bar at the bottom. Desktop = two columns, details on the left and a sticky apply/price card on the right.
- **Agreement detail:** phone = vertical timeline of milestones with payment status under each. Desktop = timeline left, summary and actions right.
- **Forms** (sign-up, post gig, apply): one column everywhere, maximum width about 560 on desktop, multi-step with a StepIndicator when longer than about 6 fields.
- Keyboard-safe forms on phones. Visible labels, never placeholder-only.
- No horizontal scrolling of the page. Wide tables (if any) scroll inside their own container.

## 6. Key screen guidance
- **Home:** greeting by display name and a small current-mode label (tapping it opens Profile → Settings → Account mode; there is no quick toggle), then the most useful list for that mode. Banner if the account still needs email confirmation, a photo, or a skill.
- **Gig card:** title, category chip, price or range in ₱, work type (remote / face-to-face / hybrid) with icon, general area, deadline, poster rating. Nothing else.
- **Gig detail:** description, requirements, price, deadline, work type, area, poster profile summary, Apply button (or its blocked reason).
- **Post gig:** simple multi-step form, preview before publish.
- **Applicants:** each card shows the freelancer's photo, rating, completed gigs, proposed price, and Accept / Counter / Decline.
- **Agreement:** agreed price at the top, status pill, milestone timeline (pending → submitted → approved), payment status under each milestone, one clear next action button.
- **Profile (public):** photo, name, area, rating and completed-gig count, skill chips, portfolio grid, reviews list. Never show date of birth, email or phone.
- **Payments:** wording stays "Reported" and "Confirmed by freelancer". Add a small note: "Payments happen outside Gigormoc. Gigormoc only records them."
- **Onboarding mode choice:** two large cards only, "Find Work" and "Hire Someone", each with one plain sentence. Required to continue. Small note below: "You can switch later, but only under certain conditions." No "Explore Both".
- **Account mode screen (Profile → Settings):** shows the current mode, the date the next switch is allowed (cooldown), and a plain-language list of anything blocking a switch (with links to the item, for example the active agreement). When a switch is possible, the confirm dialog states exactly what will be cancelled or withdrawn, and the button is danger-styled ("Switch and cancel 2 open gigs"). Reputation note: "Your ratings stay with each role."
- **Report:** reachable from every profile and gig with two taps.

## 7. Motion and feel
Minimal. 150 to 250 ms transitions, fade or slide only. Respect the device "reduce motion" setting. Use haptic feedback sparingly on important confirmations (mobile only). No decorative animation that delays the user.

## 8. Accessibility
- Text contrast at least 4.5:1 (WCAG AA). Check primary buttons and muted text.
- Touch targets at least 44 by 44 (48 preferred).
- `accessibilityLabel` and roles on icon buttons, tabs, inputs and badges.
- Never use color alone to convey meaning (always an icon or text too).
- Visible focus state on web, full keyboard navigation on web, support for system font scaling.
- Error messages say what went wrong and how to fix it.

## 9. Implementation rules (for the AI)
1. Use **NativeWind v4 with Tailwind CSS v3** (the stable path). Do not use NativeWind v5 or Tailwind v4 preview setups. Confirm the current stable version in the NativeWind docs before installing.
2. Setup: install `nativewind` and `tailwindcss` v3; `tailwind.config.js` with the `nativewind/preset` and the tokens above; one `global.css` with the Tailwind directives imported in the root layout; Babel preset with `jsxImportSource: "nativewind"` and `nativewind/babel`; Metro config wrapped with `withNativeWind`; add the NativeWind types file; restart with cache cleared (`npx expo start -c`).
3. **Before building any other screen,** render ONE test screen using tokens (a card, a button, an input, a badge) on phone and web, and confirm classes actually apply. Then delete the test screen.
4. Build the shared kit in `components/ui/` first, then screens from the kit.
5. No raw hex colors, no inline pixel styles, no one-off styling in screens. Everything uses tokens and the kit.
6. All user-facing text lives in one strings file.
7. No placeholder content that looks real: no lorem ipsum, no stock faces, no fake ratings or counters. Use initials avatars, icons, and honest empty states.
8. If reference screenshots exist in `design/reference/`, match their spacing, hierarchy and mood, but still use the tokens and kit.
