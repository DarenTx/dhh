-- Add name + avatar columns to user_roles and sync them automatically from
-- Google (and other) OAuth providers via a trigger on auth.users.
-- raw_user_meta_data fields used: given_name, family_name, full_name/name,
-- avatar_url/picture.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── Trigger function ──────────────────────────────────────────────────────────
-- Fires after INSERT or UPDATE on auth.users. Syncs OAuth profile fields to the
-- corresponding user_roles row (if one exists). Uses COALESCE so manually-set
-- values are overwritten only when the provider supplies a non-null replacement.
CREATE OR REPLACE FUNCTION private.sync_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_given_name  text;
  v_family_name text;
  v_avatar      text;
  v_full_name   text;
BEGIN
  v_given_name  := NEW.raw_user_meta_data->>'given_name';
  v_family_name := NEW.raw_user_meta_data->>'family_name';
  v_avatar      := COALESCE(
                     NEW.raw_user_meta_data->>'avatar_url',
                     NEW.raw_user_meta_data->>'picture'
                   );
  v_full_name   := COALESCE(
                     NEW.raw_user_meta_data->>'full_name',
                     NEW.raw_user_meta_data->>'name'
                   );

  UPDATE public.user_roles
  SET
    first_name = COALESCE(
                   v_given_name,
                   CASE WHEN v_full_name IS NOT NULL
                        THEN split_part(v_full_name, ' ', 1)
                        ELSE NULL END,
                   first_name
                 ),
    last_name  = COALESCE(
                   v_family_name,
                   CASE WHEN v_full_name IS NOT NULL AND position(' ' IN v_full_name) > 0
                        THEN trim(substring(v_full_name FROM position(' ' IN v_full_name) + 1))
                        ELSE NULL END,
                   last_name
                 ),
    avatar_url = COALESCE(v_avatar, avatar_url)
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Allow the trigger to write to public.user_roles
GRANT EXECUTE ON FUNCTION private.sync_user_metadata()
  TO supabase_auth_admin;

-- ── Trigger ───────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON auth.users;
CREATE TRIGGER sync_user_metadata_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.sync_user_metadata();
