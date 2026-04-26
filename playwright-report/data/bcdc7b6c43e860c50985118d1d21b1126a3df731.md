# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guaranteed-payments.spec.ts >> Guaranteed Payment form >> GP form has a work date field
- Location: e2e\guaranteed-payments.spec.ts:133:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /log hours/i })

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
    - generic [ref=e51]:
      - generic [ref=e52]:
        - heading "Guaranteed Payments" [level=1] [ref=e53]
        - button "Log entry" [ref=e54] [cursor=pointer]:
          - img [ref=e55]
          - text: Log entry
      - generic [ref=e56]:
        - generic [ref=e57]:
          - button "My entries" [ref=e58] [cursor=pointer]
          - button "All managers" [ref=e59] [cursor=pointer]
        - generic [ref=e60]:
          - button [ref=e61] [cursor=pointer]:
            - img [ref=e62]
          - generic [ref=e63]: April 2026
          - button [disabled] [ref=e64]:
            - img [ref=e65]
      - generic [ref=e66]:
        - generic [ref=e67] [cursor=pointer]:
          - generic [ref=e68]:
            - generic [ref=e69]: 2026-04-20
            - generic [ref=e70]: Property inspections
          - generic [ref=e71]:
            - generic [ref=e72]: approved
            - generic [ref=e73]: 4 hrs
        - generic [ref=e74] [cursor=pointer]:
          - generic [ref=e75]:
            - generic [ref=e76]: 2026-04-18
            - generic [ref=e77]: Tenant communication and lease review
          - generic [ref=e78]:
            - generic [ref=e79]: pending
            - generic [ref=e80]: 2.5 hrs
        - generic [ref=e81]:
          - text: "Total:"
          - strong [ref=e82]: 6.50 hrs
```

# Test source

```ts
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
  59  | async function mockGPData(page: Page) {
  60  |   await page.route('**/rest/v1/guaranteed_payments**', (route) =>
  61  |     route.fulfill({
  62  |       status: 200,
  63  |       contentType: 'application/json',
  64  |       body: JSON.stringify([
  65  |         {
  66  |           id: 'gp-1',
  67  |           work_date: '2026-04-20',
  68  |           hours_billed: 4.0,
  69  |           work_description: 'Property inspections',
  70  |           status: 'approved',
  71  |           is_active: true,
  72  |           created_by: 'manager-user-id',
  73  |           created_at: '2026-04-20T09:00:00Z',
  74  |           updated_at: '2026-04-20T09:00:00Z',
  75  |         },
  76  |         {
  77  |           id: 'gp-2',
  78  |           work_date: '2026-04-18',
  79  |           hours_billed: 2.5,
  80  |           work_description: 'Tenant communication and lease review',
  81  |           status: 'pending',
  82  |           is_active: true,
  83  |           created_by: 'manager-user-id',
  84  |           created_at: '2026-04-18T10:00:00Z',
  85  |           updated_at: '2026-04-18T10:00:00Z',
  86  |         },
  87  |       ]),
  88  |     }),
  89  |   );
  90  | }
  91  | 
  92  | test.describe('Guaranteed Payments page', () => {
  93  |   test.beforeEach(async ({ page }) => {
  94  |     await setupManagerSession(page);
  95  |     await mockGPData(page);
  96  |     await page.goto('/guaranteed-payments');
  97  |   });
  98  | 
  99  |   test('page title is set', async ({ page }) => {
  100 |     await expect(page).toHaveTitle(/Guaranteed Payments/);
  101 |   });
  102 | 
  103 |   test('displays the Guaranteed Payments heading', async ({ page }) => {
  104 |     await expect(page.locator('h1')).toContainText('Guaranteed Payments');
  105 |   });
  106 | 
  107 |   test('shows the Log Hours button for managers', async ({ page }) => {
  108 |     await expect(page.getByRole('button', { name: /log hours/i })).toBeVisible();
  109 |   });
  110 | 
  111 |   test('renders GP rows with work descriptions', async ({ page }) => {
  112 |     await expect(page.getByText('Property inspections')).toBeVisible();
  113 |     await expect(page.getByText('Tenant communication and lease review')).toBeVisible();
  114 |   });
  115 | 
  116 |   test('shows approved status badge', async ({ page }) => {
  117 |     await expect(page.getByText(/approved/i).first()).toBeVisible();
  118 |   });
  119 | });
  120 | 
  121 | test.describe('Guaranteed Payment form', () => {
  122 |   test.beforeEach(async ({ page }) => {
  123 |     await setupManagerSession(page);
  124 |     await mockGPData(page);
  125 |     await page.goto('/guaranteed-payments');
  126 |   });
  127 | 
  128 |   test('opens the GP form when Log Hours is clicked', async ({ page }) => {
  129 |     await page.getByRole('button', { name: /log hours/i }).click();
  130 |     await expect(page.locator('app-guaranteed-payment-form')).toBeAttached();
  131 |   });
  132 | 
  133 |   test('GP form has a work date field', async ({ page }) => {
> 134 |     await page.getByRole('button', { name: /log hours/i }).click();
      |                                                            ^ Error: locator.click: Test timeout of 30000ms exceeded.
  135 |     await expect(page.locator('#workDate')).toBeVisible();
  136 |   });
  137 | 
  138 |   test('GP form has an hours field', async ({ page }) => {
  139 |     await page.getByRole('button', { name: /log hours/i }).click();
  140 |     await expect(page.locator('#hours')).toBeVisible();
  141 |   });
  142 | 
  143 |   test('GP form has a description field', async ({ page }) => {
  144 |     await page.getByRole('button', { name: /log hours/i }).click();
  145 |     await expect(page.locator('#workDescription')).toBeVisible();
  146 |   });
  147 | });
  148 | 
  149 | test.describe('Guaranteed Payments auth guard', () => {
  150 |   test('redirects view_only users accessing /guaranteed-payments', async ({ page }) => {
  151 |     await page.addInitScript((projectRef: string) => {
  152 |       const toBase64Url = (str: string) =>
  153 |         btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  154 |       const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  155 |       const payload = toBase64Url(
  156 |         JSON.stringify({
  157 |           sub: 'view-only-id',
  158 |           aud: 'authenticated',
  159 |           exp: 9999999999,
  160 |           iat: 1700000000,
  161 |           role: 'authenticated',
  162 |           email: 'viewer@dahlheritagehomes.com',
  163 |           app_metadata: { role: 'view_only', is_active: true },
  164 |         }),
  165 |       );
  166 |       const mockUser = {
  167 |         id: 'view-only-id',
  168 |         aud: 'authenticated',
  169 |         role: 'authenticated',
  170 |         email: 'viewer@dahlheritagehomes.com',
  171 |         email_confirmed_at: '2024-01-01T00:00:00.000Z',
  172 |         created_at: '2024-01-01T00:00:00.000Z',
  173 |         updated_at: '2024-01-01T00:00:00.000Z',
  174 |         app_metadata: { role: 'view_only', is_active: true },
  175 |         user_metadata: {},
  176 |       };
  177 |       localStorage.setItem(
  178 |         `sb-${projectRef}-auth-token`,
  179 |         JSON.stringify({
  180 |           access_token: `${header}.${payload}.mocksig`,
  181 |           token_type: 'bearer',
  182 |           expires_in: 3600,
  183 |           expires_at: 9999999999,
  184 |           refresh_token: 'mock-refresh-token',
  185 |           user: mockUser,
  186 |         }),
  187 |       );
  188 |     }, SUPABASE_PROJECT_REF);
  189 | 
  190 |     await page.route('**/auth/v1/**', (route) =>
  191 |       route.fulfill({
  192 |         status: 200,
  193 |         contentType: 'application/json',
  194 |         body: JSON.stringify({
  195 |           id: 'view-only-id',
  196 |           aud: 'authenticated',
  197 |           email: 'viewer@dahlheritagehomes.com',
  198 |           app_metadata: { role: 'view_only', is_active: true },
  199 |         }),
  200 |       }),
  201 |     );
  202 | 
  203 |     await page.goto('/guaranteed-payments');
  204 |     await expect(page).not.toHaveURL(/\/guaranteed-payments/);
  205 |   });
  206 | });
  207 | 
```