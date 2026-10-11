-- Rename is_actionable to is_flagged and drop is_resolved
ALTER TABLE inspection_photos
  RENAME COLUMN is_actionable TO is_flagged;

ALTER TABLE inspection_photos
  DROP COLUMN is_resolved;

-- Clear any existing flag state so no stale data carries over
UPDATE inspection_photos SET is_flagged = false WHERE is_flagged = true;
