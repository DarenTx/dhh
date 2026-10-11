-- deleted_at and deleted_by were only set by the soft-delete path, which is removed.
-- Documents are now always hard-deleted; these columns are dead.
ALTER TABLE public.documents
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;
