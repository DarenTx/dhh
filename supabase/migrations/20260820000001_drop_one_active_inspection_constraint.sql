-- Multiple inspections can now be active simultaneously; remove the one-per-property restriction
DROP INDEX IF EXISTS public.uq_one_active_inspection;
