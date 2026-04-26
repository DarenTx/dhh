-- Phase 3: Financial Tracking
-- Tables: expenses, guaranteed_payments, expense_evidence
-- Functions: expense_needs_approval, gp_needs_approval, create_approval_snapshot,
--             resolve_approval_status, expense_after_insert, guaranteed_payment_after_insert
-- Storage: expense-evidence bucket + policies
-- Seeds: default expense_subcategories for all 15 IRS Schedule E categories

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE public.expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date NOT NULL,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  description      text NOT NULL,
  irs_category_id  integer NOT NULL REFERENCES public.irs_expense_categories(id),
  subcategory_id   uuid NOT NULL REFERENCES public.expense_subcategories(id),
  property_id      uuid REFERENCES public.properties(id),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.guaranteed_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date         date NOT NULL,
  hours_billed      numeric(4,2) NOT NULL CHECK (hours_billed > 0),
  work_description  text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, work_date)
);

CREATE TABLE public.expense_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic','application/pdf')),
  uploaded_by   uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX expenses_irs_category_id_idx ON public.expenses (irs_category_id);
CREATE INDEX expenses_subcategory_id_idx ON public.expenses (subcategory_id);
CREATE INDEX expenses_property_id_idx ON public.expenses (property_id);
CREATE INDEX expenses_created_by_idx ON public.expenses (created_by);
CREATE INDEX expenses_date_idx ON public.expenses (date);

CREATE INDEX guaranteed_payments_created_by_idx ON public.guaranteed_payments (created_by);
CREATE INDEX guaranteed_payments_work_date_idx ON public.guaranteed_payments (work_date);

CREATE INDEX expense_evidence_expense_id_idx ON public.expense_evidence (expense_id);
CREATE INDEX expense_evidence_uploaded_by_idx ON public.expense_evidence (uploaded_by);

-- ============================================================
-- Triggers: updated_at + audit
-- ============================================================

CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER set_updated_at_guaranteed_payments
  BEFORE UPDATE ON public.guaranteed_payments
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE TRIGGER audit_guaranteed_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.guaranteed_payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

-- ============================================================
-- Private functions
-- ============================================================

-- Check if a new expense crosses the monthly aggregate threshold
CREATE OR REPLACE FUNCTION private.expense_needs_approval(
  p_amount numeric,
  p_month  int,
  p_year   int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_threshold numeric;
  v_current_total numeric;
BEGIN
  SELECT expense_monthly_aggregate_threshold INTO v_threshold FROM public.app_settings LIMIT 1;
  SELECT COALESCE(SUM(amount), 0) INTO v_current_total
  FROM public.expenses
  WHERE is_active = true
    AND status <> 'rejected'
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR FROM date) = p_year;
  RETURN (v_current_total + p_amount) >= v_threshold;
END;
$$;

-- Check if a new GP entry exceeds the submitter's monthly hour cap
CREATE OR REPLACE FUNCTION private.gp_needs_approval(
  p_submitter_id uuid,
  p_month        int,
  p_year         int,
  p_new_hours    numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_cap numeric;
  v_current_hours numeric;
BEGIN
  SELECT guaranteed_payment_hour_cap INTO v_cap FROM public.app_settings LIMIT 1;
  SELECT COALESCE(SUM(hours_billed), 0) INTO v_current_hours
  FROM public.guaranteed_payments
  WHERE created_by = p_submitter_id
    AND is_active = true
    AND status <> 'rejected'
    AND EXTRACT(MONTH FROM work_date) = p_month
    AND EXTRACT(YEAR FROM work_date) = p_year;
  RETURN (v_current_hours + p_new_hours) > v_cap;
END;
$$;

-- Snapshot active approvers for a new approvable; auto-approve if no others exist
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
    AND ur.user_id <> p_submitter_id;

  GET DIAGNOSTICS v_approver_count = ROW_COUNT;

  IF v_approver_count = 0 THEN
    IF p_approvable_type = 'expense' THEN
      UPDATE public.expenses SET status = 'approved' WHERE id = p_approvable_id;
    ELSIF p_approvable_type = 'guaranteed_payment' THEN
      UPDATE public.guaranteed_payments SET status = 'approved' WHERE id = p_approvable_id;
    END IF;
  END IF;
END;
$$;

-- Resolve parent status after any approval_requirement row update
CREATE OR REPLACE FUNCTION private.resolve_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_total    int;
  v_approved int;
  v_rejected int;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total, v_approved, v_rejected
  FROM public.approval_requirements
  WHERE approvable_type = NEW.approvable_type
    AND approvable_id   = NEW.approvable_id;

  IF v_rejected > 0 THEN
    IF NEW.approvable_type = 'expense' THEN
      UPDATE public.expenses SET status = 'rejected' WHERE id = NEW.approvable_id;
    ELSIF NEW.approvable_type = 'guaranteed_payment' THEN
      UPDATE public.guaranteed_payments SET status = 'rejected' WHERE id = NEW.approvable_id;
    END IF;
  ELSIF v_approved = v_total THEN
    IF NEW.approvable_type = 'expense' THEN
      UPDATE public.expenses SET status = 'approved' WHERE id = NEW.approvable_id;
    ELSIF NEW.approvable_type = 'guaranteed_payment' THEN
      UPDATE public.guaranteed_payments SET status = 'approved' WHERE id = NEW.approvable_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER resolve_approval_status
  AFTER UPDATE ON public.approval_requirements
  FOR EACH ROW EXECUTE FUNCTION private.resolve_approval_status();

-- AFTER INSERT on expenses: route to approval or auto-approve
CREATE OR REPLACE FUNCTION private.expense_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF private.expense_needs_approval(
    NEW.amount,
    EXTRACT(MONTH FROM NEW.date)::int,
    EXTRACT(YEAR FROM NEW.date)::int
  ) THEN
    PERFORM private.create_approval_snapshot('expense', NEW.id, NEW.created_by);
  ELSE
    UPDATE public.expenses SET status = 'approved' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER expense_after_insert
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.expense_after_insert();

-- AFTER INSERT on guaranteed_payments: route to approval or auto-approve
CREATE OR REPLACE FUNCTION private.guaranteed_payment_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF private.gp_needs_approval(
    NEW.created_by,
    EXTRACT(MONTH FROM NEW.work_date)::int,
    EXTRACT(YEAR FROM NEW.work_date)::int,
    NEW.hours_billed
  ) THEN
    PERFORM private.create_approval_snapshot('guaranteed_payment', NEW.id, NEW.created_by);
  ELSE
    UPDATE public.guaranteed_payments SET status = 'approved' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guaranteed_payment_after_insert
  AFTER INSERT ON public.guaranteed_payments
  FOR EACH ROW EXECUTE FUNCTION private.guaranteed_payment_after_insert();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guaranteed_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_evidence ENABLE ROW LEVEL SECURITY;

-- expenses
CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    is_active = true
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- guaranteed_payments
CREATE POLICY "guaranteed_payments_select" ON public.guaranteed_payments
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "guaranteed_payments_insert" ON public.guaranteed_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

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

-- expense_evidence
CREATE POLICY "expense_evidence_select" ON public.expense_evidence
  FOR SELECT TO authenticated
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expense_evidence_insert" ON public.expense_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expense_evidence_delete" ON public.expense_evidence
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- ============================================================
-- Storage bucket + policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-evidence',
  'expense-evidence',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "expense_evidence_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-evidence'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expense_evidence_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-evidence'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expense_evidence_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-evidence'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    bucket_id = 'expense-evidence'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "expense_evidence_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-evidence'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- ============================================================
-- Seed: default expense sub-categories for all 15 IRS categories
-- ============================================================

INSERT INTO public.expense_subcategories (irs_category_id, name) VALUES
  -- 1. Advertising
  (1, 'Online listings (Zillow, Apartments.com)'),
  (1, 'Print advertising'),
  (1, 'Signage'),
  (1, 'Photography / videography'),
  -- 2. Auto and travel
  (2, 'Mileage reimbursement'),
  (2, 'Parking and tolls'),
  (2, 'Airfare / lodging'),
  -- 3. Cleaning and maintenance
  (3, 'Cleaning service'),
  (3, 'Landscaping / lawn care'),
  (3, 'Snow removal'),
  (3, 'HVAC maintenance'),
  (3, 'Pest control'),
  -- 4. Commissions
  (4, 'Leasing agent commission'),
  (4, 'Property management fee'),
  -- 5. Insurance
  (5, 'Property insurance premium'),
  (5, 'Umbrella / liability insurance'),
  -- 6. Legal and other professional fees
  (6, 'Attorney fees'),
  (6, 'Accounting / bookkeeping'),
  (6, 'Eviction filing fees'),
  -- 7. Management fees
  (7, 'Software / platform subscription'),
  (7, 'Bank / payment processing fees'),
  -- 8. Mortgage interest paid to banks
  (8, 'Monthly mortgage interest'),
  -- 9. Other interest
  (9, 'Credit card interest'),
  (9, 'Line of credit interest'),
  -- 10. Repairs
  (10, 'Plumbing repair'),
  (10, 'Electrical repair'),
  (10, 'Appliance repair'),
  (10, 'Roof repair'),
  (10, 'Flooring repair'),
  (10, 'General handyman'),
  -- 11. Supplies
  (11, 'Cleaning supplies'),
  (11, 'Hardware / tools'),
  (11, 'Office supplies'),
  -- 12. Taxes
  (12, 'Property tax'),
  (12, 'LLC franchise tax'),
  -- 13. Utilities
  (13, 'Electric'),
  (13, 'Gas'),
  (13, 'Water / sewer'),
  (13, 'Trash removal'),
  (13, 'Internet'),
  -- 14. Depreciation expense or depletion
  (14, 'Building depreciation'),
  (14, 'Capital improvement depreciation'),
  -- 15. Other
  (15, 'Miscellaneous')
ON CONFLICT DO NOTHING;
