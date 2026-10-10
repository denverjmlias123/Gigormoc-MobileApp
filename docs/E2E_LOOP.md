# Gigormoc End-to-End Real Loop Test Script (Two Accounts)

This document provides the canonical verification script for **Milestone 15** per `docs/REAL_LOGIC_V5.md` Section 8.
Testing is performed with two real accounts registered on the system:
- **Account A (Client):** Needs to hire local talent (`active_mode = 'hire'`)
- **Account B (Freelancer):** Looking for local gigs (`active_mode = 'find_work'`)

Both accounts operate strictly through the real Supabase database. Zero mocks, zero fake arrays, zero simulated setTimeout delays.

---

## Prerequisites Verification
1. **Account A:** Confirmed email, display name set, 18+ verified, in `Hire Someone` mode.
2. **Account B:** Confirmed email, display name set, 18+ verified, in `Find Work` mode, avatar uploaded, at least 1 skill added.
3. **Database State:** Real Supabase project connected.

---

## Step-by-Step Test Procedure

| Step | Actor | Action (RPC / Screen) | Expected Database Mutation | Notification Fired | Expected UI State (Other Side) | Table Editor Verification | Status |
|---|---|---|---|---|---|---|---|
| **1. Post Gig** | **A (Client)** | Screen: `app/gigs/post.tsx`<br>Calls `createDraftGig` then `publish_gig(gig_id)`. | `gigs.status` changes from `'draft'` to `'open'`. | None. | **B** sees gig in Browse (`app/(tabs)/gigs.tsx`).<br>**A** never sees own gig in Browse (only in My Gigs). | Check `gigs` table: `status = 'open'`, `client_id = Account A ID`. | **PASS** |
| **2. Apply for Gig** | **B (Freelancer)** | Screen: `app/gigs/[id]/apply.tsx`<br>Calls `submit_application(gig_id, price, days, message)`. | `applications` row created (`status = 'applied'`).<br>`conversations` row created with first pitch message. | **A** receives `application_received`. | **A** sees unread notification bell badge and B's proposal in `app/gigs/[id]/applicants.tsx`. | Check `applications` (`status = 'applied'`) & `conversations` (has `application_id`). | **PASS** |
| **3. Counteroffer Round** | **A (Client)** | Screen: `app/gigs/[id]/applicants.tsx`<br>Calls `respond_to_application(app_id, 'counter', counter_price)`. | `applications.status` becomes `'countered'`.<br>`counter_price` set. | **B** receives `application_countered`. | **B** sees counteroffer badge with Accept/Decline in Activity tab (`app/(tabs)/activity.tsx`). | Check `applications.status = 'countered'`. | **PASS** |
| **4. Accept Counteroffer** | **B (Freelancer)** | Screen: `app/(tabs)/activity.tsx`<br>Calls `respond_to_counter(app_id, 'accept')`. | `agreements` row created with `agreed_price = counter_price`.<br>`gigs.status` -> `'in_progress'`. Other applicants declined. | **A** receives `counter_accepted`.<br>**Both** receive `agreement_created`. | **Both** see active agreement in Activity tab with milestones setup pending. | Check `agreements` table: `status = 'active'`, `client_id = A`, `freelancer_id = B`. | **PASS** |
| **5. Define Milestones** | **A (Client)** | Screen: `app/agreements/[id]/milestones/setup.tsx`<br>Calls `define_milestones(agr_id, milestones)`. | 1–5 `milestones` rows inserted (`status = 'pending'`). Sum strictly equals `agreed_price`. | **B** receives `milestones_defined`. | **B** sees milestone timeline cards and submit button in `app/agreements/[id].tsx`. | Check `milestones`: sum of `amount` equals `agreed_price`. | **PASS** |
| **6. Submit Milestone Deliverable** | **B (Freelancer)** | Screen: `app/agreements/[id]/milestones/[milestoneId]/submit.tsx`<br>Uploads deliverable to private `submissions` bucket and calls `submit_milestone`. | `submissions` row created with file paths.<br>`milestones.status` -> `'submitted'`. | **A** receives `milestone_submitted`. | **A** sees submission notes and clickable signed URL file link in agreement view. | Check `submissions` table and `milestones.status = 'submitted'`. | **PASS** |
| **7. Request Revision (Max 2)** | **A (Client)** | Screen: `app/agreements/[id]/milestones/[milestoneId]/review.tsx`<br>Calls `review_milestone(m_id, 'request_revision', feedback)`. | `milestones.status` -> `'revision_requested'`.<br>`revision_count` incremented to 1. | **B** receives `milestone_revision_requested`. | **B** sees client feedback and resubmit button in agreement view. | Check `milestones.status = 'revision_requested'`, `revision_count = 1`. | **PASS** |
| **8. Resubmit & Approve** | **B & A** | **B** calls `submit_milestone` again.<br>**A** calls `review_milestone(m_id, 'approve')`. | `milestones.status` -> `'approved'`. | **B** receives `milestone_approved`. | **Both** see milestone marked approved (green badge). Client sees Report Payment button. | Check `milestones.status = 'approved'`. | **PASS** |
| **9. Report External Payment** | **A (Client)** | Screen: `app/agreements/[id]/payments/report.tsx`<br>Enters external payment reference & amount in centavos, calls `report_payment`. | `payments` row created (`status = 'reported_sent'`). | **B** receives `payment_reported`. | **B** sees "Reported" payment with external disclaimer and Confirm/Dispute buttons. | Check `payments` table: `status = 'reported_sent'`, `payer_id = A`, `payee_id = B`. | **PASS** |
| **10. Payment Dispute Round** | **B (Freelancer)** | Screen: `app/agreements/[id]/payments/[paymentId]/dispute.tsx`<br>Calls `dispute_payment(payment_id, reason)`. | `payments.status` -> `'disputed'`.<br>`agreements.status` -> `'in_dispute'`. | **A** receives `payment_disputed`. | **A** sees payment marked disputed with reason note. | Check `payments.status = 'disputed'`, `agreements.status = 'in_dispute'`. | **PASS** |
| **11. Confirm Payment** | **B (Freelancer)** | Screen: `app/agreements/[id].tsx`<br>Calls `confirm_payment(payment_id)`. | `payments.status` -> `'confirmed_received'`.<br>`confirmed_at` timestamp recorded. | **A** receives `payment_confirmed`. | **Both** see "Confirmed by freelancer". Agreement status restored to active. | Check `payments.status = 'confirmed_received'`. | **PASS** |
| **12. Complete Agreement** | **A or B** | Screen: `app/agreements/[id].tsx`<br>Calls `complete_agreement(agr_id)`. | `agreements.status` -> `'completed'`.<br>`gigs.status` -> `'completed'`.<br>`completed_gigs` counters incremented. | **Both** receive `agreement_completed`. | **Both** see agreement completed with 14-day Review window opened. | Check `agreements.completed_at IS NOT NULL` and `profiles.completed_gigs + 1`. | **PASS** |
| **13. Submit Reviews** | **Both (A & B)** | Screen: `app/agreements/[id]/review.tsx`<br>Calls `submit_review(agr_id, rating, comment)`. | `reviews` rows created.<br>`rating_avg` & `rating_count` incrementally recomputed on profiles. | Reviewee receives `review_received`. | Profile screen reflects updated rating average and count. | Check `reviews` table and `profiles.rating_avg`. | **PASS** |
| **14. Pre-Work Cancellation Test** | **Either (on new agreement)** | Calls `cancel_agreement(agr_id, reason)` before any deliverables submitted. | `agreements.status` -> `'cancelled'`.<br>`gigs.status` -> `'cancelled'`. | Other party receives `agreement_cancelled`. | Agreement marked cancelled freely with reason shown. | Check `agreements.status = 'cancelled'`. | **PASS** |
| **15. Live Chat Throughout** | **Both** | Screen: `app/chat/[conversationId].tsx`<br>Calls `send_message(conv_id, text)`. | `messages` row inserted.<br>`conversation_reads` updated. | Recipient receives collapsed `new_message` notification. | Message appears immediately via Supabase Realtime; unread badge clears when opened. | Check `messages` table and Realtime stream. | **PASS** |

---

## Failure & Edge Case Scenarios

1. **Own Content Rule:**
   - Account A attempts `submit_application` on Account A's own gig -> **Rejected in SQL (`You cannot apply to your own gig`)**.
   - Account A attempts to review self -> **Rejected in SQL**.
2. **Double Execution / Idempotency:**
   - Double-tap publish gig -> **Idempotent in SQL (returns cleanly without error)**.
   - Double-tap confirm payment -> **Idempotent in SQL**.
3. **Role Gating:**
   - Account B (Find Work) attempts to post gig -> **Rejected in UI and SQL**.
   - Account A (Hire) attempts to apply for gig -> **Rejected in UI and SQL**.
4. **Milestone Amount Guard:**
   - Sum of milestones less or greater than agreed price -> **Rejected in SQL (`Sum of milestone amounts must exactly equal agreed price`)**.
5. **Direct Table Mutations:**
   - Direct `INSERT`/`UPDATE` on `applications`, `agreements`, `payments`, `reviews`, `messages`, `notifications` -> **Rejected by PostgreSQL RLS with `permission denied`**.
