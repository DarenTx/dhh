-- =============================================================================
-- Phase 2: Core Property Data
-- Tables: properties, tenants, leases, lease_tenants, notes
-- Storage: property-photos bucket
-- Seed: 13 Yukon, OK rental properties
-- =============================================================================

-- ── properties ────────────────────────────────────────────────────────────────
CREATE TABLE public.properties (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  address_line1    TEXT         NOT NULL,
  address_line2    TEXT,
  city             TEXT,
  state            VARCHAR(2)   DEFAULT 'OK',
  zip              TEXT,
  year_built       INTEGER,
  square_footage   INTEGER,
  bedrooms         INTEGER,
  bathrooms        NUMERIC(3,1),
  cover_photo_url  TEXT,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_by       UUID         REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX properties_is_active_idx    ON public.properties (is_active);
CREATE INDEX properties_created_by_idx   ON public.properties (created_by);

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE POLICY "properties: authenticated select"
  ON public.properties FOR SELECT
  USING ((select auth.role()) = 'authenticated');

CREATE POLICY "properties: admin and manager insert"
  ON public.properties FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "properties: admin and manager update"
  ON public.properties FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ── tenants ───────────────────────────────────────────────────────────────────
CREATE TABLE public.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE INDEX tenants_is_active_idx   ON public.tenants (is_active);
CREATE INDEX tenants_created_by_idx  ON public.tenants (created_by);

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_tenants
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE POLICY "tenants: authenticated select"
  ON public.tenants FOR SELECT
  USING ((select auth.role()) = 'authenticated');

CREATE POLICY "tenants: admin and manager insert"
  ON public.tenants FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "tenants: admin and manager update"
  ON public.tenants FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ── leases ────────────────────────────────────────────────────────────────────
CREATE TABLE public.leases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID        NOT NULL REFERENCES public.properties(id),
  start_date       DATE        NOT NULL,
  end_date         DATE,
  monthly_rent     NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2) NOT NULL,
  document_url     TEXT,
  status           TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'terminated')),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Only one active lease per property at a time
CREATE UNIQUE INDEX uq_one_active_lease
  ON public.leases (property_id)
  WHERE is_active = true AND status = 'active';

CREATE INDEX leases_property_id_idx  ON public.leases (property_id);
CREATE INDEX leases_status_idx       ON public.leases (status);
CREATE INDEX leases_is_active_idx    ON public.leases (is_active);
CREATE INDEX leases_created_by_idx   ON public.leases (created_by);

CREATE TRIGGER set_leases_updated_at
  BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_leases
  AFTER INSERT OR UPDATE OR DELETE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE POLICY "leases: authenticated select"
  ON public.leases FOR SELECT
  USING ((select auth.role()) = 'authenticated');

CREATE POLICY "leases: admin and manager insert"
  ON public.leases FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "leases: admin and manager update"
  ON public.leases FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ── lease_tenants (join table) ────────────────────────────────────────────────
CREATE TABLE public.lease_tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id   UUID        NOT NULL REFERENCES public.leases(id)   ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lease_id, tenant_id)
);

ALTER TABLE public.lease_tenants ENABLE ROW LEVEL SECURITY;

CREATE INDEX lease_tenants_lease_id_idx   ON public.lease_tenants (lease_id);
CREATE INDEX lease_tenants_tenant_id_idx  ON public.lease_tenants (tenant_id);

CREATE POLICY "lease_tenants: authenticated select"
  ON public.lease_tenants FOR SELECT
  USING ((select auth.role()) = 'authenticated');

CREATE POLICY "lease_tenants: admin and manager insert"
  ON public.lease_tenants FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "lease_tenants: admin and manager delete"
  ON public.lease_tenants FOR DELETE
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ── notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID        REFERENCES public.properties(id),
  tenant_id   UUID        REFERENCES public.tenants(id),
  lease_id    UUID        REFERENCES public.leases(id),
  content          TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_by       UUID        REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX notes_property_id_idx  ON public.notes (property_id);
CREATE INDEX notes_tenant_id_idx    ON public.notes (tenant_id);
CREATE INDEX notes_lease_id_idx     ON public.notes (lease_id);
CREATE INDEX notes_is_active_idx    ON public.notes (is_active);
CREATE INDEX notes_created_by_idx   ON public.notes (created_by);

CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE POLICY "notes: authenticated select active"
  ON public.notes FOR SELECT
  USING ((select auth.role()) = 'authenticated' AND is_active = true);

CREATE POLICY "notes: authenticated insert"
  ON public.notes FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "notes: admin and manager update"
  ON public.notes FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ── Storage: property-photos bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', false);

CREATE POLICY "property-photos: authenticated select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'property-photos'
    AND (select auth.role()) = 'authenticated'
  );

CREATE POLICY "property-photos: admin and manager insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "property-photos: admin and manager update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'property-photos'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "property-photos: admin and manager delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-photos'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
  );

-- ── Phase 1 RLS performance fixes (auth_rls_initplan) ────────────────────────
-- Wrap auth.<function>() in (select ...) to prevent per-row re-evaluation

-- user_roles
DROP POLICY IF EXISTS "user_roles: select own row"          ON public.user_roles;
DROP POLICY IF EXISTS "user_roles: admin select all"        ON public.user_roles;
DROP POLICY IF EXISTS "user_roles: admin update is_active"  ON public.user_roles;

CREATE POLICY "user_roles: select own row"
  ON public.user_roles FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_roles: admin select all"
  ON public.user_roles FOR SELECT
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "user_roles: admin update is_active"
  ON public.user_roles FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

-- app_settings
DROP POLICY IF EXISTS "app_settings: admin and manager select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings: admin and manager update" ON public.app_settings;

CREATE POLICY "app_settings: admin and manager select"
  ON public.app_settings FOR SELECT
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "app_settings: admin and manager update"
  ON public.app_settings FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- irs_expense_categories
DROP POLICY IF EXISTS "irs_expense_categories: admin and manager select" ON public.irs_expense_categories;

CREATE POLICY "irs_expense_categories: admin and manager select"
  ON public.irs_expense_categories FOR SELECT
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- expense_subcategories
DROP POLICY IF EXISTS "expense_subcategories: admin and manager select active" ON public.expense_subcategories;
DROP POLICY IF EXISTS "expense_subcategories: admin and manager insert"        ON public.expense_subcategories;
DROP POLICY IF EXISTS "expense_subcategories: admin and manager update"        ON public.expense_subcategories;

CREATE POLICY "expense_subcategories: admin and manager select active"
  ON public.expense_subcategories FOR SELECT
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND is_active = true
  );

CREATE POLICY "expense_subcategories: admin and manager insert"
  ON public.expense_subcategories FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "expense_subcategories: admin and manager update"
  ON public.expense_subcategories FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- approval_requirements
DROP POLICY IF EXISTS "approval_requirements: select own rows"              ON public.approval_requirements;
DROP POLICY IF EXISTS "approval_requirements: admin and manager select all" ON public.approval_requirements;
DROP POLICY IF EXISTS "approval_requirements: approver update own pending"  ON public.approval_requirements;

CREATE POLICY "approval_requirements: select own rows"
  ON public.approval_requirements FOR SELECT
  USING ((select auth.uid()) = approver_id);

CREATE POLICY "approval_requirements: admin and manager select all"
  ON public.approval_requirements FOR SELECT
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "approval_requirements: approver update own pending"
  ON public.approval_requirements FOR UPDATE
  USING  ((select auth.uid()) = approver_id AND status = 'pending')
  WITH CHECK ((select auth.uid()) = approver_id);

-- audit_log
DROP POLICY IF EXISTS "audit_log: authenticated select" ON public.audit_log;

CREATE POLICY "audit_log: authenticated select"
  ON public.audit_log FOR SELECT
  USING ((select auth.role()) = 'authenticated');

-- expense_subcategories: missing FK index (Phase 1 oversight)
CREATE INDEX IF NOT EXISTS expense_subcategories_created_by_idx
  ON public.expense_subcategories (created_by);

-- user_roles: missing invited_by FK index (Phase 1 oversight)
CREATE INDEX IF NOT EXISTS user_roles_invited_by_idx
  ON public.user_roles (invited_by);

-- ── Seed data: 13 Yukon, OK rental properties ─────────────────────────────────
INSERT INTO public.properties (address_line1, city, state, zip, bedrooms, bathrooms, year_built, square_footage) VALUES
  ('100 Oak Street',        'Yukon', 'OK', '73099', 3, 2.0, 1998, 1450),
  ('200 Maple Avenue',      'Yukon', 'OK', '73099', 4, 2.5, 2003, 1820),
  ('300 Pine Drive',        'Yukon', 'OK', '73099', 3, 1.5, 1995, 1320),
  ('400 Cedar Lane',        'Yukon', 'OK', '73099', 2, 1.0, 1987, 1050),
  ('500 Elm Court',         'Yukon', 'OK', '73099', 4, 3.0, 2010, 2100),
  ('600 Willow Way',        'Yukon', 'OK', '73099', 3, 2.0, 2001, 1560),
  ('700 Birch Boulevard',   'Yukon', 'OK', '73099', 3, 2.0, 1999, 1480),
  ('800 Walnut Circle',     'Yukon', 'OK', '73099', 4, 2.5, 2006, 1950),
  ('900 Sycamore Street',   'Yukon', 'OK', '73099', 2, 1.0, 1982, 980),
  ('1000 Hickory Trail',    'Yukon', 'OK', '73099', 3, 2.0, 2004, 1600),
  ('1100 Cottonwood Place', 'Yukon', 'OK', '73099', 4, 2.5, 2008, 2050),
  ('1200 Magnolia Road',    'Yukon', 'OK', '73099', 3, 1.5, 1993, 1350),
  ('1300 Dogwood Drive',    'Yukon', 'OK', '73099', 3, 2.0, 2000, 1520);
