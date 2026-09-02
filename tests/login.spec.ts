import { test, expect } from '@playwright/test';
import { captureConsole } from './utils/console';
import type { CapturedConsole } from './utils/console';
import { enableMockOtp } from './utils/otp';

const LOCALE = process.env.TEST_LOCALE || 'en';

let con: CapturedConsole | null = null;

test.beforeEach(async ({ page }) => {
  con = captureConsole(page);
});

test.afterEach(async () => {
  con?.stop();
  con = null;
});

test.describe('Login flow', () => {
  test('renders password login by default with username/phone and password fields', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);

    await expect(page.getByPlaceholder(/username or phone/i)).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create an account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with phone/i })).toBeVisible();
  });

  test('can switch to phone + OTP login and verify', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/login`);

    await page.getByRole('button', { name: /sign in with phone/i }).click();

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText('+66812345678')).toBeVisible();

    await page.getByPlaceholder(/otp/i).fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await page.waitForURL((url) => !/\/login(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  });

  test('navigates to register page from login', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);

    await page.getByRole('button', { name: /create an account/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/register`));
  });

  test('login page has correct 108jobs.com document title and not 108heros.com', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);
    await expect(page).toHaveTitle(/108jobs\.com/);
    const title = await page.title();
    expect(title).not.toContain('108heros.com');
  });
});

