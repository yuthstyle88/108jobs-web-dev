// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isAdminClaims, JOBS_ADMIN_ROLE } from "./UserService";

describe("isAdminClaims", () => {
  it("returns false for undefined claims", () => {
    expect(isAdminClaims(undefined)).toBe(false);
  });

  it("returns false when roles is missing", () => {
    expect(isAdminClaims({ sub: "1", iss: "auth-service", aud: "jobs", exp: 0, iat: 0, realm: "r", platform: "p", tenant_id: "t" } as any)).toBe(false);
  });

  it("returns false when roles doesn't include jobs:admin", () => {
    expect(isAdminClaims({ roles: ["jobs:user"] } as any)).toBe(false);
  });

  it("returns true when roles includes jobs:admin", () => {
    expect(isAdminClaims({ roles: ["jobs:user", JOBS_ADMIN_ROLE] } as any)).toBe(true);
  });
});

import { UserService } from "./UserService";
import { useTermsStore } from "@/store/useTermsStore";
import { HttpService } from "./HttpService";
import { getAuthJWTCookie, setAuthJWTCookie } from "@/utils/browser";
import { LANGUAGE_COOKIE } from "@/constants/language";

describe("UserService profile hydration", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    document.cookie = `${LANGUAGE_COOKIE}=; Max-Age=0; path=/`;
  });

  it.each(["en", "vi"] as const)("keeps the %s URL language over Thai cookie and profile defaults", async (lang) => {
    window.history.replaceState({}, "", `/${lang}/login`);
    document.cookie = `${LANGUAGE_COOKIE}=th; path=/`;
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({
        state: "success",
        data: {
          localUserView: {
            localUser: { interfaceLanguage: "th" },
          },
        },
      }),
      getTermsStatus: vi.fn().mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v1", rideVersion: "v1", jobsAccepted: true, rideAccepted: false },
      }),
    } as any);

    await UserService.Instance.login("not-a-real-jwt");

    expect(UserService.Instance.getLanguage).toBe(lang);
    expect(document.cookie).toContain(`${LANGUAGE_COOKIE}=${lang}`);
    expect(UserService.Instance.getAcceptedTerms).toBe(true);
  });
});

describe("UserService terms consent is per sub-app", () => {
  beforeEach(() => {
    UserService.Instance.acceptedTerms = false;
    UserService.Instance.jobsTermsVersion = undefined;
    useTermsStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The whole point of the split. Someone on record for the ride service and
   * nobody else must not read as having accepted this site's terms -- if this
   * ever passes with `true`, consent is leaking across two separate legal
   * agreements and the sub-app boundary is decorative.
   */
  it("does not count ride consent as jobs consent", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getTermsStatus: vi.fn().mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v1", rideVersion: "v1", jobsAccepted: false, rideAccepted: true },
      }),
    } as any);

    await UserService.Instance.hydrateTerms();

    expect(UserService.Instance.getAcceptedTerms).toBe(false);
    expect(useTermsStore.getState().jobsAccepted).toBe(false);
  });

  it("reads acceptance from the terms endpoint, not from the user payload", async () => {
    const getMyUser = vi.fn().mockResolvedValue({
      state: "success",
      // The field the API used to send and no longer does. Even if something
      // put it back, it must not be what decides this.
      data: { localUserView: { localUser: { interfaceLanguage: "th", acceptedTerms: true } } },
    });
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser,
      getTermsStatus: vi.fn().mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v9", rideVersion: "v1", jobsAccepted: false, rideAccepted: false },
      }),
    } as any);

    await UserService.Instance.login("not-a-real-jwt");

    expect(UserService.Instance.getAcceptedTerms).toBe(false);
    expect(UserService.Instance.jobsTermsVersion).toBe("v9");
  });

  it("accepts as Jobs and echoes back the server's version", async () => {
    const acceptTerms = vi.fn().mockResolvedValue({
      state: "success",
      data: { app: "Jobs", termsVersion: "v9", acceptedAt: "2026-08-27T00:00:00Z" },
    });
    const getTermsStatus = vi
      .fn()
      .mockResolvedValueOnce({
        state: "success",
        data: { jobsVersion: "v9", rideVersion: "v1", jobsAccepted: false, rideAccepted: false },
      })
      .mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v9", rideVersion: "v1", jobsAccepted: true, rideAccepted: false },
      });
    vi.spyOn(HttpService, "client", "get").mockReturnValue({ acceptTerms, getTermsStatus } as any);

    await UserService.Instance.hydrateTerms();
    const ok = await UserService.Instance.acceptJobsTerms();

    expect(ok).toBe(true);
    expect(acceptTerms).toHaveBeenCalledWith({ app: "Jobs", termsVersion: "v9" });
    // Never the other app, whatever else happens on this call.
    expect(acceptTerms).not.toHaveBeenCalledWith(expect.objectContaining({ app: "Ride" }));
  });

  /**
   * A rejected accept must leave the flag alone. Reporting success on a request
   * the server refused would dismiss the dialog and leave the user believing
   * they had agreed to something no record exists for.
   */
  it("stays unaccepted when the server refuses the acceptance", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      acceptTerms: vi.fn().mockResolvedValue({ state: "failed", err: { error: "invalidField" } }),
      getTermsStatus: vi.fn().mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v9", rideVersion: "v1", jobsAccepted: false, rideAccepted: false },
      }),
    } as any);

    await UserService.Instance.hydrateTerms();

    expect(await UserService.Instance.acceptJobsTerms()).toBe(false);
    expect(UserService.Instance.getAcceptedTerms).toBe(false);
  });

  /**
   * One browser, two accounts. If logout leaves the consent behind, the next
   * person to sign in here inherits an acceptance recorded against someone
   * else -- the failure this whole mechanism exists to make impossible.
   */
  it("forgets the consent on logout so the next account does not inherit it", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getTermsStatus: vi.fn().mockResolvedValue({
        state: "success",
        data: { jobsVersion: "v9", rideVersion: "v1", jobsAccepted: true, rideAccepted: false },
      }),
    } as any);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await UserService.Instance.hydrateTerms();
    expect(UserService.Instance.getAcceptedTerms).toBe(true);

    await UserService.Instance.logout();

    expect(UserService.Instance.getAcceptedTerms).toBe(false);
    expect(UserService.Instance.jobsTermsVersion).toBeUndefined();
    expect(useTermsStore.getState().jobsAccepted).toBe(false);
    expect(useTermsStore.getState().loaded).toBe(false);
    vi.unstubAllGlobals();
  });

  it("survives a terms endpoint that throws, without claiming acceptance", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getTermsStatus: vi.fn().mockRejectedValue(new Error("network down")),
    } as any);

    await expect(UserService.Instance.hydrateTerms()).resolves.toBeUndefined();
    expect(UserService.Instance.getAcceptedTerms).toBe(false);
    expect(useTermsStore.getState().loaded).toBe(false);
  });
});

describe("UserService logout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
    document.cookie = `${LANGUAGE_COOKIE}=; Max-Age=0; path=/`;
  });

  it.each(["en", "vi"] as const)("returns to login in the active %s URL language", async (lang) => {
    vi.useFakeTimers();
    const replace = vi.fn();
    window.history.replaceState({}, "", `/${lang}/profile`);
    vi.stubGlobal("location", { pathname: `/${lang}/profile`, replace });
    document.cookie = `${LANGUAGE_COOKIE}=th; path=/`;
    UserService.Instance.currentLanguage = "th";
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      logout: vi.fn().mockResolvedValue({ state: "success" }),
    } as any);

    await UserService.Instance.logout();
    await vi.advanceTimersByTimeAsync(150);

    expect(replace).toHaveBeenCalledWith(`/${lang}/login`);
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("UserService refresh scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("schedules exactly one refresh call after login, firing before the token's expiry", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-token", expiresIn: 3600 })); // /api/auth/refresh
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ accessToken: fakeJwt, refreshToken: "a-refresh-token" }),
    }));

    // Token expires in 120s from "now"; REFRESH_MARGIN_MS is 60s, so the
    // timer should fire at ~60s, well before the full 120s.
    await vi.advanceTimersByTimeAsync(61_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(getAuthJWTCookie()).toBe("new-token");
  });

  it("does not persist a refresh cookie when no refreshToken is provided (e.g. OAuth login), but still attempts -- and fails closed via logout -- off the JWT's own exp", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
      logout: vi.fn().mockResolvedValue({ state: "success" }),
    } as any);
    // No refresh cookie exists server-side either, so every /api/auth/refresh 401s.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "no_refresh_token" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt);

    // login() never called /api/auth/session since there's no refresh token.
    expect(fetchMock).not.toHaveBeenCalled();

    // A refresh attempt is still scheduled off the JWT's own exp, unlike the
    // old design where an absent refresh-token cookie skipped scheduling
    // entirely. It 401s (no server-side refresh cookie either), retries
    // twice, then logs out -- a clean end state rather than a session that
    // silently goes stale. logout() itself makes one more fetch call (DELETE
    // /api/auth/session) on top of the 3 failed refresh attempts.
    await vi.advanceTimersByTimeAsync(61_000 + 3_000 + 3_000);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/session", expect.objectContaining({ method: "DELETE" }));
    expect(UserService.Instance.authInfo).toBeUndefined();
  });

  it("re-arms the refresh timer from setToken(), the page-reload rehydration path", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accessToken: "new-token", expiresIn: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    // setToken() is called by UserServiceContext on every app mount/reload,
    // reading the access-token cookie back into memory -- it must re-arm the
    // refresh timer the same way login() does. The refresh token itself now
    // lives server-side only (HttpOnly cookie), invisible to this test.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.setToken(fakeJwt);

    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(61_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(getAuthJWTCookie()).toBe("new-token");
  });

  it("retries once after a failed refresh while the access token is still valid, and succeeds without logging out", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockRejectedValueOnce(new Error("network blip")) // first /api/auth/refresh attempt
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-token", expiresIn: 3600 })); // retry succeeds
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // First attempt fires at ~60s and fails (network blip). The access token
    // still has ~60s of life left, so this must NOT trigger a logout -- it
    // should instead schedule a retry.
    await vi.advanceTimersByTimeAsync(61_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(UserService.Instance.authInfo).toBeDefined();
    expect(UserService.Instance.authInfo?.claims?.exp).toBe(payload.exp);

    // Retry fires 3s later and succeeds.
    await vi.advanceTimersByTimeAsync(3_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(UserService.Instance.authInfo).toBeDefined();
    expect(getAuthJWTCookie()).toBe("new-token");
  });

  it("logs out after the retry also fails", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
      logout: vi.fn().mockResolvedValue({ state: "success" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockRejectedValue(new Error("network blip")); // every /api/auth/refresh attempt
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Original attempt at ~60s fails.
    await vi.advanceTimersByTimeAsync(61_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(UserService.Instance.authInfo).toBeDefined();

    // First retry (+3s) also fails. retryCount was 0, still < MAX_REFRESH_RETRIES=2,
    // so another retry is scheduled instead of giving up.
    await vi.advanceTimersByTimeAsync(3_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(UserService.Instance.authInfo).toBeDefined();

    // Second retry (+3s) also fails. retryCount was 1, now == MAX_REFRESH_RETRIES=2,
    // so retries are exhausted and logout() is called -- one more fetch call
    // (DELETE /api/auth/session) on top of the 3 refresh attempts.
    await vi.advanceTimersByTimeAsync(3_000);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/session", expect.objectContaining({ method: "DELETE" }));
    expect(UserService.Instance.authInfo).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("adopts a sibling tab's already-rotated JWT cookie on retry instead of hitting the network again", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockImplementationOnce(async () => {
        // Simulates a sibling tab completing its own rotation (and writing
        // the shared, still-readable JWT cookie) at roughly the same moment
        // this tab's own refresh call is rejected.
        setAuthJWTCookie(makeFreshJwtCookie());
        throw new Error("refresh_token_reuse");
      });
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    function makeFreshJwtCookie() {
      const freshPayload = { ...payload, exp: nowSeconds + 10_000 };
      return `${b64(header)}.${b64(freshPayload)}.sig`;
    }

    await UserService.Instance.login(fakeJwt, "rt-original");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Initial refresh fires at ~60s, fails, and a sibling's fresh JWT cookie
    // lands during that failure. The 3s-later retry must adopt it via
    // #adoptCookieIfFresh() instead of calling /api/auth/refresh again.
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3_000);

    expect(fetchMock).toHaveBeenCalledTimes(2); // no third call -- adopted instead
    expect(UserService.Instance.authInfo?.claims?.exp).toBe(nowSeconds + 10_000);
  });
});

describe("UserService refresh scheduling with Web Locks", () => {
  let mockLocksRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLocksRequest = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      return Promise.resolve().then(callback);
    });
    Object.defineProperty(navigator, "locks", {
      value: { request: mockLocksRequest },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // @ts-expect-error -- test-only stub; real jsdom has no `locks` property
    delete navigator.locks;
  });

  it("adopts an already-fresh cookie without calling the network", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const makeJwt = (exp: number) => {
      const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
      return `${b64(header)}.${b64(payload)}.sig`;
    };

    // Schedules a refresh at ~60s (exp is 120s out, REFRESH_MARGIN_MS is 60s).
    const staleJwt = makeJwt(nowSeconds + 120);
    await UserService.Instance.login(staleJwt, "a-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1); // just the /api/auth/session call from login()

    // Simulate a sibling tab completing a refresh in the meantime: overwrite
    // the access-token cookie with a fresh one, well outside REFRESH_MARGIN_MS.
    const freshJwt = makeJwt(nowSeconds + 10_000);
    setAuthJWTCookie(freshJwt);

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mockLocksRequest).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no /api/auth/refresh call
    expect(UserService.Instance.authInfo?.claims?.exp).toBe(nowSeconds + 10_000);
  });

  it("performs the real refresh under the lock when the cookie is still near-expiry, invoking the Locks API with the expected name", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-token", expiresIn: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mockLocksRequest).toHaveBeenCalledTimes(1);
    expect(mockLocksRequest).toHaveBeenCalledWith("108heros-refresh-token-lock", expect.any(Function));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/refresh", expect.objectContaining({ method: "POST" }));
  });

  it("routes the retry back through the lock instead of calling #refreshAccessToken directly", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // /api/auth/session from login()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-token", expiresIn: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");

    // Initial attempt at ~60s fails (network blip), acquiring the lock once.
    await vi.advanceTimersByTimeAsync(61_000);

    expect(mockLocksRequest).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Retry fires 3s later. It must ALSO acquire the lock -- not call
    // #refreshAccessToken directly, unlocked -- which is exactly the bug
    // this test exists to catch.
    await vi.advanceTimersByTimeAsync(3_000);

    expect(mockLocksRequest).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(UserService.Instance.authInfo).toBeDefined();
  });
});
