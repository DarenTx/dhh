-- Migrate existing rows before changing the constraint
UPDATE public.leases SET status = 'inactive' WHERE status IN ('expired', 'terminated');

-- Replace constraint
ALTER TABLE public.leases DROP CONSTRAINT leases_status_check;
ALTER TABLE public.leases ADD CONSTRAINT leases_status_check
  CHECK (status IN ('active', 'inactive'));
