import {clearAuthCookie, getAuthJWTCookie, isBrowser, setAuthJWTCookie, setLangCookie} from "@/utils/browser";
import {jwtDecode} from "jwt-decode";
import {MyUserInfo} from "108heros-client";
import {HttpService} from "./index";
import {isSuccess} from "./HttpService";
import {toast} from "sonner";
import {VALID_LANGUAGES} from "@/constants/language";
import {getClientCurrentLanguage} from "@/utils/getClientCurrentLanguage";
import {useUserStore} from "@/store/useUserStore";

export const JOBS_ADMIN_ROLE = "jobs:admin";

export interface Claims {
    sub: string;
    iss: string;
    aud: string;
    exp: number;
    iat: number;
    roles: string[];
    realm: string;
    platform: string;
    tenant_id: string;
}

export function isAdminClaims(claims?: Claims): boolean {
    return Array.isArray(claims?.roles) && claims.roles.includes(JOBS_ADMIN_ROLE);
}

interface AuthInfo {
    claims?: Claims;
    auth?: string;
    sharedKey?: CryptoKey;
    /**
     * The `chat_session_key` row this browser's key exchange created.
     *
     * Goes on the chat socket URL so the relay decrypts what THIS device sent
     * and re-encrypts with THIS device's key. Undefined against a server
     * without per-device keys, which falls back to one key per person.
     */
    chatKeyId?: number;
}

export class UserService {
    static #instance: UserService;
    public myUserInfo?: MyUserInfo;
    public authInfo?: AuthInfo;
    public currentLanguage: string = "th";
    public acceptedTerms: boolean = false;

    private constructor() {
        this.currentLanguage = getClientCurrentLanguage();
        this.#setAuthInfo();
        this.#hydrateReadLastMap();
        this.#scheduleRefresh();
    }

    public static get Instance() {
        return this.#instance || (this.#instance = new this());
    }

    get getLanguage(): string {
        return this.currentLanguage;
    }

    get getAcceptedTerms(): boolean {
        return this.acceptedTerms;
    }

    get isLoggedIn() {
        return Boolean(this.authInfo?.auth);
    }

    get isAdmin(): boolean {
        return isAdminClaims(this.authInfo?.claims);
    }

    public async login(accessToken: string, refreshToken?: string, showToast = false): Promise<void> {
        if (!isBrowser() || !accessToken) return;

        // The locale in the current URL/cookie is the user's active selection.
        // It must win over an older profile preference returned by the API.
        this.currentLanguage = getClientCurrentLanguage(true);

        if (showToast) {
            toast("loggedIn");
        }
        // Client-side cookie. proxy.ts's middleware reads this same cookie
        // (falls back to authCookieName when the "jwt"-named cookie is absent),
        // so it's already visible to SSR/middleware on the very next request --
        // no separate server-side HttpOnly cookie round trip is needed.
        setAuthJWTCookie(accessToken);
        if (refreshToken) await UserService.#persistRefreshToken(refreshToken);
        this.#setAuthInfo(accessToken);
        this.#hydrateReadLastMap();
        this.#scheduleRefresh();

        // Profile fields (language, accepted-terms) no longer live on the JWT --
        //    fetch them once from the real API. Falls back to existing defaults on
        //    failure rather than blocking login: the user is still logged in even
        //    if this one call hiccups, and the next getMyUser()-backed page load
        //    will pick up the real values.
        try {
            const myUser = await HttpService.client.getMyUser();
            if (isSuccess(myUser)) {
                this.myUserInfo = myUser.data;
                const localUser = myUser.data.localUserView.localUser;
                this.acceptedTerms = Boolean(localUser.acceptedTerms);
            }
        } catch (e) {
            console.warn('[UserService.login] Failed to hydrate profile via getMyUser()', e);
        }

        // 4) Language cookie (non-HttpOnly for client-side reads)
        if (!VALID_LANGUAGES.includes(this.currentLanguage)) return;
        setLangCookie(this.currentLanguage);
    }

    public async setToken(jwt: string): Promise<void> {
      if (!jwt) return;
      try {
        // Set client cookie
        setAuthJWTCookie(jwt);
        // Update auth info
        this.#setAuthInfo(jwt);
        this.#scheduleRefresh();

      } catch (e) {
        console.warn('[UserService.setToken] Failed to set token', e);
      }
    }

    public async logout() {
        try {
            this.#clearRefreshTimer();
            this.authInfo = undefined;
            this.myUserInfo = undefined;
            useUserStore.getState().resetStore();

            if (isBrowser()) {
                // Clear client-side cookies
                clearAuthCookie();

                // Clear the HttpOnly refresh-token cookie server-side -- client JS
                // cannot clear it directly.
                try {
                    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
                } catch {}

                // Clear possible legacy cache
                window.caches?.delete?.('instance-cache');
            }

            // Notify backend logout endpoint safely
            try {
                await HttpService.client.logout();
            } catch {}

            // Read the active locale at redirect time so a language change made
            // during this session is preserved on the login page.
            const lang = getClientCurrentLanguage(true);
            this.currentLanguage = lang;
            const redirectPath = `/${lang}/login`;
            setTimeout(() => {
                if (isBrowser()) location.replace(redirectPath);
            }, 150);
        } catch (err) {
            console.warn('[UserService.logout] failed', err);
            if (isBrowser()) location.replace('/');
        }
    }

    public auth(throwErr = false): string | undefined {
        const auth = this.authInfo?.auth;

        if(auth) {
            return auth;
        } else {
            const msg = "No JWT cookie found";

            if(throwErr && isBrowser()) {
                console.error(msg);
                toast("notLoggedIn");
            }

            return undefined;
            // throw msg;
        }
    }

    #hydrateReadLastMap() {
        if(!isBrowser()) return;
        try {
            if(!this.authInfo) this.authInfo = {auth: ""} as AuthInfo;
        } catch {
            if(!this.authInfo) this.authInfo = {auth: ""} as AuthInfo;

        }
    }

    #setAuthInfo(jwt?: string) {
        try {
            const claims = jwtDecode<Claims>(jwt ?? "");
            this.authInfo = { auth: jwt, claims };
            useUserStore.getState().setClaims(claims);
        } catch {
            this.authInfo = { jwt } as AuthInfo;
            useUserStore.getState().setClaims(null);
        }
    }

    // Hands the refresh token to the server so it can be stored as an
    // HttpOnly, Secure cookie -- it is never written to document.cookie.
    // Best-effort: a failure here just means auto-refresh won't work until
    // the next login, not that the user is logged out.
    static async #persistRefreshToken(refreshToken: string): Promise<void> {
        try {
            await fetch("/api/auth/session", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });
        } catch (e) {
            console.warn("[UserService.persistRefreshToken] Failed to persist refresh token", e);
        }
    }

    static readonly #REFRESH_MARGIN_MS = 60_000;
    static readonly #REFRESH_RETRY_DELAY_MS = 3_000;
    static readonly #MAX_REFRESH_RETRIES = 2;
    static readonly #REFRESH_LOCK_NAME = "108heros-refresh-token-lock";
    #refreshTimer?: ReturnType<typeof setTimeout>;

    #scheduleRefresh() {
        this.#clearRefreshTimer();
        if (!isBrowser()) return;
        const claims = this.authInfo?.claims;
        // Whether a refresh token actually exists is no longer something JS can
        // see (it's an HttpOnly cookie) -- /api/auth/refresh is the source of
        // truth for that; a missing/expired refresh cookie just makes the
        // scheduled attempt fail, which #handleRefreshFailure resolves via logout().
        if (!claims?.exp) return;
        const delay = Math.max(0, claims.exp * 1000 - Date.now() - UserService.#REFRESH_MARGIN_MS);
        this.#refreshTimer = setTimeout(() => {
            this.#refreshAccessTokenCoordinated();
        }, delay);
    }

    #clearRefreshTimer() {
        if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
        this.#refreshTimer = undefined;
    }

    // Re-reads the *current* access-token cookie (not this tab's possibly-stale
    // in-memory claims) and adopts it if it's already fresh enough that no
    // refresh is needed right now -- the case where another tab already
    // refreshed while this tab was scheduled or queued for the lock. Returns
    // true if it adopted (caller should not attempt a network refresh).
    #adoptCookieIfFresh(): boolean {
        const currentToken = getAuthJWTCookie();
        if (!currentToken) return false;
        let claims: Claims;
        try {
            claims = jwtDecode<Claims>(currentToken);
        } catch {
            return false;
        }
        if (!claims.exp || claims.exp * 1000 - Date.now() <= UserService.#REFRESH_MARGIN_MS) return false;
        this.#setAuthInfo(currentToken);
        this.#scheduleRefresh();
        return true;
    }

    // Entry point the scheduled timer calls. When the Web Locks API is
    // available, wraps the attempt in a per-origin exclusive lock so at most
    // one tab is ever inside #refreshAccessToken at a time -- eliminating the
    // multi-tab race at its source rather than narrowing its timing window.
    // Falls back to today's unlocked behavior (round-1/2 mitigation still
    // active) when navigator.locks doesn't exist.
    #refreshAccessTokenCoordinated(retryCount = 0): void {
        const attempt = async () => {
            if (this.#adoptCookieIfFresh()) return;
            await this.#refreshAccessToken(retryCount);
        };
        if (typeof navigator !== "undefined" && "locks" in navigator) {
            void navigator.locks.request(UserService.#REFRESH_LOCK_NAME, attempt).catch((e) => {
                console.warn("[UserService.refreshAccessTokenCoordinated] lock request failed", e);
            });
        } else {
            void attempt();
        }
    }

    async #refreshAccessToken(retryCount = 0) {
        try {
            const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
            if (res.ok) {
                const data = await res.json() as { accessToken: string };
                setAuthJWTCookie(data.accessToken);
                this.#setAuthInfo(data.accessToken);
                this.#scheduleRefresh();
            } else {
                await this.#handleRefreshFailure(retryCount);
            }
        } catch (e) {
            console.warn('[UserService.refreshAccessToken] refresh attempt failed', e);
            await this.#handleRefreshFailure(retryCount);
        }
    }

    // A failed refresh is not necessarily a dead session: it may be a sibling
    // tab that already rotated the (HttpOnly, origin-shared) refresh cookie,
    // or a plain transient network blip -- either way worth one delayed
    // retry. The retry re-enters #refreshAccessTokenCoordinated, whose
    // #adoptCookieIfFresh() check picks up a sibling's already-rotated JWT
    // cookie without hitting the network again. Only give up and log out
    // once retries are exhausted or the access token has actually expired --
    // logging out immediately on the first failure would tear down every
    // tab's session over an ordinary multi-tab race.
    async #handleRefreshFailure(retryCount: number) {
        const exp = this.authInfo?.claims?.exp;
        const stillValid = Boolean(exp) && exp! * 1000 > Date.now();
        const canRetry = stillValid && retryCount < UserService.#MAX_REFRESH_RETRIES;
        if (canRetry) {
            this.#clearRefreshTimer();
            this.#refreshTimer = setTimeout(() => {
                this.#refreshAccessTokenCoordinated(retryCount + 1);
            }, UserService.#REFRESH_RETRY_DELAY_MS);
            return;
        }
        await this.logout();
    }
}
