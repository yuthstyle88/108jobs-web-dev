import {isBrowser} from "@/utils/browser";

export const __DEV__ = process.env.NODE_ENV !== "production";

export function getAppName(): string {
  // On the server we can read APP_NAME; on the client we must rely on NEXT_PUBLIC_APP_NAME
  if (!isBrowser()) {
    return process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || '108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || '108jobs.com';
}
export function getAppUrl(): string {
  // On the server we can read APP_URL; on the client we must rely on NEXT_PUBLIC_APP_URL
  if (!isBrowser()) {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
}

/**
 * The bare host the site is served from — no scheme, no trailing slash.
 *
 * Deliberately separate from getAppName(). The product name and the domain
 * diverged in the 108Heros rebrand, so interpolating the name into a URL or an
 * email address would produce a host that does not exist.
 */
export function getAppDomain(): string {
  if (!isBrowser()) {
    return process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com';
  }
  return process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com';
}
