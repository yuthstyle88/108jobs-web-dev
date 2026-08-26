import {NextRequest, NextResponse} from "next/server";
import {jwtDecode} from "jwt-decode";
import {getIdentityBase, isHttps} from "@/utils/env";
import {authCookieName, REFRESH_TOKEN_COOKIE} from "@/utils/config";
import {JOBS_ADMIN_ROLE, Claims} from "@/services/UserService";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

// The wire shape Identity-Platform's LoginResponse actually serializes as:
// OAuth2-standard fields stay snake_case, everything else is camelCase.
interface RawLoginResponse {
    identityId: string;
    access_token: string;
    refresh_token: string;
}

function failureRedirect(req: NextRequest) {
    return NextResponse.redirect(new URL("/login?error=google", req.url));
}

// Google redirects here directly (this URL is Identity-Platform's registered
// AUTH_GOOGLE_REDIRECT_URI) with ?code&state. Exchanging that code is a
// server-to-server call to Identity-Platform's existing, unmodified
// /auth/google/callback -- the tokens never pass through the browser as a
// popup postMessage or a URL parameter, matching how PhoneOtpAuthForm's own
// completeSignIn() seals a session, just triggered from the server side.
export async function GET(req: NextRequest) {
    const {searchParams} = req.nextUrl;
    if (searchParams.get("error")) {
        return failureRedirect(req);
    }
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
        return failureRedirect(req);
    }

    const base = getIdentityBase();
    if (!base) {
        return failureRedirect(req);
    }

    const upstream = await fetch(
        `${base}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    );
    if (!upstream.ok) {
        return failureRedirect(req);
    }
    const login = (await upstream.json()) as RawLoginResponse;
    if (!login?.access_token || !login?.refresh_token) {
        return failureRedirect(req);
    }

    let redirectTo = "/";
    try {
        const claims = jwtDecode<Claims>(login.access_token);
        if (Array.isArray(claims.roles) && claims.roles.includes(JOBS_ADMIN_ROLE)) {
            redirectTo = "/admin/dashboard";
        }
    } catch {
        // Malformed token would already have failed at Identity-Platform;
        // falling through to the normal landing page is a safe default.
    }

    const res = NextResponse.redirect(new URL(redirectTo, req.url));
    res.cookies.set(authCookieName, login.access_token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE,
        secure: isHttps(req),
        sameSite: "lax",
        path: "/",
    });
    res.cookies.set(REFRESH_TOKEN_COOKIE, login.refresh_token, {
        httpOnly: true,
        secure: isHttps(req),
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
    });
    return res;
}
