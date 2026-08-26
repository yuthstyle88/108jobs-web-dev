# Identity-Platform Authentication Design

## Context

A manual smoke test (2026-07-05) found this frontend's login and register UI flows are broken against the current `api-108heros` backend, which has migrated to authenticating exclusively through an Identity-Platform service (see `api-108heros/docs/identity-platform-setup.md`). Investigation (this session) traced both symptoms to their root causes and found the true scope is larger than "two independent bugs":

**Backend state, as of api-108heros commit `9fe747892` ("retire local password login and token refresh", 2026-07-03):**

| Endpoint | Status |
|---|---|
| `POST /account/auth/login` | Unconditionally `Err(LocalLoginDisabled)` → HTTP 410, for any input (`crates/identity/src/login.rs:12-17`) |
| `POST /account/auth/register` (plain) | Also unconditionally `Err(LocalLoginDisabled)` (`crates/http/src/crud/user/create.rs:26-32`) |
| `POST /account/auth/authenticate-with-oauth` | Also unconditionally `Err(LocalLoginDisabled)` — OAuth login/register is retired too (out of scope for this design; not part of the original bug report) |
| `POST /account/auth/refresh` | Also unconditionally `Err(LocalLoginDisabled)` — comment: "Clients holding an Identity-Platform token should refresh against Identity-Platform directly" (`crates/identity/src/refresh.rs:17-27`) — noted for awareness, not addressed by this design |
| `POST /account/auth/update-term` | Also unconditionally `Err(LocalLoginDisabled)` — was OAuth-signup-only, now unreachable (`crates/http/src/api/local_user/update_term.rs:8-19`) |
| `POST /account/auth/register/identity-platform` | **The only working entry point.** Requires `{username, email, password}` (username+password both required and non-empty). Registers with Identity-Platform, links locally, immediately logs in, returns `{accessToken, refreshToken, expiresIn, registrationCreated}`. **Hard-blocks with `EmailAlreadyExists` if the account is already fully registered** (`create_via_identity_platform.rs:159-163`) — cannot double as a "log back in" call. |

The function that calls Identity-Platform's own login (`login_with_identity_platform()`, `crates/api/api_utils/src/identity_platform.rs:261`) exists and works, but nothing exposes it as a standalone route — it's only ever invoked internally, immediately after a fresh registration. **There is currently no way for an already-registered user to log back in.** The handler's own comment (`create_via_identity_platform.rs:250`) assumes a login endpoint would exist ("the client should retry logging in rather than re-registering") — nobody built it.

`verify-email` (`crates/identity/src/verify_email.rs`) still runs but is unreachable dead code: it depends on an `EmailVerification` row keyed to a `local_user_id` that nothing creates anymore (the identity-platform register path skips email-verification gating entirely, by its own documented design), and it no longer mints a JWT even if reached (`jwt: None`, intentional).

**Frontend state (108heros-clean), confirmed by exhaustive grep across `src/lib/108heros-client` (both `src/` and compiled `dist/`) and the whole app:**

- `Api108Heros` (the generated-style API client) has a `login()` method posting to the dead `/account/auth/login`, expecting the old `LoginResponse` shape (`{jwt, registrationCreated, verifyEmailSent, acceptedTerms}`).
- `Api108Heros` has **no `register` method at all** — zero references to `register`, `identity-platform`, or `identityPlatform` anywhere in the client package. `RegisterForm/index.tsx:71` calls `HttpService.client.register(...)`, which is `undefined` at runtime (the wrapping `WrappedApiClient` only creates entries for methods that exist on `Api108Heros.prototype`). This throws a `TypeError` synchronously inside the async `onSubmit`, before any `fetch` happens — matching the reported "no network request, no visible error" exactly.
- `UserService`'s `Claims` type (`src/services/UserService.ts:8-17`) models the old JWT shape (`sub, iss, iat, email, role, lang, isAdmin, acceptedTerms`). A real Identity-Platform JWT has `{sub, iss, aud, exp, iat, roles: string[], realm, platform, tenant_id}` — none of `email`/`role`/`lang`/`isAdmin`/`acceptedTerms` exist on it.
- The entire Register → `VerifyOTPForm` (email OTP code) → `/update-terms` flow was built for the old architecture (email-only signup, OTP-minted JWT, terms gate). None of its assumptions hold: the working register endpoint requires username+password upfront, returns tokens immediately, has no OTP step, and no terms gate.
- All four fields the old `Claims` type read from the JWT (`email`, `lang`/`interfaceLanguage`, `isAdmin`/`admin`, `acceptedTerms`) are available today via a real API call already wired into the client: `getMyUser()` → `MyUserInfo.localUserView.localUser.{email, interfaceLanguage, admin, acceptedTerms}` (`crates/http/src/crud/user/my_user.rs`, confirmed against the frontend's own generated `LocalUser.ts` type). `UserService` already has an unused `myUserInfo` field that is exactly the right home for this.
- Confirmed direct JWT-claims consumers elsewhere in the app (exhaustive grep, excluding `.claude/worktrees/` and `dist/`, re-verified adversarially): `src/services/UserService.ts:173-174` itself (`#setAuthInfo` reads `claims?.lang` and `claims?.acceptedTerms` on every login/construction — the redesign in section 3 below rewrites exactly this method), `LoginForm/handlers.ts:118` (`claims.isAdmin` for post-login redirect), `src/proxy.ts:29-31` (`claims.lang`/`claims.isAdmin` for middleware routing — note this file decodes via a separate hand-rolled, untyped `parseJwtClaims` helper in `src/utils/helper-server.ts:138`, not `jwt-decode`+`Claims`, so its fix is a pure logic change with no type-level coupling to worry about), `ClientOnlyGuestSection.tsx:25-26` (`claims.role === "Guest"`), and `src/modules/chat/utils/security/crypto.ts:80,110` (holds a reference to `authInfo.claims` opaquely for a key-sync cache, never reads a specific field — compile-safe regardless of `Claims`'s shape, no change needed). `Claims` itself is imported as a type in exactly one other place (`LoginForm/handlers.ts:11`) — no other file annotates against it.
- One pre-existing, unrelated backend bug worth flagging (not fixed by this design): `crates/db/src/source/local_user.rs:77-78`'s `accepted_terms: bool` field carries the doc comment `/// Whether their multilang has been verified.` — confirmed via `git blame` to be a copy-paste artifact from commit `89c5fc3245` (2026-07-02), not the field's real meaning. The field name, and its existing use in `SpProfile/index.tsx:90` to gate a UI section, both confirm it's genuinely the terms-of-service-acceptance flag; only the doc comment is wrong. Separately, `LocalUser.ts`/`MyUserInfo.ts`'s generated TS types have drifted from the current Rust structs in other, unrelated fields (renamed `self_promotion`/`blur_self_promotion` fields, a missing `accepted_application`/`secure_chat_enabled`/`identity_platform_id`, and a phantom `profile: ProfileDataView` field on `MyUserInfo` with no Rust counterpart at all) — none of this affects the four fields this design depends on (`email`, `interfaceLanguage`, `admin`, `acceptedTerms`, all confirmed present and correctly named on both sides), but is a separate, pre-existing type-generation staleness issue outside this design's scope.

## Goal

Restore a working login → authenticated-page-load round trip and a working register → authenticated-page-load round trip against the real Identity-Platform-backed api-108heros, by: adding the one missing backend endpoint, making the frontend's `Claims` type and API client honestly match what the backend actually sends today, and rebuilding the register form around what the working registration endpoint actually requires.

## Non-Goals

- OAuth login/registration (`authenticate-with-oauth`) — confirmed also retired backend-side, but not part of the original bug report; left as a separate, known issue.
- Token refresh — confirmed retired backend-side by design (clients should refresh directly against Identity-Platform); not addressed here. Access tokens are short-lived (`expiresIn` from the token response); re-login on expiry is the fallback until refresh is designed.
- Distinguishing "wrong password" from "Identity-Platform unreachable" as different error responses on the new login endpoint — the existing frontend's error-handling fallback already produces a reasonable outcome for both (see Error Handling below), and the existing register-combo handler has the same coarse-grained behavior today, so this isn't a regression to fix as part of this work.
- Multi-tenant per-client audience registration (`POST /admin/client-applications`) — explicitly out of scope per `identity-platform-setup.md`, not wired into api-108heros at all.
- 2FA/TOTP for Identity-Platform-backed accounts — the existing TOTP UI (`show2faModal`) is being removed as dead code (see LoginForm section below), not redesigned; if TOTP is wanted again it needs its own design once Identity-Platform's own 2FA story is known.

## Architecture

### 1. Backend: new login endpoint (api-108heros)

Add `POST /account/auth/login/identity-platform`, registered in `src/api_routes.rs` alongside the existing `/register/identity-platform` resource, wrapped in the same `rate_limit.login()` limiter the dead `/login` route already uses:

```rust
.service(
  resource("/login/identity-platform")
    .wrap(rate_limit.login())
    .route(post().to(login_with_identity_platform_handler)),
)
```

New handler file `crates/http/src/crud/user/login_via_identity_platform.rs` (same crate/directory as the working `create_via_identity_platform.rs`, for symmetry), reusing the existing `LoginRequest` type (`username_or_email`, `password`, `totp_2fa_token` — the last field is accepted but ignored, since Identity-Platform's login has no local TOTP concept):

```rust
pub async fn login_with_identity_platform_handler(
  data: Json<LoginRequest>,
  context: Data<FastJobContext>,
) -> FastJobResult<Json<IdentityPlatformLoginResponse>> {
  let data = data.into_inner();
  let identifier = data
    .username_or_email
    .filter(|s| !s.is_empty())
    .ok_or(FastJobErrorType::IncorrectLogin)?;
  let password = data
    .password
    .filter(|s| !s.is_empty())
    .ok_or(FastJobErrorType::IncorrectLogin)?;

  let base_url = identity_platform_base_url()?;
  let tokens = login_with_identity_platform(
    &context,
    &base_url,
    identifier.into_inner().as_str(),
    &password,
  )
  .await?;

  Ok(Json(IdentityPlatformLoginResponse {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  }))
}
```

New response type, added next to `IdentityPlatformAuthResponse` in `create_via_identity_platform.rs` (or a shared `identity_platform_responses.rs` if that reads cleaner at implementation time):

```rust
#[skip_serializing_none]
#[derive(Debug, Serialize, Clone)]
#[cfg_attr(feature = "ts-rs", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts-rs", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct IdentityPlatformLoginResponse {
  pub access_token: String,
  pub refresh_token: String,
  pub expires_in: i64,
}
```

`IdentityPlatformAuthResponse` (the existing register-combo response type) gets the same `ts-rs` derive/export annotations added — it currently has neither, which is part of why the frontend never picked it up. No existing behavior changes; this is additive.

### 2. Frontend client (`src/lib/108heros-client`)

No automated type-sync pipeline exists between the two repos (confirmed: no codegen/sync script in either `package.json`) — new types are hand-authored to match the Rust shapes, following the existing `// This file was generated by ts-rs... Do not edit this file manually` convention for consistency even though this particular pair will be manually kept in sync for now.

- New `src/types/IdentityPlatformLoginResponse.ts` and `src/types/IdentityPlatformAuthResponse.ts`, matching the Rust structs field-for-field (camelCase, per `#[serde(rename_all = "camelCase")]`).
- New methods on the `Api108Heros` class in `http.ts`, following the file's existing decorator pattern:
  - `loginWithIdentityPlatform(form: Login, options?: RequestOptions): Promise<IdentityPlatformLoginResponse>` → `POST /account/auth/login/identity-platform`
  - `registerWithIdentityPlatform(form: RegisterIdentityPlatform, options?: RequestOptions): Promise<IdentityPlatformAuthResponse>` → `POST /account/auth/register/identity-platform`, where `RegisterIdentityPlatform` is a new, small request type `{username: string, email: string, password: string, selfPromotion?: boolean, honeypot?: string}` (mirrors backend's `RegisterRequest`, only exposing fields this handler actually reads).
- Remove the existing `login()` method and its dedicated request type usage (`Login` type stays, since the new `loginWithIdentityPlatform` reuses its shape) — `login()`'s only two callers are both in `LoginForm/handlers.ts`, both rewired in this same change (see below), and it only ever hits a 410.

### 3. `UserService` / `Claims` redesign

`src/services/UserService.ts`'s `Claims` type becomes the real shape:

```typescript
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

export const JOBS_ADMIN_ROLE = "jobs:admin";

export function isAdminClaims(claims?: Claims): boolean {
    return Array.isArray(claims?.roles) && claims.roles.includes(JOBS_ADMIN_ROLE);
}
```

`UserService.login()` no longer sets `currentLanguage`/`acceptedTerms` from decoded claims. Instead, after setting the auth cookie/claims as today, it calls `HttpService.client.getMyUser()` once and stores the result on the existing (currently unused) `myUserInfo` field; `currentLanguage`/`acceptedTerms` are derived from `myUserInfo.localUserView.localUser.{interfaceLanguage, acceptedTerms}`, falling back to the current defaults (`'th'`, `false`) if the call fails, matching the existing try/catch-and-default pattern already in `#setAuthInfo`. `getAcceptedTerms`/`getLanguage` getters are unchanged in signature — only their backing data source moves.

`#setAuthInfo(jwt)` keeps decoding `sub`/`roles`/`exp`/etc. from the JWT (cheap, synchronous, needed for `isLoggedIn`/`auth()`), but no longer reads `lang`/`acceptedTerms` off `claims` (those fields don't exist there anymore).

### 4. Two other call sites updated to match

- **`src/proxy.ts:31`**: `isAdmin = Boolean(claims?.isAdmin)` → `isAdmin = Array.isArray(claims?.roles) && claims.roles.includes("jobs:admin")`. The `jwtLang` read on line 30 (`typeof claims?.lang === 'string' ? claims.lang : undefined`) needs no change — it already degrades to `undefined` safely when the claim is absent, and `resolveLanguage`'s existing fallback chain (cookie → path → default) already handles that.
- **`src/components/Header/components/ClientOnlyGuestSection.tsx:25-26`**: `const role = UserService.Instance.authInfo?.claims?.role || "Guest"; const isGuest = role === "Guest";` → `const isGuest = !UserService.Instance.isLoggedIn;` (the `isLoggedIn` getter already exists on `UserService` and is already correct — this was simply never wired up here).

### 5. `LoginForm` rewiring

`src/components/Authentication/LoginForm/handlers.ts`:
- `handleLogin` and `handleSubmitTotp` call `HttpService.client.loginWithIdentityPlatform({usernameOrEmail, password, totp2faToken: ...})` instead of `.login(...)`. The `totp2faToken` field is still sent (harmless — the backend ignores it) but the **2FA modal UI branch is removed**: `errorActions.missingTotpToken` and the `show2faModal`/`handleSubmitTotp` machinery become permanently unreachable, since the new endpoint never produces a `missingTotpToken` error (there is no local TOTP check anymore). Removing this now avoids shipping dead UI that looks functional but can never trigger.
- `handleLoginSuccess` updates to the `IdentityPlatformLoginResponse` shape (`{accessToken, refreshToken, expiresIn}`, no `jwt` field). The immediate post-login admin-redirect check (`claims.isAdmin`) becomes `isAdminClaims(jwtDecode<Claims>(accessToken))` using the new roles-based check — this stays synchronous/immediate, no need to wait for a `getMyUser()` round trip for this specific decision, since `roles` is genuinely present on the token.
- `UserService.Instance.login()`'s call signature changes from `{res: LoginResponse}` to accepting the access token string directly (its internal cookie-setting logic is unchanged; only the field name it reads changes from `res.jwt` to the access token parameter).

### 6. `RegisterForm` redesign

`src/components/Authentication/RegisterForm/index.tsx` currently collects only an email. It's redesigned to collect `username`, `email`, and `password` (plus a client-side password-confirmation field, validated with zod, not sent to the backend — the backend's `RegisterRequest.password_verify` field exists but isn't read by this handler, so confirmation is a pure client-side UX check). On submit:

```typescript
const registerRes = await HttpService.client.registerWithIdentityPlatform({
    username: data.username,
    email: data.email,
    password: data.password,
});
```

On `REQUEST_STATE.SUCCESS`, the response (`{accessToken, refreshToken, expiresIn, registrationCreated}`) is handled exactly like a successful login — call the same login-success path used by `LoginForm` (store tokens, redirect into the app). There is no OTP step and no terms gate, matching what the backend actually does today. The existing `emailAlreadyExists` → redirect-to-login-with-hint behavior is kept as-is (already correct, already handled).

**Deleted as part of this change** (adversarially re-verified against the live routing tree — this list is now complete; an earlier draft of this design under-scoped it and would have broken the build):
- `src/components/Authentication/VerifyOTP/index.tsx` (`VerifyOTPForm`)
- `src/app/[lang]/(authentication)/verify-otp/page.tsx` — a **standalone route** that renders `<VerifyOTPForm/>` directly with no props. Missed in the first pass of this design; deleting the component without this page means the build fails on a route importing a component that no longer exists.
- `src/app/[lang]/(authentication)/register/page.tsx`'s `verify-otp`/`resend-otp` `ViewState` branches and the `switchToVerifyOTP` prop plumbing through `RegisterForm` (`index.tsx:25,29,78-79,89-90,97`)
- The `/update-terms` page (`src/app/[lang]/update-terms/page.tsx`)
- `src/components/Authentication/AcceptTermsForm/index.tsx` — rendered *only* by the `/update-terms` page above, so it becomes orphaned once that page is deleted. It reads the `pendingLogin` sessionStorage key that only `VerifyOTPForm`'s (deleted) success path ever wrote — deleting the writer without also deleting this reader would leave inert, confusing dead code behind rather than a clean removal.
- The `pendingLogin` sessionStorage handoff itself (no longer written or read by anything once the above are gone)

`src/components/Authentication/VerifyEmailRegister` was independently re-checked and confirmed genuinely unrelated: it's routed to only by `src/app/[lang]/(authentication)/verify-email/[token]/page.tsx`, uses a URL-token verify-then-redirect-to-`/login` flow, and has zero references to `sessionStorage`, `pendingLogin`, `update-terms`, `VerifyOTPForm`, or `switchToVerifyOTP` — it shares only the `HttpService.client.verifyEmail` backend call, not any component/route wiring. Left untouched.

## Error Handling

- **Login failure** (wrong password, or Identity-Platform unreachable): the new endpoint surfaces both as `identityPlatformLoginFailed` (HTTP 502, same coarse-grained behavior the existing register-combo handler already has for its own follow-up login call). The frontend's existing `errorActions` fallback (`errorActions[name] || errorActions.default`) already shows "invalid password" for any unrecognized error name, which is an acceptable, honest-enough outcome for both cases without new backend work.
- **Register failure**: `emailAlreadyExists` (account already exists) and `registrationClosed` are already handled by the existing `RegisterForm` error-name switch; unrecognized errors fall through to the generic `handleApiError` path, unchanged.
- **`getMyUser()` failure after login** (network hiccup right after a successful login): `UserService.login()` catches this and falls back to existing defaults (`'th'`, `acceptedTerms: false`) rather than blocking the login — a user is still logged in even if their language/terms-acceptance state is temporarily using defaults; the next `getMyUser()`-backed page load will pick up the real values.

## Testing

- **Backend**: unit test for `IdentityPlatformLoginResponse` camelCase serialization (mirrors the existing `identity_platform_auth_response_serializes_camel_case` test already in `create_via_identity_platform.rs`). Route-level test hitting `/account/auth/login/identity-platform` against a mock/test Identity-Platform instance, covering: successful login returns a token set; empty username/password returns `IncorrectLogin`; upstream failure returns `identityPlatformLoginFailed`.
- **Frontend unit tests** (Vitest, already set up in this repo from the prior wire-event-naming stage): `isAdminClaims()` pure-function tests (empty roles, missing roles, roles containing `jobs:admin`, roles containing other values only); a `UserService` test asserting `currentLanguage`/`acceptedTerms` come from a mocked `getMyUser()` response, not from JWT claims.
- **Manual end-to-end verification** (covers the original ask's requirement (d)): run Identity-Platform-dev locally (`AUTH_HTTP_ADDR=127.0.0.1:8089 AUTH_AUDIENCE=jobs cargo run -p identity-api`), point a local api-108heros at it via the four `IDENTITY_*` env vars, run 108heros-clean against that local api-108heros, and by hand: register a new user through the redesigned `RegisterForm`, confirm redirect into an authenticated page; log out; log back in through the redesigned `LoginForm` with the same credentials; confirm an authenticated page loads (proving the previously-impossible "returning user" path now works).

## Self-Review

- **Placeholder scan**: none — every section names exact files, exact types, exact field names, and exact behavior.
- **Internal consistency**: the new backend response type name (`IdentityPlatformLoginResponse`) is used consistently between the backend section and the frontend client section; the `Claims` shape in section 3 matches the shape stated in Context; the deleted-components list in section 6 matches the "unreachable once rewired" reasoning stated there.
- **Scope check**: bounded to login + register + the auth-state plumbing they depend on (`Claims`, `UserService`, the two call sites in `proxy.ts`/`ClientOnlyGuestSection.tsx`). OAuth, token refresh, and TOTP redesign are explicitly out of scope (see Non-Goals).
- **Ambiguity check**: "reasonable outcome" for coarse-grained login errors is spelled out concretely (what error name, what the frontend shows) rather than left as a vague judgment call.
- **Independent adversarial verification**: every factual claim in this spec (backend dead-endpoint bodies, route registration, exact type signatures, client-method gaps, the full JWT-claims consumer list, and the register-deletion dependency graph) was re-checked by fresh-context agents directly against the current source in both repos, not carried over from earlier-session memory. That pass caught and this revision fixed two real gaps: `UserService.ts:173-174` was missing from the claims-consumer list (the fix for it was already designed in section 3, just undocumented in Context), and the deletion list in section 6 was missing a standalone route (`verify-otp/page.tsx`) and an orphaned component (`AcceptTermsForm`) that the first draft would have left as build breakage / dead code respectively. It also surfaced one pre-existing, out-of-scope backend doc-comment bug (noted inline in Context) that doesn't affect this design's correctness.
