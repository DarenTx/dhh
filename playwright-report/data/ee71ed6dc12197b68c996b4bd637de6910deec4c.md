# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> Shell layout >> sidebar shows the DHH brand name
- Location: e2e\shell.spec.ts:73:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('app-sidebar .nav-brand')
Expected substring: "DHH"
Received string:    "Dahl Heritage Homes"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('app-sidebar .nav-brand')
    8 × locator resolved to <div class="nav-brand" _ngcontent-ng-c2803134148="">…</div>
      - unexpected value "Dahl Heritage Homes"

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
      - link "Admin" [ref=e45] [cursor=pointer]:
        - /url: /admin
        - img [ref=e46]:
          - img [ref=e47]
        - generic [ref=e49]: Admin
      - link "Audit" [ref=e50] [cursor=pointer]:
        - /url: /audit
        - img [ref=e51]:
          - img [ref=e52]
        - generic [ref=e54]: Audit
  - main [ref=e55]:
    - generic [ref=e57]:
      - heading "Dashboard" [level=1] [ref=e58]
      - generic [ref=e59]:
        - generic [ref=e60]:
          - img [ref=e62]
          - paragraph
          - paragraph [ref=e63]: Total properties
        - generic [ref=e64]:
          - img [ref=e66]
          - paragraph
          - paragraph [ref=e67]: Occupied
        - generic [ref=e68]:
          - img [ref=e70]
          - paragraph
          - paragraph [ref=e71]: Vacant
      - generic [ref=e72]:
        - heading "Quick links" [level=2] [ref=e73]
        - generic [ref=e74]:
          - link "Properties" [ref=e75] [cursor=pointer]:
            - /url: /properties
            - img [ref=e76]:
              - img [ref=e77]
            - text: Properties
          - link "Tenants" [ref=e79] [cursor=pointer]:
            - /url: /tenants
            - img [ref=e80]:
              - img [ref=e81]
            - text: Tenants
          - link "Expenses" [ref=e83] [cursor=pointer]:
            - /url: /expenses
            - img [ref=e84]:
              - img [ref=e85]
            - text: Expenses
          - link "Approvals" [ref=e87] [cursor=pointer]:
            - /url: /approvals
            - img [ref=e88]:
              - img [ref=e89]
            - text: Approvals
      - generic [ref=e91]:
        - heading "Recent expenses" [level=2] [ref=e92]
        - link "View all expenses" [ref=e93] [cursor=pointer]:
          - /url: /expenses
          - img [ref=e94]
          - text: View all expenses
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';
  4  | 
  5  | test.describe('Shell layout', () => {
  6  |   test.beforeEach(async ({ page }) => {
  7  |     await page.addInitScript((projectRef: string) => {
  8  |       const toBase64Url = (str: string) =>
  9  |         btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  10 |       const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  11 |       const payload = toBase64Url(
  12 |         JSON.stringify({
  13 |           sub: 'admin-user-id',
  14 |           aud: 'authenticated',
  15 |           exp: 9999999999,
  16 |           iat: 1700000000,
  17 |           role: 'authenticated',
  18 |           email: 'admin@dahlheritagehomes.com',
  19 |           app_metadata: { role: 'admin', is_active: true },
  20 |         }),
  21 |       );
  22 |       const mockUser = {
  23 |         id: 'admin-user-id',
  24 |         aud: 'authenticated',
  25 |         role: 'authenticated',
  26 |         email: 'admin@dahlheritagehomes.com',
  27 |         email_confirmed_at: '2024-01-01T00:00:00.000Z',
  28 |         created_at: '2024-01-01T00:00:00.000Z',
  29 |         updated_at: '2024-01-01T00:00:00.000Z',
  30 |         app_metadata: { role: 'admin', is_active: true },
  31 |         user_metadata: {},
  32 |       };
  33 |       localStorage.setItem(
  34 |         `sb-${projectRef}-auth-token`,
  35 |         JSON.stringify({
  36 |           access_token: `${header}.${payload}.mocksig`,
  37 |           token_type: 'bearer',
  38 |           expires_in: 3600,
  39 |           expires_at: 9999999999,
  40 |           refresh_token: 'mock-refresh-token',
  41 |           user: mockUser,
  42 |         }),
  43 |       );
  44 |     }, SUPABASE_PROJECT_REF);
  45 | 
  46 |     await page.route('**/auth/v1/**', (route) =>
  47 |       route.fulfill({
  48 |         status: 200,
  49 |         contentType: 'application/json',
  50 |         body: JSON.stringify({
  51 |           id: 'admin-user-id',
  52 |           aud: 'authenticated',
  53 |           role: 'authenticated',
  54 |           email: 'admin@dahlheritagehomes.com',
  55 |           app_metadata: { role: 'admin', is_active: true },
  56 |         }),
  57 |       }),
  58 |     );
  59 | 
  60 |     await page.goto('/dashboard');
  61 |   });
  62 | 
  63 |   test('sidebar is present on desktop', async ({ page }) => {
  64 |     await page.setViewportSize({ width: 1280, height: 800 });
  65 |     await expect(page.locator('app-shell .sidebar')).toBeAttached();
  66 |   });
  67 | 
  68 |   test('bottom nav is present on mobile', async ({ page }) => {
  69 |     await page.setViewportSize({ width: 375, height: 812 });
  70 |     await expect(page.locator('app-shell .bottom-nav')).toBeAttached();
  71 |   });
  72 | 
  73 |   test('sidebar shows the DHH brand name', async ({ page }) => {
> 74 |     await expect(page.locator('app-sidebar .nav-brand')).toContainText('DHH');
     |                                                          ^ Error: expect(locator).toContainText(expected) failed
  75 |   });
  76 | 
  77 |   test('sidebar shows the Dashboard nav link', async ({ page }) => {
  78 |     await expect(page.locator('app-sidebar nav')).toContainText('Dashboard');
  79 |   });
  80 | 
  81 |   test('sidebar shows the Admin link for admin role', async ({ page }) => {
  82 |     await expect(page.locator('app-sidebar nav')).toContainText('Admin');
  83 |   });
  84 | });
  85 | 
```