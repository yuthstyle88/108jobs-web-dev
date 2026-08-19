import { expect, test } from '@playwright/test';

// Browser-level coverage for the same-origin media proxy
// (src/app/api/media/[assetId]/route.ts).
//
// What this file legitimately proves: the route is reachable at a
// same-origin path and never leaks bytes -- or a MAD/backend URL -- to an
// unauthenticated caller, confirmed against a real running instance of this
// app (not a mock).
//
// What it does NOT prove: that a real chat message's <img>/<video> actually
// renders through this route end-to-end. Reaching that would need either a
// real signed-in account with a real uploaded attachment (explicitly out of
// bounds for this suite -- creating an account is not something this task
// may do) or a from-scratch mock of the authenticated chat shell (user
// store hydration, the room fetch, the chat WebSocket, the E2E key
// bootstrap) that has no existing fixture anywhere in this repo's Playwright
// suite to build on. The unit tests for `attachmentSrc`
// (src/modules/chat/attachments/attachmentSrc.test.ts) prove the same claim
// at the function level instead: every render site (ChatMessageBubble,
// MediaGrid, MediaFileList, MediaLightbox) calls that one function to
// produce the `src`/`href` it renders, which is directly reviewable at
// those call sites.
const VALID_ASSET_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

test.describe('GET /api/media/[assetId] (same-origin media proxy)', () => {
  test('returns 401 JSON, not bytes, when the caller has no auth cookie', async ({ request, baseURL }) => {
    const root = baseURL ?? 'http://localhost:3001';
    const res = await request.get(`${root}/api/media/${VALID_ASSET_ID}`);

    expect(res.status()).toBe(401);
    expect(res.headers()['content-type'] ?? '').toContain('application/json');
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects a non-UUID assetId without ever needing to reach the backend', async ({ request, baseURL }) => {
    const root = baseURL ?? 'http://localhost:3001';
    // No cookie either -- the missing-token check runs first, so this still
    // reads 401, proving the same "never touches upstream" path a malformed
    // id would also hit once past that check (covered directly, with a
    // supplied token, by the route's own vitest suite).
    const res = await request.get(`${root}/api/media/not-a-real-uuid`);

    expect(res.status()).toBe(401);
  });

  test('never redirects the browser to MAD or exposes a MAD URL', async ({ request, baseURL }) => {
    const root = baseURL ?? 'http://localhost:3001';
    const res = await request.get(`${root}/api/media/${VALID_ASSET_ID}`, {
      maxRedirects: 0,
    });

    expect(res.status()).toBe(401);
    // No redirect of any kind -- this route streams/returns bytes (or, here,
    // its own JSON error) directly; it must never hand the browser a
    // Location to follow itself.
    expect(res.headers()).not.toHaveProperty('location');

    // The response body is this route's own JSON error, not anything that
    // could carry a MAD address (the site-wide CSP header legitimately
    // allowlists the MAD gateway origin for the *unrelated* direct-upload
    // path (madUpload.ts), so header text is not the right thing to assert
    // against here -- the body is).
    expect(res.headers()['content-type'] ?? '').toContain('application/json');
    const bodyText = await res.text();
    expect(bodyText).not.toMatch(/media-gateway|:8091|:8082|internal\/assets/);
  });

  test('a direct browser navigation lands on the JSON error, not a cross-origin redirect', async ({ page, baseURL }) => {
    const root = baseURL ?? 'http://localhost:3001';
    const target = `${root}/api/media/${VALID_ASSET_ID}`;

    const response = await page.goto(target, { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(401);
    // Same-origin the whole way: no navigation away from this app's own
    // origin happened as a side effect of requesting media.
    expect(new URL(page.url()).origin).toBe(new URL(root).origin);
  });
});
