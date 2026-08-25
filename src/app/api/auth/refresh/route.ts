import { NextRequest, NextResponse } from "next/server";
import { Api108Heros } from "108heros-client";
import { REFRESH_TOKEN_COOKIE } from "@/utils/config";
import { getApiBase, isHttps } from "@/utils/env";

const REFRESH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function clearedCookieResponse(status: number, body: object, req: NextRequest) {
  const res = NextResponse.json(body, { status });
  res.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
  }

  const client = new Api108Heros(getApiBase());
  try {
    const data = await client.refreshWithIdentityPlatform({ refreshToken });
    const res = NextResponse.json({ accessToken: data.accessToken, expiresIn: data.expiresIn });
    res.cookies.set(REFRESH_TOKEN_COOKIE, data.refreshToken, {
      httpOnly: true,
      secure: isHttps(req),
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
    return res;
  } catch {
    return clearedCookieResponse(401, { error: "refresh_failed" }, req);
  }
}
