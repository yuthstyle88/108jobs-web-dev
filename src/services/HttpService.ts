import {Api108Jobs} from "108jobs-client";
import {getHttpBase} from "@/utils/env";
import {UserService} from "@/services/UserService";
import {isBrowser} from "@/utils";

/* ---------- static states ----------------------------------- */
export const EMPTY_REQUEST = {
  state: "empty",
} as const;
export type EmptyRequestState = typeof EMPTY_REQUEST;

export const LOADING_REQUEST = {
  state: "loading",
} as const;
type LoadingRequestState = typeof LOADING_REQUEST;

/* ---------- union-state helpers ----------------------------- */
export const REQUEST_STATE = {
  EMPTY: EMPTY_REQUEST.state,        // "empty"
  LOADING: LOADING_REQUEST.state,    // "loading"
  FAILED: "failed",
  SUCCESS: "success",
} as const;
export type RequestStateKey =
  (typeof REQUEST_STATE)[keyof typeof REQUEST_STATE];

export type ApiError = {
    /** Server-side key (FastJob/Actix): e.g. "requireVerification", "emailAlreadyExists" */
    error?: string;
    /** Client/other services may use "name" instead */
    name?: string;
    /** Optional human-readable message */
    message?: string;
    /** HTTP status, when the caller captured one -- lets resolveApiErrorMessage() special-case e.g. 501. */
    status?: number;
};

/* ---------- concrete states --------------------------------- */
export type FailedRequestState = {
  state: typeof REQUEST_STATE.FAILED;        // Using constant
  err: ApiError;
};

export type SuccessRequestState<T> = {
  state: typeof REQUEST_STATE.SUCCESS;       // Using constant
  data: T;
};

export type Payload<K extends keyof WrappedApi108Jobs> =
  Awaited<ReturnType<WrappedApi108Jobs[K]>> extends RequestState<infer D>
    ? D
    : never;

/**
 * Shows the state of an API request.
 *
 * Can be empty, loading, failed, or success
 */
export type RequestState<T> =
  | EmptyRequestState
  | LoadingRequestState
  | FailedRequestState
  | SuccessRequestState<T>;

/* ============================================================ */

export type WrappedApi108Jobs = WrappedApiClient & {
  [K in keyof Api108Jobs]: Api108Jobs[K] extends (...args: any[]) => any
    ? ReturnType<Api108Jobs[K]> extends Promise<infer U>
      ? (...args: Parameters<Api108Jobs[K]>) => Promise<RequestState<U>>
      : (...args: Parameters<Api108Jobs[K]>) => Promise<RequestState<Api108Jobs[K]>>
    : Api108Jobs[K];
};

/**
 * Wrapped Api108Jobs client that provides consistent request state handling
 * and implements caching for GET requests to improve performance.
 */
class WrappedApiClient {
  rawClient: Api108Jobs;
  cache: Map<string, {data: any, timestamp: number}> = new Map();
  /** Tracks in-flight GET requests to prevent duplicate concurrent fetches */
  inFlight: Map<string, Promise<any>> = new Map();
  cacheTTL: number = 60000; // Cache TTL in milliseconds (1 minute)
  [prop: string]: any;

  constructor(client: Api108Jobs) {
    this.rawClient = client;

    // Create wrapped methods for all Api108Jobs methods
    for (const key of Object.getOwnPropertyNames(
      Object.getPrototypeOf(this.rawClient),
    )) {
      if (key !== "constructor") {
        this[key] = async(
          ...args: Parameters<Api108Jobs[keyof Api108Jobs]>
        ) => {
          // Return loading state first for better UX
          const loadingPromise = Promise.resolve(LOADING_REQUEST);

          // Check if this is a GET request that can be cached
          const isGetMethod = key.startsWith('get') && args.length <= 1;

          // Do not inject auth into payload; rely on Authorization header
          const patchedArgs: any[] = args as any[];
          // Build cache key based on original args
          const cacheKey = isGetMethod ? `${key}:${JSON.stringify(patchedArgs)}` : '';

          // Try to get from cache for GET requests
          if (isGetMethod && process.env.NODE_ENV === 'production') {
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
              // Return cached data after loading state
              return loadingPromise.then(() => ({
                data: cached.data,
                state: REQUEST_STATE.SUCCESS
              }));
            }
          }

          // If a GET with same args is in-flight, reuse that promise to avoid duplicate fetches
          if (isGetMethod && cacheKey) {
            const inflight = this.inFlight.get(cacheKey);
            if (inflight) {
              return loadingPromise.then(() => inflight);
            }
          }

          // Perform the actual request
          const resultPromise = (async() => {
            try {
              const res = await (this.rawClient as any)[key](...patchedArgs);

              // Cache successful GET responses in production
              if (isGetMethod && res && process.env.NODE_ENV === 'production') {
                this.cache.set(cacheKey,
                  {
                    data: res,
                    timestamp: Date.now()
                  });
              }

              return {
                data: res,
                state:
                  res !== undefined && res !== null
                    ? REQUEST_STATE.SUCCESS
                    : REQUEST_STATE.EMPTY,
              };
            } catch (error) {
              return {
                state: REQUEST_STATE.FAILED,
                err: error as Error,
              };
            } finally {
              // Clear in-flight entry once settled
              if (isGetMethod && cacheKey) {
                this.inFlight.delete(cacheKey);
              }
            }
          })();

          // Mark as in-flight for GETs
          if (isGetMethod && cacheKey) {
            this.inFlight.set(cacheKey, resultPromise);
          }

          return loadingPromise.then(() => resultPromise);
        };
      }
    }
  }

  // Clear the entire cache
  clearCache(): void {
    this.cache.clear();
  }

  // Clear a specific cache entry
  clearCacheEntry(key: string, args: any[]): void {
    const cacheKey = `${key}:${JSON.stringify(args)}`;
    this.cache.delete(cacheKey);
  }
}

/* ------------------ public helpers -------------------------- */
export function wrapClient(client: Api108Jobs) {
  return new WrappedApiClient(client) as unknown as WrappedApi108Jobs;
}

/**
 * HttpService provides a singleton instance of the wrapped Api108Jobs client
 * with additional functionality for caching and request management.
 */
export class HttpService {
  static #_instance: HttpService;
  #client: WrappedApi108Jobs;
  #requestTimeout: number = 30000; // Default timeout: 30 seconds

  private constructor() {
    const apiClient = new Api108Jobs(getHttpBase());
    this.#client = wrapClient(apiClient);

    // Add request timeout handling to all methods
    this.#addTimeoutToMethods();
  }

  /**
   * Get the HTTP client
   */
  public static get client() {
    return this.#Instance.#client;
  }

  /**
   * Get the singleton instance
   */
  static get #Instance() {
    return this.#_instance ?? (this.#_instance = new this());
  }

  /**
   * Clear the entire request cache
   */
  public static clearCache(): void {
    const client = this.#Instance.#client as any;
    if (client.clearCache) {
      client.clearCache();
    }
  }

  /**
   * Clear a specific cache entry
   */
  public static clearCacheEntry(methodName: string, args: any[] = []): void {
    const client = this.#Instance.#client as any;
    if (client.clearCacheEntry) {
      client.clearCacheEntry(methodName,
        args);
    }
  }

  /**
   * Set the request timeout in milliseconds
   */
  public static setTimeout(timeout: number): void {
    this.#Instance.#requestTimeout = timeout;
  }

  /**
   * Adds timeout handling to all client methods
   */
  #addTimeoutToMethods(): void {
    const originalClient = this.#client;
    const timeout = this.#requestTimeout;

    // Get all method names
    const methodNames = Object.keys(originalClient).filter(
      key => typeof originalClient[key] === 'function' && key !== 'setHeaders'
    );

    // Wrap each method with timeout handling
    for (const methodName of methodNames) {
      const originalMethod = originalClient[methodName];

      // Replace the method with a timeout-aware version
      (this.#client as any)[methodName] = async(...args: any[]) => {
        // Create a timeout promise
        const timeoutPromise = new Promise<RequestState<any>>((_, reject) => {
          setTimeout(() => {
              reject(new Error(`Request timeout after ${timeout}ms`));
            },
            timeout);
        });

        try {
          // Race between the original request and the timeout
          return await Promise.race([
            originalMethod(...args),
            timeoutPromise
          ]);
        } catch (error) {
          return {
            state: REQUEST_STATE.FAILED,
            err: error as Error
          };
        }
      };
    }
  }
}

let cachedJwt: string | undefined;

function ensureAuthHeader() {
    const jwt = UserService.Instance?.authInfo?.auth;
    if (jwt && jwt !== cachedJwt) {
        cachedJwt = jwt;
        (HttpService.client as any).setHeaders?.({
            Authorization: `Bearer ${jwt}`
        });
    } else if (!jwt && cachedJwt) {
        // Clear header if token was removed
        cachedJwt = undefined;
        (HttpService.client as any).setHeaders?.({
            Authorization: undefined
        });
    }
}

/* ===== Generic helper ======================================= */
export function callHttp<
  K extends keyof WrappedApi108Jobs,
>(
  method: K,
  ...args: Parameters<WrappedApi108Jobs[K]>
): ReturnType<WrappedApi108Jobs[K]> {
    if(isBrowser() && UserService.Instance?.authInfo?.auth) {
        ensureAuthHeader();
    }
  // Do not inject auth into payload; rely on Authorization header
  return HttpService.client[method](...args) as ReturnType<
    WrappedApi108Jobs[K]
  >;
}

/**
 * ตรวจสอบว่าระบบกำลังอยู่ใน "LOADING" State
 */
export function isLoading<T>(state: RequestState<T>): state is LoadingRequestState {
  return state.state === REQUEST_STATE.LOADING;
}

/**
 * ตรวจสอบว่าระบบอยู่ใน "FAILED" State
 */
export function isFailed<T>(state: RequestState<T>): state is FailedRequestState {
  return state.state === REQUEST_STATE.FAILED;
}

/**
 * ตรวจสอบว่าระบบอยู่ใน "SUCCESS" State พร้อมมีข้อมูล
 */
export function isSuccess<T>(state: RequestState<T>): state is SuccessRequestState<T> {
  return state.state === REQUEST_STATE.SUCCESS;
}
