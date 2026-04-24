# Dahl Heritage Homes — Product Roadmap

## Overview

This roadmap covers all planned features for the DHH internal property management application. The app serves a small team (2–5 people) managing a portfolio of 10–50 rental properties. It is a Progressive Web App (PWA) built with Angular and Supabase, deployed at [dahlheritagehomes.com](https://dahlheritagehomes.com).

---

## Foundation (Shipped)

- Angular 21 standalone PWA deployed to GitHub Pages
- Supabase authentication: Google OAuth (PKCE) and email magic link (passwordless)
- Route guard protecting all app routes — redirects to `/login` if unauthenticated
- Login callback handler for Supabase PKCE code exchange

---

## Phase 1: Platform Core

### 1.1 Authorization & User Management

Two roles:

| Role          | Description                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| **Manager**   | Full access — can create/edit all records; can approve expenses and guaranteed payments |
| **View Only** | Read access to non-financial data only                                                  |

**View Only users cannot see:**

- Expenses
- Guaranteed payment entries
- Any dollar amounts or hour totals

**User management:**

- Admin page in the app (Managers only)
- Invite users by email; assign Manager or View Only role
- Roles stored in Supabase (e.g., `user_roles` table or custom JWT claims)

**Approval rule:**

- All pending approvals require sign-off from **every** user in the Manager role
- No configurable approver list — "all managers" is always the rule

---

### 1.2 Application Settings

Configurable by Managers only. These settings drive approval thresholds and expense categorization across the app.

| Setting                     | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| Expense approval threshold  | Dollar amount above which an expense requires manager approval |
| Guaranteed payment hour cap | Max hours/month a manager can bill without requiring approval  |
| Expense sub-categories      | Configurable list of sub-categories per IRS expense category   |

---

### 1.3 Navigation Shell

- **Desktop:** Left sidebar — Dashboard, Properties, Expenses, Guaranteed Payments, Approvals, Settings (Managers only), Admin (Managers only)
- **Mobile (PWA):** Bottom navigation bar with the same items

---

## Phase 2: Core Property Data

_This phase is the first priority after Phase 1._

### 2.1 Properties

**Fields:**

| Field          | Notes               |
| -------------- | ------------------- |
| Address        | Full street address |
| Year built     |                     |
| Square footage |                     |
| Bedrooms       |                     |
| Bathrooms      |                     |
| Notes          | Free-form one-liner |

**Derived status** (no explicit status field):

- _Occupied_ — property has an active lease
- _Vacant_ — property has no active lease

**Property detail page surfaces:**

- Active lease and linked tenants
- Inspection history
- Expenses _(Managers only)_
- Gmail emails tagged with this property's label _(read-only links to Gmail)_
- Google Drive documents

---

### 2.2 Tenants

**Fields:**

| Field         | Notes               |
| ------------- | ------------------- |
| Full name     |                     |
| Phone         |                     |
| Email         |                     |
| Move-in date  |                     |
| Move-out date |                     |
| Notes         | Free-form one-liner |
| Linked lease  |                     |

---

### 2.3 Leases

**Fields:**

| Field            | Notes                                        |
| ---------------- | -------------------------------------------- |
| Start date       |                                              |
| End date         |                                              |
| Monthly rent     |                                              |
| Security deposit |                                              |
| Lease Notes      | Free-form one-liner                          |
| Linked tenants   | Multiple tenants per lease (e.g., roommates) |

**Rules:**

- One active lease per property at a time
- A lease can have multiple tenants

---

### 2.4 Dashboard

Shown immediately after login. Content respects role visibility rules.

| Section                                                | Visible to    |
| ------------------------------------------------------ | ------------- |
| All properties with derived status (Occupied / Vacant) | Everyone      |
| Pending approvals count + link to approval inbox       | Managers only |
| Recent expenses                                        | Managers only |

---

## Phase 3: Financial Tracking

_All financial data is hidden from View Only users._

### 3.1 Expense Tracking

**Fields:**

| Field                | Notes                                                           |
| -------------------- | --------------------------------------------------------------- |
| Date                 |                                                                 |
| Amount               |                                                                 |
| Description          |                                                                 |
| IRS expense category | Fixed list — standard IRS Schedule E rental property categories |
| Sub-category         | Configurable per IRS category in Application Settings           |
| Linked property      | Optional — can be a general LLC expense not tied to a property  |
| Receipt / document   | Google Drive link                                               |
| Approval status      | Pending / Approved / Rejected                                   |

**Approval rule:**

- If `amount > expense approval threshold` (app setting) → approval required from all Managers
- Notification sent via email and in-app notification when approval is pending

---

### 3.2 Guaranteed Payment Time Tracking

LLC managers can bill hours worked for the LLC and receive reimbursement each month.

**Fields:**

| Field            | Notes                                                |
| ---------------- | ---------------------------------------------------- |
| Manager          | The submitter (each manager submits their own hours) |
| Period           | Month and year                                       |
| Hours billed     |                                                      |
| Work description | Free-form notes about the work performed             |
| Approval status  | Pending / Approved / Rejected                        |

**Approval rule:**

- Up to the configured hour cap per month — no approval required
- Over the cap → requires approval from all other Managers
- Notification sent via email and in-app notification when approval is pending

---

### 3.3 Approval Workflow

Applies to both expenses and guaranteed payment entries.

**Flow:**

1. Record is created with status **Pending Approval**
2. All Managers are notified via in-app notification and email
3. Each Manager individually approves or rejects with an optional reason
4. Record is **Approved** only when every Manager has approved
5. If any Manager rejects, the record is marked **Rejected** with the stated reason

**In-app notifications:**

- Pending approvals badge in the navigation
- Dedicated approval inbox listing all pending items

---

## Phase 4: Google Integrations

Each user connects their **personal Google account** via OAuth. Photos are an exception — uploads target the LLC's shared Google Photos account while the user authenticates with their personal account.

### 4.1 Gmail — Property Email Labels

- Properties are labeled in Gmail using the property address or name
- On the property detail page: display a list of emails matching that property's Gmail label
- Clicking an email opens it directly in Gmail (external link)
- Read-only — no sending, composing, or replying from within the app
- Uses Gmail API with OAuth scope for label-based filtering

---

### 4.2 Google Drive — Document Storage

- Receipts and expense documents attached to expense records
- General documents stored and linked per property
- Some documents may be general LLC documents not tied to a specific property
- File upload and link UI appears on the property detail page and on expense records
- Uses Google Drive API / Google Picker for browsing and attaching files

---

### 4.3 Google Photos — Inspection Photos

- Photos captured in-app during inspections are uploaded to the LLC's shared Google Photos account
- Each user authenticates with their personal Google account but uploads to the shared library
- The text note for each photo is embedded as the photo's description/caption using image metadata
- The Google Photos URL or media reference is stored in Supabase alongside the inspection record

> **Feasibility note:** The Google Photos Library API has write restrictions for third-party apps. Feasibility must be confirmed during Phase 5 implementation. Fallback option: store photos in Supabase Storage and expose a link to the relevant Google Photos album.

---

## Phase 5: Inspection Workflow

_Designed for mobile field use as a PWA._

### 5.1 Inspection Types

| Type                 | Use case                    |
| -------------------- | --------------------------- |
| Initial Walk-Through | Before a tenant moves in    |
| Move-Out             | After a tenant vacates      |
| Standard / Regular   | Routine periodic inspection |

Each inspection is linked to a specific property.

---

### 5.2 Inspection Areas (Fixed List)

The following areas are hardcoded in the app:

1. Front Yard / Porch
2. Living Room
3. Kitchen
4. Utility Room
5. Primary Bedroom
6. Bedroom 2
7. Bedroom 3
8. Backyard
9. Air Conditioner
10. Hot Water Heater
11. Primary Bathroom
12. Bathroom

---

### 5.3 Inspection Flow

1. **Start** — select inspection type and confirm the property
2. **Select area** — choose from the fixed area list above
3. **Capture photo** — use the device camera to photograph the area
4. **Add note** — type a description of the condition observed
5. **Repeat** — add more photos for the same area, or return to the area list to select another area
6. **Submit** — finalize and submit the completed inspection

Photos are uploaded to the LLC's Google Photos account with the note embedded as the caption. The photo reference is stored in Supabase with the inspection record.

---

## Open Questions & Future Considerations

| #   | Topic                             | Notes                                                                                                                                                                                                  |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Lease PDFs**                    | Not explicitly scoped to Google Drive yet; revisit during Phase 2 lease implementation                                                                                                                 |
| 2   | **Google Photos API feasibility** | Library API write restrictions may require using Supabase Storage as a fallback; evaluate during Phase 5                                                                                               |
| 3   | **Expense reporting / export**    | No reporting was scoped; a CSV or PDF export for tax season may be a low-effort addition worth adding to Phase 3                                                                                       |
| 4   | **Privacy & Terms pages**         | Stub components exist (`/privacy`, `/tos`) but content has not been written; required before public launch                                                                                             |
| 5   | **Login spec alignment**          | The login spec doc (`docs/specs/login/`) defines a separate `/login/magic-link` route; current implementation combines both Google OAuth and magic link on one page — resolve before closing auth work |
