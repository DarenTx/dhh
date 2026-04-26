-- =============================================================================
-- Phase 4: Lease Documents
-- Storage: lease-documents bucket + policies
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lease-documents',
  'lease-documents',
  false,
  20971520,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "lease_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (select auth.role()) = 'authenticated'
  );

CREATE POLICY "lease_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "lease_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  )
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );

CREATE POLICY "lease_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );