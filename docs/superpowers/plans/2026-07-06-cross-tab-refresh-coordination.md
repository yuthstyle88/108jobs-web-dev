# Cross-Tab Refresh Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No two browser tabs of the same origin ever send an access-token-refresh request at the same time — whichever tab's scheduled timer fires first does the real work under an exclusive lock; every other tab adopts the result instead of racing against it.

**Architecture:** Wrap the existing, already-committed refresh-attempt logic (`#refreshAccessToken`/`#handleRefreshFailure`, unmodified) in a new coordination layer that uses the Web Locks API (`navigator.locks.request`) to serialize attempts across tabs when available, and falls back to today's unlocked behavior (the round-1/2 retry-and-cookie-detection mitigation, already tested) when it isn't.

**Tech Stack:** TypeScript, Vitest (`vi.useFakeTimers`, `vi.spyOn`), Web Locks API (`navigator.locks`).

## Global Constraints

- Lock name is exactly `"108heros-refresh-token-lock"` (spec's Architecture section).
- `#refreshAccessToken` and `#handleRefreshFailure` are not modified in any way — only what calls them changes.
- The freshness check reuses the existing `#REFRESH_MARGIN_MS` constant (60,000ms) — no new magic number for "how fresh is fresh enough."
- No backend changes, no changes to `login()`, `setToken()`, `logout()`, cookie helpers, or any file other than `src/services/UserService.ts` and `src/services/UserService.test.ts`.
- The fallback path (no `navigator.locks`) must behave identically to what's already committed and tested — every existing test in `UserService.test.ts` must continue to pass unmodified.

---

### Task 1: Lock-wrapped coordinated refresh entry point

**Files:**
- Modify: `src/services/UserService.ts`
- Test: `src/services/UserService.test.ts`

**Interfaces:**
- Consumes: `getAuthJWTCookie(): string | null` (already exported from `src/utils/browser.ts`, not currently imported into `UserService.ts`); `getRefreshTokenCookie`, `setAuthJWTCookie`, `jwtDecode`, `HttpService.client.refreshWithIdentityPlatform`, `#refreshAccessToken(retryCount?: number)`, `#setAuthInfo(jwt?: string)`, `#scheduleRefresh()` — all already exist, unchanged.
- Produces: `#refreshAccessTokenCoordinated(): void` — this is the new function `#scheduleRefresh()`'s timer calls instead of `#refreshAccessToken()` directly. `#adoptCookieIfFresh(): boolean` — returns `true` if it adopted an already-fresh cookie (caller should not attempt a network refresh).

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to the end of `src/services/UserService.test.ts` (after the existing `"UserService refresh scheduling"` block, which is not touched). First, add `setAuthJWTCookie` to the existing browser import at the top of the file (it currently only imports `getAuthJWTCookie`):

```typescript
import { getAuthJWTCookie, setAuthJWTCookie } from "@/utils/browser";
```

Then append:

```typescript
describe("UserService refresh scheduling with Web Locks", () => {
  let mockLocksRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLocksRequest = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      return Promise.resolve().then(callback);
    });
    Object.defineProperty(navigator, "locks", {
      value: { request: mockLocksRequest },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- test-only stub; real jsdom has no `locks` property
    delete navigator.locks;
  });

  it("adopts an already-fresh cookie without calling the network", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
      refreshWithIdentityPlatform: vi.fn(),
    } as any);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const makeJwt = (exp: number) => {
      const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
      return `${b64(header)}.${b64(payload)}.sig`;
    };

    // Schedules a refresh at ~60s (exp is 120s out, REFRESH_MARGIN_MS is 60s).
    const staleJwt = makeJwt(nowSeconds + 120);
    await UserService.Instance.login(staleJwt, "a-refresh-token");

    // Simulate a sibling tab completing a refresh in the meantime: overwrite
    // the access-token cookie with a fresh one, well outside REFRESH_MARGIN_MS.
    const freshJwt = makeJwt(nowSeconds + 10_000);
    setAuthJWTCookie(freshJwt);

    const refreshSpy = HttpService.client.refreshWithIdentityPlatform as ReturnType<typeof vi.fn>;

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mockLocksRequest).toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(UserService.Instance.authInfo?.claims?.exp).toBe(nowSeconds + 10_000);
  });

  it("performs the real refresh under the lock when the cookie is still near-expiry, invoking the Locks API with the expected name", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
      refreshWithIdentityPlatform: vi.fn().mockResolvedValue({
        state: "success",
        data: { accessToken: "new-token", refreshToken: "new-refresh", expiresIn: 3600 },
      }),
    } as any);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: "none" };
    const payload = { sub: "1", iss: "auth-service", aud: "jobs", exp: nowSeconds + 120, iat: nowSeconds, roles: ["user"], realm: "r", platform: "p", tenant_id: "t" };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const fakeJwt = `${b64(header)}.${b64(payload)}.sig`;

    await UserService.Instance.login(fakeJwt, "a-refresh-token");

    const refreshSpy = HttpService.client.refreshWithIdentityPlatform as ReturnType<typeof vi.fn>;
    expect(refreshSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mockLocksRequest).toHaveBeenCalledTimes(1);
    expect(mockLocksRequest).toHaveBeenCalledWith("108heros-refresh-token-lock", expect.any(Function));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ refreshToken: "a-refresh-token" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/services/UserService.test.ts`

Expected: the two new tests FAIL. `"performs the real refresh under the lock..."` fails because `mockLocksRequest` is never called (the current code calls `#refreshAccessToken()` directly from the timer, ignoring `navigator.locks` entirely). `"adopts an already-fresh cookie..."` fails because `refreshSpy` IS called (there is no freshness pre-check yet, so the current code tries to refresh regardless of the cookie already being fresh). All pre-existing tests in the file still pass.

- [ ] **Step 3: Add `getAuthJWTCookie` to `UserService.ts`'s browser import**

In `src/services/UserService.ts`, change line 1 from:

```typescript
import {clearAuthCookie, getRefreshTokenCookie, isBrowser, setAuthJWTCookie, setLangCookie, setRefreshTokenCookie} from "@/utils/browser";
```

to:

```typescript
import {clearAuthCookie, getAuthJWTCookie, getRefreshTokenCookie, isBrowser, setAuthJWTCookie, setLangCookie, setRefreshTokenCookie} from "@/utils/browser";
```

- [ ] **Step 4: Add the lock name constant and rewire the timer callback**

In `src/services/UserService.ts`, change:

```typescript
    static readonly #REFRESH_MARGIN_MS = 60_000;
    static readonly #REFRESH_RETRY_DELAY_MS = 3_000;
    static readonly #MAX_REFRESH_RETRIES = 2;
    #refreshTimer?: ReturnType<typeof setTimeout>;

    #scheduleRefresh() {
        this.#clearRefreshTimer();
        if (!isBrowser()) return;
        const claims = this.authInfo?.claims;
        const refreshToken = getRefreshTokenCookie();
        if (!claims?.exp || !refreshToken) return;
        const delay = Math.max(0, claims.exp * 1000 - Date.now() - UserService.#REFRESH_MARGIN_MS);
        this.#refreshTimer = setTimeout(() => {
            void this.#refreshAccessToken();
        }, delay);
    }
```

to:

```typescript
    static readonly #REFRESH_MARGIN_MS = 60_000;
    static readonly #REFRESH_RETRY_DELAY_MS = 3_000;
    static readonly #MAX_REFRESH_RETRIES = 2;
    static readonly #REFRESH_LOCK_NAME = "108heros-refresh-token-lock";
    #refreshTimer?: ReturnType<typeof setTimeout>;

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
```

- [ ] **Step 5: Add `#adoptCookieIfFresh` and `#refreshAccessTokenCoordinated`**

In `src/services/UserService.ts`, immediately after `#clearRefreshTimer()`'s closing brace (right before `async #refreshAccessToken(retryCount = 0) {`), insert:

```typescript
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

Do not modify `#refreshAccessToken` or `#handleRefreshFailure` in any way — they keep working exactly as committed, just called from inside `attempt()` now instead of directly from the timer.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/services/UserService.test.ts`

Expected: all tests pass, including the two new ones and every pre-existing test in the file (11 tests total before this task; 13 after).

- [ ] **Step 7: Run the typecheck**

Run: `npx tsc --noEmit`

Expected: no output, clean exit. (This project has no dedicated `typecheck` script in `package.json`; `tsc --noEmit` is the direct check. TypeScript 5.x's bundled DOM types already include `Navigator.locks`/`LockManager`, so no type assertions should be needed for `navigator.locks.request`.)

- [ ] **Step 8: Commit**

```bash
git add src/services/UserService.ts src/services/UserService.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): serialize cross-tab refresh attempts with the Web Locks API

Two prior rounds of retry-based hardening narrowed the multi-tab
refresh-token-rotation race (commonly reproducible -> rare) but couldn't
close it without actual synchronization between tabs. This wraps the
existing, unmodified refresh-attempt logic in navigator.locks.request()
so at most one tab is ever attempting a refresh at a time; every other
tab re-checks the cookie once it's their turn and adopts an
already-refreshed token instead of racing against it.

Falls back to today's unlocked behavior (the round-1/2 retry-and-
cookie-detection mitigation, unchanged) when navigator.locks isn't
available.
EOF
)"
```

---

## Self-Review

**Spec coverage:** the spec's Architecture section has three sub-sections — "Lock-wrapped refresh entry point," "Why the round-1/2 logic doesn't need to change," and "Fallback path" — all three are implemented by Task 1's single code change (the fallback path requires no new code at all, only the `typeof navigator !== "undefined" && "locks" in navigator` check routing away from the lock). The Testing section's three scenarios are covered by Task 1's two tests (the third scenario, "confirms the Locks API is actually invoked with the expected name," is folded into the second test as an additional assertion rather than a near-duplicate third test — both check the same setup, so a separate test would only repeat it). Error Handling's two points (lock-request rejection, default lock options) are both satisfied by the exact code in Step 5 (the `.catch()`, and passing no options object to `request()`, which defaults to exclusive/non-`ifAvailable`/non-`steal`).

**Placeholder scan:** none — every step has exact file paths, exact before/after code, exact commands and expected output.

**Type consistency:** `#adoptCookieIfFresh(): boolean` and `#refreshAccessTokenCoordinated(): void` match their spec signatures exactly. `Claims` (used in Step 5) is the existing exported interface already used throughout the file — not a new type.
