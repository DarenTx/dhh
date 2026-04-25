# Phase 2: Core Property Data — Implementation Plan

## Overview

Build the Properties, Tenants, Leases, Notes, and Dashboard features. This phase delivers the core data model of the application: a Supabase migration creating 5 new tables (plus seed data), 5 Angular services, a card-based properties list, a tabbed property detail page, a 3-step New Tenancy Wizard, a standalone Tenants list/detail, and a real Dashboard replacing the stub Home component.

---

## Decisions

| Topic                   | Decision                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Notes                   | Shared `notes` table; no `notes` column on properties/tenants/leases; soft-deleted only (never hard deleted); no editing after creation |
| Note permissions        | All authenticated users can create; Admins/Managers can deactivate any note                                                             |
| Cover photos            | Private Supabase Storage bucket `property-photos`; `cover_photo_url` stores the storage path; signed URLs generated at query time       |
| New property flow       | UUID generated client-side on form open; photo uploaded with that UUID as path prefix before INSERT                                     |
| State field             | US dropdown, default `OK`; constant in `src/app/shared/constants/us-states.ts`                                                          |
| Bathrooms               | Dropdown: 1, 1.5, 2, 2.5, 3                                                                                                             |
| Lease deactivation      | Both explicit "Deactivate" quick-action button AND editable `status` field via edit form                                                |
| `document_url`          | Text field on `leases` for a Google Drive link; manual entry in Phase 2; full Drive picker in Phase 4                                   |
| Active lease rule       | Partial unique index `ON leases (property_id) WHERE status = 'active' AND is_active = true`                                             |
| Lease start/end         | Informational only; `status` drives active/inactive logic                                                                               |
| Soft delete             | `is_active` on properties, tenants, notes; `status` + `is_active` on leases                                                             |
| New Tenancy Wizard      | 3-step stepper from unoccupied property Overview tab                                                                                    |
| "Recent"                | Last 4 weeks                                                                                                                            |
| Pending approvals count | Current user's pending items only                                                                                                       |
| Tenants nav             | Dedicated nav item visible to all roles; between Properties and Expenses                                                                |
| Tenant PII              | Phone and email hidden from View Only users                                                                                             |
| Dashboard               | All active properties (full grid)                                                                                                       |
| Properties sort         | By `address_line1` ascending                                                                                                            |
| `updated_at` trigger    | Reuse `private.set_updated_at()` (created in Phase 1) — do NOT recreate                                                                 |
| Seed data               | 13 properties, city=Yukon, state=OK, zip=73099; sq_footage from CSV                                                                     |
| Old Home component      | Deleted in Phase I; DashboardPage at `/dashboard` replaces it                                                                           |

---

## Database Schema

### `properties`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
address_line1   text NOT NULL
address_line2   text
city            text
state           varchar(2) DEFAULT 'OK'
zip             text
year_built      integer
square_footage  integer
bedrooms        integer
bathrooms       numeric(3,1)
cover_photo_url text          -- storage path, e.g. '{uuid}/cover.jpg'
is_active       boolean NOT NULL DEFAULT true
created_by      uuid REFERENCES auth.users
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

### `tenants`

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
first_name  text NOT NULL
last_name   text NOT NULL
phone       text
email       text
is_active   boolean NOT NULL DEFAULT true
created_by  uuid REFERENCES auth.users
created_at  timestamptz NOT NULL DEFAULT now()
updated_at  timestamptz NOT NULL DEFAULT now()
```

### `leases`

```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
property_id       uuid NOT NULL REFERENCES properties
start_date        date NOT NULL
end_date          date
monthly_rent      numeric(10,2) NOT NULL
security_deposit  numeric(10,2) NOT NULL
document_url      text
status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
is_active         boolean NOT NULL DEFAULT true
created_by        uuid REFERENCES auth.users
created_at        timestamptz NOT NULL DEFAULT now()
updated_at        timestamptz NOT NULL DEFAULT now()
```

### `lease_tenants` (junction)

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
lease_id    uuid NOT NULL REFERENCES leases ON DELETE CASCADE
tenant_id   uuid NOT NULL REFERENCES tenants
UNIQUE (lease_id, tenant_id)
created_at  timestamptz NOT NULL DEFAULT now()
```

### `notes`

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
property_id  uuid REFERENCES properties
tenant_id    uuid REFERENCES tenants
lease_id     uuid REFERENCES leases
content      text NOT NULL
is_active    boolean NOT NULL DEFAULT true
created_by   uuid REFERENCES auth.users
created_at   timestamptz NOT NULL DEFAULT now()
updated_at   timestamptz NOT NULL DEFAULT now()
CONSTRAINT exactly_one_parent CHECK (
  (CASE WHEN property_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN tenant_id   IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN lease_id    IS NOT NULL THEN 1 ELSE 0 END) = 1
)
```

### Key Constraints and Indexes

- Partial unique index: `CREATE UNIQUE INDEX uq_one_active_lease ON leases (property_id) WHERE status = 'active' AND is_active = true`
- `updated_at` triggers on properties, tenants, leases, notes — all use `EXECUTE FUNCTION private.set_updated_at()`
- Audit triggers on all 5 tables using `private.audit_trigger_fn`

### Supabase Storage

- Bucket: `property-photos` (private)
- Path: `{property_id}/cover.{ext}`
- Storage policies: INSERT + SELECT + UPDATE for admin and manager roles (all three required for upsert)

### RLS Policies

| Table                  | SELECT        | INSERT         | UPDATE         | DELETE         |
| ---------------------- | ------------- | -------------- | -------------- | -------------- |
| properties             | authenticated | admin, manager | admin, manager | —              |
| tenants                | authenticated | admin, manager | admin, manager | —              |
| leases                 | authenticated | admin, manager | admin, manager | —              |
| lease_tenants          | authenticated | admin, manager | —              | admin, manager |
| notes (is_active=true) | authenticated | authenticated  | admin, manager | —              |

### Seed Data

13 properties inserted in the migration with square footage from the initial property list. All set to city=Yukon, state=OK, zip=73099. bedrooms, bathrooms, year_built are null until populated via the app.

---

## Angular Services (`src/app/core/services/`)

| File                  | Methods                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `property.service.ts` | `getProperties()`, `getProperty(id)`, `createProperty(uuid, data)`, `updateProperty(id, data)`, `deactivateProperty(id)`, `getSignedCoverPhotoUrl(path)`                                                                   |
| `lease.service.ts`    | `getLeasesForProperty(propertyId)`, `getActiveLease(propertyId)`, `createLease(data)`, `updateLease(id, data)`, `deactivateLease(id)`                                                                                      |
| `tenant.service.ts`   | `getTenants()`, `getTenant(id)`, `createTenant(data)`, `updateTenant(id, data)`, `deactivateTenant(id)`, `getTenantsForLease(leaseId)`, `linkTenantToLease(leaseId, tenantId)`, `unlinkTenantFromLease(leaseId, tenantId)` |
| `notes.service.ts`    | `getNotes(entityType, entityId)`, `createNote(entityType, entityId, content)`, `deactivateNote(id)` — sets `is_active=false`; never hard deletes                                                                           |
| `storage.service.ts`  | `uploadPropertyCoverPhoto(propertyId, file)`, `deletePropertyCoverPhoto(path)`, `getSignedUrl(bucket, path, expirySeconds)`                                                                                                |

---

## Routes

| Path              | Component                   | Guard                   |
| ----------------- | --------------------------- | ----------------------- |
| `/dashboard`      | `DashboardPage` (lazy)      | `authGuard` (via shell) |
| `/properties`     | `PropertiesPage` (lazy)     | `authGuard`             |
| `/properties/:id` | `PropertyDetailPage` (lazy) | `authGuard`             |
| `/tenants`        | `TenantsPage` (lazy)        | `authGuard`             |
| `/tenants/:id`    | `TenantDetailPage` (lazy)   | `authGuard`             |

Tab state on `/properties/:id` managed via `?tab=overview|leases|tenants|notes|expenses|inspections|documents|emails` query param.

---

## Nav Config Update

Add Tenants between Properties and Expenses, visible to all roles:

| Item    | Icon            | Admin | Manager | View Only |
| ------- | --------------- | ----- | ------- | --------- |
| Tenants | `heroUsersMini` | ✓     | ✓       | ✓         |

---

## Implementation Phases

### Phase 0: Documentation _(first)_

1. Update `docs/roadmap.md` Phase 2 section with all finalized decisions ✓
2. Create `docs/phase-2-plan.md` (this file) ✓

### Phase A: Database _(blocks all Angular work)_

3. `supabase migration new phase2_core_property_data`
4. Write SQL via MCP `execute_sql`: 5 tables, constraints, indexes, updated_at triggers (reuse `private.set_updated_at()`), audit triggers, RLS policies, storage bucket + policies, seed 13 properties
5. Iterate with MCP `execute_sql` until all SQL is clean
6. Run MCP `get_advisors` — fix all warnings
7. Pull final migration: `supabase db pull --local --yes` (or CLI equivalent)

### Phase B: Shared Infrastructure _(parallel, depends on A)_

8. `src/app/shared/constants/us-states.ts` — `{ abbr: string; name: string }[]` for all 50 US states
9. `src/app/shared/components/notes-section/notes-section.component.ts` — inputs: `entityType`, `entityId`; shows note list with author/timestamp; textarea to add note; deactivate button (admin+manager only via `RoleService`); unit tests

### Phase C: Angular Services _(parallel, depends on A)_

10. `property.service.ts` — `getProperties()` includes derived `isOccupied` (joined from leases); `getSignedCoverPhotoUrl()` calls `storage.createSignedUrl()`
11. `lease.service.ts`
12. `tenant.service.ts`
13. `notes.service.ts` — `deactivateNote()` sets `is_active=false`; never hard deletes
14. `storage.service.ts`

### Phase D: Properties List _(depends on B, C)_

15. `PropertyCardComponent` (`src/app/features/properties/components/property-card/`) — signed cover photo (placeholder SVG if none), address display, Occupied/Vacant badge
16. `PropertiesPage` — card grid sorted by `address_line1`; All/Unoccupied toggle; "Add Property" button (managers only)
17. `PropertyFormComponent` — create/edit modal; UUID generated client-side on open (for new); photo upload via `StorageService`; US state dropdown (default OK); bathrooms dropdown (1/1.5/2/2.5/3); required field validation
18. Unit tests for `PropertiesPage`, `PropertyCardComponent`, `PropertyFormComponent`
19. `e2e/properties.spec.ts` — list renders, add property (manager), filter toggle, navigate to detail

### Phase E: Property Detail Page _(depends on D)_

20. `PropertyDetailPage` (`src/app/features/properties/property-detail-page.ts`) — tabbed via `?tab=` query param; default: Overview
    - **Overview**: cover photo, address, property details, edit button (managers only); "Start Tenancy" button if no active lease
    - **Leases**: active lease summary card (rent, dates, document URL, deactivate + edit buttons); lease history (active=highlighted, inactive=muted); "Start New Lease" disabled with tooltip if active lease exists
    - **Tenants**: tenants on active lease; phone/email hidden for View Only; "Add Tenant" opens `TenantFormComponent`
    - **Notes**: `NotesSectionComponent` with `entityType='property'`
    - **Expenses**: stub card "Available in Phase 3" (managers only)
    - **Inspections**: stub card "Available in Phase 5"
    - **Documents**: stub card "Available in Phase 4"
    - **Emails**: stub card "Available in Phase 4"
21. `LeaseFormComponent` — create/edit modal; required: `start_date`, `monthly_rent`, `security_deposit`; `status` dropdown and "Deactivate" button shown in edit mode only (managers only)
22. `TenantFormComponent` — modal; tab/radio: "Create New" (first/last required) OR "Link Existing" (typeahead over `is_active=true` tenants)
23. Unit tests for `PropertyDetailPage`, `LeaseFormComponent`, `TenantFormComponent`
24. Update `e2e/properties.spec.ts` with property detail tests

### Phase F: New Tenancy Wizard _(depends on E)_

25. `NewTenancyWizardComponent` (`src/app/features/properties/components/new-tenancy-wizard/`) — triggered by "Start Tenancy" on unoccupied property Overview; 3-step stepper with back navigation at each step
    - **Step 1 — Lease**: lease form fields (start_date required, end_date optional, monthly_rent required, security_deposit required, document_url optional); property pre-filled and read-only
    - **Step 2 — Tenants**: "Create New" / "Select Existing" selector; can add multiple tenants; shows added tenants list with remove option
    - **Step 3 — Confirmation**: read-only summary of lease details + tenant list; "Submit" button; on submit: `createLease()` then for each tenant `linkTenantToLease()` (plus `createTenant()` for new ones); on success navigate to `/properties/:id?tab=leases`
26. Unit tests: step navigation, back, validation, submit
27. E2E: unoccupied property → Start Tenancy → complete wizard → property shows as Occupied

### Phase G: Tenants Feature _(parallel with E/F, depends on C)_

28. `TenantsPage` (`src/app/features/tenants/tenants-page.ts`) — sortable list by last_name/first_name; name search input; "Add Tenant" button (managers only)
29. `TenantDetailPage` (`src/app/features/tenants/tenant-detail-page.ts`) — tenant info card (phone/email hidden for View Only); lease history for this tenant; `NotesSectionComponent` with `entityType='tenant'`; "Edit" and "Deactivate" buttons (managers only)
30. Update `src/app/layout/nav-config.ts` — add Tenants nav item (visible to all roles)
31. Update `src/app/app.routes.ts` — add `/tenants` and `/tenants/:id` routes
32. Unit tests for `TenantsPage`, `TenantDetailPage`
33. `e2e/tenants.spec.ts` — list renders, name search, detail page, PII hidden for view_only

### Phase H: Dashboard _(depends on C, D)_

34. `DashboardPage` (`src/app/features/dashboard/dashboard-page.ts`) — three sections:
    - **All Properties** (everyone): property card grid, links to `/properties/:id`
    - **Pending Approvals** (managers only): count badge querying `approval_requirements WHERE approver_id = auth.uid() AND status = 'pending'`; link to `/approvals`; empty state: "No pending approvals"
    - **Recent Expenses** (managers only): expenses from last 4 weeks; empty state: "No recent expenses"
35. Update `app.routes.ts`: point `/dashboard` to `DashboardPage` (lazy); add `/properties/:id`
36. Unit tests for `DashboardPage` (role visibility, empty states)
37. Create `e2e/dashboard.spec.ts`; update/remove `e2e/home.spec.ts`

### Phase I: Cleanup _(last)_

38. Delete `src/app/home/` directory
39. Remove any remaining imports of old Home component

---

## Files Created / Modified

**New files:**

- `src/app/shared/constants/us-states.ts`
- `src/app/shared/components/notes-section/notes-section.component.ts` (+ spec)
- `src/app/core/services/property.service.ts` (+ spec)
- `src/app/core/services/lease.service.ts` (+ spec)
- `src/app/core/services/tenant.service.ts` (+ spec)
- `src/app/core/services/notes.service.ts` (+ spec)
- `src/app/core/services/storage.service.ts` (+ spec)
- `src/app/features/properties/property-detail-page.ts` (+ spec)
- `src/app/features/properties/components/property-card/` (+ spec)
- `src/app/features/properties/components/property-form/` (+ spec)
- `src/app/features/properties/components/lease-form/` (+ spec)
- `src/app/features/properties/components/tenant-form/` (+ spec)
- `src/app/features/properties/components/new-tenancy-wizard/` (+ spec)
- `src/app/features/tenants/tenants-page.ts` (+ spec)
- `src/app/features/tenants/tenant-detail-page.ts` (+ spec)
- `src/app/features/dashboard/dashboard-page.ts` (+ spec)
- `supabase/migrations/YYYYMMDD_phase2_core_property_data.sql`
- `e2e/properties.spec.ts`
- `e2e/tenants.spec.ts`
- `e2e/dashboard.spec.ts`

**Modified files:**

- `src/app/app.routes.ts` — add new routes, update /dashboard
- `src/app/layout/nav-config.ts` — add Tenants item
- `src/app/features/properties/properties-page.ts` — replace stub with full implementation
- `e2e/home.spec.ts` — update or replace with dashboard.spec.ts

**Deleted:**

- `src/app/home/` — entire directory

---

## Verification Checklist

- [ ] `supabase migration list --local` — migration applied cleanly
- [ ] `get_advisors` — no warnings
- [ ] DB: second `status='active'` lease for same property is rejected by unique index
- [ ] DB: `notes` row with two parent FKs set is rejected by CHECK constraint
- [ ] DB: notes with `is_active=false` filtered from all SELECT queries
- [ ] RLS: view_only role can SELECT properties/tenants/leases; INSERT/UPDATE denied
- [ ] Cover photo: upload → signed URL → card shows image; signed URL expires correctly
- [ ] 13 seed properties visible in properties list, sorted by address_line1
- [ ] All/Unoccupied filter correctly shows/hides occupied properties
- [ ] Dashboard pending approvals count = current user's items only
- [ ] "Start New Lease" disabled when active lease exists; tooltip explains why
- [ ] New Tenancy Wizard: back navigation, validation, submit creates lease + tenant + junction row
- [ ] View Only user: tenant phone/email fields not rendered
- [ ] Audit log captures INSERT/UPDATE operations on all 5 tables
- [ ] `npm test` passes (all unit tests)
- [ ] `npm run test:e2e` passes (all Playwright tests)
