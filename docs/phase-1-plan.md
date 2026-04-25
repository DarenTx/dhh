# Phase 1: Platform Core — Implementation Plan

## Decisions Log

- **Three roles**: `admin`, `manager`, `view_only`
- Admin is a superset of Manager: full financial access + user management (invite, deactivate, reactivate)
- Admin counts as an approver for expenses and guaranteed payments (same as Manager)
- Only Admin can see the Admin nav item; Managers and View Only cannot
- Role storage: JWT claims via Supabase Auth Hook; `user_roles` table is source of truth
- Bootstrap: first Admin row inserted manually via SQL
- Invite-only: Supabase public signup disabled; invites via Edge Function using service role key (Admin only)
- Self-approval: a user cannot approve their own expense or guaranteed payment entry
- Expense approval threshold: monthly aggregate across all admins+managers — if total expenses for the calendar month exceed $150, any further expense requires approval
- Guaranteed payment hour cap: 20 hrs/month per admin/manager; over cap requires approval from all OTHER active admins+managers
- View Only nav: Expenses, Guaranteed Payments, Approvals, Settings, Admin hidden
- Manager nav: Admin hidden only
- Dashboard route: use existing Home component for now (Phase 2 replaces it)
- Desktop sidebar: always fully visible (fixed width, no collapse/toggle)
- Subcategories: disable-only from UI; re-enable requires a DB admin SQL command; disabled subcategories never appear in UI
- Audit page: paginated at 150 rows per page
- Audit user display: `user_roles.email` column (populated at invite/bootstrap) joined to `audit_log.performed_by` for display
- User deactivation: `is_active` flag; deactivated users cannot log in; their pending approval requirements are removed
- Approval snapshot: when a record is created, snapshot of current active eligible approvers is captured (all active admins+managers except submitter); new users added later do NOT retroactively need to approve old items
- Audit: Postgres trigger-based audit_log table on all relevant tables; system audit page in Angular for all users

---

## IRS Schedule E Part I Categories (fixed seed data)

1. Advertising
2. Auto and travel
3. Cleaning and maintenance
4. Commissions
5. Insurance
6. Legal and other professional fees
7. Management fees
8. Mortgage interest paid to banks
9. Other interest
10. Repairs
11. Supplies
12. Taxes
13. Utilities
14. Depreciation expense or depletion
15. Other

---

## Supabase Implementation Approach

### Tooling order

1. **MCP `search_docs`** — verify current API before implementing Auth Hooks, Edge Functions, RLS, JWT claims
2. **MCP `execute_sql`** — iterate schema freely; no migration history entries created
3. **MCP `get_advisors`** — run before finalizing schema; fix all warnings
4. **`supabase db pull phase1_platform_core --local --yes`** — generate final clean migration
5. **`supabase migration list --local`** — verify

> Do NOT use `apply_migration` for iteration — it locks in partial SQL permanently.

### Security rules

- RLS enabled on all tables: `user_roles`, `app_settings`, `irs_expense_categories`, `expense_subcategories`, `approval_requirements`, `audit_log`
- Use `app_metadata` only for role/is_active in JWT — never `user_metadata` (user-editable)
- `security definer` functions in `private` schema only, never `public`
- Service role key: Edge Function env only, never browser client
- Views (future): `security_invoker = true`
- Every UPDATE policy paired with a SELECT policy

### RLS policy patterns

`user_roles`: SELECT own row; SELECT all rows (admin only); UPDATE `is_active` (admin only); INSERT service role only

`app_settings`: SELECT + UPDATE for admin and manager

`irs_expense_categories`: SELECT for admin and manager; no writes from app

`expense_subcategories`: SELECT/INSERT/UPDATE for admin and manager

`approval_requirements`: SELECT for authenticated (own rows); INSERT via Postgres function only; UPDATE own pending row (approver only)

`audit_log`: SELECT for all authenticated; INSERT via trigger only; no UPDATE or DELETE

### Auth Hook

- Postgres function in `private` schema
- Registered: Authentication → Hooks → Custom Access Token Hook
- Reads `role` + `is_active` from `user_roles` for `event.user_id`; writes to `raw_app_meta_data`
- If user not in `user_roles`: set `role: null`, `is_active: false`
- Use MCP `search_docs` to confirm current hook function signature before writing

### Edge Function: `invite-user`

- Scaffold: `supabase functions new invite-user`
- Validates caller JWT `app_metadata.role === 'admin'`
- Calls `admin.inviteUserByEmail()` using service role key from env
- Inserts `user_roles` row (with email) after successful invite
- Deploy: `supabase functions deploy invite-user`

### Manual dashboard steps (done once)

1. Authentication → Settings → **Disable "Enable Signups"**
2. Authentication → Hooks → register custom access token hook → `private.custom_access_token_hook`

---

## Phase 1.1 — Authorization & User Management

### Database

**`user_roles`**

- `user_id` uuid PK FK → auth.users
- `role` text CHECK IN ('admin','manager','view_only')
- `is_active` boolean DEFAULT true
- `email` varchar — set at invite time and on bootstrap row
- `invited_by` uuid FK → auth.users, nullable (bootstrap row)
- `created_at`, `updated_at`

**Auth Hook** — fires on JWT mint/refresh; stamps `app_metadata.{ role, is_active }`; unknown users stamped `role: null`

**Edge Function `invite-user`** — Admin-only; accepts `{ email, role }`; calls `inviteUserByEmail`; inserts `user_roles` row

**Deactivate/Reactivate** — RLS-protected UPDATE on `user_roles` (Admin only); deactivation trigger cascades to delete all pending `approval_requirements` rows for that user

### Angular

- `RoleService` — `isAdmin()`, `isManagerOrAbove()`, `canViewFinancials()` derived from `session.user.app_metadata`
- Update `authGuard` — add `is_active` check; false → `signOut()` + redirect `/login?error=account_deactivated`
- `AdminPage` (`/admin`, Admin only) — user list with role badges and status; invite form → Edge Function; deactivate/reactivate toggle → PATCH `user_roles`

---

## Phase 1.2 — Application Settings

### Database

**`app_settings`** (single row, id = 1)

- `expense_monthly_aggregate_threshold` numeric DEFAULT 150
- `guaranteed_payment_hour_cap` integer DEFAULT 20
- No `updated_by` column — audit trigger captures this automatically

**`irs_expense_categories`** — serial PK, name varchar; seeded with 15 IRS Schedule E Part I categories; read-only from app

**`expense_subcategories`**

- `id` uuid PK
- `irs_category_id` FK → `irs_expense_categories`
- `name` varchar
- `is_active` boolean DEFAULT true — set false to disable; no UI reactivation; DB admin SQL only to re-enable; disabled rows filtered from all queries
- `created_by` uuid, `created_at`

### Angular

`SettingsPage` (`/settings`, Managers and Admins)

- Edit expense monthly aggregate threshold
- Edit guaranteed payment hour cap
- Manage subcategories per IRS category: add new (active default), disable existing; no reactivation option in UI

---

## Phase 1.3 — Navigation Shell

### Angular

`ShellComponent` — root layout replacing `app.html`

- Desktop (≥ 768px): fixed left sidebar always fully visible at `--nav-sidebar-width: 16rem`; main content offset by sidebar width; no toggle
- Mobile (< 768px): sidebar hidden; bottom nav bar at `--nav-bottom-height: 4rem`

**Nav visibility:**

| Item                | Admin | Manager | View Only |
| ------------------- | ----- | ------- | --------- |
| Dashboard           | ✓     | ✓       | ✓         |
| Properties          | ✓     | ✓       | ✓         |
| Expenses            | ✓     | ✓       | —         |
| Guaranteed Payments | ✓     | ✓       | —         |
| Approvals           | ✓     | ✓       | —         |
| Settings            | ✓     | ✓       | —         |
| Admin               | ✓     | —       | —         |
| Audit               | ✓     | ✓       | ✓         |

**Routes scaffolded:**

- `/dashboard` → Home (existing, temporary)
- `/properties` → stub
- `/expenses` → stub
- `/guaranteed-payments` → stub
- `/approvals` → stub
- `/settings` → SettingsPage
- `/admin` → AdminPage
- `/audit` → AuditPage

---

## Approval Requirements System _(Phase 1 DB, Phase 3 UI)_

**`approval_requirements`**

- `id` uuid PK
- `approvable_type` text CHECK IN ('expense','guaranteed_payment')
- `approvable_id` uuid
- `approver_id` uuid FK → auth.users
- `status` text CHECK IN ('pending','approved','rejected') DEFAULT 'pending'
- `reason` text nullable
- `responded_at` timestamptz nullable
- `created_at`

**Snapshot rule:** at record creation, Postgres function snapshots all active admins+managers excluding submitter → one row per approver

**Deactivation cascade:** trigger on `user_roles` UPDATE (`is_active` true→false) → deletes all pending rows for that `user_id`

**Status derivation:** rejected if any rejected; approved if all approved; else pending

---

## Audit System

**`audit_log`**

- `id` uuid PK
- `table_name` varchar
- `record_id` text
- `operation` text CHECK IN ('INSERT','UPDATE','DELETE')
- `old_data` jsonb nullable
- `new_data` jsonb nullable
- `performed_by` uuid nullable — resolved via `auth.uid()` inside trigger (null for system writes)
- `performed_at` timestamptz DEFAULT now()

Trigger function `audit_trigger_fn` (in `private` schema, `security definer`) applied to: `user_roles`, `app_settings`, `expense_subcategories`, `approval_requirements`. _(Phase 2+: properties, tenants, leases, expenses, guaranteed_payments)_

RLS: SELECT for all authenticated; INSERT via trigger only; no UPDATE or DELETE

`AuditPage` (`/audit`, all authenticated users)

- Columns: timestamp, user email (joined from `user_roles.email` via `performed_by`), table, operation, record ID
- Pagination: 150 rows/page; `?page=N` in URL
- Filters: date range, table, user, operation (filter changes reset to page 1)
- Expandable row: old/new data diff
- Empty state: "No audit records found"

---

## Styling & Icons

**CSS:** Tailwind CSS v4 (already set up); design tokens in `src/styles.scss`; nav dimensions: `--nav-sidebar-width: 16rem`, `--nav-bottom-height: 4rem`

**Utilities:** `@angular/cdk` (already installed)

**Icons:** `@ng-icons/core` + `@ng-icons/heroicons` — outline for default, solid for active

| Nav Item            | Icon                            |
| ------------------- | ------------------------------- |
| Dashboard           | `heroHomeMini`                  |
| Properties          | `heroBuildingOffice2Mini`       |
| Expenses            | `heroCreditCardMini`            |
| Guaranteed Payments | `heroClockMini`                 |
| Approvals           | `heroCheckCircleMini`           |
| Settings            | `heroCogMini`                   |
| Admin               | `heroUserGroupMini`             |
| Audit               | `heroClipboardDocumentListMini` |

---

## Files to Create / Modify

**Modified:**

- `src/app/app.routes.ts` — all Phase 1 routes
- `src/app/app.ts` / `app.html` — replace with ShellComponent outlet
- `src/app/core/auth/auth.guard.ts` — deactivation redirect

**New Angular:**

- `src/app/core/role/role.service.ts`
- `src/app/core/role/role.guard.ts` — exports `managerGuard` and `adminGuard`
- `src/app/core/services/admin.service.ts` — `getUsers()`, `inviteUser()`, `deactivateUser()`, `reactivateUser()`
- `src/app/core/services/settings.service.ts` — `getSettings()`, `updateSettings()`, `getSubcategories()`, `addSubcategory()`, `disableSubcategory()`
- `src/app/core/services/audit.service.ts` — `loadAudit({ from?, to?, table?, operation?, page })` → `{ rows, totalCount }`
- `src/app/features/admin/admin-page.ts`
- `src/app/features/settings/settings-page.ts`
- `src/app/features/audit/audit-page.ts`
- `src/app/layout/shell/shell.component.ts`
- `src/app/layout/sidebar/sidebar.component.ts`
- `src/app/layout/bottom-nav/bottom-nav.component.ts`

**New Supabase:**

- `supabase/functions/invite-user/index.ts`
- `supabase/migrations/YYYYMMDD_phase1_platform_core.sql`

---

## Testing

### Patterns

- Unit: Vitest via `@angular/build:unit-test`; all globals explicitly imported per file
- Mocking: inline factory functions (`createFixture()`, `mockAuth()`); no shared helpers
- E2E: Playwright; role mocking via `page.addInitScript` seeding localStorage JWT with `app_metadata: { role, is_active: true }` + `page.route` intercepting Supabase API calls

### Unit Test Specs

**`role.service.spec.ts`** — `isAdmin/isManagerOrAbove/canViewFinancials` for all 3 roles + null session + missing app_metadata

**`auth.guard.spec.ts`** _(updated)_ — add: `is_active: false` → redirects `/login?error=account_deactivated`; `is_active: true` → passes

**`role.guard.spec.ts`** — `managerGuard`: true for admin+manager, `/` for view_only, `/login` for no session; `adminGuard`: true for admin, `/` for manager+view_only, `/login` for no session

**`shell.component.spec.ts`** — nav items count per role; sidebar always in DOM at desktop; bottom nav at mobile; active route class; no toggle signal

**`admin-page.spec.ts`** — user list rendering; invite form validation + success + error; deactivate/reactivate calls; own row disabled

**`settings-page.spec.ts`** — threshold/cap validation and save; subcategory add/disable; no reactivation option

**`audit-page.spec.ts`** — rows with email; expand diff; filter calls with page reset; pagination controls when >150; `?page=N` URL; empty state

### E2E Test Specs

**`shell.spec.ts`** — nav visibility for all 3 roles; desktop sidebar always visible; mobile bottom nav; deactivated user redirected

**`admin.spec.ts`** — role guards for unauthenticated/manager/admin; full invite flow; deactivate/reactivate UI; own row disabled

**`settings.spec.ts`** — role guards; save flow; subcategory add+disable; no reactivation

**`audit.spec.ts`** — all roles can access; email column; row expand; pagination; filter resets page; empty state

---

## Verification Checklist

- [ ] 1. Disable signup in Supabase → unknown Google account blocked on sign-in
- [ ] 2. Bootstrap Admin SQL row → login → JWT has `app_metadata.role: "admin"`, `is_active: true`
- [ ] 3. Set `is_active = false` → login redirects to `/login?error=account_deactivated`
- [ ] 4. Invite View Only → login → Expenses/Guaranteed Payments/Approvals/Settings/Admin nav absent
- [ ] 5. Desktop: sidebar fully visible without any toggle interaction
- [ ] 6. Mobile (375px): bottom nav shown, sidebar hidden
- [ ] 7. Expense ≤ monthly aggregate $150 → no `approval_requirements` rows
- [ ] 8. Expense pushing total > $150 → rows for all OTHER active admins+managers (submitter excluded)
- [ ] 9. Settings change → `audit_log` row with correct `performed_by` → visible on `/audit` with email
- [ ] 10. New Admin added → does not appear in pre-existing `approval_requirements`; does appear on new items
- [ ] 11. Deactivate Admin/Manager with pending approval → row removed → auto-approves if last required approver
- [ ] 12. Disable subcategory → disappears from list; no reactivation button visible
- [ ] 13. Audit page > 150 rows → pagination controls visible; next page updates `?page=2`
- [ ] 14. `npm test` — all unit tests pass
- [ ] 15. `npx playwright test` — all E2E tests pass
