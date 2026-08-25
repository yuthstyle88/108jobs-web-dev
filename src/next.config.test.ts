import { describe, expect, it, beforeEach, afterEach } from "vitest";
import nextConfig from "../next.config";

// Regression coverage for the fix that added the MAD media gateway origin to the
// Content-Security-Policy connect-src directive. Without it, uploadToMad's plain
// fetch() calls (madUpload.ts) to NEXT_PUBLIC_MEDIA_GATEWAY_URL are blocked by the
// browser's own CSP before the request ever reaches the network -- surfacing as the
// same generic `TypeError: Failed to fetch` as an actual network failure, and never
// appearing in the gateway's request logs, which is what made this easy to
// misdiagnose as a network/sandbox problem instead of a header the app itself sends.
describe("next.config headers() CSP connect-src", () => {
  const ENV_KEYS = [
    "NEXT_PUBLIC_API_BASE_URL",
    "NEXT_PUBLIC_IDENTITY_BASE_URL",
    "NEXT_PUBLIC_MEDIA_GATEWAY_URL",
    "NEXT_PUBLIC_MEDIA_PUBLIC_URL",
  ] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  async function connectSrcDirective(): Promise<string> {
    const result = await nextConfig.headers!();
    const catchAll = result.find((entry) => entry.source === "/(.*)");
    const csp = catchAll?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
    if (!csp) throw new Error("no Content-Security-Policy header found");
    const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src"));
    if (!directive) throw new Error("no connect-src directive found");
    return directive;
  }

  it("allows the media gateway origin (this environment's actual local setup)", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8536";
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = "http://localhost:8090";
    process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL = "http://localhost:8091";
    process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL = "http://localhost:8091";

    const directive = await connectSrcDirective();

    expect(directive).toContain("http://localhost:8536");
    expect(directive).toContain("ws://localhost:8536");
    expect(directive).toContain("http://localhost:8090");
    expect(directive).toContain("http://localhost:8091");
    // Same host for both env vars -- should not appear twice.
    expect(directive.match(/http:\/\/localhost:8091/g)).toHaveLength(1);
  });

  it("allows a media public URL that differs from the gateway (e.g. a CDN in front of it)", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.108heros.com";
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = "https://identity.108heros.com";
    process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL = "https://media-gateway.108heros.com";
    process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL = "https://cdn.108heros.com";

    const directive = await connectSrcDirective();

    expect(directive).toContain("https://media-gateway.108heros.com");
    expect(directive).toContain("https://cdn.108heros.com");
  });

  it("omits media origins entirely when unset, instead of injecting an empty source", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8536";
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = "http://localhost:8090";
    delete process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL;
    delete process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL;

    const directive = await connectSrcDirective();

    // No stray empty token from new URL("").origin ("null") leaking into the header.
    expect(directive).not.toContain("null");
    expect(directive.trim().endsWith(" ")).toBe(false);
  });
});

// Regression coverage for the same-origin media proxy (src/app/api/media/[assetId]/route.ts).
// `afterFiles` already has a catch-all `/api/:path*` rewrite straight to the backend, and
// `/api/media/[assetId]` is a *dynamic* route -- unlike `/api/auth/session` and
// `/api/auth/refresh` (non-dynamic, guarded via a `beforeFiles` self-mapping above), a
// `beforeFiles` self-mapping does not force a dynamic route to resolve before the catch-all
// (confirmed empirically against a real dev server: it fell through to the catch-all and got
// proxied to `${apiBase}/media/:path*`, a path the backend does not serve). The self-mapping
// has to live in `afterFiles`, positioned before the catch-all, for Next to re-check dynamic
// routes against it.
describe("next.config rewrites() media proxy precedence", () => {
  it("maps /api/media/* to itself in afterFiles, positioned before the catch-all backend proxy", async () => {
    const result = await nextConfig.rewrites!();
    const afterFiles = Array.isArray(result) ? result : (result.afterFiles ?? []);

    const mediaIndex = afterFiles.findIndex(
      (r) => r.source === "/api/media/:path*" && r.destination === "/api/media/:path*",
    );
    const catchAllIndex = afterFiles.findIndex((r) => r.source === "/api/:path*");

    expect(mediaIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThanOrEqual(0);
    expect(mediaIndex).toBeLessThan(catchAllIndex);
  });

  it("does not rely on a beforeFiles self-mapping for the (dynamic) media route -- that mechanism only works for non-dynamic routes", async () => {
    const result = await nextConfig.rewrites!();
    const beforeFiles = Array.isArray(result) ? [] : (result.beforeFiles ?? []);

    expect(beforeFiles.some((r) => r.source.startsWith("/api/media"))).toBe(false);
  });
});
