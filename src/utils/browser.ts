import {authCookieName, legacyAuthCookieNames} from "@/utils/config";
import {GetSiteResponse, MyUserInfo} from "108jobs-client";
import {isHttps} from "@/utils/env";
import {LANGUAGE_COOKIE} from "@/constants/language";
import {invalidateClientLanguageCache} from "@/utils/getClientCurrentLanguage";

// Minimal browser-safe cookie serializer to avoid importing the `cookie` package in app-client bundles
function serializeCookie(name: string, value: string, opts?: {
  maxAge?: number;
  sameSite?: "lax" | "strict" | "none" | string;
  path?: string;
  secure?: boolean;
}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts?.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts?.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts?.path) parts.push(`Path=${opts.path}`);
  if (opts?.secure) parts.push("Secure");
  return parts.join("; ");
}

export function canShare() {
  return isBrowser() && !!navigator.canShare;
}

export function clearAuthCookie() {
  for (const name of [authCookieName, ...legacyAuthCookieNames]) {
    document.cookie = serializeCookie(name, "", {
      maxAge: -1,
      sameSite: "lax",
      path: "/",
    });
  }
}

export function dataBsTheme(
  siteResOrTheme?: GetSiteResponse | string,
  myUserInfo?: MyUserInfo,
) {
  const theme =
    typeof siteResOrTheme === "string"
      ? siteResOrTheme
      : (myUserInfo?.localUserView.localUser.theme ??
        siteResOrTheme?.siteView.localSite.defaultTheme ??
        "browser");

  return (isDark() && theme === "browser") || theme.includes("dark")
    ? "dark"
    : "light";
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function isDark() {
  return (
    isBrowser() && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

const eventTypes = ["mousedown", "keydown", "touchstart", "touchmove", "wheel"];

const scrollThreshold = 2;

type Continue = boolean | void;

export function nextUserAction(cb: (e: Event) => Continue) {
  const eventTarget = window.document.body;

  let cleanup: (() => void) | undefined = () => {
    cleanup = undefined;
    eventTypes.forEach(ev => {
      eventTarget.removeEventListener(ev,
        listener);
    });
    window.removeEventListener("scroll",
      scrollListener);
  };

  const listener = (e: Event) => {
    if (!cb(e)) {
      cleanup?.();
    }
  };
  eventTypes.forEach(ev => {
    eventTarget.addEventListener(ev,
      listener);
  });

  let remaining = scrollThreshold;
  const scrollListener = (e: Event) => {
    // This only has to cover the scrollbars. The problem is that scroll events
    // are also fired when the document height shrinks below the current bottom
    // edge of the window.
    remaining--;
    if (remaining < 0) {
      if (!cb(e)) {
        cleanup?.();
      } else {
        remaining = scrollThreshold;
      }
    }
  };
  window.addEventListener("scroll",
    scrollListener);

  return () => {
    cleanup?.();
  };
}

const platformString = () =>
  navigator.platform?.match(/mac|win|linux/i)?.[0].toLowerCase();
const getPlatformPredicate = (platform: string) => () =>
  isBrowser() && platformString() === platform;
const isWin = getPlatformPredicate("win");
const isMac = getPlatformPredicate("mac");
const isLinux = getPlatformPredicate("linux");

export const platform = {isWin, isMac, isLinux};

export function refreshTheme() {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("refresh-theme"));
  }
}

export function setAuthJWTCookie(jwt: string) {
  document.cookie = serializeCookie(authCookieName, jwt, {
    maxAge: 365 * 24 * 60 * 60,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
  });
}

function readRawCookie(name: string): string | null {
  const prefix = `${name}=`;
  const parts = (document.cookie || "").split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

export function getAuthJWTCookie(): string | null {
  if (!isBrowser()) return null;

  const current = readRawCookie(authCookieName);
  if (current) return current;

  // Adopt a token written before the cookie was decoupled from the product name,
  // then retire the old cookie so this runs at most once per browser.
  for (const legacy of legacyAuthCookieNames) {
    const token = readRawCookie(legacy);
    if (!token) continue;
    setAuthJWTCookie(token);
    document.cookie = serializeCookie(legacy, "", {
      maxAge: -1,
      sameSite: "lax",
      path: "/",
    });
    return token;
  }

  return null;
}

/**
 * Retire any pre-rebrand cookie regardless of how the current token was
 * obtained.
 *
 * getAuthJWTCookie()'s own migration only runs -- and only migrates -- when
 * it is actually called with no stable cookie present. A server-rendered
 * request can populate `isoData.jwt` from a legacy cookie name directly
 * (see `getJwtCookieFromServer` / `getJwtFromRequest` in helper-server.ts),
 * in which case `isoData?.jwt ?? getAuthJWTCookie()` short-circuits and
 * getAuthJWTCookie() never runs, leaving the legacy cookie stranded on the
 * browser even though the token now also lives under the stable name. Call
 * this once per hydration alongside that token so retirement happens either
 * way.
 *
 * Safe to call repeatedly: once a legacy cookie is cleared there is nothing
 * left for a later call to retire.
 */
export function retireLegacyAuthCookies(): void {
  if (!isBrowser()) return;

  const stable = readRawCookie(authCookieName);
  for (const legacy of legacyAuthCookieNames) {
    const token = readRawCookie(legacy);
    if (!token) continue;
    if (!stable) setAuthJWTCookie(token);
    document.cookie = serializeCookie(legacy, "", {
      maxAge: -1,
      sameSite: "lax",
      path: "/",
    });
  }
}

export async function setThemeOverride(theme?: string) {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("set-theme-override",
      {detail: {theme}}),
  );
}

export function share(shareData: ShareData) {
  if (isBrowser()) {
    navigator.share(shareData);
  }
}

export function snapToTop() {
  window.scrollTo({left: 0, top: 0, behavior: "instant"});
}

export function setLangCookie(newLang: string)  {
    if (typeof document !== 'undefined') {
        document.cookie = `${LANGUAGE_COOKIE}=${newLang}; path=/`;
        invalidateClientLanguageCache();
    }
}
