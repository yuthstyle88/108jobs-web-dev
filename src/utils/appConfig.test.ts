import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {getAppDomain} from "@/utils/appConfig";

// Regression coverage for getAppDomain() (Task 3.5 of the web rebrand). The
// fallback/override precedence mirrors getAppName()/getAppUrl(), but getAppDomain()
// shipped with no test of its own, and its docstring's "no scheme, no trailing
// slash" contract was unenforced -- a misconfigured NEXT_PUBLIC_APP_DOMAIN (e.g.
// carrying a scheme or a trailing slash) would silently corrupt every URL and
// email address interpolated from it across the translation files and
// src/lib/metadata/generators.ts. getAppDomain() now strips a leading scheme and
// trailing slash(es) defensively; these tests cover both that normalization and
// the precedence rules themselves.
describe("getAppDomain", () => {
  const ENV_KEYS = ["APP_DOMAIN", "NEXT_PUBLIC_APP_DOMAIN"] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    vi.unstubAllGlobals();
  });

  // isBrowser() is `typeof window !== "undefined"`. The vitest default "node"
  // environment (this file's environment -- see vitest.config.ts) has no global
  // `window`, so these exercise the server branch without any extra setup.
  describe("on the server", () => {
    it("falls back to the hardcoded domain when no env var is set", () => {
      expect(getAppDomain()).toBe("108jobs.com");
    });

    it("NEXT_PUBLIC_APP_DOMAIN overrides the hardcoded fallback", () => {
      process.env.NEXT_PUBLIC_APP_DOMAIN = "staging.108jobs.com";

      expect(getAppDomain()).toBe("staging.108jobs.com");
    });

    it("prefers APP_DOMAIN over NEXT_PUBLIC_APP_DOMAIN", () => {
      process.env.APP_DOMAIN = "server-only.108jobs.com";
      process.env.NEXT_PUBLIC_APP_DOMAIN = "public-only.108jobs.com";

      expect(getAppDomain()).toBe("server-only.108jobs.com");
    });

    it("strips a leading scheme and trailing slash from a misconfigured value", () => {
      process.env.APP_DOMAIN = "https://108jobs.com/";

      expect(getAppDomain()).toBe("108jobs.com");
    });
  });

  // Stubbing the `window` global (same vi.stubGlobal used for `fetch` in
  // jwt-verify.test.ts) is enough to flip isBrowser() to true without needing a
  // full jsdom environment -- and keeps both branches in this one file, since a
  // `@vitest-environment` pragma applies to the whole file, not per describe block.
  describe("on the client (window stubbed)", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {});
    });

    it("falls back to the hardcoded domain when no env var is set", () => {
      expect(getAppDomain()).toBe("108jobs.com");
    });

    it("reads NEXT_PUBLIC_APP_DOMAIN, ignoring the server-only APP_DOMAIN", () => {
      process.env.APP_DOMAIN = "server-only.108jobs.com";
      process.env.NEXT_PUBLIC_APP_DOMAIN = "public.108jobs.com";

      expect(getAppDomain()).toBe("public.108jobs.com");
    });

    it("strips a leading scheme and trailing slash from a misconfigured value", () => {
      process.env.NEXT_PUBLIC_APP_DOMAIN = "https://108jobs.com/";

      expect(getAppDomain()).toBe("108jobs.com");
    });
  });

  it("never returns a scheme or a trailing slash, however it is configured", () => {
    const cases = [
      undefined,
      "108jobs.com",
      "static.108jobs.com",
      "https://108jobs.com/",
      "http://108jobs.com///",
    ];

    for (const value of cases) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      else process.env.NEXT_PUBLIC_APP_DOMAIN = value;

      const result = getAppDomain();

      expect(result).not.toMatch(/:\/\//);
      expect(result.endsWith("/")).toBe(false);
    }
  });
});
