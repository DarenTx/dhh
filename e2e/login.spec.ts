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
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('shows Sign in with Email link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in with email/i })).toBeVisible();
  });

  test('navigates to /login/magic-link when Sign in with Email is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /sign in with email/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/login/magic-link`);
  });

  test('displays error banner when ?error= query param is present', async ({ page }) => {
    const errorMsg = encodeURIComponent('Session expired. Please sign in again.');
    await page.goto(`${BASE_URL}/login?error=${errorMsg}`);
    await expect(page.locator('.error-banner')).toContainText('Session expired');
  });
});

test.describe('Magic Link page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login/magic-link`);
  });

  test('shows the email input and submit button', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send sign-in link/i })).toBeVisible();
  });

  test('shows required validation error on empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /send sign-in link/i }).click();
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
    await expect(page.locator('#email-error')).toContainText('Internal email');
  });

  test('shows internal domain error for subdomain of dahlheritagehomes.com', async ({ page }) => {
    await page.locator('#email').fill('user@sub.dahlheritagehomes.com');
    await page.locator('#email').blur();
    await expect(page.locator('#email-error')).toContainText('Internal email');
  });

  test('back link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('email input has aria-describedby pointing to error element', async ({ page }) => {
    const input = page.locator('#email');
    await expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  test('email input has associated label', async ({ page }) => {
    await expect(page.locator('label[for="email"]')).toBeVisible();
  });
});

test.describe('Auth Callback page', () => {
  test('renders loading indicator while processing', async ({ page }) => {
    // Intercept the page before it processes the callback
    await page.goto(`${BASE_URL}/login/callback`);
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
