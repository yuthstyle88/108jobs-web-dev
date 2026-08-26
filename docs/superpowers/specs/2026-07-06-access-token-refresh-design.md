# Access-Token Refresh Design

## Context

The Identity-Platform auth work (2026-07-05) restored a working login/register round trip, but left a real gap: `IdentityPlatformLoginResponse`/`IdentityPlatformAuthResponse` both include a `refreshToken` field that nothing in the frontend stores or uses, and nothing calls any refresh endpoint. When the short-lived access token expires, the user is silently logged out — API calls start failing with no automatic recovery, and nothing tells them why.

Investigation confirmed:
- api-108heros's own local refresh endpoint (`crates/identity/src/refresh.rs`) is deliberately dead (`Err(App108ErrorType::LocalLoginDisabled)`, 410 Gone), with a comment saying local refresh was retired since "Clients holding an Identity-Platform token should refresh against Identity-Platform directly."
- An expired access token does **not** reliably produce an HTTP 401. `App108ErrorType::NotLoggedIn` (what an expired/invalid JWT maps to via `local_user_view_from_jwt`) has no explicit status-code match arm in `crates/core/src/error.rs` and falls through to the generic 400 Bad Request — only `IncorrectLogin` gets a real 401. This rules out "catch 401, refresh, retry" as a reliable trigger.
- No `Identity-Platform-dev` checkout exists in this workspace, so the exact `/auth/refresh` request/response shape can't be read directly the way `/auth/login`'s shape could be. **This design assumes it mirrors `/auth/login` and `/auth/register`** (same base URL + path convention, returns the same token-set shape) — an explicit, acknowledged assumption to verify against the real service during implementation, not a confirmed fact.
- `IdentityPlatformTokenSet` (the Rust struct already used for login/register responses) deserializes `access_token`, `token_type`, `expires_in`, `refresh_token` with no rename attributes (implying Identity-Platform's wire format is snake_case for these), and only `identity_id` gets a `#[serde(rename = "identityId")]`. The assumed refresh request body follows the same snake_case convention as the existing `LoginRequestBody`/`RegisterRequestBody` structs.

## Goal

When a user is logged in, their session survives past the access token's original expiry without any visible interruption, by refreshing the access token proactively before it expires — not by reacting to a failed request.

## Non-Goals

- Reactive (catch-a-failure-then-refresh) handling — proactive-only is sufficient given predictable token lifetimes and no server-side revocation currently in play; can be added later as a safety net if it ever proves necessary in practice.
- OAuth login's refresh handling — that flow is already broken server-side (out of scope, established in the prior auth-fix work) and has no refresh token available from its response shape regardless.
- Any change to api-108heros's dead local `/account/auth/refresh` endpoint — left exactly as-is (a separate, unrelated retirement).

## Architecture

### 1. Backend — new refresh proxy endpoint (api-108heros)

Add `POST /account/auth/refresh/identity-platform`, registered in `src/api_routes.rs`'s existing `scope("/account/auth")` block (next to the sibling `/login/identity-platform` and `/register/identity-platform` resources), wrapped in the same `rate_limit.login()` limiter those two already use.

New function in `crates/api/api_utils/src/identity_platform.rs`, placed next to `login_with_identity_platform` and following its exact structure:

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

New handler file `crates/http/src/crud/user/refresh_via_identity_platform.rs`, mirroring `login_via_identity_platform.rs`'s exact shape:

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

`RefreshTokenRequest` (`crates/identity/src/refresh.rs:12-15`) is reused as-is — it's `Deserialize` with `#[serde(rename_all = "camelCase")]`, so the frontend's `{refreshToken: "..."}` body maps to it correctly; it isn't otherwise coupled to the dead local `refresh_token` handler, so importing it here doesn't resurrect anything. Route registration in `src/api_routes.rs`, mirroring lines 358-362 exactly:

```rust
.service(
  resource("/refresh/identity-platform")
    .wrap(rate_limit.login())
    .route(post().to(refresh_with_identity_platform_handler)),
)
```

Plus the matching import addition in the `user::{...}` block and a `pub mod refresh_via_identity_platform;` in `crates/http/src/crud/user/mod.rs`.

### 2. Frontend client (108heros-clean)

New `Api108Heros.refreshWithIdentityPlatform(form: {refreshToken: string}, options?: RequestOptions)` in `http.ts`, mirroring `loginWithIdentityPlatform`'s exact shape:

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

New minimal type `src/lib/108heros-client/src/types/RefreshIdentityPlatform.ts`:

```typescript
export type RefreshIdentityPlatform = {
    refreshToken: string;
};
```

No new response type needed — reuses the existing `IdentityPlatformLoginResponse` (`{accessToken, refreshToken, expiresIn}`), matching the backend section above.

New cookie helpers in `src/utils/browser.ts`, mirroring `setAuthJWTCookie`/`getAuthJWTCookie` exactly (same `maxAge`/`secure`/`sameSite`/`path`), keyed on a new constant in `src/utils/config.ts`:

```typescript
export const REFRESH_TOKEN_COOKIE = "refresh_token";
```

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

`clearAuthCookie()` also clears this cookie, so logout doesn't leave a stale refresh token behind.

### 3. `UserService` — the scheduling mechanism

`login()`'s signature grows an optional second parameter: `login(accessToken: string, refreshToken?: string, showToast = false)` — inserted *before* the existing `showToast` parameter, not repurposing its slot. This is safe by construction for two independent reasons, both confirmed against the current code (not assumed): `showToast`'s type stays `boolean` in its own (now third) position, so nothing changes shape out from under it; and separately, every one of the four current call sites (`LoginForm/handlers.ts:112`, `RegisterForm/index.tsx:94`, the OAuth callback page, and `UserService.test.ts`) passes exactly one argument today — none pass `showToast` explicitly — so there is no existing call this reordering could silently break. The existing `UserService.test.ts` call (`login("not-a-real-jwt")`) and the OAuth callback's call (`login(loginData.jwt ?? "")`, which has no refresh token to offer, that flow being already out of scope) both continue to compile and behave the same: no `refreshToken` means no refresh scheduled for that session, not an error.

```typescript
const REFRESH_MARGIN_MS = 60_000; // refresh 60s before actual expiry

#refreshTimer?: ReturnType<typeof setTimeout>;

public async login(accessToken: string, refreshToken?: string, showToast = false): Promise<void> {
    if (!isBrowser() || !accessToken) return;
    // ...existing cookie/profile-hydration logic unchanged...
    setAuthJWTCookie(accessToken);
    if (refreshToken) setRefreshTokenCookie(refreshToken);
    this.#setAuthInfo(accessToken);
    this.#hydrateReadLastMap();
    this.#scheduleRefresh();
    // ...rest unchanged...
}

#scheduleRefresh() {
    this.#clearRefreshTimer();
    const claims = this.authInfo?.claims;
    const refreshToken = getRefreshTokenCookie();
    if (!claims?.exp || !refreshToken) return; // no refresh token stored -- nothing to schedule
    const delay = Math.max(0, claims.exp * 1000 - Date.now() - REFRESH_MARGIN_MS);
    this.#refreshTimer = setTimeout(() => { void this.#refreshAccessToken(); }, delay);
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

Two more call sites, both small:
- **Constructor path** (`#setAuthInfo`, called from the private constructor on every `UserService.Instance` access): after decoding claims from an existing cookie on page load, also call `#scheduleRefresh()` if a valid session was found — this is what makes an already-logged-in visitor's *next browser tab or page reload* correctly re-arm the timer, not just a fresh `login()` call. `Math.max(0, ...)` in the delay calculation means an already-expired-but-not-yet-refreshed token schedules an effectively-immediate refresh rather than silently doing nothing.
- **`logout()`**: calls `#clearRefreshTimer()` before clearing cookies, so a stray timer can't fire an authenticated-looking refresh call after the user has explicitly signed out.

### 4. Call-site updates

`LoginForm/handlers.ts:112` (`handleLoginSuccess`) and `RegisterForm/index.tsx:94` both already have `loginRes.refreshToken`/`registerRes.data.refreshToken` sitting unused right next to the `accessToken` they already read — both become `UserService.Instance.login(loginRes.accessToken, loginRes.refreshToken)` / `UserService.Instance.login(registerRes.data.accessToken, registerRes.data.refreshToken)`.

## Error Handling

- **Refresh call fails (network error, or Identity-Platform rejects the refresh token as invalid/expired)**: `#refreshAccessToken()` forces `logout()` — a real "your session has ended, please log in again" outcome rather than a silent stuck state where API calls keep failing with no explanation. `logout()`'s existing redirect-to-login behavior covers this; no new UI needed for this design's scope.
- **`getMyUser()`/profile hydration inside `login()` failing**: unchanged, already has its own try/catch with sensible fallback defaults (pre-existing behavior, not touched by this design).
- **Backend refresh endpoint's own failure modes**: identical to the sibling login endpoint's — any failure (bad refresh token, Identity-Platform unreachable) surfaces as the same coarse-grained `identityPlatformLoginFailed` (502), which the frontend already treats as "the refresh attempt didn't work" via the `isSuccess()` check above, regardless of the specific reason.

## Testing

- **Backend**: unit test for `RefreshRequestBody`'s serialization (mirrors `identity_platform_auth_response_serializes_camel_case`-style existing tests) confirming the snake_case wire shape sent to Identity-Platform. No mocked-HTTP integration test, matching the established pattern for this whole family of handlers (no test-double exists for the Identity-Platform client anywhere in this codebase).
- **Frontend**: a pure-function test for the refresh-delay calculation (given an `exp`, `REFRESH_MARGIN_MS`, and a mocked "now", what delay results — including the already-expired case producing `0`, not a negative number). A `UserService` test using `vi.useFakeTimers()`: call `login()` with both tokens, advance time to just past the scheduled delay, and confirm exactly one call to `refreshWithIdentityPlatform` fired (no real waiting, no real network).
- **Manual end-to-end verification**: against the same live local stack established in the prior auth-fix work (local api-108heros + Identity-Platform-dev), log in, and either wait out a real (short-lived, e.g. dev-configured) token lifetime or use fake-timer-free direct observation to confirm a real refresh call fires before expiry and the session survives uninterrupted past the original token's expiry — the thing this whole design exists to prove.

## Self-Review

- **Placeholder scan**: none — every section has exact file paths, exact code, exact constant values.
- **Internal consistency**: the assumed Identity-Platform request/response shapes are used consistently between the backend and frontend sections; `refreshToken`'s optional-parameter design in `UserService.login()` is stated once, with the exact reasoning for why it's safe (not just asserted), and its effect on all four call sites (LoginForm, RegisterForm, OAuth callback, the existing unit test) is spelled out explicitly rather than left implicit.
- **Scope check**: bounded to token storage + proactive scheduling + the one new backend endpoint it depends on. Reactive/fallback refresh, OAuth's refresh story, and the dead local refresh endpoint are explicitly out of scope (see Non-Goals).
- **Ambiguity check**: the single biggest open assumption (Identity-Platform's actual `/auth/refresh` shape) is called out explicitly, twice, as unverified — not silently treated as fact.

## Verification record

Every technical claim above was independently re-checked against the live source of both repos (not carried over from memory): the exact current content of `crates/http/src/crud/user/mod.rs` and `src/api_routes.rs`'s user-module import block and `/account/auth` scope (confirming the new module/route slot in exactly where described, with no naming conflicts anywhere in either repo for `RefreshIdentityPlatform`, `refresh_via_identity_platform`, or `refresh_with_identity_platform`); `App108Context::settings()` and `identity_platform_base_url()`'s exact signatures; `browser.ts`'s exact cookie-helper functions and `config.ts`'s exports (no collision with the new `REFRESH_TOKEN_COOKIE` constant); and a fresh adversarial sweep of every `UserService.Instance.login(` call site, confirming exactly four exist today (three real call sites plus the existing unit test) and none currently pass a second argument.

One adjacent, out-of-scope discovery from that sweep: `.claude/worktrees/dead-backend-feature-cleanup/` is a live but stale git worktree containing its own divergent copy of these same call sites, already migrated to an object-argument calling convention, including a reference to `AcceptTermsForm` — a component actually deleted from the main tree during the earlier Identity-Platform auth-fix work. This worktree is not touched by this design and isn't part of its scope; it's noted here only so it isn't mistaken for live code in a future sweep.
