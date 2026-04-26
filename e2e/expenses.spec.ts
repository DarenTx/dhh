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

async function mockExpensesData(page: Page) {
  await page.route('**/rest/v1/expenses**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'exp-1',
          date: '2026-04-15',
          amount: 250.0,
          description: 'HVAC filter replacement',
          irs_category_id: 3,
          subcategory_id: 'sub-1',
          property_id: null,
          status: 'approved',
          is_active: true,
          created_by: 'manager-user-id',
          created_at: '2026-04-15T10:00:00Z',
          updated_at: '2026-04-15T10:00:00Z',
          irs_expense_categories: { id: 3, name: 'Cleaning and maintenance' },
          expense_subcategories: { id: 'sub-1', name: 'HVAC maintenance' },
          properties: null,
        },
        {
          id: 'exp-2',
          date: '2026-04-10',
          amount: 85.5,
          description: 'Lawn care service',
          irs_category_id: 3,
          subcategory_id: 'sub-2',
          property_id: 'prop-1',
          status: 'pending',
          is_active: true,
          created_by: 'manager-user-id',
          created_at: '2026-04-10T09:00:00Z',
          updated_at: '2026-04-10T09:00:00Z',
          irs_expense_categories: { id: 3, name: 'Cleaning and maintenance' },
          expense_subcategories: { id: 'sub-2', name: 'Landscaping / lawn care' },
          properties: { id: 'prop-1', address_line1: '123 Main St' },
        },
      ]),
    }),
  );
}

test.describe('Expenses page', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await mockExpensesData(page);
    await page.goto('/expenses');
  });

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/Expenses/);
  });

  test('displays the Expenses heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Expenses');
  });

  test('shows the Add Expense button for managers', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
  });

  test('renders expense rows', async ({ page }) => {
    await expect(page.getByText('HVAC filter replacement')).toBeVisible();
    await expect(page.getByText('Lawn care service')).toBeVisible();
  });

  test('shows approved status badge', async ({ page }) => {
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });

  test('shows pending status badge', async ({ page }) => {
    await expect(page.getByText(/pending/i).first()).toBeVisible();
  });
});

test.describe('Expense form', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await mockExpensesData(page);
    await page.route('**/rest/v1/irs_expense_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 3, name: 'Cleaning and maintenance' },
          { id: 10, name: 'Repairs' },
        ]),
      }),
    );
    await page.route('**/rest/v1/expense_subcategories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sub-1', irs_category_id: 3, name: 'HVAC maintenance' },
          { id: 'sub-2', irs_category_id: 3, name: 'Landscaping / lawn care' },
        ]),
      }),
    );
    await page.route('**/rest/v1/properties**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'prop-1', address_line1: '123 Main St' }]),
      }),
    );
    await page.goto('/expenses');
  });

  test('opens the expense form when Add Expense is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click();
    await expect(page.locator('app-expense-form')).toBeAttached();
  });

  test('expense form has a date field', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click();
    await expect(page.locator('#expenseDate')).toBeVisible();
  });

  test('expense form has an amount field', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click();
    await expect(page.locator('#amount')).toBeVisible();
  });

  test('expense form has a description field', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click();
    await expect(page.locator('#description')).toBeVisible();
  });
});

test.describe('Expense auth guard', () => {
  test('redirects view_only users accessing /expenses', async ({ page }) => {
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

    await page.goto('/expenses');
    await expect(page).not.toHaveURL(/\/expenses/);
  });
});
