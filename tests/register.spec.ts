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
  test('renders phone number input by default', async ({ page }) => {
    await page.goto(`/${LOCALE}/register`);

    await expect(page.getByPlaceholder(/phone/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send verification code/i })).toBeVisible();
  });

  test('completes phone + OTP registration and redirects', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/register`);

    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText('+66812345678')).toBeVisible();

    const codeInput = page.getByPlaceholder(/otp/i);
    await codeInput.fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await page.waitForURL((url) => !/\/register(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  });

  test('navigates to login page from register back button', async ({ page }) => {
    await page.goto(`/${LOCALE}/register`);

    // Top left back button inside AuthFormContainer
    const backBtn = page.locator('button:has(svg)').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`));
    }
  });
});
