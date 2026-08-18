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
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.108jobs.com";
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = "https://identity.108jobs.com";
    process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL = "https://media-gateway.108jobs.com";
    process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL = "https://cdn.108jobs.com";

    const directive = await connectSrcDirective();

    expect(directive).toContain("https://media-gateway.108jobs.com");
    expect(directive).toContain("https://cdn.108jobs.com");
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
