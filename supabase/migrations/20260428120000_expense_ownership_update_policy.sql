-- Restrict expense UPDATE to record owners only, regardless of role.

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    is_active = true
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
    AND created_by = (select auth.uid())
  )
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
    AND created_by = (select auth.uid())
  );
