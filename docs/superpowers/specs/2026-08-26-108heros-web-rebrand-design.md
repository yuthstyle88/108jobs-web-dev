# 108Heros Web Rebrand Design

## Scope

- Rename the product users read from 108jobs to **108Heros** across the web app.
- Sever the auth cookie's dependence on the brand name so the rename cannot log anyone out.
- Route every remaining hardcoded brand string through `getAppName()` so the name cannot drift again.
- Fix `getAppUrl()`'s client branch, which the rename would otherwise turn from masked to broken.

This is a name-only rebrand, matching what the Flutter client did. The logo, the
`108jobs.com` domains, the `108jobs-client` package, and the repository name are
explicitly out of scope; see *Deliberately unchanged*.

## Background

`getAppName()` in `src/utils/appConfig.ts` is already the single brand-name accessor,
read by 563 call sites in `src/translations/{en,th,vi}.ts` alone — 189, 184, and 190
respectively — and by the footer, the mobile sidebar, the privacy page, and the metadata
generators besides. The rebrand is therefore mostly a change of one value, but two
couplings make it more than that.

The first is load-bearing. `src/utils/config.ts` derives the session cookie's *name*
from the brand:

```ts
export const authCookieName = process.env.NEXT_PUBLIC_APP_NAME ?? "108jobs.com";
```

The cookie is written under that name by `setAuthJWTCookie`, and read client-side by
`getAuthJWTCookie` under that name **only** — there is no `jwt` fallback on the client.
Boot hydration runs through `UserServiceContext` as `isoData?.jwt ?? getAuthJWTCookie()`.
Renaming the brand therefore makes both the server and the client miss the existing
cookie, which leaves `authInfo` without claims, which makes `#scheduleRefresh()` return
early at `if (!claims?.exp) return`. The long-lived HttpOnly `refresh_token` cookie
survives the rename but is never redeemed, so the session does not self-heal: every
signed-in user is logged out and must re-authenticate by SMS OTP.

The deployed value of `NEXT_PUBLIC_APP_NAME` cannot be determined from the repository —
there is no Dockerfile and no workflow env, and the two committed files disagree
(`.env` says `108Jobs`, `.env.example` says `108Jobs.com`).

The second coupling is smaller. `getAppUrl()` in `appConfig.ts` returns
`NEXT_PUBLIC_APP_NAME` on its client branch where it means to return
`NEXT_PUBLIC_APP_URL`. The domain-shaped fallback masks this today; after the rename
that branch yields `"108Heros"`, which is not a URL.

## Approved behavior

### Brand name

`NEXT_PUBLIC_APP_NAME` becomes `108Heros` in both `.env` and `.env.example`, which also
settles their existing disagreement. `getAppName()`'s fallback changes from
`'108jobs.com'` to `'108Heros'` — a brand name rather than a domain, which is what every
call site was already treating it as.

### Auth cookie

`authCookieName` becomes a fixed constant that carries no product name, alongside the
set of names a browser may still be holding:

```ts
export const authCookieName = "108_auth";
export const legacyAuthCookieNames = ["108Jobs", "108Jobs.com", "108jobs.com", "108jobs"];
```

`108_auth` keeps the stable `108` ecosystem prefix and no product name, so a future
rename cannot reintroduce this failure.

Reads migrate on contact. `getAuthJWTCookie` tries the stable name, then each legacy
name in order; on a legacy hit it re-writes the token under the stable name and expires
the legacy cookie, so the migration completes on the user's next page load and never
runs twice. `clearAuthCookie` expires the stable name *and* every legacy name, so
logging out cannot strand a readable token in the browser.

Server-side, `getJwtFromRequest` and `getJwtCookieFromServer` extend their candidate
list to `[JWT, authCookieName, ...legacyAuthCookieNames]`. The existing
case-insensitive lookup in `getJwtCookieFromServer` is retained and covers casing
variants of the legacy names.

The Google OAuth callback at `src/app/api/auth/google/callback/route.ts` writes through
`authCookieName` and needs no change.

### Hardcoded copy

Twenty-eight translation strings — nine in `en.ts`, nine in `th.ts`, ten in `vi.ts` —
name the brand directly instead of interpolating it. They cover the chat quotation and
payment hints, the "Keep it on 108jobs" block, the transport-encryption notice, two
admin menu descriptions, and a form placeholder. Each becomes `${getAppName()}`; the
files already use that form for `labelProductFastwork`, so this introduces no new
pattern and removes the drift permanently.

The tenth Vietnamese string is the LINE Official Account handle in `addLineButton`,
which `en.ts` and `th.ts` already render as `@${getAppName()}`. The LINE account was
renamed alongside the product, so the handle tracks the brand and `vi.ts` is brought
into line with the other two rather than the reverse.

`src/app/[lang]/admin/dashboard/page.tsx` hardcodes the brand twice as a fallback for
the backend-supplied site name, once as `"108Jobs"` and once as `"108jobs"`. Both
become `getAppName()`.

`src/lib/metadata/translations.ts` hardcodes the domain in the `login.title` of each
language while using `getAppName()` at 68 other sites in the same file — including the
`description` directly beneath each of those titles. These are browser-tab and SEO
titles, so they are user-visible, and they follow the brand like their siblings.

### Strings that must not be touched

Two identifiers contain the old brand, fail silently when changed, and are covered by no
test in this repository. Both are called out in the implementation plan's global
constraints.

`KDF_INFO` in `src/modules/chat/utils/security/crypto.ts` is an HKDF `info` parameter
pinned identically in `api-108jobs` (`CHAT_SESSION_KDF_INFO`) and in `108jobs-flutter`
(`_kdfInfo`). Changing it derives a different key, so every chat message fails to
decrypt across all three clients.

`REMEMBERED_IDENTIFIER_KEY` in `src/services/IdentityPasskeyService.ts` is a
`localStorage` key; renaming it silently forgets every user's remembered passkey
identifier.

Alongside these, the Web Locks name in `UserService`, the server filesystem path in
`env.ts`, the `support@108jobs.com` mailto in the footer, and the profile URL prefix in
`BasicInformation` all stay, on the same reasoning as the domains. Code comments naming
`api-108jobs` and `108jobs-flutter` refer to sibling repositories that are not being
renamed.

### Legal copy

The privacy and consent text interpolates `getAppName()` at three keys per language and
at four call sites in `src/app/[lang]/content/privacy/page.tsx`, so it follows the brand
automatically and will read 108Heros. The policy's links and its
`communication@108jobs.com` contact address stay as they are, because they are live
endpoints. A product name that differs from the operating domain is normal and
self-consistent; this remains worth a glance from counsel, but it is not a code concern.

### getAppUrl

`getAppUrl()`'s client branch in `appConfig.ts` returns `NEXT_PUBLIC_APP_URL`, matching
its server branch and the already-correct implementation in `src/utils/env.ts`. Because
this is a pre-existing defect rather than part of the rebrand, it follows the repository's
standing rule: a GitHub issue is opened first — searched across both `108-Plaza/*` and
the `yuthstyle88/*-dev` mirror, including closed issues — and the pull request carries
`Fixes #N`.

## Deliberately unchanged

| Kept | Reason |
| --- | --- |
| `logo.svg`, favicon, apple-touch icon | The Flutter rebrand kept a byte-identical logo, and the header logo is admin-swappable at runtime through the site icon. |
| `108jobs.com` and its subdomains; `communication@108jobs.com` | Live endpoints. The store listings and the passkey association file pin the domain. |
| `108jobs-client` and its imports; the `Api108Jobs` class | Technical identifiers, not brand surface. |
| Repository name `108jobs-clean` | Technical. |
| Backend `site.name` | Runtime data, editable from the admin UI. Setting it to 108Heros is an operational step, not a code change. |

## Verification

- New unit tests cover the cookie migration: a legacy cookie is read successfully, is
  re-written under the stable name, and is expired; a stable cookie is read without
  consulting the legacy names; neither present yields null; and `clearAuthCookie`
  expires the stable name and every legacy name.
- `src/app/api/media/[assetId]/route.test.ts` already builds its request from
  `authCookieName` and follows the constant.
- A grep gate confirms no user-visible `108jobs` remains outside the deliberately
  unchanged surfaces above.
- Lint, unit tests, and a production build all pass. The `108jobs-client` sub-package is
  built before install, per the ordering this repository is known to require.

## Risks

The deployed `NEXT_PUBLIC_APP_NAME` is unknown, so the legacy list is drawn from the
four plausible values. If production holds a value outside that list, users on that
environment are logged out once and re-authenticate by SMS OTP. Confirming the deployed
value and adding it to `legacyAuthCookieNames` eliminates the risk entirely; the list is
the single place that would change.
