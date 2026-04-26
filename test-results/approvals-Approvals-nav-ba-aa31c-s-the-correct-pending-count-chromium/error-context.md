# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approvals.spec.ts >> Approvals nav badge >> badge shows the correct pending count
- Location: e2e\approvals.spec.ts:228:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('app-sidebar a[href="/approvals"] .badge')
Expected substring: "2"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('app-sidebar a[href="/approvals"] .badge')

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
      - heading "Dashboard" [level=1] [ref=e53]
      - generic [ref=e54]:
        - generic [ref=e55]:
          - img [ref=e57]
          - paragraph
          - paragraph [ref=e58]: Total properties
        - generic [ref=e59]:
          - img [ref=e61]
          - paragraph
          - paragraph [ref=e62]: Occupied
        - generic [ref=e63]:
          - img [ref=e65]
          - paragraph
          - paragraph [ref=e66]: Vacant
      - generic [ref=e67]:
        - heading "Quick links" [level=2] [ref=e68]
        - generic [ref=e69]:
          - link "Properties" [ref=e70] [cursor=pointer]:
            - /url: /properties
            - img [ref=e71]:
              - img [ref=e72]
            - text: Properties
          - link "Tenants" [ref=e74] [cursor=pointer]:
            - /url: /tenants
            - img [ref=e75]:
              - img [ref=e76]
            - text: Tenants
          - link "Expenses" [ref=e78] [cursor=pointer]:
            - /url: /expenses
            - img [ref=e79]:
              - img [ref=e80]
            - text: Expenses
          - link "Approvals" [ref=e82] [cursor=pointer]:
            - /url: /approvals
            - img [ref=e83]:
              - img [ref=e84]
            - text: Approvals
      - generic [ref=e86]:
        - heading "Recent expenses" [level=2] [ref=e87]
        - link "View all expenses" [ref=e88] [cursor=pointer]:
          - /url: /expenses
          - img [ref=e89]
          - text: View all expenses
```

# Test source

```ts
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
  227 | 
  228 |   test('badge shows the correct pending count', async ({ page }) => {
  229 |     await setupManagerSession(page);
  230 |     await mockPendingApprovals(page);
  231 |     await page.setViewportSize({ width: 1280, height: 800 });
  232 |     await page.goto('/dashboard');
  233 | 
  234 |     const badge = page.locator('app-sidebar a[href="/approvals"] .badge');
> 235 |     await expect(badge).toContainText('2');
      |                         ^ Error: expect(locator).toContainText(expected) failed
  236 |   });
  237 | });
  238 | 
```