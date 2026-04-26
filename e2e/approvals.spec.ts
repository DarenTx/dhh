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

async function mockPendingApprovals(page: Page) {
  await page.route('**/rest/v1/approval_requirements**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'req-1',
          approvable_type: 'expense',
          approvable_id: 'exp-1',
          approver_id: 'manager-user-id',
          status: 'pending',
          rejection_reason: null,
          created_at: '2026-04-20T10:00:00Z',
          updated_at: '2026-04-20T10:00:00Z',
          expenses: {
            id: 'exp-1',
            description: 'HVAC filter replacement',
            amount: 250.0,
            date: '2026-04-20',
            created_by: 'other-manager-id',
          },
          guaranteed_payments: null,
        },
        {
          id: 'req-2',
          approvable_type: 'guaranteed_payment',
          approvable_id: 'gp-1',
          approver_id: 'manager-user-id',
          status: 'pending',
          rejection_reason: null,
          created_at: '2026-04-18T09:00:00Z',
          updated_at: '2026-04-18T09:00:00Z',
          expenses: null,
          guaranteed_payments: {
            id: 'gp-1',
            work_description: 'Property inspections',
            hours_billed: 4.0,
            work_date: '2026-04-18',
            created_by: 'other-manager-id',
          },
        },
      ]),
    }),
  );
}

test.describe('Approvals page', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await mockPendingApprovals(page);
    await page.goto('/approvals');
  });

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/Approvals/);
  });

  test('displays the Approvals heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Approvals');
  });

  test('shows pending expense approval item', async ({ page }) => {
    await expect(page.getByText('HVAC filter replacement')).toBeVisible();
  });

  test('shows pending guaranteed payment approval item', async ({ page }) => {
    await expect(page.getByText('Property inspections')).toBeVisible();
  });

  test('shows Approve buttons for pending items', async ({ page }) => {
    await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible();
  });

  test('shows Reject buttons for pending items', async ({ page }) => {
    await expect(page.getByRole('button', { name: /reject/i }).first()).toBeVisible();
  });
});

test.describe('Approvals page — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await setupManagerSession(page);
    await page.route('**/rest/v1/approval_requirements**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.goto('/approvals');
  });

  test('shows empty state message when no pending approvals', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/no pending/i);
  });
});

test.describe('Approvals auth guard', () => {
  test('redirects view_only users accessing /approvals', async ({ page }) => {
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

    await page.goto('/approvals');
    await expect(page).not.toHaveURL(/\/approvals/);
  });
});

test.describe('Approvals nav badge', () => {
  test('shows a badge on the Approvals nav item when there are pending items', async ({
    page,
  }) => {
    await setupManagerSession(page);
    await mockPendingApprovals(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    const approvalsLink = page.locator('app-sidebar a[href="/approvals"]');
    await expect(approvalsLink.locator('.badge')).toBeVisible();
  });

  test('badge shows the correct pending count', async ({ page }) => {
    await setupManagerSession(page);
    await mockPendingApprovals(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    const badge = page.locator('app-sidebar a[href="/approvals"] .badge');
    await expect(badge).toContainText('2');
  });
});
