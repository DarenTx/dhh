# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: expenses.spec.ts >> Expense form >> expense form has an amount field
- Location: e2e\expenses.spec.ts:181:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /add expense/i })

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
        - heading "Expenses" [level=1] [ref=e53]
        - button "Log expense" [ref=e54] [cursor=pointer]:
          - img [ref=e55]
          - text: Log expense
      - generic [ref=e57]:
        - generic [ref=e58] [cursor=pointer]:
          - generic [ref=e59]:
            - img [ref=e60]
            - generic [ref=e61]: April 2026
            - generic [ref=e62]: 24 expenses
          - generic [ref=e63]: $4026.00
        - generic [ref=e64]:
          - generic [ref=e65] [cursor=pointer]:
            - generic [ref=e66]:
              - generic [ref=e67]: HVAC filter replacement
              - generic [ref=e68]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e69]:
              - generic [ref=e70]: approved
              - generic [ref=e71]: $250.00
          - generic [ref=e72] [cursor=pointer]:
            - generic [ref=e73]:
              - generic [ref=e74]: HVAC filter replacement
              - generic [ref=e75]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e76]:
              - generic [ref=e77]: approved
              - generic [ref=e78]: $250.00
          - generic [ref=e79] [cursor=pointer]:
            - generic [ref=e80]:
              - generic [ref=e81]: HVAC filter replacement
              - generic [ref=e82]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e83]:
              - generic [ref=e84]: approved
              - generic [ref=e85]: $250.00
          - generic [ref=e86] [cursor=pointer]:
            - generic [ref=e87]:
              - generic [ref=e88]: HVAC filter replacement
              - generic [ref=e89]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e90]:
              - generic [ref=e91]: approved
              - generic [ref=e92]: $250.00
          - generic [ref=e93] [cursor=pointer]:
            - generic [ref=e94]:
              - generic [ref=e95]: HVAC filter replacement
              - generic [ref=e96]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e97]:
              - generic [ref=e98]: approved
              - generic [ref=e99]: $250.00
          - generic [ref=e100] [cursor=pointer]:
            - generic [ref=e101]:
              - generic [ref=e102]: HVAC filter replacement
              - generic [ref=e103]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e104]:
              - generic [ref=e105]: approved
              - generic [ref=e106]: $250.00
          - generic [ref=e107] [cursor=pointer]:
            - generic [ref=e108]:
              - generic [ref=e109]: HVAC filter replacement
              - generic [ref=e110]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e111]:
              - generic [ref=e112]: approved
              - generic [ref=e113]: $250.00
          - generic [ref=e114] [cursor=pointer]:
            - generic [ref=e115]:
              - generic [ref=e116]: HVAC filter replacement
              - generic [ref=e117]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e118]:
              - generic [ref=e119]: approved
              - generic [ref=e120]: $250.00
          - generic [ref=e121] [cursor=pointer]:
            - generic [ref=e122]:
              - generic [ref=e123]: HVAC filter replacement
              - generic [ref=e124]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e125]:
              - generic [ref=e126]: approved
              - generic [ref=e127]: $250.00
          - generic [ref=e128] [cursor=pointer]:
            - generic [ref=e129]:
              - generic [ref=e130]: HVAC filter replacement
              - generic [ref=e131]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e132]:
              - generic [ref=e133]: approved
              - generic [ref=e134]: $250.00
          - generic [ref=e135] [cursor=pointer]:
            - generic [ref=e136]:
              - generic [ref=e137]: HVAC filter replacement
              - generic [ref=e138]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e139]:
              - generic [ref=e140]: approved
              - generic [ref=e141]: $250.00
          - generic [ref=e142] [cursor=pointer]:
            - generic [ref=e143]:
              - generic [ref=e144]: HVAC filter replacement
              - generic [ref=e145]: Cleaning and maintenance · HVAC maintenance
            - generic [ref=e146]:
              - generic [ref=e147]: approved
              - generic [ref=e148]: $250.00
          - generic [ref=e149] [cursor=pointer]:
            - generic [ref=e150]:
              - generic [ref=e151]: Lawn care service
              - generic [ref=e152]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e153]:
              - generic [ref=e154]: pending
              - generic [ref=e155]: $85.50
          - generic [ref=e156] [cursor=pointer]:
            - generic [ref=e157]:
              - generic [ref=e158]: Lawn care service
              - generic [ref=e159]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e160]:
              - generic [ref=e161]: pending
              - generic [ref=e162]: $85.50
          - generic [ref=e163] [cursor=pointer]:
            - generic [ref=e164]:
              - generic [ref=e165]: Lawn care service
              - generic [ref=e166]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e167]:
              - generic [ref=e168]: pending
              - generic [ref=e169]: $85.50
          - generic [ref=e170] [cursor=pointer]:
            - generic [ref=e171]:
              - generic [ref=e172]: Lawn care service
              - generic [ref=e173]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e174]:
              - generic [ref=e175]: pending
              - generic [ref=e176]: $85.50
          - generic [ref=e177] [cursor=pointer]:
            - generic [ref=e178]:
              - generic [ref=e179]: Lawn care service
              - generic [ref=e180]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e181]:
              - generic [ref=e182]: pending
              - generic [ref=e183]: $85.50
          - generic [ref=e184] [cursor=pointer]:
            - generic [ref=e185]:
              - generic [ref=e186]: Lawn care service
              - generic [ref=e187]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e188]:
              - generic [ref=e189]: pending
              - generic [ref=e190]: $85.50
          - generic [ref=e191] [cursor=pointer]:
            - generic [ref=e192]:
              - generic [ref=e193]: Lawn care service
              - generic [ref=e194]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e195]:
              - generic [ref=e196]: pending
              - generic [ref=e197]: $85.50
          - generic [ref=e198] [cursor=pointer]:
            - generic [ref=e199]:
              - generic [ref=e200]: Lawn care service
              - generic [ref=e201]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e202]:
              - generic [ref=e203]: pending
              - generic [ref=e204]: $85.50
          - generic [ref=e205] [cursor=pointer]:
            - generic [ref=e206]:
              - generic [ref=e207]: Lawn care service
              - generic [ref=e208]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e209]:
              - generic [ref=e210]: pending
              - generic [ref=e211]: $85.50
          - generic [ref=e212] [cursor=pointer]:
            - generic [ref=e213]:
              - generic [ref=e214]: Lawn care service
              - generic [ref=e215]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e216]:
              - generic [ref=e217]: pending
              - generic [ref=e218]: $85.50
          - generic [ref=e219] [cursor=pointer]:
            - generic [ref=e220]:
              - generic [ref=e221]: Lawn care service
              - generic [ref=e222]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e223]:
              - generic [ref=e224]: pending
              - generic [ref=e225]: $85.50
          - generic [ref=e226] [cursor=pointer]:
            - generic [ref=e227]:
              - generic [ref=e228]: Lawn care service
              - generic [ref=e229]: Cleaning and maintenance · Landscaping / lawn care · 123 Main St
            - generic [ref=e230]:
              - generic [ref=e231]: pending
              - generic [ref=e232]: $85.50
```

# Test source

```ts
  82  |         {
  83  |           id: 'exp-2',
  84  |           date: '2026-04-10',
  85  |           amount: 85.5,
  86  |           description: 'Lawn care service',
  87  |           irs_category_id: 3,
  88  |           subcategory_id: 'sub-2',
  89  |           property_id: 'prop-1',
  90  |           status: 'pending',
  91  |           is_active: true,
  92  |           created_by: 'manager-user-id',
  93  |           created_at: '2026-04-10T09:00:00Z',
  94  |           updated_at: '2026-04-10T09:00:00Z',
  95  |           irs_expense_categories: { id: 3, name: 'Cleaning and maintenance' },
  96  |           expense_subcategories: { id: 'sub-2', name: 'Landscaping / lawn care' },
  97  |           properties: { id: 'prop-1', address_line1: '123 Main St' },
  98  |         },
  99  |       ]),
  100 |     }),
  101 |   );
  102 | }
  103 | 
  104 | test.describe('Expenses page', () => {
  105 |   test.beforeEach(async ({ page }) => {
  106 |     await setupManagerSession(page);
  107 |     await mockExpensesData(page);
  108 |     await page.goto('/expenses');
  109 |   });
  110 | 
  111 |   test('page title is set', async ({ page }) => {
  112 |     await expect(page).toHaveTitle(/Expenses/);
  113 |   });
  114 | 
  115 |   test('displays the Expenses heading', async ({ page }) => {
  116 |     await expect(page.locator('h1')).toContainText('Expenses');
  117 |   });
  118 | 
  119 |   test('shows the Add Expense button for managers', async ({ page }) => {
  120 |     await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
  121 |   });
  122 | 
  123 |   test('renders expense rows', async ({ page }) => {
  124 |     await expect(page.getByText('HVAC filter replacement')).toBeVisible();
  125 |     await expect(page.getByText('Lawn care service')).toBeVisible();
  126 |   });
  127 | 
  128 |   test('shows approved status badge', async ({ page }) => {
  129 |     await expect(page.getByText(/approved/i).first()).toBeVisible();
  130 |   });
  131 | 
  132 |   test('shows pending status badge', async ({ page }) => {
  133 |     await expect(page.getByText(/pending/i).first()).toBeVisible();
  134 |   });
  135 | });
  136 | 
  137 | test.describe('Expense form', () => {
  138 |   test.beforeEach(async ({ page }) => {
  139 |     await setupManagerSession(page);
  140 |     await mockExpensesData(page);
  141 |     await page.route('**/rest/v1/irs_expense_categories**', (route) =>
  142 |       route.fulfill({
  143 |         status: 200,
  144 |         contentType: 'application/json',
  145 |         body: JSON.stringify([
  146 |           { id: 3, name: 'Cleaning and maintenance' },
  147 |           { id: 10, name: 'Repairs' },
  148 |         ]),
  149 |       }),
  150 |     );
  151 |     await page.route('**/rest/v1/expense_subcategories**', (route) =>
  152 |       route.fulfill({
  153 |         status: 200,
  154 |         contentType: 'application/json',
  155 |         body: JSON.stringify([
  156 |           { id: 'sub-1', irs_category_id: 3, name: 'HVAC maintenance' },
  157 |           { id: 'sub-2', irs_category_id: 3, name: 'Landscaping / lawn care' },
  158 |         ]),
  159 |       }),
  160 |     );
  161 |     await page.route('**/rest/v1/properties**', (route) =>
  162 |       route.fulfill({
  163 |         status: 200,
  164 |         contentType: 'application/json',
  165 |         body: JSON.stringify([{ id: 'prop-1', address_line1: '123 Main St' }]),
  166 |       }),
  167 |     );
  168 |     await page.goto('/expenses');
  169 |   });
  170 | 
  171 |   test('opens the expense form when Add Expense is clicked', async ({ page }) => {
  172 |     await page.getByRole('button', { name: /add expense/i }).click();
  173 |     await expect(page.locator('app-expense-form')).toBeAttached();
  174 |   });
  175 | 
  176 |   test('expense form has a date field', async ({ page }) => {
  177 |     await page.getByRole('button', { name: /add expense/i }).click();
  178 |     await expect(page.locator('#expenseDate')).toBeVisible();
  179 |   });
  180 | 
  181 |   test('expense form has an amount field', async ({ page }) => {
> 182 |     await page.getByRole('button', { name: /add expense/i }).click();
      |                                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  183 |     await expect(page.locator('#amount')).toBeVisible();
  184 |   });
  185 | 
  186 |   test('expense form has a description field', async ({ page }) => {
  187 |     await page.getByRole('button', { name: /add expense/i }).click();
  188 |     await expect(page.locator('#description')).toBeVisible();
  189 |   });
  190 | });
  191 | 
  192 | test.describe('Expense auth guard', () => {
  193 |   test('redirects view_only users accessing /expenses', async ({ page }) => {
  194 |     await page.addInitScript((projectRef: string) => {
  195 |       const toBase64Url = (str: string) =>
  196 |         btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  197 |       const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  198 |       const payload = toBase64Url(
  199 |         JSON.stringify({
  200 |           sub: 'view-only-id',
  201 |           aud: 'authenticated',
  202 |           exp: 9999999999,
  203 |           iat: 1700000000,
  204 |           role: 'authenticated',
  205 |           email: 'viewer@dahlheritagehomes.com',
  206 |           app_metadata: { role: 'view_only', is_active: true },
  207 |         }),
  208 |       );
  209 |       const mockUser = {
  210 |         id: 'view-only-id',
  211 |         aud: 'authenticated',
  212 |         role: 'authenticated',
  213 |         email: 'viewer@dahlheritagehomes.com',
  214 |         email_confirmed_at: '2024-01-01T00:00:00.000Z',
  215 |         created_at: '2024-01-01T00:00:00.000Z',
  216 |         updated_at: '2024-01-01T00:00:00.000Z',
  217 |         app_metadata: { role: 'view_only', is_active: true },
  218 |         user_metadata: {},
  219 |       };
  220 |       localStorage.setItem(
  221 |         `sb-${projectRef}-auth-token`,
  222 |         JSON.stringify({
  223 |           access_token: `${header}.${payload}.mocksig`,
  224 |           token_type: 'bearer',
  225 |           expires_in: 3600,
  226 |           expires_at: 9999999999,
  227 |           refresh_token: 'mock-refresh-token',
  228 |           user: mockUser,
  229 |         }),
  230 |       );
  231 |     }, SUPABASE_PROJECT_REF);
  232 | 
  233 |     await page.route('**/auth/v1/**', (route) =>
  234 |       route.fulfill({
  235 |         status: 200,
  236 |         contentType: 'application/json',
  237 |         body: JSON.stringify({
  238 |           id: 'view-only-id',
  239 |           aud: 'authenticated',
  240 |           email: 'viewer@dahlheritagehomes.com',
  241 |           app_metadata: { role: 'view_only', is_active: true },
  242 |         }),
  243 |       }),
  244 |     );
  245 | 
  246 |     await page.goto('/expenses');
  247 |     await expect(page).not.toHaveURL(/\/expenses/);
  248 |   });
  249 | });
  250 | 
```