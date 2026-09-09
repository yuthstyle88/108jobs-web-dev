// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { authCookieName, legacyAuthCookieNames } from "@/utils/config";
import {
  clearAuthCookie,
  getAuthJWTCookie,
  retireLegacyAuthCookies,
  setAuthJWTCookie,
} from "@/utils/browser";

function wipeAuthCookies() {
  for (const name of [authCookieName, ...legacyAuthCookieNames]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

describe("auth cookie", () => {
  afterEach(wipeAuthCookies);

  it("is named independently of the product name", () => {
    expect(authCookieName).toBe("108_auth");
  });

  it("reads a token written under the stable name", () => {
    setAuthJWTCookie("stable-token");
    expect(getAuthJWTCookie()).toBe("stable-token");
  });

  it("returns null when no auth cookie is present", () => {
    expect(getAuthJWTCookie()).toBeNull();
  });

  it.each([...legacyAuthCookieNames])("adopts a token held under the legacy name %s", (legacy) => {
    document.cookie = `${legacy}=legacy-token; path=/`;

    expect(getAuthJWTCookie()).toBe("legacy-token");
    expect(document.cookie).toContain(`${authCookieName}=legacy-token`);
    expect(document.cookie).not.toContain(`${legacy}=legacy-token`);
  });

  it("prefers the stable cookie and leaves a legacy cookie untouched", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;
    setAuthJWTCookie("stable-token");

    expect(getAuthJWTCookie()).toBe("stable-token");
    expect(document.cookie).toContain("108Jobs=legacy-token");
  });

  it("clears the stable name and every legacy name on logout", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;
    setAuthJWTCookie("stable-token");

    clearAuthCookie();

    expect(document.cookie).not.toContain("stable-token");
    expect(document.cookie).not.toContain("legacy-token");
    expect(getAuthJWTCookie()).toBeNull();
  });
});

// UserServiceContext's SSR path can populate the token from isoData.jwt --
// itself read from a legacy cookie name by getJwtCookieFromServer /
// getJwtFromRequest (see src/utils/helper-server.ts) -- without ever calling
// getAuthJWTCookie(). retireLegacyAuthCookies() is the standalone retirement
// step called from that hydration path so a legacy cookie still gets cleared
// even when it never went through getAuthJWTCookie()'s own migration branch.
describe("retireLegacyAuthCookies", () => {
  afterEach(wipeAuthCookies);

  it("retires a legacy cookie without changing an already-present stable cookie", () => {
    setAuthJWTCookie("stable-token");
    document.cookie = `108Jobs=legacy-token; path=/`;

    retireLegacyAuthCookies();

    expect(document.cookie).toContain(`${authCookieName}=stable-token`);
    expect(document.cookie).not.toContain("108Jobs=legacy-token");
  });

  it("adopts the legacy token into the stable cookie when no stable cookie exists yet", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;

    retireLegacyAuthCookies();

    expect(document.cookie).toContain(`${authCookieName}=legacy-token`);
    expect(document.cookie).not.toContain("108Jobs=legacy-token");
  });

  it("is idempotent: a second call is a no-op", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;

    retireLegacyAuthCookies();
    retireLegacyAuthCookies();

    expect(document.cookie).toContain(`${authCookieName}=legacy-token`);
    expect(document.cookie).not.toContain("108Jobs=legacy-token");
  });

  it("is a no-op when no auth cookie is present at all", () => {
    retireLegacyAuthCookies();

    expect(getAuthJWTCookie()).toBeNull();
    for (const legacy of legacyAuthCookieNames) {
      expect(document.cookie).not.toContain(`${legacy}=`);
    }
  });
});
