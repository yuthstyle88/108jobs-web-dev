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

  test('can switch to phone + OTP login and verify', async ({ page }) => {
    await enableMockOtp(page);

    await page.goto(`/${LOCALE}/login`);

    await page.getByRole('button', { name: /sign in with phone/i }).click();

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

  test('navigates to register page from login', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);

    await page.getByRole('button', { name: /create an account/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/register`));
  });

  test('login page carries the product name in its document title', async ({ page }) => {
    await page.goto(`/${LOCALE}/login`);
    // getAppName() feeds document.title. The mirror asserted 108jobs here;
    // the org sweep (660d682) and the owner's 2026-09-09 call make it 108Heros.
    await expect(page).toHaveTitle(/108Heros/i);
  });
});

