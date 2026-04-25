import { test, expect, Page } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';

async function setupAdminSession(page: Page) {
  await page.addInitScript((projectRef: string) => {
    const toBase64Url = (str: string) =>
      btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url(
      JSON.stringify({
        sub: 'admin-user-id',
        aud: 'authenticated',
        exp: 9999999999,
        iat: 1700000000,
        role: 'authenticated',
        email: 'admin@dahlheritagehomes.com',
        app_metadata: { role: 'admin', is_active: true },
      }),
    );
    const mockUser = {
      id: 'admin-user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@dahlheritagehomes.com',
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { role: 'admin', is_active: true },
      user_metadata: {},
    };
    localStorage.setItem(
      `sb-${projectRef}-auth-token`,
      JSON.stringify({
        access_token: `${header}.${payload}.mocksig`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 9999999999,
        refresh_token: 'mock-refresh-token',
        user: mockUser,
      }),
    );
  }, SUPABASE_PROJECT_REF);

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-user-id',
        aud: 'authenticated',
        email: 'admin@dahlheritagehomes.com',
        app_metadata: { role: 'admin', is_active: true },
      }),
    }),
  );

  // Mock the user_roles REST endpoint to return an empty list
  await page.route('**/rest/v1/user_roles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Content-Range': '0-0/0' },
      body: JSON.stringify([]),
    }),
  );
}

test.describe('Admin page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminSession(page);
    await page.goto('/admin');
  });

  test('renders the Users heading', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText('Users');
  });

  test('renders the Invite User section', async ({ page }) => {
    await expect(page.locator('h2').nth(1)).toContainText('Invite User');
  });

  test('renders the invite form with email and role fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('submit button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /send invite/i })).toBeVisible();
  });

  test('empty users list shows no table rows', async ({ page }) => {
    // Mock returns empty list so no rows should be present
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(0);
  });
});
