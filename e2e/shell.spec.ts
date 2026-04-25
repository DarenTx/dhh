import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';

test.describe('Shell layout', () => {
  test.beforeEach(async ({ page }) => {
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
          role: 'authenticated',
          email: 'admin@dahlheritagehomes.com',
          app_metadata: { role: 'admin', is_active: true },
        }),
      }),
    );

    await page.goto('/dashboard');
  });

  test('sidebar is present on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('app-shell .sidebar')).toBeAttached();
  });

  test('bottom nav is present on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('app-shell .bottom-nav')).toBeAttached();
  });

  test('sidebar shows the DHH brand name', async ({ page }) => {
    await expect(page.locator('app-sidebar .nav-brand')).toContainText('DHH');
  });

  test('sidebar shows the Dashboard nav link', async ({ page }) => {
    await expect(page.locator('app-sidebar nav')).toContainText('Dashboard');
  });

  test('sidebar shows the Admin link for admin role', async ({ page }) => {
    await expect(page.locator('app-sidebar nav')).toContainText('Admin');
  });
});
