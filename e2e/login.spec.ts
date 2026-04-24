import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test('displays the sign in heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows Sign in with Google button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('shows email input and Send Login Link button', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send login link/i })).toBeVisible();
  });

  test('email input has associated label', async ({ page }) => {
    await expect(page.locator('label[for="email"]')).toBeVisible();
  });

  test('email input has aria-describedby pointing to error element', async ({ page }) => {
    const input = page.locator('#email');
    await expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  test('shows required validation error on empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /send login link/i }).click();
    await expect(page.locator('#email-error')).toContainText('Email is required');
  });

  test('shows invalid format error for malformed email', async ({ page }) => {
    await page.locator('#email').fill('not-an-email');
    await page.locator('#email').blur();
    await expect(page.locator('#email-error')).toContainText('valid email');
  });

  test('shows internal domain error for dahlheritagehomes.com email', async ({ page }) => {
    await page.locator('#email').fill('user@dahlheritagehomes.com');
    await page.locator('#email').blur();
    await expect(page.locator('#email-error')).toContainText(
      'Do not use a dahlheritagehomes.com email address.',
    );
  });

  test('shows internal domain error for subdomain of dahlheritagehomes.com', async ({ page }) => {
    await page.locator('#email').fill('user@sub.dahlheritagehomes.com');
    await page.locator('#email').blur();
    await expect(page.locator('#email-error')).toContainText(
      'Do not use a dahlheritagehomes.com email address.',
    );
  });

  test('displays error banner when ?error= query param is present', async ({ page }) => {
    const errorMsg = encodeURIComponent('Session expired. Please sign in again.');
    await page.goto(`${BASE_URL}/login?error=${errorMsg}`);
    await expect(page.locator('.error-banner')).toContainText('Session expired');
  });
});

test.describe('Auth Callback page', () => {
  test('renders loading indicator while processing', async ({ page }) => {
    // Intercept the token exchange so the spinner stays visible during assertion.
    // Without this, handleAuthCallback() would throw immediately (no code) and
    // redirect to /login before the assertion can run.
    await page.route('**/auth/v1/token*', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.abort();
    });
    await page.goto(`${BASE_URL}/login/callback?code=test-code`);
    // The page should at minimum render without crashing
    await expect(page.locator('.spinner')).toBeVisible();
  });

  test('redirects to /login with error when no code is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/login/callback`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});

test.describe('Auth Guard', () => {
  test('redirects unauthenticated users to /login when accessing protected route', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});
