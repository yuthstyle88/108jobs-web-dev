import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGE_COOKIE } from "@/constants/language";
import { isHttps } from "@/utils";
import { langFromPath, resolveLanguage } from "@/utils/getLangCookies";
import {getJwtCookieFromServer, getJwtFromRequest, isJwtExpired, parseJwtClaims} from "@/utils/helper-server";

const LOCALE_RE = /^\/([a-z]{2})(\/|$)/i;

function stripLocalePrefix(pathname: string) {
    return pathname.replace(LOCALE_RE, '/');
}

// Disable protection: make all routes public except admin
const PROTECTED_PATHS: string[] = ['/chat', '/profile', '/account-setting'];
const ADMIN_PATHS: string[] = ['/admin'];
const AUTH_PATHS = ['/login', '/register'];

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const pathLngCurrent = langFromPath(pathname);

  const token = getJwtFromRequest(req) ?? "";
  const sid = Boolean(token) && !isJwtExpired(token)

    let jwtLang: string | undefined;
    let isAdmin = false;

    try {
        const claims = parseJwtClaims(token) as any;
        jwtLang = typeof claims?.lang === 'string' ? claims.lang : undefined;
        isAdmin = Array.isArray(claims?.roles) && claims.roles.includes("jobs:admin");
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

    console.log({
        pathname,
        pathLngCurrent,
        cookieLng,
        effectiveLng,
        cookieTargetLng
    });
    // --- protect dynamic routes ---
    const pathNoLang = stripLocalePrefix(pathname);
    const isProtected = PROTECTED_PATHS.some((p) => pathNoLang.startsWith(p));
    const isAdminPath = ADMIN_PATHS.some((p) => pathNoLang.startsWith(p));
    const isOnLogin = /^\/[a-z]{2}\/login(\/|$)/i.test(pathname);
    const isAuthPath = AUTH_PATHS.some((p) => pathNoLang.startsWith(p));

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
        '/((?!_next|static|fonts|images|favicon|robots|sitemap|lottie|api|uploads).*)',
    ],
};
