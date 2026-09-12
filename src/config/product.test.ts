import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getProductHost, getProfilePrefix, PRODUCT_PROFILE_PREFIX} from "@/config/product";
import {getAppDomain} from "@/utils/appConfig";

// #172: the profile link was built from the product NAME, so once the name
// became "108Heros" the link read `108Heros/profile/` — a host that does not
// exist — while the domain stayed 108jobs.com. These fail if a host is ever
// built from the name again. vitest runs in "node" (vitest.config.ts), so this
// is the server branch of getAppName()/getAppDomain(); both branches of those
// are covered in src/utils/appConfig.test.ts.
const ENV_KEYS = [
  "APP_NAME",
  "NEXT_PUBLIC_APP_NAME",
  "APP_DOMAIN",
  "NEXT_PUBLIC_APP_DOMAIN",
  "NEXT_PUBLIC_API_HOST_NAME",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("getProfilePrefix", () => {
  it("is built from the domain, whatever the product is called", () => {
    process.env.NEXT_PUBLIC_APP_NAME = "ชื่ออะไรก็ได้";
    process.env.APP_NAME = "Any Brand At All";

    expect(getProfilePrefix()).toBe(`${getAppDomain()}/profile/`);
    expect(getProfilePrefix()).not.toContain("ชื่ออะไรก็ได้");
    expect(getProfilePrefix()).not.toContain("Any Brand At All");
  });

  it("with nothing configured is the real host, the same as PRODUCT_PROFILE_PREFIX", () => {
    expect(getProfilePrefix()).toBe("108jobs.com/profile/");
    expect(getProfilePrefix()).toBe(PRODUCT_PROFILE_PREFIX);
  });

  it("follows a configured domain", () => {
    process.env.APP_NAME = "Staging 108Heros";
    process.env.APP_DOMAIN = "staging.108jobs.com";

    expect(getProfilePrefix()).toBe("staging.108jobs.com/profile/");
  });
});

describe("getProductHost", () => {
  it("falls back to the domain, not the product name", () => {
    process.env.APP_NAME = "Any Brand At All";

    expect(getProductHost()).toBe(getAppDomain());
    expect(getProductHost()).toBe("108jobs.com");
  });

  it("still prefers NEXT_PUBLIC_API_HOST_NAME when it is set", () => {
    process.env.NEXT_PUBLIC_API_HOST_NAME = "api.108jobs.com";

    expect(getProductHost()).toBe("api.108jobs.com");
  });
});
