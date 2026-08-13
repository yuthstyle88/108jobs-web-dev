import { test, expect } from '@playwright/test';
import { captureConsole } from './utils/console';
import type { CapturedConsole } from './utils/console';

const LOCALE = process.env.TEST_LOCALE || 'en';

// A structurally-valid (but unsigned) fake JWT -- see tests/utils/auth.ts's
// fakeJwt() for why a plain placeholder string crashes jwt-decode.
function fakeJwt(): string {
  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = b64url({
    sub: 'mock-identity',
    iss: 'auth-service',
    aud: 'jobs',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    roles: ['user'],
    realm: 'mock',
    platform: 'jobs',
    tenant_id: 'mock-tenant',
  });
  return `${header}.${payload}.mock-signature`;
}

type MockOtpOptions = {
  verifyStatus?: number;
  verifyBody?: unknown;
};

// Mocks Identity-Platform's OTP endpoints directly (a different origin from
// this app's own /api/*, per NEXT_PUBLIC_IDENTITY_BASE_URL) plus the same
// getMyUser()/site routes enableMockAuth uses, since a successful verify
// drives UserService.Instance.login() through the same profile-hydration path
// a password login does.
async function enableMockOtp(page: import('@playwright/test').Page, opts: MockOtpOptions = {}) {
  const { verifyStatus = 200, verifyBody } = opts;

  await page.route('**/auth/otp/request', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ challengeId: 'challenge-1', expiresAt: Math.floor(Date.now() / 1000) + 300 }),
    });
  });

  await page.route('**/auth/otp/verify', async (route) => {
    await route.fulfill({
      status: verifyStatus,
      contentType: 'application/json',
      body: JSON.stringify(
        verifyBody ?? {
          verified: true,
          registered: true,
          login: {
            identityId: 'mock-identity',
            access_token: fakeJwt(),
            token_type: 'Bearer',
            expires_in: 900,
            refresh_token: 'mock-refresh-token',
            emailVerified: false,
          },
        },
      ),
    });
  });

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (method === 'GET' && /\/api\/v4\/.*(me|myUser)/i.test(url)) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
    if (method === 'GET' && /\/api\/v4\/site/i.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ site: { name: 'Mock Site' } }),
      });
    }
    if (method === 'POST' && /\/api\/auth\/session$/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
}

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
