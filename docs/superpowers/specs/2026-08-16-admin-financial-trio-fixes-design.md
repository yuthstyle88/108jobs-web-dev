# Admin bug-fix batch: the financial trio (bank-accounts, topup-coins, withdraw-coins)

## Context

Fifth batch from the original admin audit — the last three admin pages,
covering real money flows: bank-account verification, top-up transfers, and
withdrawal approvals. All findings below were re-verified against current
source immediately before this spec (not recalled from the earlier audit)
— every citation is the current file:line, confirmed accurate, and every
backend type referenced was read directly from the generated
`108jobs-client` package.

This batch is noticeably larger than prior ones (14 fixes across 3 files,
vs. 7–14 per prior batch) because these three pages share the same root
causes seen throughout this initiative, and `withdraw-coins` in particular
(590 lines) has accumulated more gaps than any single page fixed so far.
Two things surfaced during this batch's brainstorm that shape the design:

- All three pages' approve/reject/verify actions wrap a `useHttpPost` call
  in `try/catch` — but `useHttpPost`'s fetcher catches every exception
  internally and always *resolves* (never rejects) with
  `{state: REQUEST_STATE.FAILED, err}`. Every one of these `catch` blocks
  is therefore dead code: a real backend failure on approving or rejecting
  a real money transaction currently shows a success toast and moves on.
  `topup-coins`'s `confirmTransfer` already does this correctly (checks
  `res.state === REQUEST_STATE.FAILED` before showing success) — the fix
  for `bank-accounts` and `withdraw-coins` adopts that same pattern, not
  the try/catch that can't work.
- `withdraw-coins`'s Stats Grid (Pending/Approved/Rejected/Total Amount) is
  computed by reducing over `withdrawRequests` — the current page's items
  only. `ListWithdrawRequestResponse` (confirmed by reading the generated
  type) has no aggregate/total fields at all, so an accurate global total
  isn't computable client-side without fetching every page. Decided during
  brainstorming: relabel the cards to be honest about their scope rather
  than compute a number that looks authoritative but isn't, and drop the
  "Total Amount" card specifically, since a partial sum is the one most
  likely to feed into a real financial judgment call.

## Design

### A. `bank-accounts`

**1. Failed verification reports success, with the wrong copy even if it
weren't broken** (`page.tsx:57-65`)
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
The `catch` block can never run (see Context). Fix: check the returned
`RequestState` directly, matching the `isSuccess`/`isFailed` pattern
already proven in `manage-picture`/`manage-category`/`manage-riders`:
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
`isSuccess`/`isFailed` come from `@/services/HttpService` (already the
established import). `admin.bankManagement.verifyFailed` is a new
translation key — the old code had no real failure copy at all (it reused
the button's own label).

**2. Fetch failures indistinguishable from "no accounts"** (`page.tsx:27`)
`useHttpGet("adminListBankAccounts", {...})` only destructures `data`/
`isLoading`. Add `state` and derive `isFailed(state)`, matching the
established fix pattern; add a distinct error branch before the empty-state
branch.

**3. Pagination gives no feedback after the first page** (`page.tsx:27`)
Only `isLoading` gates the spinner and `PaginationControls`. Destructure
`isMutating` (already exposed by `useHttpGet`, confirmed:
`isMutating = swr.isValidating`) and use `isLoading || isMutating` for
both, matching `manage-users`' already-fixed equivalent.

**4. Untyped list item** (`page.tsx:147`)
`bankAccounts.map((item: any) => {...})` — the real type,
`BankAccountView = {userBankAccount: BankAccount, bank: Bank}`, matches
the existing destructuring (`item.bank`, `item.userBankAccount`) exactly.
Swap `any` for `BankAccountView`, imported from `108jobs-client`.

### B. `topup-coins`

**1. Year/Month/Day filters were never actually built** (`page.tsx:205-206`)
```tsx
{/* Year, Month, Day — same pattern */}
{/* ... abbreviated for brevity ... */}
```
The backend (`ListTopUpRequestQuery`) has `year`/`month`/`day` fields,
confirmed present and already wired through `debouncedFilters` (any key
added to `filters` flows straight into the query). Add three real controls
matching the pattern already used in `withdraw-coins` for the same fields
(a year `<select>` populated with the current year and the last 4, a month
`<select>` numbered 1–12) — `withdraw-coins` is the reference
implementation for this exact UI, already shipped and working.

**2. Fetch failures indistinguishable from "no results"** (`page.tsx:33`)
Same fix as bank-accounts #2: destructure `state`, derive `isFailed(state)`,
add a distinct error branch.

**3. Pagination gives no feedback after the first page** (`page.tsx:33`)
Same fix as bank-accounts #3: destructure `isMutating`, gate spinner/
pagination on `isLoading || isMutating`.

**4. A failed transfer closes the modal exactly like a success** (`page.tsx:81-107`)
```tsx
} catch (error: any) {
    toast.error(error.message || t("topupCoins.toast.error"));
} finally {
    setIsTransferModalOpen(false);
    setSelectedTransfer(null);
}
```
The `if (res.state === REQUEST_STATE.FAILED)` branch already correctly
detects failure and shows an error toast — but the `finally` block still
unconditionally closes the modal and clears the selection, discarding the
admin's context on exactly the case where they'd want to retry. Move the
modal-close/selection-clear into only the success path; on failure, leave
the modal open so the admin can see what they were confirming and retry.
The now-dead `catch` block (unreachable for the same `useHttpPost` reason
as elsewhere) is removed rather than kept as unreachable dead code.

**5. Hardcoded, untranslated fallback text** (`page.tsx:324`)
`selectedTransfer.localUser.email || "Unknown"` — add
`topupCoins.modal.unknownUser` and use it as the fallback.

**6. Status colors bypass the design-token system** (`page.tsx:112, 136`)
`bg-green-600`/`border-emerald-200` (transferred badge, mismatched color
families within the same className) and `bg-red-100 text-red-800`
(expired badge) hardcode raw Tailwind colors instead of the `success`/
`destructive` tokens the systemic-fixes batch (PR #37) established. Swap
both to `bg-success text-success-foreground` and
`bg-destructive/10 text-destructive` respectively (matching the
tinted-background style already used by the adjacent `Pending`/`Paid`
badges in the same function, which already use light-tint + dark-text
pairs like `bg-amber-100 text-amber-800` — those two are left alone, only
the two hardcoded-off-token ones change).

### C. `withdraw-coins`

**1. Failed approve/reject reports success** (`page.tsx:69-106`)
Same root cause and fix as bank-accounts #1 — both `handleApprove` and
`handleReject` wrap `approve({...})`/`reject({...})` in an unreachable
`try/catch`. This is the batch's highest-stakes instance: a failed
withdrawal approval (e.g. insufficient platform balance, a payment
provider error) currently shows "Rider approved" — sorry, "Approved" —
and clears the request from view as if money were sent. Fix both handlers
with the `isSuccess`/`isFailed` pattern:
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
        amount: request.withdrawRequest.amount,
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
```
`handleReject` mirrors this exactly, using `reject(...)` and
`admin.withdraw.rejected`/`admin.withdraw.rejectFailed`. On failure,
neither `adminNote` nor `selectedRequest` is cleared — the admin can see
what they were rejecting/approving and retry, same principle as
`topup-coins` #4.

**2. Fetch failures indistinguishable from "no results"** (`page.tsx:39`)
Same fix as the other two pages: destructure `state`, derive
`isFailed(state)`, add a distinct error branch (this page's list already
has a loading skeleton and an empty state — add the error branch as a
third, distinct branch alongside them).

**3. Pagination gives no feedback after the first page** (`page.tsx:39`)
Same fix as the other two pages: destructure `isMutating`, gate the
loading skeleton and `PaginationControls` on `isLoading || isMutating`.

**4. `adminNote` isn't cleared when switching requests** (`page.tsx:339`)
```tsx
onClick={() => setSelectedRequest(req)}
```
Clicking a different request card while `adminNote` still has leftover
text from a previous, un-submitted request leaves that text in the
textarea — if the admin doesn't notice and submits, the wrong note gets
attached to the wrong withdrawal's audit trail. Fix: clear `adminNote`
whenever `selectedRequest` changes to a different request, by resetting
it in both places a new selection is made (the card's `onClick` and the
"Review" button's `onClick`, which currently do the same
`setSelectedRequest(req)` independently):
```tsx
onClick={() => {
    setSelectedRequest(req);
    setAdminNote("");
}}
```

**5. Stats Grid computes totals from only the current page**
(`page.tsx:262-309`)
Per the sequencing decision: relabel rather than fetch-everything or fake
an aggregate. Change the three count cards' labels to make the page-only
scope explicit — `admin.withdraw.stats.pendingThisPage`,
`statsApprovedThisPage`, `statsRejectedThisPage` (new keys, distinct from
finding #6's bare status-name keys below: a stat card reading "Pending
(this page)" and a status badge reading plain "Pending" are different
copy for different contexts, even though today they happen to share the
same hardcoded string) — and remove the fourth "Total Amount" card
entirely. A partial sum of 5 items labeled "Total Amount" is the one most
likely to be read as a real platform-wide figure and acted on. The
`stat.color`/`stat.icon` array shrinks from 4 entries to 3.

**6. Pervasive hardcoded English strings** (throughout)
Unlike `manage-picture` before its i18n batch (zero translation calls at
all), this file already uses `t()` extensively — the gap is inconsistency,
not absence. Add `t()` calls for every remaining hardcoded string under
new `admin.withdraw.*` keys:
- Status labels inside `getStatusConfig` (`page.tsx:110-118`):
  `"Pending"`/`"Approved"`/`"Rejected"` → `t("admin.withdraw.status.pending")`
  etc. (the `Partial<Record<WithdrawStatus, ...>>` fallback branch's
  `label: status` stays as-is — `WithdrawStatus` only has exactly these
  three values, confirmed against the generated enum, so that branch is
  genuinely unreachable defensive code, not a real gap).
- Filter dropdown options (`page.tsx:190-192`): `Pending`/`Approved`/
  `Rejected` option labels → same three new status keys, reused.
- Field labels scattered through the list card and side panel
  (`page.tsx:391, 404, 416, 425, 508, 510, 513`): `"Amount:"`, `"Bank:"`,
  `"Account:"`, `"Requested:"`, and the side panel's `"Bank:"`,
  `"Account #:"`, `"Name:"` → `admin.withdraw.fields.{amount,bank,account,
  requested,accountNumber,name}` (the list card's "Bank:" and the side
  panel's "Bank:" share one key; the rest are distinct labels appearing
  once each).
- `getBankName`'s fallback (`page.tsx:121`): `"Unknown Bank"` →
  `t("admin.withdraw.unknownBank")`.

**7. "Requested" date hardcodes US locale** (`page.tsx:427-432`)
```tsx
{new Date(w.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
})}
```
Every other date in this initiative goes through `date-fns`'s `format()`,
which respects the app-wide locale already set by `setupDateFns()`
(confirmed: `en`/`th`/`vi` all load real `date-fns/locale` resources, set
via `setDefaultOptions`) — this is the only date in the three financial
pages that bypasses it with a hardcoded locale string. Fix: replace with
`format(new Date(w.createdAt), "MMM d, HH:mm")`, adding the already-used-
elsewhere `format` import from `date-fns`.

**8. `vi.ts`'s entire `admin.withdraw` block is Thai text, not Vietnamese**
(translation file, discovered while gathering exact translation content for
the implementation plan)
Every key under `vi.ts`'s `withdraw: {...}` object (`src/translations/vi.ts:3799-3831`)
is Thai copy-pasted verbatim from `th.ts`'s equivalent block, except
`filters.title` (`"Lọc yêu cầu rút tiền"`, genuinely Vietnamese) — even
`title` itself (`"การถอนเหรียญ"`) is Thai, not Vietnamese. A Vietnamese
admin using this page today sees Thai throughout: the page title,
description, every filter label, list messages, review/bank-info/reason/
note labels, and every approve/reject toast. Fix: retranslate the entire
block into real Vietnamese, matching `th.ts`'s structure (keys, nesting,
interpolation placeholders) with genuine Vietnamese content, in the same
register already established elsewhere in `vi.ts` for this exact page
family (`topupCoins.title: "Nạp Coin"` → `withdraw.title: "Rút Coin"` is
the natural parallel).

**9. The "no year filter" option is mislabeled** (`page.tsx:227-231`)
```tsx
<option value="">{new Date().getFullYear()}</option>
{Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
    <option key={y} value={y}>{y}</option>
))}
```
The empty-value ("no filter") option displays the current year as its own
label, then the generated list separately includes that same year again
as a real, selectable option — two entries that render identically
("2026") but mean different things (no filter vs. an explicit year
filter). Fix: give the empty option real "All years" copy instead:
```tsx
<option value="">{t("admin.withdraw.filters.allYears")}</option>
```

### Out of scope for this batch

- **`bank-accounts` has no date-range filter UI** — `ListBankAccountQuery`
  does support `year`/`month`/`day`, same as the other two pages, but
  unlike `topup-coins` there's no half-finished comment or other signal
  this was ever started here. A genuinely missing feature, not a shipped-
  incomplete bug — deferred, matching the precedent set for
  `manage-job-board`'s missing `sort`/`intendedUse` controls in an earlier
  batch.
- **Rejecting a bank account** — `VerifyBankAccount` (the actual request
  type behind `adminVerifyBankAccount`) has only `bankAccountId`, no
  approve/reject boolean or reason field at all. Unlike the rider
  Reject button added in an earlier batch (where the backend already had
  the capability, just unwired), there's genuinely no backend support for
  rejecting a bank account today — nothing to wire up.
- **`topup-coins`'s hardcoded `reason` strings** (`"Admin top-up from
  payment"` sent to the backend, `"User paid via QR"` shown in the
  confirm modal) — always the same value regardless of actual context.
  Not misleading to an end user (admin-internal audit text), and changing
  it meaningfully would need product input on what the reason *should*
  say per top-up source: deferred rather than guessed at here.
- **`withdraw-coins`'s approve payload re-sending `amount`** — the
  frontend echoes `request.withdrawRequest.amount` back unmodified (no UI
  lets an admin edit it), so this behaves correctly today, but whether the
  backend trusts a client-submitted amount vs. re-deriving it server-side
  from the stored request is a backend-trust question, not a frontend bug
  this batch can safely resolve without dedicated backend investigation.
- **Site Settings / config CRUD, captcha editability** — carried over from
  the dashboard batch's deferral, still not started, unrelated to this
  batch's pages.
- **Full dark-mode / visual-token work beyond the specific hardcoded-color
  fixes listed above** — already covered by the systemic-fixes batch;
  nothing here reopens it.

## Testing

No component-test infrastructure exists for any of the three files
(matches every prior batch). Verify manually in the browser preview:

- `bank-accounts`: a simulated verify failure shows real error copy, not
  the "Approve" label text; a simulated fetch failure shows distinct error
  copy, not the empty-account state; clicking Next/Previous after the
  first load shows a visible loading indicator.
- `topup-coins`: Year/Month/Day filters actually narrow the list and
  round-trip through the URL/query the same way Status/Min/Max already
  do; a simulated fetch failure shows real error copy; a simulated
  transfer failure keeps the confirm modal open with the same transfer
  still selected (not silently closed); the transferred/expired badges
  use the app's real success/destructive colors, not raw green/red.
- `withdraw-coins`: a simulated approve/reject failure shows real error
  copy and leaves the request selected with the note intact for retry;
  opening request A, typing a note, then clicking request B without
  submitting shows an empty note field for B; the Stats Grid shows 3
  page-scoped cards (no "Total Amount"), with labels that read as
  page-scoped, not global; the Requested date matches the site's current
  locale (not always US English) when switching languages; the Year
  filter's blank option reads "All years," not a bare "2026" duplicate of
  the real 2026 option; every previously-hardcoded label (Amount, Bank,
  Account, Requested, status names) is now real, translated text in all
  three locales; switching to Vietnamese shows genuine Vietnamese text
  throughout the entire page (title, filters, list, review panel, toasts)
  instead of Thai.
