# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Home page >> last step should reference build verification
- Location: e2e\home.spec.ts:92:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.step__title').last()
Expected substring: "Verified the build"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.step__title').last()

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
      - link "Audit" [ref=e24] [cursor=pointer]:
        - /url: /audit
        - img [ref=e25]:
          - img [ref=e26]
        - generic [ref=e28]: Audit
  - main [ref=e29]:
    - generic [ref=e31]:
      - heading "Dashboard" [level=1] [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]:
          - img [ref=e36]
          - paragraph
          - paragraph [ref=e37]: Total properties
        - generic [ref=e38]:
          - img [ref=e40]
          - paragraph
          - paragraph [ref=e41]: Occupied
        - generic [ref=e42]:
          - img [ref=e44]
          - paragraph
          - paragraph [ref=e45]: Vacant
      - generic [ref=e46]:
        - heading "Quick links" [level=2] [ref=e47]
        - generic [ref=e48]:
          - link "Properties" [ref=e49] [cursor=pointer]:
            - /url: /properties
            - img [ref=e50]:
              - img [ref=e51]
            - text: Properties
          - link "Tenants" [ref=e53] [cursor=pointer]:
            - /url: /tenants
            - img [ref=e54]:
              - img [ref=e55]
            - text: Tenants
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';
  4   | 
  5   | test.describe('Home page', () => {
  6   |   test.beforeEach(async ({ page }) => {
  7   |     // Inject a mock Supabase session into localStorage before the page loads so
  8   |     // the authGuard finds a valid session and allows access to the home route.
  9   |     await page.addInitScript((projectRef: string) => {
  10  |       const toBase64Url = (str: string) =>
  11  |         btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  12  |       const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  13  |       const payload = toBase64Url(
  14  |         JSON.stringify({
  15  |           sub: 'test-user-id',
  16  |           aud: 'authenticated',
  17  |           exp: 9999999999,
  18  |           iat: 1700000000,
  19  |           role: 'authenticated',
  20  |           email: 'test@example.com',
  21  |         }),
  22  |       );
  23  |       const mockUser = {
  24  |         id: 'test-user-id',
  25  |         aud: 'authenticated',
  26  |         role: 'authenticated',
  27  |         email: 'test@example.com',
  28  |         email_confirmed_at: '2024-01-01T00:00:00.000Z',
  29  |         created_at: '2024-01-01T00:00:00.000Z',
  30  |         updated_at: '2024-01-01T00:00:00.000Z',
  31  |         app_metadata: {},
  32  |         user_metadata: {},
  33  |       };
  34  |       localStorage.setItem(
  35  |         `sb-${projectRef}-auth-token`,
  36  |         JSON.stringify({
  37  |           access_token: `${header}.${payload}.mocksig`,
  38  |           token_type: 'bearer',
  39  |           expires_in: 3600,
  40  |           expires_at: 9999999999,
  41  |           refresh_token: 'mock-refresh-token',
  42  |           user: mockUser,
  43  |         }),
  44  |       );
  45  |     }, SUPABASE_PROJECT_REF);
  46  | 
  47  |     // Intercept Supabase auth API calls as a safety net to prevent network errors.
  48  |     await page.route('**/auth/v1/**', (route) =>
  49  |       route.fulfill({
  50  |         status: 200,
  51  |         contentType: 'application/json',
  52  |         body: JSON.stringify({
  53  |           id: 'test-user-id',
  54  |           aud: 'authenticated',
  55  |           role: 'authenticated',
  56  |           email: 'test@example.com',
  57  |         }),
  58  |       }),
  59  |     );
  60  | 
  61  |     await page.goto('/');
  62  |   });
  63  | 
  64  |   test('should display the Angular PWA heading', async ({ page }) => {
  65  |     await expect(page.locator('h1')).toHaveText('Angular PWA');
  66  |   });
  67  | 
  68  |   test('should display the subtitle', async ({ page }) => {
  69  |     await expect(page.locator('.hero__subtitle')).toContainText(
  70  |       'Build steps performed to scaffold this project',
  71  |     );
  72  |   });
  73  | 
  74  |   test('should render all 7 build steps', async ({ page }) => {
  75  |     const steps = page.locator('.step');
  76  |     await expect(steps).toHaveCount(7);
  77  |   });
  78  | 
  79  |   test('should display step numbers 1 through 7', async ({ page }) => {
  80  |     const numbers = page.locator('.step__number');
  81  |     await expect(numbers).toHaveCount(7);
  82  |     for (let i = 0; i < 7; i++) {
  83  |       await expect(numbers.nth(i)).toHaveText(String(i + 1));
  84  |     }
  85  |   });
  86  | 
  87  |   test('first step should reference Angular CLI verification', async ({ page }) => {
  88  |     const firstStepTitle = page.locator('.step__title').first();
  89  |     await expect(firstStepTitle).toContainText('Verified Angular CLI');
  90  |   });
  91  | 
  92  |   test('last step should reference build verification', async ({ page }) => {
  93  |     const lastStepTitle = page.locator('.step__title').last();
> 94  |     await expect(lastStepTitle).toContainText('Verified the build');
      |                                 ^ Error: expect(locator).toContainText(expected) failed
  95  |   });
  96  | 
  97  |   test('steps with commands should show a code block', async ({ page }) => {
  98  |     const codeBlocks = page.locator('.step__command');
  99  |     // Steps 1-4, 6, 7 have commands (6 total)
  100 |     await expect(codeBlocks).toHaveCount(6);
  101 |   });
  102 | 
  103 |   test('should have a web app manifest link (PWA)', async ({ page }) => {
  104 |     const manifestLink = page.locator('link[rel="manifest"]');
  105 |     await expect(manifestLink).toHaveAttribute('href', 'manifest.webmanifest');
  106 |   });
  107 | 
  108 |   test('page title should be set', async ({ page }) => {
  109 |     await expect(page).toHaveTitle(/Dhh/i);
  110 |   });
  111 | });
  112 | 
```