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
}

async function mockGPData(page: Page) {
  await page.route('**/rest/v1/guaranteed_payments**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'gp-1',
          work_date: '2026-04-20',
          hours_billed: 4.0,
          work_description: 'Property inspections',
          status: 'approved',
          is_active: true,
          created_by: 'manager-user-id',
          created_at: '2026-04-20T09:00:00Z',
          updated_at: '2026-04-20T09:00:00Z',
        },
        {
          id: 'gp-2',
          work_date: '2026-04-18',
          hours_billed: 2.5,
          work_description: 'Tenant communication and lease review',
          status: 'pending',
          is_active: true,
          created_by: 'manager-user-id',
          created_at: '2026-04-18T10:00:00Z',
          updated_at: '2026-04-18T10:00:00Z',
        },
      ]),
    }),
  );
}

test.describe('Guaranteed Payments page', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await mockGPData(page);
    await page.goto('/guaranteed-payments');
  });

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/Guaranteed Payments/);
  });

  test('displays the Guaranteed Payments heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Guaranteed Payments');
  });

  test('shows the Log Hours button for managers', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log hours/i })).toBeVisible();
  });

  test('renders GP rows with work descriptions', async ({ page }) => {
    await expect(page.getByText('Property inspections')).toBeVisible();
    await expect(page.getByText('Tenant communication and lease review')).toBeVisible();
  });

  test('shows approved status badge', async ({ page }) => {
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });
});

test.describe('Guaranteed Payment form', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await mockGPData(page);
    await page.goto('/guaranteed-payments');
  });

  test('opens the GP form when Log Hours is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /log hours/i }).click();
    await expect(page.locator('app-guaranteed-payment-form')).toBeAttached();
  });

  test('GP form has a work date field', async ({ page }) => {
    await page.getByRole('button', { name: /log hours/i }).click();
    await expect(page.locator('#workDate')).toBeVisible();
  });

  test('GP form has an hours field', async ({ page }) => {
    await page.getByRole('button', { name: /log hours/i }).click();
    await expect(page.locator('#hours')).toBeVisible();
  });

  test('GP form has a description field', async ({ page }) => {
    await page.getByRole('button', { name: /log hours/i }).click();
    await expect(page.locator('#workDescription')).toBeVisible();
  });
});

test.describe('Guaranteed Payments auth guard', () => {
  test('redirects view_only users accessing /guaranteed-payments', async ({ page }) => {
    await page.addInitScript((projectRef: string) => {
      const toBase64Url = (str: string) =>
        btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = toBase64Url(
        JSON.stringify({
          sub: 'view-only-id',
          aud: 'authenticated',
          exp: 9999999999,
          iat: 1700000000,
          role: 'authenticated',
          email: 'viewer@dahlheritagehomes.com',
          app_metadata: { role: 'view_only', is_active: true },
        }),
      );
      const mockUser = {
        id: 'view-only-id',
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
          id: 'view-only-id',
          aud: 'authenticated',
          email: 'viewer@dahlheritagehomes.com',
          app_metadata: { role: 'view_only', is_active: true },
        }),
      }),
    );

    await page.goto('/guaranteed-payments');
    await expect(page).not.toHaveURL(/\/guaranteed-payments/);
  });
});
