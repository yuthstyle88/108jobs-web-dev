import { NextRequest, NextResponse } from "next/server";
import { authCookieName, REFRESH_TOKEN_COOKIE } from "@/utils/config";
import { isHttps } from "@/utils/env";

const REFRESH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { accessToken, refreshToken } = (body as { accessToken?: unknown; refreshToken?: unknown } | null) ?? {};
  if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
    return NextResponse.json({ error: "missing_tokens" }, { status: 400 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(authCookieName, accessToken, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(authCookieName, "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
