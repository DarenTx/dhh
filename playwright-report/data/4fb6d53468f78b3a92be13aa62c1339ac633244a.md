# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approvals.spec.ts >> Approvals page >> shows pending guaranteed payment approval item
- Location: e2e\approvals.spec.ts:125:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Property inspections')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Property inspections')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img "Dahl Heritage Homes logo" [ref=e6]
      - generic [ref=e7]: Dahl Heritage Homes
    - navigation [ref=e8]:
      - link "Dashboard" [ref=e9] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e10]:
          - img [ref=e11]
        - generic [ref=e13]: Dashboard
      - link "Properties" [ref=e14] [cursor=pointer]:
        - /url: /properties
        - img [ref=e15]:
          - img [ref=e16]
        - generic [ref=e18]: Properties
      - link "Tenants" [ref=e19] [cursor=pointer]:
        - /url: /tenants
        - img [ref=e20]:
          - img [ref=e21]
        - generic [ref=e23]: Tenants
      - link "Expenses" [ref=e24] [cursor=pointer]:
        - /url: /expenses
        - img [ref=e25]:
          - img [ref=e26]
        - generic [ref=e28]: Expenses
      - link "Guaranteed Payments" [ref=e29] [cursor=pointer]:
        - /url: /guaranteed-payments
        - img [ref=e30]:
          - img [ref=e31]
        - generic [ref=e33]: Guaranteed Payments
      - link "Approvals" [ref=e34] [cursor=pointer]:
        - /url: /approvals
        - img [ref=e35]:
          - img [ref=e36]
        - generic [ref=e38]: Approvals
      - link "Settings" [ref=e39] [cursor=pointer]:
        - /url: /settings
        - img [ref=e40]:
          - img [ref=e41]
        - generic [ref=e44]: Settings
      - link "Audit" [ref=e45] [cursor=pointer]:
        - /url: /audit
        - img [ref=e46]:
          - img [ref=e47]
        - generic [ref=e49]: Audit
  - main [ref=e50]:
    - generic [ref=e52]:
      - heading "Approvals" [level=1] [ref=e53]
      - generic [ref=e54]:
        - paragraph [ref=e55]: Expenses (1)
        - generic [ref=e56]:
          - generic [ref=e57]:
            - generic [ref=e58]: Expense
            - generic [ref=e59]: "ID: exp-1…"
            - generic [ref=e60]: Submitted 2026-04-20
          - generic [ref=e61]:
            - button "View" [ref=e62] [cursor=pointer]
            - button "Approve" [ref=e63] [cursor=pointer]
            - button "Reject" [ref=e64] [cursor=pointer]
      - generic [ref=e65]:
        - paragraph [ref=e66]: Guaranteed Payments (1)
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]: Guaranteed Payment
            - generic [ref=e70]: "ID: gp-1…"
            - generic [ref=e71]: Submitted 2026-04-18
          - generic [ref=e72]:
            - button "View" [ref=e73] [cursor=pointer]
            - button "Approve" [ref=e74] [cursor=pointer]
            - button "Reject" [ref=e75] [cursor=pointer]
```

# Test source

```ts
  26  |       email_confirmed_at: '2024-01-01T00:00:00.000Z',
  27  |       created_at: '2024-01-01T00:00:00.000Z',
  28  |       updated_at: '2024-01-01T00:00:00.000Z',
  29  |       app_metadata: { role: 'manager', is_active: true },
  30  |       user_metadata: {},
  31  |     };
  32  |     localStorage.setItem(
  33  |       `sb-${projectRef}-auth-token`,
  34  |       JSON.stringify({
  35  |         access_token: `${header}.${payload}.mocksig`,
  36  |         token_type: 'bearer',
  37  |         expires_in: 3600,
  38  |         expires_at: 9999999999,
  39  |         refresh_token: 'mock-refresh-token',
  40  |         user: mockUser,
  41  |       }),
  42  |     );
  43  |   }, SUPABASE_PROJECT_REF);
  44  | 
  45  |   await page.route('**/auth/v1/**', (route) =>
  46  |     route.fulfill({
  47  |       status: 200,
  48  |       contentType: 'application/json',
  49  |       body: JSON.stringify({
  50  |         id: 'manager-user-id',
  51  |         aud: 'authenticated',
  52  |         email: 'manager@dahlheritagehomes.com',
  53  |         app_metadata: { role: 'manager', is_active: true },
  54  |       }),
  55  |     }),
  56  |   );
  57  | }
  58  | 
  59  | async function mockPendingApprovals(page: Page) {
  60  |   await page.route('**/rest/v1/approval_requirements**', (route) =>
  61  |     route.fulfill({
  62  |       status: 200,
  63  |       contentType: 'application/json',
  64  |       body: JSON.stringify([
  65  |         {
  66  |           id: 'req-1',
  67  |           approvable_type: 'expense',
  68  |           approvable_id: 'exp-1',
  69  |           approver_id: 'manager-user-id',
  70  |           status: 'pending',
  71  |           rejection_reason: null,
  72  |           created_at: '2026-04-20T10:00:00Z',
  73  |           updated_at: '2026-04-20T10:00:00Z',
  74  |           expenses: {
  75  |             id: 'exp-1',
  76  |             description: 'HVAC filter replacement',
  77  |             amount: 250.0,
  78  |             date: '2026-04-20',
  79  |             created_by: 'other-manager-id',
  80  |           },
  81  |           guaranteed_payments: null,
  82  |         },
  83  |         {
  84  |           id: 'req-2',
  85  |           approvable_type: 'guaranteed_payment',
  86  |           approvable_id: 'gp-1',
  87  |           approver_id: 'manager-user-id',
  88  |           status: 'pending',
  89  |           rejection_reason: null,
  90  |           created_at: '2026-04-18T09:00:00Z',
  91  |           updated_at: '2026-04-18T09:00:00Z',
  92  |           expenses: null,
  93  |           guaranteed_payments: {
  94  |             id: 'gp-1',
  95  |             work_description: 'Property inspections',
  96  |             hours_billed: 4.0,
  97  |             work_date: '2026-04-18',
  98  |             created_by: 'other-manager-id',
  99  |           },
  100 |         },
  101 |       ]),
  102 |     }),
  103 |   );
  104 | }
  105 | 
  106 | test.describe('Approvals page', () => {
  107 |   test.beforeEach(async ({ page }) => {
  108 |     await setupManagerSession(page);
  109 |     await mockPendingApprovals(page);
  110 |     await page.goto('/approvals');
  111 |   });
  112 | 
  113 |   test('page title is set', async ({ page }) => {
  114 |     await expect(page).toHaveTitle(/Approvals/);
  115 |   });
  116 | 
  117 |   test('displays the Approvals heading', async ({ page }) => {
  118 |     await expect(page.locator('h1')).toContainText('Approvals');
  119 |   });
  120 | 
  121 |   test('shows pending expense approval item', async ({ page }) => {
  122 |     await expect(page.getByText('HVAC filter replacement')).toBeVisible();
  123 |   });
  124 | 
  125 |   test('shows pending guaranteed payment approval item', async ({ page }) => {
> 126 |     await expect(page.getByText('Property inspections')).toBeVisible();
      |                                                          ^ Error: expect(locator).toBeVisible() failed
  127 |   });
  128 | 
  129 |   test('shows Approve buttons for pending items', async ({ page }) => {
  130 |     await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible();
  131 |   });
  132 | 
  133 |   test('shows Reject buttons for pending items', async ({ page }) => {
  134 |     await expect(page.getByRole('button', { name: /reject/i }).first()).toBeVisible();
  135 |   });
  136 | });
  137 | 
  138 | test.describe('Approvals page — empty state', () => {
  139 |   test.beforeEach(async ({ page }) => {
  140 |     await setupManagerSession(page);
  141 |     await page.route('**/rest/v1/approval_requirements**', (route) =>
  142 |       route.fulfill({
  143 |         status: 200,
  144 |         contentType: 'application/json',
  145 |         body: JSON.stringify([]),
  146 |       }),
  147 |     );
  148 |     await page.goto('/approvals');
  149 |   });
  150 | 
  151 |   test('shows empty state message when no pending approvals', async ({ page }) => {
  152 |     await expect(page.locator('body')).toContainText(/no pending/i);
  153 |   });
  154 | });
  155 | 
  156 | test.describe('Approvals auth guard', () => {
  157 |   test('redirects view_only users accessing /approvals', async ({ page }) => {
  158 |     await page.addInitScript((projectRef: string) => {
  159 |       const toBase64Url = (str: string) =>
  160 |         btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  161 |       const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  162 |       const payload = toBase64Url(
  163 |         JSON.stringify({
  164 |           sub: 'view-only-id',
  165 |           aud: 'authenticated',
  166 |           exp: 9999999999,
  167 |           iat: 1700000000,
  168 |           role: 'authenticated',
  169 |           email: 'viewer@dahlheritagehomes.com',
  170 |           app_metadata: { role: 'view_only', is_active: true },
  171 |         }),
  172 |       );
  173 |       const mockUser = {
  174 |         id: 'view-only-id',
  175 |         aud: 'authenticated',
  176 |         role: 'authenticated',
  177 |         email: 'viewer@dahlheritagehomes.com',
  178 |         email_confirmed_at: '2024-01-01T00:00:00.000Z',
  179 |         created_at: '2024-01-01T00:00:00.000Z',
  180 |         updated_at: '2024-01-01T00:00:00.000Z',
  181 |         app_metadata: { role: 'view_only', is_active: true },
  182 |         user_metadata: {},
  183 |       };
  184 |       localStorage.setItem(
  185 |         `sb-${projectRef}-auth-token`,
  186 |         JSON.stringify({
  187 |           access_token: `${header}.${payload}.mocksig`,
  188 |           token_type: 'bearer',
  189 |           expires_in: 3600,
  190 |           expires_at: 9999999999,
  191 |           refresh_token: 'mock-refresh-token',
  192 |           user: mockUser,
  193 |         }),
  194 |       );
  195 |     }, SUPABASE_PROJECT_REF);
  196 | 
  197 |     await page.route('**/auth/v1/**', (route) =>
  198 |       route.fulfill({
  199 |         status: 200,
  200 |         contentType: 'application/json',
  201 |         body: JSON.stringify({
  202 |           id: 'view-only-id',
  203 |           aud: 'authenticated',
  204 |           email: 'viewer@dahlheritagehomes.com',
  205 |           app_metadata: { role: 'view_only', is_active: true },
  206 |         }),
  207 |       }),
  208 |     );
  209 | 
  210 |     await page.goto('/approvals');
  211 |     await expect(page).not.toHaveURL(/\/approvals/);
  212 |   });
  213 | });
  214 | 
  215 | test.describe('Approvals nav badge', () => {
  216 |   test('shows a badge on the Approvals nav item when there are pending items', async ({
  217 |     page,
  218 |   }) => {
  219 |     await setupManagerSession(page);
  220 |     await mockPendingApprovals(page);
  221 |     await page.setViewportSize({ width: 1280, height: 800 });
  222 |     await page.goto('/dashboard');
  223 | 
  224 |     const approvalsLink = page.locator('app-sidebar a[href="/approvals"]');
  225 |     await expect(approvalsLink.locator('.badge')).toBeVisible();
  226 |   });
```