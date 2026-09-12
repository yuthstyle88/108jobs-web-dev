import { getAppDomain } from "@/utils/appConfig";

// Two different things live here, and #172 was them being mixed up:
//
// - the product NAME people read (`getAppName()`, "108Heros" since the owner's
//   2026-09-09 call) — follows the brand;
// - the HOST the DNS answers (`getAppDomain()`, still "108jobs.com" — the
//   `.108jobs.com` domain serves other systems and is not being renamed).
//
// Anything that ends up in a URL, a link someone shares or an email address is
// a host, so it is built from `getAppDomain()`. Building it from the name gave
// `108Heros/profile/`, a host that does not exist.
//
// The PRODUCT_* literals below are the domain-bound defaults.
export const PRODUCT_NAME = "108jobs.com";
export const PRODUCT_HOST = "108jobs.com";
// Unchanged pending the owner's call on #172 — the address users actually see
// is built in src/translations/*.ts as `support@${getAppDomain()}`.
export const PRODUCT_SUPPORT_EMAIL = "support@108jobs.com";
export const PRODUCT_PROFILE_PREFIX = "108jobs.com/profile/";

export function getProductHost(): string {
  return process.env.NEXT_PUBLIC_API_HOST_NAME || getAppDomain();
}

export function getProductSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || PRODUCT_SUPPORT_EMAIL;
}

export function getProfilePrefix(): string {
  return `${getAppDomain()}/profile/`;
}
