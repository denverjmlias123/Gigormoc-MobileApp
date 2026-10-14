-- ==============================================================================
-- GIGORMOC: TRANSACTION LOOP STORED PROCEDURES & PAYMENTS TABLE
-- Paste this into the Supabase Dashboard SQL Editor and click RUN.
-- ==============================================================================

-- 1. Create payments table if it does not already exist
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agreement_id TEXT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
    milestone_id TEXT REFERENCES public.milestones(id) ON DELETE SET NULL,
    payer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('gcash', 'maya', 'bank_transfer', 'cash', 'other')),
    reference_number TEXT NOT NULL DEFAULT '',
    receipt_path TEXT DEFAULT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'reported_sent' CHECK (status IN ('reported_sent', 'confirmed_received', 'disputed')),
    dispute_reason TEXT DEFAULT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    disputed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'allow_all_payments'
    ) THEN
        CREATE POLICY allow_all_payments ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. review_milestone RPC
CREATE OR REPLACE FUNCTION public.review_milestone(
    p_milestone_id TEXT,
    p_action TEXT,
    p_feedback TEXT DEFAULT '',
    p_request_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_milestone RECORD;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid()::text;
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('approve', 'request_revision') THEN
        RAISE EXCEPTION 'Invalid review action. Must be approve or request_revision.';
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
    WHERE id = v_milestone.agreement_id
    FOR UPDATE;

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can review milestone submissions.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.milestones
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_milestone_id;
    ELSE
        UPDATE public.milestones
        SET status = 'in_progress',
            revisions_used = COALESCE(revisions_used, 0) + 1,
            updated_at = now()
        WHERE id = p_milestone_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_milestone TO authenticated;

-- 3. report_payment RPC
CREATE OR REPLACE FUNCTION public.report_payment(
    p_agreement_id TEXT,
    p_milestone_id TEXT DEFAULT NULL,
    p_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'gcash',
    p_reference_number TEXT DEFAULT '',
    p_receipt_path TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT '',
    p_request_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_agreement RECORD;
    v_payment_id TEXT;
BEGIN
    v_caller_id := auth.uid()::text;
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

    IF v_agreement.client_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the client can report payment.';
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
        COALESCE(p_reference_number, ''),
        p_receipt_path,
        COALESCE(p_notes, ''),
        'reported_sent',
        now()
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_payment TO authenticated;

-- 4. confirm_payment RPC
CREATE OR REPLACE FUNCTION public.confirm_payment(
    p_payment_id TEXT,
    p_request_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_payment RECORD;
BEGIN
    v_caller_id := auth.uid()::text;
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found.';
    END IF;

    IF v_payment.payee_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the payee can confirm receipt.';
    END IF;

    UPDATE public.payments
    SET status = 'confirmed_received',
        confirmed_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_payment TO authenticated;

-- 5. complete_agreement RPC
CREATE OR REPLACE FUNCTION public.complete_agreement(
    p_agreement_id TEXT,
    p_request_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_agreement RECORD;
BEGIN
    v_caller_id := auth.uid()::text;
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
        RAISE EXCEPTION 'Only participants can complete the agreement.';
    END IF;

    UPDATE public.agreements
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_agreement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_agreement TO authenticated;

-- 6. submit_review RPC
CREATE OR REPLACE FUNCTION public.submit_review(
    p_agreement_id TEXT,
    p_rating INTEGER,
    p_comment TEXT,
    p_request_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id TEXT;
    v_agreement RECORD;
    v_review_id TEXT;
    v_reviewee_id TEXT;
    v_role TEXT;
BEGIN
    v_caller_id := auth.uid()::text;
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_agreement
    FROM public.agreements
    WHERE id = p_agreement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found.';
    END IF;

    IF v_caller_id = v_agreement.client_id THEN
        v_role := 'client';
        v_reviewee_id := v_agreement.freelancer_id;
    ELSIF v_caller_id = v_agreement.freelancer_id THEN
        v_role := 'freelancer';
        v_reviewee_id := v_agreement.client_id;
    ELSE
        RAISE EXCEPTION 'Only participants can review this agreement.';
    END IF;

    INSERT INTO public.reviews (
        agreement_id,
        reviewer_id,
        reviewee_id,
        role,
        rating,
        comment
    ) VALUES (
        p_agreement_id,
        v_caller_id,
        v_reviewee_id,
        v_role,
        p_rating,
        COALESCE(p_comment, '')
    )
    RETURNING id INTO v_review_id;

    RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review TO authenticated;
