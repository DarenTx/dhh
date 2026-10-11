ALTER TABLE public.leases
  DROP CONSTRAINT leases_status_check;

ALTER TABLE public.leases
  ADD CONSTRAINT leases_status_check
    CHECK (status IN ('active', 'expired', 'terminated'));

-- Migrate any existing rows that used 'inactive' to 'expired'
UPDATE public.leases SET status = 'expired' WHERE status = 'inactive';
