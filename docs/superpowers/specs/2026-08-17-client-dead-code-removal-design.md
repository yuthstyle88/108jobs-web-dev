# Removing dead code from the 108heros-client package

## Context

`src/lib/108heros-client/` is a hand-maintained TypeScript client for the
108heros API: 267 type files, a 2512-line `http.ts` exposing 129 methods, and
a 235-line barrel `index.ts` that re-exports every type by name.

The package has drifted from the backend. Endpoints were removed from
`api-108jobs` over time without the client following, so a substantial part
of its surface points at routes that no longer exist and can only ever fail.

**32 of the client's 117 distinct endpoints — 27% — do not exist on the
backend.** That figure is measured, not estimated. Three independent passes
established it, and the disagreements between them are the reason the third
was needed:

1. **Live probe** of every client endpoint against the running API. 37
   returned 404/405.
2. **Route-table grep** against `origin/main`'s `src/api_routes.rs`. This
   disagreed with the probe in both directions — it produced false negatives
   (matching a generic trailing segment like `/list` or `/delete` that
   belongs to a different scope) and false positives.
3. **Body-discriminated probe**, which is what the numbers below come from.
   Actix returns an empty body when no route matches, and a JSON error body
   (`{"error":"notFound"}`) when a real handler declines. That distinction
   separates "this endpoint is gone" from "this id doesn't exist," and it
   rescued two endpoints the earlier passes had condemned:
   `GET /account/profile/countries` and `GET /post` are both live.

The route table also shows the backend has **no `/image`, `/oauth`,
`/oauth-providers`, `/profile`, or `/person` scope at all** — whole feature
areas the client still models.

Two findings shape the scope beyond simple deletion:

- **The 2FA/TOTP feature is non-functional.** The account-settings page
  renders a real 2FA section — an enable toggle, a secret URL, a
  verification-code field — wired to `POST /account/auth/totp/generate` and
  `/totp/update`. Neither route exists, so switching 2FA on can only 404.
  This is a live bug, not merely unused code, and it was invisible because
  nothing type-checks a client method against the server.
- **`useHttpPost`'s doc comment advertises a dead method.** Its `@example`
  block names `useHttpPost("uploadImage")`, and `POST /image` does not
  exist — so the one worked example in that hook's documentation cannot run.

## Design

### A. Remove the 32 dead client methods

Delete each method from `http.ts` along with its decorators and doc
comment. The full list, with the endpoint each targets:

| Method | Endpoint |
|---|---|
| `addModToCategory` | `POST /category/mod` |
| `authenticateWithOAuth` | `POST /oauth/authenticate` |
| `banFromCategory` | `POST /category/ban-profile` |
| `changePassword` | `PUT /account/auth/change-password` |
| `createOAuthProvider` | `POST /oauth-providers` |
| `deleteMedia` | `DELETE /account/media` |
| `deleteMediaAdmin` | `DELETE /image` |
| `deleteOAuthProvider` | `POST /oauth-providers/delete` |
| `donationDialogShown` | `POST /profile/donation-dialog-shown` |
| `editOAuthProvider` | `PUT /oauth-providers` |
| `generateTotpSecret` | `POST /account/auth/totp/generate` |
| `getCaptcha` | `GET /account/auth/get-captcha` |
| `getCategory` | `GET /category` |
| `getPersonDetails` | `GET /person` |
| `getProfile` | `GET /account/profile` |
| `getSiteMetadata` | `GET /post/site-metadata` |
| `imageHealth` | `GET /image/health` |
| `listChildrenCategories` | `GET /category/list/children` |
| `listLogins` | `GET /account/list-logins` |
| `listMedia` | `GET /account/media/list` |
| `listMediaAdmin` | `GET /image/list` |
| `passwordChangeAfterReset` | `POST /account/auth/password-change` |
| `passwordReset` | `POST /account/auth/password-reset` |
| `updateAddress` | `POST /account/update-address` |
| `updateAvailable` | `PUT /profile/available` |
| `updateContact` | `PUT /account/update-contact` |
| `updateIdentityCard` | `PUT /account/update-identity-card` |
| `updateTerm` | `POST /account/auth/update-term` |
| `updateTotp` | `POST /account/auth/totp/update` |
| `uploadImage` | `POST /image` |
| `upsertCard` | `PUT /account/upsert-card` |
| `validateAuth` | `GET /account/validate-auth` |

29 of these are referenced nowhere outside the package, so removing them
touches no application code. The other three are handled below.

**Explicitly not removed:** `POST /category` and `POST /category/delete`
also 404 against the currently-running dev API, but only because that binary
predates today's merge — both exist on `origin/main` and are called by the
admin category page. Anything that looks dead in this area must be checked
against `origin/main`, not the running server.

### B. Remove the non-functional 2FA section

`src/app/[lang]/(profile)/account-setting/manage/page.tsx` loses its TOTP
block: the `totpEnabled`/`secretUrl`/`error` state, the two `useHttpPost`
calls, the handlers, and the rendered section. The page keeps whatever else
it renders. The `accountManage.totp*` translation keys that become unused go
with it, across en/th/vi.

Removing rather than hiding matches how this codebase has treated other
non-functional affordances — the "coming soon" toast on the category page
and the disabled job-board buttons were both deleted or wired up, not left
as decoration. A toggle that 404s is worse than no toggle, because it
implies the account is protected when it isn't.

### C. Fix the hook's doc example

`useHttpPost`'s `@example` switches from `uploadImage` to a method that
still exists, so the documentation demonstrates something runnable.

### D. Remove the type files that become unreachable

Once the methods are gone, some type files are referenced by nothing. These
are **not** enumerated here on purpose. Three separate attempts to
precompute the list during design produced three different answers — the
barrel `index.ts` re-exports every type, which makes naive
"is it referenced?" checks useless; type files import each other, so removal
has to be transitive; and a regex that only matched `async` methods silently
mis-classified the eight non-`async` ones. Any list written into this spec
would be wrong.

Instead the removal is **mechanical and convergent**: repeatedly find type
files whose name appears nowhere outside their own file and the barrel,
delete them, drop their `index.ts` export lines, and repeat until a pass
finds nothing. `tsc` after each round is the safety net. The plan specifies
this loop; the implementer discovers the actual set.

### E. Delete `putTypesInIndex.js`

This generator writes its output to `src/page.tsx` — a path that does not
exist, is not the barrel it means to regenerate, and would be a stray
route-shaped file inside a library if it ever ran. `index.ts` is maintained
by hand today. The script is broken and unreferenced by any npm script.

## Out of scope

- **The remaining 85 live endpoints the app doesn't happen to call.** A
  client library legitimately exposes more surface than one consumer uses;
  those mirror real routes and will be wanted. Only endpoints the backend
  does not serve are in scope.
- **Regenerating the client from the backend.** There is no automated
  ts-rs → TypeScript pipeline across the two repos; establishing one is a
  separate project, and this cleanup does not create or preclude it.
- **`CHANGELOG.md`, `cliff.toml`, `tsoa.json`, `renovate.json`.** Packaging
  and release metadata inherited from the upstream fork. Unused here, but
  removing them is a packaging decision, not dead-code removal.
- **The four pre-existing `post_listings_*` backend test failures**, noted
  during today's earlier work and unrelated to this package.

## Testing

The package has one test file (`http.test.ts`) and the app has a 157-test
unit suite; neither covers the deleted surface, since nothing referenced it.
Verification is therefore compile- and behaviour-based:

- `npx tsc --noEmit` clean at the repo root after every task.
- The client package rebuilds (`npm run build`) — app code imports the
  package name, which resolves to `dist/`, so a stale build hides type
  errors.
- `npx eslint` clean on touched files.
- `pnpm test:unit` still 157/157.
- The account-settings page renders without the 2FA section and with no
  console errors, and its remaining controls still work.
- `grep` confirms no surviving reference to any removed method name or
  translation key anywhere in `src/`.
