# Identity-Platform Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a working login round trip and a working register round trip for 108heros-clean against api-108heros's Identity-Platform-only auth, by adding the one missing backend endpoint and rebuilding the frontend's client methods, `Claims`/`UserService`, and `LoginForm`/`RegisterForm` around what the backend actually does today.

**Architecture:** One new Actix route in api-108heros (`POST /account/auth/login/identity-platform`) exposes the already-implemented `login_with_identity_platform()` standalone. The frontend's generated-style API client (`108heros-client`) gets two new methods and loses one dead one. `UserService`'s `Claims` type is rewritten to the real JWT shape; profile fields that no longer live on the token (`email`/`interfaceLanguage`/`acceptedTerms`) are sourced from the existing `getMyUser()` call instead. `LoginForm` and `RegisterForm` are rewired to the new client methods; the register form gains username/password fields and the now-fully-unreachable OTP-verify/terms-accept flow is deleted.

**Tech Stack:** Rust/Actix-web (api-108heros), Next.js/React/TypeScript with react-hook-form + zod (108heros-clean), Vitest (frontend unit tests, already set up from the prior wire-event-naming stage).

**Design doc:** `docs/superpowers/specs/2026-07-05-identity-platform-auth-design.md` (108heros-clean). Read it first for the full investigation and rationale — this plan implements it with two small, mechanical deviations discovered during planning (both noted in Global Constraints below).

## Global Constraints

- New backend route: `POST /account/auth/login/identity-platform`, registered in `src/api_routes.rs`'s existing `scope("/account/auth")` block, wrapped in `rate_limit.login()` (the same limiter the dead `/login` route already uses).
- Reuse the existing `LoginRequest` type (`username_or_email`, `password`, `totp_2fa_token` — the last accepted but ignored) for the new route's request body. No new request type for login.
- New response type name, exact casing: Rust `IdentityPlatformLoginResponse { access_token: String, refresh_token: String, expires_in: i64 }` (serde `rename_all = "camelCase"`) / TypeScript `IdentityPlatformLoginResponse { accessToken: string; refreshToken: string; expiresIn: number }`.
- New register request type, exact casing: TypeScript `RegisterIdentityPlatform { username: string; email: string; password: string; selfPromotion?: boolean; honeypot?: string }`, mapped to Rust's existing `RegisterRequest` (only the fields `register_with_identity_platform_handler` actually reads).
- Admin role check everywhere in the frontend: `Array.isArray(claims?.roles) && claims.roles.includes("jobs:admin")` — the exact string `"jobs:admin"`, factored into one shared constant/helper (`isAdminClaims` in `UserService.ts`), not duplicated as a literal at each call site.
- **Deviation from the design spec, #1:** the spec proposed adding `ts-rs` derive/export annotations to the new and existing Identity-Platform response structs on the Rust side. `crates/http/Cargo.toml` has no `ts-rs` optional dependency/feature at all (confirmed: `grep -c ts-rs crates/http/Cargo.toml` returns nothing), unlike `crates/db_views/site` which does. Wiring up a new cross-crate feature for two structs is out of scope for this fix and not needed — the frontend types are hand-authored regardless (no automated sync pipeline exists between the repos, confirmed in the design doc). This plan adds the new Rust struct with the same plain `Debug, Serialize, Clone` derives `IdentityPlatformAuthResponse` already has, and does **not** touch `crates/http/Cargo.toml` or add any `ts-rs` attributes anywhere.
- **Deviation from the design spec, #2:** the spec's Testing section proposed a route-level test hitting the new endpoint against a mock Identity-Platform instance. `create_via_identity_platform.rs`'s own test module explicitly documents that no HTTP test-double exists anywhere in this codebase for the Identity-Platform client, and its tests are scoped to pure/parsing logic only. This plan follows that same, already-established pattern: the new endpoint's automated tests cover response serialization and empty-credential rejection (pure logic, no network); the full round trip (real login succeeding, real login failing) is covered only by this plan's final manual end-to-end verification task, exactly as it already is for the sibling register-combo handler.
- Every deleted frontend file in Task 7, and every call site touched by the `UserService.login()` signature change in Task 3, was checked by an adversarial verification pass against the live source *after* this plan's first draft — that pass found and this revision fixed two real gaps (a missed OAuth-callback call site, and an over-broad deletion that would have broken the unrelated forgot-password flow). See the note at the end of this document for the full verification record.
- Existing test commands: backend `cargo test -p app_108heros_http` / `cargo test -p app_108heros_api_utils`; frontend `npm run test:unit` (Vitest, from `108heros-clean`).

---

## Task 1: Backend — new Identity-Platform login endpoint

**Files:**
- Create: `crates/http/src/crud/user/login_via_identity_platform.rs`
- Modify: `crates/http/src/crud/user/mod.rs:1-4`
- Modify: `src/api_routes.rs:68-73` (import block), `src/api_routes.rs:352-356` (route registration)
- Test: inline `#[cfg(test)] mod tests` in the new file (matches the sibling `create_via_identity_platform.rs` pattern)

**Interfaces:**
- Consumes: `app_108heros_api_utils::identity_platform::{identity_platform_base_url, login_with_identity_platform}` (both already exist, unchanged by this task — `identity_platform_base_url(settings: &Settings) -> FastJobResult<String>`, `login_with_identity_platform(context: &FastJobContext, base_url: &str, identifier: &str, password: &str) -> FastJobResult<IdentityPlatformTokenSet>`); `app_108heros_db_views_site::api::LoginRequest` (existing, fields `username_or_email: Option<SensitiveString>`, `password: Option<SensitiveString>`, `totp_2fa_token: Option<String>`); `FastJobErrorType::IncorrectLogin` (existing, maps to HTTP 401).
- Produces: `pub struct IdentityPlatformLoginResponse { access_token, refresh_token, expires_in }` and `pub async fn login_with_identity_platform_handler(...)` — both consumed only by `src/api_routes.rs`'s route registration; no other task in this plan touches Rust code.

- [ ] **Step 1: Write the new handler file with its own unit tests**

Create `crates/http/src/crud/user/login_via_identity_platform.rs`:

```rust
use actix_web::web::{Data, Json};
use app_108heros_api_utils::{
  context::FastJobContext,
  identity_platform::{identity_platform_base_url, login_with_identity_platform},
};
use app_108heros_core::error::{FastJobErrorType, FastJobResult};
use app_108heros_db_views_site::api::LoginRequest;
use serde::Serialize;
use serde_with::skip_serializing_none;

/// Response for a successful Identity-Platform-backed login. Deliberately
/// separate from `IdentityPlatformAuthResponse` (the register-combo response,
/// which also carries `registrationCreated`) -- a pure login has nothing
/// meaningful to report there.
#[skip_serializing_none]
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdentityPlatformLoginResponse {
  pub access_token: String,
  pub refresh_token: String,
  pub expires_in: i64,
}

/// Logs an already-registered user in against Identity-Platform. Unlike
/// `register_with_identity_platform_handler`, this never creates any local or
/// remote account -- it only exchanges credentials for a fresh token pair.
/// `totp_2fa_token` on `LoginRequest` is accepted (so existing frontend
/// callers don't need to omit it) but ignored: Identity-Platform has its own
/// login flow with no local TOTP concept to check here.
pub async fn login_with_identity_platform_handler(
  data: Json<LoginRequest>,
  context: Data<FastJobContext>,
) -> FastJobResult<Json<IdentityPlatformLoginResponse>> {
  let data = data.into_inner();

  let identifier = data
    .username_or_email
    .map(|s| s.into_inner())
    .filter(|s| !s.is_empty())
    .ok_or(FastJobErrorType::IncorrectLogin)?;
  let password = data
    .password
    .map(|s| s.into_inner())
    .filter(|s| !s.is_empty())
    .ok_or(FastJobErrorType::IncorrectLogin)?;

  let base_url = identity_platform_base_url(context.settings())?;
  let tokens = login_with_identity_platform(&context, &base_url, &identifier, &password).await?;

  Ok(Json(IdentityPlatformLoginResponse {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  }))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn identity_platform_login_response_serializes_camel_case() {
    let response = IdentityPlatformLoginResponse {
      access_token: "abc".to_string(),
      refresh_token: "def".to_string(),
      expires_in: 3600,
    };
    let json = serde_json::to_value(&response).unwrap();
    assert_eq!(
      json,
      serde_json::json!({
        "accessToken": "abc",
        "refreshToken": "def",
        "expiresIn": 3600,
      })
    );
  }
}
```

- [ ] **Step 2: Run the new test to verify it passes**

Run: `cargo test -p app_108heros_http login_via_identity_platform`
Expected: `identity_platform_login_response_serializes_camel_case ... ok` (1 passed; the handler function itself has no unit test — it's a thin composition of two already-tested functions, exercised end-to-end only in Task 8's manual verification, matching this codebase's established pattern for this style of handler).

- [ ] **Step 3: Wire the module into `crates/http/src/crud/user/mod.rs`**

Current content (lines 1-4):
```rust
pub mod create;
pub mod create_via_identity_platform;
pub mod delete;
pub mod my_user;
```

New content:
```rust
pub mod create;
pub mod create_via_identity_platform;
pub mod delete;
pub mod login_via_identity_platform;
pub mod my_user;
```

- [ ] **Step 4: Register the route in `src/api_routes.rs`**

In the import block (around line 68-73), current:
```rust
    user::{
      create::{authenticate_with_oauth, register},
      create_via_identity_platform::register_with_identity_platform_handler,
      delete::delete_account,
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
    },
```

In the `/account/auth` scope (around line 340-356), current:
```rust
        .service(
          scope("/account/auth")
            .service(
              resource("/register")
                .wrap(rate_limit.register())
                .route(post().to(register)),
            )
            .service(
              resource("/register/identity-platform")
                .wrap(rate_limit.register())
                .route(post().to(register_with_identity_platform_handler)),
            )
            .service(
              resource("/login")
                .wrap(rate_limit.login())
                .route(post().to(login)),
            )
```

New (adds one `.service(...)` block after `/login`'s):
```rust
        .service(
          scope("/account/auth")
            .service(
              resource("/register")
                .wrap(rate_limit.register())
                .route(post().to(register)),
            )
            .service(
              resource("/register/identity-platform")
                .wrap(rate_limit.register())
                .route(post().to(register_with_identity_platform_handler)),
            )
            .service(
              resource("/login")
                .wrap(rate_limit.login())
                .route(post().to(login)),
            )
            .service(
              resource("/login/identity-platform")
                .wrap(rate_limit.login())
                .route(post().to(login_with_identity_platform_handler)),
            )
```

- [ ] **Step 5: Confirm the workspace still builds**

Run: `cargo check -p app_108heros_http` (checks the new handler file itself compiles — `serde_with` is confirmed a direct dependency of this crate, `crates/http/Cargo.toml:51`, so no dependency changes are needed) and `cargo check -p app_108heros_api_server` (checks `src/api_routes.rs`'s route-registration edit compiles — this is the actual binary crate; there is no `[[bin]]` override anywhere in the workspace, so the binary target name equals the root package name, confirmed via the root `Cargo.toml`'s `[package] name = "app_108heros_api_server"` and `src/main.rs`'s `pub async fn main()`. `crates/http` itself has no binary target — running `--bin` against it is not a valid command).
Expected: no errors from either command.

- [ ] **Step 6: Commit**

```bash
git add crates/http/src/crud/user/login_via_identity_platform.rs crates/http/src/crud/user/mod.rs src/api_routes.rs
git commit -m "feat(auth): add standalone Identity-Platform login endpoint

login_with_identity_platform() already existed but was only ever called
internally by the register-combo handler, immediately after a fresh
registration -- there was no way for an already-registered user to log
back in. Exposes it as POST /account/auth/login/identity-platform,
reusing the existing LoginRequest shape."
```

---

## Task 2: Frontend client — new types and methods (108heros-clean)

**Files:**
- Create: `src/lib/108heros-client/src/types/IdentityPlatformLoginResponse.ts`
- Create: `src/lib/108heros-client/src/types/IdentityPlatformAuthResponse.ts`
- Create: `src/lib/108heros-client/src/types/RegisterIdentityPlatform.ts`
- Modify: `src/lib/108heros-client/src/http.ts` (remove `login()`, add `loginWithIdentityPlatform()` and `registerWithIdentityPlatform()`)
- Modify: `src/lib/108heros-client/src/index.ts` (export the three new types)
- Test: `src/lib/108heros-client/src/http.test.ts` (new — this package currently has no tests of its own; a minimal one is added here since this task changes its public surface)

**Interfaces:**
- Consumes: the existing `Login` type (`src/lib/108heros-client/src/types/Login.ts`, unchanged: `{usernameOrEmail, password, totp2faToken?}`), the existing `#wrapper`/`RequestOptions`/decorator pattern already used by every other method in `http.ts`.
- Produces: `Api108Heros.loginWithIdentityPlatform(form: Login, options?: RequestOptions): Promise<IdentityPlatformLoginResponse>`, `Api108Heros.registerWithIdentityPlatform(form: RegisterIdentityPlatform, options?: RequestOptions): Promise<IdentityPlatformAuthResponse>` — both consumed by Task 5 (`LoginForm`) and Task 6 (`RegisterForm`) respectively. `IdentityPlatformLoginResponse`/`IdentityPlatformAuthResponse`/`RegisterIdentityPlatform` types, consumed by Tasks 3, 5, 6.

- [ ] **Step 1: Write the failing test**

Create `src/lib/108heros-client/src/http.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { Api108Heros } from "./http";

describe("Api108Heros identity-platform methods", () => {
  it("exposes loginWithIdentityPlatform and registerWithIdentityPlatform, and no longer exposes login", () => {
    const client = new Api108Heros("http://localhost:8536");
    expect(typeof client.loginWithIdentityPlatform).toBe("function");
    expect(typeof client.registerWithIdentityPlatform).toBe("function");
    expect((client as unknown as Record<string, unknown>).login).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- http.test.ts`
Expected: FAIL — `loginWithIdentityPlatform`/`registerWithIdentityPlatform` are `undefined` (methods don't exist yet).

- [ ] **Step 3: Add the three new type files**

Create `src/lib/108heros-client/src/types/IdentityPlatformLoginResponse.ts`:

```typescript
export type IdentityPlatformLoginResponse = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};
```

Create `src/lib/108heros-client/src/types/IdentityPlatformAuthResponse.ts`:

```typescript
export type IdentityPlatformAuthResponse = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    registrationCreated: boolean;
};
```

Create `src/lib/108heros-client/src/types/RegisterIdentityPlatform.ts`:

```typescript
export type RegisterIdentityPlatform = {
    username: string;
    email: string;
    password: string;
    selfPromotion?: boolean;
    honeypot?: string;
};
```

- [ ] **Step 4: Remove the dead `login()` method and add the two new methods in `http.ts`**

Find and delete the existing method (lines 941-953 as of this plan's investigation — confirm exact line numbers before editing, since Task 1-style edits elsewhere in this same file during other work could shift them):

```typescript
    /**
     * @summary Log in.
     */
    @Post("/account/auth/login")
    @Tags("Account")
    async login(@Body() form: Login, @Inject() options?: RequestOptions) {
        return this.#wrapper<Login, LoginResponse>(
            HttpType.Post,
            "/account/auth/login",
            form,
            options,
        );
    }
```

Replace with:

```typescript
    /**
     * @summary Log in via Identity-Platform.
     */
    @Post("/account/auth/login/identity-platform")
    @Tags("Account")
    async loginWithIdentityPlatform(@Body() form: Login, @Inject() options?: RequestOptions) {
        return this.#wrapper<Login, IdentityPlatformLoginResponse>(
            HttpType.Post,
            "/account/auth/login/identity-platform",
            form,
            options,
        );
    }

    /**
     * @summary Register (and immediately log in) via Identity-Platform.
     */
    @Post("/account/auth/register/identity-platform")
    @Tags("Account")
    async registerWithIdentityPlatform(
        @Body() form: RegisterIdentityPlatform,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RegisterIdentityPlatform, IdentityPlatformAuthResponse>(
            HttpType.Post,
            "/account/auth/register/identity-platform",
            form,
            options,
        );
    }
```

Add the three new type imports to the existing alphabetized import block at the top of `http.ts` (alongside the other `import type {X} from "./types/X";` lines):

```typescript
import type {IdentityPlatformAuthResponse} from "./types/IdentityPlatformAuthResponse";
import type {IdentityPlatformLoginResponse} from "./types/IdentityPlatformLoginResponse";
import type {RegisterIdentityPlatform} from "./types/RegisterIdentityPlatform";
```

If `Login`'s import becomes unused elsewhere in the file after `login()` is removed, keep it — `Login` is still the request type for `loginWithIdentityPlatform`. If `LoginResponse`'s import becomes unused (check with a repo-wide grep: `grep -rn "LoginResponse" src --include="*.ts" --include="*.tsx" | grep -v dist`), remove the now-dead import, but only after confirming Task 5 (`LoginForm`) has also stopped referencing it — do this check again at the end of Task 5 instead if any ambiguity remains, rather than guessing here.

- [ ] **Step 5: Export the new types from `index.ts`**

Add three lines to `src/lib/108heros-client/src/index.ts`, alongside the existing `export type {X} from "./types/X";` block (alphabetical position, matching the file's existing convention):

```typescript
export type {IdentityPlatformAuthResponse} from "./types/IdentityPlatformAuthResponse";
export type {IdentityPlatformLoginResponse} from "./types/IdentityPlatformLoginResponse";
export type {RegisterIdentityPlatform} from "./types/RegisterIdentityPlatform";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- http.test.ts`
Expected: PASS.

- [ ] **Step 7: Confirm the package and its consumer still type-check**

Run: `npx tsc --noEmit` (from `108heros-clean`'s root — this will surface any other file still calling the now-deleted `client.login(...)`; per the design doc, the only two call sites are both in `LoginForm/handlers.ts`, addressed in Task 5, so expect type errors there until Task 5 lands — that's expected at this point in the plan, not a regression).

- [ ] **Step 8: Commit**

```bash
git add src/lib/108heros-client/src/types/IdentityPlatformLoginResponse.ts src/lib/108heros-client/src/types/IdentityPlatformAuthResponse.ts src/lib/108heros-client/src/types/RegisterIdentityPlatform.ts src/lib/108heros-client/src/http.ts src/lib/108heros-client/src/http.test.ts src/lib/108heros-client/src/index.ts
git commit -m "feat(client): add Identity-Platform login/register client methods

Removes the login() method (only ever posted to the now-dead
/account/auth/login) and adds loginWithIdentityPlatform() /
registerWithIdentityPlatform(), matching the two working backend
endpoints. LoginForm/RegisterForm are rewired in later commits."
```

---

## Task 3: `UserService`/`Claims` redesign

**Files:**
- Modify: `src/services/UserService.ts`
- Modify: `src/app/[lang]/api/auth/callback/[provider]/page.tsx:126` (OAuth callback — a third caller of `UserService.Instance.login()` missed in this plan's first draft; caught by adversarial verification before execution)
- Test: `src/services/UserService.test.ts` (new)

**Interfaces:**
- Consumes: `HttpService.client.getMyUser()` (existing, confirmed by direct trace through `WrappedApiClient` and `#addTimeoutToMethods` to resolve to exactly `{state: "success", data: MyUserInfo}` on success — matching the `REQUEST_STATE`/`isSuccess` helpers already used throughout the app, e.g. in `RegisterForm`; no double-nesting, no surprises from either wrapping layer).
- Produces: `export interface Claims { sub, iss, aud, exp, iat, roles: string[], realm, platform, tenant_id }`, `export const JOBS_ADMIN_ROLE = "jobs:admin"`, `export function isAdminClaims(claims?: Claims): boolean` — all three consumed by Task 4 (`ClientOnlyGuestSection.tsx` does NOT need `isAdminClaims`, only `isLoggedIn`, already present) and Task 5 (`LoginForm/handlers.ts` needs `isAdminClaims` and the new `Claims` shape). `UserService.Instance.login(accessToken: string): Promise<void>` — signature changes from `{res: LoginResponse | string, showToast?}` to a plain access-token string plus optional `showToast`; consumed by Task 5 and Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/services/UserService.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { isAdminClaims, JOBS_ADMIN_ROLE } from "./UserService";

describe("isAdminClaims", () => {
  it("returns false for undefined claims", () => {
    expect(isAdminClaims(undefined)).toBe(false);
  });

  it("returns false when roles is missing", () => {
    expect(isAdminClaims({ sub: "1", iss: "auth-service", aud: "jobs", exp: 0, iat: 0, realm: "r", platform: "p", tenant_id: "t" } as any)).toBe(false);
  });

  it("returns false when roles doesn't include jobs:admin", () => {
    expect(isAdminClaims({ roles: ["jobs:user"] } as any)).toBe(false);
  });

  it("returns true when roles includes jobs:admin", () => {
    expect(isAdminClaims({ roles: ["jobs:user", JOBS_ADMIN_ROLE] } as any)).toBe(true);
  });
});
```

(A second describe block for `UserService`'s language/accepted-terms sourcing from `getMyUser()` is added in Step 3 below, after the implementation exists to import against — write it now as a skeleton so this step's failure output is meaningful, or combine into one commit; either is fine, but the test file must compile, so add both describe blocks in this step and expect BOTH to fail for the reasons stated in Step 2.)

Add to the same file:

```typescript
import { UserService } from "./UserService";
import { HttpService } from "./HttpService";

describe("UserService profile hydration", () => {
  it("sources currentLanguage and acceptedTerms from getMyUser(), not from JWT claims", async () => {
    vi.spyOn(HttpService, "client", "get").mockReturnValue({
      getMyUser: vi.fn().mockResolvedValue({
        state: "success",
        data: {
          localUserView: {
            localUser: { interfaceLanguage: "en", acceptedTerms: true },
          },
        },
      }),
    } as any);

    await UserService.Instance.login("not-a-real-jwt");

    expect(UserService.Instance.getLanguage).toBe("en");
    expect(UserService.Instance.getAcceptedTerms).toBe(true);
  });
});
```

This is the only test in the file that touches `UserService.Instance` (the `isAdminClaims` tests above are pure functions and never construct it), so the singleton's lazy, one-time construction within this test file needs no explicit reset — there's nothing for a second test to collide with. If a later change adds a second test that also touches `UserService.Instance`, add a guarded `resetForTests()` static method to `UserService` at that point (JS private `#` fields are never reachable via bracket notation like `obj["#instance"]` — that silently creates an unrelated plain string-keyed property instead of touching the real private field, so that specific approach must not be used) — not needed for this task as written.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- UserService.test.ts`
Expected: FAIL — `isAdminClaims`/`JOBS_ADMIN_ROLE` are not exported yet; the second describe block fails because `UserService.Instance.login` doesn't accept a bare string yet and doesn't call `getMyUser()`.

- [ ] **Step 3: Rewrite `Claims` and `#setAuthInfo` in `UserService.ts`**

Replace the current `Claims` interface (lines 8-17):

```typescript
export interface Claims {
    acceptedTerms: boolean;
    isAdmin: boolean;
    sub: number;
    iss: string;
    iat: number;
    email: string;
    role: string;
    lang: string;
}
```

With:

```typescript
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
```

Replace `#setAuthInfo` (current, lines 169-180):

```typescript
    #setAuthInfo(jwt?: string) {
        try {
            const claims = jwtDecode<Claims>(jwt ?? "");
            this.authInfo = { auth: jwt, claims };
            this.currentLanguage = claims?.lang;
            this.acceptedTerms = Boolean(claims?.acceptedTerms);
        } catch {
            this.authInfo = { jwt } as AuthInfo;
            this.currentLanguage = this.currentLanguage || 'th';
            this.acceptedTerms = false;
        }
    }
```

With (stops reading `lang`/`acceptedTerms` off the token — those fields don't exist on it anymore; only decodes what's real: `sub`/`roles`/etc. for identity purposes):

```typescript
    #setAuthInfo(jwt?: string) {
        try {
            const claims = jwtDecode<Claims>(jwt ?? "");
            this.authInfo = { auth: jwt, claims };
        } catch {
            this.authInfo = { jwt } as AuthInfo;
        }
    }
```

- [ ] **Step 4: Add profile hydration via `getMyUser()` and rewrite `login()`**

Add the import at the top of the file:

```typescript
import { HttpService, isSuccess } from "./HttpService";
```

(`isSuccess` may already need to come from `@/services/HttpService` per this file's existing import conventions — check whether `HttpService.ts` is imported elsewhere in this same file already; it currently isn't, since `UserService.ts` calls `HttpService.client.logout()` inside its own `logout()` method already — confirm the existing import at the top of the file and extend it rather than adding a duplicate.)

Replace the current `login()` method (lines 53-90):

```typescript
    public async login({
        res,
        showToast = false,
    }: {
        res: LoginResponse | string;
        showToast?: boolean;
    }): Promise<void> {
        if (isBrowser() && typeof res !== "string" && res.jwt) {
            if (showToast) {
                toast("loggedIn");
            }
            // 1) Client-side cookie (kept for immediate client state)
            setAuthJWTCookie(res.jwt);
            this.#setAuthInfo(res.jwt);
            this.#hydrateReadLastMap();

            // 2) Server-side cookie (so Next.js middleware sees it on the very next request)
            //    This expects a Next.js Route Handler at /api/session that sets HttpOnly cookies via Set-Cookie.
            //    Important: credentials: 'include' so the browser stores the cookie for this origin.
            try {
                await fetch('/api/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ jwt: res.jwt })
                });
            } catch (e) {
                console.warn('[UserService.login] Failed to POST /api/session', e);
            }

            // Give the browser a tiny moment to flush Set-Cookie I/O (helps Safari after OAuth/login)
            await new Promise<void>(r => setTimeout(r, 60));

            // 3) Language cookie (non-HttpOnly for client-side reads)
            if (!VALID_LANGUAGES.includes(this.currentLanguage)) return;
            setLangCookie(this.currentLanguage);
        }
    }
```

With:

```typescript
    public async login(accessToken: string, showToast = false): Promise<void> {
        if (!isBrowser() || !accessToken) return;

        if (showToast) {
            toast("loggedIn");
        }
        // 1) Client-side cookie (kept for immediate client state)
        setAuthJWTCookie(accessToken);
        this.#setAuthInfo(accessToken);
        this.#hydrateReadLastMap();

        // 2) Server-side cookie (so Next.js middleware sees it on the very next request)
        //    This expects a Next.js Route Handler at /api/session that sets HttpOnly cookies via Set-Cookie.
        //    Important: credentials: 'include' so the browser stores the cookie for this origin.
        try {
            await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ jwt: accessToken })
            });
        } catch (e) {
            console.warn('[UserService.login] Failed to POST /api/session', e);
        }

        // Give the browser a tiny moment to flush Set-Cookie I/O (helps Safari after OAuth/login)
        await new Promise<void>(r => setTimeout(r, 60));

        // 3) Profile fields (language, accepted-terms) no longer live on the JWT --
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

Remove the now-unused `LoginResponse` import from the top of the file if nothing else in `UserService.ts` references it (check with a search within the file itself first).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- UserService.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full unit suite to check for regressions**

Run: `npm run test:unit`
Expected: all tests pass (the wire-event-naming stage's 22 tests, plus this task's new ones). If any test elsewhere constructs a `Claims` object with the old shape, fix it here — that's this task's blast radius, not a separate task.

- [ ] **Step 7: Fix the OAuth callback page's call to the old `login()` signature**

Adversarial verification (before this task was executed) found a third caller of `UserService.Instance.login()` this plan's first draft missed: `src/app/[lang]/api/auth/callback/[provider]/page.tsx:123-128`. Its `handleLoginSuccess` helper currently reads:

```typescript
async function handleLoginSuccess(loginData: LoginResponse, prev?: string) {
  try {
    // Ensure login side-effects (cookies, session) complete before navigation (Safari-sensitive)
    await UserService.Instance.login({
      res: loginData,
    });
```

Change the call to match the new signature:

```typescript
async function handleLoginSuccess(loginData: LoginResponse, prev?: string) {
  try {
    // Ensure login side-effects (cookies, session) complete before navigation (Safari-sensitive)
    await UserService.Instance.login(loginData.jwt ?? "");
```

No other change to this file. This page calls `HttpService.client.authenticateWithOAuth(...)` (a different, existing client method this plan does not touch), which maps to api-108heros's `authenticate_with_oauth` handler — confirmed during this plan's investigation to also unconditionally return `LocalLoginDisabled` (retired alongside local login/register). OAuth sign-in is therefore already non-functional today, independent of this plan (see the design doc's Non-Goals) — this step exists only to keep this file compiling against `UserService.login()`'s new signature, not to fix or further break OAuth, which stays explicitly out of scope.

- [ ] **Step 8: Type-check to confirm the fix**

Run: `npx tsc --noEmit`
Expected: no errors referencing `UserService.Instance.login`. (Some errors may remain from `LoginForm`/`RegisterForm` if Tasks 5/6 haven't landed yet in execution order — expected at this point, not a regression from this task.)

- [ ] **Step 9: Commit**

```bash
git add src/services/UserService.ts src/services/UserService.test.ts "src/app/[lang]/api/auth/callback/[provider]/page.tsx"
git commit -m "refactor(auth): make Claims match the real Identity-Platform JWT

Claims previously modeled a shape (email/role/lang/isAdmin/acceptedTerms)
that never existed on a real Identity-Platform token. isAdmin is now
derived from the token's real roles[] array via isAdminClaims(). Profile
fields that were never really on the token (language, accepted-terms)
now come from getMyUser() instead, populating the previously-unused
myUserInfo field.

Also fixes the OAuth callback page's call to UserService.login()'s new
signature -- that flow is already non-functional server-side (OAuth
login/register is retired, out of scope for this fix) but the file must
still compile."
```

---

## Task 4: `proxy.ts` and `ClientOnlyGuestSection.tsx` — small call-site fixes

**Files:**
- Modify: `src/proxy.ts:31`
- Modify: `src/components/Header/components/ClientOnlyGuestSection.tsx:25-26`

**Interfaces:**
- Consumes: `UserService.Instance.isLoggedIn` (existing getter, unchanged).
- Produces: nothing new; these are leaf call sites.

- [ ] **Step 1: Fix `proxy.ts`'s admin check**

Current (line 31, inside the `try` block starting at line 28):
```typescript
        isAdmin = Boolean(claims?.isAdmin);
```

New:
```typescript
        isAdmin = Array.isArray(claims?.roles) && claims.roles.includes("jobs:admin");
```

No change needed to line 30 (`jwtLang = typeof claims?.lang === 'string' ? claims.lang : undefined;`) — it already degrades safely to `undefined` on a real token with no `lang` claim, and `resolveLanguage`'s existing fallback chain already handles that.

- [ ] **Step 2: Fix `ClientOnlyGuestSection.tsx`'s guest check**

Current (lines 25-26):
```typescript
    const role = UserService.Instance.authInfo?.claims?.role || "Guest";
    const isGuest = role === "Guest";
```

New:
```typescript
    const isGuest = !UserService.Instance.isLoggedIn;
```

- [ ] **Step 3: Manual check**

Run the dev server (`npm run dev`), load any page as a logged-out visitor, confirm the guest header section (job-board link, sign-in link, language dropdown) still renders. This isn't unit-testable without a browser/DOM harness this project doesn't have for this component (`ClientOnlyGuestSection` reads `window`-dependent client state directly) — a manual check is the appropriate verification here.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/components/Header/components/ClientOnlyGuestSection.tsx
git commit -m "fix(auth): read admin/guest status via roles[] and isLoggedIn

Both call sites were still reading fields (claims.isAdmin, claims.role)
that don't exist on a real Identity-Platform JWT. proxy.ts's admin gate
now checks roles[] directly (still synchronous, no extra request);
ClientOnlyGuestSection uses the already-correct isLoggedIn getter that
was simply never wired up here."
```

---

## Task 5: `LoginForm` rewiring

**Files:**
- Modify: `src/components/Authentication/LoginForm/handlers.ts`
- Modify: `src/components/Authentication/LoginForm/index.tsx`
- Modify: `src/components/Authentication/LoginForm/interface.ts`

**Interfaces:**
- Consumes: `HttpService.client.loginWithIdentityPlatform` (Task 2), `Claims`/`isAdminClaims` (Task 3), `UserService.Instance.login(accessToken, showToast?)` (Task 3).
- Produces: nothing consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Rewrite `interface.ts`'s `State.loginRes` type**

Current (line 26):
```typescript
  loginRes: RequestState<LoginResponse>;
```

New:
```typescript
  loginRes: RequestState<IdentityPlatformLoginResponse>;
```

Update the import at the top of `interface.ts` (currently `import {GetSiteResponse, LoginResponse, PublicOAuthProvider,} from "108heros-client";`) to:
```typescript
import {GetSiteResponse, IdentityPlatformLoginResponse, PublicOAuthProvider,} from "108heros-client";
```

Remove `totp2faToken` from `LoginFormProps.formState`/`setFormState` and `State.form` (lines 9-19, 27-31) — the 2FA modal is being removed in Step 3 below, so this field is no longer read or written. New `State.form`:
```typescript
  form: {
    usernameOrEmail: string;
    password: string;
  };
```
(Apply the same trim to `LoginFormProps.formState`'s matching shape at the top of the file.)

- [ ] **Step 2: Rewrite `handlers.ts`**

Update the import at the top (currently `import {LoginResponse, OAuthProvider,} from "108heros-client";`):
```typescript
import {IdentityPlatformLoginResponse, OAuthProvider,} from "108heros-client";
```
Add: `import {isAdminClaims, Claims} from "@/services/UserService";` (the file already imports `Claims` from there — confirm and extend rather than duplicate).

Replace `handleLogin` (current lines 49-111) — same control flow, new client method, no TOTP branch:

```typescript
export const handleLogin = async (i: LoginFormClass, data: any) => {
    const {usernameOrEmail, password} = data;
    i.setState(prev => ({
        form: {
            ...prev.form,
            usernameOrEmail,
            password,
        }
    }));
    try {
        const loginRes = await HttpService.client.loginWithIdentityPlatform({
            usernameOrEmail,
            password,
        });

        switch (loginRes.state) {
            case REQUEST_STATE.FAILED: {
                const {name} = loginRes.err ?? {};
                const {formMethods, t} = i.props;

                const errorActions: Record<string, () => void> = {
                    userNotFound: () =>
                        formMethods.setError("usernameOrEmail", {
                            type: "manual",
                            message: t("authen.userNotFound"),
                        }),
                    siteBan: () =>
                        formMethods.setError("usernameOrEmail", {
                            type: "manual",
                            message: t("authen.siteBan"),
                        }),
                    default: () =>
                        formMethods.setError("password", {
                            type: "manual",
                            message: t("error.invalidPassword"),
                        }),
                };

                (errorActions[name ?? "default"] || errorActions.default)();
                i.setState({loginRes});
                break;
            }

            case REQUEST_STATE.SUCCESS: {
                await handleLoginSuccess(i, loginRes.data);
                break;
            }

            default:
                break;
        }

    } catch (error) {
        console.error(error);
        i.props.formMethods.setError("root",
            {
                type: "manual",
                message: i.props.t("systemError"),
            });
    }
};
```

(`missingTotpToken`'s `errorActions` entry is removed — the new endpoint never produces that error name, since Identity-Platform login has no local TOTP concept; any unrecognized error name still falls through to `errorActions.default`, showing "invalid password", which is the accepted, already-documented behavior for the new endpoint's coarse-grained `identityPlatformLoginFailed` error per the design doc.)

Replace `handleLoginSuccess` (current lines 113-142):

```typescript
export async function handleLoginSuccess(i: LoginFormClass, loginRes: IdentityPlatformLoginResponse) {
    await UserService.Instance.login(loginRes.accessToken);
    const claims = jwtDecode<Claims>(loginRes.accessToken);
    if (isAdminClaims(claims)) {
        window.location.replace("/admin/dashboard");
        return;
    }
    // Redirect immediately after login so the new cookie is seen by server/middleware
    const target = i.props.redirectUrl ?? "/";
    if (isBrowser()) {
        window.location.replace(target); // replace to avoid going back to login page
        return; // stop executing below logic on client
    }

    // (Optional, non-blocking on server) Best-effort site refresh
    try {
        const site = await HttpService.client.getSite();
        if (isSuccess(site)) {
            const isoData = setIsoData(i.context);
            if (isoData && isoData.siteRes) {
                isoData.siteRes.oauthProviders = site.data.oauthProviders;
                isoData.siteRes.adminOauthProviders = site.data.adminOauthProviders;
            }
        }
    } catch (error) {
        console.error("Error updating isoData:", error);
    }
}
```

Delete `handleSubmitTotp` and `getLoginQueryParams`'s neighbor — no, keep `getLoginQueryParams` (unrelated, still used for `?prev=` parsing). Delete only `handleSubmitTotp` (current lines 144-170) in full, since Step 3 removes its only caller.

- [ ] **Step 3: Remove the 2FA modal from `index.tsx`**

Remove the import `import TotpModal from "@/components/Common/Modal/TotpModal";` and `handleSubmitTotp` from the `handlers` import (current line 11: `import {handleLogin, handleSubmitTotp, handleUseOAuthProvider} from "@/components/Authentication/LoginForm/handlers";` becomes `import {handleLogin, handleUseOAuthProvider} from "@/components/Authentication/LoginForm/handlers";`).

Remove `show2faModal: false` from the initial `state` object (current line 88).

Remove the entire `{this.state.show2faModal && (...)}` block (current lines 158-181), leaving `render()`'s returned JSX starting directly with the `<form>` element:

```typescript
    render() {
        const {switchToRegister, switchToForgotPassword, t, formMethods} = this.props;
        const {showPassword, oauthProviders} = this.state;
        const {register, handleSubmit, formState: {errors, isSubmitting}} = formMethods;

        return (
            <div>
                <form onSubmit={handleSubmit((data: any) => handleLogin(this,
                    data))} className="space-y-5">
```

(The rest of `render()`'s returned JSX — the input fields, submit button, register/forgot-password links, OAuth buttons — is unchanged from the current file; only the `show2faModal` block above it and the imports/state noted above are removed.)

- [ ] **Step 4: Update `State` interface's `show2faModal` field**

In `interface.ts`, remove `show2faModal: boolean;` from the `State` interface (it's no longer set or read anywhere after Step 3).

- [ ] **Step 5: Type-check and run the unit suite**

Run: `npx tsc --noEmit`
Expected: no errors referencing `LoginForm`, `handlers.ts`, or `interface.ts`. If `TotpModal`'s component file (`src/components/Common/Modal/TotpModal`) is now unused anywhere else in the app (check with `grep -rn "TotpModal" src --include="*.tsx" --include="*.ts" | grep -v dist`), leave it in place — deleting a shared UI component that might be used elsewhere is out of scope for this task; only remove the import/usage that this task made dead.

Run: `npm run test:unit`
Expected: all tests pass (no existing test in this repo currently covers `LoginForm`'s handlers directly, per this plan's investigation — this step is a regression check, not a new-test check).

- [ ] **Step 6: Manual smoke test (partial — full round trip happens in Task 8)**

Run the dev server, navigate to `/login`, confirm the form renders with no console errors and the 2FA modal code path is gone (no visual regression on the base form). Submitting against a real backend is covered by Task 8, once Task 6 (register) also exists, so a brand-new test account is available to log back in with.

- [ ] **Step 7: Commit**

```bash
git add src/components/Authentication/LoginForm/handlers.ts src/components/Authentication/LoginForm/index.tsx src/components/Authentication/LoginForm/interface.ts
git commit -m "fix(auth): rewire LoginForm to the Identity-Platform login endpoint

handleLogin/handleLoginSuccess now call loginWithIdentityPlatform() and
handle its {accessToken, refreshToken, expiresIn} shape. The TOTP modal
is removed -- the new endpoint has no local-TOTP error to trigger it,
so it was becoming permanently dead UI."
```

---

## Task 6: `RegisterForm` redesign

**Files:**
- Modify: `src/components/Authentication/RegisterForm/index.tsx`

**Interfaces:**
- Consumes: `HttpService.client.registerWithIdentityPlatform` (Task 2), `UserService.Instance.login` (Task 3), `handleLoginSuccess`-equivalent redirect logic (mirrors Task 5's, duplicated inline rather than shared, since `RegisterForm` doesn't have a `LoginFormClass` instance to pass — see Step 2 below for the exact shape).
- Produces: nothing consumed by later tasks except that Task 7's deletions assume this task has already removed the `switchToVerifyOTP` call path.

- [ ] **Step 1: Rewrite the form schema to collect username/email/password**

Current (lines 18-21):
```typescript
const createRegisterSchema = (t: any) => z
    .object({
        email: z.string().email(t("authen.invalidEmail")),
    });
```

New:
```typescript
const createRegisterSchema = (t: any) => z
    .object({
        username: z.string().min(3, t("authen.usernameMin3")).max(32, t("authen.usernameMax32")),
        email: z.string().email(t("authen.invalidEmail")),
        password: z.string().min(6, t("authen.passwordMin6")),
        passwordVerify: z.string().min(6, t("authen.passwordMin6")),
    })
    .refine((data) => data.password === data.passwordVerify, {
        message: t("authen.passwordMismatch"),
        path: ["passwordVerify"],
    });
```

(`t("authen.usernameMin3")`/`t("authen.passwordMismatch")` — check `src/locales` (or wherever this project's i18n strings live, per `useTranslation`'s existing setup) for whether these translation keys already exist from other forms reusing similar copy; if not, add them alongside the existing `authen.*` keys used elsewhere in this same file, in every locale file this project maintains — do not leave a raw key string rendered to users in only some languages.)

- [ ] **Step 2: Rewrite `onSubmit`**

Current (lines 69-97):
```typescript
    const onSubmit = useCallback(async (data: any) => {

            const registerRes = await HttpService.client.register({
                email: data.email,
                answer: getAppName(),
            });
            switch (registerRes.state) {
                case REQUEST_STATE.FAILED: {
                    const errName = registerRes.err?.name ?? "unknownError";
                    if (errName === "requireVerification" && switchToVerifyOTP) {
                        switchToVerifyOTP({email: data.email});
                    } else if (errName === "emailAlreadyExists") {
                        window.location.href = `/login?email-already-exists&redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(data.email)}`;
                    } else {
                        handleApiError(t(`authen.${errName}`));
                    }
                    break;
                }
                case REQUEST_STATE.SUCCESS: {
                    if (registerRes.data.verifyEmailSent) {
                        if (switchToVerifyOTP) {
                            switchToVerifyOTP({email: data.email});
                        }
                    }
                }
                    break;
            }
        },
        [switchToVerifyOTP, redirectUrl, handleApiError, t]);
```

New:
```typescript
    const onSubmit = useCallback(async (data: any) => {
            const registerRes = await HttpService.client.registerWithIdentityPlatform({
                username: data.username,
                email: data.email,
                password: data.password,
                selfPromotion: false,
            });
            switch (registerRes.state) {
                case REQUEST_STATE.FAILED: {
                    const errName = registerRes.err?.name ?? "unknownError";
                    if (errName === "emailAlreadyExists") {
                        window.location.href = `/login?email-already-exists&redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(data.email)}`;
                    } else {
                        handleApiError(t(`authen.${errName}`));
                    }
                    break;
                }
                case REQUEST_STATE.SUCCESS: {
                    await UserService.Instance.login(registerRes.data.accessToken);
                    const claims = jwtDecode<Claims>(registerRes.data.accessToken);
                    if (isAdminClaims(claims)) {
                        window.location.href = "/admin/dashboard";
                        break;
                    }
                    window.location.href = redirectUrl;
                    break;
                }
            }
        },
        [redirectUrl, handleApiError, t]);
```

Add the new imports needed: `import {UserService} from "@/services";` (or extend the existing `HttpService` import's neighbor if `UserService` is already imported elsewhere in this file — it currently isn't), `import {jwtDecode} from "jwt-decode";`, `import {isAdminClaims, Claims} from "@/services/UserService";`.

Remove the now-dead import `import {getAppName} from "@/utils/appConfig";` (line 14) — confirmed its only usage in this file was the `answer: getAppName()` line inside the old `register()` call being replaced above; `handleLoginWithProvider`/`handleUseOAuthProvider` (the only other function in this file) does not call it.

Remove the now-unused `RegisterFormProps.switchToVerifyOTP` prop (and its usage in Step 1's schema/`onSubmit`) — the prop type at the top of the file:
```typescript
interface RegisterFormProps {
    setApiError?: (err: string) => void;
    switchToVerifyOTP?: (data: { email: string }) => void;
}
```
becomes:
```typescript
interface RegisterFormProps {
    setApiError?: (err: string) => void;
}
```
and the destructured prop `switchToVerifyOTP` is removed from the component's function signature (current line 28-31).

- [ ] **Step 3: Add the username/password fields to the form JSX**

Current JSX (lines 110-117) has only the email `CustomInput`. Add username before it and password/password-confirm after it, matching this file's existing `CustomInput` usage pattern (same props shape as `LoginForm`'s password field, for the show/hide toggle):

```typescript
            <CustomInput
                label={t("authen.labelUsername")}
                type="text"
                name={"username"}
                placeholder={t("authen.placeholderUsername")}
                register={register("username")}
                error={errors.username?.message}
            />

            <CustomInput
                label={t("authen.labelEmail")}
                type="email"
                name={"email"}
                placeholder={t("authen.placeholderEmail")}
                register={register("email")}
                error={errors.email?.message}
            />

            <CustomInput
                label={t("authen.labelPassword")}
                type="password"
                name={"password"}
                placeholder={t("authen.placeholderPassword")}
                register={register("password")}
                error={errors.password?.message}
            />

            <CustomInput
                label={t("authen.labelPasswordVerify")}
                type="password"
                name={"passwordVerify"}
                placeholder={t("authen.placeholderPasswordVerify")}
                register={register("passwordVerify")}
                error={errors.passwordVerify?.message}
            />
```

(`labelUsername`/`placeholderUsername`/`labelPasswordVerify`/`placeholderPasswordVerify` — same i18n-key caveat as Step 1: `labelPassword`/`placeholderPassword` already exist, reused from `LoginForm`'s usage; add the two new keys to every locale file if missing.)

- [ ] **Step 4: Fix the two pre-existing cosmetic bugs in this file while touching it**

This file has two small, unrelated pre-existing bugs directly in the code this task is rewriting — fix them now since leaving them would mean shipping a change that touches these exact lines while knowingly leaving visible junk text in place:
- Line 45's stray double-backtick after `setApiErrorState(err);` inside the `handleApiError` callback (`}``,` — a harmless but nonsensical empty template-literal expression statement) — remove the stray `` `` ``.
- Line 107's `{errors.root.message}sss` — remove the trailing `sss`.

- [ ] **Step 5: Type-check and manual smoke test**

Run: `npx tsc --noEmit`
Expected: no errors in `RegisterForm`.

Run the dev server, navigate to `/register`, fill in username/email/password/password-confirm with a valid-looking new account, submit. Without a running local Identity-Platform + api-108heros (set up in Task 8), this call will fail against whatever backend the dev server is pointed at — confirm at minimum that a network request now actually fires (visible in the browser's network tab) and that a mismatched password-confirm shows a validation error before any request fires. The full successful-registration path is verified in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/components/Authentication/RegisterForm/index.tsx
git commit -m "feat(auth): redesign RegisterForm around the Identity-Platform register endpoint

Collects username/email/password (the endpoint requires all three) instead
of email-only. On success, treats the response exactly like a login --
store tokens, redirect into the app -- since the backend's register-combo
endpoint already logs the caller in immediately, with no OTP step and no
terms gate (both are dead server-side; see the design doc)."
```

---

## Task 7: Delete the now-fully-unreachable OTP/terms chain

**Files:**
- Delete: `src/components/Authentication/VerifyOTP/index.tsx`
- Delete: `src/app/[lang]/(authentication)/verify-otp/page.tsx`
- Delete: `src/app/[lang]/(authentication)/verify-otp/layout.tsx`
- Delete: `src/app/[lang]/update-terms/page.tsx`
- Delete: `src/app/[lang]/update-terms/layout.tsx`
- Delete: `src/components/Authentication/AcceptTermsForm/index.tsx`
- Modify: `src/app/[lang]/(authentication)/register/page.tsx`

**`src/types/register-data.ts` is explicitly NOT deleted** — this plan's first draft included it, but adversarial verification found `RegisterDataProps` (defined there) is also imported by four files completely outside this plan's scope, part of the unrelated forgot-password/reset-password flow: `src/app/[lang]/(authentication)/login/page.tsx`, `src/app/[lang]/(authentication)/password-management/page.tsx`, `src/components/Authentication/ForgotPasswordForm/index.tsx`, `src/components/Authentication/VerifyForgotPassword/index.tsx`. Deleting the type file would break compilation in all four. Only `register/page.tsx`'s own import of it is removed in Step 2 below (that page no longer needs it once simplified) — the type file itself, and every other consumer, is left untouched.

**Interfaces:**
- Consumes: nothing (Task 6 already removed the only live caller of `switchToVerifyOTP`).
- Produces: nothing — this is a pure deletion/cleanup task, final task before manual verification.

- [ ] **Step 1: Delete the five files**

```bash
git rm src/components/Authentication/VerifyOTP/index.tsx
git rm "src/app/[lang]/(authentication)/verify-otp/page.tsx"
git rm "src/app/[lang]/(authentication)/verify-otp/layout.tsx"
git rm "src/app/[lang]/update-terms/page.tsx"
git rm "src/app/[lang]/update-terms/layout.tsx"
git rm src/components/Authentication/AcceptTermsForm/index.tsx
```

(`src/types/register-data.ts` is deliberately excluded — see the note above.)

(If either `verify-otp` or `update-terms` directory becomes empty after these removals, `git rm` will leave no trace of the directory automatically — no further action needed.)

- [ ] **Step 2: Simplify `register/page.tsx`**

Current file has `type ViewState = "register" | "verify-otp" | "resend-otp";`, a `dataDataRegister`/`RegisterDataProps` state slot, and conditionally renders `VerifyOTPForm` for the `"verify-otp"` view. Since Task 6 already made `RegisterForm` handle success by redirecting directly (no `switchToVerifyOTP` call), this page's view-switching is now permanently single-state. Simplify to:

```typescript
"use client";
import {AuthFormContainer} from "@/components/Authentication/AuthFormContainer";

import {RegisterForm} from "@/components/Authentication/RegisterForm";
import {AuthenticateIcon} from "@/constants/icons";
import {CategoriesImage} from "@/constants/images";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {useTranslation} from "react-i18next";

export default function RegisterPage() {
    const {t} = useTranslation();
    const route = useRouter();
    const [apiError, setApiError] = useState<string | null>(null);

    return (
        <div
            className="min-h-screen bg-[#E3EDFD] grid 2xl:grid-cols-[1fr_1240px_1fr] lg:grid-cols-[1fr_984px_1fr] md:grid-cols-[1fr_768px_1fr] grid-cols-[12px_minmax(0,auto)12px]">
            <div
                className="flex justify-center items-center lg:flex-row lg:gap-[3rem] lg:justify-between col-start-2 col-end-3">
                <div className="hidden lg:flex m-auto flex-col gap-[5rem]">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-row items-center">
                            <h2 className="text-[2.5rem] text-[hsl(215,15%,20%,0.95)]">
                                {t("authen.titleHireThrough")}
                            </h2>
                            <Image src={CategoriesImage.logodefault} alt="logo"/>
                        </div>
                        <div className="flex gap-2 flex-row items-center">
                            <h2 className="text-[2.5rem] text-[hsl(215,15%,20%,0.95)]">
                                {t("authen.subtitleSafeMoney")}
                            </h2>
                        </div>
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage1}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelGuaranteedPay")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage2}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelProfessionalLicense")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage3}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelRefundPolicy")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage4}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelHiringAdvice")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage5}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelFreelancerVerified")}
              </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 justify-center items-center py-[4rem] max-w-[500px] w-full h-full ">
                    <Image
                        className="lg:hidden block"
                        src={CategoriesImage.logodefault}
                        alt="logo"
                    />
                    <AuthFormContainer
                        title={t("authen.titleCreateAccount")}
                        onBack={() => route.push("/login")}
                    >
                        <RegisterForm setApiError={setApiError}/>
                    </AuthFormContainer>
                </div>
            </div>
        </div>
    );
}
```

This is the current file's decorative left column (advantages list, logo) reproduced verbatim — untouched by this task's actual change, which is removing the `verify-otp`/`resend-otp` `ViewState` branching and the `dataDataRegister`/`RegisterDataProps` state slot.

- [ ] **Step 3: Type-check and run the unit suite**

Run: `npx tsc --noEmit`
Expected: no errors. This should also surface any remaining reference to the deleted files/types if this task's grep-based pre-verification (done during planning) missed anything — if it does, that's a real finding to fix here, not a sign the plan was wrong to proceed.

Run: `npm run test:unit`
Expected: all tests pass, no test references any deleted file (confirmed during planning that none do).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(auth): delete the dead OTP-verify/terms-accept flow

VerifyOTPForm, its standalone /verify-otp route, the /update-terms page,
and AcceptTermsForm all depended on a registration architecture that's
fully retired server-side (verify-email's precondition is never created
by the Identity-Platform register path, and update-term unconditionally
410s). Nothing in the app reaches any of them after RegisterForm's
redesign in the prior commit.

src/types/register-data.ts is kept -- it's also used by the unrelated
forgot-password/reset-password flow (login/page.tsx,
password-management/page.tsx, ForgotPasswordForm, VerifyForgotPassword);
only register/page.tsx's own now-unneeded import of it is removed."
```

---

## Task 8: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run Identity-Platform-dev locally**

From the `Identity-Platform-dev` repo:
```bash
AUTH_HTTP_ADDR=127.0.0.1:8089 AUTH_AUDIENCE=jobs cargo run -p identity-api
```

- [ ] **Step 2: Point a local api-108heros at it**

Set the four env vars (or the equivalent `config.hjson` `identity` section, now that PR #133 added file-based config support) before starting api-108heros:
```bash
IDENTITY_BASE_URL=http://127.0.0.1:8089
IDENTITY_JWKS_URL=http://127.0.0.1:8089/.well-known/jwks.json
IDENTITY_AUDIENCE=jobs
IDENTITY_ISSUER=auth-service
```
Start api-108heros against a fresh/migrated local Postgres, per this repo's normal local-dev instructions (see its own README/CONTRIBUTING for exact DB setup — not repeated here since it's unrelated to this plan).

- [ ] **Step 3: Run 108heros-clean against that local backend**

Set 108heros-clean's API base URL env var to point at the local api-108heros instance (check `src/utils/env.ts`'s `getHttpBase()` for the exact env var name this repo uses). Run `npm run dev`.

- [ ] **Step 4: Register a brand-new user through the redesigned `RegisterForm`**

Navigate to `/register`, fill in a new username/email/password, submit. Confirm: a network request to `/account/auth/register/identity-platform` fires and returns 200; the browser redirects into an authenticated page (not back to `/register` or `/login`); a follow-up authenticated request (e.g. whatever the landing page fetches via `getMyUser()`/`getSite()`) succeeds, confirming the stored token is actually accepted by `SessionMiddleware`.

- [ ] **Step 5: Log out, then log back in through the redesigned `LoginForm`**

Trigger logout (existing `UserService.logout()` flow, unchanged by this plan). Navigate to `/login`, enter the same username/password just registered, submit. Confirm: a network request to `/account/auth/login/identity-platform` fires and returns 200 with a fresh token pair; the browser redirects into an authenticated page; the same follow-up authenticated request succeeds.

This step is the one this whole plan exists to make possible — before Task 1, there was no backend route this step could even hit.

- [ ] **Step 6: Confirm the admin path still works**

Using the RBAC-grant walkthrough from `api-108heros/docs/identity-platform-setup.md` (grant `jobs:admin` directly against the local Identity-Platform instance, then log back in through `LoginForm`), confirm the post-login redirect goes to `/admin/dashboard` and that `/admin/*` routes are reachable (proxy.ts's roles-based gate from Task 4 passes).

- [ ] **Step 7: Report results**

If every step above passes, this plan's goal is met — both round trips work against a real Identity-Platform-backed stack. If any step fails, treat it as a bug in this plan's implementation (not a new design question) and fix the specific task responsible before considering the plan complete.

---

## Verification record

This plan was checked against the live source of both repos twice: once after the first draft (a 4-way adversarial pass covering the `getMyUser()`/`isSuccess` return-shape mechanics, `RegisterForm`'s exact current content and `getAppName` usage, api-108heros's crate dependencies/module wiring/binary target, and a full blast-radius sweep of every call site touched by the `UserService.login()` signature change and every deletion in Task 7).

Confirmed correct as originally written: the `getMyUser()` wrapping chain resolves to exactly `{state: "success", data: MyUserInfo}` with no double-nesting; `RegisterForm`'s cited line numbers, the stray-backtick and `sss` bugs, and `getAppName`'s single usage; `serde_with` as a direct dependency of `crates/http`; the exact current content of `crates/http/src/crud/user/mod.rs` and the relevant `src/api_routes.rs` line ranges; `FastJobErrorType::IncorrectLogin`'s declaration and 401 mapping; and that `HttpService.client.register(...)` (the dead call `RegisterForm` currently makes) has exactly one caller in the whole app.

Found and fixed: Task 1's proposed `cargo check -p app_108heros_http --bin app_108heros` was wrong — `crates/http` has no `[[bin]]` target at all (it's a library crate); the real binary is the root package `app_108heros_api_server`. Task 3 was missing a third caller of `UserService.Instance.login()` — the OAuth callback page (`src/app/[lang]/api/auth/callback/[provider]/page.tsx`) — which would have failed to compile against the new signature; a fix step was added there. Task 7's deletion list originally included `src/types/register-data.ts`, which is also used by four files in the unrelated forgot-password/reset-password flow; the deletion was narrowed to leave that file in place.
