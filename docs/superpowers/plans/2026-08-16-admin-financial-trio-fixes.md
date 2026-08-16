# Admin Financial-Trio Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 19 confirmed bugs across the three financial admin pages
(`bank-accounts`, `topup-coins`, `withdraw-coins`) — the most consequential
being that every approve/reject/verify action across all three pages
currently reports success even when the backend call actually fails, and
that `vi.ts`'s entire withdraw-request translation block is Thai, not
Vietnamese.

**Architecture:** Three independent page files
(`src/app/[lang]/admin/bank-accounts/page.tsx`,
`src/app/[lang]/admin/topup-coins/page.tsx`,
`src/app/[lang]/admin/withdraw-coins/page.tsx`) plus the three locale
files they draw from. No new components, no new dependencies. The
success/failure-detection fix reuses a pattern
(`isSuccess`/`isFailed` from `@/services/HttpService`) already proven
across every prior batch in this initiative; `topup-coins`'s existing
`confirmTransfer` already uses it correctly and serves as this batch's
in-repo reference implementation.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS,
react-i18next (en/th/vi), SWR-backed `useHttpGet`/`useHttpPost` hooks
wrapping the generated `108jobs-client` API client.

## Global Constraints

- Touch only: `src/app/[lang]/admin/bank-accounts/page.tsx`,
  `src/app/[lang]/admin/topup-coins/page.tsx`,
  `src/app/[lang]/admin/withdraw-coins/page.tsx`, `src/translations/en.ts`,
  `src/translations/th.ts`, `src/translations/vi.ts`.
- No new npm dependencies.
- `isSuccess`/`isFailed` always come from `@/services/HttpService` —
  never rely on a mutation hook's `try/catch` to detect failure (its
  fetcher catches internally and resolves rather than rejects).
- New translation keys go under each page's existing namespace
  (`admin.bankManagement.*`, `topupCoins.*`, `admin.withdraw.*`).
- Double-quoted strings, 4-space indentation, matching each file's
  existing style.
- No component-test infrastructure exists for any of these 6 files —
  verify manually per each task's own steps.

---

## Part A: `bank-accounts`

### Task 1: Fix failed verification reporting success

**Files:**
- Modify: `src/app/[lang]/admin/bank-accounts/page.tsx:1-16, 57-65`

**Interfaces:**
- Consumes: `isSuccess`, `isFailed` from `@/services/HttpService`
  (established pattern, first use in this file).
- Produces: the `@/services/HttpService` import this task adds is reused
  by Task 2.

`verify` (from `useHttpPost("adminVerifyBankAccount")`) never rejects —
its fetcher catches internally and resolves with `{state: FAILED}` — so
the existing `catch` block can never run. A real verification failure
currently shows a success toast. The failure copy was also wrong even if
it were reachable (`actionApprove`, the button's own label, not an error
message).

- [ ] **Step 1: Add the `HttpService` import**

Current (lines 1-16, the full top of the file):
```tsx
"use client";

import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {CheckCircle, Loader2, CreditCard, Filter} from "lucide-react";
import {toast} from "sonner";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {useState} from "react";
import {cn} from "@/lib/utils";
import {BankAccountId} from "108jobs-client";
```

Change to:
```tsx
"use client";

import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {CheckCircle, Loader2, CreditCard, Filter} from "lucide-react";
import {toast} from "sonner";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {useState} from "react";
import {cn} from "@/lib/utils";
import {BankAccountId} from "108jobs-client";
import {isSuccess, isFailed} from "@/services/HttpService";
```

- [ ] **Step 2: Fix `handleVerify`**

Current (lines 57-65):
```tsx
    const handleVerify = async (bankAccountId: BankAccountId) => {
        try {
            await verify({bankAccountId});
            toast.success(t("admin.bankManagement.actionApprove"));
            await refetch();
        } catch {
            toast.error(t("admin.bankManagement.actionApprove"));
        }
    };
```

Change to:
```tsx
    const handleVerify = async (bankAccountId: BankAccountId) => {
        const res = await verify({bankAccountId});
        if (isSuccess(res)) {
            toast.success(t("admin.bankManagement.actionApprove"));
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.bankManagement.verifyFailed"));
        }
    };
```

- [ ] **Step 3: Add the new translation key to `en.ts`**

Current (`admin.bankManagement`, the object's last entry, `src/translations/en.ts`):
```ts
                actionReject: "Reject",
                actionApprove: "Approve",
            },
```

Change to:
```ts
                actionReject: "Reject",
                actionApprove: "Approve",
                verifyFailed: "Failed to verify bank account",
            },
```

- [ ] **Step 4: Add the new translation key to `th.ts`**

Current (`admin.bankManagement`, the object's last entry, `src/translations/th.ts`):
```ts
                actionReject: "ปฏิเสธ",
                actionApprove: "อนุมัติ",
            },
```

Change to:
```ts
                actionReject: "ปฏิเสธ",
                actionApprove: "อนุมัติ",
                verifyFailed: "ยืนยันบัญชีธนาคารไม่สำเร็จ",
            },
```

- [ ] **Step 5: Add the new translation key to `vi.ts`**

Current (`admin.bankManagement`, the object's last entry, `src/translations/vi.ts`):
```ts
                actionReject: "Từ chối",
                actionApprove: "Duyệt",
            },
```

Change to:
```ts
                actionReject: "Từ chối",
                actionApprove: "Duyệt",
                verifyFailed: "Xác minh tài khoản ngân hàng thất bại",
            },
```

- [ ] **Step 6: Verify in the browser**

A simulated verification failure (or a real backend rejection) shows a
distinct "Failed to verify bank account" error toast, not the "Approve"
button label; a successful verification still works exactly as before.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/bank-accounts/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): bank-accounts verification failure shows a real error instead of a false success"
```

---

### Task 2: Fix fetch failure vs. empty-list distinction

**Files:**
- Modify: `src/app/[lang]/admin/bank-accounts/page.tsx:27, 131-141`
  (post-Task-1 state)

**Interfaces:**
- Consumes: `isFailed` from `@/services/HttpService` (already imported by
  Task 1).
- Produces: `isFetchFailed` — consumed by Task 3's loading-state branch
  ordering (Task 3 does not change this branch, only the spinner/pagination
  condition, so no signature is actually shared — noted for context only).

`useHttpGet("adminListBankAccounts", {...})` only destructures `data`/
`isLoading` — its `error` field can never become truthy on a real failure
(the hook's fetcher catches internally). Derive a real error from `state`
instead, matching the pattern already proven in `manage-category`/
`manage-users`/`manage-riders`.

- [ ] **Step 1: Destructure `state` and derive `isFetchFailed`**

Current (line 27):
```tsx
    const {data, isLoading, execute: refetch} = useHttpGet("adminListBankAccounts", {
```

Change to:
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListBankAccounts", {
```

(The rest of that call — `pageCursor`, `pageBack`, `limit`, `isVerified` —
is unchanged.) Then, immediately after the existing derived-values block
(after `const hasPreviousPage = cursorHistory.length > 0;`), add:
```tsx
    const isFetchFailed = isFailed(state);
```

- [ ] **Step 2: Add a distinct error branch before the empty-state branch**

Current (lines 131-141):
```tsx
                {/* Empty State */}
                {!isLoading && bankAccounts.length === 0 && (
                    <Card className="p-12 text-center bg-gray-50">
                        <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4"/>
                        <p className="text-lg font-medium text-gray-700">
                            {viewMode === "unverified"
                                ? t("admin.bankManagement.emptyUnverified")
                                : t("admin.bankManagement.emptyVerified")}
                        </p>
                    </Card>
                )}
```

Change to (adds a new error branch immediately before it, and narrows the
empty-state condition so it no longer also matches the failed case):
```tsx
                {/* Error State */}
                {!isLoading && isFetchFailed && (
                    <Card className="p-12 text-center bg-red-50 border border-red-100">
                        <CreditCard className="w-16 h-16 mx-auto text-red-400 mb-4"/>
                        <p className="text-lg font-medium text-red-600">
                            {t("admin.bankManagement.fetchError")}
                        </p>
                    </Card>
                )}

                {/* Empty State */}
                {!isLoading && !isFetchFailed && bankAccounts.length === 0 && (
                    <Card className="p-12 text-center bg-gray-50">
                        <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4"/>
                        <p className="text-lg font-medium text-gray-700">
                            {viewMode === "unverified"
                                ? t("admin.bankManagement.emptyUnverified")
                                : t("admin.bankManagement.emptyVerified")}
                        </p>
                    </Card>
                )}
```

Also narrow the existing "List" branch's condition the same way, so a
failed fetch doesn't fall through to rendering a stale/empty list. Current
(line 144, unchanged text around it):
```tsx
                {!isLoading && bankAccounts.length > 0 && (
```

Change to:
```tsx
                {!isLoading && !isFetchFailed && bankAccounts.length > 0 && (
```

- [ ] **Step 3: Add the new translation key to `en.ts`**

Current (`admin.bankManagement`, post-Task-1 state, the object's last
entry):
```ts
                actionApprove: "Approve",
                verifyFailed: "Failed to verify bank account",
            },
```

Change to:
```ts
                actionApprove: "Approve",
                verifyFailed: "Failed to verify bank account",
                fetchError: "Failed to load bank accounts. Please try again.",
            },
```

- [ ] **Step 4: Add the new translation key to `th.ts`**

Current (`admin.bankManagement`, post-Task-1 state, the object's last
entry):
```ts
                actionApprove: "อนุมัติ",
                verifyFailed: "ยืนยันบัญชีธนาคารไม่สำเร็จ",
            },
```

Change to:
```ts
                actionApprove: "อนุมัติ",
                verifyFailed: "ยืนยันบัญชีธนาคารไม่สำเร็จ",
                fetchError: "โหลดรายการบัญชีธนาคารไม่สำเร็จ กรุณาลองใหม่",
            },
```

- [ ] **Step 5: Add the new translation key to `vi.ts`**

Current (`admin.bankManagement`, post-Task-1 state, the object's last
entry):
```ts
                actionApprove: "Duyệt",
                verifyFailed: "Xác minh tài khoản ngân hàng thất bại",
            },
```

Change to:
```ts
                actionApprove: "Duyệt",
                verifyFailed: "Xác minh tài khoản ngân hàng thất bại",
                fetchError: "Không thể tải danh sách tài khoản ngân hàng. Vui lòng thử lại.",
            },
```

- [ ] **Step 6: Verify in the browser**

A simulated fetch failure shows the distinct red error card, not the
"no accounts" empty state; a genuinely empty result still shows the
correct empty-state copy.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/bank-accounts/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): bank-accounts fetch failure is distinct from an empty list"
```

---

### Task 3: Fix pagination loading feedback

**Files:**
- Modify: `src/app/[lang]/admin/bank-accounts/page.tsx:27, 114-129, 252-260`
  (post-Task-2 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

Only `isLoading` (true pre-first-load only) gates the loading skeleton and
`PaginationControls`. `useHttpGet` uses `keepPreviousData: true`, so
`isLoading` never fires again on Next/Previous — `isMutating`
(`swr.isValidating`) does. Add it and combine, matching the pattern
already fixed in `manage-users`.

- [ ] **Step 1: Destructure `isMutating` and derive `showLoading`**

Current (line 27, post-Task-2 state):
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListBankAccounts", {
```

Change to:
```tsx
    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListBankAccounts", {
```

Then, right after the `isFetchFailed` line Task 2 added, add:
```tsx
    const showLoading = isLoading || isMutating;
```

- [ ] **Step 2: Use `showLoading` for the skeleton and every other branch's
  gating condition**

Current (line 115, post-Task-2 state — every subsequent branch in this
file gates on `!isLoading`, per Task 2's edits):
```tsx
                {isLoading && (
```

Change to:
```tsx
                {showLoading && (
```

Then replace every remaining `!isLoading` in this file's render (the
error branch, empty branch, and list branch Task 2 last touched) with
`!showLoading`:
```tsx
                {!showLoading && isFetchFailed && (
```
```tsx
                {!showLoading && !isFetchFailed && bankAccounts.length === 0 && (
```
```tsx
                {!showLoading && !isFetchFailed && bankAccounts.length > 0 && (
```

- [ ] **Step 3: Pass `showLoading` to `PaginationControls`**

Current (lines 252-260, post-Task-2 state):
```tsx
                        <div className="flex justify-center mt-8">
                            <PaginationControls
                                hasPrevious={hasPreviousPage}
                                hasNext={hasNextPage}
                                onPrevious={handlePrevPage}
                                onNext={handleNextPage}
                                isLoading={isLoading}
                            />
                        </div>
```

Change to:
```tsx
                        <div className="flex justify-center mt-8">
                            <PaginationControls
                                hasPrevious={hasPreviousPage}
                                hasNext={hasNextPage}
                                onPrevious={handlePrevPage}
                                onNext={handleNextPage}
                                isLoading={showLoading}
                            />
                        </div>
```

- [ ] **Step 4: Verify in the browser**

Clicking Next/Previous after the first page load shows a visible loading
indicator, not silence until the new page appears.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/bank-accounts/page.tsx"
git commit -m "fix(admin): bank-accounts pagination shows loading feedback on Next/Previous, not just first load"
```

---

### Task 4: Type the bank-account list item

**Files:**
- Modify: `src/app/[lang]/admin/bank-accounts/page.tsx:1-16, 147`
  (post-Task-3 state)

**Interfaces:**
- Consumes: `BankAccountView` type, exported from `108jobs-client`
  (`{userBankAccount: BankAccount, bank: Bank}`).
- Produces: nothing later tasks depend on.

`.map((item: any) => {...})` loses type-checking for `item.bank`/
`item.userBankAccount`. The real type matches the existing destructuring
exactly.

- [ ] **Step 1: Add `BankAccountView` to the `108jobs-client` import**

Current (post-Task-1 state, the last import line):
```tsx
import {BankAccountId} from "108jobs-client";
import {isSuccess, isFailed} from "@/services/HttpService";
```

Change to:
```tsx
import {BankAccountId, BankAccountView} from "108jobs-client";
import {isSuccess, isFailed} from "@/services/HttpService";
```

- [ ] **Step 2: Replace `any` with `BankAccountView`**

Current (line 147, post-Task-3 state — unaffected by Tasks 2/3's edits,
this line's own content is unchanged since the original read):
```tsx
                            {bankAccounts.map((item: any) => {
```

Change to:
```tsx
                            {bankAccounts.map((item: BankAccountView) => {
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` shows no new errors — `item.bank.name`,
`item.userBankAccount.accountName`, `item.userBankAccount.accountNumber`,
`item.userBankAccount.localUserId`, and `item.userBankAccount.id` (all
used later in the same `.map()` body) all type-check cleanly against
`BankAccountView`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/bank-accounts/page.tsx"
git commit -m "fix(admin): bank-accounts list item uses the real BankAccountView type instead of any"
```

---

## Part B: `topup-coins`

### Task 5: Build the Year/Month/Day filters

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:205-206`

**Interfaces:**
- Consumes: `ListTopUpRequestQuery.year`/`.month`/`.day` (already exist on
  the type, already flow through `debouncedFilters` into the query —
  confirmed, no backend gap). `topupCoins.filters.year`/`.month`/`.day`
  translation keys (already exist in all 3 locales — confirmed, no new
  keys needed for this task).
- Produces: nothing later tasks depend on.

The comment `{/* Year, Month, Day — same pattern */} {/* ... abbreviated
for brevity ... */}` stands in for controls that were never built, even
though the backend and translations both already support them.
`withdraw-coins` already has working Year/Month controls — this task
follows that exact pattern, adding a Day control `withdraw-coins` doesn't
have (since `ListWithdrawRequestQuery` has no `day` field, but
`ListTopUpRequestQuery` does).

- [ ] **Step 1: Replace the placeholder comment with real controls**

Current (lines 205-206, sitting between the Max Amount filter block and
the Apply-button block):
```tsx
                        {/* Year, Month, Day — same pattern */}
                        {/* ... abbreviated for brevity ... */}
```

Change to:
```tsx
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.year")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.year ?? ""}
                                onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.month")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.month ?? ""}
                                onChange={(e) => handleFilterChange("month", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.day")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.day ?? ""}
                                onChange={(e) => handleFilterChange("day", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 31}, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>{d.toString().padStart(2, "0")}</option>
                                ))}
                            </select>
                        </div>
```

`handleFilterChange` (already defined earlier in the file, unchanged)
already accepts `keyof ListTopUpRequestQuery` and any value, so `"year"`/
`"month"`/`"day"` need no new plumbing.

- [ ] **Step 2: Verify in the browser**

Selecting a Year, Month, or Day value and clicking "Apply Filter" narrows
the top-up list to matching entries; clearing back to the blank "All"
option removes that filter.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx"
git commit -m "fix(admin): topup-coins Year/Month/Day filters are real controls, not a code comment"
```

---

### Task 6: Fix fetch failure vs. empty-list distinction

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:1-22, 33-37, 218-234`
  (post-Task-5 state)

**Interfaces:**
- Consumes: `isFailed` from `@/services/HttpService` (new import for this
  file).
- Produces: nothing later tasks depend on.

Same root cause as `bank-accounts` Task 2: `useHttpGet`'s `error` field
can never become truthy. Derive from `state` instead.

- [ ] **Step 1: Add the `HttpService` import**

Current (line 18, the `REQUEST_STATE` import — already imports from
`@/services/HttpService`, just not `isFailed`):
```tsx
import {REQUEST_STATE} from "@/services/HttpService";
```

Change to:
```tsx
import {REQUEST_STATE, isFailed} from "@/services/HttpService";
```

- [ ] **Step 2: Destructure `state` and derive `isFetchFailed`**

Current (line 33):
```tsx
    const {data, isLoading, execute: refetch} = useHttpGet("adminListTopUpRequests", {
```

Change to:
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListTopUpRequests", {
```

Then, right after `const hasPreviousPage = cursorHistory.length > 0;`,
add:
```tsx
    const isFetchFailed = isFailed(state);
```

- [ ] **Step 3: Add a distinct error branch before the empty-results
  branch**

Current (lines 218-234):
```tsx
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div
                                className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="mt-3 text-sm text-muted-foreground">
                                {t("topupCoins.list.loading")}
                            </p>
                        </div>
                    ) : topUps.length === 0 ? (
                        <div className="text-center py-16 bg-muted/30 rounded-lg">
                            <p className="text-lg font-medium text-muted-foreground">
                                {t("topupCoins.list.noResults")}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t("topupCoins.list.noResultsHint")}
                            </p>
                        </div>
                    ) : (
```

Change to:
```tsx
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div
                                className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="mt-3 text-sm text-muted-foreground">
                                {t("topupCoins.list.loading")}
                            </p>
                        </div>
                    ) : isFetchFailed ? (
                        <div className="text-center py-16 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-lg font-medium text-red-600">
                                {t("topupCoins.list.fetchError")}
                            </p>
                        </div>
                    ) : topUps.length === 0 ? (
                        <div className="text-center py-16 bg-muted/30 rounded-lg">
                            <p className="text-lg font-medium text-muted-foreground">
                                {t("topupCoins.list.noResults")}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t("topupCoins.list.noResultsHint")}
                            </p>
                        </div>
                    ) : (
```

- [ ] **Step 4: Add the new translation key to `en.ts`**

Current (`topupCoins.list`, the object's last entry):
```ts
                coins: "coins",
                transfer: "Transfer",
            },
```

Change to:
```ts
                coins: "coins",
                transfer: "Transfer",
                fetchError: "Failed to load top-up requests. Please try again.",
            },
```

- [ ] **Step 5: Add the new translation key to `th.ts`**

Current (`topupCoins.list`, the object's last entry):
```ts
                coins: "เหรียญ",
                transfer: "โอนเหรียญ",
            },
```

Change to:
```ts
                coins: "เหรียญ",
                transfer: "โอนเหรียญ",
                fetchError: "โหลดรายการคำขอเติมเหรียญไม่สำเร็จ กรุณาลองใหม่",
            },
```

- [ ] **Step 6: Add the new translation key to `vi.ts`**

Current (`topupCoins.list`, the object's last entry):
```ts
                coins: "coin",
                transfer: "Chuyển coin",
            },
```

Change to:
```ts
                coins: "coin",
                transfer: "Chuyển coin",
                fetchError: "Không thể tải danh sách yêu cầu nạp coin. Vui lòng thử lại.",
            },
```

- [ ] **Step 7: Verify in the browser**

A simulated fetch failure shows the distinct red error message, not the
"no top-ups found" empty state.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): topup-coins fetch failure is distinct from an empty list"
```

---

### Task 7: Fix pagination loading feedback

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:33, 305-311`
  (post-Task-6 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

Same fix as `bank-accounts` Task 3: only `isLoading` gates the spinner and
`PaginationControls`; add `isMutating` and combine.

- [ ] **Step 1: Destructure `isMutating` and derive `showLoading`**

Current (line 33, post-Task-6 state):
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListTopUpRequests", {
```

Change to:
```tsx
    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListTopUpRequests", {
```

Then, right after the `isFetchFailed` line Task 6 added, add:
```tsx
    const showLoading = isLoading || isMutating;
```

- [ ] **Step 2: Use `showLoading` in the list-rendering ternary**

Current (post-Task-6 state, the ternary's first condition):
```tsx
                    {isLoading ? (
```

Change to:
```tsx
                    {showLoading ? (
```

(The rest of the ternary chain — `isFetchFailed ? (...) : topUps.length
=== 0 ? (...) : (...)` — is unaffected; only the first condition
changes.)

- [ ] **Step 3: Pass `showLoading` to `PaginationControls`**

Current (lines 305-311):
```tsx
                <PaginationControls
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    onPrevious={handlePrevPage}
                    onNext={handleNextPage}
                    isLoading={isLoading}
                />
```

Change to:
```tsx
                <PaginationControls
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    onPrevious={handlePrevPage}
                    onNext={handleNextPage}
                    isLoading={showLoading}
                />
```

- [ ] **Step 4: Verify in the browser**

Clicking Next/Previous after the first page load shows a visible loading
indicator.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx"
git commit -m "fix(admin): topup-coins pagination shows loading feedback on Next/Previous, not just first load"
```

---

### Task 8: Don't close the transfer modal on a failed transfer

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:81-107`
  (post-Task-7 state — unaffected by Tasks 5-7's edits, this function's
  own lines are unchanged since the original read)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

The `finally` block unconditionally closes the modal and clears the
selection, even when `res.state === REQUEST_STATE.FAILED` already
returned early — discarding the admin's context on exactly the case where
they'd want to retry. The `catch` block is also unreachable dead code
(same `useHttpPost` reason as elsewhere) and is removed.

- [ ] **Step 1: Move the close/clear into the success path only**

Current (lines 81-107):
```tsx
    const confirmTransfer = async () => {
        if (!selectedTransfer) return;

        const payload: AdminTopUpWallet = {
            targetUserId: selectedTransfer.localUser.id,
            paymentIntentId: selectedTransfer.topUpRequest.paymentIntentId,
            reason: "Admin top-up from payment",
        };

        try {
            const res = await adminTopUpWallet(payload);
            if (res.state === REQUEST_STATE.FAILED) {
                toast.error(t("topupCoins.toast.error"));
                return;
            }
            toast.success(t("topupCoins.toast.success", {
                amount: formatMinor(selectedTransfer.topUpRequest.amountMinor),
                email: selectedTransfer.localUser.email,
            }));
            refetch();
        } catch (error: any) {
            toast.error(error.message || t("topupCoins.toast.error"));
        } finally {
            setIsTransferModalOpen(false);
            setSelectedTransfer(null);
        }
    };
```

Change to:
```tsx
    const confirmTransfer = async () => {
        if (!selectedTransfer) return;

        const payload: AdminTopUpWallet = {
            targetUserId: selectedTransfer.localUser.id,
            paymentIntentId: selectedTransfer.topUpRequest.paymentIntentId,
            reason: "Admin top-up from payment",
        };

        const res = await adminTopUpWallet(payload);
        if (res.state === REQUEST_STATE.FAILED) {
            toast.error(t("topupCoins.toast.error"));
            return;
        }
        toast.success(t("topupCoins.toast.success", {
            amount: formatMinor(selectedTransfer.topUpRequest.amountMinor),
            email: selectedTransfer.localUser.email,
        }));
        refetch();
        setIsTransferModalOpen(false);
        setSelectedTransfer(null);
    };
```

- [ ] **Step 2: Verify in the browser**

A simulated transfer failure shows the error toast and leaves the confirm
modal open with the same transfer still selected, so the admin can retry;
a successful transfer still closes the modal and clears the selection as
before.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx"
git commit -m "fix(admin): topup-coins keeps the transfer modal open on a failed transfer instead of silently closing it"
```

---

### Task 9: Fix hardcoded fallback text

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:322-330`
  (post-Task-8 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`selectedTransfer.localUser.email || "Unknown"` is a hardcoded, untranslated
fallback.

- [ ] **Step 1: Replace the hardcoded fallback**

Current (lines 322-330, post-Task-8 state — this block's own content is
unaffected by Task 8's edits, which only touched `confirmTransfer` above
it):
```tsx
                    transfer={
                        selectedTransfer
                            ? {
                                userName: selectedTransfer.localUser.email || "Unknown",
                                reason: "User paid via QR",
                                amount: selectedTransfer.topUpRequest.amountMinor / 100,
                                paymentCode: selectedTransfer.topUpRequest.paymentIntentId || undefined,
                                date: format(new Date(selectedTransfer.topUpRequest.createdAt), "dd MMM yyyy, HH:mm"),
                            }
                            : null
                    }
```

Change to:
```tsx
                    transfer={
                        selectedTransfer
                            ? {
                                userName: selectedTransfer.localUser.email || t("topupCoins.modal.unknownUser"),
                                reason: "User paid via QR",
                                amount: selectedTransfer.topUpRequest.amountMinor / 100,
                                paymentCode: selectedTransfer.topUpRequest.paymentIntentId || undefined,
                                date: format(new Date(selectedTransfer.topUpRequest.createdAt), "dd MMM yyyy, HH:mm"),
                            }
                            : null
                    }
```

(`reason: "User paid via QR"` is a separate, out-of-scope finding per the
spec — left unchanged.)

- [ ] **Step 2: Add the new translation key to `en.ts`**

Current (`topupCoins.transferModal`, the object's last entry):
```ts
                confirm: "Confirm Transfer",
                cancel: "Cancel",
                processing: "Processing...",
            },
```

Change to:
```ts
                confirm: "Confirm Transfer",
                cancel: "Cancel",
                processing: "Processing...",
                unknownUser: "Unknown",
            },
```

- [ ] **Step 3: Add the new translation key to `th.ts`**

Current (`topupCoins.transferModal`, the object's last entry — if the
exact wording of the three existing keys shown differs slightly from the
real file, keep them as-is and only add the new `unknownUser` line):
```ts
                confirm: "ยืนยันการโอน",
                cancel: "ยกเลิก",
                processing: "กำลังดำเนินการ...",
            },
```

Change to:
```ts
                confirm: "ยืนยันการโอน",
                cancel: "ยกเลิก",
                processing: "กำลังดำเนินการ...",
                unknownUser: "ไม่ทราบ",
            },
```

- [ ] **Step 4: Add the new translation key to `vi.ts`**

Current (`topupCoins.transferModal`, the object's last entry — if the
exact wording of the three existing keys shown differs slightly from the
real file, keep them as-is and only add the new `unknownUser` line):
```ts
                confirm: "Xác nhận chuyển",
                cancel: "Hủy",
                processing: "Đang xử lý...",
            },
```

Change to:
```ts
                confirm: "Xác nhận chuyển",
                cancel: "Hủy",
                processing: "Đang xử lý...",
                unknownUser: "Không rõ",
            },
```

- [ ] **Step 5: Verify in the browser**

A top-up request with no user email shows the translated "Unknown"/
"ไม่ทราบ"/"Không rõ" text in the confirm modal, in the currently-selected
locale.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): topup-coins transfer modal's unknown-user fallback is translated"
```

---

### Task 10: Status colors use the design-token system

**Files:**
- Modify: `src/app/[lang]/admin/topup-coins/page.tsx:109-144`
  (post-Task-9 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`bg-green-600 text-white border-emerald-200` (mismatched color families
in one className) and `bg-red-100 text-red-800` hardcode raw Tailwind
colors instead of the `success`/`destructive` tokens the systemic-fixes
batch (PR #37) established.

- [ ] **Step 1: Swap the two hardcoded-color badges**

Current (lines 109-144, post-Task-9 state — this function is unaffected
by Tasks 5-9's edits):
```tsx
    const getStatusBadge = (status: string, transferred: boolean) => {
        if (transferred) {
            return (
                <Badge className="bg-green-600 text-white border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1"/>
                    {t("topupCoins.status.transferred")}
                </Badge>
            );
        }

        switch (status) {
            case "Success":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.paid")}
                    </Badge>
                );
            case "Pending":
                return (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Clock className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.awaitingPayment")}
                    </Badge>
                );
            case "Expired":
                return (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                        <XCircle className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.expired")}
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };
```

Change to (only the `transferred` and `Expired` badges' `className`
values change — `Success`/`Pending`/`default` stay exactly as they are):
```tsx
    const getStatusBadge = (status: string, transferred: boolean) => {
        if (transferred) {
            return (
                <Badge className="bg-success text-success-foreground border-success/30">
                    <CheckCircle2 className="w-3 h-3 mr-1"/>
                    {t("topupCoins.status.transferred")}
                </Badge>
            );
        }

        switch (status) {
            case "Success":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.paid")}
                    </Badge>
                );
            case "Pending":
                return (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Clock className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.awaitingPayment")}
                    </Badge>
                );
            case "Expired":
                return (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                        <XCircle className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.expired")}
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };
```

- [ ] **Step 2: Verify in the browser**

The "Transferred" badge and the "Expired" badge both render with the
app's real success/destructive token colors (confirm visually against
another admin page's already-token-based badge, e.g. `manage-users`'s Ban
button) rather than the previous raw green/red.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/topup-coins/page.tsx"
git commit -m "fix(admin): topup-coins status badges use the success/destructive design tokens"
```

---

## Part C: `withdraw-coins`

### Task 11: Fix failed approve/reject reporting success

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:1-22, 69-106`

**Interfaces:**
- Consumes: `isSuccess`, `isFailed` from `@/services/HttpService` (new
  import for this file).
- Produces: the `@/services/HttpService` import this task adds is reused
  by Task 12.

Same root cause as `bank-accounts` Task 1, and the highest-stakes instance
in this batch: `approve`/`reject` (from `useHttpPost("adminWithdrawWallet")`/
`useHttpPost("adminRejectWithdrawRequest")`) never reject — their fetcher
catches internally and resolves with `{state: FAILED}`. A real failure
approving or rejecting a withdrawal currently shows a success toast and
clears the request from view as if money were sent.

- [ ] **Step 1: Add the `HttpService` import**

Current (line 21, the last import line):
```tsx
import {useDebounce} from "@/hooks/utils/useDebounce";
```

Change to:
```tsx
import {useDebounce} from "@/hooks/utils/useDebounce";
import {isSuccess, isFailed} from "@/services/HttpService";
```

- [ ] **Step 2: Fix `handleApprove` and `handleReject`**

Current (lines 69-106):
```tsx
    const handleApprove = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        try {
            await approve({
                withdrawalId: request.withdrawRequest.id,
                reason: adminNote,
                targetUserId: request.localUser.id,
                amount: request.withdrawRequest.amount
            });
            toast.success(t("admin.withdraw.approved", {amount: request.withdrawRequest.amount.toLocaleString()}));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } catch {
            toast.error(t("admin.withdraw.approveFailed"));
        }
    };

    const handleReject = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        try {
            await reject({withdrawalId: request.withdrawRequest.id, reason: adminNote});
            toast.success(t("admin.withdraw.rejected"));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } catch {
            toast.error(t("admin.withdraw.rejectFailed"));
        }
    };
```

Change to:
```tsx
    const handleApprove = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        const res = await approve({
            withdrawalId: request.withdrawRequest.id,
            reason: adminNote,
            targetUserId: request.localUser.id,
            amount: request.withdrawRequest.amount
        });
        if (isSuccess(res)) {
            toast.success(t("admin.withdraw.approved", {amount: request.withdrawRequest.amount.toLocaleString()}));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.withdraw.approveFailed"));
        }
    };

    const handleReject = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        const res = await reject({withdrawalId: request.withdrawRequest.id, reason: adminNote});
        if (isSuccess(res)) {
            toast.success(t("admin.withdraw.rejected"));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.withdraw.rejectFailed"));
        }
    };
```

Note: `admin.withdraw.approveFailed`/`admin.withdraw.rejectFailed` already
exist in all three locales (they were already referenced by the old,
unreachable `catch` blocks) — no new translation keys needed for this
task. On failure, neither `adminNote` nor `selectedRequest` is cleared,
so the admin can see what they were approving/rejecting and retry.

- [ ] **Step 3: Verify in the browser**

A simulated approve or reject failure shows the existing "Failed to
approve"/"Failed to reject" error toast, leaves the request selected with
the note text intact, and does not remove it from the list; a successful
approve/reject still works exactly as before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx"
git commit -m "fix(admin): withdraw-coins failed approve/reject shows a real error instead of a false success"
```

---

### Task 12: Fix fetch failure vs. empty-list distinction

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:39, 315-327`
  (post-Task-11 state)

**Interfaces:**
- Consumes: `isFailed` from `@/services/HttpService` (already imported by
  Task 11).
- Produces: nothing later tasks depend on.

Same fix as the other two pages.

- [ ] **Step 1: Destructure `state` and derive `isFetchFailed`**

Current (line 39):
```tsx
    const {data, isLoading, execute: refetch} = useHttpGet("adminListWithdrawRequests", {
```

Change to:
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListWithdrawRequests", {
```

Then, right after `const hasPreviousPage = cursorHistory.length > 0;`,
add:
```tsx
    const isFetchFailed = isFailed(state);
```

- [ ] **Step 2: Add a distinct error branch before the empty-results
  branch**

Current (lines 315-327):
```tsx
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => <RequestSkeleton key={i}/>)}
                                </div>
                            ) : withdrawRequests.length === 0 ? (
                                <Card className="p-12 text-center backdrop-blur-xl bg-white/60 border-white/30">
                                    <div
                                        className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                        <CreditCard className="w-8 h-8 text-muted-foreground"/>
                                    </div>
                                    <p className="text-lg font-medium">{t("admin.withdraw.list.noResults")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("admin.withdraw.list.noResultsHint")}</p>
                                </Card>
                            ) : (
```

Change to:
```tsx
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => <RequestSkeleton key={i}/>)}
                                </div>
                            ) : isFetchFailed ? (
                                <Card className="p-12 text-center bg-red-50 border-red-100">
                                    <div
                                        className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                        <CreditCard className="w-8 h-8 text-red-500"/>
                                    </div>
                                    <p className="text-lg font-medium text-red-600">{t("admin.withdraw.list.fetchError")}</p>
                                </Card>
                            ) : withdrawRequests.length === 0 ? (
                                <Card className="p-12 text-center backdrop-blur-xl bg-white/60 border-white/30">
                                    <div
                                        className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                        <CreditCard className="w-8 h-8 text-muted-foreground"/>
                                    </div>
                                    <p className="text-lg font-medium">{t("admin.withdraw.list.noResults")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("admin.withdraw.list.noResultsHint")}</p>
                                </Card>
                            ) : (
```

- [ ] **Step 3: Add the new translation key to `en.ts`**

Current (`admin.withdraw.list`, the object's last entry):
```ts
                    noResults: "No withdrawal requests found",
                    noResultsHint: "Try adjusting the filters",
                },
```

Change to:
```ts
                    noResults: "No withdrawal requests found",
                    noResultsHint: "Try adjusting the filters",
                    fetchError: "Failed to load withdrawal requests. Please try again.",
                },
```

- [ ] **Step 4: Add the new translation key to `th.ts`**

Current (`admin.withdraw.list`, the object's last entry):
```ts
                    noResults: "ไม่พบคำขอถอนเงิน",
                    noResultsHint: "ลองปรับตัวกรอง",
                },
```

Change to:
```ts
                    noResults: "ไม่พบคำขอถอนเงิน",
                    noResultsHint: "ลองปรับตัวกรอง",
                    fetchError: "โหลดรายการคำขอถอนเงินไม่สำเร็จ กรุณาลองใหม่",
                },
```

- [ ] **Step 5: Add the new translation key to `vi.ts`**

This file's `admin.withdraw.list` block is corrected in full by Task 18
(the entire `withdraw` object is Thai, not Vietnamese, in this file
today). To avoid Task 18 silently overwriting this task's addition, add
`fetchError` here using the **current, pre-Task-18** (Thai) text for
`noResults`/`noResultsHint`, matching what's actually in the file right
now — Task 18 will correct all of it, including this key, together:

Current (`admin.withdraw.list`, the object's last entry, currently Thai
text — see Task 18 for why):
```ts
                    noResults: "ไม่พบคำขอถอนเงิน",
                    noResultsHint: "ลองปรับตัวกรอง",
                },
```

Change to:
```ts
                    noResults: "ไม่พบคำขอถอนเงิน",
                    noResultsHint: "ลองปรับตัวกรอง",
                    fetchError: "โหลดรายการคำขอถอนเงินไม่สำเร็จ กรุณาลองใหม่",
                },
```

- [ ] **Step 6: Verify in the browser**

A simulated fetch failure shows the distinct red error card, not the "no
withdrawal requests" empty state.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): withdraw-coins fetch failure is distinct from an empty list"
```

---

### Task 13: Fix pagination loading feedback

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:39, 576-584`
  (post-Task-12 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

Same fix as the other two pages.

- [ ] **Step 1: Destructure `isMutating` and derive `showLoading`**

Current (line 39, post-Task-12 state):
```tsx
    const {data, isLoading, state, execute: refetch} = useHttpGet("adminListWithdrawRequests", {
```

Change to:
```tsx
    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListWithdrawRequests", {
```

Then, right after the `isFetchFailed` line Task 12 added, add:
```tsx
    const showLoading = isLoading || isMutating;
```

- [ ] **Step 2: Use `showLoading` in the list-rendering ternary**

Current (post-Task-12 state, the ternary's first condition):
```tsx
                            {isLoading ? (
```

Change to:
```tsx
                            {showLoading ? (
```

(The rest of the ternary chain is unaffected.)

- [ ] **Step 3: Pass `showLoading` to `PaginationControls`**

Current (lines 576-584):
```tsx
                    <div className="flex justify-center">
                        <PaginationControls
                            hasPrevious={hasPreviousPage}
                            hasNext={hasNextPage}
                            onPrevious={handlePrevPage}
                            onNext={handleNextPage}
                            isLoading={isLoading}
                        />
                    </div>
```

Change to:
```tsx
                    <div className="flex justify-center">
                        <PaginationControls
                            hasPrevious={hasPreviousPage}
                            hasNext={hasNextPage}
                            onPrevious={handlePrevPage}
                            onNext={handleNextPage}
                            isLoading={showLoading}
                        />
                    </div>
```

- [ ] **Step 4: Verify in the browser**

Clicking Next/Previous after the first page load shows a visible loading
indicator.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx"
git commit -m "fix(admin): withdraw-coins pagination shows loading feedback on Next/Previous, not just first load"
```

---

### Task 14: Clear the admin note when switching requests

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:339, 449-452`
  (post-Task-13 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

Clicking a different request card (or its "Review" button) while
`adminNote` still holds leftover, un-submitted text from a previous
request leaves that text in the textarea — if unnoticed, it can get
submitted against the wrong withdrawal's audit trail.

- [ ] **Step 1: Clear `adminNote` on the card's own click handler**

Current (line 339):
```tsx
                                            onClick={() => setSelectedRequest(req)}
```

Change to:
```tsx
                                            onClick={() => {
                                                setSelectedRequest(req);
                                                setAdminNote("");
                                            }}
```

- [ ] **Step 2: Clear `adminNote` on the "Review" button's click handler**

Current (lines 449-452):
```tsx
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRequest(req);
                                                        }}
```

Change to:
```tsx
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRequest(req);
                                                            setAdminNote("");
                                                        }}
```

- [ ] **Step 3: Verify in the browser**

Open request A, type a note, then click request B (either via the card or
its Review button) without submitting — B's note field starts empty, not
pre-filled with A's leftover text.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx"
git commit -m "fix(admin): withdraw-coins clears the admin note when switching between requests"
```

---

### Task 15: Relabel the Stats Grid and drop the misleading Total Amount card

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:262-309`
  (post-Task-14 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: `admin.withdraw.stats.pendingThisPage`/`approvedThisPage`/
  `rejectedThisPage` — new keys, distinct from Task 16's bare status-name
  keys (`admin.withdraw.status.*`), which label badges/filters, not these
  cards.

`ListWithdrawRequestResponse` has no aggregate fields — these cards are
computed from `withdrawRequests`, the current page's items only. Per the
spec's sequencing decision: relabel to make the page-only scope explicit,
and drop the "Total Amount" card, since a partial sum labeled "Total
Amount" is the one most likely to be read as a global, actionable figure.

- [ ] **Step 1: Shrink the stats array to 3 relabeled entries**

Current (lines 262-309):
```tsx
                    {/* Stats Grid */}
                    <div className="grid gap-5 md:grid-cols-4">
                        {[
                            {
                                icon: Minus,
                                label: "Pending",
                                color: "from-amber-400 to-orange-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Pending").length
                            },
                            {
                                icon: CheckCircle,
                                label: "Approved",
                                color: "from-emerald-400 to-teal-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Completed").length
                            },
                            {
                                icon: XCircle,
                                label: "Rejected",
                                color: "from-rose-400 to-pink-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Rejected").length
                            },
                            {
                                icon: CreditCard,
                                label: "Total Amount",
                                color: "from-blue-500 to-indigo-600",
                                value: withdrawRequests
                                    .reduce((sum: number, r: WithdrawRequestView) => sum + r.withdrawRequest.amount, 0)
                                    .toLocaleString() + " coins"
                            },
                        ].map((stat, i) => (
                            <Card key={i}
                                  className="group relative overflow-hidden backdrop-blur-xl bg-white/70 border-white/30 shadow-lg hover:shadow-2xl transition-all duration-300">
                                <div
                                    className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", stat.color)}></div>
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="p-3 rounded-2xl bg-white/80 shadow-md group-hover:scale-110 transition-transform">
                                            <stat.icon className="w-7 h-7 text-gray-700"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{stat.label}</p>
                                            <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
```

Change to:
```tsx
                    {/* Stats Grid */}
                    <div className="grid gap-5 md:grid-cols-3">
                        {[
                            {
                                icon: Minus,
                                label: t("admin.withdraw.stats.pendingThisPage"),
                                color: "from-amber-400 to-orange-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Pending").length
                            },
                            {
                                icon: CheckCircle,
                                label: t("admin.withdraw.stats.approvedThisPage"),
                                color: "from-emerald-400 to-teal-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Completed").length
                            },
                            {
                                icon: XCircle,
                                label: t("admin.withdraw.stats.rejectedThisPage"),
                                color: "from-rose-400 to-pink-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Rejected").length
                            },
                        ].map((stat, i) => (
                            <Card key={i}
                                  className="group relative overflow-hidden backdrop-blur-xl bg-white/70 border-white/30 shadow-lg hover:shadow-2xl transition-all duration-300">
                                <div
                                    className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", stat.color)}></div>
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="p-3 rounded-2xl bg-white/80 shadow-md group-hover:scale-110 transition-transform">
                                            <stat.icon className="w-7 h-7 text-gray-700"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{stat.label}</p>
                                            <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
```

(`md:grid-cols-4` → `md:grid-cols-3` since the grid now has 3 cards, not
4; the unused `CreditCard` import stays, since it's still used elsewhere
in this file for the empty-state icon and card avatar icon.)

- [ ] **Step 2: Add the new translation keys to `en.ts`**

Current (`admin.withdraw`, post-Task-11/12 state — insert as a new
`stats` object right after `filters` closes and before `list` opens):
```ts
                filters: {
                    title: "Filter Withdrawal Requests",
                    status: "Status",
                    all: "All",
                    minAmount: "Min Amount",
                    maxAmount: "Max Amount",
                    year: "Year",
                    month: "Month",
                    apply: "Apply Filter",
                    placeholderMin: "e.g. 1000",
                    placeholderMax: "e.g. 50000",
                },
                list: {
```

Change to:
```ts
                filters: {
                    title: "Filter Withdrawal Requests",
                    status: "Status",
                    all: "All",
                    minAmount: "Min Amount",
                    maxAmount: "Max Amount",
                    year: "Year",
                    month: "Month",
                    apply: "Apply Filter",
                    placeholderMin: "e.g. 1000",
                    placeholderMax: "e.g. 50000",
                },
                stats: {
                    pendingThisPage: "Pending (this page)",
                    approvedThisPage: "Approved (this page)",
                    rejectedThisPage: "Rejected (this page)",
                },
                list: {
```

- [ ] **Step 3: Add the new translation keys to `th.ts`**

Current (`admin.withdraw`, same insertion point — between `filters` and
`list`, using the file's actual existing `filters` content, whatever its
exact wording is):
```ts
                list: {
```

Insert immediately before this line (i.e., as the new last entry of
`filters`'s preceding sibling position, right after `filters`'s closing
`},`):
```ts
                stats: {
                    pendingThisPage: "รอดำเนินการ (หน้านี้)",
                    approvedThisPage: "อนุมัติแล้ว (หน้านี้)",
                    rejectedThisPage: "ปฏิเสธแล้ว (หน้านี้)",
                },
```

- [ ] **Step 4: Add the new translation keys to `vi.ts`**

This file's `admin.withdraw` block is corrected in full by Task 18. Add
the `stats` object using real Vietnamese text directly (not the Thai
placeholder pattern used for Task 12's `fetchError` above, since this is
new content Task 18 doesn't otherwise touch):

Current (`admin.withdraw`, same insertion point — between `filters` and
`list`):
```ts
                list: {
```

Insert immediately before this line:
```ts
                stats: {
                    pendingThisPage: "Đang chờ (trang này)",
                    approvedThisPage: "Đã duyệt (trang này)",
                    rejectedThisPage: "Đã từ chối (trang này)",
                },
```

- [ ] **Step 5: Verify in the browser**

The Stats Grid shows 3 cards (Pending/Approved/Rejected, each reading
"... (this page)" or the locale equivalent), no "Total Amount" card.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): withdraw-coins Stats Grid is honest about being page-scoped, drops the misleading Total Amount card"
```

---

### Task 16: Translate the remaining hardcoded strings

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:108-121, 190-192,
  391, 404, 416, 425, 508, 510, 513` (post-Task-15 state)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

This file already uses `t()` extensively — the gap is inconsistency, not
absence. `WithdrawStatus` has exactly 3 values (`Pending`/`Rejected`/
`Completed`, confirmed against the generated enum), so `getStatusConfig`'s
`Partial<Record<...>>` fallback (`label: status`) is genuinely unreachable
defensive code, not a real gap — left untouched.

- [ ] **Step 1: Translate `getStatusConfig`'s labels**

Current (lines 108-119):
```tsx
    const getStatusConfig = (status: WithdrawStatus) => {
        const config: Partial<Record<WithdrawStatus, { color: string; icon: typeof Minus; label: string }>> = {
            Pending: { color: "bg-amber-500 text-white border-amber-400/30", icon: Minus, label: "Pending" },
            Completed: {
                color: "bg-green-600 text-white border-emerald-500/30",
                icon: CheckCircle,
                label: "Approved",
            },
            Rejected: { color: "bg-red-500 text-white border-rose-500/30", icon: XCircle, label: "Rejected" },
        };
        return config[status] ?? { color: "bg-gray-500/15 text-gray-600", icon: Minus, label: status };
    };
```

Change to:
```tsx
    const getStatusConfig = (status: WithdrawStatus) => {
        const config: Partial<Record<WithdrawStatus, { color: string; icon: typeof Minus; label: string }>> = {
            Pending: { color: "bg-amber-500 text-white border-amber-400/30", icon: Minus, label: t("admin.withdraw.status.pending") },
            Completed: {
                color: "bg-green-600 text-white border-emerald-500/30",
                icon: CheckCircle,
                label: t("admin.withdraw.status.approved"),
            },
            Rejected: { color: "bg-red-500 text-white border-rose-500/30", icon: XCircle, label: t("admin.withdraw.status.rejected") },
        };
        return config[status] ?? { color: "bg-gray-500/15 text-gray-600", icon: Minus, label: status };
    };
```

- [ ] **Step 2: Translate `getBankName`'s fallback**

Current (line 121):
```tsx
    const getBankName = (bankId: number) => bankList.find((b) => b.id === bankId)?.name ?? "Unknown Bank";
```

Change to:
```tsx
    const getBankName = (bankId: number) => bankList.find((b) => b.id === bankId)?.name ?? t("admin.withdraw.unknownBank");
```

- [ ] **Step 3: Translate the filter dropdown options**

Current (lines 190-192, post-Task-15 state — unaffected by Task 15's
edits, which only touched the Stats Grid further down):
```tsx
                                            <option value="">{t("admin.withdraw.filters.all")}</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Completed">Approved</option>
                                            <option value="Rejected">Rejected</option>
```

Change to:
```tsx
                                            <option value="">{t("admin.withdraw.filters.all")}</option>
                                            <option value="Pending">{t("admin.withdraw.status.pending")}</option>
                                            <option value="Completed">{t("admin.withdraw.status.approved")}</option>
                                            <option value="Rejected">{t("admin.withdraw.status.rejected")}</option>
```

- [ ] **Step 4: Translate the list card's field labels**

Current (line 391, inside the Amount line):
```tsx
                                                                <span className="font-medium">Amount:</span>
```

Change to:
```tsx
                                                                <span className="font-medium">{t("admin.withdraw.fields.amount")}</span>
```

Current (line 404, inside the Bank line):
```tsx
                                                                <span className="font-medium">Bank:</span>
```

Change to:
```tsx
                                                                <span className="font-medium">{t("admin.withdraw.fields.bank")}</span>
```

Current (line 416, inside the Account line):
```tsx
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">Account:</span>
```

Change to:
```tsx
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">{t("admin.withdraw.fields.account")}</span>
```

Current (line 425, inside the Requested line):
```tsx
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">Requested:</span>
```

Change to:
```tsx
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">{t("admin.withdraw.fields.requested")}</span>
```

- [ ] **Step 5: Translate the side panel's field labels**

Current (line 508, inside the side panel's Bank line):
```tsx
                                                <div><span
                                                    className="font-medium">Bank:</span> {getBankName(selectedRequest.bankAccount.bankId)}
                                                </div>
```

Change to:
```tsx
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.bank")}</span> {getBankName(selectedRequest.bankAccount.bankId)}
                                                </div>
```

Current (line 510, inside the side panel's Account # line):
```tsx
                                                <div><span
                                                    className="font-medium">Account #:</span> {selectedRequest.bankAccount.accountNumber}
                                                </div>
```

Change to:
```tsx
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.accountNumber")}</span> {selectedRequest.bankAccount.accountNumber}
                                                </div>
```

Current (line 513, inside the side panel's Name line):
```tsx
                                                <div><span
                                                    className="font-medium">Name:</span> {selectedRequest.bankAccount.accountName}
                                                </div>
```

Change to:
```tsx
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.name")}</span> {selectedRequest.bankAccount.accountName}
                                                </div>
```

- [ ] **Step 6: Add the new translation keys to `en.ts`**

Current (`admin.withdraw`, post-Task-15 state — the object's last entry,
right after `noteRequired`):
```ts
                noteRequired: "Admin note is required",
            },
```

Change to:
```ts
                noteRequired: "Admin note is required",
                unknownBank: "Unknown Bank",
                status: {
                    pending: "Pending",
                    approved: "Approved",
                    rejected: "Rejected",
                },
                fields: {
                    amount: "Amount:",
                    bank: "Bank:",
                    account: "Account:",
                    requested: "Requested:",
                    accountNumber: "Account #:",
                    name: "Name:",
                },
            },
```

- [ ] **Step 7: Add the new translation keys to `th.ts`**

Current (`admin.withdraw`, post-Task-15 state — the object's last entry;
use the file's actual existing `noteRequired` wording, whatever it is,
and insert the new keys after it):
```ts
                noteRequired: "ต้องระบุหมายเหตุแอดมิน",
            },
```

Change to:
```ts
                noteRequired: "ต้องระบุหมายเหตุแอดมิน",
                unknownBank: "ไม่ทราบธนาคาร",
                status: {
                    pending: "รอดำเนินการ",
                    approved: "อนุมัติแล้ว",
                    rejected: "ปฏิเสธแล้ว",
                },
                fields: {
                    amount: "จำนวน:",
                    bank: "ธนาคาร:",
                    account: "บัญชี:",
                    requested: "วันที่ขอ:",
                    accountNumber: "เลขบัญชี:",
                    name: "ชื่อ:",
                },
            },
```

- [ ] **Step 8: Add the new translation keys to `vi.ts`**

This file's `admin.withdraw` block is corrected in full by Task 18. Add
these keys using real Vietnamese text directly:

Current (`admin.withdraw`, post-Task-15 state — the object's last entry):
```ts
                noteRequired: "ต้องระบุหมายเหตุแอดมิน",
            },
```

Change to:
```ts
                noteRequired: "Cần nhập ghi chú của admin",
                unknownBank: "Không rõ ngân hàng",
                status: {
                    pending: "Đang chờ",
                    approved: "Đã duyệt",
                    rejected: "Đã từ chối",
                },
                fields: {
                    amount: "Số tiền:",
                    bank: "Ngân hàng:",
                    account: "Tài khoản:",
                    requested: "Ngày yêu cầu:",
                    accountNumber: "Số tài khoản:",
                    name: "Tên:",
                },
            },
```

(This block's `noteRequired` value also changes here from the current
Thai text to real Vietnamese, as part of Task 18's full retranslation —
noted here since this step's edit sits at the same insertion point; Task
18 is the authoritative source for the rest of this object's Vietnamese
text.)

- [ ] **Step 9: Verify in the browser**

Every previously-hardcoded label (status badges and filter options,
Amount, Bank, Account, Requested, Account #, Name) now shows real,
translated text when switching between all three locales; the unknown-
bank fallback also translates.

- [ ] **Step 10: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): withdraw-coins translates the remaining hardcoded English labels"
```

---

### Task 17: Fix hardcoded US locale on the "Requested" date

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:1-22, 427-433`
  (post-Task-16 state)

**Interfaces:**
- Consumes: `format` from `date-fns` (new import for this file — the
  app-wide locale is already set globally by `setupDateFns()`, confirmed
  the same way this was verified for the dashboard batch).
- Produces: nothing later tasks depend on.

`new Date(w.createdAt).toLocaleDateString("en-US", {...})` hardcodes US
formatting regardless of the admin's selected locale — the only date in
the financial trio that doesn't go through `date-fns`'s locale-aware
`format()`.

- [ ] **Step 1: Add the `date-fns` import**

Current (line 21, the last import line — this file currently has no
`date-fns` import at all):
```tsx
import {useDebounce} from "@/hooks/utils/useDebounce";
import {isSuccess, isFailed} from "@/services/HttpService";
```

Change to:
```tsx
import {useDebounce} from "@/hooks/utils/useDebounce";
import {isSuccess, isFailed} from "@/services/HttpService";
import {format} from "date-fns";
```

- [ ] **Step 2: Replace the hardcoded-locale date call**

Current (lines 427-433, post-Task-16 state — unaffected by Task 16's
edits, which touched different lines):
```tsx
                                                                <span className="font-mono text-foreground/90">
            {new Date(w.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })}
        </span>
```

Change to:
```tsx
                                                                <span className="font-mono text-foreground/90">
            {format(new Date(w.createdAt), "MMM d, HH:mm")}
        </span>
```

- [ ] **Step 3: Verify in the browser**

Switching locale changes the "Requested" date's month name/format to
match the site's current language, the same way every other date in this
initiative already does (e.g. compare against `topup-coins`'s date-fns
usage).

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx"
git commit -m "fix(admin): withdraw-coins Requested date respects the site's locale instead of hardcoding en-US"
```

---

### Task 18: Retranslate `vi.ts`'s `admin.withdraw` block into real Vietnamese

**Files:**
- Modify: `src/translations/vi.ts:3799-3831` (post-Task-12/15/16 state —
  those tasks already inserted a `fetchError` key using placeholder Thai
  text and new `stats`/`status`/`fields`/`unknownBank` keys using real
  Vietnamese text; this task retranslates everything else in the same
  object into real Vietnamese, and corrects `noteRequired`, which Task 16
  touched with a Vietnamese value already)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on — this is the last task in this
  plan.

Confirmed by direct comparison: every key in `vi.ts`'s `withdraw: {...}`
object is Thai text copy-pasted from `th.ts`, except `filters.title`
(genuinely Vietnamese) and the keys Tasks 12/15/16 already added in real
Vietnamese. Retranslate the remaining Thai-content keys.

- [ ] **Step 1: Replace the remaining Thai strings with real Vietnamese**

Current (the full `withdraw` object as it stands after Tasks 12, 15, and
16 have each made their own additions — Thai text is what needs to
change; keys and structure stay the same):
```ts
            withdraw: {
                title: "การถอนเหรียญ",
                description: "อนุมัติหรือปฏิเสธคำขอถอนเงินของผู้ใช้",
                filters: {
                    title: "Lọc yêu cầu rút tiền",
                    status: "สถานะ",
                    all: "ทั้งหมด",
                    minAmount: "จำนวนขั้นต่ำ",
                    maxAmount: "จำนวนสูงสุด",
                    year: "ปี",
                    month: "เดือน",
                    apply: "ใช้ตัวกรอง",
                    placeholderMin: "เช่น 1000",
                    placeholderMax: "เช่น 50000",
                },
                stats: {
                    pendingThisPage: "Đang chờ (trang này)",
                    approvedThisPage: "Đã duyệt (trang này)",
                    rejectedThisPage: "Đã từ chối (trang này)",
                },
                list: {
                    loading: "กำลังโหลดคำขอ...",
                    noResults: "ไม่พบคำขอถอนเงิน",
                    noResultsHint: "ลองปรับตัวกรอง",
                    fetchError: "โหลดรายการคำขอถอนเงินไม่สำเร็จ กรุณาลองใหม่",
                },
                review: "ตรวจสอบ",
                bankInfo: "ข้อมูลธนาคาร",
                reason: "เหตุผล",
                adminNote: "หมายเหตุแอดมิน",
                notePlaceholder: "ระบุหมายเหตุหรือเหตุผลปฏิเสธ...",
                approve: "อนุมัติ",
                reject: "ปฏิเสธ",
                approved: "อนุมัติ {{amount}} เหรียญ",
                rejected: "ปฏิเสธคำขอถอน",
                approveFailed: "อนุมัติล้มเหลว",
                rejectFailed: "ปฏิเสธล้มเหลว",
                noteRequired: "Cần nhập ghi chú của admin",
                unknownBank: "Không rõ ngân hàng",
                status: {
                    pending: "Đang chờ",
                    approved: "Đã duyệt",
                    rejected: "Đã từ chối",
                },
                fields: {
                    amount: "Số tiền:",
                    bank: "Ngân hàng:",
                    account: "Tài khoản:",
                    requested: "Ngày yêu cầu:",
                    accountNumber: "Số tài khoản:",
                    name: "Tên:",
                },
            },
```

Change to:
```ts
            withdraw: {
                title: "Rút Coin",
                description: "Phê duyệt hoặc từ chối yêu cầu rút tiền của người dùng",
                filters: {
                    title: "Lọc yêu cầu rút tiền",
                    status: "Trạng thái",
                    all: "Tất cả",
                    minAmount: "Số tiền nhỏ nhất",
                    maxAmount: "Số tiền lớn nhất",
                    year: "Năm",
                    month: "Tháng",
                    apply: "Áp dụng bộ lọc",
                    placeholderMin: "ví dụ: 1000",
                    placeholderMax: "ví dụ: 50000",
                },
                stats: {
                    pendingThisPage: "Đang chờ (trang này)",
                    approvedThisPage: "Đã duyệt (trang này)",
                    rejectedThisPage: "Đã từ chối (trang này)",
                },
                list: {
                    loading: "Đang tải yêu cầu...",
                    noResults: "Không tìm thấy yêu cầu rút tiền",
                    noResultsHint: "Hãy thử điều chỉnh bộ lọc",
                    fetchError: "Không thể tải danh sách yêu cầu rút tiền. Vui lòng thử lại.",
                },
                review: "Xem xét",
                bankInfo: "Thông tin ngân hàng",
                reason: "Lý do",
                adminNote: "Ghi chú của admin",
                notePlaceholder: "Nhập ghi chú hoặc lý do từ chối...",
                approve: "Phê duyệt",
                reject: "Từ chối",
                approved: "Đã phê duyệt {{amount}} coin",
                rejected: "Đã từ chối yêu cầu rút tiền",
                approveFailed: "Phê duyệt thất bại",
                rejectFailed: "Từ chối thất bại",
                noteRequired: "Cần nhập ghi chú của admin",
                unknownBank: "Không rõ ngân hàng",
                status: {
                    pending: "Đang chờ",
                    approved: "Đã duyệt",
                    rejected: "Đã từ chối",
                },
                fields: {
                    amount: "Số tiền:",
                    bank: "Ngân hàng:",
                    account: "Tài khoản:",
                    requested: "Ngày yêu cầu:",
                    accountNumber: "Số tài khoản:",
                    name: "Tên:",
                },
            },
```

If the actual file's content at this point differs from the "Current"
block shown above (e.g. because an earlier task's exact insertion landed
slightly differently), match against the real file: every value that is
Thai script needs to become the corresponding Vietnamese value shown in
the "Change to" block above; every value that is already Vietnamese
(added by Tasks 12, 15, 16, or the pre-existing `filters.title`) stays
as-is or is confirmed identical to what's shown here.

- [ ] **Step 2: Verify in the browser**

Switching to the Vietnamese locale on `/vi/admin/withdraw-coins` shows
genuine Vietnamese text throughout — page title, description, filter
labels, stats cards, list messages, review panel, and every toast — with
no Thai script remaining anywhere on the page.

- [ ] **Step 3: Commit**

```bash
git add src/translations/vi.ts
git commit -m "fix(admin): withdraw-coins vi.ts translations are actually Vietnamese, not Thai"
```

---

### Task 19: Fix the mislabeled "no year filter" option

**Files:**
- Modify: `src/app/[lang]/admin/withdraw-coins/page.tsx:227-231`
  (post-Task-18 state — unaffected by any prior task, this line range is
  untouched until now)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

The empty-value ("no filter") option displays the current year as its own
label, then the generated list separately includes that same year again
as a real, selectable option — two entries that render identically but
mean different things.

- [ ] **Step 1: Give the empty option real "All years" copy**

Current (lines 227-231):
```tsx
                                        <select
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.year ?? ""}
                                            onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                                        >
                                            <option value="">{new Date().getFullYear()}</option>
                                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
```

Change to:
```tsx
                                        <select
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.year ?? ""}
                                            onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                                        >
                                            <option value="">{t("admin.withdraw.filters.allYears")}</option>
                                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
```

- [ ] **Step 2: Add the new translation key to `en.ts`**

Current (`admin.withdraw.filters`, post-Task-15 state — the object's last
entry):
```ts
                    placeholderMin: "e.g. 1000",
                    placeholderMax: "e.g. 50000",
                },
```

Change to:
```ts
                    placeholderMin: "e.g. 1000",
                    placeholderMax: "e.g. 50000",
                    allYears: "All years",
                },
```

- [ ] **Step 3: Add the new translation key to `th.ts`**

Current (`admin.withdraw.filters`, post-Task-15 state — the object's last
entry; use the file's actual existing wording for the two placeholder
keys, whatever it is, and insert the new key after them):
```ts
                    placeholderMin: "เช่น 1000",
                    placeholderMax: "เช่น 50000",
                },
```

Change to:
```ts
                    placeholderMin: "เช่น 1000",
                    placeholderMax: "เช่น 50000",
                    allYears: "ทุกปี",
                },
```

- [ ] **Step 4: Add the new translation key to `vi.ts`**

Current (`admin.withdraw.filters`, post-Task-18 state — the object's last
entry, now real Vietnamese per Task 18):
```ts
                    placeholderMin: "ví dụ: 1000",
                    placeholderMax: "ví dụ: 50000",
                },
```

Change to:
```ts
                    placeholderMin: "ví dụ: 1000",
                    placeholderMax: "ví dụ: 50000",
                    allYears: "Tất cả các năm",
                },
```

- [ ] **Step 5: Verify in the browser**

The Year filter's blank/default option reads "All years" (or the locale
equivalent), visually distinct from the real, selectable current-year
option below it.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/withdraw-coins/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): withdraw-coins Year filter's blank option reads \"All years\" instead of duplicating the current year"
```

---

## After all tasks: whole-branch check

Once all 19 tasks are committed, before opening a PR:

- [ ] Run `npx tsc --noEmit` and confirm zero errors.
- [ ] Run `pnpm test:unit` and confirm it's still 157/157 (or more, if any
  new tests exist by then) passing.
- [ ] Run ESLint scoped to the 6 touched files and confirm no new errors.
- [ ] Do one full manual pass on all three pages — every item in the
  spec's "Testing" section — not just the per-task checks done in
  isolation.
- [ ] Confirm `git status` is clean relative to the branch (no stray
  uncommitted files, no dirtied `tsconfig.tsbuildinfo`) before pushing.
