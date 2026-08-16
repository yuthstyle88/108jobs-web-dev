import { expect, test } from '@playwright/test';
import { captureConsole } from './utils/console';

const REQUESTED_ROUTE_404 = 'Failed to load resource: the server responded with a status of 404 (Not Found)';

function expectNoRuntimeErrors(cap: ReturnType<typeof captureConsole>) {
  expect(cap.pageErrors, `page errors:\n${cap.pageErrors.join('\n')}`).toHaveLength(0);

  // Chromium logs the expected HTTP 404 for the document itself as a console error.
  // Page errors and every other console error must still be empty.
  expect(
    cap.errors.filter((error) => error !== REQUESTED_ROUTE_404),
    `unexpected console errors:\n${cap.errors.join('\n')}`,
  ).toHaveLength(0);
}

test('a missing localized route renders the 404 screen in place without runtime errors', async ({ page, baseURL }) => {
  const cap = captureConsole(page);
  const root = baseURL ?? 'http://localhost:3001';
  const missingPath = '/en/this-route-does-not-exist';

  await page.goto(`${root}${missingPath}`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(new RegExp(`${missingPath}$`));
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  await expect(page.getByText('We couldn’t find the page you were looking for.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'A helpful robot holding a map beside a broken link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/en');

  expectNoRuntimeErrors(cap);

  cap.stop();
});

test('a missing route preserves its locale when no language cookie exists', async ({ page, context, baseURL }) => {
  const cap = captureConsole(page);
  await context.clearCookies();

  const root = baseURL ?? 'http://localhost:3001';
  const missingPath = '/vi/this-route-does-not-exist';

  await page.goto(`${root}${missingPath}`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(new RegExp(`${missingPath}$`));
  await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/vi');

  expectNoRuntimeErrors(cap);

  cap.stop();
});

test('the localized 404 page keeps its localized home link', async ({ page, baseURL }) => {
  const cap = captureConsole(page);
  const root = baseURL ?? 'http://localhost:3001';

  await page.goto(`${root}/vi/not-found`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('img', { name: 'A helpful robot holding a map beside a broken link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quay lại trang chủ' })).toHaveAttribute('href', '/vi');

  expectNoRuntimeErrors(cap);

  cap.stop();
});
