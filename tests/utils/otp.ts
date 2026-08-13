import { Page } from '@playwright/test';

// A structurally-valid (but unsigned) fake JWT -- see auth.ts's fakeJwt()
// for why a plain placeholder string crashes jwt-decode.
export function fakeJwt(): string {
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

export type MockOtpOptions = {
  verifyStatus?: number;
  verifyBody?: unknown;
};

// Mocks Identity-Platform's OTP endpoints directly (a different origin from
// this app's own /api/*, per NEXT_PUBLIC_IDENTITY_BASE_URL) plus the same
// getMyUser()/site routes enableMockAuth uses, since a successful verify
// drives UserService.Instance.login() through the same profile-hydration path
// a password login used to. Shared by register.spec.ts and login.spec.ts --
// both pages render the same PhoneOtpAuthForm.
export async function enableMockOtp(page: Page, opts: MockOtpOptions = {}) {
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
