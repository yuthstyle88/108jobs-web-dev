# 108Heros Web Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product users read from 108jobs to 108Heros across the web app, without logging anyone out.

**Architecture:** The brand name already flows from one accessor, `getAppName()`. The
work is therefore to remove the two things that bypass or abuse it — the auth cookie
that derives its *name* from the brand, and 28 translation strings that hardcode the
brand — and only then flip the value. Tasks are ordered so every commit is safe to
deploy on its own: Tasks 1–3 are behaviour-preserving, and Task 4 is the single atomic
change that makes 108Heros visible.

**Tech Stack:** Next.js 16 (App Router), TypeScript, vitest (+ jsdom for DOM tests),
pnpm, ESLint.

## Global Constraints

- Brand name is exactly `108Heros` — one `e`, capital `H`, no space. Never "108Heroes", "108 Heros", "108HEROS".
- Never rename: `108jobs.com` and its subdomains, `communication@108jobs.com`, the `108jobs-client` package or its imports, the `Api108Jobs` class, the repository name, `logo.svg`, the favicon, or the apple-touch icon.
- **Never touch these two strings. Both fail silently and neither is caught by any test in this repository:**
  - `KDF_INFO = "108jobs chat session key v1"` in `src/modules/chat/utils/security/crypto.ts:68`. It is an HKDF `info` parameter pinned identically in `api-108jobs` (`CHAT_SESSION_KDF_INFO`, `crates/infra/src/crypto.rs`) and in `108jobs-flutter` (`_kdfInfo`). Changing it derives a different key, so every chat message fails to decrypt across all three clients.
  - `REMEMBERED_IDENTIFIER_KEY = "108jobs.passkeyIdentifier"` in `src/services/IdentityPasskeyService.ts:22`. It is a `localStorage` key; renaming it silently forgets every user's remembered passkey identifier.
- Code comments that mention `api-108jobs` or `108jobs-flutter` name **sibling repositories**, which are not being renamed. Leave them exactly as they are.
- The stable auth cookie name is exactly `108_auth`. The legacy list is exactly `["108Jobs", "108Jobs.com", "108jobs.com", "108jobs"]`.
- `.env` is gitignored — edit it for local dev, never commit it. `.env.example` is tracked and must be committed.
- Unit tests run with `pnpm test:unit`. `pnpm test` is Playwright, not unit tests.
- DOM-touching test files must start with the line `// @vitest-environment jsdom` — the vitest default environment is `node`.
- Work stays on branch `feat/108heros-rebrand`. One branch, one PR at the end; do not merge task by task.

---

### Task 1: Decouple the auth cookie from the brand name

The cookie is written under `authCookieName` and read client-side under that name only.
Because `authCookieName` is derived from `NEXT_PUBLIC_APP_NAME`, renaming the brand
would orphan every existing session — and it would not self-heal, since a session with
no claims never schedules the refresh that would redeem the surviving `refresh_token`
cookie. This task must land before Task 4.

**Files:**
- Modify: `src/utils/config.ts:19`
- Modify: `src/utils/browser.ts:26-32` (`clearAuthCookie`), `src/utils/browser.ts:136-146` (`getAuthJWTCookie`)
- Modify: `src/utils/helper-server.ts:14-24` (`getJwtFromRequest`), `src/utils/helper-server.ts:79-83` (candidate list)
- Test: `src/utils/browser.test.ts` (create)

**Interfaces:**
- Produces: `authCookieName: "108_auth"` and `legacyAuthCookieNames: readonly string[]`, both exported from `@/utils/config`. Later tasks and tests import both from there.
- Produces: `getAuthJWTCookie(): string | null` — unchanged signature, new migrating behaviour.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `src/utils/browser.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { authCookieName, legacyAuthCookieNames } from "@/utils/config";
import { clearAuthCookie, getAuthJWTCookie, setAuthJWTCookie } from "@/utils/browser";

function wipeAuthCookies() {
  for (const name of [authCookieName, ...legacyAuthCookieNames]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

describe("auth cookie", () => {
  afterEach(wipeAuthCookies);

  it("is named independently of the product name", () => {
    expect(authCookieName).toBe("108_auth");
  });

  it("reads a token written under the stable name", () => {
    setAuthJWTCookie("stable-token");
    expect(getAuthJWTCookie()).toBe("stable-token");
  });

  it("returns null when no auth cookie is present", () => {
    expect(getAuthJWTCookie()).toBeNull();
  });

  it.each([...legacyAuthCookieNames])("adopts a token held under the legacy name %s", (legacy) => {
    document.cookie = `${legacy}=legacy-token; path=/`;

    expect(getAuthJWTCookie()).toBe("legacy-token");
    expect(document.cookie).toContain(`${authCookieName}=legacy-token`);
    expect(document.cookie).not.toContain(`${legacy}=legacy-token`);
  });

  it("prefers the stable cookie and leaves a legacy cookie untouched", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;
    setAuthJWTCookie("stable-token");

    expect(getAuthJWTCookie()).toBe("stable-token");
    expect(document.cookie).toContain("108Jobs=legacy-token");
  });

  it("clears the stable name and every legacy name on logout", () => {
    document.cookie = `108Jobs=legacy-token; path=/`;
    setAuthJWTCookie("stable-token");

    clearAuthCookie();

    expect(document.cookie).not.toContain("stable-token");
    expect(document.cookie).not.toContain("legacy-token");
    expect(getAuthJWTCookie()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test:unit src/utils/browser.test.ts
```

Expected: FAIL. `legacyAuthCookieNames` is not exported from `@/utils/config`, so the import fails to resolve.

- [ ] **Step 3: Define the stable and legacy cookie names**

In `src/utils/config.ts`, replace line 19:

```ts
export const authCookieName =  process.env.NEXT_PUBLIC_APP_NAME ?? "108jobs.com" ;
```

with:

```ts
/**
 * Name of the cookie holding the access token.
 *
 * Fixed and brand-independent on purpose. This used to be derived from
 * NEXT_PUBLIC_APP_NAME, which meant renaming the product renamed the cookie and
 * logged every signed-in user out -- and it did not self-heal, because a session
 * with no claims never schedules the refresh that would redeem the surviving
 * refresh_token cookie.
 */
export const authCookieName = "108_auth";

/**
 * Cookie names a browser may still hold from before the decoupling above.
 * The deployed NEXT_PUBLIC_APP_NAME was not knowable from the repository, so this
 * covers every plausible value it held. Reads migrate these on contact; add to this
 * list if an environment turns out to have used something else.
 */
export const legacyAuthCookieNames = [
  "108Jobs",
  "108Jobs.com",
  "108jobs.com",
  "108jobs",
] as const;
```

- [ ] **Step 4: Migrate legacy cookies on read, and clear them on logout**

In `src/utils/browser.ts`, change the import on line 1:

```ts
import {authCookieName, legacyAuthCookieNames} from "@/utils/config";
```

Replace `clearAuthCookie` (lines 26-32) with:

```ts
export function clearAuthCookie() {
  for (const name of [authCookieName, ...legacyAuthCookieNames]) {
    document.cookie = serializeCookie(name, "", {
      maxAge: -1,
      sameSite: "lax",
      path: "/",
    });
  }
}
```

Replace `getAuthJWTCookie` (lines 136-146) with:

```ts
function readRawCookie(name: string): string | null {
  const prefix = `${name}=`;
  const parts = (document.cookie || "").split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

export function getAuthJWTCookie(): string | null {
  if (!isBrowser()) return null;

  const current = readRawCookie(authCookieName);
  if (current) return current;

  // Adopt a token written before the cookie was decoupled from the product name,
  // then retire the old cookie so this runs at most once per browser.
  for (const legacy of legacyAuthCookieNames) {
    const token = readRawCookie(legacy);
    if (!token) continue;
    setAuthJWTCookie(token);
    document.cookie = serializeCookie(legacy, "", {
      maxAge: -1,
      sameSite: "lax",
      path: "/",
    });
    return token;
  }

  return null;
}
```

`setAuthJWTCookie` is declared later in the file; function declarations hoist, so calling it here is fine.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test:unit src/utils/browser.test.ts
```

Expected: PASS, 9 tests (the `it.each` contributes 4).

- [ ] **Step 6: Accept legacy names server-side too**

In `src/utils/helper-server.ts`, change the import on line 3:

```ts
import {authCookieName, JWT, legacyAuthCookieNames} from "@/utils/config";
```

Replace the body of `getJwtFromRequest` (lines 14-24) with:

```ts
export function getJwtFromRequest(req: NextRequest): string | null {
  // อ่าน cookie โดยตรงจาก NextRequest
  let raw: string | null = null;
  for (const name of [JWT, authCookieName, ...legacyAuthCookieNames]) {
    const value = req.cookies.get(name)?.value;
    if (value) {
      raw = value;
      break;
    }
  }

  if (!raw) return null;

  let token = raw;
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();
  return token || null;
}
```

Replace the candidate list (lines 79-83) with:

```ts
    // Candidate cookie names, in priority order
    const candidates = [
      JWT,
      authCookieName,
      ...legacyAuthCookieNames,
    ].filter(Boolean) as string[];
```

The existing case-insensitive lookup below it is unchanged and now also covers casing
variants of the legacy names.

- [ ] **Step 7: Run the full unit suite**

```bash
pnpm test:unit
```

Expected: PASS. Pay attention to `src/app/api/media/[assetId]/route.test.ts`, which
builds its request from `authCookieName` and should follow the new constant unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/utils/config.ts src/utils/browser.ts src/utils/helper-server.ts src/utils/browser.test.ts
git commit -m "fix(auth): decouple the session cookie name from the product name

The cookie was named after NEXT_PUBLIC_APP_NAME, so renaming the product
renamed the cookie and logged every signed-in user out. It did not self-heal:
a session with no claims never schedules the refresh that would redeem the
surviving refresh_token cookie.

Pin the cookie to 108_auth and adopt legacy-named cookies on read, retiring
each one as it is adopted. Logout now clears every name, so no readable token
is stranded in the browser."
```

---

### Task 2: Fix getAppUrl's client branch

`getAppUrl()` returns `NEXT_PUBLIC_APP_NAME` where it means `NEXT_PUBLIC_APP_URL`. The
domain-shaped fallback masks this today; after Task 4 that branch would yield
`"108Heros"`, which is not a URL. It feeds OG image URLs in `src/lib/metadata/translations.ts`.

This is a pre-existing defect, so the repository's standing rule applies: open the issue
before writing the fix.

**Files:**
- Modify: `src/utils/appConfig.ts:13-20`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `getAppUrl(): string` — unchanged signature, corrected client branch.

- [ ] **Step 1: Search for an existing issue in both repos, including closed ones**

CLAUDE.md's "search both repos" rule assumes the `108-Plaza/<name>` + `yuthstyle88/<name>-dev` mirror pattern. That pattern does not apply to this repository: `yuthstyle88/108jobs-clean` is the only copy that exists — the `108-Plaza` org holds four unrelated repos and no `108jobs-clean`, and a global search finds no other variant. One search is therefore the complete search.

```bash
gh issue list --repo yuthstyle88/108jobs-clean --state all --search "getAppUrl app name url"
```

If it returns a matching issue, reuse its number and skip Step 2.

- [ ] **Step 2: Open the issue in the repo the PR will merge into**

```bash
gh issue create --repo yuthstyle88/108jobs-clean --label bug \
  --title "getAppUrl() returns the app name instead of the app URL in the browser" \
  --body 'src/utils/appConfig.ts:19 returns `process.env.NEXT_PUBLIC_APP_NAME` on the client branch where it means `NEXT_PUBLIC_APP_URL`:

```ts
export function getAppUrl(): string {
  if (!isBrowser()) {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://108jobs.com";
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || "http://108jobs.com";
}
```

The defect is masked while `NEXT_PUBLIC_APP_NAME` happens to be domain-shaped (`108Jobs.com`). It feeds `src/lib/metadata/translations.ts:35,115,192`, which concatenate it into OG image URLs.

A correct implementation already exists at `src/utils/env.ts:58`.'
```

Record the issue number it prints; the PR body carries `Fixes #N`.

- [ ] **Step 3: Fix the branch**

In `src/utils/appConfig.ts`, replace lines 13-20:

```ts
export function getAppUrl(): string {
  // On the server we can read APP_NAME; on the client we must rely on NEXT_PUBLIC_APP_NAME
  if (!isBrowser()) {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || 'http://108jobs.com';
}
```

with:

```ts
export function getAppUrl(): string {
  // On the server we can read APP_URL; on the client we must rely on NEXT_PUBLIC_APP_URL
  if (!isBrowser()) {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_URL || 'http://108jobs.com';
}
```

- [ ] **Step 4: Verify nothing regressed**

```bash
pnpm test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

Substitute the real issue number for `N`.

```bash
git add src/utils/appConfig.ts
git commit -m "fix(config): return the app URL, not the app name, from getAppUrl on the client

The client branch read NEXT_PUBLIC_APP_NAME. A domain-shaped app name masked
this; a real brand name would not.

Refs #N"
```

---

### Task 3: Route the remaining hardcoded brand copy through getAppName()

28 translation strings, 3 metadata page titles, and 2 component literals name the brand
directly instead of interpolating it. Fixing them before the value flips keeps Task 4
atomic and leaves this task with no visible effect — `getAppName()` still returns the old
name at this point.

**Files:**
- Modify: `src/translations/en.ts` lines 57, 58, 65, 66, 3597, 3598, 3761, 3762, 3979
- Modify: `src/translations/th.ts` lines 57, 58, 65, 66, 3511, 3512, 3675, 3676, 3893
- Modify: `src/translations/vi.ts` lines 57, 58, 65, 66, 2774, 3621, 3622, 3785, 3786, 4003
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:24` and `:106`
- Modify: `src/lib/metadata/translations.ts` lines 80, 158, 236

**Interfaces:**
- Consumes: `getAppName()` from `@/utils/appConfig`, already imported in all three translation files and in `src/lib/metadata/translations.ts`.
- Produces: no new symbols.

- [ ] **Step 1: Replace the English strings**

Each is currently a double-quoted string; it becomes a backtick template literal. In
`src/translations/en.ts`:

```ts
// line 57
quotation: `The freelancer sends a quotation through ${getAppName()}`,
// line 58
payment: `Approve it and complete payment through ${getAppName()}`,
// line 65
hintTitle: `Keep it on ${getAppName()}`,
// line 66
hint: `Keep your agreement, files, delivery, and payment in this conversation so ${getAppName()} can help if you need support.`,
// line 3597
bodyInTransit: `Messages are encrypted between your device and ${getAppName()}, so nobody on the network in between can read them.`,
// line 3598
bodyNotE2e: `This is not end-to-end encryption: ${getAppName()} holds the key and can read your messages, which is what lets us act on reports of abuse and scams.`,
// line 3761
managePicture: {title: "Site Appearance", description: `Manage picture for ${getAppName()}`},
// line 3762
manageRiders: {title: "Manage Riders", description: `Manage riders for ${getAppName()}`},
// line 3979
placeholder: `e.g. ${getAppName()}`,
```

- [ ] **Step 2: Replace the Thai strings**

In `src/translations/th.ts`:

```ts
// line 57
quotation: `ฟรีแลนซ์ส่งใบเสนอราคาผ่าน ${getAppName()}`,
// line 58
payment: `อนุมัติใบเสนอราคาและชำระเงินผ่าน ${getAppName()}`,
// line 65
hintTitle: `ดำเนินการบน ${getAppName()}`,
// line 66
hint: `เก็บข้อตกลง ไฟล์ งานที่ส่งมอบ และการชำระเงินไว้ในบทสนทนานี้ เพื่อให้ ${getAppName()} ช่วยเหลือคุณได้เมื่อจำเป็น`,
// line 3511
bodyInTransit: `ข้อความจะถูกเข้ารหัสระหว่างอุปกรณ์ของคุณกับ ${getAppName()} ผู้อื่นบนเครือข่ายระหว่างทางจึงไม่สามารถอ่านได้`,
// line 3512
bodyNotE2e: `นี่ไม่ใช่การเข้ารหัสแบบต้นทางถึงปลายทาง (end-to-end): ${getAppName()} เป็นผู้ถือกุญแจและสามารถอ่านข้อความของคุณได้ ซึ่งทำให้เราดำเนินการกับรายงานการฉ้อโกงและการละเมิดได้`,
// line 3675
managePicture: {title: "รูปลักษณ์เว็บไซต์", description: `จัดการรูปภาพสำหรับ ${getAppName()}`},
// line 3676
manageRiders: {title: "จัดการไรเดอร์", description: `จัดการไรเดอร์สำหรับ ${getAppName()}`},
// line 3893
placeholder: `เช่น ${getAppName()}`,
```

- [ ] **Step 3: Replace the Vietnamese strings**

`vi.ts` has one extra: line 2774 hardcodes the LINE Official Account handle, which `en`
and `th` already interpolate. The LINE account has been renamed alongside the product,
so this handle tracks the brand.

In `src/translations/vi.ts`:

```ts
// line 57
quotation: `Freelancer gửi báo giá qua ${getAppName()}`,
// line 58
payment: `Duyệt báo giá và thanh toán qua ${getAppName()}`,
// line 65
hintTitle: `Trao đổi trên ${getAppName()}`,
// line 66
hint: `Hãy giữ thỏa thuận, tệp, sản phẩm bàn giao và thanh toán trong cuộc trò chuyện này để ${getAppName()} có thể hỗ trợ khi cần.`,
// line 2774
addLineButton: `Thêm @${getAppName()}`,
// line 3621
bodyInTransit: `Tin nhắn được mã hóa giữa thiết bị của bạn và ${getAppName()}, nên không ai trên đường truyền có thể đọc được.`,
// line 3622
bodyNotE2e: `Đây không phải mã hóa đầu cuối: ${getAppName()} giữ khóa và có thể đọc tin nhắn của bạn, điều này cho phép chúng tôi xử lý các báo cáo lạm dụng và lừa đảo.`,
// line 3785
managePicture: {title: "Giao diện trang web", description: `Quản lý hình ảnh cho ${getAppName()}`},
// line 3786
manageRiders: {title: "Quản lý tài xế", description: `Quản lý tài xế cho ${getAppName()}`},
// line 4003
placeholder: `ví dụ: ${getAppName()}`,
```

- [ ] **Step 4: Replace the admin dashboard literals**

In `src/app/[lang]/admin/dashboard/page.tsx`, add the import alongside the existing ones:

```ts
import {getAppName} from "@/utils/appConfig";
```

Line 24 becomes:

```ts
    const siteName = localSite?.name ?? getAppName();
```

Line 106 becomes — note this one currently uses lowercase `"108jobs"` while line 24 uses
`"108Jobs"`, an inconsistency this removes:

```ts
                                className="font-medium">{t("dashboard.siteInfo.instance")}:</span> {localSite?.name ?? getAppName()}
```

- [ ] **Step 4b: Fix the three auth page titles**

`src/lib/metadata/translations.ts` uses `getAppName()` at 68 sites and hardcodes the
domain at exactly 3 — the `login.title` of each language, each sitting directly above a
`description` in the same block that already interpolates `getAppName()`. These are
browser-tab and SEO titles, so they are user-visible and follow the brand.

Use this file's own concatenation idiom rather than template literals — all 68 existing
sites are written `"..."+getAppName()`.

```ts
// line 80 (th)
      title: "เข้าสู่ระบบ "+getAppName(),
// line 158 (en)
      title: "Authentication to "+getAppName(),
// line 236 (vi)
      title: "Đăng nhập "+getAppName(),
```

Confirm only those three changed:

```bash
grep -n "108jobs" src/lib/metadata/translations.ts
```

Expected: no output.

- [ ] **Step 5: Verify no hardcoded brand copy remains**

The `communication@108jobs.com` exclusion is deliberate: that mailbox appears in the
`marketingUnsubscribe` string in all three languages and must not change.

```bash
grep -n "108jobs\|108Jobs" src/translations/*.ts | grep -v "https\?://" | grep -v "communication@108jobs.com"
```

Expected: no output.

```bash
grep -rn "108jobs\|108Jobs" "src/app/[lang]/admin/dashboard/page.tsx"
```

Expected: exactly one line — `import {RegistrationMode} from "108jobs-client";`. That
package name is protected by the global constraints; it is not a leftover.

- [ ] **Step 6: Verify the app still builds and renders the old name**

```bash
pnpm test:unit && pnpm lint
```

Expected: PASS. Nothing user-visible has changed yet — `getAppName()` still returns the
pre-rebrand value.

- [ ] **Step 7: Commit**

```bash
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts "src/app/[lang]/admin/dashboard/page.tsx" src/lib/metadata/translations.ts
git commit -m "refactor(i18n): interpolate the product name instead of hardcoding it

28 translation strings, the two admin-dashboard fallbacks, and the three auth
page titles named the brand directly, bypassing getAppName(). vi.ts also
hardcoded the LINE handle that en and th already interpolate.

The auth titles were outliers in their own file: 68 sites there already use
getAppName(), including the description directly below each title.

No visible change: getAppName() still returns the current name."
```

---

### Task 3.5: Separate the domain from the brand name

`getAppName()` is overloaded: it is both the display name and the domain stem. 53 sites
build a URL, host, or email address out of it, so flipping it to `108Heros` in Task 4
would rewrite the privacy-policy link, the CDN links, and the support mailbox to
`108Heros.com` — a host that does not exist. That directly violates this plan's own
constraint that `108jobs.com` and its subdomains must not be renamed. Literal-string
greps never caught these because the domains are assembled by interpolation.

The two usages are already mutually inconsistent, which proves one of them is broken in
production today whatever `NEXT_PUBLIC_APP_NAME` holds: `en.ts:1196` renders
`support@<name>` while `th.ts:1161` and `vi.ts:1187` render `support@<name>.com`. Only
one of those can be a real address. Introducing an explicit domain accessor fixes that
pre-existing defect as a side effect.

The nine LINE Official Account handles (`@${getAppName()}`) deliberately stay on
`getAppName()` — the LINE account was renamed with the product, so they track the brand.

**Files:**
- Modify: `src/utils/appConfig.ts` (add `getAppDomain`)
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts` (51 `.com` sites + `en.ts:1196`)
- Modify: `src/lib/metadata/generators.ts:29`

**Interfaces:**
- Consumes: `getAppName()` and `isBrowser()` from the existing module.
- Produces: `getAppDomain(): string`, exported from `@/utils/appConfig`, returning the bare host (no scheme, no trailing slash) — e.g. `108jobs.com`.

- [ ] **Step 1: Add the domain accessor**

Append to `src/utils/appConfig.ts`, after `getAppUrl`:

```ts
/**
 * The bare host the site is served from — no scheme, no trailing slash.
 *
 * Deliberately separate from getAppName(). The product name and the domain
 * diverged in the 108Heros rebrand, so interpolating the name into a URL or an
 * email address would produce a host that does not exist.
 */
export function getAppDomain(): string {
  if (!isBrowser()) {
    return process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com';
  }
  return process.env.NEXT_PUBLIC_APP_DOMAIN || '108jobs.com';
}
```

- [ ] **Step 2: Point every domain-shaped interpolation at it**

In `src/translations/en.ts`, `th.ts`, and `vi.ts`, replace every occurrence of the
exact text `${getAppName()}.com` with `${getAppDomain()}`. There are 51: 7 in `en.ts`,
18 in `th.ts`, 26 in `vi.ts`. This is a plain textual substitution — the surrounding
copy, including all Thai and Vietnamese text, must be left byte-identical.

The substitution covers all three shapes at once, because the `.com` is part of the
replaced text:

```ts
// before                                        after
`https://${getAppName()}.com/privacy`         →  `https://${getAppDomain()}/privacy`
`https://static.${getAppName()}.com/...`      →  `https://static.${getAppDomain()}/...`
`support@${getAppName()}.com`                 →  `support@${getAppDomain()}`
`${getAppName()}.com คือเว็บไซต์...`            →  `${getAppDomain()} คือเว็บไซต์...`
```

Then fix the one English site that omits `.com` and so is not covered by the
substitution above — `src/translations/en.ts:1196`:

```ts
            supportEmail: `support@${getAppDomain()}`,
```

- [ ] **Step 3: Fix the bare-host use in the metadata base URL**

`src/lib/metadata/generators.ts:29` interpolates the name directly as a host. Replace:

```ts
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${getAppName()}`;
```

with:

```ts
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${getAppDomain()}`;
```

- [ ] **Step 4: Add the import everywhere it is now used**

Each of the four modified files imports from `@/utils/appConfig` on line 1 or 3. Extend
the existing import rather than adding a second one — for example, in `src/translations/en.ts`:

```ts
import {getAppDomain, getAppName} from "@/utils/appConfig";
```

`src/lib/metadata/generators.ts` still uses `getAppName` for `APP_NAME`, so it needs
both names too. Do not remove `getAppName` from any import.

- [ ] **Step 5: Verify the split is complete and the LINE handles survived**

```bash
grep -rn 'getAppName()}\.com' src/translations/ src/lib/
```

Expected: no output.

```bash
grep -rn 'https://\${getAppName()}' src/
```

Expected: no output.

```bash
grep -rn '@\${getAppName()}' src/translations/ | wc -l
```

Expected: exactly `9` — the LINE handles (`chatToHireButton`, `faqQuestion3Step1`,
`addLineButton` in each of the three languages). These are correct and must remain.

```bash
grep -ohF 'getAppDomain()' src/translations/*.ts | wc -l
```

Expected: `52` — the 51 substitutions plus `en.ts`'s `supportEmail`.

```bash
grep -c "getAppDomain" src/translations/en.ts src/translations/th.ts src/translations/vi.ts src/lib/metadata/generators.ts
```

Expected: a non-zero count for all four files, which confirms each got the import.

- [ ] **Step 6: Run the gate**

```bash
pnpm test:unit && pnpm lint
```

Expected: PASS, with lint errors at 0 (the ~608-warning noise floor is pre-existing).

- [ ] **Step 7: Commit**

```bash
git add src/utils/appConfig.ts src/translations/en.ts src/translations/th.ts src/translations/vi.ts src/lib/metadata/generators.ts
git commit -m "fix(config): separate the site domain from the product name

getAppName() was doing double duty as the display name and the domain stem.
53 sites built a URL, host, or email out of it, so renaming the product would
have pointed the privacy policy, the CDN links, and the support mailbox at a
host that does not exist.

The two usages were already inconsistent -- en.ts rendered support@<name>
while th.ts and vi.ts rendered support@<name>.com -- so one of them was a
broken address whatever the deployed name was. An explicit getAppDomain()
settles it.

The LINE handles stay on getAppName(): that account was renamed with the
product."
```

---

### Task 4: Flip the brand to 108Heros

Everything now reads through `getAppName()`. This task changes the value once, which is
the entire user-visible rebrand.

**Files:**
- Modify: `src/utils/appConfig.ts:5-12`
- Modify: `.env:22` (local only — gitignored, do not commit)
- Modify: `.env.example:22`

**Interfaces:**
- Consumes: `getAppName()` call sites established in Task 3.
- Produces: no new symbols.

- [ ] **Step 1: Change the fallback**

In `src/utils/appConfig.ts`, replace lines 5-12:

```ts
export function getAppName(): string {
  // On the server we can read APP_NAME; on the client we must rely on NEXT_PUBLIC_APP_NAME
  if (!isBrowser()) {
    return process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || '108jobs.com';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || '108jobs.com';
}
```

with:

```ts
export function getAppName(): string {
  // On the server we can read APP_NAME; on the client we must rely on NEXT_PUBLIC_APP_NAME
  if (!isBrowser()) {
    return process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || '108Heros';
  }
  // Client side
  return process.env.NEXT_PUBLIC_APP_NAME || '108Heros';
}
```

The fallback was a domain used as a display name; it is now the brand name every call
site already treated it as.

- [ ] **Step 2: Update the tracked example env**

In `.env.example`, line 22 becomes:

```
NEXT_PUBLIC_APP_NAME="108Heros"
```

- [ ] **Step 3: Update the local env**

In `.env`, line 22 becomes:

```
NEXT_PUBLIC_APP_NAME="108Heros"
```

This file is gitignored. Do not stage it; it exists so the next step renders the new
name locally.

- [ ] **Step 3b: Align the four platform-description keys across languages**

Task 3.5's substitution followed whichever source string happened to contain `.com`, so
four parallel keys ended up disagreeing about whether they name the product or the
domain. English already has the intended shape in all four; Thai and Vietnamese need
nine occurrences swapped back from `getAppDomain()` to `getAppName()`, across six lines:

| Key | Line | `getAppDomain()` → `getAppName()` |
| --- | --- | --- |
| `homepageTitle` | `vi.ts:2778` | 1 |
| `contentFastwork1` | `vi.ts:1206` | 2 |
| `freelancerStatistics` | `th.ts:1209` | 1 |
| `freelancerStatistics` | `vi.ts:1240` | 1 |
| `platformDescription` | `th.ts:1232` | 2 |
| `platformDescription` | `vi.ts:1263` | 2 |

Change only the accessor. Every other character on those lines, including all Thai and
Vietnamese text, stays byte-identical — and note `freelancerStatistics` already mixes
both accessors on one line, so swap only the `getAppDomain()` one.

These four keys are the homepage `<title>` and the main platform descriptions, so after
the flip they must read `108Heros` in every language rather than advertising the old
domain. Verify the counts afterwards:

```bash
for k in homepageTitle contentFastwork1 freelancerStatistics platformDescription; do
  grep -n "$k:" src/translations/*.ts | grep -c "getAppDomain"
done
```

Expected: `0` four times — no occurrence of `getAppDomain()` remains on any of those
keys in any language.

- [ ] **Step 4: Verify the rename renders**

```bash
pnpm test:unit && pnpm lint && pnpm build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

Stage only the two tracked files.

```bash
git add src/utils/appConfig.ts .env.example
git commit -m "feat: rebrand the web app to 108Heros

Flip the single value every call site already reads. The fallback was a domain
used as a display name and is now the brand name proper.

Domains, the contact mailbox, the logo, and the 108jobs-client package are
deliberately unchanged -- see docs/superpowers/specs/2026-08-26-108heros-web-rebrand-design.md"
```

---

### Task 5: Verification sweep and pull request

**Files:**
- No source changes. This task produces evidence and the PR.

**Interfaces:**
- Consumes: the branch state after Tasks 1–4.
- Produces: a pull request.

- [ ] **Step 1: Confirm no user-visible brand text survives**

This gate does **not** expect empty output. It expects exactly the known-legitimate
residue below, which is the point: the remaining hits are things that must survive, and
the reviewer's job is to confirm nothing else joined them.

```bash
grep -rn "108jobs\|108Jobs" src --exclude-dir=108jobs-client \
  | grep -v "108jobs-client" | grep -v "Api108Jobs" \
  | grep -v "api-108jobs" | grep -v "108jobs-flutter" \
  | grep -v "https\?://" | grep -v "@108jobs.com"
```

Expected: 19 lines, all of them in this table. Anything outside it is a miss from
Task 3 — fix it and re-run.

| Line | What it is | Why it stays |
| --- | --- | --- |
| `src/modules/chat/utils/security/crypto.ts:68` | HKDF `info` string | Pinned identically in api-108jobs and 108jobs-flutter. Changing it breaks decryption everywhere. |
| `src/services/IdentityPasskeyService.ts:22` | `localStorage` key | Renaming silently forgets every remembered passkey identifier. |
| `src/services/UserService.ts:223` and `UserService.test.ts:388` | Web Locks name | Cross-tab refresh coordination; renaming mid-deploy lets old and new tabs refresh concurrently. |
| `src/utils/env.ts:95` | Server filesystem path | Deployment infrastructure, not brand. |
| `src/utils/config.ts:19` | Legacy cookie names from Task 1 | The migration list itself. |
| `src/utils/config.ts:43` | `testHost` domain fallback | A domain. |
| `src/components/BasicInformation/index.tsx:116` | Profile URL prefix | A domain. |
| `src/app/[lang]/(wallet)/coin/page.tsx:17,261` | `Coins108Jobs` component name | Internal identifier, not user-visible. |
| `src/app/api/media/[assetId]/route.ts:20`, `src/utils/env.ts:1`, `src/services/media/madUpload.ts:262` | Code comments | Descriptive only. |
| `HowToHireModal/index.test.ts:19,24,36`, `JobFlowSidebar/index.test.ts:22,34` | Test fixtures | These mock `t()` and assert the component renders whatever it returns. They test rendering, not copy, and stay valid unchanged. |

- [ ] **Step 2: Confirm the deliberately-kept surfaces are intact**

```bash
grep -rc "108jobs.com" src/translations/en.ts && ls src/assets/icons/logo.svg && grep -c "108jobs-client" package.json
```

Expected: the policy URLs still present, the logo still in place, the client package
still referenced. None of these should have changed.

- [ ] **Step 3: Run the full gate**

Per this repository's known ordering trap, build the client sub-package before
installing, and clean before rebuilding.

```bash
pnpm test:unit && pnpm lint && pnpm build
```

Expected: all PASS. Read the real output rather than a summarised view — use
`rtk proxy` for anything you count.

- [ ] **Step 4: Verify the session survives a simulated rename**

This is the claim the whole plan rests on, so check it in a real browser rather than
only in unit tests.

Start the dev server, sign in, then in DevTools rename the auth cookie to a legacy name
(`108Jobs`), delete the `108_auth` cookie, and reload. Expected: still signed in, and
the cookie list now shows `108_auth` with `108Jobs` gone.

- [ ] **Step 5: Open the pull request**

Substitute the Task 2 issue number for `N`.

```bash
git push -u origin feat/108heros-rebrand
```

```bash
gh pr create --repo yuthstyle88/108heros-web-dev --title "Rebrand the web app to 108Heros" --body "$(cat <<'PRBODY'
Name-only rebrand of the web app, matching what the Flutter client did.

The load-bearing change is not the rename but the auth cookie, whose name was
derived from NEXT_PUBLIC_APP_NAME. Renaming the brand would have logged out
every signed-in user, and it would not have self-healed: a session with no
claims never schedules the refresh that would redeem the surviving
refresh_token cookie. The cookie is now pinned to a brand-independent name and
adopts legacy-named cookies on read.

Deliberately unchanged: the logo, 108jobs.com and its subdomains,
communication@108jobs.com, the 108jobs-client package, and the repository name.

Design: docs/superpowers/specs/2026-08-26-108heros-web-rebrand-design.md

Fixes #N

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 6: Report the one residual risk**

The deployed `NEXT_PUBLIC_APP_NAME` was not knowable from the repository, so
`legacyAuthCookieNames` covers the four plausible values. If an environment used
something else, users there are logged out once. Confirming the deployed value and
adding it to that list closes the gap — it is the single place that would change.

---

## Open item

Not a blocker, and no task depends on it: if the deployed `NEXT_PUBLIC_APP_NAME` can be
read off the hosting platform, add its exact value to `legacyAuthCookieNames` in Task 1
Step 3 before implementing.
