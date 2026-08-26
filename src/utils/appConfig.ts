import {isBrowser} from "@/utils/browser";

export const __DEV__ = process.env.NODE_ENV !== "production";

export function getAppName(): string {
  // On the server we can read APP_NAME; on the client we must rely on NEXT_PUBLIC_APP_NAME
  if (!isBrowser()) {
    return process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || '108Heros';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || '108Heros';
}
export function getAppUrl(): string {
  // On the server we can read APP_URL; on the client we must rely on NEXT_PUBLIC_APP_URL
  if (!isBrowser()) {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
}

// Strips a leading scheme (e.g. "https://") and any trailing slash(es) from a
// misconfigured domain env var. Every getAppDomain() call site interpolates the
// result directly into a URL or an email address -- e.g.
// NEXT_PUBLIC_APP_DOMAIN="https://108jobs.com/" would otherwise ship
// "https://https://108jobs.com//privacy" and "support@https://108jobs.com/"
// straight to users. This is a defensive backstop, not a substitute for
// setting the env var correctly.
function stripSchemeAndTrailingSlash(host: string): string {
  return host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

/**
 * The bare host the site is served from — no scheme, no trailing slash.
 *
 * Deliberately separate from getAppName(). The product name and the domain
 * are set to diverge in an upcoming rebrand, so interpolating the name into a
 * URL or an email address would produce a host that does not exist.
 */
export function getAppDomain(): string {
  if (!isBrowser()) {
    return stripSchemeAndTrailingSlash(
      process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com',
    );
  }
  return stripSchemeAndTrailingSlash(process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com');
}
