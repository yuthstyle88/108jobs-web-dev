# Category management: full CRUD across backend and admin panel

## Context

Seventh batch in this initiative, and the first that requires real backend
work. The admin panel's "Manage Categories" page presents itself as a CRUD
screen — it has an "Add Root Category" button, an edit modal, and a table
with an actions column — but almost none of it is wired to anything that
works.

The reason is not a frontend oversight. **The backend has no create and no
delete endpoint for categories at all.** Verified three ways against the
current `origin/main` (`978120e1e`), not a stale checkout:

- `src/api_routes.rs` registers a `POST /category` resource carrying a
  guard and a rate limiter but **no `.route()`** — so it falls through to
  the default service. The sibling `/post` and `/proposal` blocks do chain
  `.route(post().to(create_post))`; this one never did.
- `crates/category/src/lib.rs` declares `application`, `create_tag`,
  `delete_tag`, `get_random`, `list`, `update`, `update_tag` — there is no
  `create` or `delete` module. The only `create_category` functions in the
  repo are test fixtures that call the DB layer directly, bypassing HTTP.
- Against the running local API: `POST /api/v4/category` → **405**,
  `POST /api/v4/category/delete` → **404**, while `PUT /api/v4/category` →
  401 (exists, wants auth).

So the frontend's `createCategory` and `deleteCategory` client methods point
at endpoints that have never existed. The admin page's create path is dead
code that cannot succeed, and its delete button was commented out — which,
read in that light, was someone correctly noticing it didn't work rather
than leaving a feature half-finished.

Three further defects surfaced while confirming the above, each verified in
the source rather than inferred:

- **Renaming a category silently does nothing.** `CategoryService::update_category`
  dutifully builds a `CategoryUpdateForm` with `name` and `is_new`, but
  `Category::update` hand-rolls a separate `CategoryChangeset` (added to
  dodge a compiler panic on nested type inference) that **omits `name`,
  `is_new`, and `active` entirely**. A rename returns `200 OK` with the old
  name unchanged. No amount of frontend work can route around this.
- **Any authenticated user can set any category's icon or banner.**
  `link_category_icon` / `link_category_banner` take a plain
  `LocalUserView` and never call `is_admin`, while their `delete_*`
  counterparts — and the equivalent *site* icon/banner endpoints — do. The
  category id arrives in a caller-controlled query parameter. This is an
  authorization hole, not a design choice.
- **`path` is never written by any Rust code.** The `category.path` ltree
  column defaults to `'0'`, `CategoryInsertForm` has no `path` field, and
  the only read of `category::path` anywhere is the `maxDepth` filter's
  `nlevel()` call. The hierarchical paths visible in the live database
  (`Top.Graphic_design.Vector_graphics`) were seeded outside the
  application. Whatever create handler gets written will be the first code
  that ever computes a path.

This spec covers both repos as one feature: the backend gains the missing
endpoints and fixes, and the admin page becomes a real CRUD screen.

## Design

### A. Backend: `api-108jobs`

#### A1. `POST /category` — create

New `CategoryService::create_category`, admin-gated like every other
category mutation (`is_admin` against the site-wide `jobs:admin` role —
this codebase has no per-category moderator concept; `CategoryView.can_mod`
reduces to a plain site-admin check and gates nothing).

Request `CreateCategoryRequest`: `name`, `title`, and optional
`description`, `sidebar`, `icon`, `banner`, `parent_id`, `self_promotion`,
`posting_restricted_to_mods`, `visibility`. Response: the existing
`CategoryResponse`.

**Path computation** is the substantive new logic. `path` is an ltree whose
labels are restricted to `[A-Za-z0-9_]`, so the category's `name` is
slugified: every run of characters outside that set collapses to a single
`_`, and leading/trailing underscores are trimmed. This matches the
convention already in the database — `"Engineering & Structural Design"` is
stored at `Top.Graphic_design.Engineering_Structural_Design`.

- No `parent_id` → the category is a root: `Top.<slug>`.
- With `parent_id` → `<parent.path>.<slug>`, after reading the parent and
  rejecting a parent that is deleted or removed.

A slug that sanitizes to the empty string (a name of only punctuation) is
rejected, as is a computed path that already exists — the latter is what
actually enforces sibling-name uniqueness, since the `name` column has no
unique constraint and no application-level uniqueness check today.

**`path` is immutable after creation.** Renaming a category changes `name`
and `title` but never moves it in the tree. Two reasons: re-pathing would
require rewriting every descendant's path in the same transaction, and the
frontend uses the path's last segment as an i18n catalog key
(`t("catalogs." + toCamelCaseLastSegment(path))`), so a moved path silently
drops a category's translations. Re-parenting is out of scope for this
batch.

`CategoryInsertForm` gains a `path` field so the insert can set it; it is
currently absent, which is why the column has only ever taken its default.

**Validation**, matching what `update_category` already does so the two
paths agree: slur check on `title`; markdown processing plus the 10,000-char
body check on `sidebar`; the site's self-promotion gate. Additionally
`description` gets the 150-char check via the existing
`site_or_category_description_length_check` — which exists but has never had
a category-side caller — and `name`/`title` are required non-empty and
bounded by their `varchar(255)` columns.

#### A2. `POST /category/delete` — delete

New `CategoryService::delete_category`, admin-gated. Request
`DeleteCategoryRequest { category_id, deleted }` — a soft delete that sets
the existing `deleted` flag, and can restore by passing `false`. This
mirrors the delete/restore shape the post and proposal resources already
use, and the `deleted` column is already present in `CategoryChangeset`, so
no schema change is needed.

**Deleting a category that still has live descendants is refused** with a
clear error rather than silently orphaning them or cascading a mass
mutation the admin didn't ask for. The check is an ltree descendant query
(`path <@ parent_path`) filtered to non-deleted rows. Admins delete from
the leaves up; the UI surfaces the error.

Hard deletion (purge) is not in scope — there is no `admin_purge_category`
handler in the codebase, and building one means reckoning with every post
that references the category.

#### A3. Make renaming work

`CategoryChangeset` gains `name` and `is_new` so the values
`update_category` already computes actually reach the database. `active` is
left out deliberately: nothing in the codebase reads `category.active`, and
adding it to the changeset would let a partial update write it
unintentionally.

#### A4. `icon` / `banner` on edit

`EditCategoryRequest` gains optional `icon` and `banner`. The changeset
already carries both, so this is a request-type and service change only. It
gives edit parity with create and fixes the admin modal's "URL" tab, which
currently accepts a URL on edit and discards it (the UI even carries a
warning label admitting this).

The dedicated `POST /category/icon` upload endpoints remain — they handle
the multipart/asset-id upload path, which a plain URL field cannot.

#### A5. Close the image authorization hole

`link_category_icon` and `link_category_banner` switch to
`AuthenticatedLocalUserView` + `is_admin`, matching their `delete_*`
counterparts and the site icon/banner endpoints.

### B. Frontend: `108heros-clean`

#### B1. Correct the stale client types

`Category` is wrong in three places, confirmed against both the Rust source
and a live API response: `nsfw` → `selfPromotion`, `comments` →
`proposals`, and `is_new` → `isNew` (the struct-level `rename_all` now
applies). `instanceId` is also optional in the current backend. The same
`nsfw` → `selfPromotion` correction applies to `CreateCategory` and
`EditCategory`.

Beyond the renames, the request types need the new fields: `parentId` on
create; `name`, `icon`, `banner`, `isNew` on edit; and `deleted` on delete.

#### B2. Make the actions real

- The "Add Root Category" button currently fires a
  `t("admin.category.addRootComingSoon")` toast. It opens the create modal.
- The "Add subcategory" and "Delete" buttons in `CategoryRow` are commented
  out. Both come back — subcategory creation now has a `parentId` to send,
  and delete now has an endpoint.
- Delete gets a confirmation dialog naming the category, then
  `isSuccess`/`isFailed` handling, a toast, and a refetch. Its current form
  — `onDelete={(id) => deleteCategory({categoryId: id})}` — is
  fire-and-forget against a 404: no confirmation, no result check, no
  refresh, no feedback.
- Create refetches on success. It currently closes the modal and returns
  without one, so a created category wouldn't appear until a manual reload.

#### B3. Fix the create-with-image flow

Uploads are guarded by `&& editingCategory`, so on create they're skipped
and the raw base64 `data:` URL from the `FileReader` preview is sent as the
icon URL instead. The flow becomes: create the category, read the new id
from the response, upload any pending icon/banner against that id, then
refetch. On the URL tab the URL goes straight into the create payload,
which already works.

#### B4. Fill the gaps in the modal and table

- The modal has no description input at all, even though the form state and
  the save handler both carry `description` — so it can be read but never
  changed. Add the field.
- The "Parent" column splits `path` on `" > "`, but the separator is `.`.
  Every child row shows `-`. Confirmed live.
- `CategoryRow` hardcodes English: `"subcategories"`, `"No banner image"`,
  `"— Root Category —"`, and the `alt` text on both images. These move to
  `admin.category.*` keys across en/th/vi.

### Out of scope

- **Re-parenting** an existing category (see A1's reasoning on immutable
  paths).
- **Hard delete / purge** (see A2).
- **`maxDepth` on list** — inert until paths are hierarchical for
  application-created rows, and the admin page wants the flat set anyway.
- **The always-zero `reportCount` / `unresolvedReportCount`** — kept
  non-nullable for a Flutter entity, wired to SQL literals. Not surfaced.
- **The dead list cache** in `crates/category/src/list.rs`, whose
  `use_cache` gate is always false because `is_authenticated` is hardcoded
  true. Unrelated to CRUD.

## Testing

**Backend** has a real test suite; new handlers get coverage in the style of
the existing `tests/category_service_authorization.rs`: an admin can create
a root and a child and sees the computed path; a non-admin is rejected;
creating under a missing parent fails; a duplicate path fails; deleting a
category with live children is refused; delete then restore round-trips; and
a rename now actually persists (a regression test for A3 that fails before
the changeset fix).

**Frontend** has no component-test infrastructure for admin pages, matching
every prior batch. Verified manually in the browser against a locally-built
backend carrying these changes, on a separate port so the running dev API is
left alone:

- Create a root category; it appears in the tree without a manual reload.
- Create a subcategory under it; it nests correctly and its path reflects
  the parent.
- Rename it; the new name persists across a reload (this fails today).
- Set an icon by URL on edit; it persists (this fails today).
- Delete a category with a live child; the refusal is surfaced as an error.
- Delete the leaf, then the parent; both disappear.
- The Parent column shows real parent paths for child rows.
- Switching locale translates every string on the page and in the modal.
