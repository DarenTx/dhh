import { test, expect, Page } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';

async function setupManagerSession(page: Page) {
  await page.addInitScript((projectRef: string) => {
    const toBase64Url = (str: string) =>
      btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url(
      JSON.stringify({
        sub: 'manager-user-id',
        aud: 'authenticated',
        exp: 9999999999,
        iat: 1700000000,
        role: 'authenticated',
        email: 'manager@dahlheritagehomes.com',
        app_metadata: { role: 'manager', is_active: true },
      }),
    );
    const mockUser = {
      id: 'manager-user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'manager@dahlheritagehomes.com',
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { role: 'manager', is_active: true },
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
        id: 'manager-user-id',
        aud: 'authenticated',
        email: 'manager@dahlheritagehomes.com',
        app_metadata: { role: 'manager', is_active: true },
      }),
    }),
  );

  // Mock app_settings endpoint
  await page.route('**/rest/v1/app_settings**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        expense_monthly_aggregate_threshold: 150,
        guaranteed_payment_hour_cap: 20,
      }),
    }),
  );

  // Mock irs_expense_categories endpoint
  await page.route('**/rest/v1/irs_expense_categories**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Advertising' },
        { id: 2, name: 'Repairs' },
      ]),
    }),
  );
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await page.goto('/settings');
  });

  test('renders the Settings heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('renders the Application Thresholds section', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText('Application Thresholds');
  });

  test('renders the expense threshold input', async ({ page }) => {
    await expect(page.locator('#threshold')).toBeVisible();
  });

  test('renders the hour cap input', async ({ page }) => {
    await expect(page.locator('#hourCap')).toBeVisible();
  });

  test('renders the save button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible();
  });

  test('renders the Expense Subcategories section', async ({ page }) => {
    await expect(page.locator('h2').nth(1)).toContainText('Expense Subcategories');
  });

  test('renders category accordion items', async ({ page }) => {
    await expect(page.locator('.category-section').first()).toBeVisible();
  });
});
