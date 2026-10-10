# Gigormoc — Comprehensive Project Implementation Document

**Project:** Gigormoc  
**Target Market:** Ormoc City, Philippines (18+ Local Freelance Marketplace)  
**Architecture:** Single-codebase mobile and web (Expo React Native, Expo Router, TypeScript Strict) backed 100% by Supabase (Auth, Postgres RLS, Storage, Realtime, RPC Functions).  
**Document Generation Date:** October 11, 2026  

---

## 1. Executive Summary & Vision

Gigormoc is designed as an honest, localized freelance marketplace tailored specifically for Ormoc City. Rather than adopting complex global escrow models or simulated in-app wallets, Gigormoc coordinates peer-to-peer freelance agreements, milestones, and direct real-world payments (e.g., GCash, Maya, PayPal, or bank transfer in PHP integer centavos). 

### Key Architectural Pillars:
- **Zero Mock / Zero Seed Policy**: No fake data, mock users, or placeholder counters exist in code. Empty states reflect true database state.
- **Strict Database-Enforced Modes**: Users toggle between `find_work` (freelancer) and `hire` (client) modes. Modes are enforced via PostgreSQL `SECURITY DEFINER` RPC functions with strict transition restrictions and cooldowns.
- **Separation of Concerns & Privacy**: Row Level Security (RLS) is default-deny. Date of birth and private contact data are separated into a non-public `profile_private` table.
- **Own-Content Enforcement**: Users are blocked in both database and UI from applying to, reviewing, or reporting their own listings or identities.
- **NativeWind & Token Design System**: Role-adaptive theme tokens switch between Freelancer (Cobalt) and Client (Navy/Warm) skins.

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

### v4 Evolution & Retrofit (R4 & R5):
- **Database Own-Content Rules (Migration `20261011000010_own_content_rule.sql`)**:
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

---

## 4. Frontend Screen Map & Navigation Structure

All routes follow the Expo Router file-system hierarchy under `app/`:

### Authentication & Onboarding
- `app/(auth)/welcome.tsx`: Landing screen with app introduction.
- `app/(auth)/login.tsx`: Email and password sign-in.
- `app/(auth)/signup-step1.tsx`: Step 1 registration (Name, Email, Password, Terms).
- `app/(auth)/signup-step2.tsx`: Step 2 registration (Birth date picker, 18+ validation).
- `app/(auth)/confirm-email.tsx`: Email verification state screen.
- `app/(auth)/forgot-password.tsx`: Password recovery email flow.
- `app/(onboarding)/step1-mode.tsx`: Mandatory initial mode selection (`find_work` vs `hire`).
- `app/(onboarding)/step2-skills.tsx`: Initial skills selection (skippable).
- `app/(onboarding)/step3-profile.tsx`: Bio and photo setup (skippable).

### Core Tab Navigation (`app/(tabs)/`)
- `_layout.tsx`: Role-adaptive tab labels and icons driven by `useTheme()`.
- `index.tsx`: Home / Overview screen adapted to active mode.
- `gigs.tsx`: 
  - **Freelancer**: Browse and search open gigs (excludes own gigs).
  - **Client**: "My Gigs" management tab with status filters + "Marketplace" view.
- `activity.tsx`:
  - **Freelancer**: Proposals and Active Jobs tracker.
  - **Client**: Applicants and Hired Freelancers tracker.
- `messages.tsx`: Realtime conversations list with unread indicators.
- `profile.tsx`: User profile view with mode switcher button, settings, and navigation.

### Detail & Action Screens
- `app/gigs/post.tsx`: Post/draft a new gig (Client mode only).
- `app/gigs/[id].tsx`: Gig detail view with viewer-dependent CTA (Apply, Manage Applicants, or Post Same).
- `app/gigs/[id]/apply.tsx`: Application submission with proposed price and pitch.
- `app/gigs/[id]/applicants.tsx`: Applicant review, counteroffer, and acceptance interface.
- `app/agreements/[id].tsx`: Master agreement dashboard with milestone and payment summaries.
- `app/agreements/[id]/milestones/setup.tsx`: Milestone breakdown definition (1–5 milestones summing to agreed price).
- `app/agreements/[id]/milestones/[milestoneId]/submit.tsx`: Submission upload for milestone work.
- `app/agreements/[id]/milestones/[milestoneId]/review.tsx`: Client milestone review and revision requester.
- `app/agreements/[id]/payments/report.tsx`: Payment reporting interface with receipt upload.
- `app/agreements/[id]/payments/[paymentId]/dispute.tsx`: Dispute submission for reported payments.
- `app/agreements/[id]/review.tsx`: Agreement completion review and star rating form.
- `app/chat/[conversationId].tsx`: Realtime chat thread between participants.
- `app/profile/[id].tsx`: Public profile view displaying separated role ratings.
- `app/profile/edit.tsx`: Edit public name, bio, and avatar.
- `app/profile/skills.tsx`: Manage profile skills.
- `app/profile/portfolio.tsx`: Upload and organize portfolio items.
- `app/reports/new.tsx`: File a report against a user, gig, or message.
- `app/settings/mode.tsx`: Switch active mode between Freelancer and Client with blocker validation and confirmation modal.

---

## 5. Service Layer Architecture

Business logic is encapsulated in strongly-typed service modules under `services/`:

- `services/auth.ts`: Authentication state, signup, signin, password recovery, session handling.
- `services/profile.ts`: Profile retrieval, private data handling, avatar uploads, portfolio management.
- `services/gigs.ts`: Gig listing, search queries, creation, and lifecycle management.
- `services/applications.ts`: Application submission, counteroffers, acceptance, and agreement spawning.
- `services/milestones.ts`: Milestone definitions, submission handling, revision requests, approvals.
- `services/payments.ts`: Payment reporting, receipt uploads, payment confirmation, and agreement completion.
- `services/reviews.ts`: Review submissions, rating calculations, review visibility filtering.
- `services/chat.ts`: Realtime message subscriptions, message sending, unread handling.
- `services/reports.ts`: Filing moderation reports with optional evidence attachments.

---

## 6. Test Suite & Verification Status

The project includes an automated test suite executed via the native Node.js test runner (`node --test test/*.test.js`):

### Verified Test Categories (35/35 passing):
1. **Agreement Lifecycle & Constraints**: Single active status, double-accept race condition protection.
2. **Mode Switch Eligibility**: Cooldown enforcement, blocker rules (open gigs, active agreements, pending payments, reports).
3. **Age Verification**: 18+ enforcement on birth dates.
4. **Data Privacy**: Separation of `profile_private` and public profile safety.
5. **Currency Math**: Safe centavos integer calculations and formatting in PHP ₱.
6. **Milestone Integrity**: Sum equality to agreed total, 2-revision ceiling.
7. **Payment State Transitions**: `reported_sent` to `confirmed_received`, escrow prevention checks.
8. **Review Rules**: 14-day deadline from `completed_at`, exclusion of hidden reviews, single review per participant.
9. **Own-Content Rules**: Blocked self-applications, blocked self-agreements, blocked self-reviews, and exclusion of own gigs from marketplace browsing.
10. **Storage Isolation**: Verification of private bucket policy scopes.

---

## 7. Current Project State & Next Steps

- **Completed**: Milestones 0 through 9, Retrofit audits R1–R3, Own-Content rule retrofit R4, and Role UX retrofit R5.
- **In Progress / Next**: **Milestone 10 (Ormoc City Pilot Testing)**.
  - The pilot handbook is drafted in `docs/PILOT_GUIDE.md`.
  - Testing with ~10 local Ormoc testers to gather usability feedback, transaction flows, and edge cases prior to production release.
