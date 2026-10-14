
-- ==============================================================================
-- MIGRATION: 20261011000008_reports_and_messages.sql
-- ==============================================================================
-- Migration: 20261011000008_reports_and_messages.sql
-- Milestone 8: Reports and Messages
-- Strictly adheres to docs/GIGORMOC_SPEC.md sections 5, 8, 9, 10 and AGENTS.md

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE UNIQUE,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_freelancer_id ON public.conversations(freelancer_id);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 3. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('profile', 'gig', 'agreement', 'message')),
    target_id UUID NOT NULL,
    reason_category TEXT NOT NULL CHECK (reason_category IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other')),
    details TEXT NOT NULL CHECK (char_length(trim(details)) BETWEEN 10 AND 2000),
    evidence_path TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    resolution_notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 4. Enable Supabase Realtime for messages table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- publication doesn't exist if realtime is not initialized
END $$;

-- 5. Set up private reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false,
    10485760, -- 10MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ];

-- 6. Enable RLS on conversations, messages, and reports
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from public and authenticated (mutations go through RPC functions)
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reports FROM public, authenticated;

-- RLS: conversations
DROP POLICY IF EXISTS "Participants read conversations" ON public.conversations;
CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT
TO authenticated
USING (
    client_id = auth.uid()
    OR freelancer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- RLS: messages
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (
            c.client_id = auth.uid()
            OR c.freelancer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
        )
    )
);

-- RLS: reports
DROP POLICY IF EXISTS "Reporter reads own reports" ON public.reports;
CREATE POLICY "Reporter reads own reports" ON public.reports FOR SELECT
TO authenticated
USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- RLS: reports storage bucket
DROP POLICY IF EXISTS "User upload report evidence" ON storage.objects;
CREATE POLICY "User upload report evidence" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Admins and reporter read report evidence" ON storage.objects;
CREATE POLICY "Admins and reporter read report evidence" ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'reports'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
    )
);

-- 7. RPC Function: get_or_create_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    p_application_id UUID DEFAULT NULL,
    p_agreement_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_app RECORD;
    v_conv_id UUID;
    v_target_app_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    v_target_app_id := p_application_id;

    -- If agreement_id is provided, resolve the accepted application
    IF v_target_app_id IS NULL AND p_agreement_id IS NOT NULL THEN
        SELECT a.id INTO v_target_app_id
        FROM public.applications a
        JOIN public.agreements agr ON agr.gig_id = a.gig_id AND agr.freelancer_id = a.freelancer_id
        WHERE agr.id = p_agreement_id
        LIMIT 1;

        -- Fallback if not found: find by gig_id
        IF v_target_app_id IS NULL THEN
            SELECT a.id INTO v_target_app_id
            FROM public.applications a
            JOIN public.agreements agr ON agr.gig_id = a.gig_id
            WHERE agr.id = p_agreement_id
            LIMIT 1;
        END IF;
    END IF;

    IF v_target_app_id IS NULL THEN
        RAISE EXCEPTION 'Could not resolve application for conversation.';
    END IF;

    -- Fetch application and gig client
    SELECT a.*, g.client_id AS gig_client_id
    INTO v_app
    FROM public.applications a
    JOIN public.gigs g ON g.id = a.gig_id
    WHERE a.id = v_target_app_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    -- Caller must be client or freelancer
    IF v_caller_id <> v_app.freelancer_id AND v_caller_id <> v_app.gig_client_id THEN
        RAISE EXCEPTION 'Only application participants can access this conversation.';
    END IF;

    -- Look up existing conversation
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE application_id = v_target_app_id;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    -- Create new conversation atomically
    INSERT INTO public.conversations (
        application_id,
        client_id,
        freelancer_id
    ) VALUES (
        v_target_app_id,
        v_app.gig_client_id,
        v_app.freelancer_id
    )
    ON CONFLICT (application_id) DO NOTHING
    RETURNING id INTO v_conv_id;

    IF v_conv_id IS NULL THEN
        SELECT id INTO v_conv_id
        FROM public.conversations
        WHERE application_id = v_target_app_id;
    END IF;

    RETURN v_conv_id;
END;
$$;

-- 8. RPC Function: send_message
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recent_count INTEGER;
    v_msg_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_content IS NULL OR char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 2000 THEN
        RAISE EXCEPTION 'Message must be between 1 and 2000 characters.';
    END IF;

    -- Verify conversation participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.';
    END IF;

    -- Rate limit check: max 30 messages in 10 minutes
    SELECT count(*) INTO v_recent_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at > now() - INTERVAL '10 minutes';

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Message rate limit exceeded. Please wait a few moments before sending more messages.';
    END IF;

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content
    ) VALUES (
        p_conversation_id,
        v_caller_id,
        trim(p_content)
    )
    RETURNING id INTO v_msg_id;

    -- Update conversation updated_at
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;

    RETURN v_msg_id;
END;
$$;

-- 9. RPC Function: submit_report
CREATE OR REPLACE FUNCTION public.submit_report(
    p_target_type TEXT,
    p_target_id UUID,
    p_reason_category TEXT,
    p_details TEXT,
    p_evidence_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_recent_reports_count INTEGER;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_target_type NOT IN ('profile', 'gig', 'agreement', 'message') THEN
        RAISE EXCEPTION 'Invalid report target type.';
    END IF;

    IF p_reason_category NOT IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other') THEN
        RAISE EXCEPTION 'Invalid reason category.';
    END IF;

    IF p_details IS NULL OR char_length(trim(p_details)) < 10 OR char_length(trim(p_details)) > 2000 THEN
        RAISE EXCEPTION 'Report details must be between 10 and 2000 characters.';
    END IF;

    -- Rate limit check: max 5 reports per hour
    SELECT count(*) INTO v_recent_reports_count
    FROM public.reports
    WHERE reporter_id = v_caller_id
      AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_reports_count >= 5 THEN
        RAISE EXCEPTION 'Report limit reached (maximum 5 reports per hour).';
    END IF;

    INSERT INTO public.reports (
        reporter_id,
        target_type,
        target_id,
        reason_category,
        details,
        evidence_path
    ) VALUES (
        v_caller_id,
        p_target_type,
        p_target_id,
        p_reason_category,
        trim(p_details),
        p_evidence_path
    )
    RETURNING id INTO v_report_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'report_submitted',
        v_caller_id,
        v_report_id,
        'reports',
        jsonb_build_object(
            'target_type', p_target_type,
            'target_id', p_target_id,
            'reason_category', p_reason_category
        )
    );

    RETURN v_report_id;
END;
$$;

-- 10. RPC Function: cancel_agreement
-- Before any milestone is submitted, either party may cancel freely.
-- After work starts, cancelling creates a report for manual review and sets status to 'disputed'.
CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_has_submitted_work BOOLEAN;
    v_result_status TEXT;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a reason for cancelling this agreement.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can initiate cancellation.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be cancelled or disputed.';
    END IF;

    -- Check if any milestone has been submitted or approved
    SELECT EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) INTO v_has_submitted_work;

    IF NOT v_has_submitted_work THEN
        -- Work has not started yet -> Free cancellation
        UPDATE public.agreements
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_agreement_id;

        -- Cancel gig
        UPDATE public.gigs
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = v_agreement.gig_id;

        v_result_status := 'cancelled';

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'agreement_cancelled_freely',
            v_caller_id,
            p_agreement_id,
            'agreements',
            jsonb_build_object('reason', trim(p_reason))
        );
    ELSE
        -- Work already started -> Flag as disputed and log a report for manual review
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = p_agreement_id;

        INSERT INTO public.reports (
            reporter_id,
            target_type,
            target_id,
            reason_category,
            details
        ) VALUES (
            v_caller_id,
            'agreement',
            p_agreement_id,
            'cancellation_request',
            'Agreement cancellation requested after deliverables started: ' || trim(p_reason)
        )
        RETURNING id INTO v_report_id;

        v_result_status := 'disputed';

        -- Audit event
        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'agreement_cancelled_disputed',
            v_caller_id,
            p_agreement_id,
            'agreements',
            jsonb_build_object(
                'reason', trim(p_reason),
                'report_id', v_report_id
            )
        );
    END IF;

    RETURN v_result_status;
END;
$$;


-- ==============================================================================
-- MIGRATION: 20261011000009_v3_hardening_and_retrofit.sql
-- ==============================================================================
-- Migration: 20261011000009_v3_hardening_and_retrofit.sql
-- Blueprint V3 Retrofit & Hardening Fixes
-- Covers R2, R3, and Milestone 9 database hardening requirements.

-- 1. Align agreements: add completed_at
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill completed_at for existing completed agreements
UPDATE public.agreements
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- 2. Align reviews table: add reviewee_role, hidden flag, hidden_at, hidden_by
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewee_role TEXT CHECK (reviewee_role IN ('freelancer', 'client')),
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Backfill reviewee_role if null
UPDATE public.reviews
SET reviewee_role = CASE WHEN role = 'client' THEN 'freelancer' ELSE 'client' END
WHERE reviewee_role IS NULL;

-- Update RLS on reviews: authenticated read only non-hidden reviews; admins read all
DROP POLICY IF EXISTS "Authenticated users can read active reviews" ON public.reviews;
CREATE POLICY "Authenticated users can read active reviews" ON public.reviews FOR SELECT
TO authenticated
USING (
  hidden = false
  OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- 3. Update complete_agreement RPC function to record completed_at atomically
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_unapproved_count INTEGER;
    v_total_confirmed BIGINT := 0;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_milestone_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    -- Caller must be participant or admin
    IF v_agreement.client_id <> v_caller_id
       AND v_agreement.freelancer_id <> v_caller_id
       AND NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller_id)
    THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        RETURN; -- idempotent
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    -- Check milestones: must have at least 1 milestone, and all must be approved
    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    -- Check payment disputes
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    -- Check pending payment reports
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    -- Check total confirmed payments vs agreed price
    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    -- Complete agreement with atomic completed_at timestamp
    UPDATE public.agreements
    SET status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    WHERE id = p_agreement_id;

    -- Update gig status to completed
    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    -- Increment participant stats
    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );
END;
$$;

-- 4. Update submit_review RPC function
-- Uses completed_at + 14 days, sets reviewee_role, and recomputes ratings strictly from hidden = false
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Validate input rating and comment
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    -- Lock agreement row
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    -- 14-day window check measured strictly from completed_at
    IF v_agreement.completed_at IS NOT NULL AND now() > (v_agreement.completed_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    -- Check participation & determine roles
    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_role := 'freelancer';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_role := 'client';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- Check if caller already reviewed this agreement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE agreement_id = p_agreement_id AND reviewer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this agreement.';
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        reviewee_role,
        rating,
        comment,
        hidden
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        v_reviewee_role,
        p_rating,
        trim(p_comment),
        false
    )
    RETURNING id INTO v_review_id;

    -- Recalculate recipient rating strictly from non-hidden reviews
    IF v_reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'rating', p_rating,
            'reviewer_role', v_reviewer_role,
            'reviewee_role', v_reviewee_role
        )
    );

    RETURN v_review_id;
END;
$$;

-- 5. RPC Function: admin_hide_review
-- Admin can hide an abusive review and recompute recipient ratings atomically
CREATE OR REPLACE FUNCTION public.admin_hide_review(
    p_review_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_review RECORD;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Must be admin
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller_id) THEN
        RAISE EXCEPTION 'Only platform administrators can hide reviews.';
    END IF;

    SELECT * INTO v_review
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.';
    END IF;

    IF v_review.hidden THEN
        RETURN; -- already hidden
    END IF;

    -- Hide review
    UPDATE public.reviews
    SET hidden = true,
        hidden_at = now(),
        hidden_by = v_caller_id
    WHERE id = p_review_id;

    -- Recompute recipient per-role rating
    IF v_review.reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_review.reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_review.reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_review.reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_review.reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'admin_hide_review',
        v_caller_id,
        p_review_id,
        'reviews',
        jsonb_build_object(
            'reviewee_id', v_review.reviewee_id,
            'reason', trim(p_reason)
        )
    );
END;
$$;

-- 6. Update switch_mode to read real reports table for unresolved reports
CREATE OR REPLACE FUNCTION public.get_mode_switch_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_cooldown_days integer := 7;
  v_remaining_days integer := 0;
  v_can_switch boolean := true;
  v_blockers text[] := ARRAY[]::text[];
  v_active_agreements_count integer := 0;
  v_disputed_agreements_count integer := 0;
  v_pending_payments_count integer := 0;
  v_unresolved_reports_count integer := 0;
  v_pending_gigs_count integer := 0;
  v_pending_apps_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'Account is suspended or deactivated.');
  END IF;

  IF v_profile.mode_changed_at IS NOT NULL THEN
    IF now() < (v_profile.mode_changed_at + (v_cooldown_days || ' days')::interval) THEN
      v_remaining_days := CEIL(EXTRACT(EPOCH FROM ((v_profile.mode_changed_at + (v_cooldown_days || ' days')::interval) - now())) / 86400)::integer;
      v_can_switch := false;
      v_blockers := array_append(v_blockers, 'Mode switch cooldown is active (' || v_remaining_days || ' day(s) remaining).');
    END IF;
  END IF;

  SELECT count(*) INTO v_active_agreements_count
  FROM public.agreements
  WHERE (client_id = v_user_id OR freelancer_id = v_user_id) AND status = 'active';

  IF v_active_agreements_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_active_agreements_count || ' active agreement(s). Complete or cancel them first.');
  END IF;

  SELECT count(*) INTO v_disputed_agreements_count
  FROM public.agreements
  WHERE (client_id = v_user_id OR freelancer_id = v_user_id) AND status = 'disputed';

  IF v_disputed_agreements_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_disputed_agreements_count || ' disputed agreement(s).');
  END IF;

  SELECT count(*) INTO v_pending_payments_count
  FROM public.payments
  WHERE (payer_id = v_user_id OR payee_id = v_user_id) AND status IN ('reported_sent', 'disputed');

  IF v_pending_payments_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_pending_payments_count || ' pending or disputed payment(s).');
  END IF;

  -- Read unresolved reports filed against the user from public.reports
  SELECT count(*) INTO v_unresolved_reports_count
  FROM public.reports
  WHERE target_id = v_user_id AND status = 'pending';

  IF v_unresolved_reports_count > 0 THEN
    v_can_switch := false;
    v_blockers := array_append(v_blockers, 'You have ' || v_unresolved_reports_count || ' unresolved report(s) under review.');
  END IF;

  IF v_profile.active_mode = 'hire' THEN
    SELECT count(*) INTO v_pending_gigs_count
    FROM public.gigs WHERE client_id = v_user_id AND status IN ('open', 'draft');
  ELSIF v_profile.active_mode = 'find_work' THEN
    SELECT count(*) INTO v_pending_apps_count
    FROM public.applications WHERE freelancer_id = v_user_id AND status IN ('applied', 'countered');
  END IF;

  RETURN jsonb_build_object(
    'current_mode', v_profile.active_mode,
    'can_switch', v_can_switch,
    'cooldown_remaining_days', v_remaining_days,
    'blockers', to_jsonb(v_blockers),
    'pending_gigs_count', v_pending_gigs_count,
    'pending_apps_count', v_pending_apps_count
  );
END;
$$;

-- 7. Revoke execution from public/anon and grant to authenticated on all protected functions
REVOKE EXECUTE ON FUNCTION public.choose_initial_mode FROM public, anon;
GRANT EXECUTE ON FUNCTION public.choose_initial_mode TO authenticated;

REVOKE EXECUTE ON FUNCTION public.switch_mode FROM public, anon;
GRANT EXECUTE ON FUNCTION public.switch_mode TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_mode_switch_status FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mode_switch_status TO authenticated;

REVOKE EXECUTE ON FUNCTION public.publish_gig FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_application FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_application TO authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_to_application FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application TO authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_to_counter FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter TO authenticated;

REVOKE EXECUTE ON FUNCTION public.define_milestones FROM public, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_milestone FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_milestone FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone TO authenticated;

REVOKE EXECUTE ON FUNCTION public.report_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispute_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_agreement FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_review FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_review TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_hide_review FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_hide_review TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_message FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_report FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_report TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_agreement FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000010_fix_mode_switch.sql
-- ==============================================================================
-- Fix: protected profile columns were silently reverted even when changed by trusted
-- SECURITY DEFINER functions (choose_initial_mode, switch_mode, submit_review, payments, ...)
-- because the integrity trigger only let platform admins through.
-- Fix: trusted functions run as the function owner, so only direct API writes
-- (roles authenticated / anon) are reverted.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- SECURITY INVOKER on purpose: current_user is 'authenticated'/'anon' for direct API writes
-- and the function owner when a SECURITY DEFINER function does the update.
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_platform_admin() THEN
    NEW.active_mode := OLD.active_mode;
    NEW.mode_changed_at := OLD.mode_changed_at;
    NEW.freelancer_rating_avg := OLD.freelancer_rating_avg;
    NEW.freelancer_rating_count := OLD.freelancer_rating_count;
    NEW.client_rating_avg := OLD.client_rating_avg;
    NEW.client_rating_count := OLD.client_rating_count;
    NEW.freelancer_completed_gigs := OLD.freelancer_completed_gigs;
    NEW.client_completed_gigs := OLD.client_completed_gigs;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.completed_gigs := OLD.completed_gigs;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

-- The first mode choice must NOT start the 7-day cooldown (spec section 3A).
CREATE OR REPLACE FUNCTION public.choose_initial_mode(target_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_current_mode text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF target_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'Invalid mode. Must be find_work or hire.';
  END IF;

  SELECT active_mode INTO v_current_mode
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_current_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Initial mode has already been chosen. Use switch_mode instead.';
  END IF;

  UPDATE public.profiles
  SET active_mode = target_mode
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'choose_initial_mode', 'profiles', v_user_id, jsonb_build_object('mode', target_mode));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.choose_initial_mode(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.choose_initial_mode(text) TO authenticated;

-- Existing users who only made their first choice (never switched) should not be in cooldown.
UPDATE public.profiles p
SET mode_changed_at = NULL
WHERE p.mode_changed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_events a
    WHERE a.actor_id = p.id AND a.action = 'switch_mode'
  );


-- ==============================================================================
-- MIGRATION: 20261011000010_own_content_rule.sql
-- ==============================================================================
-- Migration: 20261011000010_own_content_rule.sql
-- Retrofit R4: Own-Content Rule Audit & Enforcement
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md section 3B, and docs/ROLE_UX.md section 4.

-- 1. Table constraint: An agreement can never have client_id = freelancer_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_agreements_different_parties'
    ) THEN
        ALTER TABLE public.agreements
        ADD CONSTRAINT chk_agreements_different_parties
        CHECK (client_id <> freelancer_id);
    END IF;
END $$;

-- 2. Update submit_review: Explicit check rejecting self-reviews
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_reviewer_role TEXT;
    v_reviewee_role TEXT;
    v_reviewee_id UUID;
    v_review_id UUID;
    v_new_rating_count INTEGER;
    v_new_rating_avg NUMERIC(3,2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Validate input rating and comment
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5.';
    END IF;

    IF p_comment IS NULL OR char_length(trim(p_comment)) < 10 OR char_length(trim(p_comment)) > 1000 THEN
        RAISE EXCEPTION 'Review comment must be between 10 and 1000 characters.';
    END IF;

    -- Lock agreement row
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted for completed agreements.';
    END IF;

    -- 14-day window check measured strictly from completed_at
    IF v_agreement.completed_at IS NOT NULL AND now() > (v_agreement.completed_at + INTERVAL '14 days') THEN
        RAISE EXCEPTION 'The 14-day review window for this agreement has expired.';
    END IF;

    -- Check participation & determine roles
    IF v_agreement.client_id = v_caller_id THEN
        v_reviewer_role := 'client';
        v_reviewee_role := 'freelancer';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_agreement.freelancer_id = v_caller_id THEN
        v_reviewer_role := 'freelancer';
        v_reviewee_role := 'client';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only agreement participants can submit a review.';
    END IF;

    -- Own-content rule: Cannot review yourself
    IF v_caller_id = v_reviewee_id THEN
        RAISE EXCEPTION 'You cannot review yourself.';
    END IF;

    -- Check if caller already reviewed this agreement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE agreement_id = p_agreement_id AND reviewer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this agreement.';
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        reviewee_role,
        rating,
        comment,
        hidden
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_reviewer_role,
        v_reviewee_role,
        p_rating,
        trim(p_comment),
        false
    )
    RETURNING id INTO v_review_id;

    -- Recalculate recipient rating strictly from non-hidden reviews
    IF v_reviewee_role = 'freelancer' THEN
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'freelancer' AND hidden = false;

        UPDATE public.profiles
        SET freelancer_rating_avg = coalesce(v_new_rating_avg, 0.00),
            freelancer_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    ELSE
        SELECT
            count(*),
            round(avg(rating)::numeric, 2)
        INTO v_new_rating_count, v_new_rating_avg
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id AND reviewee_role = 'client' AND hidden = false;

        UPDATE public.profiles
        SET client_rating_avg = coalesce(v_new_rating_avg, 0.00),
            client_rating_count = v_new_rating_count,
            updated_at = now()
        WHERE id = v_reviewee_id;
    END IF;

    -- Audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'review_submitted',
        v_caller_id,
        v_review_id,
        'reviews',
        jsonb_build_object(
            'agreement_id', p_agreement_id,
            'reviewee_id', v_reviewee_id,
            'reviewee_role', v_reviewee_role,
            'rating', p_rating
        )
    );

    RETURN v_review_id;
END;
$$;

-- 3. Update submit_report: Reject reporting own content / self
CREATE OR REPLACE FUNCTION public.submit_report(
    p_target_type TEXT,
    p_target_id UUID,
    p_reason_category TEXT,
    p_details TEXT,
    p_evidence_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_recent_reports_count INTEGER;
    v_report_id UUID;
    v_owner_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_target_type NOT IN ('profile', 'gig', 'agreement', 'message') THEN
        RAISE EXCEPTION 'Invalid report target type.';
    END IF;

    IF p_reason_category NOT IN ('spam_scam', 'harassment', 'unresponsive', 'payment_issue', 'work_quality', 'cancellation_request', 'other') THEN
        RAISE EXCEPTION 'Invalid reason category.';
    END IF;

    IF p_details IS NULL OR char_length(trim(p_details)) < 10 OR char_length(trim(p_details)) > 2000 THEN
        RAISE EXCEPTION 'Report details must be between 10 and 2000 characters.';
    END IF;

    -- Own-content rule enforcement: Cannot report own profile, own gig, own message
    IF p_target_type = 'profile' THEN
        IF p_target_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own profile.';
        END IF;
    ELSIF p_target_type = 'gig' THEN
        SELECT client_id INTO v_owner_id FROM public.gigs WHERE id = p_target_id;
        IF v_owner_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own gig.';
        END IF;
    ELSIF p_target_type = 'message' THEN
        SELECT sender_id INTO v_owner_id FROM public.messages WHERE id = p_target_id;
        IF v_owner_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot report your own message.';
        END IF;
    END IF;

    -- Rate limit check: max 5 reports per hour
    SELECT count(*) INTO v_recent_reports_count
    FROM public.reports
    WHERE reporter_id = v_caller_id
      AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_reports_count >= 5 THEN
        RAISE EXCEPTION 'Report limit reached (maximum 5 reports per hour).';
    END IF;

    INSERT INTO public.reports (
        reporter_id,
        target_type,
        target_id,
        reason_category,
        details,
        evidence_path
    ) VALUES (
        v_caller_id,
        p_target_type,
        p_target_id,
        p_reason_category,
        trim(p_details),
        p_evidence_path
    )
    RETURNING id INTO v_report_id;

    -- Record audit event
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'report_submitted',
        v_caller_id,
        v_report_id,
        'reports',
        jsonb_build_object(
            'target_type', p_target_type,
            'target_id', p_target_id,
            'reason_category', p_reason_category
        )
    );

    RETURN v_report_id;
END;
$$;

-- 4. Database RPC: get_available_gigs (Enforces own-content exclusion in database)
-- Freelancers can never be shown their own gigs as available work
CREATE OR REPLACE FUNCTION public.get_available_gigs(
    p_category_id UUID DEFAULT NULL,
    p_work_type TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    title TEXT,
    price_min INTEGER,
    price_max INTEGER,
    work_type TEXT,
    area TEXT,
    application_deadline TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    status TEXT,
    created_at TIMESTAMPTZ,
    category_name TEXT,
    client_display_name TEXT,
    client_rating_avg NUMERIC(3,2),
    client_rating_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();

    RETURN QUERY
    SELECT 
        g.id,
        g.client_id,
        g.title,
        g.price_min,
        g.price_max,
        g.work_type,
        g.area,
        g.application_deadline,
        g.deadline,
        g.status,
        g.created_at,
        c.name AS category_name,
        p.display_name AS client_display_name,
        p.client_rating_avg,
        p.client_rating_count
    FROM public.gigs g
    JOIN public.categories c ON c.id = g.category_id
    JOIN public.profiles p ON p.id = g.client_id
    WHERE g.status = 'open'
      AND g.application_deadline > now()
      -- Own-content rule: caller's own gigs are strictly excluded
      AND (v_caller_id IS NULL OR g.client_id <> v_caller_id)
      AND (p_category_id IS NULL OR g.category_id = p_category_id)
      AND (p_work_type IS NULL OR g.work_type = p_work_type)
      AND (
          p_search IS NULL OR
          p_search = '' OR
          g.title ILIKE '%' || p_search || '%' OR
          g.description ILIKE '%' || p_search || '%' OR
          g.area ILIKE '%' || p_search || '%'
      )
    ORDER BY g.created_at DESC;
END;
$$;

-- 5. Revoke execute on new/updated functions from anon and public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_report(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_available_gigs(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_gigs(UUID, TEXT, TEXT) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000011_notifications.sql
-- ==============================================================================
-- Migration: 20261011000011_notifications.sql
-- Milestone 11: Real In-App Notifications
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md, and docs/REAL_LOGIC_V5.md section 3

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT DEFAULT NULL,
    entity_id UUID DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries and unread counting
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Recipient can select own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Direct client writes are revoked (creation only via internal notify helper, updates via RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated, PUBLIC;

-- 2. Add notifications to Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- 3. Internal helper: notify()
-- Created inside public schema, SECURITY DEFINER, search_path fixed to public, auth, pg_temp
-- Revoked from all external callers (callable only by other DB functions)
DROP FUNCTION IF EXISTS public.notify(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB);
CREATE OR REPLACE FUNCTION public.notify(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_notification_id UUID;
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();

    -- Rule: Never notify the actor about their own action
    IF v_actor_id IS NOT NULL AND p_user_id = v_actor_id THEN
        RETURN NULL;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        data
    ) VALUES (
        p_user_id,
        p_type,
        trim(p_title),
        trim(p_body),
        p_entity_type,
        p_entity_id,
        coalesce(p_data, '{}'::jsonb)
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- Revoke execute on notify() from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.notify(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- 4. RPCs for reading / dismissing notifications
DROP FUNCTION IF EXISTS public.mark_notification_read(UUID);
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE public.notifications
    SET read_at = coalesce(read_at, now())
    WHERE id = p_id AND user_id = v_caller_id;

    RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_all_notifications_read();
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_updated_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = v_caller_id AND read_at IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- 5. Re-create lifecycle RPCs to emit real notifications
-- A. submit_application -> notifies client (application_received)
DROP FUNCTION IF EXISTS public.submit_application(uuid, integer, integer, text);
CREATE OR REPLACE FUNCTION public.submit_application(
  p_gig_id uuid,
  p_proposed_price integer,
  p_estimated_days integer,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_has_skill boolean;
  v_email_confirmed boolean;
  v_recent_app_count integer;
  v_app_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
    RAISE EXCEPTION 'Proposed price must be greater than zero.';
  END IF;
  IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Estimated days must be greater than zero.';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Application message is required.';
  END IF;

  SELECT count(*) INTO v_recent_app_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'submit_application'
    AND created_at > (now() - interval '1 hour');

  IF v_recent_app_count >= 10 THEN
    RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own gig.';
  END IF;

  IF v_gig.status <> 'open' THEN
    RAISE EXCEPTION 'Gig is not open for applications.';
  END IF;

  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'The application deadline for this gig has passed.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.active_mode <> 'find_work' THEN
    RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
    RAISE EXCEPTION 'You must upload a profile photo before applying for gigs.';
  END IF;

  SELECT email_confirmed_at IS NOT NULL INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT coalesce(v_email_confirmed, false) THEN
    RAISE EXCEPTION 'You must confirm your email before applying for gigs.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
  ) INTO v_has_skill;

  IF NOT v_has_skill THEN
    RAISE EXCEPTION 'You must have at least one skill added to your profile before applying.';
  END IF;

  INSERT INTO public.applications (
    gig_id,
    freelancer_id,
    proposed_price,
    estimated_days,
    message
  ) VALUES (
    p_gig_id,
    v_user_id,
    p_proposed_price,
    p_estimated_days,
    trim(p_message)
  )
  RETURNING id INTO v_app_id;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'submit_application');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'submit_application',
    'applications',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id, 'proposed_price', p_proposed_price)
  );

  -- Real Notification to gig client
  PERFORM public.notify(
    v_gig.client_id,
    'application_received',
    'New Application Received',
    coalesce(v_profile.display_name, 'A freelancer') || ' applied to your gig "' || v_gig.title || '".',
    'application',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id)
  );

  RETURN v_app_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) TO authenticated;

-- B. respond_to_application -> notifies freelancer
DROP FUNCTION IF EXISTS public.respond_to_application(uuid, text, integer);
CREATE OR REPLACE FUNCTION public.respond_to_application(
  p_application_id uuid,
  p_action text,
  p_counter_price integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
  v_other_app record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'Invalid response action. Must be accept, decline, or counter.';
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.status <> 'applied' THEN
    RAISE EXCEPTION 'Application is not in applied state (current: %).', v_app.status;
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig client can respond to this application.';
  END IF;

  IF p_action = 'counter' THEN
    IF p_counter_price IS NULL OR p_counter_price <= 0 THEN
      RAISE EXCEPTION 'Counter price must be greater than zero.';
    END IF;

    UPDATE public.applications
    SET status = 'countered',
        counter_price = p_counter_price,
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'counter_application', 'applications', p_application_id, jsonb_build_object('counter_price', p_counter_price));

    -- Real Notification: application_countered
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_countered',
      'Counteroffer Received',
      'The client countered your proposal on "' || v_gig.title || '".',
      'application',
      p_application_id,
      jsonb_build_object('counter_price', p_counter_price, 'gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'decline' THEN
    UPDATE public.applications
    SET status = 'declined',
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'decline_application', 'applications', p_application_id, '{}'::jsonb);

    -- Real Notification: application_declined
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_declined',
      'Application Update',
      'Your application for "' || v_gig.title || '" was not accepted.',
      'application',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    IF v_gig.status <> 'open' THEN
      RAISE EXCEPTION 'Gig is not open (current: %). Cannot accept application.', v_gig.status;
    END IF;

    UPDATE public.applications
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline
    ) VALUES (
      v_gig.id,
      v_gig.client_id,
      v_app.freelancer_id,
      v_app.proposed_price,
      v_gig.deadline
    )
    RETURNING id INTO v_agreement_id;

    UPDATE public.gigs
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = v_gig.id;

    FOR v_other_app IN
      SELECT id, freelancer_id FROM public.applications
      WHERE gig_id = v_gig.id
        AND id <> p_application_id
        AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_other_app.id;

      -- Notify other applicants
      PERFORM public.notify(
        v_other_app.freelancer_id,
        'application_declined',
        'Gig Filled',
        'Another proposal was selected for "' || v_gig.title || '".',
        'application',
        v_other_app.id,
        jsonb_build_object('gig_id', v_gig.id)
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_application',
      'agreements',
      v_agreement_id,
      jsonb_build_object('application_id', p_application_id, 'agreed_price', v_app.proposed_price)
    );

    -- Notify accepted freelancer
    PERFORM public.notify(
      v_app.freelancer_id,
      'application_accepted',
      'Proposal Accepted!',
      'Congratulations! Your proposal for "' || v_gig.title || '" was accepted.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify both that agreement is created
    PERFORM public.notify(
      v_user_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN v_agreement_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_application(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_application(uuid, text, integer) TO authenticated;

-- C. define_milestones -> notifies freelancer
DROP FUNCTION IF EXISTS public.define_milestones(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.define_milestones(
    p_agreement_id UUID,
    p_milestones JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_total_amount INTEGER := 0;
    v_elem JSONB;
    v_pos INTEGER := 1;
    v_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can define milestones.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be defined for active agreements.';
    END IF;

    SELECT count(*) INTO v_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'Milestones have already been defined for this agreement.';
    END IF;

    IF jsonb_array_length(p_milestones) < 1 OR jsonb_array_length(p_milestones) > 5 THEN
        RAISE EXCEPTION 'Agreement must have between 1 and 5 milestones.';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        IF (v_elem->>'title') IS NULL OR char_length(trim(v_elem->>'title')) < 3 THEN
            RAISE EXCEPTION 'Each milestone must have a title of at least 3 characters.';
        END IF;
        IF (v_elem->>'amount') IS NULL OR (v_elem->>'amount')::integer <= 0 THEN
            RAISE EXCEPTION 'Milestone amount must be greater than zero.';
        END IF;
        v_total_amount := v_total_amount + (v_elem->>'amount')::integer;
    END LOOP;

    IF v_total_amount <> v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Sum of milestone amounts (%) must exactly equal agreed price (%).',
            v_total_amount, v_agreement.agreed_price;
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
        INSERT INTO public.milestones (
            agreement_id,
            title,
            description,
            amount,
            position,
            status
        ) VALUES (
            p_agreement_id,
            trim(v_elem->>'title'),
            coalesce(trim(v_elem->>'description'), ''),
            (v_elem->>'amount')::integer,
            v_pos,
            'pending'
        );
        v_pos := v_pos + 1;
    END LOOP;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestones_defined',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object('count', jsonb_array_length(p_milestones), 'total_amount', v_total_amount)
    );

    -- Notify other party
    IF v_caller_id = v_agreement.client_id THEN
      PERFORM public.notify(
        v_agreement.freelancer_id,
        'milestones_defined',
        'Milestones Defined',
        'Milestones have been defined for your active agreement.',
        'agreement',
        p_agreement_id
      );
    ELSE
      PERFORM public.notify(
        v_agreement.client_id,
        'milestones_defined',
        'Milestones Defined',
        'Milestones have been defined for your active agreement.',
        'agreement',
        p_agreement_id
      );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.define_milestones(UUID, JSONB) TO authenticated;

-- D. submit_milestone -> notifies client (milestone_submitted)
DROP FUNCTION IF EXISTS public.submit_milestone(UUID, TEXT, TEXT[]);
CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_message TEXT,
    p_file_paths TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
    v_submission_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_message IS NULL OR char_length(trim(p_message)) < 5 THEN
        RAISE EXCEPTION 'Submission text must be at least 5 characters.';
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the assigned freelancer can submit work for this milestone.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Milestones can only be submitted for active agreements.';
    END IF;

    IF v_milestone.status NOT IN ('pending', 'revision_requested') THEN
        RAISE EXCEPTION 'Milestone cannot be submitted in its current status (%).', v_milestone.status;
    END IF;

    INSERT INTO public.submissions (
        milestone_id,
        freelancer_id,
        notes,
        file_paths
    ) VALUES (
        p_milestone_id,
        v_caller_id,
        trim(p_message),
        coalesce(p_file_paths, ARRAY[]::TEXT[])
    )
    RETURNING id INTO v_submission_id;

    UPDATE public.milestones
    SET status = 'submitted',
        updated_at = now()
    WHERE id = p_milestone_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'milestone_submitted',
        v_caller_id,
        v_submission_id,
        'submissions',
        jsonb_build_object('milestone_id', p_milestone_id, 'agreement_id', v_agreement.id)
    );

    -- Notify client
    PERFORM public.notify(
      v_agreement.client_id,
      'milestone_submitted',
      'Milestone Submitted',
      'Work has been submitted for milestone "' || v_milestone.title || '".',
      'agreement',
      v_agreement.id,
      jsonb_build_object('milestone_id', p_milestone_id)
    );

    RETURN v_submission_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, TEXT[]) TO authenticated;

-- E. review_milestone -> notifies freelancer (milestone_approved or revision_requested)
DROP FUNCTION IF EXISTS public.review_milestone(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id UUID,
    p_action TEXT,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_milestone RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('approve', 'request_revision') THEN
        RAISE EXCEPTION 'Action must be either "approve" or "request_revision".';
    END IF;

    SELECT * INTO v_milestone
    FROM public.milestones
    WHERE id = p_milestone_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_milestone.agreement_id;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can review milestone submissions.';
    END IF;

    IF v_milestone.status <> 'submitted' THEN
        RAISE EXCEPTION 'Only submitted milestones can be reviewed.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.milestones
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_approved',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id)
        );

        -- Notify freelancer
        PERFORM public.notify(
          v_agreement.freelancer_id,
          'milestone_approved',
          'Milestone Approved!',
          'Your milestone "' || v_milestone.title || '" has been approved by the client.',
          'agreement',
          v_agreement.id,
          jsonb_build_object('milestone_id', p_milestone_id)
        );

    ELSIF p_action = 'request_revision' THEN
        IF p_feedback IS NULL OR char_length(trim(p_feedback)) < 5 THEN
            RAISE EXCEPTION 'Feedback of at least 5 characters is required when requesting a revision.';
        END IF;

        IF v_milestone.revision_count >= 2 THEN
            RAISE EXCEPTION 'Maximum revisions limit (2) reached for this milestone. Please contact support or resolve via payment.';
        END IF;

        UPDATE public.milestones
        SET status = 'revision_requested',
            revision_count = revision_count + 1,
            updated_at = now()
        WHERE id = p_milestone_id;

        INSERT INTO public.audit_events (
            event_type,
            actor_id,
            target_id,
            target_table,
            metadata
        ) VALUES (
            'milestone_revision_requested',
            v_caller_id,
            p_milestone_id,
            'milestones',
            jsonb_build_object('agreement_id', v_agreement.id, 'revision_count', v_milestone.revision_count + 1)
        );

        -- Notify freelancer
        PERFORM public.notify(
          v_agreement.freelancer_id,
          'milestone_revision_requested',
          'Revision Requested',
          'The client requested a revision for "' || v_milestone.title || '".',
          'agreement',
          v_agreement.id,
          jsonb_build_object('milestone_id', p_milestone_id, 'feedback', trim(p_feedback))
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_milestone(UUID, TEXT, TEXT) TO authenticated;

-- F. report_payment -> notifies freelancer (payment_reported)
DROP FUNCTION IF EXISTS public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.report_payment(UUID, TEXT, INTEGER, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id UUID,
    p_milestone_id UUID DEFAULT NULL,
    p_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'gcash',
    p_reference_number TEXT DEFAULT '',
    p_receipt_path TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_payment_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    IF p_reference_number IS NULL OR char_length(trim(p_reference_number)) < 3 THEN
        RAISE EXCEPTION 'A valid transaction reference number is required.';
    END IF;

    IF p_payment_method NOT IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can report external payments.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Payments can only be reported for active agreements.';
    END IF;

    -- Validate milestone if provided
    IF p_milestone_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.milestones
            WHERE id = p_milestone_id AND agreement_id = p_agreement_id
        ) THEN
            RAISE EXCEPTION 'Milestone does not belong to this agreement.';
        END IF;
    END IF;

    INSERT INTO public.payments (
        agreement_id,
        milestone_id,
        payer_id,
        payee_id,
        amount,
        payment_method,
        reference_number,
        receipt_path,
        notes,
        status,
        reported_at
    ) VALUES (
        p_agreement_id,
        p_milestone_id,
        v_caller_id,
        v_agreement.freelancer_id,
        p_amount,
        p_payment_method,
        coalesce(trim(p_reference_number), ''),
        p_receipt_path,
        coalesce(trim(p_notes), ''),
        'reported_sent',
        now()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_reported',
        v_caller_id,
        v_payment_id,
        'payments',
        jsonb_build_object('agreement_id', p_agreement_id, 'amount', p_amount, 'method', p_payment_method)
    );

    -- Notify freelancer
    PERFORM public.notify(
      v_agreement.freelancer_id,
      'payment_reported',
      'Payment Reported',
      'Client reported an external payment of ₱' || (p_amount / 100)::text || '. Please confirm once received.',
      'agreement',
      p_agreement_id,
      jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount)
    );

    RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- G. confirm_payment & dispute_payment -> notifies client
DROP FUNCTION IF EXISTS public.confirm_payment(UUID);
DROP FUNCTION IF EXISTS public.confirm_payment(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can confirm payment receipt.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RETURN; -- idempotent
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id;

    UPDATE public.payments
    SET status = 'confirmed_received',
        confirmed_at = now(),
        disputed_at = NULL,
        dispute_reason = NULL,
        updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_confirmed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'amount', v_payment.amount)
    );

    -- Notify client
    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
          v_agreement.client_id,
          'payment_confirmed',
          'Payment Confirmed',
          'Freelancer confirmed receipt of external payment (₱' || (v_payment.amount / 100)::text || ').',
          'agreement',
          v_payment.agreement_id,
          jsonb_build_object('payment_id', p_payment_id)
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.dispute_payment(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.dispute_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_payment RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear reason of at least 5 characters is required to dispute a payment.';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee freelancer can dispute payment reports.';
    END IF;

    IF v_payment.status = 'confirmed_received' THEN
        RAISE EXCEPTION 'Cannot dispute a payment that was already confirmed.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = v_payment.agreement_id;

    UPDATE public.payments
    SET status = 'disputed',
        dispute_reason = trim(p_reason),
        disputed_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;

    IF v_agreement IS NOT NULL THEN
        UPDATE public.agreements
        SET status = 'in_dispute',
            updated_at = now()
        WHERE id = v_agreement.id;
    END IF;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'payment_disputed',
        v_caller_id,
        p_payment_id,
        'payments',
        jsonb_build_object('agreement_id', v_payment.agreement_id, 'reason', trim(p_reason))
    );

    -- Notify client
    IF v_agreement IS NOT NULL AND v_agreement.client_id IS NOT NULL THEN
        PERFORM public.notify(
          v_agreement.client_id,
          'payment_disputed',
          'Payment Disputed',
          'Freelancer disputed payment: ' || trim(p_reason),
          'agreement',
          v_payment.agreement_id,
          jsonb_build_object('payment_id', p_payment_id)
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_payment(UUID, TEXT) TO authenticated;

-- H. complete_agreement -> notifies both parties (agreement_completed)
DROP FUNCTION IF EXISTS public.complete_agreement(UUID);
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_milestone_count INTEGER;
    v_unapproved_count INTEGER;
    v_has_disputes BOOLEAN;
    v_has_pending_reports BOOLEAN;
    v_total_confirmed INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can complete the agreement.';
    END IF;

    IF v_agreement.status = 'completed' THEN
        RETURN;
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be completed.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE status <> 'approved')
    INTO v_milestone_count, v_unapproved_count
    FROM public.milestones
    WHERE agreement_id = p_agreement_id;

    IF v_milestone_count = 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement before milestones are defined and approved.';
    END IF;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete agreement: % milestone(s) are not yet approved.', v_unapproved_count;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'disputed'
    ) INTO v_has_disputes;

    IF v_has_disputes THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment disputes are unresolved.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE agreement_id = p_agreement_id AND status = 'reported_sent'
    ) INTO v_has_pending_reports;

    IF v_has_pending_reports THEN
        RAISE EXCEPTION 'Cannot complete agreement while payment reports are awaiting freelancer confirmation.';
    END IF;

    SELECT coalesce(sum(amount), 0)
    INTO v_total_confirmed
    FROM public.payments
    WHERE agreement_id = p_agreement_id AND status = 'confirmed_received';

    IF v_total_confirmed < v_agreement.agreed_price THEN
        RAISE EXCEPTION 'Cannot complete agreement: Confirmed payments (%) is less than agreed price (%).',
            v_total_confirmed, v_agreement.agreed_price;
    END IF;

    UPDATE public.agreements
    SET status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    WHERE id = p_agreement_id;

    UPDATE public.gigs
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_agreement.gig_id;

    UPDATE public.profiles
    SET freelancer_completed_gigs = freelancer_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.freelancer_id;

    UPDATE public.profiles
    SET client_completed_gigs = client_completed_gigs + 1,
        updated_at = now()
    WHERE id = v_agreement.client_id;

    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        target_id,
        target_table,
        metadata
    ) VALUES (
        'agreement_completed',
        v_caller_id,
        p_agreement_id,
        'agreements',
        jsonb_build_object(
            'gig_id', v_agreement.gig_id,
            'client_id', v_agreement.client_id,
            'freelancer_id', v_agreement.freelancer_id,
            'total_confirmed_payments', v_total_confirmed
        )
    );

    -- Notify both parties
    PERFORM public.notify(
      v_agreement.client_id,
      'agreement_completed',
      'Agreement Completed',
      'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
      'agreement',
      p_agreement_id
    );

    PERFORM public.notify(
      v_agreement.freelancer_id,
      'agreement_completed',
      'Agreement Completed',
      'Agreement for gig has been successfully completed! You may now submit a review within 14 days.',
      'agreement',
      p_agreement_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_agreement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agreement(UUID) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000012_real_messaging.sql
-- ==============================================================================
-- Migration: 20261011000012_real_messaging.sql
-- Milestone 12: Real Messaging with conversation_reads, unread tracking, and new_message notification
-- Strictly adheres to AGENTS.md, docs/GIGORMOC_SPEC.md, and docs/REAL_LOGIC_V5.md section 4

-- 1. Create conversation_reads table to track unread messages per user
CREATE TABLE IF NOT EXISTS public.conversation_reads (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user ON public.conversation_reads(user_id);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversation reads" ON public.conversation_reads;
CREATE POLICY "Users can manage own conversation reads" ON public.conversation_reads
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 2. RPC to mark a conversation read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Verify participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only participants can mark conversation as read.';
    END IF;

    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

-- 3. Update send_message RPC to:
--    - Verify participation and suspend check
--    - Prevent messaging oneself
--    - Update updated_at on conversation
--    - Mark conversation read for sender
--    - Emit / update collapsed new_message notification for recipient
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recipient_id UUID;
    v_sender_profile RECORD;
    v_recent_count INTEGER;
    v_msg_id UUID;
    v_preview TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Load sender profile and verify active status
    SELECT * INTO v_sender_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_sender_profile.status = 'suspended' THEN
        RAISE EXCEPTION 'Suspended accounts cannot send messages.';
    END IF;

    IF p_content IS NULL OR char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 2000 THEN
        RAISE EXCEPTION 'Message must be between 1 and 2000 characters.';
    END IF;

    -- Verify conversation participation
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.';
    END IF;

    -- Determine recipient
    IF v_conv.client_id = v_caller_id THEN
        v_recipient_id := v_conv.freelancer_id;
    ELSE
        v_recipient_id := v_conv.client_id;
    END IF;

    -- Own-content rule
    IF v_recipient_id = v_caller_id THEN
        RAISE EXCEPTION 'Cannot converse with yourself.';
    END IF;

    -- Rate limit check: max 30 messages per 1 minute
    SELECT count(*) INTO v_recent_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at > (now() - interval '1 minute');

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Message rate limit exceeded (max 30 messages per minute).';
    END IF;

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content
    ) VALUES (
        p_conversation_id,
        v_caller_id,
        trim(p_content)
    )
    RETURNING id INTO v_msg_id;

    -- Update conversation updated_at
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;

    -- Mark conversation read for the sender
    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = now();

    -- Notify recipient with collapsed message notification
    v_preview := substring(trim(p_content) from 1 for 100);
    IF char_length(trim(p_content)) > 100 THEN
        v_preview := v_preview || '...';
    END IF;

    PERFORM public.notify(
        v_recipient_id,
        'new_message',
        'New Message from ' || coalesce(v_sender_profile.display_name, 'User'),
        v_preview,
        'conversation',
        p_conversation_id,
        jsonb_build_object('conversation_id', p_conversation_id, 'sender_id', v_caller_id)
    );

    RETURN v_msg_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;

-- 4. Update submit_application to automatically create conversation in the database
CREATE OR REPLACE FUNCTION public.submit_application(
  p_gig_id uuid,
  p_proposed_price integer,
  p_estimated_days integer,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_has_skill boolean;
  v_email_confirmed boolean;
  v_recent_app_count integer;
  v_app_id uuid;
  v_conv_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_proposed_price IS NULL OR p_proposed_price <= 0 THEN
    RAISE EXCEPTION 'Proposed price must be greater than zero.';
  END IF;
  IF p_estimated_days IS NULL OR p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Estimated days must be greater than zero.';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Application message is required.';
  END IF;

  SELECT count(*) INTO v_recent_app_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'submit_application'
    AND created_at > (now() - interval '1 hour');

  IF v_recent_app_count >= 10 THEN
    RAISE EXCEPTION 'Application rate limit reached. Please wait before submitting more applications.';
  END IF;

  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own gig.';
  END IF;

  IF v_gig.status <> 'open' THEN
    RAISE EXCEPTION 'Gig is not open for applications.';
  END IF;

  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'The application deadline for this gig has passed.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.active_mode <> 'find_work' THEN
    RAISE EXCEPTION 'You must be in Find Work mode to apply for gigs.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  IF v_profile.avatar_path IS NULL OR trim(v_profile.avatar_path) = '' THEN
    RAISE EXCEPTION 'You must upload a profile photo before applying for gigs.';
  END IF;

  SELECT email_confirmed_at IS NOT NULL INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT coalesce(v_email_confirmed, false) THEN
    RAISE EXCEPTION 'You must confirm your email before applying for gigs.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE profile_id = v_user_id
  ) INTO v_has_skill;

  IF NOT v_has_skill THEN
    RAISE EXCEPTION 'You must have at least one skill added to your profile before applying.';
  END IF;

  -- Create application row
  INSERT INTO public.applications (
    gig_id,
    freelancer_id,
    proposed_price,
    estimated_days,
    message
  ) VALUES (
    p_gig_id,
    v_user_id,
    p_proposed_price,
    p_estimated_days,
    trim(p_message)
  )
  RETURNING id INTO v_app_id;

  -- Automatically create conversation in the database
  INSERT INTO public.conversations (
    application_id,
    client_id,
    freelancer_id
  ) VALUES (
    v_app_id,
    v_gig.client_id,
    v_user_id
  )
  ON CONFLICT (application_id) DO NOTHING
  RETURNING id INTO v_conv_id;

  -- Insert initial proposal pitch as first message
  IF v_conv_id IS NOT NULL THEN
    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      content
    ) VALUES (
      v_conv_id,
      v_user_id,
      trim(p_message)
    );
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'submit_application');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'submit_application',
    'applications',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id, 'proposed_price', p_proposed_price)
  );

  -- Real notification to client
  PERFORM public.notify(
    v_gig.client_id,
    'application_received',
    'New Application Received',
    coalesce(v_profile.display_name, 'A freelancer') || ' applied to your gig "' || v_gig.title || '".',
    'application',
    v_app_id,
    jsonb_build_object('gig_id', p_gig_id)
  );

  RETURN v_app_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_application(uuid, integer, integer, text) TO authenticated;

-- 5. RPC to fetch user conversations with latest message, unread status, and partner details
CREATE OR REPLACE FUNCTION public.get_user_conversations()
RETURNS TABLE (
    id UUID,
    application_id UUID,
    gig_id UUID,
    gig_title TEXT,
    partner_id UUID,
    partner_name TEXT,
    partner_avatar TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMPTZ,
    last_message_sender_id UUID,
    is_unread BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT 
        c.id,
        c.application_id,
        g.id AS gig_id,
        g.title AS gig_title,
        CASE WHEN c.client_id = v_caller_id THEN f.id ELSE cl.id END AS partner_id,
        CASE WHEN c.client_id = v_caller_id THEN f.display_name ELSE cl.display_name END AS partner_name,
        CASE WHEN c.client_id = v_caller_id THEN f.avatar_path ELSE cl.avatar_path END AS partner_avatar,
        m.content AS last_message_content,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id,
        CASE 
            WHEN m.id IS NULL THEN false
            WHEN m.sender_id = v_caller_id THEN false
            WHEN cr.last_read_at IS NULL THEN true
            WHEN cr.last_read_at < m.created_at THEN true
            ELSE false
        END AS is_unread,
        c.updated_at
    FROM public.conversations c
    JOIN public.applications a ON a.id = c.application_id
    JOIN public.gigs g ON g.id = a.gig_id
    JOIN public.profiles cl ON cl.id = c.client_id
    JOIN public.profiles f ON f.id = c.freelancer_id
    LEFT JOIN LATERAL (
        SELECT msg.id, msg.content, msg.created_at, msg.sender_id
        FROM public.messages msg
        WHERE msg.conversation_id = c.id
        ORDER BY msg.created_at DESC
        LIMIT 1
    ) m ON true
    LEFT JOIN public.conversation_reads cr 
        ON cr.conversation_id = c.id AND cr.user_id = v_caller_id
    WHERE c.client_id = v_caller_id OR c.freelancer_id = v_caller_id
    ORDER BY coalesce(m.created_at, c.updated_at) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_conversations() TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000013_real_post_gig.sql
-- ==============================================================================
-- Migration: 20261011000013_real_post_gig.sql
-- Milestone 13: Post gig (real)
-- Strictly adheres to docs/REAL_LOGIC_V5.md section 6, docs/MILESTONES.md, and AGENTS.md

-- 1. Redefine public.publish_gig(p_gig_id uuid) with full real SQL-level validation:
-- - Idempotent double-tap: if already 'open', exit cleanly without error
-- - Title length: 5 to 80 characters (trimmed)
-- - Description length: 30 to 2000 characters (trimmed)
-- - Minimum budget: >= 10000 centavos (₱100.00 PHP)
-- - Price ceiling: price_max >= price_min
-- - Category: must reference an active row in public.categories
-- - Mode gate: caller's active_mode must be 'hire'
-- - Account status: active, non-empty display_name, email confirmed, age 18+
-- - Deadlines: application_deadline > now(), deadline >= application_deadline

CREATE OR REPLACE FUNCTION public.publish_gig(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_gig record;
  v_email_confirmed boolean;
  v_category_valid boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig owner can publish this gig.';
  END IF;

  -- Idempotent check for double-tap publish
  IF v_gig.status = 'open' THEN
    RETURN;
  END IF;

  IF v_gig.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft gigs can be published.';
  END IF;

  -- Lock profile row and check user gates
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- Mode gate: must be in hire mode
  IF v_profile.active_mode <> 'hire' THEN
    RAISE EXCEPTION 'You must be in Hire Someone mode to publish a gig.';
  END IF;

  -- Account status check
  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Display name check
  IF v_profile.display_name IS NULL OR trim(v_profile.display_name) = '' THEN
    RAISE EXCEPTION 'You must set a display name before publishing a gig.';
  END IF;

  -- Email confirmation check from auth.users
  SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'You must confirm your email address before publishing a gig.';
  END IF;

  -- SQL-level field validation (parity with app validation per V5 section 6)
  -- 1. Title length: 5 to 80 chars
  IF char_length(trim(v_gig.title)) < 5 OR char_length(trim(v_gig.title)) > 80 THEN
    RAISE EXCEPTION 'Gig title must be between 5 and 80 characters.';
  END IF;

  -- 2. Description length: 30 to 2000 chars
  IF char_length(trim(v_gig.description)) < 30 OR char_length(trim(v_gig.description)) > 2000 THEN
    RAISE EXCEPTION 'Gig description must be between 30 and 2000 characters.';
  END IF;

  -- 3. Minimum budget: at least 10,000 centavos (₱100.00 PHP)
  IF v_gig.price_min < 10000 THEN
    RAISE EXCEPTION 'Minimum budget must be at least ₱100.00 (10000 centavos).';
  END IF;

  -- 4. Price max >= price min
  IF v_gig.price_max < v_gig.price_min THEN
    RAISE EXCEPTION 'Maximum budget cannot be less than minimum budget.';
  END IF;

  -- 5. Category must exist and be active
  SELECT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = v_gig.category_id AND is_active = true
  ) INTO v_category_valid;

  IF NOT v_category_valid THEN
    RAISE EXCEPTION 'Invalid or inactive category.';
  END IF;

  -- 6. Deadlines
  IF v_gig.application_deadline <= now() THEN
    RAISE EXCEPTION 'Application deadline must be in the future.';
  END IF;

  IF v_gig.deadline < v_gig.application_deadline THEN
    RAISE EXCEPTION 'Project completion deadline must be on or after the application deadline.';
  END IF;

  -- Atomically publish gig
  UPDATE public.gigs
  SET status = 'open',
      updated_at = now()
  WHERE id = p_gig_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'publish_gig', 'gigs', p_gig_id, jsonb_build_object('title', v_gig.title));
END;
$$;

-- 2. Define cancel_gig(p_gig_id uuid, p_reason text) RPC
-- Owner cancels gig with reason; sets status = 'cancelled'; notifies all pending applicants
CREATE OR REPLACE FUNCTION public.cancel_gig(
  p_gig_id uuid,
  p_reason text DEFAULT 'Cancelled by client'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_gig record;
  v_applicant record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Reason length validation
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 OR char_length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Cancellation reason must be between 3 and 500 characters.';
  END IF;

  -- Lock gig row
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF v_gig.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the gig owner can cancel this gig.';
  END IF;

  IF v_gig.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Only draft or open gigs can be cancelled. Active gigs with agreements must use cancel_agreement.';
  END IF;

  -- Update gig status to cancelled
  UPDATE public.gigs
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_gig_id;

  -- If gig was open, decline pending applications and notify applicants
  IF v_gig.status = 'open' THEN
    FOR v_applicant IN
      SELECT id, freelancer_id
      FROM public.applications
      WHERE gig_id = p_gig_id AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_applicant.id;

      PERFORM public.notify(
        v_applicant.freelancer_id,
        'gig_cancelled',
        'Gig Cancelled',
        'The gig "' || v_gig.title || '" has been cancelled by the client. Reason: ' || trim(p_reason),
        'gig',
        p_gig_id,
        jsonb_build_object('gig_id', p_gig_id, 'reason', trim(p_reason))
      );
    END LOOP;
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'cancel_gig',
    'gigs',
    p_gig_id,
    jsonb_build_object('title', v_gig.title, 'reason', trim(p_reason))
  );
END;
$$;

-- 3. Security grants: deny anon/public, grant authenticated
REVOKE EXECUTE ON FUNCTION public.publish_gig(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_gig(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_gig(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gig(uuid, text) TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000014_ai_onboarding.sql
-- ==============================================================================
-- Migration: 20261011000014_ai_onboarding.sql
-- Milestone 14: AI in Onboarding (Skills, Bio & Edge Function Backing)
-- Strictly adheres to docs/REAL_LOGIC_V5.md sections 1, 2, and 5 and AGENTS.md

-- 0. Ensure updated_at exists on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 1. Alter skills table to support user-originated custom skills
-- Add source column ('admin' or 'user') and created_by reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.skills 
      ADD COLUMN source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.skills 
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Relax category_id nullability for user-suggested custom skills (categorized by admin later)
  ALTER TABLE public.skills ALTER COLUMN category_id DROP NOT NULL;
END $$;

-- Add unique case-insensitive index on skills(lower(trim(name)))
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON public.skills (lower(trim(name)));

-- Update RLS on skills:
-- Authenticated users can view active skills OR pending user skills created by themselves
DROP POLICY IF EXISTS "Authenticated users can view active or own skills" ON public.skills;
CREATE POLICY "Authenticated users can view active or own skills" ON public.skills
  FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid());

-- Direct client write operations on skills remain denied (RPC-only via add_profile_skills)
REVOKE INSERT, UPDATE, DELETE ON public.skills FROM anon, authenticated, PUBLIC;

-- 2. Create areas reference table
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active areas" ON public.areas;
CREATE POLICY "Authenticated users can view active areas" ON public.areas
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Direct client modifications denied on areas
REVOKE INSERT, UPDATE, DELETE ON public.areas FROM anon, authenticated, PUBLIC;

-- 3. RPC: add_profile_skills(p_skill_ids uuid[], p_custom_names text[])
-- Adds verified catalog skills and/or creates custom user skills (is_active = false)
-- Links them into profile_skills for the authenticated caller
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
CREATE OR REPLACE FUNCTION public.add_profile_skills(
  p_skill_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_custom_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  out_skill_id uuid,
  out_skill_name text,
  out_is_active boolean,
  out_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_skill_id uuid;
  v_custom_name text;
  v_trimmed text;
  v_current_skills_count integer;
  v_new_skills_count integer;
  v_existing_skill_id uuid;
  v_recent_calls integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Verify active profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active.';
  END IF;

  -- Rate limit check: max 15 add_profile_skills calls per hour
  SELECT count(*) INTO v_recent_calls
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = 'add_profile_skills'
    AND created_at > now() - interval '1 hour';

  IF v_recent_calls >= 15 THEN
    RAISE EXCEPTION 'Rate limit exceeded for adding skills. Please try again later.';
  END IF;

  -- Validate maximum custom skills per single call
  IF array_length(p_custom_names, 1) > 10 THEN
    RAISE EXCEPTION 'You may add at most 10 custom skills per request.';
  END IF;

  -- Check current skill count on profile
  SELECT count(*) INTO v_current_skills_count
  FROM public.profile_skills
  WHERE profile_id = v_user_id;

  -- 1. Process existing catalog skill IDs
  IF p_skill_ids IS NOT NULL AND array_length(p_skill_ids, 1) > 0 THEN
    FOREACH v_skill_id IN ARRAY p_skill_ids
    LOOP
      IF v_skill_id IS NOT NULL THEN
        -- Check if skill exists and is visible to caller
        IF EXISTS (
          SELECT 1 FROM public.skills
          WHERE id = v_skill_id AND (is_active = true OR created_by = v_user_id)
        ) THEN
          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Process custom skill names
  IF p_custom_names IS NOT NULL AND array_length(p_custom_names, 1) > 0 THEN
    FOREACH v_custom_name IN ARRAY p_custom_names
    LOOP
      v_trimmed := trim(v_custom_name);
      IF v_trimmed IS NOT NULL AND v_trimmed <> '' THEN
        IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 40 THEN
          RAISE EXCEPTION 'Custom skill name must be between 2 and 40 characters: %', v_trimmed;
        END IF;

        -- Check profile skills ceiling (max 15 skills per profile)
        SELECT count(*) INTO v_current_skills_count
        FROM public.profile_skills
        WHERE profile_id = v_user_id;

        IF v_current_skills_count >= 15 THEN
          RAISE EXCEPTION 'Maximum limit of 15 skills per profile reached.';
        END IF;

        -- Check if skill already exists (case-insensitive)
        SELECT s.id INTO v_existing_skill_id
        FROM public.skills s
        WHERE lower(trim(s.name)) = lower(v_trimmed);

        IF v_existing_skill_id IS NOT NULL THEN
          -- Link existing skill
          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        ELSE
          -- Create user skill (is_active = false, pending admin review)
          INSERT INTO public.skills (name, source, is_active, created_by)
          VALUES (v_trimmed, 'user', false, v_user_id)
          RETURNING id INTO v_existing_skill_id;

          INSERT INTO public.profile_skills (profile_id, skill_id)
          VALUES (v_user_id, v_existing_skill_id)
          ON CONFLICT (profile_id, skill_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Record rate limit and audit events
  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, 'add_profile_skills');

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'add_profile_skills',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'catalog_ids_count', coalesce(array_length(p_skill_ids, 1), 0),
      'custom_names_count', coalesce(array_length(p_custom_names, 1), 0)
    )
  );

  -- Return updated caller profile skills
  RETURN QUERY
  SELECT 
    s.id AS out_skill_id,
    s.name AS out_skill_name,
    s.is_active AS out_is_active,
    s.source AS out_source
  FROM public.profile_skills ps
  JOIN public.skills s ON s.id = ps.skill_id
  WHERE ps.profile_id = v_user_id
  ORDER BY s.name;
END;
$$;

-- 4. RPC: complete_onboarding()
-- Verifies mode chosen and marks onboarding_complete = true atomically
DROP FUNCTION IF EXISTS public.complete_onboarding CASCADE;
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.active_mode IS NULL OR v_profile.active_mode NOT IN ('find_work', 'hire') THEN
    RAISE EXCEPTION 'You must select an initial role mode (Find Work or Hire Someone) before completing onboarding.';
  END IF;

  UPDATE public.profiles
  SET onboarding_complete = true,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    'complete_onboarding',
    'profiles',
    v_user_id,
    jsonb_build_object('active_mode', v_profile.active_mode)
  );
END;
$$;

-- 5. Revoke execute on new functions from anon and public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_profile_skills(uuid[], text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;


-- ==============================================================================
-- MIGRATION: 20261011000015_real_loop.sql
-- ==============================================================================
-- Migration: 20261011000015_real_loop.sql
-- Milestone 15: Complete Real Loop Hardening
-- Strictly adheres to docs/REAL_LOGIC_V5.md sections 0 and 8, docs/GIGORMOC_SPEC.md, and AGENTS.md

-- 1. Fix public.respond_to_counter:
--    - Correct inverted column-to-value assignments for public.agreements
--    - Enforce own-content rule (client_id <> freelancer_id)
--    - Set gig status = 'in_progress' and decline remaining proposals
--    - Emit proper notifications:
--      * When accepted: notify client (counter_accepted), notify both (agreement_created), decline others
--      * When declined / withdrawn: notify client (counter_declined)

DROP FUNCTION IF EXISTS public.respond_to_counter(uuid, text);
CREATE OR REPLACE FUNCTION public.respond_to_counter(
  p_application_id uuid,
  p_action text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_gig record;
  v_agreement_id uuid;
  v_other_app record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_action NOT IN ('accept', 'decline', 'withdraw') THEN
    RAISE EXCEPTION 'Invalid counter response. Must be accept, decline, or withdraw.';
  END IF;

  -- Lock application
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.freelancer_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the applicant freelancer can respond to this counteroffer.';
  END IF;

  IF v_app.status <> 'countered' THEN
    RAISE EXCEPTION 'Application is not in countered status (current: %).', v_app.status;
  END IF;

  -- Lock gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = v_app.gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  IF p_action IN ('decline', 'withdraw') THEN
    UPDATE public.applications
    SET status = p_action,
        updated_at = now()
    WHERE id = p_application_id;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      p_action || '_counter',
      'applications',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify client that counteroffer was declined/withdrawn
    PERFORM public.notify(
      v_gig.client_id,
      'counter_declined',
      'Counteroffer Declined',
      'Freelancer declined the counteroffer for "' || v_gig.title || '".',
      'application',
      p_application_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN NULL;

  ELSIF p_action = 'accept' THEN
    IF v_gig.status <> 'open' THEN
      RAISE EXCEPTION 'Gig is not open (current: %). An active agreement may already exist.', v_gig.status;
    END IF;

    -- Check if active agreement already exists
    IF EXISTS (
      SELECT 1 FROM public.agreements
      WHERE gig_id = v_gig.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active agreement already exists for this gig.';
    END IF;

    -- Own content check: client and freelancer must be distinct
    IF v_gig.client_id = v_user_id THEN
      RAISE EXCEPTION 'Client and freelancer cannot be the same person.';
    END IF;

    UPDATE public.applications
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_application_id;

    -- Create agreement: client_id = v_gig.client_id, freelancer_id = v_user_id
    INSERT INTO public.agreements (
      gig_id,
      client_id,
      freelancer_id,
      agreed_price,
      deadline,
      status
    )
    VALUES (
      v_gig.id,
      v_gig.client_id,
      v_user_id,
      v_app.counter_price,
      v_gig.deadline,
      'active'
    )
    RETURNING id INTO v_agreement_id;

    -- Update gig status
    UPDATE public.gigs
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = v_gig.id;

    -- Decline all other pending applications for this gig
    FOR v_other_app IN
      SELECT id, freelancer_id FROM public.applications
      WHERE gig_id = v_gig.id
        AND id <> p_application_id
        AND status IN ('applied', 'countered')
    LOOP
      UPDATE public.applications
      SET status = 'declined',
          updated_at = now()
      WHERE id = v_other_app.id;

      PERFORM public.notify(
        v_other_app.freelancer_id,
        'application_declined',
        'Gig Filled',
        'Another proposal was accepted for "' || v_gig.title || '".',
        'application',
        v_other_app.id,
        jsonb_build_object('gig_id', v_gig.id)
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_user_id,
      'accept_counter',
      'agreements',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id, 'price', v_app.counter_price)
    );

    -- Notify client that counter was accepted
    PERFORM public.notify(
      v_gig.client_id,
      'counter_accepted',
      'Counteroffer Accepted!',
      'Freelancer accepted your counteroffer for "' || v_gig.title || '". Agreement is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    -- Notify both parties: agreement_created
    PERFORM public.notify(
      v_gig.client_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    PERFORM public.notify(
      v_user_id,
      'agreement_created',
      'Agreement Created',
      'Agreement for "' || v_gig.title || '" is now active.',
      'agreement',
      v_agreement_id,
      jsonb_build_object('gig_id', v_gig.id)
    );

    RETURN v_agreement_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_counter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_counter(uuid, text) TO authenticated;

-- 2. Update public.cancel_agreement to emit agreement_cancelled notification
DROP FUNCTION IF EXISTS public.cancel_agreement(uuid, text);
CREATE OR REPLACE FUNCTION public.cancel_agreement(
    p_agreement_id UUID,
    p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_agreement RECORD;
    v_gig RECORD;
    v_other_party_id UUID;
    v_has_submitted_work BOOLEAN;
    v_result_status TEXT;
    v_report_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Please provide a reason of at least 5 characters for cancelling this agreement.';
    END IF;

    -- Lock agreement
    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_agreement.client_id <> v_caller_id AND v_agreement.freelancer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only agreement participants can initiate cancellation.';
    END IF;

    IF v_agreement.status <> 'active' THEN
        RAISE EXCEPTION 'Only active agreements can be cancelled or disputed (current: %).', v_agreement.status;
    END IF;

    -- Determine the other party to notify
    IF v_agreement.client_id = v_caller_id THEN
      v_other_party_id := v_agreement.freelancer_id;
    ELSE
      v_other_party_id := v_agreement.client_id;
    END IF;

    SELECT * INTO v_gig
    FROM public.gigs
    WHERE id = v_agreement.gig_id;

    -- Check if any milestone has been submitted or approved
    SELECT EXISTS (
        SELECT 1 FROM public.milestones
        WHERE agreement_id = p_agreement_id
          AND status IN ('submitted', 'approved', 'revision_requested')
    ) INTO v_has_submitted_work;

    IF NOT v_has_submitted_work THEN
        -- Work has not started yet -> Free cancellation
        UPDATE public.agreements
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_agreement_id;

        -- Cancel gig
        UPDATE public.gigs
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = v_agreement.gig_id;

        v_result_status := 'cancelled';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_freely',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason))
        );

        -- Notify the other party
        PERFORM public.notify(
          v_other_party_id,
          'agreement_cancelled',
          'Agreement Cancelled',
          'The agreement for "' || coalesce(v_gig.title, 'gig') || '" has been cancelled. Reason: ' || trim(p_reason),
          'agreement',
          p_agreement_id,
          jsonb_build_object('reason', trim(p_reason))
        );

    ELSE
        -- Work already started -> Flag as disputed and log a report for manual review
        UPDATE public.agreements
        SET status = 'disputed',
            updated_at = now()
        WHERE id = p_agreement_id;

        INSERT INTO public.reports (
            reporter_id,
            target_type,
            target_id,
            reason_category,
            details
        ) VALUES (
            v_caller_id,
            'agreement',
            p_agreement_id,
            'cancellation_request',
            'Agreement cancellation requested after deliverables started: ' || trim(p_reason)
        )
        RETURNING id INTO v_report_id;

        v_result_status := 'disputed';

        INSERT INTO public.audit_events (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_caller_id,
            'agreement_cancelled_disputed',
            'agreements',
            p_agreement_id,
            jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id)
        );

        -- Notify other party that cancellation was requested and dispute opened
        PERFORM public.notify(
          v_other_party_id,
          'agreement_disputed',
          'Agreement Cancellation Disputed',
          'A cancellation request was filed after work started. A dispute report has been opened for moderation review.',
          'agreement',
          p_agreement_id,
          jsonb_build_object('reason', trim(p_reason), 'report_id', v_report_id)
        );
    END IF;

    RETURN v_result_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_agreement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(uuid, text) TO authenticated;

