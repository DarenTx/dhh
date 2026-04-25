-- Phase 1: Platform Core
-- Creates all tables, RLS policies, triggers, and auth hook for the DHH application.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Private schema (security-definer functions only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_roles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      varchar(320) NOT NULL,
  role       text         NOT NULL CHECK (role IN ('admin', 'manager', 'view_only')),
  is_active  boolean      NOT NULL DEFAULT true,
  invited_by uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can always read their own row (needed for UI and Auth Hook)
CREATE POLICY "user_roles: select own row"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all rows
CREATE POLICY "user_roles: admin select all"
  ON public.user_roles
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admins can update is_active (deactivate/reactivate)
CREATE POLICY "user_roles: admin update is_active"
  ON public.user_roles
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. app_settings (single row, id = 1)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.app_settings (
  id                                    integer PRIMARY KEY DEFAULT 1,
  expense_monthly_aggregate_threshold   numeric  NOT NULL DEFAULT 150,
  guaranteed_payment_hour_cap           integer  NOT NULL DEFAULT 20,
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO public.app_settings (id) VALUES (1);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings: admin and manager select"
  ON public.app_settings
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

CREATE POLICY "app_settings: admin and manager update"
  ON public.app_settings
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. irs_expense_categories (read-only seed data)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.irs_expense_categories (
  id   serial      PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE
);

INSERT INTO public.irs_expense_categories (name) VALUES
  ('Advertising'),
  ('Auto and travel'),
  ('Cleaning and maintenance'),
  ('Commissions'),
  ('Insurance'),
  ('Legal and other professional fees'),
  ('Management fees'),
  ('Mortgage interest paid to banks'),
  ('Other interest'),
  ('Repairs'),
  ('Supplies'),
  ('Taxes'),
  ('Utilities'),
  ('Depreciation expense or depletion'),
  ('Other');

ALTER TABLE public.irs_expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "irs_expense_categories: admin and manager select"
  ON public.irs_expense_categories
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. expense_subcategories
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.expense_subcategories (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  irs_category_id integer      NOT NULL REFERENCES public.irs_expense_categories (id),
  name            varchar(120) NOT NULL,
  is_active       boolean      NOT NULL DEFAULT true,
  created_by      uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (irs_category_id, name)
);

ALTER TABLE public.expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_subcategories: admin and manager select active"
  ON public.expense_subcategories
  FOR SELECT
  USING (
    is_active = true
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

CREATE POLICY "expense_subcategories: admin and manager insert"
  ON public.expense_subcategories
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Disable (set is_active = false) — no UI re-activation
CREATE POLICY "expense_subcategories: admin and manager update"
  ON public.expense_subcategories
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. approval_requirements
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.approval_requirements (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  approvable_type  text        NOT NULL CHECK (approvable_type IN ('expense', 'guaranteed_payment')),
  approvable_id    uuid        NOT NULL,
  approver_id      uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status           text        NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reason           text,
  responded_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX approval_requirements_approvable_idx
  ON public.approval_requirements (approvable_type, approvable_id);
CREATE INDEX approval_requirements_approver_idx
  ON public.approval_requirements (approver_id, status);

ALTER TABLE public.approval_requirements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own rows (as approver)
CREATE POLICY "approval_requirements: select own rows"
  ON public.approval_requirements
  FOR SELECT
  USING (auth.uid() = approver_id);

-- Admins and managers can see all rows
CREATE POLICY "approval_requirements: admin and manager select all"
  ON public.approval_requirements
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Only the approver can update their own pending row
CREATE POLICY "approval_requirements: approver update own pending"
  ON public.approval_requirements
  FOR UPDATE
  USING (
    auth.uid() = approver_id AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = approver_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. audit_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   varchar(64) NOT NULL,
  record_id    text        NOT NULL,
  operation    text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     jsonb,
  new_data     jsonb,
  performed_by uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_performed_by_fkey
  ON public.audit_log (performed_by);
CREATE INDEX audit_log_table_op_idx
  ON public.audit_log (table_name, operation, performed_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read audit logs
CREATE POLICY "audit_log: authenticated select"
  ON public.audit_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_set_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Audit trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id text;
  v_old_data  jsonb;
  v_new_data  jsonb;
  v_pk_col    text := COALESCE(TG_ARGV[0], 'id');
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_data  := to_jsonb(OLD);
    v_new_data  := NULL;
    v_record_id := v_old_data ->> v_pk_col;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data  := NULL;
    v_new_data  := to_jsonb(NEW);
    v_record_id := v_new_data ->> v_pk_col;
  ELSE -- UPDATE
    v_old_data  := to_jsonb(OLD);
    v_new_data  := to_jsonb(NEW);
    v_record_id := v_new_data ->> v_pk_col;
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    performed_by
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_data,
    v_new_data,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach audit trigger to all Phase 1 tables
-- user_roles uses 'user_id' as its PK, not 'id' — pass as trigger argument
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('user_id');

CREATE TRIGGER audit_app_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE TRIGGER audit_expense_subcategories
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_subcategories
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE TRIGGER audit_approval_requirements
  AFTER INSERT OR UPDATE OR DELETE ON public.approval_requirements
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Deactivation cascade: delete pending approval_requirements
--    when a user_roles row has is_active set to false
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.cascade_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only run when is_active changes from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    DELETE FROM public.approval_requirements
    WHERE approver_id = NEW.user_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_cascade_deactivation
  AFTER UPDATE OF is_active ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.cascade_deactivation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Auth Hook — custom access token (stamps role + is_active into app_metadata)
--     Register in: Authentication → Hooks → Custom Access Token Hook
--     Function: private.custom_access_token_hook
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid;
  v_role      text;
  v_is_active boolean;
  v_claims    jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;

  SELECT role, is_active
    INTO v_role, v_is_active
    FROM public.user_roles
   WHERE user_id = v_user_id;

  -- Unknown users get null role and inactive status
  IF NOT FOUND THEN
    v_role      := NULL;
    v_is_active := false;
  END IF;

  v_claims := event -> 'claims';
  v_claims := jsonb_set(v_claims, '{app_metadata}',
    COALESCE(v_claims -> 'app_metadata', '{}'::jsonb)
    || jsonb_build_object('role', v_role, 'is_active', v_is_active)
  );

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Grant execute to supabase_auth_admin so the hook can call this function
GRANT EXECUTE ON FUNCTION private.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Grant usage on private schema to postgres (for trigger execution)
-- ─────────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA private TO postgres;
