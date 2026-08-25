# Cross-Tab Refresh Coordination Design

## Context

The access-token-refresh feature ([2026-07-06-access-token-refresh-design.md](2026-07-06-access-token-refresh-design.md)) proactively refreshes the access token ~60s before expiry. Each browser tab holds its own `UserService` singleton and independently schedules its own refresh timer off the same JWT `exp` claim (read from a cookie shared across all tabs of the origin). Identity-Platform rotates and invalidates the old refresh token on every successful refresh, so when two tabs' timers fire near-simultaneously, one tab's request wins and the other's is rejected against an already-dead token.

Two rounds of live, independently-reviewed hardening already landed for this (`src/services/UserService.ts`, commits on `feat/access-token-refresh`):
- Round 1: a failed refresh gets one 3-second-delayed retry (instead of an immediate `logout()`) if the current access token hasn't actually expired yet.
- Round 2: `#handleRefreshFailure` compares the refresh-token cookie's value at failure time against the value the failed attempt used — if a sibling tab already rotated it, retry immediately with the fresh value instead of waiting. Bounded to 2 total retries (~96s worst-case budget).

Independent review of round 2 confirmed it took the failure mode from "commonly reproducible for any user with two tabs open" down to "rare — requires a sibling tab's winning request to stay in flight beyond the full retry budget" — but confirmed it does not fully eliminate the case: if that rare window is hit, `logout()` still clears the shared-origin refresh-token cookie, including a healthy sibling tab's already-rotated, still-valid token. Full elimination requires actual synchronization between tabs, not narrower timing windows.

## Goal

No two tabs of the same origin ever send a refresh request at the same time. Whichever tab's timer fires first does the real work; every other tab, whenever its own timer fires, finds out the token has already been refreshed and adopts it — without ever calling the network, and without any possibility of racing against another tab's in-flight request.

## Non-Goals

- Coordinating across different origins, browser profiles, or devices — not needed; this is purely a same-origin, same-browser problem.
- A hand-rolled `BroadcastChannel`-based leader-election protocol — rejected in favor of the Web Locks API (`navigator.locks`), which gives the same mutual-exclusion guarantee natively, including automatic release if the lock-holding tab closes or crashes, with no heartbeat/staleness-timeout/split-brain handling to build or test.
- Removing the round-1/2 retry-and-cookie-detection logic in `#refreshAccessToken`/`#handleRefreshFailure` — it stays exactly as committed, unmodified. It becomes practically unreachable for tabs where the lock is available (nothing can race while the lock is held), but remains the active, load-bearing mitigation for the fallback path (browsers without Web Locks support). Deleting already-reviewed, already-tested code to "simplify" a path that would rarely exercise it is not worth the churn or the regression risk for unsupported browsers.
- A true live multi-tab verification — the available browser-preview tooling manages one browser session at a time and cannot exercise genuine concurrent-tab timing. Verification here is unit tests plus a live single-tab regression pass (confirming the coordinated path doesn't break the already-verified single-tab flows), the same limitation already accepted for round 1/2.

## Architecture

### Lock-wrapped refresh entry point

`src/services/UserService.ts` gets one new constant, one new helper, and one new entry point. `#scheduleRefresh()`'s timer callback changes to call the new entry point instead of `#refreshAccessToken()` directly — everything else about scheduling (the `exp`-based delay math, `REFRESH_MARGIN_MS`, `#clearRefreshTimer()`) is unchanged.

```typescript
static readonly #REFRESH_LOCK_NAME = "108heros-refresh-token-lock";

#scheduleRefresh() {
    this.#clearRefreshTimer();
    if (!isBrowser()) return;
    const claims = this.authInfo?.claims;
    const refreshToken = getRefreshTokenCookie();
    if (!claims?.exp || !refreshToken) return;
    const delay = Math.max(0, claims.exp * 1000 - Date.now() - UserService.#REFRESH_MARGIN_MS);
    this.#refreshTimer = setTimeout(() => {
        this.#refreshAccessTokenCoordinated();
    }, delay);
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
#refreshAccessTokenCoordinated(): void {
    const attempt = async () => {
        if (this.#adoptCookieIfFresh()) return;
        await this.#refreshAccessToken();
    };
    if (typeof navigator !== "undefined" && "locks" in navigator) {
        void navigator.locks.request(UserService.#REFRESH_LOCK_NAME, attempt).catch((e) => {
            console.warn("[UserService.refreshAccessTokenCoordinated] lock request failed", e);
        });
    } else {
        void attempt();
    }
}
```

`getAuthJWTCookie` (already exported from `src/utils/browser.ts`, not currently imported into `UserService.ts`) gets added to the existing import line. No other file changes.

### Why the round-1/2 logic doesn't need to change

`#refreshAccessToken`/`#handleRefreshFailure` are called exactly as they are today, just from inside `attempt()` instead of directly from the timer. For a lock-supporting tab: by the time `attempt()` runs (whether immediately, if this tab won the lock race, or after queueing, if it didn't), `#adoptCookieIfFresh()` has already caught the case where a sibling tab finished a refresh in the meantime. If it hasn't (this tab is genuinely first, or the sole tab), `#refreshAccessToken()` proceeds exactly as before — and because the lock excludes every other tab for the duration, no sibling can rotate the cookie out from under it mid-request. A failure inside the lock now means what it always should have: a genuine transient network issue or a genuinely dead refresh token — never "a sibling already fixed it."

### Fallback path

Browsers without `navigator.locks` (effectively none in realistic 2026 traffic, but checked defensively) get the exact behavior committed in rounds 1/2: `attempt()` runs unlocked, `#adoptCookieIfFresh()` still helps (a strict improvement — skips a redundant network call whenever the cookie's already fresh, regardless of locking), and if it isn't fresh, `#refreshAccessToken()`'s existing bounded retry + cookie-rotation-detection is the full mitigation, unchanged.

## Error Handling

- `navigator.locks.request()` rejects if the requesting tab is torn down while queued (e.g. the user closes it mid-wait). The `.catch()` above just logs and does nothing further — there's no session left in that tab to protect.
- Default lock options (exclusive mode, no `ifAvailable`, no `steal`) are used: other tabs queue and wait their turn rather than bailing early or forcibly interrupting an in-progress refresh.
- Everything downstream of `attempt()` — genuine network failures, a genuinely dead refresh token, the bounded-retry-then-`logout()` path — is unchanged from rounds 1/2 and already covered by their tests.

## Testing

jsdom (this project's vitest environment) does not implement `navigator.locks` at all, which has a useful consequence: every existing round-1/2 test continues to exercise the fallback (unlocked) branch with zero modification, since `"locks" in navigator` is naturally `false` in that environment already.

New tests, in a new `describe` block that installs a mock `navigator.locks` (a passthrough that awaits the callback, faithfully modeling the API's real contract) via `Object.defineProperty` in a scoped `beforeEach`/removed in `afterEach` — no existing test or describe block is touched:

1. **Adopts an already-fresh cookie without calling the network.** Log in with a near-expiry token, then directly overwrite the access-token cookie with a fresh one (simulating a sibling tab's completed refresh) before the scheduled timer fires. Advance the timer; confirm `refreshWithIdentityPlatform` is never called, and `UserService.Instance.authInfo` reflects the fresh token's claims.
2. **Performs the real refresh under the lock when the cookie is still near-expiry.** Same setup as the existing round-1 scheduling test, but with the lock mock installed — confirms the coordinated path still delegates to a real `#refreshAccessToken()` call when adoption isn't possible, not just when it is.
3. **Actually invokes the Locks API.** A spy on the mocked `navigator.locks.request` asserting it was called with `"108heros-refresh-token-lock"` — a sanity check that the coordinated path is genuinely going through the lock, not accidentally always taking the direct-call branch.

## Self-Review

- **Placeholder scan**: none — every section has exact file paths, exact code, exact constant/lock names.
- **Internal consistency**: the fallback path's behavior is stated once and matches rounds 1/2 exactly (verified against the actual committed code, not recalled from memory); the "why round-1/2 logic doesn't need to change" section directly follows from the lock's exclusivity guarantee rather than being asserted independently.
- **Scope check**: bounded to the coordination layer around the existing refresh mechanism. No changes to the backend, to cookie storage, to `login()`/`setToken()`/`logout()`, or to the round-1/2 retry logic itself.
- **Ambiguity check**: the one real judgment call — whether to also delete the now-mostly-inert round-2 cookie-detection logic — is resolved explicitly in Non-Goals with its reasoning (fallback-path load-bearing, not worth the churn), not left implicit.
