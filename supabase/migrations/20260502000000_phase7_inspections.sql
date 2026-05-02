-- Phase 7: Inspection Wizard
-- Tables: inspection_tags, inspections, inspection_rooms, inspection_photos, inspection_photo_tags
-- RPC: set_photo_tags (atomic tag replacement)
-- Storage bucket: inspection-photos

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. inspection_tags  (configurable per canonical room type, editable in Settings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inspection_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type   text NOT NULL,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_type, name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. inspections
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inspections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lease_id         uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  title            text NOT NULL,
  inspection_type  text NOT NULL CHECK (inspection_type IN ('move_in', 'move_out', 'other')),
  status           text NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'completed')),
  cover_photo_id   uuid,  -- FK added via ALTER after inspection_photos exists
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Enforce: only one in_progress inspection per property at a time
CREATE UNIQUE INDEX uq_one_active_inspection
  ON public.inspections (property_id)
  WHERE is_active = true AND status = 'in_progress';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. inspection_rooms  (generated once at wizard start; never edited)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inspection_rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  room_type      text NOT NULL,
  display_name   text NOT NULL,
  sort_order     integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, room_type)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. inspection_photos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inspection_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  room_id        uuid NOT NULL REFERENCES public.inspection_rooms(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  file_name      text NOT NULL,
  mime_type      text NOT NULL DEFAULT 'image/jpeg',
  description    text,
  is_actionable  boolean NOT NULL DEFAULT false,
  is_resolved    boolean NOT NULL DEFAULT false,
  uploaded_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add cover photo FK (deferred — avoids circular dependency)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_cover_photo_id_fkey
  FOREIGN KEY (cover_photo_id)
  REFERENCES public.inspection_photos(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. inspection_photo_tags  (many-to-many: photos ↔ tags)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inspection_photo_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   uuid NOT NULL REFERENCES public.inspection_photos(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.inspection_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: atomic tag replacement (prevents race condition on rapid tag toggling)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_photo_tags(p_photo_id uuid, p_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.inspection_photo_tags WHERE photo_id = p_photo_id;
  IF array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO public.inspection_photo_tags (photo_id, tag_id)
      SELECT p_photo_id, unnest(p_tag_ids);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Triggers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER set_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER set_inspection_photos_updated_at
  BEFORE UPDATE ON public.inspection_photos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Audit triggers (skip rooms and photo_tags — too high-frequency / low value)
CREATE TRIGGER audit_inspections
  AFTER INSERT OR UPDATE OR DELETE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');

CREATE TRIGGER audit_inspection_photos
  AFTER INSERT OR UPDATE OR DELETE ON public.inspection_photos
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');

CREATE TRIGGER audit_inspection_tags
  AFTER INSERT OR UPDATE OR DELETE ON public.inspection_tags
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photo_tags ENABLE ROW LEVEL SECURITY;

-- inspections
CREATE POLICY "inspections_select" ON public.inspections
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "inspections_insert" ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspections_update" ON public.inspections
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspections_delete" ON public.inspections
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_rooms (read-only after creation)
CREATE POLICY "inspection_rooms_select" ON public.inspection_rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection_rooms_insert" ON public.inspection_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_photos
CREATE POLICY "inspection_photos_select" ON public.inspection_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection_photos_insert" ON public.inspection_photos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_photos_update" ON public.inspection_photos
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_photos_delete" ON public.inspection_photos
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_tags
CREATE POLICY "inspection_tags_select" ON public.inspection_tags
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "inspection_tags_insert" ON public.inspection_tags
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_tags_update" ON public.inspection_tags
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_photo_tags
CREATE POLICY "inspection_photo_tags_select" ON public.inspection_photo_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection_photo_tags_insert" ON public.inspection_photo_tags
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_photo_tags_delete" ON public.inspection_photo_tags
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Storage bucket RLS  (bucket must be created via dashboard or CLI)
--     Bucket name: inspection-photos  (private, no size limit, jpeg/png/webp/heic)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "inspection_photos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos');

CREATE POLICY "inspection_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "inspection_photos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Seed inspection_tags
--     canonical room_type keys map to numbered variants via canonicalType() helper
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.inspection_tags (room_type, name) VALUES
  -- Exterior Front Yard
  ('exterior_front', 'Lawn condition'),
  ('exterior_front', 'Landscaping'),
  ('exterior_front', 'Driveway'),
  ('exterior_front', 'Sidewalk'),
  ('exterior_front', 'Curb appeal'),
  ('exterior_front', 'Fencing'),
  ('exterior_front', 'Lighting'),
  ('exterior_front', 'Drainage'),
  ('exterior_front', 'Mailbox'),

  -- Exterior Left Side
  ('exterior_left', 'Siding'),
  ('exterior_left', 'Foundation'),
  ('exterior_left', 'Fencing'),
  ('exterior_left', 'Gate'),
  ('exterior_left', 'HVAC unit'),
  ('exterior_left', 'Utility access'),
  ('exterior_left', 'Drainage'),
  ('exterior_left', 'Windows'),

  -- Exterior Right Side
  ('exterior_right', 'Siding'),
  ('exterior_right', 'Foundation'),
  ('exterior_right', 'Fencing'),
  ('exterior_right', 'Gate'),
  ('exterior_right', 'HVAC unit'),
  ('exterior_right', 'Utility access'),
  ('exterior_right', 'Drainage'),
  ('exterior_right', 'Windows'),

  -- Exterior Backyard
  ('exterior_back', 'Patio/deck'),
  ('exterior_back', 'Lawn'),
  ('exterior_back', 'Fencing'),
  ('exterior_back', 'Gate'),
  ('exterior_back', 'Drainage'),
  ('exterior_back', 'Storage'),
  ('exterior_back', 'Landscaping'),
  ('exterior_back', 'Lighting'),

  -- Entryway
  ('entryway', 'Front door'),
  ('entryway', 'Door lock'),
  ('entryway', 'Doorbell'),
  ('entryway', 'Flooring'),
  ('entryway', 'Walls/paint'),
  ('entryway', 'Lighting'),
  ('entryway', 'Closet'),

  -- Living Room
  ('living_room', 'Flooring'),
  ('living_room', 'Walls/paint'),
  ('living_room', 'Ceiling'),
  ('living_room', 'Windows'),
  ('living_room', 'Blinds'),
  ('living_room', 'Outlets'),
  ('living_room', 'Lighting'),
  ('living_room', 'Fireplace'),
  ('living_room', 'HVAC vent'),
  ('living_room', 'Smoke detector'),

  -- Kitchen
  ('kitchen', 'Countertops'),
  ('kitchen', 'Cabinets'),
  ('kitchen', 'Sink/faucet'),
  ('kitchen', 'Refrigerator'),
  ('kitchen', 'Stove/oven'),
  ('kitchen', 'Dishwasher'),
  ('kitchen', 'Flooring'),
  ('kitchen', 'Plumbing'),
  ('kitchen', 'Lighting'),
  ('kitchen', 'Outlets'),

  -- Utility Room
  ('utility_room', 'Washer hookup'),
  ('utility_room', 'Dryer hookup'),
  ('utility_room', 'Water heater'),
  ('utility_room', 'HVAC/furnace'),
  ('utility_room', 'Electrical panel'),
  ('utility_room', 'Drainage'),
  ('utility_room', 'Carbon monoxide detector'),

  -- Bedroom (applies to bedroom_1, bedroom_2, etc. via canonicalType())
  ('bedroom', 'Flooring'),
  ('bedroom', 'Walls/paint'),
  ('bedroom', 'Ceiling'),
  ('bedroom', 'Windows'),
  ('bedroom', 'Closet'),
  ('bedroom', 'Outlets'),
  ('bedroom', 'Lighting'),
  ('bedroom', 'HVAC vent'),
  ('bedroom', 'Smoke detector'),
  ('bedroom', 'Door/lock'),

  -- Bathroom (applies to bathroom_1, bathroom_2, etc. via canonicalType())
  ('bathroom', 'Toilet'),
  ('bathroom', 'Sink/faucet'),
  ('bathroom', 'Shower/tub'),
  ('bathroom', 'Flooring'),
  ('bathroom', 'Tile/caulking'),
  ('bathroom', 'Ventilation fan'),
  ('bathroom', 'Plumbing'),
  ('bathroom', 'Outlets (GFCI)'),
  ('bathroom', 'Mirrors'),
  ('bathroom', 'Vanity'),

  -- Other
  ('other', 'General condition'),
  ('other', 'Damage'),
  ('other', 'Cleanliness'),
  ('other', 'Safety concern'),
  ('other', 'Structural'),
  ('other', 'Electrical'),
  ('other', 'Plumbing');
