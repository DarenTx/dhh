import { test, expect, Page } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';

async function setupViewOnlySession(page: Page) {
  await page.addInitScript((projectRef: string) => {
    const toBase64Url = (str: string) =>
      btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url(
      JSON.stringify({
        sub: 'view-user-id',
        aud: 'authenticated',
        exp: 9999999999,
        iat: 1700000000,
        role: 'authenticated',
        email: 'viewer@dahlheritagehomes.com',
        app_metadata: { role: 'view_only', is_active: true },
      }),
    );
    const mockUser = {
      id: 'view-user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'viewer@dahlheritagehomes.com',
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { role: 'view_only', is_active: true },
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
        id: 'view-user-id',
        aud: 'authenticated',
        email: 'viewer@dahlheritagehomes.com',
        app_metadata: { role: 'view_only', is_active: true },
      }),
    }),
  );

  // Mock audit_log REST endpoint to return empty results
  await page.route('**/rest/v1/audit_log**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Content-Range': '0-0/0' },
      body: JSON.stringify([]),
    }),
  );
}

test.describe('Audit page', () => {
  test.beforeEach(async ({ page }) => {
    await setupViewOnlySession(page);
    await page.goto('/audit');
  });

  test('renders the Audit Log heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Audit Log');
  });

  test('renders the filter bar', async ({ page }) => {
    await expect(page.locator('.filters')).toBeVisible();
  });

  test('renders From date input', async ({ page }) => {
    await expect(page.locator('#from')).toBeVisible();
  });

  test('renders To date input', async ({ page }) => {
    await expect(page.locator('#to')).toBeVisible();
  });

  test('renders Table filter select', async ({ page }) => {
    await expect(page.locator('#table')).toBeVisible();
  });

  test('renders Operation filter select', async ({ page }) => {
    await expect(page.locator('#operation')).toBeVisible();
  });

  test('renders Apply and Clear buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
  });

  test('shows empty state when no records', async ({ page }) => {
    await expect(page.locator('.empty-state')).toContainText('No audit records found');
  });
});
