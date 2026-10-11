-- ── property_market_values ────────────────────────────────────────────────────
CREATE TABLE public.property_market_values (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  value_date   DATE         NOT NULL,
  market_value NUMERIC(12,2) NOT NULL,
  notes        TEXT,
  created_by   UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.property_market_values ENABLE ROW LEVEL SECURITY;

CREATE INDEX pmv_property_id_idx   ON public.property_market_values (property_id);
CREATE INDEX pmv_value_date_idx    ON public.property_market_values (property_id, value_date DESC);

CREATE TRIGGER set_property_market_values_updated_at
  BEFORE UPDATE ON public.property_market_values
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_property_market_values
  AFTER INSERT OR UPDATE OR DELETE ON public.property_market_values
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

CREATE POLICY "property_market_values: authenticated select"
  ON public.property_market_values FOR SELECT
  USING ((select auth.role()) = 'authenticated');

CREATE POLICY "property_market_values: admin and manager insert"
  ON public.property_market_values FOR INSERT
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "property_market_values: admin and manager update"
  ON public.property_market_values FOR UPDATE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'))
  WITH CHECK ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

CREATE POLICY "property_market_values: admin and manager delete"
  ON public.property_market_values FOR DELETE
  USING  ((select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
