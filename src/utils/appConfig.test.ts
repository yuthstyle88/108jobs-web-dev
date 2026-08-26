import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppName, getAppUrl } from "./appConfig";

describe("appConfig utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getAppUrl", () => {
    it("returns NEXT_PUBLIC_APP_URL when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.108heros.com";
      process.env.NEXT_PUBLIC_APP_NAME = "108Heros";
      expect(getAppUrl()).toBe("https://app.108heros.com");
    });

    it("falls back to https://108heros.com when NEXT_PUBLIC_APP_URL is empty even if APP_NAME is set", () => {
      delete process.env.APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_APP_NAME = "108Heros";
      expect(getAppUrl()).toBe("https://108heros.com");
    });
  });

  describe("getAppName", () => {
    it("returns NEXT_PUBLIC_APP_NAME when set", () => {
      process.env.NEXT_PUBLIC_APP_NAME = "108Heros Custom";
      expect(getAppName()).toBe("108Heros Custom");
    });

    it("falls back to default 108heros.com when unset", () => {
      delete process.env.APP_NAME;
      delete process.env.NEXT_PUBLIC_APP_NAME;
      expect(getAppName()).toBe("108heros.com");
    });
  });
});
