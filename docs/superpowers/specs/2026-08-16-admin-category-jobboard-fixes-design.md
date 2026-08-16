# Admin bug-fix batch: manage-category + manage-job-board

## Context

Continuing the admin UI/UX initiative after the systemic fixes (PR #37,
merged): design tokens and the shared `AdminHeader`/`AdminSidebar` are
fixed. This batch is the next item from the original audit's sequencing —
per-page bugs, starting with the two pages that had the most Critical
findings: `manage-category` and `manage-job-board`.

Both pages were re-verified against current source immediately before this
spec (not just recalled from the earlier audit) — every finding below cites
the current file:line, confirmed still accurate. Two things surfaced during
re-verification that change the shape of the fix from what the original
audit implied:

- `manage-category`'s edit flow can't simply start calling an "update"
  endpoint with the same shape as create — the generated `EditCategory`
  type only has `title`/`description`/`sidebar`/`nsfw`/
  `postingRestrictedToMods`/`visibility`, no `name`, `icon`, or `banner`.
  The fix persists name (via `title`) and description; icon/banner already
  persist correctly today when a new file is picked in upload mode — that
  part isn't broken, only plain field edits are.
- `manage-job-board`'s commented-out Status filter was speculative from the
  start: the `Search` request type has no `hidden`/`status` field at all,
  so there's no query param to uncomment into. Decided during brainstorming
  (comprehensive-sweep-if-in-doubt logic doesn't apply here — this is a
  real backend gap, not a frontend wiring gap): remove the Status filter
  control entirely rather than fake-filter client-side against a
  cursor-paginated, server-side-limited result set. Re-add it once the
  backend actually supports filtering by hidden state.

## Design

### A. `manage-category`

**1. Dead loading-spinner condition** (`page.tsx:226`)
`tree.length === undefined` can never be true — `tree` is always an array
(`buildCategoriesTree(...)` always returns `CategoryNodeView[]`). Replace
the loading check with the hook's own `isLoading` flag (already
destructured at `page.tsx:51`, just unused for this branch) instead of a
condition on `tree`.

**2. Fetch errors indistinguishable from empty state** (`page.tsx:51,
226-238`)
`useHttpGet("listCategories")`'s `error` field is never read. Destructure
it and add a real error branch (distinct copy + a retry action calling
`refetch()`) before falling through to the empty-state branch, so a failed
fetch doesn't look like "you have zero categories."

**3. Failed category creation reports success** (`page.tsx:140-151`)
The `createCategory(...)` call result is discarded; `toast.success(...)`
fires unconditionally. Guard it with `isSuccess`/`isFailed` — both already
imported and already used two blocks above for the icon/banner uploads —
matching that exact pattern: success toast only on `isSuccess`, error toast
on `isFailed`.

**4. Edits never persist** (`page.tsx:151-155`)
Add `const {execute: editCategory} = useHttpPut("editCategory");` and call
it in the edit branch of `handleSave` with
`{categoryId: editingCategory.category.id, title: form.name, description:
form.description}`, guarded the same way as create (`isSuccess`/
`isFailed`, matching toasts). Icon/banner in upload mode are unaffected —
`uploadIcon`/`uploadBanner` already run earlier in the same function
regardless of `isAddingNew`.

**5. "Coming soon" tooltip unreachable by touch/keyboard** (`page.tsx:
202-219`)
The button is `disabled`, so a CSS-focus fix wouldn't help — disabled
controls can't receive focus. Instead: make it a real (non-disabled)
button whose `onClick` shows `toast(t("admin.category.addRootComingSoon"))`
(or similar copy), dropping the hover-only tooltip span entirely. Every
input method reaches the same message this way — click, tap, or
Enter/Space after tabbing to it.

**6. Lightbox close button has no real handler** (`page.tsx: 289-309`)
Give the `×` button its own `onClick={(e) => { e.stopPropagation();
setLightboxOpen(false); }}` and `aria-label`. While touching this block:
add an `Escape`-key listener (a `useEffect` keydown handler scoped to
`lightboxOpen`) — the existing "Click to close" caption already documents
the backdrop-click behavior; Escape is the same fix's natural companion,
not a separate task.

**7. Zero i18n in this page and its modal**
Both files have zero `useTranslation`/`t()` usage. Add `useTranslation` to
both, move every hardcoded string behind `t()` under a new
`admin.category.*` namespace (matching the existing `admin.<page>.*`
convention, e.g. `admin.withdraw.*`), and add real English/Thai/Vietnamese
copy for all of it — page title/subtitle, the "Add Root Category" button
and its new click-through message, empty/error states, the create/edit
modal's every label/placeholder/button, and validation messages
("Category name is required", upload error toasts, etc.).

### B. `manage-job-board`

**1. Loading overlay blurs the entire admin shell** (`page.tsx: 255-257,
356-360`; `LoadingBlur/index.tsx:9`)
`LoadingBlur` renders `fixed inset-0` — viewport-relative, so it covers
sidebar and header on every revalidation (`isValidating`, not just first
load). Replace it with a loading state scoped to the table region only: a
simple centered spinner inside the existing
`<div className="overflow-x-auto">` wrapper, reusing the exact spinner
markup `manage-category` already has (`animate-spin rounded-full h-8 w-8
border-b-2 border-primary`) for visual consistency between the two pages
this batch touches. `LoadingBlur` itself isn't touched (other pages may
intentionally want a full-screen blur for a true first-load); this page
stops using it and renders its own scoped loading state instead.

**2. Hide/Delete buttons commented out** (`page.tsx: 428-454`)
Both handlers, the confirm guard, and the toasts already work
(`handleDelete`, `handleToggleVisibility`, `page.tsx: 183-203`).
Un-comment the two buttons. Two things need fixing while doing this, not
separately: `faTrash` (used by the commented Delete button) isn't imported
anywhere in the file — add it to the `@fortawesome/free-solid-svg-icons`
import list. `faBan` is imported but referenced nowhere, including inside
the commented block — remove that unused import.

**3. Status filter removed**
Per the decision above: delete the `<select>` at `page.tsx: 317-325`, the
`status` field from `FilterState`, its URL-param sync, and its
contribution to `hasActiveFilters`/empty-state copy. The commented-out
`hidden:` line in the `useHttpGet("search", {...})` call goes too — it was
never wired to a real field on the `Search` request type.

**4. Error state renders outside `AdminLayout`** (`page.tsx: 259-261`)
The early `return <ErrorState/>` happens before the function's real
`return (<AdminLayout>...)`. Move the failed-state check inside
`AdminLayout` (render `<ErrorState/>` as `AdminLayout`'s child on failure,
same as the loading/empty/success branches already do) so the admin never
loses sidebar/header navigation because one fetch failed.

**5. "Clear all filters" navigates to a nonexistent route** (`page.tsx:
205-216`)
`router.push('/admin/job-board', ...)` — wrong path (real route is
`/admin/manage-job-board`) and a full navigation besides, which is more
fragile than necessary for what's fundamentally a "reset local filter
state" action. Fix: after resetting `filters` state, clear the URL's
search params in place on the *current* pathname
(`router.replace(pathname, {scroll: false})`, or push an empty query
string against `usePathname()`'s own value) instead of hardcoding a route
string that can go stale again.

**6. Missing `pageBack`** (throughout; no `isGoingBack`-style state exists
in this file today)
Add `const [isGoingBack, setIsGoingBack] = useState(false);`, matching
`manage-users`/`usePaginatedRiders`'s exact pattern: `true` in
`handlePrevPage`, `false` in `handleNextPage`, `clearFilters`, and
`handleFilterChange`. Pass `pageBack: isGoingBack` into the
`useHttpGet("search", {...})` params object.

**7. No search input** (`q` already flows through `sanitizedQuery` →
query param → empty-state copy, but no `<input>` exists anywhere to set
it)
Add a `type="search"` input in the filter bar, local-state-controlled,
that updates the URL's `q` param on Enter keypress or a submit/search
button click — not real-time-as-you-type — to avoid firing a network
request on every keystroke against a live search endpoint. `FilterState`
doesn't currently model `q` at all (it's read directly from
`searchParams`) — keep that separation; the new input only needs to
update the URL, not `FilterState`.

### Out of scope for this batch

- **The raw `<table>` layout** on both `manage-category` and
  `manage-job-board` (re-verification found `manage-category` has one too,
  not just `manage-job-board` as the original audit implied) — converting
  either to the card/stacked pattern the rest of admin uses is a real
  visual-design task, not a bug fix, and belongs in a later polish pass.
- **`sort` and `intendedUse` filters** on `manage-job-board` — both have no
  UI control. `intendedUse` already round-trips through the URL into the
  API when present, so it's a missing-control gap, not broken. `sort` is
  fully dead (never reaches the API) *and* has a real type mismatch
  waiting (`FilterState.sort: PostSortType` is a superset of the API's
  `SearchSortType` — wiring it naively would fail to type-check). Both
  deferred; worth their own small pass later.
- **Full dark-mode / visual-token work** — already covered by the prior
  batch; nothing here reopens it.
- **Every other page's audit findings** — `manage-picture`,
  `manage-users`/`manage-riders`, the financial trio, `dashboard` — still
  queued for future batches, per the original sequencing decision.

## Testing

Same situation as the prior batch: no component-test infrastructure exists
for either page (`no *.test.tsx` alongside either file, no
`@testing-library/react` in this project). Verify manually in the browser
preview:

- `manage-category`: loading state actually shows while fetching; a
  simulated fetch failure shows distinct error copy, not the empty state;
  creating a category that fails (e.g. duplicate name, if the backend
  rejects one) shows an error toast, not success; editing a category's
  name/description and reloading shows the change actually persisted;
  clicking "Add Root Category" shows the coming-soon message via mouse,
  touch (or keyboard-tab + Enter); opening the lightbox and clicking ×
  closes it, and so does Escape; switching locale changes every string on
  the page and in both modal modes (create/edit).
- `manage-job-board`: changing a filter that reaches the query (category,
  job type, budget) shows a scoped loading state, not a full-screen blur;
  Hide and Delete buttons appear and work (toast + list refresh); the
  Status filter is gone, not just non-functional; killing the network
  request (or hitting a real backend error) shows the error state with
  sidebar/header still present; "Clear all filters" resets filters without
  a broken navigation; Previous/Next pagination round-trips correctly with
  `pageBack` set appropriately; typing in the new search input and
  submitting actually filters the list via `q`.
