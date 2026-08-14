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

test.describe('Register (phone + OTP, mocked)', () => {
  test('requests a code, then verifies it and lands authenticated', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/register`);

    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    // Normalized to E.164 and shown back on the code step.
    await expect(page.getByText('+66812345678')).toBeVisible();

    const codeInput = page.getByPlaceholder(/otp/i);
    await codeInput.fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await page.waitForURL((url) => !/\/register(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  });

  test('shows an inline error and stays on the code step for a wrong code', async ({ page }) => {
    await enableMockOtp(page, { verifyStatus: 401, verifyBody: { error: 'invalid_code' } });

    await page.goto(`/${LOCALE}/register`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    const codeInput = page.getByPlaceholder(/otp/i);
    await expect(codeInput).toBeVisible();
    await codeInput.fill('000000');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await expect(page.getByText(/invalid otp/i)).toBeVisible();
    // Still on the code step, not bounced back to phone entry or elsewhere.
    await expect(codeInput).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/register`));
  });

  // `fill()` CLEARS the field before typing, so every assertion in this file was
  // blind to whatever the step arrived carrying -- which is how the phone number
  // shipped inside the OTP box with 10/10 green. Read .inputValue() BEFORE typing.
  test('arrives on the code step with an empty OTP box, not the phone number', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/register`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    const codeInput = page.getByPlaceholder(/otp/i);
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toHaveValue('');

    // ...and going back keeps the number the user typed, rather than blanking it.
    await page.getByRole('button', { name: /change phone number/i }).click();
    await expect(page.getByPlaceholder(/phone/i)).toHaveValue('0812345678');
  });

  test('rejects an unparseable phone number without calling the network', async ({ page }) => {
    let requestCalled = false;
    await page.route('**/auth/otp/request', async (route) => {
      requestCalled = true;
      await route.abort();
    });

    await page.goto(`/${LOCALE}/register`);

    await page.getByPlaceholder(/phone/i).fill('123456789');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText(/phone number must be at least 10 digits/i)).toBeVisible();
    expect(requestCalled).toBe(false);
  });
});
