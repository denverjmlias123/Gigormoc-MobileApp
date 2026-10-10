# Gigormoc Pilot Guide & Testing Handbook (Milestone 10)

Welcome to the **Gigormoc Pilot Testing Program** in Ormoc City! This document outlines everything necessary to run the pilot test with 10 real local Ormoc participants.

---

## 1. Prerequisites & Operator Supabase Setup

Before handing the app to testers, the platform operator must configure the following directly in the **Supabase Dashboard**:

### A. Run Database Migrations
Ensure migrations `20261010000000` through `20261011000009` have been applied in order via the Supabase SQL Editor.

### B. Add Initial Ormoc Categories and Skills
Per the zero-seed rule, the database starts empty. Add initial categories and skills via the Supabase Table Editor (`categories` and `skills` tables):

#### Recommended Categories (`public.categories`):
- `Graphics & Design` (slug: `graphics-design`)
- `Web & Mobile Development` (slug: `dev-tech`)
- `Home & Appliance Repairs` (slug: `home-repairs`)
- `Tutoring & Academic Assistance` (slug: `tutoring`)
- `Photography & Events` (slug: `photo-events`)

#### Recommended Skills (`public.skills`):
- For `Graphics & Design`: `Logo Design`, `Tarpaulin Layout`, `Menu Design`
- For `Web & Mobile Development`: `React Native`, `WordPress Setup`, `Frontend Web`
- For `Home & Appliance Repairs`: `Aircon Cleaning`, `Plumbing`, `Electrical Wiring`

### C. Configure Storage Buckets
Verify in Supabase Storage that the 4 buckets exist:
1. `avatars` (Public read, max 2MB, image/jpeg, image/png)
2. `portfolio` (Public read, max 10MB, images)
3. `submissions` (Private, max 25MB)
4. `receipts` (Private, max 10MB)

### D. Set Up App Admin
Insert the operator's `auth.users.id` into `public.platform_admins`:
```sql
INSERT INTO public.platform_admins (user_id) VALUES ('YOUR-USER-UUID');
```

---

## 2. Tester Cohort (10 Participants)

To accurately test both sides of the marketplace and edge cases:

- **Group A: Clients (5 Testers)**
  - Local business owners / residents in Ormoc (e.g. Valencia, Cogon, Linao, Poblacion).
  - Assigned mode on onboarding: **Hire Someone**.
  - Task: Post gigs, review applications, approve milestones, report payments.

- **Group B: Freelancers (5 Testers)**
  - Local students / freelancers aged 18+.
  - Assigned mode on onboarding: **Find Work**.
  - Task: Complete profiles, select skills, apply to gigs, submit milestones, confirm payments.

---

## 3. Step-by-Step Pilot Walkthrough Script

### Stage 1: Registration & Age Verification (Both Groups)
1. Launch the Gigormoc app on mobile (Expo Go / APK) or Web.
2. Sign up with email, display name, and password.
3. Verify birth date:
   - *Test check:* Try entering a birth date indicating age < 18 (should be blocked with clear explanation).
   - Enter a valid birth date (18+).
4. Confirm email via the email confirmation link.
5. Log in.

### Stage 2: Mode Selection & Profile Setup
1. Complete onboarding by selecting your initial role:
   - Group A selects **Hire Someone**.
   - Group B selects **Find Work**.
2. Visit **Profile Tab**:
   - Upload avatar.
   - Freelancers: Select at least 2 skills and add 1 portfolio sample.
   - Notice that ratings start at 0 and display strictly by role.

### Stage 3: Gig Posting & Discovery
1. **Client:** Tap "Post a Gig" under the Gigs tab:
   - Provide title, description, category, price range in Philippine Pesos (₱), and deadline.
   - Save draft, then tap **Publish**.
2. **Freelancer:** Open the Gigs tab:
   - Use search and filter by category or Ormoc area.
   - Verify published gig is displayed with honest details.

### Stage 4: Applications & Agreements
1. **Freelancer:** Open the gig detail screen and tap **Apply for this Gig**.
   - Propose price, estimated days, and pitch message.
2. **Client:** Open the gig → **View Applicants**:
   - Inspect applicant profile and pitch.
   - Tap **Accept Application** (or propose a counter-offer).
   - Verify agreement is created and visible in the **Activity Tab**.

### Stage 5: Milestones & Delivery
1. **Both Parties:** Open the Agreement screen from the Activity tab.
2. **Client / Freelancer:** Define milestones (1 to 5) ensuring sum equals the total agreed price.
3. **Freelancer:** Tap **Submit Work** on Milestone 1:
   - Provide summary note and attach deliverables.
4. **Client:** Tap **Review Submission**:
   - Test "Request Revision" (max 2 allowed) or tap **Approve Milestone**.

### Stage 6: External Payment Evidence
1. **Client:** Tap **Report Payment**:
   - Select method (e.g., GCash, Maya, Bank Transfer, Cash).
   - Enter reference number and upload payment receipt screenshot.
2. **Freelancer:** Verify payment status shows "Reported":
   - Tap **Confirm Payment Received** (or Dispute if details are incorrect).
   - When all milestones are approved and payments confirmed, agreement transitions to **Completed**.

### Stage 7: Reviews & Ratings
1. Both parties receive review eligibility (open for 14 days following completion).
2. Submit a star rating (1 to 5) and written review (10–1000 characters).
3. Check the counterparty's public profile:
   - Verify review appears.
   - Verify role-specific rating recalculates immediately.

### Stage 8: Safety & Moderation (Controlled Test)
1. Test in-app messaging within the active agreement (Realtime updates).
2. Submit a test report on a gig or conversation to verify privacy.
3. Test Mode Switching:
   - Attempt to switch modes while an agreement or report is active (should show clear blocker message).
   - Switch modes once all commitments are cleared.

---

## 4. Pilot Feedback Log Sheet

Record tester observations in the following structured template:

| Tester ID | Role | Device / OS | Step | What Confused Them / Observed Issue | Severity (Low/Med/High) | Action Taken |
|---|---|---|---|---|---|---|
| T-01 | Client | Android 14 | Post Gig | Expected date picker instead of text inputs for deadline | Low | Added date format hint |
| T-02 | Freelancer | iOS 17 | Apply | Was wondering if budget is negotiable before applying | Med | Clarified counter-offer flow in pitch |
| T-03 | Freelancer | Mobile Web | Milestones | File upload took a while on slow LTE connection | Med | Added progress indicator |
| T-04 | Client | Android 13 | Payment | Looked for in-app checkout; reminded that payments are external | High | Strengthened payment disclaimer note |
| ... | ... | ... | ... | ... | ... | ... |

---

## 5. Exit Criteria for Pilot Completion
- [ ] 10 real Ormoc testers completed full walkthrough from registration to completion/review.
- [ ] All reported confusion points documented and reviewed.
- [ ] No database integrity violations, uncaught crashes, or security rule leaks observed.
- [ ] Ready for public launch.
