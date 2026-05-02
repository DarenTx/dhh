# Inspection Wizard — Implementation Plan

## Overview

A full-featured mobile-first inspection system added as a new **Inspections tab** on the property detail page, with a full-screen wizard experience for capturing room-by-room photo inspections. Auto-saves as-you-go (`in_progress` → `completed`). Role-gated: managers/admins can create/edit/delete; view-only users see completed inspections read-only.

---

## Clarified Decisions

| Decision | Answer |
|---|---|
| Cover photo | User selects via ☆ star button on any photo |
| Actionable items | Simple resolve toggle; always togglable by managers regardless of age |
| Tags scope | Per canonical room type; one pool covers all numbered variants (e.g. `bedroom` covers `bedroom_1`, `bedroom_2`) |
| Wizard persistence | Auto-save; `in_progress` until explicitly ended |
| Inspection status | `in_progress` → `completed` |
| Photo metadata | Supabase only — no EXIF writing |
| View-only access | Tab visible; view-only sees `completed` inspections only, no write controls |
| Fractional bathrooms | Round up (2.5 → 3 bathrooms) |
| Concurrent inspections | **Not allowed** — one `in_progress` inspection per property at a time; enforced by partial unique index + UI guard |
| Multi-manager collaboration | All managers can join and contribute to the same in-progress inspection; `inspections.created_by` = starter; `inspection_photos.uploaded_by` = contributor |
| End inspection | Any contributing manager can end it |
| Real-time sync | Refresh-on-demand — room navigation re-loads photos; manual Refresh button on room header |
| Edit window — description/tags/actionable | Within 24h of `created_at` |
| Edit window — `is_resolved` | Always togglable by managers/admins |
| Hard delete | Within 48h of `created_at` |
| Soft delete | After 48h; sets `is_active = false` |
| Photo upload flow | One photo at a time (iOS `capture` + `multiple` incompatibility); tap camera → upload → card appears → repeat |

---

## Phase A — Database & Storage

### A1. Migration `supabase/migrations/20260502000000_phase7_inspections.sql`

Table creation order (FK dependencies first):

#### 1. `inspection_tags`
```sql
CREATE TABLE public.inspection_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type   text NOT NULL,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_type, name)
);
```

#### 2. `inspections`
```sql
CREATE TABLE public.inspections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lease_id         uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  title            text NOT NULL,
  inspection_type  text NOT NULL CHECK (inspection_type IN ('move_in', 'move_out', 'other')),
  status           text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  cover_photo_id   uuid,  -- FK added via ALTER after inspection_photos exists
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One active in_progress inspection per property at a time
CREATE UNIQUE INDEX uq_one_active_inspection
  ON public.inspections (property_id)
  WHERE is_active = true AND status = 'in_progress';
```

#### 3. `inspection_rooms`
```sql
CREATE TABLE public.inspection_rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  room_type      text NOT NULL,
  display_name   text NOT NULL,
  sort_order     integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, room_type)
);
```

#### 4. `inspection_photos`
```sql
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
```

#### 5. Add cover photo FK (deferred to avoid circular dependency)
```sql
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_cover_photo_id_fkey
  FOREIGN KEY (cover_photo_id)
  REFERENCES public.inspection_photos(id)
  ON DELETE SET NULL;
```

#### 6. `inspection_photo_tags`
```sql
CREATE TABLE public.inspection_photo_tags (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id  uuid NOT NULL REFERENCES public.inspection_photos(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES public.inspection_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, tag_id)
);
```

#### 7. RPC for atomic tag replacement (prevents race condition)
```sql
CREATE OR REPLACE FUNCTION public.set_photo_tags(p_photo_id uuid, p_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.inspection_photo_tags WHERE photo_id = p_photo_id;
  INSERT INTO public.inspection_photo_tags (photo_id, tag_id)
    SELECT p_photo_id, unnest(p_tag_ids);
END;
$$;
```

#### 8. Triggers
```sql
-- updated_at on inspections and inspection_photos
CREATE TRIGGER set_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER set_inspection_photos_updated_at
  BEFORE UPDATE ON public.inspection_photos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Audit triggers (skip rooms and photo_tags — too high-frequency)
CREATE TRIGGER audit_inspections
  AFTER INSERT OR UPDATE OR DELETE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');

CREATE TRIGGER audit_inspection_photos
  AFTER INSERT OR UPDATE OR DELETE ON public.inspection_photos
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');

CREATE TRIGGER audit_inspection_tags
  AFTER INSERT OR UPDATE OR DELETE ON public.inspection_tags
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_fn('id');
```

#### 9. RLS
```sql
-- Enable RLS on all tables
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photo_tags ENABLE ROW LEVEL SECURITY;

-- inspections: all authenticated read active; manager/admin write
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

-- inspection_rooms: all authenticated read; manager/admin write
CREATE POLICY "inspection_rooms_select" ON public.inspection_rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection_rooms_insert" ON public.inspection_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_photos: all authenticated read; manager/admin write
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

-- inspection_tags: all authenticated read; manager/admin write
CREATE POLICY "inspection_tags_select" ON public.inspection_tags
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "inspection_tags_insert" ON public.inspection_tags
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_tags_update" ON public.inspection_tags
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));

-- inspection_photo_tags: all authenticated read; manager/admin write
CREATE POLICY "inspection_photo_tags_select" ON public.inspection_photo_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection_photo_tags_insert" ON public.inspection_photo_tags
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
CREATE POLICY "inspection_photo_tags_delete" ON public.inspection_photo_tags
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'manager'));
```

#### 10. Storage bucket

Create bucket `inspection-photos` (private, JPEG/PNG/WEBP/HEIC, no size limit).
Storage path convention: `{propertyId}/{inspectionId}/{roomType}/{uuid}.jpg`

```sql
-- Storage RLS
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
```

#### 11. Seed `inspection_tags`

| `room_type` | Tags |
|---|---|
| `exterior_front` | Lawn condition, Landscaping, Driveway, Sidewalk, Curb appeal, Fencing, Lighting, Drainage, Mailbox |
| `exterior_left` | Siding, Foundation, Fencing, Gate, HVAC unit, Utility access, Drainage, Windows |
| `exterior_right` | Siding, Foundation, Fencing, Gate, HVAC unit, Utility access, Drainage, Windows |
| `exterior_back` | Patio/deck, Lawn, Fencing, Gate, Drainage, Storage, Landscaping, Lighting |
| `entryway` | Front door, Door lock, Doorbell, Flooring, Walls/paint, Lighting, Closet |
| `living_room` | Flooring, Walls/paint, Ceiling, Windows, Blinds, Outlets, Lighting, Fireplace, HVAC vent, Smoke detector |
| `kitchen` | Countertops, Cabinets, Sink/faucet, Refrigerator, Stove/oven, Dishwasher, Flooring, Plumbing, Lighting, Outlets |
| `utility_room` | Washer hookup, Dryer hookup, Water heater, HVAC/furnace, Electrical panel, Drainage, Carbon monoxide detector |
| `bedroom` | Flooring, Walls/paint, Ceiling, Windows, Closet, Outlets, Lighting, HVAC vent, Smoke detector, Door/lock |
| `bathroom` | Toilet, Sink/faucet, Shower/tub, Flooring, Tile/caulking, Ventilation fan, Plumbing, Outlets (GFCI), Mirrors, Vanity |
| `other` | General condition, Damage, Cleanliness, Safety concern, Structural, Electrical, Plumbing |

Note: `bedroom` and `bathroom` canonical types apply to all numbered variants (`bedroom_1`, `bedroom_2`, etc.).

---

## Room Generation Logic

Applied when the wizard starts; batch-inserts `inspection_rooms` rows:

```
sort 1:  exterior_front    → Exterior Front Yard
sort 2:  exterior_left     → Exterior Left Side
sort 3:  exterior_right    → Exterior Right Side
sort 4:  exterior_back     → Exterior Backyard
sort 5:  entryway          → Entryway
sort 6:  living_room       → Living Room
sort 7:  kitchen           → Kitchen
sort 8:  utility_room      → Utility Room
sort 9…(8+N):  bedroom_1…N → Bedroom 1…N  (bedrooms from property; null defaults to 2)
sort (9+N)…:   bathroom_1…M → Bathroom 1…M (bathrooms from property rounded up; null defaults to 1)
sort last:  other          → Other
```

If `property.bedrooms` or `property.bathrooms` is null, use defaults (2 / 1) and surface a warning in the wizard header: *"Bedroom/bathroom count not set on this property — using defaults."*

```typescript
export function canonicalType(roomType: string): string {
  const parts = roomType.split('_');
  return /^\d+$/.test(parts[parts.length - 1]) ? parts.slice(0, -1).join('_') : roomType;
}
// 'bedroom_3'     → 'bedroom'
// 'exterior_front'→ 'exterior_front'
```

---

## Phase B — TypeScript Interfaces & Services

### B1. `src/app/features/inspections/inspection.types.ts`

```typescript
export type InspectionType = 'move_in' | 'move_out' | 'other';
export type InspectionStatus = 'in_progress' | 'completed';

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  move_in: 'Move-In',
  move_out: 'Move-Out',
  other: 'Other',
};

export interface Inspection {
  id: string;
  property_id: string;
  lease_id: string | null;
  title: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  cover_photo_id: string | null;
  is_active: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionRoom {
  id: string;
  inspection_id: string;
  room_type: string;
  display_name: string;
  sort_order: number;
  created_at: string;
  photoCount?: number;  // populated client-side
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  room_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  description: string | null;
  is_actionable: boolean;
  is_resolved: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  signedUrl?: string;       // populated client-side
  tags?: InspectionTag[];   // populated client-side via join
}

export interface InspectionTag {
  id: string;
  room_type: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface InspectionWithRollup extends Inspection {
  photoCount: number;
  unresolvedActionableCount: number;  // is_actionable=true AND is_resolved=false
  coverPhotoUrl: string | null;       // signed URL, populated client-side
  rooms?: InspectionRoom[];
}

export function canonicalType(roomType: string): string {
  const parts = roomType.split('_');
  return /^\d+$/.test(parts[parts.length - 1]) ? parts.slice(0, -1).join('_') : roomType;
}

// Time window helpers (use created_at, never updated_at)
export function isWithin24h(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}
export function isWithin48h(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 48 * 60 * 60 * 1000;
}
```

### B2. `src/app/core/services/inspection.service.ts`

Key methods (all return `Observable<T>` wrapping `from(supabase.from(...).then(...))`):

- `getInspectionsForProperty(propertyId)` → `Observable<InspectionWithRollup[]>`
  - Selects `inspections` where `property_id = :id AND is_active = true`
  - Joins `inspection_photos(count)` and `inspection_photos(count).filter(is_actionable=true,is_resolved=false)` for unresolved count
  - Orders by `created_at DESC`
- `getInspection(id)` → `Observable<Inspection>` — single row
- `getInspectionWithRooms(id)` → `Observable<{ inspection: Inspection; rooms: InspectionRoom[] }>`
- `createInspection(propertyId, leaseId, title, type, bedrooms, bathrooms)` → `Observable<Inspection>`
  - Inserts inspection row
  - Calls `createRoomsForInspection()` in a follow-up call
  - Returns the created inspection
- `createRoomsForInspection(inspectionId, bedrooms, bathrooms)` → `Observable<void>`
  - Batch-inserts all rooms; uses `INSERT ... ON CONFLICT (inspection_id, room_type) DO NOTHING`
- `updateInspection(id, patch: Partial<Pick<Inspection, 'title' | 'inspection_type' | 'cover_photo_id'>>)` → `Observable<Inspection>`
- `endInspection(id)` → `Observable<void>` — sets `status = 'completed'`
- `setCoverPhoto(inspectionId, photoId)` → `Observable<void>` — updates `cover_photo_id`
- `softDeleteInspection(id, deletedBy)` → `Observable<void>` — sets `is_active = false`, `deleted_at = now()`, `deleted_by`
- `hardDeleteInspection(id)` → see note: service fetches all photo `storage_path`s first, deletes from storage bucket, then deletes the inspection row (cascade handles rooms/photos/photo_tags in DB)

### B3. `src/app/core/services/inspection-photo.service.ts`

Key methods:

- `getPhotosForRoom(roomId)` → `Observable<InspectionPhoto[]>` — joins `inspection_photo_tags → inspection_tags`, orders by `created_at ASC`
- `addPhoto(data: { inspection_id, room_id, storage_path, file_name, uploaded_by })` → `Observable<InspectionPhoto>`
- `updatePhoto(id, patch: Partial<Pick<InspectionPhoto, 'description' | 'is_actionable' | 'is_resolved'>>)` → `Observable<void>`
- `deletePhoto(id, storagePath)` → `Observable<void>` — deletes from storage bucket first, then DB row
- `setTags(photoId, tagIds)` → `Observable<void>` — calls `.rpc('set_photo_tags', { p_photo_id: photoId, p_tag_ids: tagIds })`
- `getTagsForRoomType(canonicalRoomType)` → `Observable<InspectionTag[]>` — active tags for canonical type
- `getSignedUrl(storagePath)` → `Observable<string>` — 1h expiry
- `getSignedUrls(storagePaths)` → `Observable<string[]>` — batch signed URL call (Supabase `createSignedUrls`)

### B4. `src/app/core/services/inspection-storage.service.ts`

- `uploadPhoto(propertyId, inspectionId, roomType, file)` → `Observable<{ storagePath: string; fileName: string }>`
  - Client-side compress: canvas resize to max 1920px, quality 0.85, output `image/jpeg` (converts HEIC on iOS Safari)
  - Path: `{propertyId}/{inspectionId}/{roomType}/{uuid}.jpg`
  - Uploads to `inspection-photos` bucket
  - Always stores `mime_type = 'image/jpeg'` regardless of input format
- `deletePhoto(storagePath)` → `Observable<void>`
- `getSignedUrl(storagePath, expirySeconds = 3600)` → `Observable<string>`
- `getSignedUrls(storagePaths, expirySeconds = 3600)` → `Observable<string[]>`

### B5. Updates to `src/app/core/services/settings.service.ts`

Add interfaces and methods:

```typescript
export interface InspectionTag {
  id: string;
  room_type: string;
  name: string;
  is_active: boolean;
  created_at: string;
}
```

- `getInspectionTags()` → `Observable<InspectionTag[]>` — all active, ordered by `room_type, name`
- `addInspectionTag(roomType: string, name: string)` → `Observable<InspectionTag>`
- `disableInspectionTag(id: string)` → `Observable<void>` — sets `is_active = false`

---

## Phase C — Settings Page

Update `src/app/features/settings/settings-page.ts`:

Add a new **"Inspection Photo Tags"** section below existing sections:

- `inspectionTags = signal<Record<string, InspectionTag[]>>({})` — grouped by `room_type` client-side after load
- `expandedInspectionGroup = signal<string | null>(null)` — separate from existing `expandedCategory`
- `newInspectionTagName = ''` — per-group new tag input (or use a map signal)
- `loadInspectionTags()` called in `ngOnInit`

Room type group headers (human-readable, matches canonical key):

| Canonical key | Header label |
|---|---|
| `exterior_front` | Exterior Front Yard |
| `exterior_left` | Exterior Left Side |
| `exterior_right` | Exterior Right Side |
| `exterior_back` | Exterior Backyard |
| `entryway` | Entryway |
| `living_room` | Living Room |
| `kitchen` | Kitchen |
| `utility_room` | Utility Room |
| `bedroom` | Bedroom *(all numbered)* |
| `bathroom` | Bathroom *(all numbered)* |
| `other` | Other |

Accordion pattern: tap group header → expand; list active tags + "Disable" button each; inline "Add tag" text input + button at bottom of expanded group.

---

## Phase D — Inspections Tab (list view)

### D1. `src/app/features/inspections/inspections-tab/inspections-tab.component.ts`

Signal inputs: `propertyId = input.required<string>()`, `canManage = input<boolean>(false)`

State:
- `inspections = signal<InspectionWithRollup[]>([])`
- `loading = signal(true)`
- `showSetupModal = signal(false)`
- `activeInspection = computed(() => this.inspections().find(i => i.status === 'in_progress') ?? null)`

On load: `InspectionService.getInspectionsForProperty(propertyId())` → load all, generate signed cover photo URLs via batch `getSignedUrls()`.

**Setup modal** (inline, shown only when `!activeInspection() && canManage()`):
- Title input, default: current month + year (e.g. `"May 2026"`)
- Inspection type button group: Move-In / Move-Out / Other
- "Start Inspection" button → `createInspection()` → navigate to wizard route
- On unique constraint error: show *"An inspection is already in progress for this property."*

**Inspection cards** (completed first, then in_progress):
- Cover photo thumbnail (placeholder icon if none)
- Title + inspection type badge
- Status badge: amber `In Progress` / green `Completed`
- Date, tenants (from linked lease, loaded via join or separate call)
- Photo count chip, unresolved actionable count chip (red, hidden if zero)
- Tap card → navigate to `/properties/:propertyId/inspections/:inspectionId`

**Action buttons** (canManage only, shown per card):
- In-progress card: "Join / Continue" CTA (prominent)
- Within 48h: "Delete" (hard) with confirmation dialog
- After 48h: "Archive" (soft delete) with confirmation
- "Start New Inspection" FAB: hidden when `activeInspection()` exists

### D2. Updates to `src/app/features/properties/property-detail/property-detail-page.ts`

- Add `'inspections'` to `TabId` union type
- Add `{ id: 'inspections', label: 'Inspections' }` to `TABS` (no `managerOnly` — visible to view-only)
- Add `@case ('inspections')` rendering `<app-inspections-tab [propertyId]="property()!.id" [canManage]="isManagerOrAbove()" />`
- Add `?tab=` query param read in `ngOnInit`:
  ```typescript
  const tab = this.route.snapshot.queryParamMap.get('tab') as TabId | null;
  if (tab && TABS.some(t => t.id === tab)) this.activeTab.set(tab);
  ```

---

## Phase E — Wizard Route & Components

### E1. New route in `src/app/app.routes.ts`

```typescript
{
  path: 'properties/:propertyId/inspections/:inspectionId',
  loadComponent: () =>
    import('./features/inspections/inspection-page/inspection-page.component')
      .then(m => m.InspectionPageComponent),
  canActivate: [authGuard],
}
```

(authGuard only — view_only may view completed inspections.)

### E2. `src/app/features/inspections/inspection-page/inspection-page.component.ts`

Smart container. Reads `propertyId` and `inspectionId` from route params. Loads:
- Inspection + rooms via `InspectionService.getInspectionWithRooms()`
- Property (for address display) via `PropertyService.getProperty()`
- Active lease tenants (if `lease_id` is set)

`computed(() => inspection().status === 'in_progress' && canManage())` → shows `<app-inspection-wizard>` or `<app-inspection-detail>`.

Back navigation → `/properties/:propertyId?tab=inspections`.

### E3. `src/app/features/inspections/inspection-wizard/inspection-wizard.component.ts`

Signal inputs: `inspection = input.required<Inspection>()`, `property = input.required<Property>()`, `rooms = input.required<InspectionRoom[]>()`, `canManage = input<boolean>(false)`

Emits: `ended = output<void>()`

State:
- `activeRoomIndex = signal(0)`
- `activeRoom = computed(() => this.rooms()[this.activeRoomIndex()])`

Layout (full-viewport, phone-first):

```
┌─────────────────────────────────────────────┐
│ ← Back │ May 2026 — Move-In   │ End ✓       │  ← top bar
├─────────────────────────────────────────────┤
│ [Front Yard] [Left] [Kitchen] [Bedroom 1]…  │  ← scrollable room chips
│ (active chip highlighted, photo count badge) │
├─────────────────────────────────────────────┤
│                                             │
│     <app-photo-capture [room] [inspection]> │  ← scrollable content
│                                             │
├─────────────────────────────────────────────┤
│ ← Prev Room  │  Room 3 of 12  │  Next Room → │  ← room footer nav
└─────────────────────────────────────────────┘
```

- Room chip nav: horizontal `overflow-x: auto`, active chip distinct color; tapping any chip jumps directly
- Photo count badge per chip: derived from room refresh events
- Swipe on content area navigates rooms (touch event listeners)
- "End Inspection" tapped → confirm dialog: *"End this inspection? [count] photos captured."* → `InspectionService.endInspection(id)` → `ended.emit()`
- If 0 photos: confirm shows warning: *"This inspection has no photos. End it anyway?"*

### E4. `src/app/features/inspections/inspection-wizard/photo-capture/photo-capture.component.ts`

Signal inputs: `room = input.required<InspectionRoom>()`, `inspection = input.required<Inspection>()`

State:
- `photos = signal<InspectionPhoto[]>([])`
- `uploading = signal(false)`
- `uploadError = signal<string | null>(null)`
- `tags = toSignal(this.photoService.getTagsForRoomType(canonicalType(this.room().room_type)))`

Loads photos on `ngOnInit` and on room change via `effect(() => this.loadPhotos(this.room().id))`.

**Camera button** (top of room, prominent):
```html
<label class="camera-btn">
  <input
    type="file"
    accept="image/*"
    capture="environment"
    (change)="onPhotoSelected($event)"
  />
  <ng-icon name="heroCamera" size="32" />
  <span>Take Photo</span>
</label>
```
Single file only (no `multiple` — required for iOS compatibility with `capture`).

On photo selected:
1. Compress via canvas (max 1920px, 0.85 quality, output JPEG)
2. `InspectionStorageService.uploadPhoto()` → get `storagePath`
3. `InspectionPhotoService.addPhoto()` → insert DB row
4. Refresh `photos` signal
5. New photo card appears at bottom with focus on description field

**Photo cards** (one per photo, stacked below camera button):

```
┌─────────────────────────────────────────────┐
│ [thumbnail]  ☆ Cover  🗑 Delete (24h only)  │
├─────────────────────────────────────────────┤
│ [description textarea — auto-save on blur]  │
├─────────────────────────────────────────────┤
│ ⚑ Mark for action  [resolved toggle 24h+]  │
├─────────────────────────────────────────────┤
│ Tags: [tag chip] [tag chip] [+ more chips]  │
└─────────────────────────────────────────────┘
```

- Description: debounced 800ms OR on blur → `updatePhoto(id, { description })`
- Actionable toggle: immediate save → `updatePhoto(id, { is_actionable })`
- `is_resolved` toggle: always visible if `is_actionable = true`; always editable by managers regardless of age
- Tags: chip row for available tags; tap toggles selected state; on change → `setTags(photoId, selectedTagIds)` (RPC, atomic)
- ☆ Cover: tapping sets as inspection cover → `InspectionService.setCoverPhoto()`; filled star if currently the cover
- Delete (🗑): visible only within 24h of `created_at`; on confirm → delete from storage + DB → refresh photos
- **Refresh button** in room header: manual pull to re-load photos from DB (for multi-manager collaboration)

---

## Phase F — Inspection Detail (read-only / completed view)

### F1. `src/app/features/inspections/inspection-detail/inspection-detail.component.ts`

Signal inputs: `inspection = input.required<Inspection>()`, `property = input.required<Property>()`, `rooms = input.required<InspectionRoom[]>()`, `canManage = input<boolean>(false)`

Loaded in `InspectionPageComponent` — all photos loaded up front grouped by room.

Layout:
- **Cover photo hero** (full-width, aspect-ratio 4:3; placeholder icon if none)
- **Header card**: title, type badge, status badge, date, property address
- **Lease section** (if `lease_id`): tenant names; lease date range
- **Unresolved Action Items section** (prominent, shown only if `unresolvedActionableCount > 0`):
  - Each actionable photo: thumbnail, description, room name, resolve toggle (canManage only, always enabled per policy)
- **Rooms accordion**: each room collapsible; photo count chip on header
  - Photo grid (2-col): thumbnail, description, tag chips, actionable badge if flagged
- **Edit button** in header: shown if `canManage && isWithin24h(inspection.created_at)`
  - Tapping sets `inspection.status = 'in_progress'` via `updateInspection()` → `InspectionPageComponent` re-routes to wizard

---

## Phase G — Audit Page Updates

Update `src/app/features/audit/audit-page.ts`:

### describeAuditRow additions

```typescript
case 'inspections':
  if (op === 'INSERT') return `Started inspection "${new_data?.['title']}" (${labelType(new_data?.['inspection_type'])})`;
  if (op === 'UPDATE') {
    if (new_data?.['status'] === 'completed') return `Completed inspection "${new_data?.['title']}"`;
    if (!new_data?.['is_active']) return `Archived inspection "${old_data?.['title']}"`;
    return `Updated inspection "${new_data?.['title']}"`;
  }
  if (op === 'DELETE') return `Deleted inspection "${old_data?.['title']}"`;
  break;

case 'inspection_photos':
  if (op === 'INSERT') return `Photo added to inspection`;
  if (op === 'UPDATE') {
    if (new_data?.['is_resolved'] !== old_data?.['is_resolved'])
      return `Action item ${new_data?.['is_resolved'] ? 'resolved' : 'reopened'}`;
    return `Photo updated`;
  }
  if (op === 'DELETE') return `Photo removed from inspection`;
  break;

case 'inspection_tags':
  if (op === 'INSERT') return `Added tag "${new_data?.['name']}" for ${new_data?.['room_type']} rooms`;
  if (op === 'UPDATE') return `Updated tag "${new_data?.['name'] ?? old_data?.['name']}"`;
  if (op === 'DELETE') return `Removed tag "${old_data?.['name']}"`;
  break;
```

### Filter exclusions

Add to the `.neq('table_name', ...)` chain:
```typescript
.neq('table_name', 'inspection_rooms')
.neq('table_name', 'inspection_photo_tags')
```

---

## Time Window Rules (enforced in application layer, not RLS)

| Action | Condition | Helper |
|---|---|---|
| Add / delete photos | `canManage && isWithin24h(inspection.created_at)` | `isWithin24h()` |
| Edit description, tags, is_actionable | `canManage && isWithin24h(inspection.created_at)` | `isWithin24h()` |
| Toggle `is_resolved` | `canManage` — **always** | — |
| Re-open (completed → in_progress) | `canManage && isWithin24h(inspection.created_at)` | `isWithin24h()` |
| Hard delete inspection | `canManage && isWithin48h(inspection.created_at)` | `isWithin48h()` |
| Soft delete inspection | `canManage && !isWithin48h(inspection.created_at)` | `isWithin48h()` |

All checks use `created_at`, never `updated_at`.

---

## Identified Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Storage orphan files on hard delete | Service fetches all `storage_path` values → bulk-deletes from bucket → then deletes DB row (cascade handles rest) |
| 2 | `capture` + `multiple` silently broken on iOS | Removed `multiple`; one-photo-at-a-time flow is the explicit design |
| 3 | `setTags()` race condition | Postgres RPC `set_photo_tags` runs DELETE + INSERT in a single transaction |
| 4 | Duplicate rooms on network retry | `UNIQUE (inspection_id, room_type)` + `INSERT ... ON CONFLICT DO NOTHING` |
| 5 | Back-navigation loses Inspections tab | `?tab=inspections` query param added to property detail page; wizard back/end routes use it |
| 6 | Actionable badge counts resolved items | Count is `is_actionable=true AND is_resolved=false` only |
| 7 | Multiple managers race to start an inspection | Partial unique index `uq_one_active_inspection`; app surfaces constraint error as friendly message |
| 8 | N+1 signed URL calls for list thumbnails | Batch `createSignedUrls()` call in `InspectionStorageService` |
| 9 | HEIC → JPEG mime_type mismatch | Always store `image/jpeg` after canvas compression; original type irrelevant |
| 10 | Circular FK (cover_photo_id) | FK added via `ALTER TABLE` after photos table exists; `ON DELETE SET NULL` prevents orphan |
| 11 | Null bedrooms/bathrooms on property | Default 2 / 1; wizard header shows notice to user |

---

## New Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260502000000_phase7_inspections.sql` | All DB schema, RLS, RPC, triggers, seeds |
| `src/app/features/inspections/inspection.types.ts` | Interfaces, constants, helpers |
| `src/app/core/services/inspection.service.ts` | Inspection CRUD |
| `src/app/core/services/inspection-photo.service.ts` | Photo + tag CRUD |
| `src/app/core/services/inspection-storage.service.ts` | Storage bucket operations + compression |
| `src/app/features/inspections/inspection-page/inspection-page.component.ts` | Smart container (route target) |
| `src/app/features/inspections/inspections-tab/inspections-tab.component.ts` | List view + setup modal |
| `src/app/features/inspections/inspection-wizard/inspection-wizard.component.ts` | Wizard shell with room nav |
| `src/app/features/inspections/inspection-wizard/photo-capture/photo-capture.component.ts` | Per-room photo capture flow |
| `src/app/features/inspections/inspection-detail/inspection-detail.component.ts` | Read-only completed view |

## Modified Files

| File | Change |
|---|---|
| `src/app/app.routes.ts` | Add inspection page route |
| `src/app/features/properties/property-detail/property-detail-page.ts` | Add Inspections tab + `?tab=` query param read |
| `src/app/core/services/settings.service.ts` | Add `InspectionTag` CRUD methods |
| `src/app/features/settings/settings-page.ts` | Add Inspection Photo Tags accordion section |
| `src/app/features/audit/audit-page.ts` | Add inspection audit descriptions + filter exclusions |
