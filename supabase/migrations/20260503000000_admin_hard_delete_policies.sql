-- Admin hard-delete policies for expenses and guaranteed_payments
-- Also adds a trigger to cascade-delete approval_requirements rows
-- (which use a polymorphic approvable_id, so no FK cascade exists).

-- ============================================================
-- DELETE policies
-- ============================================================

CREATE POLICY "expenses_delete"
  ON public.expenses
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "guaranteed_payments_delete"
  ON public.guaranteed_payments
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- ============================================================
-- Cascade delete approval_requirements via trigger
-- (polymorphic table has no FK, so we handle it here)
-- ============================================================

CREATE OR REPLACE FUNCTION private.delete_approval_requirements_for_approvable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.approval_requirements
  WHERE approvable_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER cascade_delete_approvals_on_expense
  BEFORE DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.delete_approval_requirements_for_approvable();

CREATE TRIGGER cascade_delete_approvals_on_gp
  BEFORE DELETE ON public.guaranteed_payments
  FOR EACH ROW EXECUTE FUNCTION private.delete_approval_requirements_for_approvable();
