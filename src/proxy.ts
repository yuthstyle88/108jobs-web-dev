import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGE_COOKIE } from "@/constants/language";
import { isHttps } from "@/utils";
import { langFromPath, resolveLanguage } from "@/utils/getLangCookies";
import {getJwtCookieFromServer, getJwtFromRequest, isJwtExpired, parseJwtClaims} from "@/utils/helper-server";
import {verifiedHasRole, verifyJwt, type JwtVerification} from "@/utils/jwt-verify";

const LOCALE_RE = /^\/([a-z]{2})(\/|$)/i;

function stripLocalePrefix(pathname: string) {
    return pathname.replace(LOCALE_RE, '/');
}

// Disable protection: make all routes public except admin
const PROTECTED_PATHS: string[] = ['/chat', '/profile', '/account-setting'];
const ADMIN_PATHS: string[] = ['/admin'];
const ADMIN_ROLE = 'jobs:admin';
const AUTH_PATHS = ['/login', '/register'];

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const pathLngCurrent = langFromPath(pathname);

  const token = getJwtFromRequest(req) ?? "";

    // Unverified read, used for the language preference only. Getting this
    // wrong shows someone the wrong language; it grants nothing.
    let jwtLang: string | undefined;
    try {
        const claims = parseJwtClaims(token) as any;
        jwtLang = typeof claims?.lang === 'string' ? claims.lang : undefined;
    } catch {}

    const cookieLng = req.cookies.get(LANGUAGE_COOKIE)?.value ?? '';
    const effectiveLng = resolveLanguage({ req, cookieLang: cookieLng, jwtLang, pathname });
    const cookieTargetLng = pathLngCurrent ?? effectiveLng;

    const setLangCookie = (resp: NextResponse, value: string) => {
        resp.cookies.set(LANGUAGE_COOKIE, value, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
            secure: isHttps(req),
        });
        return resp;
    };

    // --- protect dynamic routes ---
    const pathNoLang = stripLocalePrefix(pathname);
    const isProtected = PROTECTED_PATHS.some((p) => pathNoLang.startsWith(p));
    const isAdminPath = ADMIN_PATHS.some((p) => pathNoLang.startsWith(p));
    const isOnLogin = /^\/[a-z]{2}\/login(\/|$)/i.test(pathname);
    const isAuthPath = AUTH_PATHS.some((p) => pathNoLang.startsWith(p));

    // The auth cookie is writable by page JS (see utils/jwt-verify.ts), so a
    // gate that only decodes it gates nothing. Check the signature against
    // Identity-Platform's JWKS -- but only when a token actually exists and the
    // path is one we gate, so anonymous traffic on public pages pays nothing.
    const needsVerdict = Boolean(token) && (isProtected || isAdminPath || isAuthPath);
    const verification: JwtVerification = needsVerdict
        ? await verifyJwt(token)
        : {status: "unavailable", reason: "not needed on this path"};

    // Ordinary protected pages: a token that exists, has not expired, and has
    // not been *proven* forged. `unavailable` (Identity-Platform unreachable,
    // JWKS unconfigured) keeps the old behaviour on purpose -- these pages read
    // nothing the API does not re-authorize, and signing the whole userbase out
    // of /chat and /profile during an Identity outage is the worse failure.
    const sid = Boolean(token) && !isJwtExpired(token) && verification.status !== "invalid";

    // The admin area fails closed instead: nothing short of a verified
    // signature carrying the role opens it, so "cannot check" means "no".
    const isAdmin = verifiedHasRole(verification, ADMIN_ROLE);

    if (sid && isAuthPath) {
        const home = new URL(`/${effectiveLng}/`, req.url);
        const resp = NextResponse.redirect(home);
        if (cookieLng !== cookieTargetLng) setLangCookie(resp, cookieTargetLng);
        return resp;
    }

    // normal protected routes
    if (isProtected && !sid && !isOnLogin) {
        const login = new URL(`/${effectiveLng}/login`, req.url);
        // PhoneOtpAuthForm reads `redirect`, not `next` -- this was previously
        // a silent mismatch (bounced-here users always landed on "/" after
        // signing in instead of back where they started).
        login.searchParams.set('redirect', pathname + search);
        const resp = NextResponse.redirect(login);
        if (cookieLng !== cookieTargetLng) setLangCookie(resp, cookieTargetLng);
        return resp;
    }

    // admin-only routes
    if (isAdminPath && (!sid || !isAdmin)) {
        const notFound = new URL(`/${effectiveLng}/not-found`, req.url);
        const resp = NextResponse.redirect(notFound);
        if (cookieLng !== cookieTargetLng) setLangCookie(resp, cookieTargetLng);
        return resp;
    }

    // --- i18n auto prefix + persist cookie ---
    if (!langFromPath(pathname)) {
        const target = new URL(`/${effectiveLng}${pathname}${search}`, req.url);
        if (target.pathname !== pathname || target.search !== search) {
            const resp = NextResponse.redirect(target);
            if (cookieLng !== cookieTargetLng) setLangCookie(resp, cookieTargetLng);
            return resp;
        }
    }

    const resp = NextResponse.next();
    if (cookieLng !== cookieTargetLng) setLangCookie(resp, cookieTargetLng);
    return resp;
}

export const config = {
    matcher: [
        '/((?!_next|static|fonts|images|favicon|robots|sitemap|lottie|api|uploads|health).*)',
    ],
};
