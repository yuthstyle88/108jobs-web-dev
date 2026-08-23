import {isSuccess, REQUEST_STATE, RequestState} from "@/services/HttpService";
import {
    CategoryId,
    CategoryNodeView,
    GetSiteResponse,
    JobType, ListCategoriesResponse,
    PaginationCursor,
    PersonId
} from "108jobs-client";

import {Match} from "@/utils/router";
import {ErrorPageData} from "@/utils/types";
import {madGatewayUrl, uploadToMad} from "@/services/media/madUpload";
import {formatDateTime} from "@/utils/format/date";

export function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait = 1000,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        const callNow = immediate && !timeout;

        if (timeout) clearTimeout(timeout);

        timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) {
                    func.apply(this,
                        args); // ✅ ใช้ this โดยตรงใน arrow function
                }
            },
            wait);

        if (callNow) {
            func.apply(this,
                args); // ✅ ใช้ this โดยตรง
        }
    };
}

type ImmutableListKey =
    | "proposal"
    | "proposalReply"
    | "personPostMention"
    | "personProposalMention"
    | "category"
    | "privateMessage"
    | "post";

export function editListImmutable<
    T extends { [key in F]: { id: number } },
    F extends ImmutableListKey,
>(fieldName: F, data: T, list: T[]): T[] {
    return [
        ...list.map(c => (c[fieldName].id === data[fieldName].id ? data : c)),
    ];
}

export function getIdFromString(id?: string): number | undefined {
    return id && id !== "0" && !Number.isNaN(Number(id)) ? Number(id) : undefined;
}

export function getBoolFromString(boolStr?: string): boolean | undefined {
    return boolStr ? boolStr.toLowerCase() === "true" : undefined;
}

export function getPageCursorFromString(
    pageCursor?: string,
): PaginationCursor | undefined {
    return pageCursor ? pageCursor : undefined;
}

type Empty = NonNullable<unknown>;

type QueryMapping<PropsT> = {
    [K in keyof PropsT]-?: (
        input: string | undefined,
        fallback: PropsT[K] | undefined,
    ) => PropsT[K];
};

export default function getQueryParams<
    PropsT extends object,
    FallbacksT extends Partial<PropsT> = Empty
>(
    processors: QueryMapping<PropsT>,
    source?: string,
    fallbacks: FallbacksT = {} as FallbacksT,
): PropsT {
    const searchParams = new URLSearchParams(source);
    const ret = {} as PropsT;

    for (const key of Object.keys(processors) as (keyof typeof processors)[]) {
        const processor = processors[key];
        const raw = searchParams.get(key as string) ?? undefined;

        // fallback ต้องกำหนด fallback[key] อย่างระมัดระวัง
        const fallback = (fallbacks?.[key] ?? undefined) as PropsT[typeof key];

        // processor return type ต้องตรงกับ PropsT[key]
        ret[key] = processor(raw,
            fallback);
    }

    return ret;
}

export function getQueryString<T extends Record<string, string | undefined>>(
    obj: T,
) {
    const searchParams = new URLSearchParams();
    Object.entries(obj)
        .filter(([, val]) => val !== undefined && val !== null)
        .forEach(([key, val]) => searchParams.set(key,
            val ?? ""));
    const params = searchParams.toString();
    if (params) {
        return "?" + params;
    }
    return "";
}

export function getRandomCharFromAlphabet(alphabet: string): string {
    return alphabet.charAt(Math.floor(Math.random() * alphabet.length));
}

export function getRandomFromList<T>(list: T[]): T | undefined {
    return list.length === 0
        ? undefined
        : list.at(Math.floor(Math.random() * list.length));
}

export function groupBy<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => string,
) {
    return array.reduce(
        (acc, value, index, array) => {
            (acc[predicate(value,
                index,
                array)] ||= []).push(value);
            return acc;
        },
        {} as { [key: string]: T[] },
    );
}

export function hostname(url: string): string {
    const cUrl = new URL(url);
    return cUrl.port ? `${cUrl.hostname}:${cUrl.port}` : `${cUrl.hostname}`;
}

export function hsl(num: number) {
    return `hsla(${num}, 35%, 50%, 0.5)`;
}

const SHORTNUM_SI_FORMAT = new Intl.NumberFormat("en-US",
    {
        maximumSignificantDigits: 3,
        notation: "compact",
        compactDisplay: "short",
    });

export function numToSI(value: number): string {
    return SHORTNUM_SI_FORMAT.format(value);
}

export function sleep(millis: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve,
        millis));
}

/**
 * Polls / repeatedly runs a promise, every X milliseconds
 */
export async function poll(promiseFn: () => unknown | Promise<unknown>, millis: number) {
    if (window.document.visibilityState !== "hidden") {
        await promiseFn();
    }
    await sleep(millis);
    return poll(promiseFn,
        millis);
}

const DEFAULT_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomStr(
    idDesiredLength = 20,
    alphabet = DEFAULT_ALPHABET,
): string {
    /**
     * Create n-long array and map it to random chars from given alphabet.
     * Then join individual chars as string
     */
    return Array.from({length: idDesiredLength})
        .map(() => {
            return getRandomCharFromAlphabet(alphabet);
        })
        .join("");
}

export function resourcesSettled(resources: RequestState<unknown>[]) {
    return resources.every(r => r.state === REQUEST_STATE.SUCCESS || r.state === REQUEST_STATE.FAILED);
}

export function validEmail(email: string) {
    const re =
        /^(([^\s"(),.:;<>@[\\\]]+(\.[^\s"(),.:;<>@[\\\]]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([\dA-Za-z\-]+\.)+[A-Za-z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

const tldRegex = /([a-z0-9]+\.)*[a-z0-9]+\.[a-z]+/;

export function validInstanceTLD(str: string) {
    return tldRegex.test(str);
}

/*
 * EditForm if the Title is in a valid format:
 *   (?=.*\S.*) checks if the title consists of only whitespace characters
 *   (?=^[^\r\n]+$) checks if the title contains newlines
 */
const validTitleRegex = new RegExp(/(?=(.*\S.*))(?=^[^\r\n]+$)/,
    "g");

export function validTitle(title?: string): boolean {
    // Initial title is null, minimum length is taken care of by textarea's minLength={3}
    if (!title || title.length < 3) return true;

    return validTitleRegex.test(title);
}

export function validURL(str: string) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

export function dedupByProperty<
    T extends Record<string, unknown>,
    R extends number | string | boolean,
>(collection: T[], keyFn: (obj: T) => R) {
    return collection.reduce(
        (acc, cur) => {
            const key = keyFn(cur);
            if (!acc.foundSet.has(key)) {
                acc.output.push(cur);
                acc.foundSet.add(key);
            }

            return acc;
        },
        {
            output: [] as T[],
            foundSet: new Set<R>(),
        },
    ).output;
}

export function getApubName({name, ap_id}: { name: string; ap_id: string }) {
    return `${name}@${hostname(ap_id)}`;
}

/**
 * Next.js-style dynamic route matcher (e.g. `/post/[id]`)
 * Optimized with memoization to improve performance for repeated route matching
 */
// Cache for storing the results of matchPath
const matchPathCache = new Map<string, Match | null>();
const CACHE_SIZE_LIMIT = 100;

export function matchPath(
    pathPattern?: string,
    urlPath?: string
): Match | null {
    // Early return for invalid inputs
    if (!pathPattern || !urlPath) return null;

    // Create a cache key
    const cacheKey = `${pathPattern}:${urlPath}`;

    // Check if result is in cache
    if (matchPathCache.has(cacheKey)) {
        return matchPathCache.get(cacheKey)!;
    }

    // Limit cache size to prevent memory leaks
    if (matchPathCache.size >= CACHE_SIZE_LIMIT) {
        // Remove oldest entry (first key in the map)
        const iterator = matchPathCache.keys().next();
        if (!iterator.done) {
            matchPathCache.delete(iterator.value); // iterator.value เป็น string แน่นอน
        }
    }

    const patternParts = pathPattern.split("/").filter(Boolean);
    const urlParts = urlPath.split("/").filter(Boolean);

    if (urlParts.length > patternParts.length) {
        matchPathCache.set(cacheKey,
            null);
        return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
        const pattern = patternParts[i];
        const part = urlParts[i];

        const isOptional = pattern.endsWith("?") || /\[\w+\?\]/.test(pattern);
        const isParam = pattern.startsWith(":") || /^\[\w+\??\]$/.test(pattern);

        if (isParam) {
            const key = pattern
                .replace(/^\:/,
                    "")      // :param → param
                .replace(/^\[|\]$/g,
                    "") // [param] → param
                .replace(/\?$/,
                    "");     // param? → param

            if (part !== undefined) {
                params[key] = decodeURIComponent(part);
            } else if (!isOptional) {
                matchPathCache.set(cacheKey,
                    null);
                return null;
            }
        } else if (pattern !== part) {
            matchPathCache.set(cacheKey,
                null);
            return null;
        }
    }

    const result = {
        params,
        path: urlPath,
        url: urlPath,
        isExact: urlParts.length === patternParts.length,
    } as Match;

    // Cache the result
    matchPathCache.set(cacheKey,
        result);

    return result;
}

/**
 * Creates error page data with improved error handling and null safety
 *
 * @param error The error that occurred
 * @param site Optional site data containing admin information
 * @returns Structured error page data for rendering
 */
export function getErrorPageData(error: Error, site?: GetSiteResponse): ErrorPageData {
    const errorPageData: ErrorPageData = {};

    // Always include error message for better debugging
    errorPageData.error = error?.message || 'Unknown error';

    // Safely extract admin matrix IDs with null checks
    if (site?.admins) {
        const adminMatrixIds = site.admins
            .filter(admin => admin?.person)
            .map(({person}) => person.matrixUserId)
            .filter(Boolean) as string[] | undefined;

        // ใช้ Array.isArray เพื่อยืนยันว่าเป็นอาร์เรย์ก่อนตรวจ length
        if (Array.isArray(adminMatrixIds) && adminMatrixIds.length > 0) {
            errorPageData.adminMatrixIds = adminMatrixIds;
        }
    }

    return errorPageData;
}

/**
 * Converts a string URL, File, or Blob to a Blob object
 *
 * @param src The source (URL string, File, or Blob)
 * @returns A Promise resolving to a Blob
 */
async function toBlob(src: string | File | Blob): Promise<Blob> {
    if (typeof src === "string") {
        // Handle data URLs without using fetch to avoid CSP violations (e.g., connect-src disallowing data:)
        if (src.startsWith("data:")) {
            // Format: data:[<mediatype>][;base64],<data>
            const firstComma = src.indexOf(',');
            const header = src.substring(5, firstComma); // exclude 'data:'
            const dataPart = src.substring(firstComma + 1);

            const parts = header.split(';');
            const mime = parts[0] || 'application/octet-stream';
            const isBase64 = parts.includes('base64');

            let byteString: string;
            if (isBase64) {
                if (typeof atob === 'function') {
                    byteString = atob(dataPart);
                } else {
                    // Node.js fallback
                    byteString = Buffer.from(dataPart, 'base64').toString('binary');
                }
            } else {
                // Percent-encoded data
                byteString = decodeURIComponent(dataPart);
            }


            const len = byteString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = byteString.charCodeAt(i);
            }
            return new Blob([bytes], { type: mime });
        }
        // For http/https or other supported protocols, fall back to fetch
        return fetch(src).then((r) => r.blob());
    }
    // If already a File or Blob, return as-is
    return src;
}

/**
 * Uploads an image and returns the URL of the uploaded image
 *
 * @param selectedImage The image to upload (File or string URL/base64)
 * @param uploadImage Function to handle the actual upload (optional fallback)
 * @returns A Promise resolving to the URL of the uploaded image
 * @throws Error if the upload fails
 */
export async function uploadSelectedImage(
    selectedImage: File | string,
    uploadImage?: (payload: { image: File }) => Promise<RequestState<import("108jobs-client").UploadImageResponse>>
): Promise<string> {
    let file: File;

    if (selectedImage instanceof File) {
        file = selectedImage;
    } else {
        const blob = await toBlob(selectedImage);
        file = new File([blob], "profile.jpg", {
            type: blob.type || "image/jpeg",
        });
    }

    if (madGatewayUrl()) {
        try {
            const asset = await uploadToMad(file, "public", "image");
            if (asset.url) return asset.url;
        } catch (error) {
            console.error("MAD upload failed, attempting fallback if available:", error);
            if (!uploadImage) throw error;
        }
    }

    if (uploadImage) {
        const result = await uploadImage({ image: file });

        if (isSuccess(result)) {
            const imageUrl = result.data?.images?.[0]?.imageUrl;
            if (imageUrl) return imageUrl;
        }

        console.log("Upload failed response:", result);
    }
    return "";
}

export function stripEmpty<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(
            ([_, v]) =>
                v !== "" &&
                v !== undefined &&
                v !== null &&
                !(typeof v === "object" && true && Object.keys(v).length === 0)
        )
    ) as Partial<T>;
}

export function assertExists<T>(
    value: T | null | undefined,
    message?: string,
    defaultValue?: T | (() => T)
): T {
    // Present → return immediately
    if (value != null) return value as T;

    // Resolve default (supports lazy factory)
    const hasFactory = typeof defaultValue === 'function';
    const resolvedDefault = hasFactory
        ? (defaultValue as () => T)()
        : defaultValue;

    if (resolvedDefault !== undefined) {
        try {
            console.warn(
                (message ?? "Expected value to be present but got null or undefined") +
                    " – using provided defaultValue"
            );
        } catch {}
        return resolvedDefault as T;
    }

    // No default provided → in production do not hard-crash the app
    const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    const errMsg = message ?? 'Expected value to be present but got null or undefined';

    if (isProd) {
        try { console.error(errMsg); } catch {}
        // Return undefined as T to let UI guards handle empty state instead of crashing
        return undefined as unknown as T;
    }

    // In development, fail fast so the caller fixes the flow
    throw new Error(errMsg);
}

export function toCamelCaseLastSegment(path: string | undefined): string {
    if (!path) return '';
    const last = path.split('.').pop() || '';
    return last
        .replace(/[_-](\w)/g, (_, c) => c.toUpperCase()) // snake_case → camelCase
        .replace(/^([A-Z])/, (_, c) => c.toLowerCase()); // lowercase first letter if needed
}

export const formatDate = (dateString: string): string => {
    return formatDateTime(dateString, 'date');
};

export { formatBudget } from "@/utils/format/money";

export const getJobTypeLabel = (jobType: string | null | undefined, t: (key: string) => string): string => {
    if (!jobType) return "-";
    const typeMap: Record<string, string> = {
        [JobType.FullTime]: t("profileJob.tableFullTimeLabel"),
        [JobType.PartTime]: t("profileJob.tablePartTimeLabel"),
        [JobType.Contract]: t("profileJob.tableContractLabel"),
        [JobType.Freelance]: t("profileJob.tableFreelanceLabel"),
    };
    return typeMap[jobType] || jobType;
};

export function buildCategoriesTree(listCategoriesResponse: ListCategoriesResponse | undefined) {
    const tree: CategoryNodeView[] = [];
    const map = new Map<CategoryId, CategoryNodeView>();
    listCategoriesResponse?.categories.forEach((c: CategoryNodeView) => {
        map.set(c.category.id, {...c, children: []});
    });

  listCategoriesResponse?.categories.forEach((c: CategoryNodeView) => {
    const node = map.get(c.category.id);
    if (!node) return;

    const pathParts = c.category.path.split(".");

    if (pathParts.length === 2) {
      tree.push(node);
    } else {
      const parentPath = pathParts.slice(0, -1).join(".");
      const parent = Array.from(map.values()).find(
        n => n.category.path === parentPath
      );
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

    return tree;
}

export function getCategoriesAtLevel(
    catalogData: ListCategoriesResponse | undefined,
    level: number
): CategoryNodeView[] {
    if (!catalogData || level < 1) {
        return [] as CategoryNodeView[];
    }

    return catalogData.categories.filter(
        (c: CategoryNodeView) => c.category.path.split('.').length === level
    );
}

/**
 * Generate deterministic roomId for a DM between 2 users.
 * Always the same string for the same pair.
 */
// Web-safe deterministic 64-bit FNV-1a hash -> 16-char hex (no Node deps)
function fnv1a64Hex(input: string): string {
    // FNV-1a 64-bit parameters
    let hash = 0xcbf29ce484222325n; // 14695981039346656037
    const prime = 0x100000001b3n;   // 1099511628211

    // Get UTF-8 bytes of input
    let bytes: Uint8Array;
    if (typeof TextEncoder !== "undefined") {
        bytes = new TextEncoder().encode(input);
    } else {
        // minimal fallback: encode as UTF-16 code units masked to 1 byte
        // (rarely used in modern environments; kept to avoid Node Buffer)
        bytes = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
    }

    for (let i = 0; i < bytes.length; i++) {
        hash ^= BigInt(bytes[i]);
        hash = (hash * prime) & 0xffffffffffffffffn; // keep 64-bit
    }

    // Convert to 16-char hex with leading zeros
    let hex = hash.toString(16);
    if (hex.length < 16) hex = hex.padStart(16, "0");
    else if (hex.length > 16) hex = hex.slice(-16);
    return hex;
}

export function dmRoomId(userA: PersonId | undefined, userB: PersonId | undefined, postId: string | undefined): string {
    if (userA === undefined || userB === undefined) {
        throw new Error("Both userA and userB must be defined to generate a DM room ID");
    }

    // normalize order (smaller id first)
    const low = Math.min(userA, userB);
    const high = Math.max(userA, userB);
    const input = `dm:${low}:${high}:${postId || ''}`;

    // Deterministic 64-bit hash -> 16 hex chars
    return fnv1a64Hex(input);
}

// Date helpers (timezone-safe for yyyy-MM-dd strings)
// Exported as named functions for reuse across the app.

/**
 * Convert a Date to a timezone-safe yyyy-MM-dd string.
 * Adjusts for local timezone so that formatting is consistent across clients.
 */
export const toYMD = (d: Date): string => {
    const tzAdjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return tzAdjusted.toISOString().slice(0, 10);
};

/** Get today's date as yyyy-MM-dd (timezone-safe). */
export const getTodayYMD = (): string => toYMD(new Date());

/**
 * Add a number of days to a yyyy-MM-dd date string and return the resulting yyyy-MM-dd.
 * Returns an empty string on invalid input.
 */
export const addDaysYMD = (ymd: string, days: number): string => {
    if (!ymd || Number.isNaN(days)) return '';
    const base = new Date(ymd + 'T00:00:00');
    if (isNaN(base.getTime())) return '';
    const next = new Date(base);
    next.setDate(base.getDate() + Number(days));
    return toYMD(next);
};

/**
 * Determine if a yyyy-MM-dd date string is before today (timezone-safe string compare).
 */
export const isBeforeToday = (ymd: string): boolean => {
    if (!ymd) return false;
    const today = getTodayYMD();
    return ymd < today;
};

// --- normalize room id helper ---
export const normRoom = (rid: string) => String(rid || '').replace(/^room:/, '')
