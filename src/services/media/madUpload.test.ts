import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {madGatewayUrl, uploadToMad} from "@/services/media/madUpload";
import {UserService} from "@/services/UserService";

/**
 * `NEXT_PUBLIC_*` is inlined by Next at build time, but under vitest these are
 * ordinary `process.env` reads, so a test can set them.
 */
function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/** Records every request the three-step handshake makes. */
function stubFetch(responses: Array<{status: number; body?: unknown}>) {
  const calls: Array<{url: string; method: string; body: unknown; auth?: string}> = [];
  let index = 0;
  const fetchStub = vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      body: init.body,
      auth: headers.Authorization,
    });
    const next = responses[index] ?? {status: 200, body: {}};
    index += 1;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body ?? {},
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchStub);
  return calls;
}

const SESSION = {status: 200, body: {sessionId: "sess-1"}};
const BYTES = {status: 204};
const COMPLETE = {
  status: 200,
  body: {assetId: "asset-9", contentType: "image/png"},
};

describe("madGatewayUrl", () => {
  afterEach(() => setEnv({NEXT_PUBLIC_MEDIA_GATEWAY_URL: undefined}));

  it("is null when unset, which is every environment today", () => {
    // The whole cutover hangs off this: null means the legacy /account/files
    // path runs and nothing about upload behaviour changes.
    expect(madGatewayUrl()).toBeNull();
  });

  it("is null when set to blank rather than treating '' as a gateway", () => {
    setEnv({NEXT_PUBLIC_MEDIA_GATEWAY_URL: "   "});
    expect(madGatewayUrl()).toBeNull();
  });

  it("drops a trailing slash so URLs do not end up doubled", () => {
    setEnv({NEXT_PUBLIC_MEDIA_GATEWAY_URL: "https://mad.example.com/"});
    expect(madGatewayUrl()).toBe("https://mad.example.com");
  });
});

describe("uploadToMad", () => {
  const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "portfolio.png", {
    type: "image/png",
  });

  beforeEach(() => {
    setEnv({
      NEXT_PUBLIC_MEDIA_GATEWAY_URL: "https://mad.example.com",
      NEXT_PUBLIC_MEDIA_PUBLIC_URL: "https://media.example.com",
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
    });
    UserService.Instance.authInfo = {auth: "jwt-abc"} as never;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setEnv({
      NEXT_PUBLIC_MEDIA_GATEWAY_URL: undefined,
      NEXT_PUBLIC_MEDIA_PUBLIC_URL: undefined,
      NEXT_PUBLIC_API_BASE_URL: undefined,
    });
    UserService.Instance.authInfo = undefined as never;
  });

  it("runs MAD's three calls, in order", async () => {
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await uploadToMad(file, "private");

    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      "POST https://mad.example.com/uploads",
      "PUT https://mad.example.com/uploads/sess-1/bytes",
      "POST https://mad.example.com/uploads/complete",
    ]);
  });

  it("declares length and content type up front", async () => {
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await uploadToMad(file, "private");

    // MAD authorises and size-checks before any bytes move, so these have to
    // be right in the first call — a mismatch is rejected at complete time.
    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      kind: "image",
      declaredContentLength: 5,
      contentType: "image/png",
      visibility: "private",
    });
  });

  it("sends the given kind instead of the image default", async () => {
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await uploadToMad(file, "private", "file");

    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      kind: "file",
    });
  });

  it("sends the session bearer on every leg", async () => {
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await uploadToMad(file, "private");

    expect(calls.map(c => c.auth)).toEqual([
      "Bearer jwt-abc",
      "Bearer jwt-abc",
      "Bearer jwt-abc",
    ]);
  });

  it("reads a public asset straight from MAD", async () => {
    stubFetch([SESSION, BYTES, COMPLETE]);

    const asset = await uploadToMad(file, "public");

    expect(asset.url).toBe(
      "https://media.example.com/assets/asset-9/public-bytes",
    );
  });

  it("reads a private asset through 108jobs, never MAD directly", async () => {
    stubFetch([SESSION, BYTES, COMPLETE]);

    const asset = await uploadToMad(file, "private");

    // The proxy is where room membership is re-checked. A MAD URL for a
    // private asset routes around that check entirely.
    expect(asset.url).toBe("https://api.example.com/api/v4/media-proxy/asset-9");
  });

  it("carries the asset id as the handle, not a filename", async () => {
    stubFetch([SESSION, BYTES, COMPLETE]);

    const asset = await uploadToMad(file, "private");

    expect(asset).toMatchObject({
      filename: "asset-9",
      size: 5,
      mimeType: "image/png",
    });
  });

  it("refuses without a session instead of letting MAD 401", async () => {
    UserService.Instance.authInfo = undefined as never;
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await expect(uploadToMad(file, "private")).rejects.toThrow(
      /without a signed-in session/,
    );
    expect(calls).toHaveLength(0);
  });

  it("stops at the first failing leg rather than completing a broken session", async () => {
    const calls = stubFetch([SESSION, {status: 413}, COMPLETE]);

    await expect(uploadToMad(file, "private")).rejects.toThrow(/413/);
    // Two calls made, and crucially not the third: completing a session whose
    // bytes were rejected would mint an asset with nothing behind it.
    expect(calls).toHaveLength(2);
  });
});
