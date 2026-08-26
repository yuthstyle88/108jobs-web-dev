# Access-Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in user's session survives past the access token's original expiry without visible interruption, by refreshing the access token proactively before it expires.

**Architecture:** api-108heros gains a thin new proxy endpoint (`POST /account/auth/refresh/identity-platform`), mirroring the existing login/register-via-identity-platform pattern exactly. The frontend stores the refresh token alongside the access token, and `UserService` schedules a `setTimeout` to refresh shortly before the access token's known expiry — no reactive/401-catching logic, matching the design's proactive-only decision.

**Tech Stack:** Rust/Actix (api-108heros), Next.js/TypeScript with Vitest (108heros-clean).

**Design doc:** `docs/superpowers/specs/2026-07-06-access-token-refresh-design.md` — read it first for full rationale. Its Verification record section confirms every file path, line number, and existing-code quote in this plan against live source at time of writing.

## Global Constraints

- New backend route: exactly `POST /account/auth/refresh/identity-platform`, in the existing `scope("/account/auth")` block (`src/api_routes.rs`), wrapped in the same `rate_limit.login()` limiter `/login/identity-platform` uses.
- Reuses two existing types, no new backend response type: `RefreshTokenRequest` (`crates/identity/src/refresh.rs:12-15`, already `#[serde(rename_all = "camelCase")]`) for the incoming request, and `IdentityPlatformLoginResponse` (`crates/http/src/crud/user/login_via_identity_platform.rs:18`, already `pub`) for the response.
- **Explicit, acknowledged assumption** (not a confirmed fact — no `Identity-Platform-dev` checkout exists in this workspace to verify directly): Identity-Platform's refresh endpoint is `POST {base_url}/auth/refresh`, taking `{"refresh_token": "..."}` (snake_case, unrenamed — matching `LoginRequestBody`'s convention, since `IdentityPlatformTokenSet`'s response fields are all snake_case except `identityId`), returning the same token-set shape login/register already return. This must be confirmed during Task 5's manual verification — if wrong, Task 1's `refresh_with_identity_platform` function is the only place needing a fix.
- New frontend cookie: constant `REFRESH_TOKEN_COOKIE = "refresh_token"` in `src/utils/config.ts`. Cookie helpers mirror `setAuthJWTCookie`/`getAuthJWTCookie` exactly (`src/utils/browser.ts:127-146`): `maxAge: 365 * 24 * 60 * 60`, `secure: isHttps()`, `sameSite: "lax"`, `path: "/"`.
- `UserService.login()`'s new signature: `login(accessToken: string, refreshToken?: string, showToast = false)` — `refreshToken` inserted *before* the existing `showToast` parameter, not repurposing it. Confirmed safe: none of the four current call sites (`LoginForm/handlers.ts:112`, `RegisterForm/index.tsx:94`, the OAuth callback page, `UserService.test.ts:39`) pass a second argument today.
- Named constant `REFRESH_MARGIN_MS = 60_000` (refresh 60s before actual expiry) — never a bare magic number in the scheduling code.
- Proactive-only refresh trigger. No reactive/401-catching fallback, no change to the dead local `/account/auth/refresh` endpoint — both explicitly out of scope per the design's Non-Goals.

---

## Task 1: Backend — refresh proxy endpoint (api-108heros)

**Files:**
- Modify: `crates/api/api_utils/src/identity_platform.rs` (add `RefreshRequestBody` + `refresh_with_identity_platform`, plus a test)
- Create: `crates/http/src/crud/user/refresh_via_identity_platform.rs`
- Modify: `crates/http/src/crud/user/mod.rs`
- Modify: `src/api_routes.rs` (import block at lines 69-75, route block at lines 358-362)
- Modify: `crates/http/Cargo.toml` (add `app_108heros_identity = { workspace = true }` — discovered missing during implementation; `crates/http` didn't previously depend on `crates/identity` at all, but already has the identical pattern established for `app_108heros_db_views_site` (`login_via_identity_platform.rs` imports `LoginRequest` from it the same way this task imports `RefreshTokenRequest` from `app_108heros_identity::refresh`). No feature flag needed — `RefreshTokenRequest` has no `#[cfg(feature = ...)]` gates. Confirmed no circular dependency (`crates/identity` doesn't depend on `crates/http`).

**Interfaces:**
- Consumes: `App108Context::settings()` (`crates/api/api_utils/src/context.rs:70`, returns `&'static Settings`), `identity_platform_base_url(settings: &Settings) -> App108Result<String>` (`identity_platform.rs:238`), `RefreshTokenRequest { refresh_token: String }` (`crates/identity/src/refresh.rs:12-15`), `IdentityPlatformLoginResponse { access_token, refresh_token, expires_in }` (`crates/http/src/crud/user/login_via_identity_platform.rs:18`, already `pub`).
- Produces: `pub async fn refresh_with_identity_platform(context: &App108Context, base_url: &str, refresh_token: &str) -> App108Result<IdentityPlatformTokenSet>` and `pub async fn refresh_with_identity_platform_handler(...)` — consumed only by the route registration in this same task; no other task touches Rust code.

- [ ] **Step 1: Add `refresh_with_identity_platform` with its serialization test**

In `crates/api/api_utils/src/identity_platform.rs`, add this immediately after `login_with_identity_platform` (which currently ends right before the `#[cfg(test)]` module, per the file's current structure — confirm by finding the line `#[cfg(test)]` and inserting just above it):

```rust
#[derive(Serialize)]
struct RefreshRequestBody<'a> {
  refresh_token: &'a str,
}

/// Exchanges a refresh token for a fresh access/refresh token pair against
/// Identity-Platform, returning its token set as-is.
pub async fn refresh_with_identity_platform(
  context: &App108Context,
  base_url: &str,
  refresh_token: &str,
) -> App108Result<IdentityPlatformTokenSet> {
  let body = RefreshRequestBody { refresh_token };
  let response = context
    .client()
    .post(format!("{base_url}/auth/refresh"))
    .json(&body)
    .send()
    .await
    .with_app108_type(App108ErrorType::IdentityPlatformLoginFailed)?
    .error_for_status()
    .with_app108_type(App108ErrorType::IdentityPlatformLoginFailed)?;

  response
    .json::<IdentityPlatformTokenSet>()
    .await
    .with_app108_type(App108ErrorType::IdentityPlatformLoginFailed)
}
```

Then add this test inside the file's existing `mod tests { ... }` block (add it right before the module's closing `}` — the module already has `use super::*;` at its top, matching every other test in this file, so `RefreshRequestBody` is reachable despite being private):

```rust
  #[test]
  fn refresh_request_body_serializes_snake_case() {
    let body = RefreshRequestBody {
      refresh_token: "abc123",
    };
    let json = serde_json::to_value(&body).unwrap();
    assert_eq!(json, serde_json::json!({ "refresh_token": "abc123" }));
  }
```

- [ ] **Step 2: Run the new test to verify it passes**

Run: `cargo test -p app_108heros_api_utils --features full refresh_request_body_serializes_snake_case`
Expected: `1 passed, N filtered out`.

Note the `--features full` flag is required here specifically — `app_108heros_api_utils` has a `full` Cargo feature (`crates/api/api_utils/Cargo.toml`, pulling in `app_108heros_db/full` and friends) that this workspace's CI enables via its workspace-wide `cargo test --workspace` command (`.woodpecker.yml:150`). Checking or testing this one crate in isolation via a bare `-p app_108heros_api_utils` (no `--features full`) fails with ~20+ unrelated-looking errors (`unresolved import diesel`, `ExpressionMethods` not in scope, etc.) — this is a Cargo feature-unification artifact, not a real break in the codebase. Confirmed: `cargo check -p app_108heros_http` and `cargo check -p app_108heros_api_server` (Step 6, below) both already succeed without any extra flags, since they pull in `app_108heros_api_utils` correctly as part of the larger dependency graph — only a standalone check/test of `app_108heros_api_utils` itself needs `--features full`.

- [ ] **Step 3: Write the new handler file**

Create `crates/http/src/crud/user/refresh_via_identity_platform.rs`:

```rust
use actix_web::web::{Data, Json};
use app_108heros_api_utils::{
  context::App108Context,
  identity_platform::{identity_platform_base_url, refresh_with_identity_platform},
};
use app_108heros_core::error::App108Result;
use app_108heros_identity::refresh::RefreshTokenRequest;

use crate::crud::user::login_via_identity_platform::IdentityPlatformLoginResponse;

/// Exchanges a still-valid refresh token for a fresh access/refresh token
/// pair, proxying to Identity-Platform. Reuses the existing
/// `RefreshTokenRequest` type (already `#[serde(rename_all = "camelCase")]`,
/// so the frontend's `{refreshToken}` body deserializes correctly) and the
/// existing `IdentityPlatformLoginResponse` shape (identical fields to what
/// a fresh token exchange actually returns -- no new response type needed).
pub async fn refresh_with_identity_platform_handler(
  data: Json<RefreshTokenRequest>,
  context: Data<App108Context>,
) -> App108Result<Json<IdentityPlatformLoginResponse>> {
  let data = data.into_inner();
  let base_url = identity_platform_base_url(context.settings())?;
  let tokens =
    refresh_with_identity_platform(&context, &base_url, &data.refresh_token).await?;

  Ok(Json(IdentityPlatformLoginResponse {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  }))
}
```

- [ ] **Step 4: Wire the module into `crates/http/src/crud/user/mod.rs`**

Current full content (5 lines):
```rust
pub mod create;
pub mod create_via_identity_platform;
pub mod delete;
pub mod login_via_identity_platform;
pub mod my_user;
```

New content:
```rust
pub mod create;
pub mod create_via_identity_platform;
pub mod delete;
pub mod login_via_identity_platform;
pub mod my_user;
pub mod refresh_via_identity_platform;
```

- [ ] **Step 5: Register the route in `src/api_routes.rs`**

In the `user::{...}` import block (currently lines 69-75):
```rust
    user::{
      create::{authenticate_with_oauth, register},
      create_via_identity_platform::register_with_identity_platform_handler,
      delete::delete_account,
      login_via_identity_platform::login_with_identity_platform_handler,
      my_user::get_my_user,
    },
```

New:
```rust
    user::{
      create::{authenticate_with_oauth, register},
      create_via_identity_platform::register_with_identity_platform_handler,
      delete::delete_account,
      login_via_identity_platform::login_with_identity_platform_handler,
      my_user::get_my_user,
      refresh_via_identity_platform::refresh_with_identity_platform_handler,
    },
```

In the `/account/auth` scope (currently lines 342-377), the `/login/identity-platform` service block (lines 358-362) is immediately followed by `.route("/logout", ...)` at line 363. Current:
```rust
            .service(
              resource("/login/identity-platform")
                .wrap(rate_limit.login())
                .route(post().to(login_with_identity_platform_handler)),
            )
            .route("/logout", post().to(logout))
```

New (adds one `.service(...)` block between them):
```rust
            .service(
              resource("/login/identity-platform")
                .wrap(rate_limit.login())
                .route(post().to(login_with_identity_platform_handler)),
            )
            .service(
              resource("/refresh/identity-platform")
                .wrap(rate_limit.login())
                .route(post().to(refresh_with_identity_platform_handler)),
            )
            .route("/logout", post().to(logout))
```

Note: this scope already has an unrelated, dead `.route("/refresh", post().to(refresh_token))` at (currently) line 364, a few lines below the new insertion point — the local, always-410 refresh endpoint. Leave it untouched; it's a different path (`/refresh`, not `/refresh/identity-platform`) and out of scope per the design's Non-Goals.

- [ ] **Step 6: Confirm the workspace builds**

Run: `cargo check -p app_108heros_api_utils` (checks Step 1's new code) and `cargo check -p app_108heros_http` (checks Step 3's new handler file) and `cargo check -p app_108heros_api_server` (checks Step 5's route-registration edit, in the root binary crate — confirmed in the prior Identity-Platform login-endpoint plan that `crates/http` itself has no `[[bin]]` target, so this is the correct binary to check).
Expected: no errors from any of the three commands.

- [ ] **Step 7: Commit**

```bash
git add crates/api/api_utils/src/identity_platform.rs crates/http/src/crud/user/refresh_via_identity_platform.rs crates/http/src/crud/user/mod.rs src/api_routes.rs crates/http/Cargo.toml Cargo.lock
git commit -m "feat(auth): add standalone Identity-Platform token-refresh endpoint

Exposes login_with_identity_platform's sibling refresh_with_identity_platform
as POST /account/auth/refresh/identity-platform, mirroring the existing
login/register-via-identity-platform pattern exactly. Reuses the existing
RefreshTokenRequest and IdentityPlatformLoginResponse types -- no new
backend response type needed.

Adds app_108heros_identity as a new crates/http dependency (needed for
RefreshTokenRequest) -- crates/http had no prior dependency on
crates/identity; the same cross-crate-import pattern already exists for
app_108heros_db_views_site, so this isn't a new architectural precedent.

The request shape sent to Identity-Platform ({refresh_token} snake_case)
is an assumption, not a confirmed fact -- verify during manual end-to-end
testing (final task of this plan)."
```

(Only add `Cargo.lock` to the commit if it actually changed — check `git status` first; adding a new workspace-internal dependency edge may or may not touch the lockfile depending on how it's structured.)

---

## Task 2: Frontend client + cookie storage (108heros-clean)

**Files:**
- Create: `src/lib/108heros-client/src/types/RefreshIdentityPlatform.ts`
- Modify: `src/lib/108heros-client/src/http.ts`
- Modify: `src/lib/108heros-client/src/index.ts`
- Modify: `src/utils/config.ts`
- Modify: `src/utils/browser.ts`
- Test: `src/lib/108heros-client/src/http.test.ts` (existing file, add a case)

**Interfaces:**
- Consumes: the existing `#wrapper<Req, Res>`/`RequestOptions`/`@Post`/`@Tags` decorator pattern already used by `loginWithIdentityPlatform` (`http.ts:944-956`); the existing `IdentityPlatformLoginResponse` type (already exported from this package).
- Produces: `Api108Heros.refreshWithIdentityPlatform(form: RefreshIdentityPlatform, options?: RequestOptions): Promise<IdentityPlatformLoginResponse>`, consumed by Task 3. `setRefreshTokenCookie(refreshToken: string): void` / `getRefreshTokenCookie(): string | null`, consumed by Task 3.

- [ ] **Step 1: Write the failing test**

In `src/lib/108heros-client/src/http.test.ts`, add this test alongside the existing one:

```typescript
it("exposes refreshWithIdentityPlatform", () => {
  const client = new Api108Heros("http://localhost:8536");
  expect(typeof client.refreshWithIdentityPlatform).toBe("function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- http.test.ts`
Expected: FAIL — `refreshWithIdentityPlatform` is `undefined` (method doesn't exist yet).

- [ ] **Step 3: Add the new type file**

Create `src/lib/108heros-client/src/types/RefreshIdentityPlatform.ts`:

```typescript
export type RefreshIdentityPlatform = {
    refreshToken: string;
};
```

- [ ] **Step 4: Add the client method in `http.ts`**

Add the import line to the existing `import type {X} from "./types/X";` block. The current relevant slice (alphabetical) is:
```typescript
import type {ProfileData} from "./types/ProfileData";
import type {RegisterIdentityPlatform} from "./types/RegisterIdentityPlatform";
import type {ResendVerificationEmail} from "./types/ResendVerificationEmail";
```
New (inserted alphabetically — "Refresh" sorts before "Register", 'f' < 'g' at the fourth character):
```typescript
import type {ProfileData} from "./types/ProfileData";
import type {RefreshIdentityPlatform} from "./types/RefreshIdentityPlatform";
import type {RegisterIdentityPlatform} from "./types/RegisterIdentityPlatform";
import type {ResendVerificationEmail} from "./types/ResendVerificationEmail";
```

Add the method directly after `loginWithIdentityPlatform` (currently ends at line 956 with `}`, immediately followed by the doc comment for `registerWithIdentityPlatform` at line 958):

```typescript
    /**
     * @summary Refresh an access token via Identity-Platform.
     */
    @Post("/account/auth/refresh/identity-platform")
    @Tags("Account")
    async refreshWithIdentityPlatform(
        @Body() form: RefreshIdentityPlatform,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RefreshIdentityPlatform, IdentityPlatformLoginResponse>(
            HttpType.Post,
            "/account/auth/refresh/identity-platform",
            form,
            options,
        );
    }
```

- [ ] **Step 5: Export the new type from `index.ts`**

Add, in alphabetical position among the existing `export type {X} from "./types/X";` lines:
```typescript
export type {RefreshIdentityPlatform} from "./types/RefreshIdentityPlatform";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- http.test.ts`
Expected: PASS (2 tests: the existing one plus the new one).

- [ ] **Step 7: Add the `REFRESH_TOKEN_COOKIE` constant**

In `src/utils/config.ts`, add next to the existing `JWT`/`authCookieName` constants (current lines 19-20):
```typescript
export const authCookieName =  process.env.NEXT_PUBLIC_APP_NAME ?? "108jobs.com" ;
export const JWT =  "jwt";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
```

- [ ] **Step 8: Add the cookie helpers in `browser.ts`**

Add the import for the new constant to the existing top-of-file import:
```typescript
import {authCookieName, REFRESH_TOKEN_COOKIE} from "@/utils/config";
```

Add these two functions, placed directly after `getAuthJWTCookie` (which currently ends at line 146 with `}`), mirroring its exact structure:

```typescript
export function setRefreshTokenCookie(refreshToken: string) {
  document.cookie = serializeCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    maxAge: 365 * 24 * 60 * 60,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
  });
}

export function getRefreshTokenCookie(): string | null {
  if (!isBrowser()) return null;
  const name = `${REFRESH_TOKEN_COOKIE}=`;
  const parts = (document.cookie || "").split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith(name)) {
      return decodeURIComponent(part.slice(name.length));
    }
  }
  return null;
}
```

Update `clearAuthCookie` (currently lines 26-32) to also clear the refresh-token cookie:

Current:
```typescript
export function clearAuthCookie() {
  document.cookie = serializeCookie(authCookieName, "", {
    maxAge: -1,
    sameSite: "lax",
    path: "/",
  });
}
```

New:
```typescript
export function clearAuthCookie() {
  document.cookie = serializeCookie(authCookieName, "", {
    maxAge: -1,
    sameSite: "lax",
    path: "/",
  });
  document.cookie = serializeCookie(REFRESH_TOKEN_COOKIE, "", {
    maxAge: -1,
    sameSite: "lax",
    path: "/",
  });
}
```

- [ ] **Step 9: Type-check and run the full unit suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:unit`
Expected: all tests pass (28 existing + 1 new from Step 6 = 29).

- [ ] **Step 10: Commit**

```bash
git add src/lib/108heros-client/src/types/RefreshIdentityPlatform.ts src/lib/108heros-client/src/http.ts src/lib/108heros-client/src/http.test.ts src/lib/108heros-client/src/index.ts src/utils/config.ts src/utils/browser.ts
git commit -m "feat(auth): add refresh-token client method and cookie storage

Api108Heros.refreshWithIdentityPlatform() calls the new backend endpoint;
setRefreshTokenCookie/getRefreshTokenCookie mirror the existing JWT
cookie helpers exactly. Nothing calls these yet -- wired up in the next
task."
```

---

## Task 3: `UserService` — scheduling mechanism (108heros-clean)

**Files:**
- Modify: `src/services/UserService.ts`
- Test: `src/services/UserService.test.ts` (existing file, add cases)

**Interfaces:**
- Consumes: `HttpService.client.refreshWithIdentityPlatform` and `setRefreshTokenCookie`/`getRefreshTokenCookie` (Task 2).
- Produces: `UserService.login(accessToken: string, refreshToken?: string, showToast = false): Promise<void>` (new signature) — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Add to `src/services/UserService.test.ts` (this file already has `// @vitest-environment jsdom` as its first line and existing `isAdminClaims`/profile-hydration tests — add these as new `describe` blocks, don't remove anything existing):

```typescript
describe("UserService refresh scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules exactly one refresh call after login, firing before the token's expiry", async () => {
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

    // Token expires in 120s from "now"; REFRESH_MARGIN_MS is 60s, so the
    // timer should fire at ~60s, well before the full 120s.
    await vi.advanceTimersByTimeAsync(61_000);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ refreshToken: "a-refresh-token" });
  });

  it("does not schedule a refresh when no refreshToken is provided", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({ state: "failed" }),
      refreshWithIdentityPlatform: vi.fn(),
    } as any);

    await UserService.Instance.login("some-token-without-refresh");
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    const refreshSpy = HttpService.client.refreshWithIdentityPlatform as ReturnType<typeof vi.fn>;
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- UserService.test.ts`
Expected: FAIL — `login()` doesn't accept a second `refreshToken` argument yet, no scheduling exists, `refreshWithIdentityPlatform` is never called.

- [ ] **Step 3: Rewrite `login()` and add the scheduling methods**

Current `login()` (lines 61-95 as of this plan's writing — re-locate by searching for `public async login(` since Task 2 doesn't touch this file and line numbers won't have shifted):

```typescript
    public async login(accessToken: string, showToast = false): Promise<void> {
        if (!isBrowser() || !accessToken) return;

        if (showToast) {
            toast("loggedIn");
        }
        // Client-side cookie. proxy.ts's middleware reads this same cookie
        // (falls back to authCookieName when the "jwt"-named cookie is absent),
        // so it's already visible to SSR/middleware on the very next request --
        // no separate server-side HttpOnly cookie round trip is needed.
        setAuthJWTCookie(accessToken);
        this.#setAuthInfo(accessToken);
        this.#hydrateReadLastMap();

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
                this.currentLanguage = localUser.interfaceLanguage || this.currentLanguage || 'th';
                this.acceptedTerms = Boolean(localUser.acceptedTerms);
            }
        } catch (e) {
            console.warn('[UserService.login] Failed to hydrate profile via getMyUser()', e);
        }

        // 4) Language cookie (non-HttpOnly for client-side reads)
        if (!VALID_LANGUAGES.includes(this.currentLanguage)) return;
        setLangCookie(this.currentLanguage);
    }
```

New:

```typescript
    public async login(accessToken: string, refreshToken?: string, showToast = false): Promise<void> {
        if (!isBrowser() || !accessToken) return;

        if (showToast) {
            toast("loggedIn");
        }
        // Client-side cookie. proxy.ts's middleware reads this same cookie
        // (falls back to authCookieName when the "jwt"-named cookie is absent),
        // so it's already visible to SSR/middleware on the very next request --
        // no separate server-side HttpOnly cookie round trip is needed.
        setAuthJWTCookie(accessToken);
        if (refreshToken) setRefreshTokenCookie(refreshToken);
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
                this.currentLanguage = localUser.interfaceLanguage || this.currentLanguage || 'th';
                this.acceptedTerms = Boolean(localUser.acceptedTerms);
            }
        } catch (e) {
            console.warn('[UserService.login] Failed to hydrate profile via getMyUser()', e);
        }

        // 4) Language cookie (non-HttpOnly for client-side reads)
        if (!VALID_LANGUAGES.includes(this.currentLanguage)) return;
        setLangCookie(this.currentLanguage);
    }
```

Add these private members and methods (place them near `#hydrateReadLastMap`/`#setAuthInfo`, at the bottom of the class body, right before the closing `}` of the class):

```typescript
    static readonly #REFRESH_MARGIN_MS = 60_000;
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

    #clearRefreshTimer() {
        if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
        this.#refreshTimer = undefined;
    }

    async #refreshAccessToken() {
        const refreshToken = getRefreshTokenCookie();
        if (!refreshToken) return;
        try {
            const res = await HttpService.client.refreshWithIdentityPlatform({ refreshToken });
            if (isSuccess(res)) {
                setAuthJWTCookie(res.data.accessToken);
                setRefreshTokenCookie(res.data.refreshToken);
                this.#setAuthInfo(res.data.accessToken);
                this.#scheduleRefresh();
            } else {
                await this.logout();
            }
        } catch (e) {
            console.warn('[UserService.refreshAccessToken] refresh failed, logging out', e);
            await this.logout();
        }
    }
```

Update the import line at the top of the file (currently `import {clearAuthCookie, isBrowser, setAuthJWTCookie, setLangCookie} from "@/utils/browser";`):

```typescript
import {clearAuthCookie, getRefreshTokenCookie, isBrowser, setAuthJWTCookie, setLangCookie, setRefreshTokenCookie} from "@/utils/browser";
```

- [ ] **Step 4: Arm the timer on construction (returning-visitor case) and clear it on logout**

In the private constructor (currently):
```typescript
    private constructor() {
        this.#setAuthInfo();
        this.#hydrateReadLastMap();
    }
```
New:
```typescript
    private constructor() {
        this.#setAuthInfo();
        this.#hydrateReadLastMap();
        this.#scheduleRefresh();
    }
```

In `logout()` (currently starts `public async logout() { try { this.authInfo = undefined; ...`), add a call to `#clearRefreshTimer()` as the very first line inside the `try` block:
```typescript
    public async logout() {
        try {
            this.#clearRefreshTimer();
            this.authInfo = undefined;
            this.myUserInfo = undefined;
            // ...rest of the method unchanged...
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- UserService.test.ts`
Expected: PASS (7 tests: the 4 existing `isAdminClaims` tests, the 1 existing profile-hydration test, and the 2 new ones from Step 1).

- [ ] **Step 6: Run the full unit suite to check for regressions**

Run: `npm run test:unit`
Expected: all tests pass. If any other test constructs a `UserService` instance and the new constructor-path `#scheduleRefresh()` call throws in a way the old code didn't (it shouldn't -- it's guarded by `isBrowser()` and returns early if `claims?.exp` or a refresh-token cookie are absent), fix it here.

- [ ] **Step 7: Commit**

```bash
git add src/services/UserService.ts src/services/UserService.test.ts
git commit -m "feat(auth): schedule proactive access-token refresh in UserService

login() now accepts an optional refreshToken (inserted before the
existing showToast param -- safe, since no current caller passes a
second argument today). On login and on construction (for a returning
visitor's already-valid session), schedules a refresh 60s before the
token's known expiry. A failed refresh forces logout rather than
leaving the user in a silently-broken state."
```

---

## Task 4: Call-site updates (108heros-clean)

**Files:**
- Modify: `src/components/Authentication/LoginForm/handlers.ts:112`
- Modify: `src/components/Authentication/RegisterForm/index.tsx:94`

**Interfaces:**
- Consumes: `UserService.login(accessToken, refreshToken?, showToast?)` (Task 3).
- Produces: nothing consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Update `LoginForm/handlers.ts`**

Current (line 112, inside `handleLoginSuccess`):
```typescript
    await UserService.Instance.login(loginRes.accessToken);
```
New:
```typescript
    await UserService.Instance.login(loginRes.accessToken, loginRes.refreshToken);
```

- [ ] **Step 2: Update `RegisterForm/index.tsx`**

Current (line 94, inside `onSubmit`'s `SUCCESS` case):
```typescript
                    await UserService.Instance.login(registerRes.data.accessToken);
```
New:
```typescript
                    await UserService.Instance.login(registerRes.data.accessToken, registerRes.data.refreshToken);
```

The OAuth callback page (`src/app/[lang]/api/auth/callback/[provider]/page.tsx:126`) is intentionally left unchanged — its response shape (`LoginResponse`) has no `refreshToken` field, and that flow is already broken server-side (out of scope, established in the prior Identity-Platform auth-fix work).

- [ ] **Step 3: Type-check and run the full unit suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:unit`
Expected: all tests still pass (no test covers these two call sites directly, so this is a regression check).

- [ ] **Step 4: Manual smoke test (partial — full round trip in Task 5)**

Start the dev server, log in with a real account against a running backend. Confirm no console errors and that login still succeeds and redirects normally — this step only confirms the two call sites compile and don't crash; proving the refresh actually fires is Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/components/Authentication/LoginForm/handlers.ts src/components/Authentication/RegisterForm/index.tsx
git commit -m "feat(auth): pass refreshToken through from login/register to UserService

Both response shapes already carried refreshToken unused. Now threaded
through to UserService.login() so refresh scheduling actually activates
for real logins and registrations."
```

---

## Task 5: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm the assumed Identity-Platform `/auth/refresh` shape**

Before testing the full flow, directly confirm this plan's central assumption. Against a running local Identity-Platform-dev instance (same setup as prior auth-fix verification: `AUTH_HTTP_ADDR=127.0.0.1:8089 AUTH_AUDIENCE=jobs cargo run -p identity-api`), obtain a real refresh token (log in via `POST http://localhost:8089/auth/login` directly, or via api-108heros's `/account/auth/login/identity-platform`, and inspect the response), then:

```bash
curl -s -X POST http://localhost:8089/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<the real refresh token>"}'
```

Expected: a 200 response with a fresh token set. If the actual field name, path, or response shape differs from what Task 1 assumed, fix `refresh_with_identity_platform` (and if needed `RefreshRequestBody`) in `crates/api/api_utils/src/identity_platform.rs` to match reality before continuing — this is the one point in the whole plan where a wrong assumption would need a real code fix, not just a config change.

- [ ] **Step 2: Verify the new api-108heros endpoint end-to-end**

With api-108heros running locally (pointed at the same Identity-Platform instance, per the four `IDENTITY_*` env vars established in the original auth-fix work) and a real refresh token in hand from Step 1:

```bash
curl -s -X POST http://localhost:8536/api/v4/account/auth/refresh/identity-platform \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<the real refresh token>"}'
```

Expected: 200, with a JSON body `{"accessToken": "...", "refreshToken": "...", "expiresIn": ...}`.

- [ ] **Step 3: Verify the full frontend round trip**

Run the frontend dev server against the local api-108heros. Log in with a real account. Confirm via the browser's cookie inspector that both the access-token cookie and the new refresh-token cookie (`refresh_token`) are set. Confirm no console errors.

- [ ] **Step 4: Confirm the refresh actually fires before expiry**

This needs the access token's real lifetime to be short enough to observe directly (check Identity-Platform-dev's configured `expiresIn` for its dev instance; if it's long, e.g. an hour, either temporarily reduce it in the dev instance's config for this test or accelerate observation by decoding the JWT's `exp` client-side via the browser console and computing when the scheduled refresh should fire). Watch the browser's network tab for a `POST /account/auth/refresh/identity-platform` call firing on its own, without any user action, at roughly 60 seconds before the token's `exp`. Confirm: a fresh access-token cookie value appears after that call succeeds, and a subsequent authenticated request (e.g. reloading a protected page) still succeeds — proving the session survived past the original token's expiry with no visible interruption, which is this whole plan's goal.

- [ ] **Step 5: Confirm the failure path**

Manually corrupt the refresh-token cookie's value (e.g. via the browser console, `document.cookie = "refresh_token=invalid; path=/"`) and force the scheduled refresh to fire early (or wait for the next natural cycle). Confirm the refresh call fails and the user is logged out (redirected to `/login`) rather than left in a stuck, silently-broken state.

- [ ] **Step 6: Report results**

If all five steps pass, this plan's goal is met. If Step 1 revealed a different real shape than assumed, confirm the fix applied there is reflected consistently in Task 1's committed code (amend if needed) before considering the plan complete.
