// Clean env helpers for 108Heros Frontend
// Source of truth (production):
//   NEXT_PUBLIC_API_BASE_URL  – e.g. https://api-staging.108heros.com
//   NEXT_PUBLIC_APP_URL       – e.g. https://staging.108heros.com
//   API_INTERNAL_URL          – e.g. http://localhost:8523  (server-only)

import {NextRequest} from "next/server";

function isBrowserEnv(): boolean {
  // Safe check without importing from other modules to avoid cycles during module evaluation
  try {
    return typeof window !== "undefined" && typeof document !== "undefined";
  } catch {
    return false;
  }
}

function safeString(v: any): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function ensureAbsoluteUrl(raw?: string, fallback?: string): string {
  const v = safeString(raw) ?? safeString(fallback);
  if (!v) return "";
  try {
    // If already absolute (has scheme), return as-is (without trailing slash)
    if (/^https?:\/\//i.test(v)) return v.replace(/\/$/, "");
    // Otherwise assume https for safety when running in browser; server falls back to http
    const scheme = isBrowserEnv() ? "https" : "http";
    return `${scheme}://${v.replace(/\/$/, "")}`;
  } catch {
    return v as string;
  }
}

function hostOf(u: string): string {
  try { return new URL(u).host; } catch { return u.replace(/^https?:\/\//i, ""); }
}

/**
 * Public API base for browser. On the server, prefer API_INTERNAL_URL when provided.
 */
export function getApiBase(): string {
  if (isBrowserEnv()) {
    return (
      ensureAbsoluteUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
        || "https://api.108heros.com"
    );
  }
  // Server side: allow internal URL to bypass proxies and TLS if needed
  return (
    ensureAbsoluteUrl(process.env.API_INTERNAL_URL)
      || ensureAbsoluteUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
      || "https://api.108heros.com"
  );
}

/**
 * Public App URL used for generating absolute links.
 */
export function getAppUrl(): string {
  if (isBrowserEnv()) {
    // Prefer declared app URL, else derive from location
    return (
      ensureAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL)
        || `${window.location.protocol}//${window.location.host}`
    );
  }
  return (
    ensureAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL)
      || "https://108heros.com"
  );
}

/** Convenient host helpers (rarely needed) **/
// export function getUiExternalHost(): string {
//   const app = getAppUrl();
//   return hostOf(app);
// }

export function getApiHost(): string {
  return hostOf(getApiBase());
}

/**
 * Identity-Platform origin. Called directly from the browser (phone/OTP
 * register + sign-in) — not proxied through API_INTERNAL_URL, so there is no
 * server/browser split here the way getApiBase() has one.
 */
export function getIdentityBase(): string {
  return ensureAbsoluteUrl(process.env.NEXT_PUBLIC_IDENTITY_BASE_URL);
}

/**
 * Returns the absolute static directory URL or path for serving static assets.
 */
export function getStaticDir(): string {
  if (isBrowserEnv()) {
    return "/_next/static"; // browser always fetches via public path
  }
  return process.env.NEXT_STATIC_DIR || "/var/www/apps/108heros-front-dev/.next/static";
}

/** Path helpers **/
export function httpExternalPath(path: string): string {
  const base = getAppUrl();
  if (!base) return path;
  // ensure single slash when joining
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function isHttps(req?: Request | NextRequest): boolean {
    if (typeof window !== "undefined") return window.location.protocol === "https:";
    try {
        const forwarded = req?.headers?.get?.("x-forwarded-proto");
        if (forwarded) return forwarded === "https";
        return new URL(getAppUrl()).protocol === "https:";
    } catch {
        return true;
    }
}

// Backward-compat export (prefer getApiBase)
export const getHttpBase = getApiBase;