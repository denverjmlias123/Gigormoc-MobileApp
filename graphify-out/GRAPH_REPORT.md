# Graph Report - gigormoc-antigravity  (2026-10-11)

## Corpus Check
- 158 files · ~200,452 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .zip 1, .toml 1)

## Summary
- 600 nodes · 1442 edges · 37 communities (22 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.88)
- Token cost: 12,500 input · 3,200 output

## Community Hubs (Navigation)
- Authentication & Onboarding Screens
- Main App & Navigation Screens
- User Profile & Portfolio Screens
- Gig & Agreement Detail Views
- Package Dependencies & Configuration
- Milestone Submission & Review UI
- Expo App Configuration & Metadata
- Reports & Mode Settings Screens
- Client Hiring Details Tests
- Live Supabase Database Integration
- Database Migration Bundler Utility
- Core Auth & Gigs Unit Tests
- Profile Completeness & Email Tests
- Product Specifications & Role Architecture
- Gig Posting Validation Tests
- AI Onboarding & Skill Tests
- Production Hardening & Rating Tests
- Ownership & Content Access Tests
- 10-Stage Gig Loop Lifecycle Tests
- Gig Applications & Agreements Tests
- Category Suggestion & Creation Tests
- Milestone Workflow & Review Tests
- In-App Notification Routing Tests
- Mutual Reviews & Ratings Tests
- Shared Loop View Validation Tests
- Real-time Messaging & Rate Limiting Tests
- Payment Confirmation & Escrow Tests
- Safety Reports & Dispute Tests
- Zero-Mock Architecture & Rules
- TypeScript Compiler Configuration
- Edge Function AI Sanitizer Service
- Mobile App Visual Assets
- Implementation History & Milestone Chronicle
- Design System & UI Tokens
- E2E Two-Account Test Protocol
- Pilot Setup & Category Taxonomy

## God Nodes (most connected - your core abstractions)
1. `useAppTheme()` - 101 edges
2. `react-native` - 54 edges
3. `react` - 52 edges
4. `Button()` - 43 edges
5. `useAuth()` - 41 edges
6. `expo-router` - 36 edges
7. `@expo/vector-icons` - 22 edges
8. `mapSqlErrorToFriendlyMessage()` - 19 edges
9. `formatPrice()` - 18 edges
10. `strings` - 18 edges

## Surprising Connections (you probably didn't know these)
- `UX Control Contract & Proof Rule` --semantically_similar_to--> `Zero Mock Data Policy`  [INFERRED] [semantically similar]
  docs/UX_REAL_LOGIC.md → AGENTS.md
- `WelcomeScreen()` --calls--> `Button()`  [EXTRACTED]
  app/(auth)/welcome.tsx → components/ui/Button.tsx
- `OnboardingStep1ModeScreen()` --calls--> `Button()`  [EXTRACTED]
  app/(onboarding)/step1-mode.tsx → components/ui/Button.tsx
- `OnboardingStep3ProfileScreen()` --calls--> `useAuth()`  [EXTRACTED]
  app/(onboarding)/step3-profile.tsx → hooks/useAuth.tsx
- `ActivityScreen()` --calls--> `EmptyState()`  [EXTRACTED]
  app/(tabs)/activity.tsx → components/ui/EmptyState.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **10-Stage Gig Lifecycle Architecture** — docs_role_ux_freelancer_flow, docs_role_ux_client_flow, docs_profile_and_loop_v5_1_relationship_loop, docs_e2e_loop_test_procedure [INFERRED 0.95]
- **Zero-Mock Data Integrity Architecture** — agents_zero_mock_policy, docs_ux_real_logic_contract, docs_milestones_v5_real_logic, docs_implementation_history_pillars [INFERRED 0.95]
- **Dual-Role Mode & Gating Model** — docs_gigormoc_spec_role_mode_rules, docs_gigormoc_spec_gates_and_verification, docs_profile_and_loop_v5_1_skills_vs_hiring [INFERRED 0.85]

## Communities (37 total, 15 thin omitted)

### Community 0 - "Authentication & Onboarding Screens"
Cohesion: 0.07
Nodes (49): ConfirmEmailScreen(), styles, styles, styles, styles, styles, WelcomeScreen(), ChatScreen() (+41 more)

### Community 1 - "Main App & Navigation Screens"
Cohesion: 0.08
Nodes (45): ForgotPasswordScreen(), SignUpStep1Screen(), SignUpStep2Screen(), styles, WorkType, NotificationsScreen(), styles, OnboardingStep3ProfileScreen() (+37 more)

### Community 2 - "User Profile & Portfolio Screens"
Cohesion: 0.07
Nodes (40): EditProfileScreen(), styles, styles, PortfolioScreen(), styles, ProfileScreen(), styles, AvatarProps (+32 more)

### Community 3 - "Gig & Agreement Detail Views"
Cohesion: 0.11
Nodes (41): AgreementDetailScreen(), styles, GigApplicantsScreen(), styles, GigDetailScreen(), styles, ActivityScreen(), styles (+33 more)

### Community 4 - "Package Dependencies & Configuration"
Cohesion: 0.04
Nodes (47): dependencies, dotenv, expo, expo-constants, expo-image-picker, expo-linking, expo-router, expo-status-bar (+39 more)

### Community 5 - "Milestone Submission & Review UI"
Cohesion: 0.10
Nodes (30): ReviewMilestoneScreen(), styles, styles, SubmitMilestoneScreen(), MilestoneDraft, SetupMilestonesScreen(), styles, DisputePaymentScreen() (+22 more)

### Community 6 - "Expo App Configuration & Metadata"
Cohesion: 0.07
Nodes (28): backgroundColor, foregroundImage, adaptiveIcon, expo, android, assetBundlePatterns, extra, icon (+20 more)

### Community 7 - "Reports & Mode Settings Screens"
Cohesion: 0.11
Nodes (20): NewReportScreen(), REASON_CATEGORIES, styles, ModeSettingsScreen(), styles, confirmDialog(), notify(), supabase (+12 more)

### Community 8 - "Client Hiring Details Tests"
Cohesion: 0.10
Nodes (16): assert, fs, path, ROOT, { test, describe }, assert, fs, path (+8 more)

### Community 9 - "Live Supabase Database Integration"
Cohesion: 0.10
Nodes (13): @supabase/supabase-js, { createClient }, supabase, clientUserClient, { createClient }, freelancerClient, clientA, { createClient } (+5 more)

### Community 10 - "Database Migration Bundler Utility"
Cohesion: 0.13
Nodes (13): bundleFiles(), dir, files, fs, full, makePoliciesIdempotent(), part1, part1Files (+5 more)

### Community 11 - "Core Auth & Gigs Unit Tests"
Cohesion: 0.15
Nodes (8): assert, test, assert, test, assert, test, assert, test

### Community 12 - "Profile Completeness & Email Tests"
Cohesion: 0.29
Nodes (8): assert, COMMON_EMAIL_DOMAIN_TYPOS, fs, normalizeEmail(), path, simulatedSignUp(), test, validateEmailInput()

### Community 13 - "Product Specifications & Role Architecture"
Cohesion: 0.25
Nodes (9): Onboarding Verification Gates, Gigormoc MVP Product Spec, Role Mode Architecture, Shared Relationship Loop (v5.1), Role Gated Profile Fields, AI-Powered Skills Onboarding, Live In-App Notifications, Client Screen Loop & Actions (+1 more)

### Community 16 - "Production Hardening & Rating Tests"
Cohesion: 0.29
Nodes (3): assert, test, validateProductionSafety()

### Community 20 - "Category Suggestion & Creation Tests"
Cohesion: 0.29
Nodes (5): assert, fs, path, rootDir, test

### Community 24 - "Shared Loop View Validation Tests"
Cohesion: 0.33
Nodes (5): assert, fs, path, ROOT, test

### Community 28 - "Zero-Mock Architecture & Rules"
Cohesion: 0.40
Nodes (3): Retrofit and Audit Protocol, Gigormoc Fixed Tech Stack, UX Control Contract & Proof Rule

### Community 29 - "TypeScript Compiler Configuration"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, exclude, extends

### Community 31 - "Mobile App Visual Assets"
Cohesion: 0.50
Nodes (4): Adaptive Icon Asset, Favicon Asset, Application Icon Asset, Splash Screen Asset

### Community 32 - "Implementation History & Milestone Chronicle"
Cohesion: 0.50
Nodes (4): Milestone Execution Chronicle, Core Architectural Pillars, Milestone Progress Tracker, v5 Real Logic Milestones

### Community 34 - "Design System & UI Tokens"
Cohesion: 0.67
Nodes (3): Ormoc Mobile Design Principles, NativeWind Design Tokens, UI Shared Component Kit

## Knowledge Gaps
- **274 isolated node(s):** `name`, `slug`, `scheme`, `version`, `orientation` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 347 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppTheme()` connect `Main App & Navigation Screens` to `Authentication & Onboarding Screens`, `User Profile & Portfolio Screens`, `Gig & Agreement Detail Views`, `Milestone Submission & Review UI`, `Reports & Mode Settings Screens`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `react-native` connect `User Profile & Portfolio Screens` to `Authentication & Onboarding Screens`, `Main App & Navigation Screens`, `Gig & Agreement Detail Views`, `Package Dependencies & Configuration`, `Milestone Submission & Review UI`, `Reports & Mode Settings Screens`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `react` connect `Authentication & Onboarding Screens` to `Main App & Navigation Screens`, `User Profile & Portfolio Screens`, `Gig & Agreement Detail Views`, `Package Dependencies & Configuration`, `Milestone Submission & Review UI`, `Reports & Mode Settings Screens`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `scheme` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Authentication & Onboarding Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.06693803708729082 - nodes in this community are weakly interconnected._
- **Should `Main App & Navigation Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.07857142857142857 - nodes in this community are weakly interconnected._
- **Should `User Profile & Portfolio Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.07138047138047138 - nodes in this community are weakly interconnected._