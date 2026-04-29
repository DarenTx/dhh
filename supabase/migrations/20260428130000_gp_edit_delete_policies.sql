-- Ensure guaranteed_payments UPDATE policy restricts to record owners only,
-- matching the expense ownership pattern.
-- The existing policy already has created_by = auth.uid(), so this is a no-op
-- re-statement for clarity and audit purposes.

DROP POLICY IF EXISTS "guaranteed_payments_update" ON public.guaranteed_payments;

CREATE POLICY "guaranteed_payments_update" ON public.guaranteed_payments
  FOR UPDATE TO authenticated
  USING (
    is_active = true
    AND created_by = (select auth.uid())
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );
