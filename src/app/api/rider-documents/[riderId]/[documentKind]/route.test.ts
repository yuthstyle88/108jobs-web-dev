import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { JWT } from "@/utils/config";

const VALID_KINDS = [
  "idCard",
  "licence",
  "vehicleRegistration",
  "insurance",
  "compulsoryInsurance",
  "face",
  "bankBook",
] as const;

function docRequest(
  riderId: string,
  documentKind: string,
  opts?: { cookie?: string; url?: string; extraHeaders?: Record<string, string> },
) {
  const headers: Record<string, string> = { ...(opts?.extraHeaders ?? {}) };
  if (opts?.cookie) headers.cookie = opts.cookie;
  const url = opts?.url ?? `http://localhost:3000/api/rider-documents/${riderId}/${documentKind}`;
  return new NextRequest(url, { headers });
}

function ctx(riderId: string, documentKind: string) {
  return { params: Promise.resolve({ riderId, documentKind }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/rider-documents/[riderId]/[documentKind]", () => {
  it.each(["0", "-1", "+1", "1a", "01", "1/2", "1%2F2"])(
    "rejects riderId %s with 400 and never calls fetch",
    async (riderId) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET(docRequest(riderId, "face", { cookie: `${JWT}=t` }), ctx(riderId, "face"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_rider_id" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("forwards an oversized riderId, and passes through a mocked backend 400 (i32 overflow)", async () => {
    // We only validate shape (positive-integer digits), never magnitude --
    // an out-of-range id is the backend's own i32 parse to reject, and this
    // route must relay that rejection rather than swallow or reinterpret it.
    const oversized = "99999999999999999999";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid rider id: number too large to fit in target type" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(docRequest(oversized, "face", { cookie: `${JWT}=t` }), ctx(oversized, "face"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/documents/face`);
    expect(String(url)).toContain(oversized);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid rider id: number too large to fit in target type" });
  });

  it.each(["nationalIdCard", "../face", "Licence", ""])(
    "rejects documentKind %s with 400 and never calls fetch",
    async (documentKind) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET(docRequest("1", documentKind, { cookie: `${JWT}=t` }), ctx("1", documentKind));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_document_kind" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(VALID_KINDS)("builds a fetch URL ending /documents/%s for a valid kind", async (kind) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(docRequest("42", kind, { cookie: `${JWT}=t` }), ctx("42", kind));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(new RegExp(`/documents/${kind}$`));
  });

  it("returns 401 without calling fetch when there is no cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(docRequest("1", "face"), ctx("1", "face"));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on a 200, keeps content-type, content-disposition and nosniff, and forces Cache-Control", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("png-bytes", {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-disposition": "inline",
          "x-content-type-options": "nosniff",
          "cache-control": "public, max-age=99999",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(docRequest("1", "face", { cookie: `${JWT}=t` }), ctx("1", "face"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("fetches a fixed URL pattern regardless of extra request headers or a query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(
      docRequest("7", "bankBook", {
        cookie: `${JWT}=t`,
        url: "http://localhost:3000/api/rider-documents/7/bankBook?download=1&redirect=https://attacker.example",
        extraHeaders: { "x-forwarded-host": "attacker.example" },
      }),
      ctx("7", "bankBook"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^[a-z0-9.:/-]*\/api\/v4\/riders\/profile\/7\/documents\/bankBook$/i);
  });
});
