-- Fix set_photo_tags: pin search_path, revoke anon execute, add role guard
CREATE OR REPLACE FUNCTION public.set_photo_tags(p_photo_id uuid, p_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admin/manager may modify photo tags
  IF ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.inspection_photo_tags WHERE photo_id = p_photo_id;
  IF array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO public.inspection_photo_tags (photo_id, tag_id)
      SELECT p_photo_id, unnest(p_tag_ids);
  END IF;
END;
$$;

-- Revoke execute from anon; authenticated callers are role-checked inside the function
REVOKE EXECUTE ON FUNCTION public.set_photo_tags(uuid, uuid[]) FROM anon;
