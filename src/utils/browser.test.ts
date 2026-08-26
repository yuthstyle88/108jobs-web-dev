// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { authCookieName, legacyAuthCookieNames } from "@/utils/config";
import { clearAuthCookie, getAuthJWTCookie, setAuthJWTCookie } from "@/utils/browser";

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
