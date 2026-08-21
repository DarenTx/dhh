-- Property-level custom room templates — remembered across inspections for the same property

CREATE TABLE public.property_room_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, display_name)
);

ALTER TABLE public.property_room_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_room_templates_select" ON public.property_room_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "property_room_templates_insert" ON public.property_room_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
