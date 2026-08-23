import { Page } from '@playwright/test';

// A structurally-valid (but unsigned) fake JWT -- see auth.ts's fakeJwt()
// for why a plain placeholder string crashes jwt-decode.
export function fakeJwt(): string {
  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  // The header must NOT say `alg: 'none'`. That is the JWT algorithm-confusion
  // forgery, and src/proxy.ts now rejects it outright without even reaching for
  // the signing keys -- so a fixture that used it would be asserting that the
  // hole this gate closes is still open. Real Identity-Platform tokens are
  // EdDSA with a `kid`; with NEXT_PUBLIC_IDENTITY_BASE_URL pointed at a port
  // nothing listens on (see .github/workflows/ci.yml), the JWKS fetch fails and
  // the gate reaches its "cannot verify" verdict, which keeps ordinary
  // protected pages reachable. That is the path these specs exercise. The
  // /admin gate fails closed on the same verdict and is covered by the unit
  // tests in src/proxy.test.ts, which do real Ed25519 signing.
  const header = b64url({ alg: 'EdDSA', typ: 'JWT', kid: 'mock-key' });
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

  // #13 put `await enrollPasskey(...)` on the path between a successful verify
  // and the redirect, and nothing here covered it -- so the call went to the
  // real NEXT_PUBLIC_IDENTITY_BASE_URL. On this Mac that is refused instantly
  // and the flow continues; on the CI runner the connection HANGS, the submit
  // button sits disabled behind `formState.isSubmitting`, and every spec that
  // waits for the post-login redirect burns its 15s budget. The trace shows it
  // plainly: otp/request 200, otp/verify 200, passkey/register/challenge -1.
  //
  // Failing it fast is the honest mock: enrolment is offered, not required, and
  // enrollPasskey() already treats a non-success challenge as "no passkey today".
  await page.route('**/auth/passkey/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
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
