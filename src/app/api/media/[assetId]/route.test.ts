import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { authCookieName, JWT } from "@/utils/config";

const VALID_ASSET_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function mediaRequest(assetId: string, opts?: { cookie?: string; range?: string }) {
  const headers: Record<string, string> = {};
  if (opts?.cookie) headers.cookie = opts.cookie;
  if (opts?.range) headers.range = opts.range;
  return new NextRequest(`http://localhost:3000/api/media/${assetId}`, { headers });
}

function ctx(assetId: string) {
  return { params: Promise.resolve({ assetId }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/media/[assetId]", () => {
  it("returns 401 without calling upstream when there is no auth cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(mediaRequest(VALID_ASSET_ID), ctx(VALID_ASSET_ID));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the app-named cookie as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("bytes", { status: 200, headers: { "content-type": "image/png", "content-length": "5" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      mediaRequest(VALID_ASSET_ID, { cookie: `${authCookieName}=app-cookie-token` }),
      ctx(VALID_ASSET_ID),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/api/v4/media-proxy/${VALID_ASSET_ID}`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer app-cookie-token");
  });

  it("forwards the jwt cookie as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("bytes", { status: 200, headers: { "content-type": "image/png" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(mediaRequest(VALID_ASSET_ID, { cookie: `${JWT}=jwt-cookie-token` }), ctx(VALID_ASSET_ID));

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-cookie-token");
  });

  it("rejects a non-UUID assetId without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      mediaRequest("not-a-uuid", { cookie: `${JWT}=jwt-cookie-token` }),
      ctx("not-a-uuid"),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves an upstream error status (e.g. room-membership denied)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(mediaRequest(VALID_ASSET_ID, { cookie: `${JWT}=t` }), ctx(VALID_ASSET_ID));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("forwards Range and passes a 206 through unchanged, including Content-Range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("partial-bytes", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-length": "13",
          "content-range": "bytes 0-12/685000",
          "accept-ranges": "bytes",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      mediaRequest(VALID_ASSET_ID, { cookie: `${JWT}=t`, range: "bytes=0-12" }),
      ctx(VALID_ASSET_ID),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Range).toBe("bytes=0-12");

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-12/685000");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("13");
    expect(await res.text()).toBe("partial-bytes");
  });

  it("always sets Cache-Control: private, no-store, overriding whatever the upstream sent", async () => {
    // Regression: the real backend has been observed sending its own
    // `Cache-Control: public, max-age=60` even on a 401 -- this route must
    // never let that outlive the room-membership check it protects.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(mediaRequest(VALID_ASSET_ID, { cookie: `${JWT}=t` }), ctx(VALID_ASSET_ID));

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("never leaks a MAD URL: only the configured backend origin is ever fetched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(mediaRequest(VALID_ASSET_ID, { cookie: `${JWT}=t` }), ctx(VALID_ASSET_ID));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^[a-z0-9.:/-]*\/api\/v4\/media-proxy\/[0-9a-f-]+$/i);
    expect(init.cache).toBe("no-store");
  });
});
