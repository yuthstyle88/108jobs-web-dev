import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";
import { authCookieName, REFRESH_TOKEN_COOKIE } from "@/utils/config";

function postSession(url: string, body?: unknown, extraHeaders?: Record<string, string>) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/auth/session", () => {
  it("sets access and refresh tokens as HttpOnly, SameSite=Lax cookies scoped to the whole site", async () => {
    const res = await POST(postSession("http://localhost:3000/api/auth/session", { accessToken: "at-123", refreshToken: "rt-123" }));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${authCookieName}=at-123`);
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE}=rt-123`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
  });

  it("marks the cookie Secure when forwarded as HTTPS by the reverse proxy", async () => {
    const res = await POST(postSession(
      "http://localhost:3000/api/auth/session",
      { accessToken: "at-123", refreshToken: "rt-123" },
      { "x-forwarded-proto": "https" },
    ));

    expect(res.headers.get("set-cookie") ?? "").toContain("Secure");
  });

  it("does not mark the cookie Secure when forwarded as plain HTTP", async () => {
    const res = await POST(postSession(
      "http://localhost:3000/api/auth/session",
      { accessToken: "at-123", refreshToken: "rt-123" },
      { "x-forwarded-proto": "http" },
    ));

    expect(res.headers.get("set-cookie") ?? "").not.toContain("Secure");
  });

  it("rejects a request without both tokens", async () => {
    const res = await POST(postSession("http://localhost:3000/api/auth/session", {}));

    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a request with an unparseable body", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/auth/session", () => {
  it("clears the refresh token cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", { method: "DELETE" });

    const res = await DELETE(req);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE}=`);
    expect(setCookie).toContain(`${authCookieName}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
