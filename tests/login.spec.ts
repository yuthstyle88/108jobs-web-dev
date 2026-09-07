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

// Login is now the same phone+OTP flow as register (PhoneOtpAuthForm,
// mode="login") -- mirrors 108jobs-flutter, which dropped password auth
// entirely. See register.spec.ts for the shared mock helper.
test.describe('Login (phone + OTP, mocked)', () => {
  // The offer itself (#146). Enrolment used to be raised the moment verify
  // succeeded, with no question and no way to decline except dismissing an OS
  // prompt that appeared for no stated reason -- and on a browser with no
  // usable authenticator the redirect then waited on it for the full timeout.
  //
  // Two things must hold: the question names the account it is about, and
  // declining redirects immediately, because declining starts nothing.
  test('offers a passkey before raising one, and declining signs in at once', async ({ page }) => {
    await enableMockOtp(page);

    // Fail any enrolment attempt loudly: declining must not reach the network
    // at all, so a request here means the offer was bypassed.
    let enrolmentAttempted = false;
    await page.route('**/auth/passkey/register/**', async (route) => {
      enrolmentAttempted = true;
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/${LOCALE}/login`);
    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();
    await page.getByPlaceholder(/otp/i).fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    // The question is asked, and it names the number that just signed in.
    await expect(page.getByText(/skip the sms code next time/i)).toBeVisible();
    // The number appears twice on screen -- the code step still shows "we
    // sent a code to ...". Match the dialog's own sentence so this asserts the
    // offer names the account, not that the number is somewhere on the page.
    await expect(
      page.getByText(/create a passkey for \+66812345678/i),
    ).toBeVisible();

    // Still on the login page: verifying alone does not sign you in any more.
    expect(new URL(page.url()).pathname).toContain('/login');

    await page.getByRole('button', { name: /not now/i }).click();

    await page.waitForURL((url) => !/\/login(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
    expect(enrolmentAttempted).toBe(false);
  });

  test('requests a code, then verifies it and lands authenticated', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/login`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText('+66812345678')).toBeVisible();

    await page.getByPlaceholder(/otp/i).fill('123456');
    await page.getByRole('button', { name: /verify otp/i }).click();

    // Verifying no longer redirects on its own: it asks whether to create a
    // passkey first, and only an explicit yes raises the platform
    // authenticator. Declining is the fast path and must redirect at once --
    // nothing was started, so there is nothing to wait for. (#146)
    await page.getByRole('button', { name: /not now/i }).click();

    await page.waitForURL((url) => !/\/login(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  });

  test('shows an inline error and stays on the code step for a wrong code', async ({ page }) => {
    await enableMockOtp(page, { verifyStatus: 401, verifyBody: { error: 'invalid_code' } });

    await page.goto(`/${LOCALE}/login`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    const codeInput = page.getByPlaceholder(/otp/i);
    await expect(codeInput).toBeVisible();
    await codeInput.fill('000000');
    await page.getByRole('button', { name: /verify otp/i }).click();

    await expect(page.getByText(/invalid otp/i)).toBeVisible();
    await expect(codeInput).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`));
  });

  // `fill()` CLEARS the field before typing, so every assertion in this file was
  // blind to whatever the step arrived carrying -- which is how the phone number
  // shipped inside the OTP box with 10/10 green. Read .inputValue() BEFORE typing.
  test('arrives on the code step with an empty OTP box, not the phone number', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/login`);

    await page.getByPlaceholder(/phone/i).fill('0812345678');
    await page.getByRole('button', { name: /send verification code/i }).click();

    const codeInput = page.getByPlaceholder(/otp/i);
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toHaveValue('');

    // ...and going back keeps the number the user typed, rather than blanking it.
    await page.getByRole('button', { name: /change phone number/i }).click();
    await expect(page.getByPlaceholder(/phone/i)).toHaveValue('0812345678');
  });

  test('links to register, and there is no password field anywhere on the page', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);

    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.getByRole('button', { name: /create an account/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/register`));
  });
});
