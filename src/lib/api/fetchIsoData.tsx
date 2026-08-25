/**
 * Server-side data fetching function for Next.js
 *
 * This function fetches initial data for server-side rendering, including:
 * - Site configuration
 * - User information (if authenticated)
 * - Route-specific data based on the current URL
 *
 * @param url The current URL being rendered
 * @param incomingHeaders HTTP headers from the incoming request
 * @returns An IsoData object containing all necessary data for rendering, or null if an error occurred
 */
import {EMPTY_REQUEST, FailedRequestState, REQUEST_STATE, RequestState, wrapClient} from "@/services/HttpService";
import {isAuthPath} from "@/utils/app";
import {getErrorPageData, matchPath} from "@/utils/helpers";
import {Match} from "@/utils/router";
import {routes} from "@/utils/routes";
import {ErrorPageData, IsoData, RouteData} from "@/utils/types";
import {parsePath} from "history";
import {IncomingHttpHeaders} from "http";
import {
    GetSiteResponse,
    Api108Heros, ListBankAccountsResponse,
    ListCategoriesResponse,
    ListUserChatRoomsResponse,
    MyUserInfo
} from "108heros-client";
import {getHttpBase} from "@/utils";
import {getJwtCookieFromServer, setForwardedHeaders} from "@/utils/helper-server";

/**
 * Optimized logger that conditionally logs based on environment
 * - In development: Provides detailed logs for debugging
 * - In production: Minimizes logging to improve performance
 */
const logger = {
    /**
     * Log debug messages (development only)
     */
    debug: (message: string, ...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[fetchIsoData] ${message}`,
                ...args);
        }
    },

    /**
     * Log error messages with different behavior based on environment
     * - In production: Use console.warn with minimal details
     * - In development: Use console.warn with full error details
     */
    error: (message: string, err?: unknown) => {
        const prefix = `[fetchIsoData] ${message}`;

        if (process.env.NODE_ENV !== "development") {
            // In production, use warn instead of error and minimize logging
            if (err) {
                console.warn(prefix,
                    err instanceof Error ? err.message : String(err));
            }
            return; // Prevent console.error in production
        }

        // Development mode only - provide detailed error information
        if (!err) {
            console.warn(prefix);
            return;
        }
        const detail = err instanceof Error ? err.message.trim() : String(err).trim();
        console.error(detail ? `${prefix}: ${detail}` : prefix, err);
    }
};

/**
 * Fetches initial data for server-side rendering with optimized performance
 * and improved error handling.
 *
 * @param url The current URL being rendered
 * @param incomingHeaders HTTP headers from the incoming request
 * @returns An IsoData object containing all necessary data for rendering
 */
export default async function fetchIsoData(url: string, incomingHeaders: IncomingHttpHeaders): Promise<IsoData | null> {
    // Initialize data containers
    let siteRes: GetSiteResponse | undefined = undefined;
    let myUserInfo: MyUserInfo | undefined = undefined;
    let routeData: RouteData = {};
    let errorPageData: ErrorPageData | undefined = undefined;
    let match: Match<any> | null | undefined;
    let categories: ListCategoriesResponse | undefined = undefined;
    let chatRooms: ListUserChatRoomsResponse | undefined = undefined;
    let bankAccounts: ListBankAccountsResponse | undefined = undefined;
    let activeRoute;
    try {

        // Set up headers and authentication
        const headers = await setForwardedHeaders(incomingHeaders);
        const jwt = await getJwtCookieFromServer(incomingHeaders) ?? "";
        // Create a per-request client and set headers without mutating the shared client
        const tempClient = wrapClient(new Api108Heros(getHttpBase()));
        await (tempClient as any).setHeaders(headers);

        // Check authentication for protected routes
        if (!jwt && isAuthPath(url)) {
            return createIsoDataResponse(jwt, url, undefined, undefined, undefined, undefined, undefined, {}, {
                code: 302,
                redirectTo: `/login?prev=${encodeURIComponent(url)}`,
            } as any);
        }

        // Fetch site data and profile info in parallel for better performance
        // Only query authenticated endpoints if a valid JWT cookie is present
        const [trySite, tryCategories, tryUser, tryChatRooms, tryBankAccounts] = await Promise.all([
            (tempClient as any).getSite(),
            (tempClient as any).listCategories(),
            jwt ? (tempClient as any).getMyUser() : Promise.resolve(EMPTY_REQUEST),
            jwt ? (tempClient as any).listChatRooms() : Promise.resolve(EMPTY_REQUEST),
            jwt ? (tempClient as any).listUserBankAccounts() : Promise.resolve(EMPTY_REQUEST),
        ]);

        // Process profile data with improved error handling
        await processUserData(tryUser);

        await processCategoriesData(tryCategories)

        await processChatRoomsData(tryChatRooms)

        await processUserBankAccountsData(tryBankAccounts)

        // Process site data and fetch route-specific data
        if (!await processSiteData(trySite,
            url,
            headers)) {
            // If site data processing failed, return early with error data
            return createIsoDataResponse(
                undefined,
                url,
                siteRes,
                myUserInfo,
                categories,
                chatRooms,
                bankAccounts,
                routeData,
                errorPageData);
        }

        // Check for errors in route data
        if (hasRouteDataErrors()) {
            return createIsoDataResponse(
                undefined,
                url,
                siteRes,
                myUserInfo,
                categories,
                chatRooms,
                bankAccounts,
                {},
                errorPageData);
        }

        // Return the complete data
        return createIsoDataResponse(
            jwt,
            url,
            siteRes,
            myUserInfo,
            categories,
            chatRooms,
            bankAccounts,
            routeData,
            errorPageData);
    } catch (err) {
        // Log the error and return a structured error response
        logger.error("Unhandled error in fetchIsoData",
            err);
        errorPageData = getErrorPageData(err as Error,
            undefined);
        return createIsoDataResponse(
            undefined,
            url,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            {},
            errorPageData);
    }

    /**
     * Process profile data and handle authentication errors
     */
    async function processUserData(tryUser: RequestState<MyUserInfo>): Promise<void> {
        if (tryUser.state === REQUEST_STATE.SUCCESS) {
            myUserInfo = tryUser.data;
        }
    }

    /**
     * Process categories data and handle fetch list errors
     */
    async function processCategoriesData(tryCategories: RequestState<ListCategoriesResponse>): Promise<void> {
        if (tryCategories.state === REQUEST_STATE.SUCCESS) {
            categories = tryCategories.data;
        }
    }

    /**
     * Process chat rooms data and handle fetch list errors
     */
    async function processChatRoomsData(tryChatRooms: RequestState<ListUserChatRoomsResponse>): Promise<void> {
        if (tryChatRooms.state === REQUEST_STATE.SUCCESS) {
            chatRooms = tryChatRooms.data;
        }
    }

    /**
     * Process chat rooms data and handle fetch list errors
     */
    async function processUserBankAccountsData(tryBankAccounts: RequestState<ListBankAccountsResponse>): Promise<void> {
        if (tryBankAccounts.state === REQUEST_STATE.SUCCESS) {
            bankAccounts = tryBankAccounts.data;
        }
    }


    /**
     * Process site data and fetch route-specific data
     * @returns true if processing was successful, false if there was an error
     */
    async function processSiteData(
        trySite: RequestState<GetSiteResponse>,
        url: string,
        headers: Record<string, string>
    ): Promise<boolean> {
        if (trySite.state === REQUEST_STATE.SUCCESS) {
            siteRes = trySite.data;

            // Find the active route for the current URL
            activeRoute = routes.find(
                route => (match = matchPath(route.path,
                    url)),
            );

            // Fetch route-specific data if available
            if (siteRes && activeRoute?.fetchInitialData && match) {
                const {search} = parsePath(url);
                const initialFetchReq = {
                    path: url,
                    query: activeRoute.getQueryParams?.(search,
                        siteRes) ?? {},
                    match,
                    site: siteRes,
                    headers: headers,
                };

                // Development-only code to test race conditions
                // if (process.env.NODE_ENV === "development" && process.env.SIMULATE_RACE_CONDITIONS === "true") {
                //     setTimeout(() => {
                //         // Intentionally break things if fetchInitialData tries to use global state
                //         // after the first await of an unresolved promise.
                //         myUserInfo = undefined;
                //     });
                // }

                try {
                    routeData = await activeRoute.fetchInitialData(initialFetchReq);
                } catch (routeError) {
                    logger.error(`Error fetching route data for ${url}`,
                        routeError);
                    errorPageData = getErrorPageData(
                        new Error(`Failed to fetch route data: ${(routeError as Error).message}`),
                        siteRes
                    );
                    return false;
                }
            }
            return true;
        } else if (trySite.state === REQUEST_STATE.FAILED) {
            logger.error(`Failed to fetch site data: ${trySite.err.message}`);
            errorPageData = getErrorPageData(new Error(trySite.err.message),
                undefined);
            return false;
        }
        return true;
    }

    /**
     * Check if there are any errors in the route data
     * @returns true if there are errors, false otherwise
     */
    function hasRouteDataErrors(): boolean {
        const error = Object.values(routeData).find(
            res => res.state === REQUEST_STATE.FAILED && res.err.message !== "couldnt_find_object",
        ) as FailedRequestState | undefined;

        if (error) {
            logger.error(`Error in route data: ${error.err.message}`,
                error.err);
            errorPageData = getErrorPageData(new Error(error.err.message),
                siteRes);
            return true;
        }
        return false;
    }

    /**
     * Create a standardized IsoData response object
     */
    function createIsoDataResponse(
        jwt: string | undefined,
        path: string,
        siteRes?: GetSiteResponse,
        myUserInfo?: MyUserInfo,
        categories?: ListCategoriesResponse,
        chatRooms?: ListUserChatRoomsResponse,
        bankAccounts?: ListBankAccountsResponse,
        routeData: RouteData = {},
        errorPageData?: ErrorPageData
    ): IsoData {
        return {
            jwt,
            path,
            siteRes,
            myUserInfo,
            categories,
            chatRooms,
            bankAccounts,
            routeData,
            errorPageData,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://staging.108heros.com",
        };
    }
}