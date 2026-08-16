# Admin bug-fix batch: manage-picture + manage-users + manage-riders

## Context

Third batch from the original admin audit, following the merged systemic
fixes (PR #37) and the merged manage-category/manage-job-board batch
(PR #38). This batch covers `manage-picture` (a settings page, no
counterpart) and `manage-users`/`manage-riders` (two structurally similar
moderation-list pages the earlier audit found had diverged significantly
from each other, in ways that turn out to be more than cosmetic — one
page's more careful implementation is the fix for the other's real bugs).

All findings below were re-verified against current source immediately
before this spec (not recalled from the earlier audit) — every citation is
the current file:line, confirmed accurate. Two things surfaced during
re-verification that shape the fixes:

- `manage-users`' fetch-error handling has the *exact same* root cause as
  the bug the prior batch fixed in `manage-category`: `useHttpGet`'s
  `error` field can never become truthy on a real failure (the hook's
  fetcher catches internally and always resolves). `manage-riders`
  already works around this correctly, via `usePaginatedRiders` deriving a
  real error from `fetchState.state === REQUEST_STATE.FAILED`. The fix for
  `manage-users` adopts the same correct pattern, not the field that can't
  work.
- `manage-riders`' missing Reject button isn't just a missing button —
  the backend (`AdminVerifyRiderRequest`) already accepts an optional
  `reason?: string | null` alongside `approve: boolean`, and the
  translation keys for a rejection-reason input already exist unused. The
  fix adds a real (if lightweight) reason-collection UI, not just a bare
  button.

## Design

### A. `manage-picture`

**1. Upload labels don't open the file picker** (`page.tsx:159-168,
220-228`)
Neither `<label>` has `htmlFor`/`id` pairing with its `<input
type="file">`, and neither wraps the input. Add matching `id`/`htmlFor`
pairs (`logo-upload`/`banner-upload`) so clicking the label text opens the
picker, same as clicking the native input control already does.

**2. Page advertises SVG support it doesn't have** (`page.tsx:138-139`)
Heading says "Site Logo (Recommended: 512×512px, PNG/SVG)" but SVG is
explicitly blocked by both the extension blocklist and the MIME allowlist
— on purpose, for security (arbitrary SVG can carry embedded scripts).
Fix the copy, not the validation: drop "SVG" from both the logo and
banner headings.

**3. No way to tell "saved" from "unsaved preview"** (`page.tsx:28-32,
142-156, 193-217`)
`iconPreview`/`bannerPreview` silently prefer a locally-picked-but-not-yet-
uploaded file over the actually-saved image, under an unconditional
"Current Logo"/"Current Banner" label — worse than no distinction, since
it's actively mislabeled. Add a visual state (a small badge, e.g. "Preview
— not saved yet") shown only when the override is active
(`iconPreviewOverride`/`bannerPreviewOverride` is non-null), and relabel
the box "Preview" instead of "Current Logo/Banner" while an override is
showing.

**4. No way to remove an image, only replace** (whole file)
The backend already has the endpoints
(`deleteSiteIcon`/`deleteSiteBanner`, confirmed present and already
wrapped through the generic `WrappedApi108Jobs` client) — this is a
missing-UI gap, not a missing-backend one. Add
`useHttpDelete("deleteSiteIcon")`/`useHttpDelete("deleteSiteBanner")` and
a "Remove" button next to each "Upload New" control, shown only when a
live (non-preview) image currently exists. On success, refresh
`useSiteStore` the same way a successful upload already does (via
`callHttp("getSite")`).

**5. Zero i18n, plus a naming mismatch**
This is the only one of 9 admin pages with zero i18n — sweep the whole
page into `t()` calls under a new `admin.picture.*` namespace, matching
the existing convention. While touching the admin sidebar's translations
for this page anyway: the sidebar nav calls it "Manage Picture"
(`admin.layout.sidebar.nav.managePicture.title`) but the page's own
heading says "Site Appearance" — update the sidebar's title to "Site
Appearance" to match what the page itself says, in all three locales.

### B. `manage-users`

**1. Broken `{reason}`/`{name}` interpolation** (translation files)
`manageUsers.banConfirmationModal.successWithReason` uses single-brace
`{reason}` in en/th/vi — i18next needs `{{reason}}`. Fix all three. While
in the same area: `unbannedSuccess` has the identical single-brace bug in
th/vi only (en's version has no placeholder at all, so it doesn't exhibit
the symptom there) — fix those two as well, and correct a genuine
mistranslation found alongside it: `vi.ts`'s `unbannedSuccess` currently
reads "Đã cấm {name}" ("**Banned** {name}") when it should say unbanned.

**2. Fetch failure indistinguishable from "no users"** (`page.tsx:30`)
`error` is never read from `useHttpGet("listUsers", ...)` — and per the
Context section above, that field wouldn't help anyway. Fix the way
`manage-riders` already correctly does it: derive a real error from the
hook's own `state` (`state.state === REQUEST_STATE.FAILED`), not from
`error`. Add a distinct error branch before the empty-state branch.

**3. Pagination gives zero feedback after the first load** (`page.tsx:30`)
Only `isLoading` (`swr.isLoading`, true pre-first-data only) gates the
list spinner and `PaginationControls`'s `isLoading` prop; because
`keepPreviousData` is on, it never fires again on Next/Previous.
`useHttpGet` already separately exposes `isMutating` (`swr.isValidating`,
which does fire on revalidation) — destructure it and use it for both the
spinner and `PaginationControls`, matching how `usePaginatedRiders`
already maps the equivalent value.

**4. Fake "X Handle" link** (`page.tsx:280-284`,
`BanConfirmationModal/index.tsx:101-117`)
`person.displayName` (a short display name, not a social handle — `Person`
has no handle/social field at all) is repurposed into a fake
`x.com/<handle>` link. Remove this block from `BanConfirmationModal`
entirely, and stop passing `handle` from `manage-users/page.tsx`'s
`BanConfirmationModal` invocation — there's nothing honest to show here
until this app actually has a real handle field.

**5. Ban button fails contrast at rest** (`page.tsx:241`)
`bg-red-500` (resting) is ~3.76:1 against white text, failing WCAG AA;
`hover:bg-red-700` (~6.47:1) and the modal's own confirm button's
`bg-red-600` (~4.83:1) both already pass. Change the resting background
from `bg-red-500` to `bg-red-600`, matching the modal's own already-correct
choice — one class, no other change.

**6. Neither modal has real dialog semantics** (`BanConfirmationModal/
index.tsx`, `UserDetailModal/index.tsx`)
Add `role="dialog"` + `aria-modal="true"` to both. Add an `Escape`-key
handler (matching the pattern from the prior batch's category-page
lightbox fix — a `useEffect` scoped to whether the modal is open,
registering/cleaning up a `keydown` listener). `BanConfirmationModal`
already closes on backdrop click; `UserDetailModal` currently has no
backdrop click-to-close at all (only its X button works) — add
`onClick={onClose}` to `UserDetailModal`'s backdrop, matching
`BanConfirmationModal`'s existing pattern. Full programmatic focus-trap
(cycling Tab within the modal) is explicitly out of scope — this is a
lightweight fix (keyboard escape + landmark role + click-outside), not a
full accessible-dialog implementation requiring a focus-management
library.

### C. `manage-riders`

**1. Reject is fully wired except the button** (`page.tsx:45-55,
233-249`)
`handleVerify(riderId, approve)` already supports `approve: false`, the
backend (`AdminVerifyRiderRequest`) already accepts an optional
`reason?: string | null` alongside it, and `admin.riders.rejectionReason`/
`rejectionReasonPlaceholder` translation keys already exist unused. Add a
Reject button next to Approve. On click, reveal a small inline optional
textarea (using the existing `rejectionReasonPlaceholder` copy) with
"Confirm Reject"/"Cancel" — on confirm, call
`handleVerify(rider.id, false)` with the reason threaded through
(`verifyRider({riderId, approve: false, reason})`). Keep this inline on
the existing card (matching Riders' established single-tier,
everything-inline layout) rather than introducing a new modal component.

**2. Bicycle and Motorcycle share the same icon** (`page.tsx:17-21`)
Both map to lucide-react's `<Bike>`. `lucide-react` has a distinct
`Motorbike` icon — already imported and used elsewhere in this exact
codebase (`AdminSidebar`'s own "Manage Riders" nav icon). Import it here
too and map `Motorcycle: <Motorbike className="w-4 h-4"/>`, leaving
`Bicycle`'s `<Bike>` and `Car`'s `<Car>` unchanged.

**3. Real photo never rendered** (`page.tsx:161-166`)
Riders shows a static `UserCheck` icon in a colored box regardless of the
actual person, even though `RiderView` embeds the same `Person` type (with
`avatar?: DbUrl`) that `manage-users` already renders correctly via
`<AvatarImage src={person.avatar}/>`. Replace the static icon block with
the person's avatar image when `person.avatar` exists, falling back to the
current icon treatment when it doesn't (new riders/edge cases without a
photo yet) — not a full redesign of the card, just swapping what fills
that one box.

### Out of scope for this batch

- **`manage-picture`'s remaining structural/visual divergences** from
  sibling pages (heavier card treatment, fixed vs. responsive container
  width, the Logo/Banner section layout inconsistency within the same
  file) — visual-design work, not bugs, deferred to a later polish pass
  (same disposition the prior two batches gave equivalent findings).
- **Full programmatic focus-trap** for the two `manage-users` modals — see
  B.6 above; the lightweight fix ships, the full one doesn't.
- **`manage-riders`' remaining cross-page divergences** with
  `manage-users` not listed above (plain vs. gradient-clipped heading,
  `dark:` class coverage, two-tier vs. single-tier drill-down structure) —
  visual/architectural differences, not bugs, deferred.
- **Every other page's audit findings** — `dashboard`, the financial trio
  (bank-accounts/topup-coins/withdraw-coins) — still queued for future
  batches per the original sequencing.

## Testing

Same situation as both prior batches: no component-test infrastructure
exists for any of the six files this touches (`manage-picture/page.tsx`,
`manage-users/page.tsx`, `manage-riders/page.tsx`,
`BanConfirmationModal/index.tsx`, `UserDetailModal/index.tsx`,
`CategoryRow`-equivalent — riders has no separate row component, it's
inline). Verify manually in the browser preview:

- `manage-picture`: clicking each "Upload New" label text opens its file
  picker; the logo/banner headings no longer mention SVG; picking a file
  shows a clear "not saved yet" indicator distinct from the live image;
  "Remove" appears only when a live image exists and actually clears it;
  switching locale changes every string on the page including the sidebar
  nav label ("Site Appearance" in all three languages, matching the page
  heading).
- `manage-users`: a simulated fetch failure shows real error copy, not the
  empty-user-list state; clicking Next/Previous after the first load shows
  a visible loading indicator; banning a user with a reason shows the
  reason substituted into the toast (not literal `{reason}`/`{{reason}}`
  text) in all three locales; the ban confirmation modal no longer shows
  an "X Handle" link; the Ban button is legible at rest, not just on
  hover; both modals close on Escape and on backdrop click.
- `manage-riders`: a Reject button appears next to Approve; rejecting
  (with or without a reason) removes the rider from the unverified list
  and shows the correct toast; Bicycle and Motorcycle riders show visually
  distinct vehicle icons; a rider with a photo shows their real photo, not
  the generic icon.
