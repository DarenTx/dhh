# Phase 3: Financial Tracking — Implementation Plan

## Overview

Build expense tracking, guaranteed payment time tracking, and the full approval workflow. This phase builds on Phase 1's `approval_requirements` table infrastructure, IRS category/sub-category system, and app settings scaffolding. Expense evidence is stored in Supabase Storage (replaces the original Google Drive approach).

---

## Decisions

| Topic                        | Decision                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval status storage      | Stored `status` column on `expenses` and `guaranteed_payments`; updated by a Postgres trigger when all `approval_requirements` rows for that record resolve |
| In-app notifications         | No separate table — badge and inbox driven from `approval_requirements WHERE approver_id = me AND status = 'pending'` joined with the active parent record  |
| Email notifications          | Deferred to a later phase                                                                                                                                   |
| Monthly aggregate threshold  | All non-rejected (pending + approved) expenses for the calendar month, LLC-wide; if running total ≥ threshold, new expenses require approval                |
| Rejection                    | Permanent — submitter must create a new entry; rejected items cannot be resubmitted                                                                         |
| Edit pending expense         | Allowed — all `approval_requirements` rows for that expense are deleted and re-created from the current approver snapshot                                   |
| Retract pending              | Soft delete (`is_active = false`); approval inbox queries join the parent to exclude inactive records                                                       |
| GP entry model               | Daily entries — one entry per manager per date; unique constraint on `(created_by, work_date)`                                                              |
| GP cap calculation           | SUM of all non-rejected `hours_billed` for the calendar month for that manager; if new entry would push total over the cap → approval required              |
| GP visibility                | All managers and admins see all entries; view_only cannot see guaranteed payments at all                                                                    |
| Expense list layout          | Monthly accordion — header shows count + total dollar amount; expanding shows a table of individual expenses                                                |
| GP list layout               | Default "My entries" (monthly accordion, header = total hrs for that month); "All managers" toggle (grouped by manager, then month inside each)             |
| Evidence                     | Separate `expense_evidence` table; Supabase Storage bucket `expense-evidence`; images (JPEG/PNG/WebP/HEIC) and PDFs; at least 1 file required per expense   |
| Sub-category required        | Always required; Phase 3 migration seeds default sub-categories for all 15 IRS Schedule E categories                                                        |
| Single-manager auto-approve  | If the approver snapshot is empty (no other active admins/managers), the record is immediately set to `approved`                                            |
| Approvals inbox scope        | Only items pending the current user's approval (`approval_requirements.approver_id = me`)                                                                   |
| Property detail Expenses tab | Summary card: total YTD for this property + top-3 category breakdown + "View all expenses" link to `/expenses?property={id}`                                |

---

## Database Schema

### New table: `expenses`

```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
date             date NOT NULL
amount           numeric(10,2) NOT NULL CHECK (amount > 0)
description      text NOT NULL
irs_category_id  uuid NOT NULL REFERENCES irs_expense_categories
subcategory_id   uuid NOT NULL REFERENCES expense_subcategories
property_id      uuid REFERENCES properties  -- NULL = general LLC expense
status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
is_active        boolean NOT NULL DEFAULT true
created_by       uuid REFERENCES auth.users
created_at       timestamptz NOT NULL DEFAULT now()
updated_at       timestamptz NOT NULL DEFAULT now()
```

### New table: `guaranteed_payments`

```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
work_date         date NOT NULL
hours_billed      numeric(4,2) NOT NULL CHECK (hours_billed > 0)
work_description  text NOT NULL
status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
is_active         boolean NOT NULL DEFAULT true
created_by        uuid REFERENCES auth.users
created_at        timestamptz NOT NULL DEFAULT now()
updated_at        timestamptz NOT NULL DEFAULT now()
UNIQUE (created_by, work_date)
```

### New table: `expense_evidence`

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
expense_id    uuid NOT NULL REFERENCES expenses ON DELETE CASCADE
storage_path  text NOT NULL  -- 'expense-evidence/{expense_id}/{uuid}.{ext}'
file_name     text NOT NULL
mime_type     text NOT NULL  -- image/jpeg, image/png, image/webp, image/heic, application/pdf
uploaded_by   uuid REFERENCES auth.users
created_at    timestamptz NOT NULL DEFAULT now()
```

### Alter: `approval_requirements`

```sql
ALTER TABLE approval_requirements ADD COLUMN IF NOT EXISTS rejection_reason text;
```

### Postgres functions (`private` schema, SECURITY DEFINER)

| Function                                                                                        | Purpose                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.expense_needs_approval(amount numeric, month int, year int)`                           | Returns true if the running LLC-wide non-rejected total for that month **plus `amount`** ≥ `app_settings.expense_monthly_aggregate_threshold` (i.e., checks whether adding this expense meets or crosses the threshold) |
| `private.gp_needs_approval(submitter_id uuid, month int, year int, new_hours numeric)`          | Returns true if the submitter's non-rejected hours for that month + `new_hours` > `app_settings.guaranteed_payment_hour_cap`                                                                                    |
| `private.create_approval_snapshot(approvable_type text, approvable_id uuid, submitter_id uuid)` | Selects all active admins/managers except the submitter; inserts `approval_requirements` rows; if snapshot is empty, immediately sets the parent record status to `'approved'`                                  |
| `private.resolve_approval_status()`                                                             | AFTER UPDATE trigger on `approval_requirements`; if any row for the record is rejected → set parent rejected; if all rows are approved → set parent approved; dispatches to correct table via `approvable_type` |

### AFTER INSERT triggers

- `expenses`: calls `expense_needs_approval(NEW.amount, EXTRACT MONTH, EXTRACT YEAR)`; if true → `create_approval_snapshot('expense', NEW.id, NEW.created_by)`; else → `UPDATE expenses SET status = 'approved' WHERE id = NEW.id`
- `guaranteed_payments`: calls `gp_needs_approval(NEW.created_by, ...)`; same branching logic

### Storage

- Bucket: `expense-evidence` (private)
- Path pattern: `{expense_id}/{random_uuid}.{ext}`
- Storage policies: INSERT + SELECT + UPDATE for admin and manager (all three required for upsert); DELETE for admin and manager

### RLS Policies

| Table                 | SELECT         | INSERT         | UPDATE                                  | DELETE         |
| --------------------- | -------------- | -------------- | --------------------------------------- | -------------- |
| `expenses`            | admin, manager | admin, manager | admin, manager                          | —              |
| `guaranteed_payments` | admin, manager | admin, manager | admin, manager (`created_by = me` only) | —              |
| `expense_evidence`    | admin, manager | admin, manager | —                                       | admin, manager |

> `approval_requirements` policy note: SELECT allows viewing own rows AND rows where the approvable record was created by the current user (so submitters can see their approval status). INSERT policy must be `USING (false)` — all inserts happen via `private.create_approval_snapshot()` which runs as `SECURITY DEFINER` and bypasses RLS. UPDATE allows approvers to change their own pending row only.

### Audit triggers

Apply `private.audit_trigger_fn` (from Phase 1) to `expenses` and `guaranteed_payments`.

> `expense_evidence` does **not** get an audit trigger — rows are insert-only or delete-only (never updated), and the parent `expenses` row is already audited. Deleting evidence rows will be captured when the DELETE is issued through the service.

### `updated_at` triggers

Reuse `private.set_updated_at()` on `expenses` and `guaranteed_payments`.

### Seed data

Default sub-categories for all 15 IRS Schedule E categories inserted in the migration so the "always required" constraint is never broken from day 1.

---

## Angular Services

All services in `src/app/core/services/`.

### `expense.service.ts`

| Method                               | Description                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| `getExpenses()`                      | All active expenses, descending by date                      |
| `getExpensesForProperty(propertyId)` | Scoped to a property                                         |
| `getExpense(id)`                     | Single expense with evidence and approval rows               |
| `createExpense(data)`                | Insert expense; evidence uploaded separately after insert    |
| `updateExpense(id, data)`            | Update fields; caller is responsible for resetting approvals |
| `retractExpense(id)`                 | Soft delete (`is_active = false`)                            |
| `getMonthlyTotal(month, year)`       | Sum of non-rejected amounts for LLC-wide threshold check     |

### `guaranteed-payment.service.ts`

| Method                                              | Description                                    |
| --------------------------------------------------- | ---------------------------------------------- |
| `getGuaranteedPayments(managerId?)`                 | All active entries; optional filter by manager |
| `getGuaranteedPayment(id)`                          | Single entry with approval rows                |
| `createGuaranteedPayment(data)`                     | Insert entry                                   |
| `retractGuaranteedPayment(id)`                      | Soft delete                                    |
| `getMonthlyHoursForManager(managerId, month, year)` | Sum of non-rejected hours for preview in form  |

### `expense-evidence.service.ts`

| Method                             | Description                                                        |
| ---------------------------------- | ------------------------------------------------------------------ |
| `uploadEvidence(expenseId, file)`  | Upload to `expense-evidence` bucket; insert `expense_evidence` row |
| `getEvidenceForExpense(expenseId)` | List evidence rows with signed URLs                                |
| `deleteEvidence(evidenceId)`       | Delete storage object + remove row                                 |

### `approval.service.ts`

| Method                              | Description                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `getPendingCountForMe()`            | Count of `approval_requirements` rows where `approver_id = me AND status = 'pending'` (joined to active parent) |
| `getPendingApprovalsForMe()`        | Full list for the Approvals inbox                                                                               |
| `approveItem(requirementId)`        | UPDATE `approval_requirements` SET status = 'approved'                                                          |
| `rejectItem(requirementId, reason)` | UPDATE status = 'rejected', rejection_reason = reason                                                           |

---

## Routes

All under the shell with `managerGuard` (stub routes already exist in `app.routes.ts`):

```
/expenses                    → ExpensesPage (lazy)
/expenses/:id                → ExpenseDetailPage (lazy)  ← new detail route
/guaranteed-payments         → GuaranteedPaymentsPage (lazy)
/guaranteed-payments/:id     → GuaranteedPaymentDetailPage (lazy)  ← new detail route
/approvals                   → ApprovalsPage (lazy)
```

---

## Angular Components

### `ExpensesPage` (`src/app/features/expenses/`)

- Monthly accordion — header format: "March 2026 · 8 expenses · $1,240.50"
- Expanded: table with columns Date | Property | Description | Category / Sub-category | Amount | Status badge | Actions (view, retract)
- "Add Expense" FAB/button (managers only)

### `ExpenseFormComponent` (modal)

- Fields: date picker, amount, IRS category dropdown, sub-category dropdown (filtered by selected category), description textarea, property dropdown (optional — includes "General LLC" option)
- Evidence uploader: camera capture + file pick; thumbnail preview per file with remove button; form submit blocked if 0 files
- Edit mode: fields pre-populated; warning banner "Editing this expense will reset all pending approvals"

### `ExpenseDetailPage` (`src/app/features/expenses/expense-detail/`)

- All expense fields (read-only) + evidence gallery (images shown inline, PDFs as download links with filename)
- Approval status panel: table of approvers with their status (Pending / Approved / Rejected + reason)
- Context-sensitive actions:
  - Submitter + pending → Edit, Retract
  - Current user is an approver + pending → Approve, Reject (opens reason dialog)
  - Approved or rejected → read-only

### `GuaranteedPaymentsPage` (`src/app/features/guaranteed-payments/`)

- "My entries" view (default): monthly accordion; header = "March 2026 · 12.5 hrs"
- "All managers" toggle: grouped by manager name, then monthly accordion inside each group
- "Add Entry" button (managers only)

### `GuaranteedPaymentFormComponent` (modal)

- Fields: work_date (date picker), hours_billed (number), work_description (textarea)
- Live preview below hours field: "12.5 of 20 hrs used in March 2026" (calls `getMonthlyHoursForManager`)

### `GuaranteedPaymentDetailPage` (`src/app/features/guaranteed-payments/guaranteed-payment-detail/`)

- Fields (read-only) + approval status panel
- Context-sensitive actions (same logic as Expense detail)

### `ApprovalsPage` (`src/app/features/approvals/`)

- Two sections: **Expenses** | **Guaranteed Payments**
- Each item: submitted by, date, description, amount/hours, Approve button, Reject button
- Reject opens a dialog with a required reason textarea
- Empty state illustration per section when nothing is pending

### Nav badge (update `ShellComponent` + `nav-config.ts`)

- Inject `ApprovalService`; subscribe to `getPendingCountForMe()` in the shell
- Display a numeric badge on the Approvals nav item; hide when count is 0

### Dashboard update (`DashboardPage`)

- Add "Recent Expenses" widget below the properties grid
- Mini-table: Date | Property | Description | Amount; max 5 rows from last 4 weeks; "View all expenses" link

### Property Detail Expenses tab (`PropertyDetailPage`)

- Replace the "Available in Phase 3" stub with a summary card
- Card shows: total expenses YTD for this property, top-3 IRS category breakdown, "View all expenses →" link to `/expenses?property={id}`

---

## Implementation Phases

### Phase 0: Documentation _(first — no dependencies)_

1. Write `docs/phase-3-plan.md` (this file)
2. Update `docs/roadmap.md` Phase 3 section with all finalized decisions

### Phase A: Database _(depends on Phase 0; blocks all Angular work)_

**Supabase tooling order:**

- MCP `search_docs` — verify current API before writing any trigger, RLS, or storage policy SQL
- MCP `execute_sql` — iterate schema freely; do NOT use `apply_migration`
- MCP `get_advisors` — fix all warnings before committing
- `supabase db pull phase3_financial_tracking --local --yes` — generate the final migration file
- `supabase migration list --local` — verify

Steps: 3. Execute `expenses`, `guaranteed_payments`, `expense_evidence` tables via MCP `execute_sql` 4. Execute `ALTER TABLE approval_requirements ADD COLUMN IF NOT EXISTS rejection_reason text` 5. Write and execute `private.expense_needs_approval()` and `private.gp_needs_approval()` 6. Write and execute `private.create_approval_snapshot()` 7. Write and execute `private.resolve_approval_status()` + AFTER UPDATE trigger on `approval_requirements` 8. Write and execute AFTER INSERT triggers on `expenses` and `guaranteed_payments` 9. Create `expense-evidence` storage bucket + storage policies via MCP `execute_sql` 10. Write and execute RLS policies for all 3 new tables 11. Apply `updated_at` triggers and audit triggers (reuse existing `private` functions) 12. Seed default sub-categories for all 15 IRS categories 13. Run MCP `get_advisors` — fix all warnings 14. `supabase db pull phase3_financial_tracking --local --yes` + `supabase migration list --local`

### Phase B: Angular Services _(all parallel; depends on A)_

15. `expense.service.ts`
16. `guaranteed-payment.service.ts`
17. `expense-evidence.service.ts`
18. `approval.service.ts`

### Phase C: Expenses Feature _(depends on B)_

19. `ExpensesPage` — monthly accordion
20. `ExpenseFormComponent` — with evidence uploader
21. `ExpenseDetailPage` — with approval panel
22. Unit tests for all three

### Phase D: Guaranteed Payments Feature _(parallel with C; depends on B)_

23. `GuaranteedPaymentsPage`
24. `GuaranteedPaymentFormComponent` — with monthly hours preview
25. `GuaranteedPaymentDetailPage`
26. Unit tests for all three

### Phase E: Approvals + Nav Badge _(depends on B)_

27. `ApprovalsPage`
28. Nav badge in `ShellComponent`
29. Unit tests

### Phase F: Integrations + Routing _(depends on C, D, E)_

30. Update `app.routes.ts` — add `/expenses/:id` and `/guaranteed-payments/:id` lazy routes
31. Update `DashboardPage` — recent expenses widget
32. Update `PropertyDetailPage` Expenses tab — summary card replacing stub
33. E2E tests: `e2e/expenses.spec.ts`, `e2e/approvals.spec.ts`

---

## Verification

| #   | Test                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DB: `supabase db pull` generates clean migration with no advisor warnings                                                                 |
| 2   | DB: Insert expense above monthly aggregate threshold → `approval_requirements` rows created; approve all → `expenses.status = 'approved'` |
| 3   | DB: Insert expense below threshold → `status = 'approved'` immediately; zero `approval_requirements` rows                                 |
| 4   | DB: Insert GP entry that pushes monthly total over cap → approval required                                                                |
| 5   | DB: Single manager submits over-cap GP entry → auto-approved (empty snapshot)                                                             |
| 6   | DB: Duplicate `(created_by, work_date)` insert in `guaranteed_payments` → unique constraint error                                         |
| 7   | Angular: Expense form submit blocked when evidence count = 0                                                                              |
| 8   | Angular: Sub-category dropdown resets and filters correctly when IRS category changes                                                     |
| 9   | Angular: Nav badge shows pending count; clears when all items resolve                                                                     |
| 10  | Angular: View Only user redirected away from `/expenses`, `/guaranteed-payments`, `/approvals`                                            |
| 11  | Angular: Retracting a pending expense removes it from approvers' inbox                                                                    |
| 12  | E2E: Create expense above threshold → badge appears → all approvers approve → approved                                                    |
| 13  | E2E: One approver rejects → expense marked rejected                                                                                       |

---

## Scope Boundaries

**Included:**

- Expenses CRUD with multi-file evidence uploads to Supabase Storage
- Guaranteed payments daily time tracking (one entry per manager per date)
- Full approval workflow — snapshot, approve, reject, auto-approve when no other approvers
- Nav badge + approval inbox driven from `approval_requirements`
- Dashboard recent expenses widget
- Property detail Expenses summary card
- Default IRS sub-category seeds for all 15 categories

**Excluded:**

- Email notifications (deferred to a later phase)
- Expense reporting / CSV export (roadmap open question — may be added to Phase 3 later)
- Google Drive integration (replaced by Supabase Storage for evidence)
- Expense search / advanced filtering (basic monthly accordion sufficient for now)
