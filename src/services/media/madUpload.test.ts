import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {madGatewayUrl, uploadToMad} from "@/services/media/madUpload";
import {UserService} from "@/services/UserService";
import {uploadSelectedImage} from "@/utils/helpers";
import {REQUEST_STATE} from "@/services/HttpService";

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

type RecordedCall = {
  url: string;
  method: string;
  body: unknown;
  auth?: string;
  contentType?: string;
};

/** Records every `fetch` call MAD's handshake makes -- today that is the
 *  session-open and complete legs; the byte PUT moved to `XMLHttpRequest` (see
 *  `installFakeXhr` below) because `fetch` cannot report upload progress. */
function stubFetch(
  responses: Array<{status: number; body?: unknown}>,
): RecordedCall[] {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchStub = vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      body: init.body,
      auth: headers.Authorization,
      contentType: headers["content-type"],
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

/** A minimal stand-in for the one `XMLHttpRequest` surface `uploadToMad`'s
 *  byte-PUT leg actually touches: `open`/`setRequestHeader`/`send`/`abort`,
 *  `upload.onprogress`, and the `onload`/`onerror`/`onabort` handlers. */
class FakeXhr {
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: {
    onprogress:
      | ((event: {lengthComputable: boolean; loaded: number; total: number}) => void)
      | null;
  } = {onprogress: null};
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  private readonly onSend: (xhr: FakeXhr) => void;
  private readonly autoRespond: number | null;

  constructor(onSend: (xhr: FakeXhr) => void, autoRespond: number | null) {
    this.onSend = onSend;
    this.autoRespond = autoRespond;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    this.onSend(this);
    // Most tests only care about the request this leg made (URL, headers,
    // body) or the final resolved asset -- not the XHR event choreography --
    // so resolving synchronously here keeps them a plain `await
    // uploadToMad(...)` with no manual event-firing. Tests that exercise
    // progress, failure, or abort pass `autoRespond: null` and drive the
    // instance by hand instead.
    if (this.autoRespond !== null) {
      this.status = this.autoRespond;
      this.onload?.();
    }
  }

  abort() {
    this.onabort?.();
  }
}

/**
 * Installs a fake `XMLHttpRequest` global and records the byte-PUT leg into
 * the same `calls` ledger `stubFetch` writes to, so ordering/auth assertions
 * cover all three legs of the handshake despite them running over two
 * different transports.
 *
 * `autoRespond` (default `204`) is the status the instance resolves itself
 * with as soon as `send()` is called; pass `null` to take manual control via
 * the returned `instances` array (`xhr.upload.onprogress?.(...)`,
 * `xhr.status = …; xhr.onload?.()`, `xhr.onerror?.()`, `xhr.abort()`).
 */
function installFakeXhr(
  calls: RecordedCall[],
  {autoRespond = 204}: {autoRespond?: number | null} = {},
): FakeXhr[] {
  const instances: FakeXhr[] = [];
  class RecordingXhr extends FakeXhr {
    constructor() {
      super((sent) => {
        calls.push({
          url: sent.url,
          method: sent.method,
          body: sent.body,
          auth: sent.headers.Authorization,
          contentType: sent.headers["content-type"],
        });
      }, autoRespond);
      instances.push(this);
    }
  }
  vi.stubGlobal("XMLHttpRequest", RecordingXhr as unknown as typeof XMLHttpRequest);
  return instances;
}

/** One full macrotask turn, guaranteed to run after every microtask queued so
 *  far -- long enough for `uploadToMad`'s session-open `fetch` (which never
 *  touches a real timer or socket in these tests) to resolve and the code to
 *  reach the byte-PUT leg, without hand-counting how many microtask hops the
 *  `fetch`/`.json()` stubs need to get there. */
const flushToXhr = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const SESSION = {status: 200, body: {sessionId: "sess-1"}};
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
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    await uploadToMad(file, "private");

    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      "POST https://mad.example.com/uploads",
      "PUT https://mad.example.com/uploads/sess-1/bytes",
      "POST https://mad.example.com/uploads/complete",
    ]);
  });

  it("sends the byte PUT with the same URL, method, and content-type MAD expects", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    await uploadToMad(file, "private");

    const bytesCall = calls[1];
    expect(bytesCall).toMatchObject({
      method: "PUT",
      url: "https://mad.example.com/uploads/sess-1/bytes",
      contentType: "image/png",
      auth: "Bearer jwt-abc",
    });
  });

  it("declares length and content type up front", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

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
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    await uploadToMad(file, "private", "file");

    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      kind: "file",
    });
  });

  it("sends the session bearer on every leg, including the XHR one", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    await uploadToMad(file, "private");

    expect(calls.map(c => c.auth)).toEqual([
      "Bearer jwt-abc",
      "Bearer jwt-abc",
      "Bearer jwt-abc",
    ]);
  });

  it("reads a public asset straight from MAD", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    const asset = await uploadToMad(file, "public");

    expect(asset.url).toBe(
      "https://media.example.com/assets/asset-9/public-bytes",
    );
  });

  it("reads a private asset through 108heros, never MAD directly", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    const asset = await uploadToMad(file, "private");

    // The proxy is where room membership is re-checked. A MAD URL for a
    // private asset routes around that check entirely.
    expect(asset.url).toBe("https://api.example.com/api/v4/media-proxy/asset-9");
  });

  it("carries the asset id as the handle, not a filename", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    const asset = await uploadToMad(file, "private");

    expect(asset).toMatchObject({
      filename: "asset-9",
      size: 5,
      mimeType: "image/png",
    });
  });

  it("refuses without a session instead of letting MAD 401", async () => {
    UserService.Instance.authInfo = undefined as never;
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    await expect(uploadToMad(file, "private")).rejects.toThrow(
      /without a signed-in session/,
    );
    expect(calls).toHaveLength(0);
  });

  it("stops at the first failing leg rather than completing a broken session", async () => {
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls, {autoRespond: 413});

    await expect(uploadToMad(file, "private")).rejects.toThrow(/413/);
    // Session-open and the byte PUT both fired, and crucially not complete:
    // completing a session whose bytes were rejected would mint an asset
    // with nothing behind it.
    expect(calls).toHaveLength(2);
  });

  it("keeps the user's filename alongside the storage handle", async () => {
    // MAD stores no filename at all, so if this call drops it the name is
    // gone for good and the recipient sees a UUID.
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    const asset = await uploadToMad(file, "private");

    expect(asset).toMatchObject({
      assetId: "asset-9",
      originalFilename: file.name,
      filename: "asset-9",
    });
  });

  it("still reports an asset id when MAD omits the content type", async () => {
    const calls = stubFetch([SESSION, {status: 200, body: {assetId: "asset-9"}}]);
    installFakeXhr(calls);

    const asset = await uploadToMad(file, "private");

    expect(asset.assetId).toBe("asset-9");
    expect(asset.mimeType).toBe(file.type);
  });

  describe("upload progress", () => {
    it("reports fractional progress via onProgress as bytes are sent", async () => {
      const calls = stubFetch([SESSION, COMPLETE]);
      const instances = installFakeXhr(calls, {autoRespond: null});
      const onProgress = vi.fn();

      const promise = uploadToMad(file, "private", "image", {onProgress});
      await flushToXhr();

      const xhr = instances[0];
      xhr.upload.onprogress?.({loaded: 2, total: 5, lengthComputable: true});
      xhr.upload.onprogress?.({loaded: 5, total: 5, lengthComputable: true});
      xhr.status = 204;
      xhr.onload?.();

      await promise;

      expect(onProgress.mock.calls).toEqual([[0.4], [1]]);
    });

    it("does not call onProgress when the browser cannot compute the length", async () => {
      const calls = stubFetch([SESSION, COMPLETE]);
      const instances = installFakeXhr(calls, {autoRespond: null});
      const onProgress = vi.fn();

      const promise = uploadToMad(file, "private", "image", {onProgress});
      await flushToXhr();

      const xhr = instances[0];
      // lengthComputable: false must never produce NaN or a fabricated
      // percentage -- the honest thing is to report nothing at all.
      xhr.upload.onprogress?.({loaded: 2, total: 0, lengthComputable: false});
      xhr.status = 204;
      xhr.onload?.();

      await promise;

      expect(onProgress).not.toHaveBeenCalled();
    });

    it("works without a progress callback at all, for callers that never pass one", async () => {
      // useResumeForm calls uploadToMad with no fourth argument -- this must
      // stay a plain, un-broken upload.
      const calls = stubFetch([SESSION, COMPLETE]);
      const instances = installFakeXhr(calls, {autoRespond: null});

      const promise = uploadToMad(file, "private");
      await flushToXhr();

      const xhr = instances[0];
      expect(() =>
        xhr.upload.onprogress?.({loaded: 2, total: 5, lengthComputable: true}),
      ).not.toThrow();
      xhr.status = 204;
      xhr.onload?.();

      await expect(promise).resolves.toMatchObject({assetId: "asset-9"});
    });
  });

  describe("network errors and cancellation", () => {
    it("rejects with the same message shape on a network error as on a bad status", async () => {
      const calls = stubFetch([SESSION, COMPLETE]);
      const instances = installFakeXhr(calls, {autoRespond: null});

      const promise = uploadToMad(file, "private");
      await flushToXhr();

      // No HTTP response at all -- offline, DNS failure, CORS rejection.
      // `xhr.status` stays 0, so this lands on the same message template as
      // a non-2xx response, generalised to status 0 instead of a
      // differently-worded error a caller would need a second check for.
      instances[0].onerror?.();

      await expect(promise).rejects.toThrow(/MAD byte upload failed: 0/);
      // Complete must never fire for a session whose bytes never landed.
      expect(calls).toHaveLength(2);
    });

    it("rejects with an AbortError, not a generic failure, when the caller cancels", async () => {
      const calls = stubFetch([SESSION, COMPLETE]);
      const instances = installFakeXhr(calls, {autoRespond: null});
      const controller = new AbortController();

      const promise = uploadToMad(file, "private", "image", {
        signal: controller.signal,
      });
      await flushToXhr();

      controller.abort();

      await expect(promise).rejects.toMatchObject({name: "AbortError"});
      // The real XHR was told to abort, and complete never fires for a
      // cancelled upload.
      expect(instances[0].onabort).not.toBeNull();
      expect(calls).toHaveLength(2);
    });

    it("aborts before opening a connection when the signal is already aborted", async () => {
      const calls = stubFetch([SESSION, COMPLETE]);
      installFakeXhr(calls, {autoRespond: null});
      const controller = new AbortController();
      controller.abort();

      const promise = uploadToMad(file, "private", "image", {
        signal: controller.signal,
      });

      await expect(promise).rejects.toMatchObject({name: "AbortError"});
      // Session-open still fires (only the byte PUT is signal-aware), but
      // the byte leg itself must never call send() once already cancelled.
      expect(calls).toHaveLength(1);
    });
  });
});

describe("uploadSelectedImage with MAD", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", {
    type: "image/png",
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

  it("uploads via MAD when gateway URL is configured", async () => {
    setEnv({
      NEXT_PUBLIC_MEDIA_GATEWAY_URL: "https://mad.example.com",
      NEXT_PUBLIC_MEDIA_PUBLIC_URL: "https://media.example.com",
    });
    UserService.Instance.authInfo = {auth: "jwt-abc"} as never;
    // Two fetch responses, not three: the byte PUT in the middle of MAD's
    // handshake runs over XMLHttpRequest, not fetch (madUpload.ts's
    // `uploadBytesWithProgress` -- fetch has no request-side progress
    // events), so it needs the fake XHR rather than a third stubbed
    // response. Same pairing as every other MAD test in this file.
    const calls = stubFetch([SESSION, COMPLETE]);
    installFakeXhr(calls);

    const url = await uploadSelectedImage(file);
    expect(url).toBe("https://media.example.com/assets/asset-9/public-bytes");
    // The public URL above can only be built from a completed asset, so
    // this also pins that all three legs ran rather than that the fallback
    // path quietly produced something that happened to match.
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://mad.example.com/uploads",
      "PUT https://mad.example.com/uploads/sess-1/bytes",
      "POST https://mad.example.com/uploads/complete",
    ]);
  });

  it("falls back to uploadImage function when MAD is not configured", async () => {
    setEnv({
      NEXT_PUBLIC_MEDIA_GATEWAY_URL: undefined,
    });

    const fallbackUpload = vi.fn(async () => ({
      state: REQUEST_STATE.SUCCESS,
      data: {
        images: [{ imageUrl: "https://legacy.example.com/files/legacy-avatar.png" }],
      },
    }));

    const url = await uploadSelectedImage(file, fallbackUpload as never);
    expect(fallbackUpload).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://legacy.example.com/files/legacy-avatar.png");
  });
});
