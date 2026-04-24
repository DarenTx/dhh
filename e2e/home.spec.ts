import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'vmzmwdqnnnojzrjpdlnj';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a mock Supabase session into localStorage before the page loads so
    // the authGuard finds a valid session and allows access to the home route.
    await page.addInitScript((projectRef: string) => {
      const toBase64Url = (str: string) =>
        btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = toBase64Url(
        JSON.stringify({
          sub: 'test-user-id',
          aud: 'authenticated',
          exp: 9999999999,
          iat: 1700000000,
          role: 'authenticated',
          email: 'test@example.com',
        }),
      );
      const mockUser = {
        id: 'test-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        app_metadata: {},
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

    // Intercept Supabase auth API calls as a safety net to prevent network errors.
    await page.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
        }),
      }),
    );

    await page.goto('/');
  });

  test('should display the Angular PWA heading', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Angular PWA');
  });

  test('should display the subtitle', async ({ page }) => {
    await expect(page.locator('.hero__subtitle')).toContainText(
      'Build steps performed to scaffold this project',
    );
  });

  test('should render all 7 build steps', async ({ page }) => {
    const steps = page.locator('.step');
    await expect(steps).toHaveCount(7);
  });

  test('should display step numbers 1 through 7', async ({ page }) => {
    const numbers = page.locator('.step__number');
    await expect(numbers).toHaveCount(7);
    for (let i = 0; i < 7; i++) {
      await expect(numbers.nth(i)).toHaveText(String(i + 1));
    }
  });

  test('first step should reference Angular CLI verification', async ({ page }) => {
    const firstStepTitle = page.locator('.step__title').first();
    await expect(firstStepTitle).toContainText('Verified Angular CLI');
  });

  test('last step should reference build verification', async ({ page }) => {
    const lastStepTitle = page.locator('.step__title').last();
    await expect(lastStepTitle).toContainText('Verified the build');
  });

  test('steps with commands should show a code block', async ({ page }) => {
    const codeBlocks = page.locator('.step__command');
    // Steps 1-4, 6, 7 have commands (6 total)
    await expect(codeBlocks).toHaveCount(6);
  });

  test('should have a web app manifest link (PWA)', async ({ page }) => {
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', 'manifest.webmanifest');
  });

  test('page title should be set', async ({ page }) => {
    await expect(page).toHaveTitle(/Dhh/i);
  });
});
