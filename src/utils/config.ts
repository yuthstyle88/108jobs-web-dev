import {getStaticDir} from "@/utils/env";

export const favIconUrl = `${getStaticDir()}/assets/icons/favicon.svg`;
export const favIconPngUrl = `${getStaticDir()}/assets/icons/apple-touch-icon.png`;


export const postRefetchSeconds: number = 60 * 1000;
export const mentionDropdownFetchLimit = 10;
export const commentTreeMaxDepth = 8;
export const postMarkdownFieldCharacterLimit = 50000;
export const markdownFieldCharacterLimit = 10000;
export const maxUploadImages = 20;
export const concurrentImageUpload = 4;
// export const updateUnreadCountsInterval = 30000;
export const fetchLimit = 20;
export const similarPostFetchLimit = 6;
export const relTags = "noopener nofollow";
export const emDash = "\u2014";
export const JWT =  "jwt";
// This name is part of the API authentication contract. The backend accepts
// the `jwt` cookie and an HttpOnly cookie with that name can cross the
// same-origin rewrite without exposing the credential to page JavaScript.
export const authCookieName = JWT;
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const adultConsentCookieKey = "adultConsent";

// No. of max displayed categories per
// page on route "/categories"
export const categoryLimit = 50;

const queryPairRegex = "[a-zA-Zd_-]+=[a-zA-Zd+-_]+";

/**
 * Accepted formats:
 * !category@server.com
 * /c/category@server.com
 * /m/category@server.com
 * /u/username@server.com
 * @username@server.com
 */
export const instanceLinkRegex = new RegExp(
  `(/[cmu]/|!|@)[a-zA-Z\\d._%+-]+@[a-zA-Z\\d.-]+\\.[a-zA-Z]{2,}(?:/?\\?${queryPairRegex}(?:&${queryPairRegex})*)?`,
  "g",
);

export const testHost = process.env.NEXT_PUBLIC_API_HOST_NAME ?? "108heros.com";

export const validActorRegexPattern =
  "^\\w+|[\\p{Script=Arabic}\\d_]+|[\\p{Script=Cyrillic}\\d_]+$";
