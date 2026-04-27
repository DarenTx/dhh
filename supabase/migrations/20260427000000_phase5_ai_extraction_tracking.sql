-- Phase 5: AI extraction tracking
-- Tables: ai_extraction_drafts, ai_extraction_attempts
-- Policy: retention cleanup for expired drafts and old attempts

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE public.ai_extraction_drafts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type        text NOT NULL CHECK (flow_type IN ('lease', 'expense')),
  property_id      uuid REFERENCES public.properties(id),
  storage_bucket   text NOT NULL,
  storage_path     text NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  extracted_data   jsonb,
  confidence_data  jsonb,
  warnings         jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message    text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE TABLE public.ai_extraction_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id         uuid NOT NULL REFERENCES public.ai_extraction_drafts(id) ON DELETE CASCADE,
  function_name    text NOT NULL CHECK (function_name IN ('extract-lease', 'extract-expense')),
  provider         text NOT NULL,
  model            text NOT NULL,
  status           text NOT NULL CHECK (status IN ('success', 'error')),
  latency_ms       integer NOT NULL CHECK (latency_ms >= 0),
  retry_count      integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  request_id       text,
  error_message    text,
  response_payload jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX ai_extraction_drafts_flow_idx ON public.ai_extraction_drafts (flow_type, status);
CREATE INDEX ai_extraction_drafts_expires_at_idx ON public.ai_extraction_drafts (expires_at);
CREATE INDEX ai_extraction_drafts_property_id_idx ON public.ai_extraction_drafts (property_id);
CREATE INDEX ai_extraction_drafts_created_by_idx ON public.ai_extraction_drafts (created_by);
CREATE INDEX ai_extraction_attempts_draft_id_idx ON public.ai_extraction_attempts (draft_id);
CREATE INDEX ai_extraction_attempts_created_at_idx ON public.ai_extraction_attempts (created_at);
CREATE INDEX ai_extraction_attempts_status_idx ON public.ai_extraction_attempts (status);

-- ============================================================
-- Triggers: updated_at + audit
-- ============================================================

CREATE TRIGGER set_updated_at_ai_extraction_drafts
  BEFORE UPDATE ON public.ai_extraction_drafts
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_ai_extraction_drafts
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_extraction_drafts
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.ai_extraction_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extraction_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_extraction_drafts_select"
  ON public.ai_extraction_drafts
  FOR SELECT
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "ai_extraction_drafts_insert"
  ON public.ai_extraction_drafts
  FOR INSERT
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "ai_extraction_drafts_update"
  ON public.ai_extraction_drafts
  FOR UPDATE
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "ai_extraction_attempts_select"
  ON public.ai_extraction_attempts
  FOR SELECT
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "ai_extraction_attempts_insert"
  ON public.ai_extraction_attempts
  FOR INSERT
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- ============================================================
-- Retention cleanup policy
-- ============================================================

CREATE OR REPLACE FUNCTION private.cleanup_ai_extraction_retention()
RETURNS TABLE (deleted_attempts integer, deleted_drafts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_deleted_attempts integer := 0;
  v_deleted_drafts integer := 0;
BEGIN
  DELETE FROM public.ai_extraction_attempts
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted_attempts = ROW_COUNT;

  DELETE FROM public.ai_extraction_drafts
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted_drafts = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_attempts, v_deleted_drafts;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_ai_extraction_retention_cleanup()
RETURNS TABLE (deleted_attempts integer, deleted_drafts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT * FROM private.cleanup_ai_extraction_retention();
$$;

REVOKE ALL ON FUNCTION public.run_ai_extraction_retention_cleanup() FROM public;
GRANT EXECUTE ON FUNCTION public.run_ai_extraction_retention_cleanup() TO authenticated;
