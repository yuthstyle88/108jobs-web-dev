import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forwardAuthedUpstream } from "./authed-upstream-proxy";
import { JWT } from "@/utils/config";

const UPSTREAM_URL = "https://backend.internal.test/api/v4/riders/profile/1/documents/face";

function req(opts?: {
  url?: string;
  cookie?: string;
  range?: string;
  extraHeaders?: Record<string, string>;
  method?: string;
  body?: string;
}) {
  const headers: Record<string, string> = { ...(opts?.extraHeaders ?? {}) };
  if (opts?.cookie) headers.cookie = opts.cookie;
  if (opts?.range) headers.range = opts.range;

  const init: { headers: Record<string, string>; method?: string; body?: string } = { headers };
  if (opts?.method) init.method = opts.method;
  if (opts?.body !== undefined) init.body = opts.body;

  return new NextRequest(opts?.url ?? "http://localhost:3000/api/rider-documents/1/face", init);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("forwardAuthedUpstream", () => {
  it("returns 401 without calling upstream when there is no token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req(), UPSTREAM_URL);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls fetch with the exact upstream URL, a Bearer token, and cache: no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await forwardAuthedUpstream(req({ cookie: `${JWT}=secret-token` }), UPSTREAM_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(UPSTREAM_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(init.cache).toBe("no-store");
  });

  it("open-proxy contract: the upstream URL never changes with the incoming request's own url, headers or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // A request shaped nothing like the target: a different path, a spoofed
    // forwarding header, and a body carrying what looks like an attempted
    // redirect target -- none of it is ever consulted for the fetch target.
    await forwardAuthedUpstream(
      req({
        url: "http://localhost:3000/totally/different/path?riderId=999&host=attacker.example",
        cookie: `${JWT}=t1`,
        extraHeaders: { "x-forwarded-host": "attacker.example", "x-evil": "inject" },
        method: "POST",
        body: "riderId=999&documentKind=../../../etc/passwd&url=https://attacker.example",
      }),
      UPSTREAM_URL,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(UPSTREAM_URL);

    fetchMock.mockClear();
    await forwardAuthedUpstream(req({ url: "http://localhost:3000/", cookie: `${JWT}=t2` }), UPSTREAM_URL);
    expect(fetchMock.mock.calls[0][0]).toBe(UPSTREAM_URL);
  });

  it("forwards content-type, content-length, x-content-type-options and content-disposition verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("bytes", {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "5",
          "x-content-type-options": "nosniff",
          "content-disposition": 'attachment; filename="doc.svg"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req({ cookie: `${JWT}=t` }), UPSTREAM_URL);

    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe("5");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="doc.svg"');
  });

  it("forces Cache-Control: private, no-store even when the upstream sends something else", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "cache-control": "public, max-age=99999" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req({ cookie: `${JWT}=t` }), UPSTREAM_URL);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes a non-200 upstream status and body through unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req({ cookie: `${JWT}=t` }), UPSTREAM_URL);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("returns 502 with no URL or token anywhere in the body when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req({ cookie: `${JWT}=super-secret-token` }), UPSTREAM_URL);

    expect(res.status).toBe(502);
    const bodyText = await res.text();
    expect(bodyText).not.toContain(UPSTREAM_URL);
    expect(bodyText).not.toContain("super-secret-token");
  });

  it("does not forward Range on the request, or content-range/accept-ranges on the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("partial", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-12/685000",
          "accept-ranges": "bytes",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await forwardAuthedUpstream(req({ cookie: `${JWT}=t`, range: "bytes=0-12" }), UPSTREAM_URL);

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Range).toBeUndefined();
    expect(res.headers.get("content-range")).toBeNull();
    expect(res.headers.get("accept-ranges")).toBeNull();
  });
});
