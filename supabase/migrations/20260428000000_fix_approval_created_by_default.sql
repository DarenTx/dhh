-- Fix: stamp created_by with the authenticated user's ID on insert.
-- Without this DEFAULT, created_by was NULL, which caused:
--   1. gp_needs_approval to count 0 existing hours (wrong per-person total)
--   2. create_approval_snapshot to find 0 approvers (NULL <> uuid is NULL in SQL)
--      → auto-approve even when other managers exist

ALTER TABLE public.guaranteed_payments
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.expenses
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Fix create_approval_snapshot to use IS DISTINCT FROM instead of <>
-- so a NULL submitter_id never bypasses the approver lookup.
-- IS DISTINCT FROM treats NULL as comparable:
--   NULL IS DISTINCT FROM NULL  → false  (won't include submitter when both NULL)
--   NULL IS DISTINCT FROM uuid  → true   (includes all real managers if submitter NULL)
CREATE OR REPLACE FUNCTION private.create_approval_snapshot(
  p_approvable_type text,
  p_approvable_id   uuid,
  p_submitter_id    uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_approver_count int;
BEGIN
  INSERT INTO public.approval_requirements (approvable_type, approvable_id, approver_id)
  SELECT p_approvable_type, p_approvable_id, ur.user_id
  FROM public.user_roles ur
  WHERE ur.is_active = true
    AND ur.role IN ('admin', 'manager')
    AND ur.user_id IS DISTINCT FROM p_submitter_id;

  GET DIAGNOSTICS v_approver_count = ROW_COUNT;

  -- Only auto-approve when there are genuinely no other managers to review.
  -- With multiple managers present the item stays pending until all approve.
  IF v_approver_count = 0 THEN
    IF p_approvable_type = 'expense' THEN
      UPDATE public.expenses SET status = 'approved' WHERE id = p_approvable_id;
    ELSIF p_approvable_type = 'guaranteed_payment' THEN
      UPDATE public.guaranteed_payments SET status = 'approved' WHERE id = p_approvable_id;
    END IF;
  END IF;
END;
$$;
