import { expect, test } from '@playwright/test';

test.describe('Root static icons & favicon resolution (Fixes #129)', () => {
  const iconPaths = [
    { path: '/icon.png', contentType: 'image/png' },
    { path: '/apple-icon.png', contentType: 'image/png' },
    { path: '/apple-touch-icon.png', contentType: 'image/png' },
    { path: '/favicon.ico', contentType: 'image/' },
    { path: '/icon-192.png', contentType: 'image/png' },
    { path: '/icon-512.png', contentType: 'image/png' },
  ];

  for (const { path, contentType } of iconPaths) {
    test(`GET ${path} returns 200 without being redirected by the locale proxy`, async ({
      request,
      baseURL,
    }) => {
      const root = baseURL ?? 'http://localhost:3001';
      const res = await request.get(`${root}${path}`, { maxRedirects: 0 });

      // Must be served directly (200 OK), not 307 redirect into /th/... or 404
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type'] ?? '').toContain(contentType);

      const body = await res.body();
      expect(body.length).toBeGreaterThan(0);
    });
  }

  test('html head links refer to reachable icons', async ({ page }) => {
    await page.goto('/th');

    const iconLinks = await page.locator('link[rel*="icon"]').evaluateAll((elements) =>
      elements.map((el) => (el as HTMLLinkElement).href)
    );

    expect(iconLinks.length).toBeGreaterThan(0);
    for (const href of iconLinks) {
      const res = await page.request.get(href, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
    }
  });
});
