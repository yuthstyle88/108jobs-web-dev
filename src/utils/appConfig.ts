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
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_URL || 'https://108jobs.com';
}
