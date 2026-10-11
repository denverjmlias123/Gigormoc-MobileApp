# Gigormoc — Comprehensive Project Implementation Document

**Project:** Gigormoc  
**Target Market:** Ormoc City, Philippines (18+ Local Freelance Marketplace)  
**Architecture:** Single-codebase mobile and web (Expo React Native, Expo Router, TypeScript Strict) backed 100% by Supabase (Auth, Postgres RLS, Storage, Realtime, Edge Functions, RPC Functions).  
**Document Generation Date:** October 11, 2026  

---

## 1. Executive Summary & Vision

Gigormoc is designed as an honest, localized freelance marketplace tailored specifically for Ormoc City. Rather than adopting complex global escrow models or simulated in-app wallets, Gigormoc coordinates peer-to-peer freelance agreements, milestones, and direct real-world payments (e.g., GCash, Maya, PayPal, or bank transfer in PHP integer centavos).

### Key Architectural Pillars:
- **Zero Mock / Zero Seed Policy**: No fake data, mock users, or placeholder counters exist in code. Empty states reflect true database state.
- **Strict Database-Enforced Modes**: Users toggle between `find_work` (freelancer) and `hire` (client) modes. Modes are enforced via PostgreSQL `SECURITY DEFINER` RPC functions with strict transition restrictions and cooldowns.
- **Separation of Concerns & Privacy**: Row Level Security (RLS) is default-deny. Date of birth and private contact data are separated into a non-public `profile_private` table.
- **Own-Content Enforcement**: Users are blocked in both database and UI from applying to, reviewing, messaging, or reporting their own listings or identities.
- **NativeWind & Token Design System**: Role-adaptive theme tokens switch between Freelancer (Cobalt) and Client (Navy/Warm) skins.
- **Server-Side AI Assist**: Onboarding skill suggestions, bio drafting, and gig description polishing are backed by a secured Supabase Edge Function (`ai-assist`) powered by Google Gemini (`gemini-3.8-flash`), with server-side rate limiting, prompt isolation, and PII sanitization.

---

## 2. Chronological Implementation Milestones (Start to Present)

### Milestone 0: Setup & Infrastructure
- Initialized managed Expo application with TypeScript strict configuration, Expo Router file-based navigation shell, and Supabase client integration (`lib/supabase.ts`).
- Configured NativeWind token system and common layout scaffolding.
- Built reusable core UI component kit (`components/ui/`): `Button`, `TextInput`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton`, `Avatar`, `Chip`, `ListRow`, `SectionHeader`, `GigCard`.
- Established database migration system with the Supabase CLI (`supabase/migrations/`).

### Milestone 1: Auth, Identity & Onboarding
- **Schema & Triggers**: Created `profiles` and `profile_private` tables with default-deny RLS. Implemented `handle_new_user` Postgres trigger enforcing 18+ age verification based on birth date.
- **Authentication Flows**:
  - 2-step registration: Name, email, password, terms acceptance, followed by Date of Birth via native date picker.
  - Email verification, session persistence via `@react-native-async-storage/async-storage`, login/logout, and password recovery (`forgot-password.tsx`).
- **Mode Selection**: Onboarding requires choosing an initial active mode (`step1-mode.tsx` calling RPC `choose_initial_mode`). There is no ambiguous "explore both" state.

### Milestone 2: Profiles, Skills & Portfolio Storage
- **Schema**: Tables for `categories`, `skills`, `profile_skills`, and `portfolio_items`. Configured storage buckets for public `avatars` and `portfolio`.
- **UI Screens**: Profile view (`app/profile/[id].tsx`), profile editor (`app/profile/edit.tsx`), skill selection from database rows (`app/profile/skills.tsx`), and portfolio management (`app/profile/portfolio.tsx`).
- **Privacy Protections**: Public queries never expose private details (DOB, phone).

### Milestone 3: Gigs Marketplace
- **Schema & Rules**: Created `gigs` table with lifecycle states (`draft`, `open`, `in_progress`, `completed`, `cancelled`, `expired`).
- **Mode Gating**: RPC `publish_gig` validates that user is in `hire` mode and meets prerequisites (email confirmed, 18+).
- **Search & Filters**: Indexed queries for category, location, budget range, and search terms with authentic empty and error states.

### Milestone 4: Applications, Agreements & Mode Switching
- **Schema**: Added `applications`, `agreements`, `audit_events`, and `rate_limit_events`.
- **Application Mechanics**:
  - `submit_application` requires active `find_work` mode, verified email, profile photo, and at least one skill. Single application per freelancer per gig.
  - Counteroffer round supported: client counteroffer, freelancer accept/decline.
  - Atomic agreement creation via `respond_to_application` and `respond_to_counter` using row locks (`FOR UPDATE`) and partial unique indexes to eliminate double-accept race conditions.
- **Mode Switch Engine**:
  - Function `switch_mode` enforces a 7-day cooldown.
  - Blocks mode switching if there are active agreements, disputed agreements, pending payments (`reported_sent`), unresolved reports, or account suspension.
  - Explicit confirmation atomically cancels open gigs or withdraws pending applications.

### Milestone 5: Milestones & Work Submissions
- **Schema**: Created `milestones` and `submissions` tables, backed by a private `submissions` Supabase storage bucket with participant-only RLS policies.
- **Workflow**:
  - `define_milestones`: Validates 1–5 milestones per agreement, with the exact sum of milestone centavos matching the agreement price.
  - `submit_milestone`: Freelancers upload work deliverable links/files.
  - `review_milestone`: Clients approve or request revisions, with a hard limit of 2 revisions per milestone.

### Milestone 6: Payments Coordination
- **Schema**: `payments` table and private `receipts` storage bucket with signed URL access restricted to agreement parties.
- **Philosophy**: No simulated escrow or app-held funds. Payments are reported as direct P2P transfers.
- **Status Lifecycle**: `reported_sent` $\rightarrow$ `confirmed_received` (or `disputed`).
- **Completion Gate**: `complete_agreement` verifies all milestones are approved and payments are confirmed, stamping immutable `agreements.completed_at`.

### Milestone 7: Reviews & Role-Segregated Reputation
- **Schema**: `reviews` table with `reviewee_role` (`freelancer` | `client`), `hidden` flag, `hidden_at`, and `hidden_by`.
- **Submission Rules**:
  - `submit_review`: Participant only, completed agreements only, single review per party, submitted within 14 days of `completed_at`, comment between 10–1000 characters.
  - Recalculates average rating and count exclusively from non-hidden reviews in the same transaction. Ratings are tracked separately per role (`freelancer_rating_avg` vs `client_rating_avg`).

### Milestone 8: Reports, Messages & Realtime Moderation
- **Schema**: `reports`, `conversations`, and `messages` tables with Postgres Realtime replication.
- **Messaging**: Participant-only access to conversation threads linked to agreements/applications with rate limiting.
- **Agreement Cancellation**: `cancel_agreement` allows mutual cancellation prior to work start; if cancelled after work commencement, it automatically logs a moderation report.
- **Moderation**: `admin_hide_review` allows admins to hide abusive reviews and triggers real-time rating recomputation.

### Milestone 9: Security Hardening & Retrofit Audit
- Comprehensive audit of all `SECURITY DEFINER` functions, granting execution only to `authenticated` and revoking from `anon`/`public`.
- Enforcement of integer centavos arithmetic across all financial logic.
- Total elimination of hardcoded demo arrays, fake counters, and mock fallbacks across app services.
- Rate limiting on messages, applications, and report filings.

### v4 Evolution & Retrofit (R4 & R5)
- **Database Own-Content Rules (`20261011000010_own_content_rule.sql`)**:
  - Added database constraint `agreements_parties_must_differ_check` (`client_id <> freelancer_id`).
  - Added self-application rejection in `submit_application`.
  - Added self-review and self-reporting blocks in `submit_review` and `submit_report`.
  - Added `get_available_gigs(viewer_id)` to filter out gigs posted by the caller.
- **Role UX Screen Retrofit (R5)**:
  - Theme switching using NativeWind CSS variables (`theme.tsx`), providing distinct cobalt themes for freelancers and navy themes for clients.
  - Role-adaptive bottom tabs:
    - **Freelancer**: Find Work, Browse Gigs, Proposals / Jobs, Messages, Profile.
    - **Client**: Overview, My Gigs, Applicants / Hired, Messages, Profile.
  - Complete retrofit across Gigs, Gig Details, Activity, Agreements, Milestones, Payments, and Chat.
- **Claude Mode Switch Resolution**: Integrated cross-platform modal confirmation dialog (`lib/dialog.ts`) and enhanced RPC `switch_mode` handling.
- **Milestone 10 Preparation**: Authored Ormoc pilot tester handbook (`docs/PILOT_GUIDE.md`).

### v5 Real Logic Milestones (Milestones 11–15)

#### Milestone 11: Real In-App Notifications (`20261011000011_notifications.sql`)
- **Schema & Helper**: Created `notifications` table with RLS (`user_id = auth.uid()`), partial index on unread (`read_at IS NULL`), and Realtime publication.
- **Internal Trigger Engine**: Built private `notify(...)` helper (revoked from public/anon/authenticated) invoked directly inside all `SECURITY DEFINER` lifecycle RPCs (`submit_application`, `respond_to_application`, `respond_to_counter`, `define_milestones`, `submit_milestone`, `review_milestone`, `report_payment`, `confirm_payment`, `dispute_payment`, `complete_agreement`, `cancel_agreement`, `submit_review`, `switch_mode`, `send_message`). Strictly suppresses self-notifications.
- **Client Integration**: Added `services/notifications.ts`, unread badge on the Home header bell icon with live Realtime subscription, and `app/notifications.tsx` with deep-link resolution by `entity_type` / `entity_id` and `mark_all_notifications_read()`.

#### Milestone 12: Real Messaging (`20261011000012_real_messaging.sql`)
- **Database Conversation Creation**: Updated `submit_application` to automatically create the participant `conversations` row (`UNIQUE(application_id)`). Direct client inserts into `conversations` and `messages` are revoked.
- **Read Tracking & Collapsing**: Added `conversation_reads(conversation_id, user_id, last_read_at)`, `mark_conversation_read(p_conversation_id)`, `get_conversations_with_meta()`, and `get_unread_conversations_count()`. Updated `send_message` to collapse unread `new_message` notifications per conversation rather than spamming duplicates.
- **UI & Realtime**: Built live unread badges on the Messages tab bar, full conversation list (`app/(tabs)/messages.tsx`) with gig title, partner display name, last message preview, and live chat screen (`app/chat/[conversationId].tsx`) with unique Realtime channel topics to prevent duplicate subscription errors on remount.

#### Milestone 13: Post Gig Real (`20261011000013_real_post_gig.sql`)
- **RPC Lifecycle**: Implemented `create_draft_gig(...)`, hardened `publish_gig(p_gig_id)` with idempotency, and added `cancel_gig(p_gig_id, p_reason)` which declines pending applicants and dispatches `gig_cancelled` notifications.
- **Validation Parity**: Enforced exact bounds in both database and UI (`app/gigs/post.tsx`): title 5–80 chars, description 30–2000 chars, minimum budget floor of ₱100 (`10,000` centavos), future deadline validation, and an honest empty-category guard when no active categories exist in the database.

#### Milestone 14: AI in Onboarding & Edge Function (`20261011000014_ai_onboarding.sql`)
- **Custom User Skills & Areas**: Added `source` (`admin` | `user`) and `created_by` to `skills` (allowing nullable `category_id` for pending user skills), created `areas` table for Ormoc barangays, and built `add_profile_skills(p_skill_ids, p_custom_names)` and `complete_onboarding()` RPCs. Resolved PL/pgSQL output column ambiguity (`out_skill_id`, `out_skill_name`) and ensured `profiles.updated_at` column presence.
- **Edge Function (`supabase/functions/ai-assist/index.ts`)**: Deployed Deno Edge Function integrating Google Gemini (`gemini-3.8-flash` via `GEMINI_API_KEY`) with task allow-listing (`suggest_skills`, `draft_bio`, `polish_gig_description`), JWT + active profile verification, rate limiting (10/hr, 30/day via `rate_limit_events`), PII/URL/phone stripping, `1500` token output allowance, and resilient JSON boundary extraction.
- **Onboarding UI (`step2-skills.tsx`, `step3-profile.tsx`)**: Wired AI skill suggestion chips, manual custom skill fallback, and AI bio drafting options.

#### Milestone 15: Complete Real Loop & Navigation Hardening (`20261011000015_real_loop.sql`)
- **End-to-End Loop Hardening**: Fixed `respond_to_counter` agreement role mapping, hardened `cancel_agreement` to notify the counterparty on both free cancellations and post-submission disputes, and authored the two-device verification script in `docs/E2E_LOOP.md`.
- **Navigation Guards**: Hardened all `router.back()` handlers across 12 screens with `router.canGoBack() ? router.back() : router.replace(fallbackRoute)` to prevent unhandled `GO_BACK` warnings on deep links or fresh reloads.

### v5.1 – v5.3 Profile, Category, Skills & UX Real-Logic Milestones (Milestones 16–21 & Cross-Platform Hardening)

#### Milestone 16: Profile Completeness, Richer Profiles & Email Duplicate Guard (`20261011000016_profile_completeness_and_details.sql`)
- **Email Normalization & Duplicate Detection**: Added `normalizeEmail()`, domain typo validation (`gmial.com`, `yaho.com`, etc.), `isDuplicateEmailAuthResult()` detecting both explicit Supabase error codes and empty `identities` arrays, and double-tap in-flight signup locks.
- **Richer Profile Schema & RPCs**: Added `headline`, `preferred_contact`, `languages`, `work_types`, `availability`, `experience_years`, `starting_rate_note`, and `profile_private.phone`. Created `update_profile_details(...)`, `get_profile_completeness(p_profile_id)`, and `set_profile_avatar(p_avatar_path)` which atomically updates `avatar_path` and returns `previous_avatar_path` so old objects in the `avatars` bucket are automatically cleaned up.
- **UI Components**: Built `ProfileCompletenessCard` and `ProfileCompleteBadge` (`components/ui/ProfileCompleteness.tsx`) with interactive missing-item deep links.

#### Milestone 17: Client Hiring Details & Role-Gated Skills (`20261011000017_client_hiring_details.sql`)
- **Role Separation**: Enforced that skills belong strictly to freelancers (`find_work` mode), while clients (`hire` mode) manage hiring details (`client_type`, `business_name`, `about_hiring`, and up to 8 `profile_hiring_interests`).
- **Database Guards**: Updated `add_profile_skills` to reject calls when `active_mode <> 'find_work'`, created `save_hiring_details(...)` RPC, and branched Onboarding Step 2 (`step2-skills.tsx`) and Profile screens by active mode.
- **AI Assist Expansion**: Added `suggest_categories` task to the `ai-assist` Edge Function and `services/ai.ts`.

#### Milestone 18: Unlocked Post-Gig Category Flow — Suggest-First, Create-Last (`20261011000018_post_gig_category_unlocked.sql`)
- **Fuzzy Trigram Deduplication**: Enabled `pg_trgm` extension and implemented `get_or_create_category(p_raw_name)`, `suggest_categories_for_gig(p_title, p_description)`, `find_similar_categories(p_raw_name)`, `get_browse_categories()`, and `admin_merge_categories(p_source_id, p_target_id)`.
- **Unlocked Gig Posting**: Removed the blocking "No Categories Available" lock in `app/gigs/post.tsx`. Clients can now get AI + trigram category suggestions or propose a new category with similarity prompts and a 3-new-categories-per-24h rate limit.

#### Milestone 19: Hardened Freelancer Skills Flow (`20261011000019_skills_flow_hardened.sql`)
- **Strict Skill Validation & Quotas**: Enforced 2–40 char skill bounds, blocked emails/URLs/phone numbers/profanity, deduplicated case-insensitively via `name_normalized`, capped at 15 skills per profile, and enforced a 5 custom skills per 24 hours quota per user.
- **UI Tray & Pending Review Badges**: Updated `app/(onboarding)/step2-skills.tsx` and `app/profile/skills.tsx` with a live `Your skills (n/15)` tray, `Pending review` badges for user-created skills (`is_active = false`), and zero-skill warning banners.

#### Milestone 20: Shared 10-Stage Relationship Loop (`components/ui/Timeline.tsx`)
- **Unified Lifecycle View**: Built `Timeline`, `NextStepBanner`, and `computeLoopStage()` mapping every database state across all 10 stages (`Posted` $\rightarrow$ `Applied` $\rightarrow$ `Agreed` $\rightarrow$ `Milestones set` $\rightarrow$ `Work submitted` $\rightarrow$ `Work approved` $\rightarrow$ `Payment sent` $\rightarrow$ `Payment confirmed` $\rightarrow$ `Completed` $\rightarrow$ `Reviewed`).
- **Complementary Role Banners**: Integrated across `app/agreements/[id].tsx`, `app/(tabs)/activity.tsx`, `app/gigs/[id].tsx`, and `app/gigs/[id]/applicants.tsx` so both Client and Freelancer see the exact same current stage with role-specific next-step guidance.

#### Milestone 21: UX Real-Logic Audit & Submissions Alignment (`20261011000021_fix_submissions_columns.sql`)
- **Zero Forbidden UX Patterns**: Audited all screens and services to guarantee zero `setTimeout`, `Math.random`, empty `onPress`, `TODO`/`FIXME`, or prohibited trust words (`verified`, `guaranteed`, `mock`, `fake`, `dummy`, `sample`).
- **Centralized SQL Error Mapper**: Added `mapSqlErrorToFriendlyMessage()` in `constants/strings.ts` to translate Postgres constraints and RPC exceptions into clear user-facing guidance.
- **Private Storage Signed URLs & Submissions Schema Fix**: Wired private `submissions` and `receipts` bucket uploads with signed URL generation (`createSignedUrl`, `createSignedReceiptUrl`) and reconciled `submissions` table columns (`freelancer_id`, `submission_number`, `message`, `file_paths`).

#### Cross-Platform Universal Image Upload & V2 Final Live Verification (`utils/imageUpload.ts`)
- **Universal Image Picker & Binary Converter (`utils/imageUpload.ts`)**:
  - **PC & Laptop (Web)**: Built a direct HTML5 `<input type="file">` picker with window-focus cancel recovery (preventing stuck loading spinners when closing the OS file dialog) and an automatic **HTML5 Canvas normalizer** (`renderWebImageViaCanvas`) that center-crops avatars to `1:1` square, downscales oversized 4K screenshots under 5 MB, and converts `.jfif`/`.heic`/`.bmp` into clean JPEG/PNG `Uint8Array` bytes.
  - **Mobile (Android & iOS)**: Enabled `base64: true` on `expo-image-picker` and decoded directly into a raw `Uint8Array` via pure-JS `decodeBase64ToUint8Array()`, eliminating React Native `Blob` polyfill upload failures on Supabase Storage.
  - **URI-Safe Format Resolution**: Fixed `validateImageFile()` and `resolveImageFormat()` to ignore dots inside `blob:`, `data:`, and Android `content://` URIs while normalizing iOS `.HEIC`/`.HEIF` transcodes.
  - **Avatar Cache & Error Recovery (`components/ui/Avatar.tsx`)**: Keyed `<Image>` by `imageUri` for instant visual refresh and added `onError` fallback to initials.
- **Live 4-Part Production Audit**: Executed and passed Part A (Database & RLS Audit), Part B (Live Account Creation, Mode Selection & Custom Skills Quota), Part C (Full 10-Stage Job Loop including deliverable upload to `submissions`, revision cycle, approval, receipt upload to `receipts`, payment confirmation, agreement completion, and mutual reviews with role-segregated rating recalculation), and Part D (Authenticated Non-Owner Security Spot Checks).

---

## 3. Database Architecture & Migrations Log

All database changes are captured in sequential SQL migrations within `supabase/migrations/`:

| Migration File | Primary Responsibility |
|---|---|
| `20261010000000_init.sql` | Base Supabase initialization and extensions (`uuid-ossp`, `pgcrypto`). |
| `20261011000001_auth_profiles.sql` | `profiles`, `profile_private`, `platform_admins`, `handle_new_user` trigger (18+ gate). |
| `20261011000002_profiles_and_storage.sql` | Categories, skills, profile-skills junction, portfolio items, storage buckets & policies. |
| `20261011000003_gigs_and_modes.sql` | `gigs` table, indexes, mode check constraints, `publish_gig` RPC. |
| `20261011000004_applications_and_agreements.sql` | Applications, counteroffers, agreements, audit logging, atomic agreement creation, initial `switch_mode`. |
| `20261011000005_milestones_and_submissions.sql` | Milestones, submissions, submission storage bucket, `define_milestones`, `submit_milestone`, `review_milestone`. |
| `20261011000006_payments.sql` | Payments ledger, receipts bucket, `report_payment`, `confirm_payment`, `complete_agreement`. |
| `20261011000007_reviews.sql` | `reviews` table, per-role ratings, 14-day window gate, `submit_review`. |
| `20261011000008_reports_and_messages.sql` | Reports, realtime chat (`conversations`, `messages`), agreement cancellation, admin hide review. |
| `20261011000009_v3_hardening_and_retrofit.sql` | Security hardening, permission revocations, updated `switch_mode` with report blockers. |
| `20261011000010_fix_mode_switch.sql` | Client confirmation alignment for mode switching and application withdrawal logic. |
| `20261011000010_own_content_rule.sql` | Database-level self-dealing prevention: check constraints, `get_available_gigs`, self-action guards. |
| `20261011000011_notifications.sql` | `notifications` table, internal `notify()` helper, lifecycle notification triggers, read RPCs. |
| `20261011000012_real_messaging.sql` | Auto-conversation creation on application, `conversation_reads`, collapsed message notifications, metadata RPCs. |
| `20261011000013_real_post_gig.sql` | `create_draft_gig`, idempotent `publish_gig` with validation parity, `cancel_gig` RPC. |
| `20261011000014_ai_onboarding.sql` | User-originated `skills`, `areas` table, `add_profile_skills` RPC, `complete_onboarding` RPC, `profiles.updated_at`. |
| `20261011000015_real_loop.sql` | `respond_to_counter` role fix, `cancel_agreement` notifications, end-to-end loop hardening. |
| `20261011000016_profile_completeness_and_details.sql` | Richer profile columns, `profile_private.phone`, `update_profile_details`, `get_profile_completeness`, `set_profile_avatar`. |
| `20261011000017_client_hiring_details.sql` | Client hiring fields, `profile_hiring_interests`, `save_hiring_details` RPC, freelancer-only skill guard. |
| `20261011000018_post_gig_category_unlocked.sql` | `pg_trgm` fuzzy matching, `get_or_create_category`, `suggest_categories_for_gig`, `find_similar_categories`, `get_browse_categories`, `admin_merge_categories`. |
| `20261011000019_skills_flow_hardened.sql` | `skills.name_normalized` unique index, `remove_profile_skill`, 15-skill cap, 5/24h custom skill rate limit, profanity/PII guards. |
| `20261011000021_fix_submissions_columns.sql` | Reconciled `submissions` table columns (`freelancer_id`, `submission_number`, `message`, `file_paths`) and RLS policies with `submit_milestone` RPC. |

---

## 4. Frontend Screen Map & Navigation Structure

All routes follow the Expo Router file-system hierarchy under `app/`:

### Authentication & Onboarding
- `app/(auth)/welcome.tsx`: Landing screen with app introduction.
- `app/(auth)/login.tsx`: Email and password sign-in (with `canGoBack` fallback).
- `app/(auth)/signup-step1.tsx`: Step 1 registration (Name, Email normalization & typo check, Password, Terms).
- `app/(auth)/signup-step2.tsx`: Step 2 registration (Birth date picker, 18+ validation, duplicate email guard).
- `app/(auth)/confirm-email.tsx`: Email verification state screen.
- `app/(auth)/forgot-password.tsx`: Password recovery email flow.
- `app/(onboarding)/step1-mode.tsx`: Mandatory initial mode selection (`find_work` vs `hire`).
- `app/(onboarding)/step2-skills.tsx`: Role-branched onboarding step 2 — Freelancer Skills (`Your skills (n/15)` tray, AI suggestions, custom skills) vs Client Hiring Details (`client_type`, `business_name`, `hiring_interests`).
- `app/(onboarding)/step3-profile.tsx`: Cross-platform profile photo upload + Barangay/area selection + short bio with AI bio drafting (`draft_bio`) + `complete_onboarding()`.

### Core Tab Navigation (`app/(tabs)/`)
- `_layout.tsx`: Role-adaptive tab labels, icons, and live unread conversation badge driven by `useAppTheme()`.
- `index.tsx`: Home / Overview screen adapted to active mode with live unread notification bell badge.
- `gigs.tsx`: 
  - **Freelancer**: Browse and search open gigs with populated category chips (`get_browse_categories`) excluding own gigs.
  - **Client**: "My Gigs" management tab with status filters + "Marketplace" view.
- `activity.tsx`:
  - **Freelancer**: Proposals and Active Jobs tracker with shared `Timeline` and `NextStepBanner`.
  - **Client**: Applicants and Hired Freelancers tracker with shared `Timeline` and `NextStepBanner`.
- `messages.tsx`: Realtime conversations list with gig title, last message preview, and unread indicators.
- `profile.tsx`: Role-aware user profile view with cross-platform avatar menu, `ProfileCompletenessCard`, role-specific stats, mode switcher, and settings.

### Detail & Action Screens
- `app/notifications.tsx`: Real-time notification center with mark-all-read and entity deep-linking.
- `app/gigs/post.tsx`: Unlocked post/draft gig flow with Suggest-First, Create-Last category picker, trigram similarity guard, and AI description polish (`polish_gig_description`).
- `app/gigs/[id].tsx`: Gig detail view with shared `Timeline` and viewer-dependent CTA (Apply, Manage Applicants, Cancel Gig).
- `app/gigs/[id]/apply.tsx`: Application submission with proposed price and pitch.
- `app/gigs/[id]/applicants.tsx`: Applicant review, counteroffer, and acceptance interface with `Timeline` and `NextStepBanner`.
- `app/agreements/[id].tsx`: Master 10-stage agreement dashboard with `Timeline`, `NextStepBanner`, milestone review, payment confirmation, signed receipt viewer, cancellation, and mutual review actions.
- `app/agreements/[id]/milestones/setup.tsx`: Milestone breakdown definition (1–5 milestones summing to agreed price).
- `app/agreements/[id]/milestones/[milestoneId]/submit.tsx`: Cross-platform deliverable image/file upload (`submissions` bucket) for milestone work.
- `app/agreements/[id]/milestones/[milestoneId]/review.tsx`: Client milestone review, signed deliverable preview, approval, and revision requester.
- `app/agreements/[id]/payments/report.tsx`: Payment reporting interface with cross-platform receipt image upload (`receipts` bucket).
- `app/agreements/[id]/payments/[paymentId]/dispute.tsx`: Dispute submission for reported payments.
- `app/agreements/[id]/review.tsx`: Agreement completion mutual review and star rating form.
- `app/chat/[conversationId].tsx`: Realtime chat thread between participants.
- `app/profile/[id].tsx`: Public profile view displaying role-segregated ratings, skills/portfolio for freelancers, and hiring details/interests for clients.
- `app/profile/edit.tsx`: Full profile editor with cross-platform photo upload/removal, `ProfileCompletenessCard`, freelancer availability/rates, and client hiring details.
- `app/profile/skills.tsx`: Manage freelancer skills (`n/15` cap, `Pending review` badges, custom skill creation).
- `app/profile/portfolio.tsx`: Upload up to 3 cross-platform portfolio photos per project and organize portfolio items.
- `app/reports/new.tsx`: File a report against a user, gig, or message.
- `app/settings/mode.tsx`: Switch active mode between Freelancer and Client with blocker validation, channel cleanup, and confirmation modal.

---

## 5. Service Layer, Utilities & Edge Function Architecture

Business logic is encapsulated in strongly-typed service modules under `services/`, cross-platform utilities under `utils/`, and serverless Deno functions under `supabase/functions/`:

- `utils/imageUpload.ts`: Universal cross-platform image picker and binary converter (`pickImagesUniversal`, `decodeBase64ToUint8Array`, `resolveImageFormat`, `assetToPickedImageFile`) supporting PC/laptop web browsers (HTML5 `<input type="file">`, focus-cancel recovery, HTML5 Canvas `1:1` crop & 4K compression) and Android/iOS (`base64` $\rightarrow$ `Uint8Array` binary upload, HEIC/JFIF normalization).
- `services/auth.ts`: Authentication state, email normalization & typo guard, duplicate email detection, signup, signin, password recovery, `completeOnboarding()`, session & channel cleanup.
- `services/profile.ts`: Profile retrieval, completeness checks, `updateProfileDetails()`, `saveHiringDetails()`, `addProfileSkills()`, `removeUserSkill()`, cross-platform avatar and portfolio uploads (`uploadAvatar`, `pickAndUploadAvatar`, `pickAndUploadPortfolioImages`).
- `services/ai.ts`: Client wrapper for invoking the `ai-assist` Edge Function (`suggestSkills`, `suggestCategories`, `suggestGigCategory`, `draftBio`, `polishGigDescription`) with structured error unpacking.
- `services/notifications.ts`: Notification fetching, `markRead`, `markAllRead`, `getUnreadCount`, deep-link routing, and unique-channel Realtime subscriptions.
- `services/gigs.ts`: Gig listing, search queries, `createDraftGig`, `publishGig`, `cancelGig`, `suggestCategoriesWithAiFallback`, `findSimilarCategories`, `getBrowseCategories`.
- `services/applications.ts`: Application submission, counteroffers, acceptance, withdrawal, and agreement spawning.
- `services/milestones.ts`: Milestone definitions, cross-platform deliverable file upload (`submissions` bucket), signed URL generation, revision requests, approvals.
- `services/payments.ts`: Payment reporting, cross-platform receipt image upload (`receipts` bucket), signed URL generation, payment confirmation, disputes, and agreement completion.
- `services/reviews.ts`: Review submissions, role-segregated rating calculations, review visibility filtering.
- `services/chat.ts`: Conversation metadata, `markConversationRead`, Realtime message subscriptions, message sending.
- `services/reports.ts`: Filing moderation reports and agreement cancellations.
- `supabase/functions/ai-assist/index.ts`: Deno Edge Function integrating Google Gemini (`gemini-3.8-flash`) and Anthropic fallback, enforcing auth, active profile checks, rate limits, PII scrubbing, and JSON schema validation.

---

## 6. Test Suite & Verification Status

The project includes a comprehensive automated test suite executed via the native Node.js test runner (`node --test test/*.test.js`) alongside SQL pgTAP tests in `supabase/tests/`:

### Verified Test Categories (90/90 passing):
1. **Milestone 16 — Profile Completeness, Email & Cross-Platform Upload (`test/m16_profile_completeness_and_email.test.js`)**: Email normalization, duplicate email detection (`user_already_exists` + empty `identities`), double-tap signup lock, domain typo guard, avatar path & old object cleanup, and universal PC/laptop/mobile image upload verification (`utils/imageUpload.ts`).
2. **Milestone 17 — Client Hiring Details (`test/m17_client_hiring_details.test.js`)**: Skills mode guard (`find_work` only), max 8 hiring interests, 2–60 char `business_name`, `suggest_categories` AI task, onboarding branching, and public profile client view.
3. **Milestone 18 — Unlocked Post-Gig Category Flow (`test/m18_post_gig_category_unlocked.test.js` & `supabase/tests/m18_categories.test.sql`)**: `pg_trgm` fuzzy matching, `get_or_create_category`, `suggest_categories_for_gig`, `find_similar_categories`, `get_browse_categories`, `admin_merge_categories`, and Suggest-First UI flow.
4. **Milestone 19 — Hardened Skills Flow (`test/m19_skills_flow.test.js` & `supabase/tests/m19_skills.test.sql`)**: Skill name validation, case-insensitive deduplication, 5/24h custom skill quota, 15/profile limit, and `Pending review` badge rendering.
5. **Milestone 20 — Shared 10-Stage Relationship Loop (`test/m20_shared_loop_view.test.js`)**: 10-stage `Timeline` mapping, complementary `NextStepBanner` copy for both roles across every database status, and notification/chat deep-linking.
6. **Milestone 21 — UX Real-Logic Audit (`test/m21_ux_real_logic.test.js`)**: Zero forbidden patterns (`setTimeout`, `Math.random`, empty `onPress`, `TODO`, `FIXME`, `coming soon`), zero prohibited trust words (`verified`, `guaranteed`, `mock`, `fake`, `dummy`, `sample`), guarded `router.back()`, Realtime channel cleanup, `mapSqlErrorToFriendlyMessage`, and private `submissions`/`receipts` signed URLs.
7. **Core Marketplace, AI, Notifications, Messaging & Loop (`test/ai_onboarding.test.js`, `test/notifications.test.js`, `test/messaging_real.test.js`, `test/post_gig_real.test.js`, `test/real_loop.test.js`, `test/applications.test.js`, `test/auth.test.js`, `test/gigs.test.js`, `test/hardening.test.js`, `test/milestones.test.js`, `test/own_content.test.js`, `test/payments.test.js`, `test/profile.test.js`, `test/reports_messages.test.js`, `test/reviews.test.js`, `test/setup.test.js`)**: 18+ verification, centavos math, RLS privacy, 14-day review window, mode switch blockers, and full 10-stage job loop integrity.

---

## 7. Current Project State & Next Steps

- **Completed**:
  - Milestones 0 through 21 + Cross-Platform Universal Image Upload (`utils/imageUpload.ts`).
  - Live deployment and verification of all migrations (`20261010000000_init.sql` through `20261011000021_fix_submissions_columns.sql`) on Supabase instance `ddnwqtzheroqcoopvrrb`.
  - Passed all 4 parts of the **V2 Final Live Check** (Database Audit, Account Creation & Skills Flow, Full 10-Stage Job Loop, and Security Spot Checks) and **90/90 automated unit tests**.
  - Generated full repository Knowledge Graph (`graphify-out/graph.html`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`).
  - Database purged clean (0 test rows) and ready for live production / pilot onboarding.
- **Ready for Execution**: **Live Ormoc City Pilot Launch (`docs/PILOT_GUIDE.md`)**.

