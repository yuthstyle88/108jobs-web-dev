# 108heros-client Dead Code Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the 32 client methods whose endpoints the backend does not
serve, remove the non-functional 2FA feature they power, and let the type
files that become unreachable fall out mechanically.

**Architecture:** Removal only — no behaviour is added. The one user-visible
change is that the account-settings page loses its 2FA section, which could
never work. Type removal is a convergent loop driven by the compiler rather
than a pre-written list, because the barrel re-exports every type and makes
static "is it used?" checks unreliable.

**Tech Stack:** TypeScript, Next.js App Router, react-i18next, the
hand-maintained `108heros-client` package.

**Companion spec:** `docs/superpowers/specs/2026-08-17-client-dead-code-removal-design.md`

## Global Constraints

- Touch only: `src/lib/108heros-client/src/http.ts`,
  `src/lib/108heros-client/src/index.ts`,
  `src/lib/108heros-client/src/types/*.ts` (deletions only),
  `src/lib/108heros-client/putTypesInIndex.js` (deletion),
  `src/app/[lang]/(profile)/account-setting/manage/page.tsx`,
  `src/components/Common/Modal/TotpModal/` (deletion),
  `src/hooks/api/http/useHttpPost.ts`,
  `src/translations/{en,th,vi}.ts`.
- **Never delete a client method that isn't on this plan's list.** The list
  was derived by probing every endpoint and distinguishing "no route"
  (actix returns an empty body) from a handler's own 404 (a JSON error
  body). Endpoints that merely look unused are out of scope — this package
  legitimately exposes more surface than the app consumes.
- **`createCategory` / `deleteCategory` are NOT dead.** They 404 against a
  locally-running dev API only because that binary predates today's merge.
  Both exist on `api-108jobs` `origin/main` and are called by the admin
  category page. Do not remove them.
- **Rebuild the package after every change under `src/lib/108heros-client/src/`:**
  ```bash
  cd src/lib/108heros-client && npm run build && cd -
  ```
  App code imports the package *name*, which resolves to `dist/` — without a
  rebuild, `tsc` checks against the stale build and silently accepts code
  that contradicts your edit.
- Files under `src/lib/108heros-client/src/types/` use 2-space indentation;
  everything else uses 4-space. Double-quoted strings.
- After each task: `npx tsc --noEmit` clean at the repo root.

---

### Task 1: Remove the 32 dead client methods

**Files:**
- Modify: `src/lib/108heros-client/src/http.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a smaller `Api108Heros` class. Two of the removed methods
  (`generateTotpSecret`, `updateTotp`) are still referenced by the
  account-settings page — Task 2 removes those call sites, so the repo will
  not type-check cleanly until Task 2 lands. That is expected and is the
  only point in this plan where a task leaves `tsc` red.

Each of these targets an endpoint the backend does not serve. Delete the
whole method: its doc comment, its decorators (`@Security`, `@Get`/`@Post`/
`@Put`/`@Delete`, `@Tags`), and its body.

- [ ] **Step 1: Delete these 32 methods**

```
addModToCategory          POST   /category/mod
authenticateWithOAuth     POST   /oauth/authenticate
banFromCategory           POST   /category/ban-profile
changePassword            PUT    /account/auth/change-password
createOAuthProvider       POST   /oauth-providers
deleteMedia               DELETE /account/media
deleteMediaAdmin          DELETE /image
deleteOAuthProvider       POST   /oauth-providers/delete
donationDialogShown       POST   /profile/donation-dialog-shown
editOAuthProvider         PUT    /oauth-providers
generateTotpSecret        POST   /account/auth/totp/generate
getCaptcha                GET    /account/auth/get-captcha
getCategory               GET    /category
getPersonDetails          GET    /person
getProfile                GET    /account/profile
getSiteMetadata           GET    /post/site-metadata
imageHealth               GET    /image/health
listChildrenCategories    GET    /category/list/children
listLogins                GET    /account/list-logins
listMedia                 GET    /account/media/list
listMediaAdmin            GET    /image/list
passwordChangeAfterReset  POST   /account/auth/password-change
passwordReset             POST   /account/auth/password-reset
updateAddress             POST   /account/update-address
updateAvailable           PUT    /profile/available
updateContact             PUT    /account/update-contact
updateIdentityCard        PUT    /account/update-identity-card
updateTerm                POST   /account/auth/update-term
updateTotp                POST   /account/auth/totp/update
uploadImage               POST   /image
upsertCard                PUT    /account/upsert-card
validateAuth              GET    /account/validate-auth
```

Note `getCategory` and `listChildrenCategories` go, while `listCategories`
(`GET /category/list`), `createCategory`, `editCategory` and
`deleteCategory` stay — the backend serves those four and the admin page
uses them.

- [ ] **Step 2: Remove the imports that are now unused**

`http.ts` imports every type it references at the top of the file. Removing
the methods orphans some of those imports. Do not guess which — run:

```bash
cd src/lib/108heros-client && npx tsc --noEmit 2>&1 | head -30
```

`noUnusedLocals` may or may not be enabled; if it doesn't flag them, find
them mechanically instead: for each `import type {X} from "./types/X";` line
in `http.ts`, check whether `X` still appears anywhere else in the file, and
drop the line if it doesn't. Report how many import lines you removed.

- [ ] **Step 3: Verify the class still parses and the kept methods survived**

```bash
cd src/lib/108heros-client && npm run build 2>&1 | tail -5 && cd -
grep -cE "^    (async )?\w+\s*\(" src/lib/108heros-client/src/http.ts
```

Expected: the build succeeds, and the method count has dropped by exactly 32
(from 129 to 97). Then confirm none of the removed names survive and none of
the kept ones vanished:

```bash
grep -nE "addModToCategory|authenticateWithOAuth|banFromCategory|getCaptcha|uploadImage|validateAuth" src/lib/108heros-client/src/http.ts
grep -cE "createCategory|editCategory|deleteCategory|listCategories|updateSite|getSite" src/lib/108heros-client/src/http.ts
```

Expected: the first returns nothing; the second returns a non-zero count.

- [ ] **Step 4: Commit**

`tsc` at the repo root is still red here — the account page references two
removed methods until Task 2. Say so in the commit body rather than leaving
it to be discovered.

```bash
git add src/lib/108heros-client/src/http.ts
git commit -m "chore(client): remove 32 methods whose endpoints the backend no longer serves

Verified by probing every client endpoint and distinguishing a missing
route (actix returns an empty body) from a handler's own 404. The repo does
not type-check until the next commit removes the 2FA page's call sites."
```

---

### Task 2: Remove the non-functional 2FA feature

**Files:**
- Modify: `src/app/[lang]/(profile)/account-setting/manage/page.tsx`
- Delete: `src/components/Common/Modal/TotpModal/index.tsx` (and its
  directory)
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts`

**Interfaces:**
- Consumes: Task 1's removals. Restores a green `tsc`.
- Produces: nothing later tasks depend on.

The page's 2FA toggle calls `POST /account/auth/totp/generate`, which does
not exist — enabling 2FA could only ever 404, while the UI implied the
account was protected.

**Keep the route.** `/account-setting/manage` is linked from three places —
the profile dropdown (`Header/components/ProfileUser`), the account-settings
sidebar (`containers/AccountSettingWrapper`, labelled
`profileNavbar.consentManage`), and the privacy policy page. Deleting the
route would break a consent-related link from a legal page. The page keeps
its header and becomes header-only; the PR flags that for a product
decision.

- [ ] **Step 1: Strip the page down to its header**

The 2FA feature is everything except the outer wrapper and the header block.
Remove: the `TotpModal` import, `REQUEST_STATE`/`useHttpPost`/`useUserStore`/
`toast` imports, all six `useState` declarations, both `useHttpPost` calls,
`handleTotpToggle`, `handleTotpSubmit`, the rendered `<TotpModal .../>`, and
the entire `{/* TOTP 2FA Section */}` block.

The whole file becomes:

```tsx
"use client";

import { useTranslation } from "react-i18next";

export default function AccountManagePage() {
    const { t } = useTranslation();

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-md border border-border-primary p-6 space-y-8">
                {/* Header */}
                <div>
                    <h2 className="text-xl font-semibold text-black">
                        {t("accountManage.title")}
                    </h2>
                    <p className="text-sm text-gray-600">
                        {t("accountManage.description")}
                    </p>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Delete the TotpModal component**

```bash
grep -rn "TotpModal" src/ --include="*.tsx" --include="*.ts"
```

Expected after Step 1: only the component's own file. Then delete its whole
directory:

```bash
rm -rf src/components/Common/Modal/TotpModal
```

If the grep shows any other referencing file, stop and report instead of
deleting.

- [ ] **Step 3: Remove the now-unused translation keys**

In each of `en.ts`, `th.ts`, `vi.ts`, the `accountManage` object keeps
`title` and `description` and loses every `totp*` key. Before deleting, list
them per file so the three stay in sync:

```bash
grep -n "totp" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
```

Delete exactly the `accountManage.totp*` keys shown. Do **not** touch
`profileNavbar.consentManage` or anything outside `accountManage`. Also check
whether `TotpModal`'s own copy lived under a separate key group (e.g.
`totpModal.*`) and remove that group too if nothing else references it.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/[lang]/(profile)/account-setting/manage/page.tsx"
grep -rn "totp\|Totp\|TOTP" src/ --include="*.ts" --include="*.tsx" | grep -v "src/lib/108heros-client"
```

Expected: `tsc` is now **green** again, eslint clean, and the only surviving
`totp` references outside the client package are `LocalUser.totp2faEnabled`
if the app reads it. That field is part of the backend's own user payload —
leave it alone; report where it is still read.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/(profile)/account-setting/manage/page.tsx" src/components/Common/Modal/TotpModal src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(account): remove the 2FA section, which called endpoints the backend never had

Enabling 2FA called POST /account/auth/totp/generate and 404'd, while the
toggle implied the account was protected. The route survives because the
privacy policy and profile menu link to it."
```

---

### Task 3: Fix the hook's doc example and delete the broken generator

**Files:**
- Modify: `src/hooks/api/http/useHttpPost.ts`
- Delete: `src/lib/108heros-client/putTypesInIndex.js`

**Interfaces:**
- Consumes/produces: nothing.

- [ ] **Step 1: Point the `@example` at a method that exists**

Current:
```ts
 * @example
 * const { execute, data, isMutating } = useHttpPost("uploadImage");
 * await execute({ file });
```

`uploadImage` was removed in Task 1 (`POST /image` does not exist), so the
hook's only worked example names a method that is gone. Replace it with a
live one — `createCategory` is a good fit for a POST with a JSON body:

```ts
 * @example
 * const { execute, data, isMutating } = useHttpPost("createCategory");
 * await execute({ name: "Design", title: "Design" });
```

Confirm the method you pick still exists in `http.ts` before writing it.

- [ ] **Step 2: Delete `putTypesInIndex.js`**

It writes its generated exports to `src/page.tsx` — not `src/index.ts`, the
barrel it means to regenerate, and a route-shaped filename that has no
meaning inside a library. Nothing invokes it: confirm, then delete.

```bash
grep -rn "putTypesInIndex" src/lib/108heros-client --include="*.json" --include="*.js" --include="*.ts" --include="*.mjs"
ls src/lib/108heros-client/src/page.tsx 2>/dev/null || echo "(no stray page.tsx — good)"
rm src/lib/108heros-client/putTypesInIndex.js
```

If the grep finds it referenced by an npm script, stop and report.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/hooks/api/http/useHttpPost.ts src/lib/108heros-client/putTypesInIndex.js
git commit -m "chore: fix the useHttpPost doc example and drop the broken index generator"
```

---

### Task 4: Remove the type files that are now unreachable

**Files:**
- Delete: various under `src/lib/108heros-client/src/types/`
- Modify: `src/lib/108heros-client/src/index.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: the finished cleanup.

**Do not work from a pre-written list.** Three attempts to precompute one
during design gave three different answers: `index.ts` re-exports all 267
types so nothing ever looks unused; type files import each other so removal
is transitive; and a regex that only matched `async` methods mis-classified
the eight non-`async` ones. Discover the set instead.

- [ ] **Step 1: Write a throwaway reachability script**

Put it in the scratchpad, not the repo. It must:

1. Treat as **roots** every type name that appears in (a) a named import
   from `"108heros-client"` anywhere under `src/` outside the client package,
   (b) `src/lib/108heros-client/src/http.ts`, (c) `other_types.ts`,
   `convert-to-camel.ts`, `http.test.ts`.
2. Build edges from each `src/types/X.ts` to any `Y` it imports via
   `from "./Y"`.
3. Mark everything reachable from the roots.
4. Report the unreachable set.

`index.ts` must be **excluded** from root detection — it re-exports
everything and would make every type reachable. Match import specifiers
(`from "./Y"`), not bare words: bare-word matching against `.tsx` files
produces false positives from unrelated identifiers.

- [ ] **Step 2: Delete the unreachable files and their barrel lines, then repeat**

Deleting a type can orphan another that only it imported, so this converges
rather than completing in one pass:

1. Delete the reported files.
2. Remove each one's `export ... from "./types/<Name>";` line from
   `index.ts`.
3. Rebuild the package and run `npx tsc --noEmit`.
4. Re-run the script. If it reports new files, repeat.

Stop when a pass reports nothing. Record the count removed per round.

- [ ] **Step 3: Sanity-check the result before trusting it**

The script is throwaway code making deletion decisions, so verify its output
independently:

```bash
git status --short src/lib/108heros-client/src/types/ | wc -l
grep -c "^export" src/lib/108heros-client/src/index.ts
```

The number of deleted type files must equal the number of export lines
removed from `index.ts`. Then spot-check three deleted names by hand:

```bash
grep -rn "<DeletedTypeName>" src/ --include="*.ts" --include="*.tsx"
```

Each must return nothing. If any returns a hit, restore that file and its
export line and report — a false deletion is far worse than an
under-cleaned package.

- [ ] **Step 4: Full verification**

```bash
cd src/lib/108heros-client && npm run build && cd -
npx tsc --noEmit
npx eslint src/lib/108heros-client/src/index.ts
pnpm test:unit
```

Expected: build succeeds, `tsc` clean, eslint clean, unit suite still
157/157.

- [ ] **Step 5: Commit**

```bash
git add src/lib/108heros-client/src/types src/lib/108heros-client/src/index.ts
git commit -m "chore(client): remove the type files left unreachable by the dead-method removal"
```

---

## After all tasks

- [ ] `npx tsc --noEmit` clean.
- [ ] `pnpm test:unit` 157/157.
- [ ] `npx eslint` clean on every touched file.
- [ ] The package rebuilds from scratch: `cd src/lib/108heros-client && npm run build`.
- [ ] In the browser: the account-settings page renders its header with no
      2FA section and no console errors, and the admin category page still
      lists, creates and deletes categories (it exercises the client methods
      that were deliberately kept).
- [ ] `git status` clean apart from intended changes — in particular
      `tsconfig.tsbuildinfo` must not be committed.
- [ ] Report the totals: methods removed, type files removed, lines removed.
