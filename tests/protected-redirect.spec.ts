import { test, expect } from '@playwright/test';
import { captureConsole } from './utils/console';
import { enableMockOtp } from './utils/otp';

const ALLOW_ERROR_PATTERNS = [
  'ERR_CONNECTION_REFUSED',
  'Failed to load resource',
  'fetchIsoData',
];

function filterAllowedErrors(errors: string[]) {
  return errors.filter((e) => !ALLOW_ERROR_PATTERNS.some((p) => e.includes(p)));
}

test('protected route redirects to login', async ({ page, baseURL }) => {
  const cap = captureConsole(page);
  const root = baseURL ?? 'http://localhost:3001';
  const target = `${root}/en/account-setting/bank-account`;

  const resp = await page.goto(target, { waitUntil: 'domcontentloaded' });
  expect(resp).toBeTruthy();

  // Expect a redirect or navigation to login page
  await page.waitForURL(/\/en\/login\?/, { timeout: 30000 });
  expect(page.url()).toMatch(/\/en\/login\?/);

  const hardErrors = filterAllowedErrors(cap.errors);
  expect(cap.pageErrors, `page errors: \n${cap.pageErrors.join('\n')}`).toHaveLength(0);
  expect(hardErrors, `console errors: \n${hardErrors.join('\n')}`).toHaveLength(0);

  cap.stop();
});

test('signing in from a protected-route bounce returns to the original page, not home', async ({ page, baseURL }) => {
  // Regression test: proxy.ts used to set `?next=`, but PhoneOtpAuthForm has
  // always read `?redirect=` -- the mismatch meant this silently landed on
  // "/" instead of back where the user was trying to go.
  await enableMockOtp(page);

  const root = baseURL ?? 'http://localhost:3001';
  await page.goto(`${root}/en/account-setting/bank-account`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/en\/login\?/, { timeout: 30000 });

  const bounced = new URL(page.url());
  expect(bounced.searchParams.get('redirect')).toBe('/en/account-setting/bank-account');

  await page.getByPlaceholder(/phone/i).fill('0812345678');
  await page.getByRole('button', { name: /send verification code/i }).click();
  await page.getByPlaceholder(/otp/i).fill('123456');
  await page.getByRole('button', { name: /verify otp/i }).click();

  await page.waitForURL((url) => !/\/login(\/|$)/.test(new URL(url).pathname), { timeout: 15000 });
  expect(new URL(page.url()).pathname).toBe('/en/account-setting/bank-account');
});
