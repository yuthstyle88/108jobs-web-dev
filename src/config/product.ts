import { getAppName, getAppUrl } from "@/utils/appConfig";

export const PRODUCT_NAME = "108jobs.com";
export const PRODUCT_HOST = "108jobs.com";
export const PRODUCT_SUPPORT_EMAIL = "support@108jobs.com";
export const PRODUCT_PROFILE_PREFIX = "108jobs.com/profile/";

export function getProductHost(): string {
  return process.env.NEXT_PUBLIC_API_HOST_NAME || getAppName() || PRODUCT_HOST;
}

export function getProductSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || PRODUCT_SUPPORT_EMAIL;
}

export function getProfilePrefix(): string {
  return `${getAppName()}/profile/`;
}
