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

test.describe('Register flow', () => {
  test('renders registration form by default with phone, password, and confirm password', async ({ page }) => {
    await page.goto(`/${LOCALE}/register`);

    await expect(page.getByPlaceholder(/phone/i)).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('validates password mismatch on client side', async ({ page }) => {
    await page.goto(`/${LOCALE}/register`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('input[name="confirmPassword"]').fill('password456');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('can switch to phone + OTP registration and verify', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/register`);

    await page.getByRole('button', { name: /sign in with phone/i }).click();

    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText('+66812345678')).toBeVisible();

    const codeInput = page.getByPlaceholder(/otp/i);
    await codeInput.fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await page.waitForURL((url) => !/\/register(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  });

  test('navigates to login page from register', async ({ page }) => {
    await page.goto(`/${LOCALE}/register`);

    await page.getByRole('button', { name: /^login$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`));
  });
});
