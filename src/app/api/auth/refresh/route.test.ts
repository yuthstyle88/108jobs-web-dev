import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { authCookieName, REFRESH_TOKEN_COOKIE } from "@/utils/config";

function refreshRequest(cookie?: string) {
  return new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/auth/refresh", () => {
  it("returns 401 without calling the backend when there is no refresh-token cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(refreshRequest());

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges the refresh cookie for a new access token and rotates the cookie, without leaking the refresh token back to the client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "at-new", refreshToken: "rt-new", expiresIn: 900 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(refreshRequest(`${REFRESH_TOKEN_COOKIE}=rt-old`));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ accessToken: "at-new", expiresIn: 900 });
    expect(json.refreshToken).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/account/auth/refresh/identity-platform");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "rt-old" });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${authCookieName}=at-new`);
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE}=rt-new`);
    expect(setCookie).toContain("HttpOnly");
  });

  it("clears the cookie and returns 401 when the backend rejects the refresh token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_refresh_token" }), { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(refreshRequest(`${REFRESH_TOKEN_COOKIE}=rt-old`));

    expect(res.status).toBe(401);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE}=`);
    expect(setCookie).toContain(`${authCookieName}=`);
    expect(setCookie).toMatch(/Max-Age=0/);
  });

  it("clears the cookie and returns 401 when the backend call throws (network failure)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(refreshRequest(`${REFRESH_TOKEN_COOKIE}=rt-old`));

    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
  });
});
