-- =============================================================================
-- document_files: stores individual file attachments for a document record.
-- A document may have one PDF or one-or-more images.
-- =============================================================================

CREATE TABLE public.document_files (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  original_name text        NOT NULL,
  content_type  text        NOT NULL,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_files_document_id_idx ON public.document_files (document_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

-- All active authenticated users can read file metadata
CREATE POLICY "document_files_select"
  ON public.document_files
  FOR SELECT
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- Only managers and admins can attach files
CREATE POLICY "document_files_insert"
  ON public.document_files
  FOR INSERT
  WITH CHECK (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

-- Only managers and admins can remove file records
CREATE POLICY "document_files_delete"
  ON public.document_files
  FOR DELETE
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );
