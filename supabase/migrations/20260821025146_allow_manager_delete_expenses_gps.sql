-- Allow managers (and admins) to hard-delete expenses and guaranteed payments.
-- Previously only admins could delete; managers now have equal delete access.

DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(ARRAY['admin', 'manager'])
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean = true)
  );

DROP POLICY IF EXISTS guaranteed_payments_delete ON public.guaranteed_payments;
CREATE POLICY guaranteed_payments_delete ON public.guaranteed_payments
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(ARRAY['admin', 'manager'])
    AND ((auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean = true)
  );
