-- Fix: documents soft-delete (UPDATE is_active=false) fails in Postgres 17 because
-- the new row no longer satisfies the documents_select policy (is_active = true),
-- and Postgres raises "new row violates row-level security policy".
--
-- Solution: add a permissive SELECT policy that allows managers/admins to see ALL
-- documents regardless of is_active. Policies are OR'd (permissive), so after a
-- soft-delete the updated row is still visible to the manager, satisfying Postgres.
-- The app always queries with .eq('is_active', true), so inactive rows never surface
-- in the UI.

CREATE POLICY "documents_select_manager"
  ON public.documents
  FOR SELECT
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'is_active')::boolean = true
  );
