-- =============================================================================
-- Phase 6: Documents
-- Tables: documents
-- Storage: documents bucket + policies
-- =============================================================================

-- ============================================================
-- Table
-- ============================================================

CREATE TABLE public.documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  description  text,
  property_id  uuid        REFERENCES public.properties(id) ON DELETE SET NULL,
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  is_active    boolean     NOT NULL DEFAULT true,
  deleted_at   timestamptz,
  deleted_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX documents_property_id_idx ON public.documents (property_id) WHERE is_active = true;
CREATE INDEX documents_uploaded_by_idx ON public.documents (uploaded_by);
CREATE INDEX documents_created_at_idx  ON public.documents (created_at DESC);
CREATE INDEX documents_is_active_idx   ON public.documents (is_active);

-- ============================================================
-- Triggers
-- ============================================================

CREATE TRIGGER set_updated_at_documents
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- All active authenticated users can read active document metadata
CREATE POLICY "documents_select"
  ON public.documents
  FOR SELECT
  USING (
    is_active = true
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- Only managers and admins can create documents
CREATE POLICY "documents_insert"
  ON public.documents
  FOR INSERT
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- Only managers and admins can update (metadata edits and soft-delete)
CREATE POLICY "documents_update"
  ON public.documents
  FOR UPDATE
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- Only managers and admins can hard-delete (24-hour window enforced in service layer)
CREATE POLICY "documents_delete"
  ON public.documents
  FOR DELETE
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- ============================================================
-- Extend ai_extraction_drafts flow_type check to include 'document'
-- ============================================================

ALTER TABLE public.ai_extraction_drafts
  DROP CONSTRAINT ai_extraction_drafts_flow_type_check;

ALTER TABLE public.ai_extraction_drafts
  ADD CONSTRAINT ai_extraction_drafts_flow_type_check
  CHECK (flow_type IN ('lease', 'expense', 'document'));

ALTER TABLE public.ai_extraction_attempts
  DROP CONSTRAINT ai_extraction_attempts_function_name_check;

ALTER TABLE public.ai_extraction_attempts
  ADD CONSTRAINT ai_extraction_attempts_function_name_check
  CHECK (function_name IN ('extract-lease', 'extract-expense', 'extract-document'));

-- ============================================================
-- Storage bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Only managers/admins can download document files (view_only sees metadata only)
CREATE POLICY "documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );
