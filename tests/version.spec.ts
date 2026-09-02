import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// VERSIONING_STANDARD.md §6: CI fails if the version the RUNNING app reports
// does not match the manifest. The unit test in src/utils/version.test.ts
// calls the handler in-process; this one asks the production build that
// playwright.config.ts's webServer just compiled and started, over HTTP, so a
// bundling or routing mistake (the /api/:path* proxy rewrite swallowing the
// route, a stale package.json import, the locale proxy redirecting it) turns
// this red rather than shipping a number nobody reads.
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string;
};

test.describe('GET /api/version (versioning standard)', () => {
  test('reports the manifest version, a MAJOR of 1, and the four identity fields', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL ?? 'http://localhost:3001';
    const res = await request.get(`${root}/api/version`, { maxRedirects: 0 });

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'] ?? '').toContain('application/json');

    const body = await res.json();
    expect(body.version).toBe(manifest.version);
    expect(body.appVersion).toBe(manifest.version);
    expect(body.version).toMatch(/^1\.\d+\.\d+$/);
    // A local/CI build carries no build-args, so these read "unknown" here;
    // the shape is what is asserted. The image built by release-image.yml
    // fills them in, and the Dockerfile has no other way to leave them blank.
    expect(body.build).toMatch(/^(sha-[0-9a-f]{7}|unknown)$/);
    expect(body.builtAt).toMatch(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z|unknown)$/);
    expect(['staging', 'release', 'unknown']).toContain(body.channel);
  });

  test('GET /health/ready answers 200 and is not swallowed by the locale proxy', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL ?? 'http://localhost:3001';
    const res = await request.get(`${root}/health/ready`, { maxRedirects: 0 });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe(manifest.version);
  });
});
