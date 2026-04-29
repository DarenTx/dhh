-- Add performed_by_text to audit_log and populate it at write time.
-- Stores "First Last" when name data is available, falls back to email,
-- falls back to NULL (service_role / system operations).
-- Existing rows are backfilled best-effort from user_roles.

-- ── 1. Add column ─────────────────────────────────────────────────────────────

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS performed_by_text text;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────

UPDATE public.audit_log al
SET performed_by_text = CASE
  WHEN trim(COALESCE(ur.first_name, '') || ' ' || COALESCE(ur.last_name, '')) <> ''
    THEN trim(COALESCE(ur.first_name, '') || ' ' || COALESCE(ur.last_name, ''))
  ELSE ur.email
END
FROM public.user_roles ur
WHERE al.performed_by = ur.user_id;

-- ── 3. Update trigger to capture name at write time ───────────────────────────

CREATE OR REPLACE FUNCTION private.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id         text;
  v_old_data          jsonb;
  v_new_data          jsonb;
  v_pk_col            text := COALESCE(TG_ARGV[0], 'id');
  v_performed_by      uuid;
  v_performed_by_text text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_data  := to_jsonb(OLD);
    v_new_data  := NULL;
    v_record_id := v_old_data ->> v_pk_col;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data  := NULL;
    v_new_data  := to_jsonb(NEW);
    v_record_id := v_new_data ->> v_pk_col;
  ELSE -- UPDATE
    v_old_data  := to_jsonb(OLD);
    v_new_data  := to_jsonb(NEW);
    v_record_id := v_new_data ->> v_pk_col;
  END IF;

  v_performed_by := auth.uid();

  -- Resolve display name: "First Last" if available, else email, else NULL
  IF v_performed_by IS NOT NULL THEN
    SELECT
      CASE
        WHEN trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) <> ''
          THEN trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
        ELSE email
      END
    INTO v_performed_by_text
    FROM public.user_roles
    WHERE user_id = v_performed_by;
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    performed_by,
    performed_by_text
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_data,
    v_new_data,
    v_performed_by,
    v_performed_by_text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
