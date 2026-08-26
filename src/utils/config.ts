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
/**
 * Name of the cookie holding the access token.
 *
 * Fixed and brand-independent on purpose. This used to be derived from
 * NEXT_PUBLIC_APP_NAME, which meant renaming the product renamed the cookie and
 * logged every signed-in user out -- and it did not self-heal, because a session
 * with no claims never schedules the refresh that would redeem the surviving
 * refresh_token cookie.
 */
export const authCookieName = "108_auth";

/**
 * Cookie names a browser may still hold from before the decoupling above.
 * The deployed NEXT_PUBLIC_APP_NAME was not knowable from the repository, so this
 * covers every plausible value it held. Reads migrate these on contact; add to this
 * list if an environment turns out to have used something else.
 */
export const legacyAuthCookieNames = [
  "108Jobs",
  "108Jobs.com",
  "108jobs.com",
  "108jobs",
] as const;
export const JWT =  "jwt";
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

export const testHost = process.env.NEXT_PUBLIC_API_HOST_NAME ?? "108jobs.com";

export const validActorRegexPattern =
  "^\\w+|[\\p{Script=Arabic}\\d_]+|[\\p{Script=Cyrillic}\\d_]+$";
