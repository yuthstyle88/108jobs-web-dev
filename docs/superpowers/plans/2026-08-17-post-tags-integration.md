# Post Tags Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing backend tag system usable — correct its wire casing, give the client methods for it, let admins manage tags, let posters apply them, and show them on posts.

**Architecture:** One small `api-108jobs` change (a serde attribute), then four `108jobs-clean` changes. The two repos decouple cleanly: the client's `Tag.ts` already declares camelCase, so it becomes correct the moment the backend ships and needs no edit of its own. Only manual verification needs the backend deployed.

**Tech Stack:** Rust/serde/actix (api-108jobs); TypeScript, Next.js 16, react-hook-form + zod, pnpm (108jobs-clean).

**Spec:** `docs/superpowers/specs/2026-08-17-post-tags-integration-design.md`

## Global Constraints

- **Release order is not optional.** `108jobs-flutter`'s `PostView.tags` is typed `List<String>` against a backend sending `Vec<Tag>` objects. Creating and managing tags is safe; **assigning a tag to a post is what breaks the Flutter feed** — a `TypeError` parsing the whole `PostView`, not a blank chip. Task 4 (the picker) must not reach production before that retype lands. Building it is fine; shipping it ahead of Flutter is not.
- **Only `Tag` gets `rename_all`.** `PostTag` is write-path only and never serialized — do not touch it. Do not add the attribute to any other struct; a wider casing audit is explicitly out of scope.
- **Do not implement tag filtering.** `Tag`'s doc comment promises "displayed and filtered on", but filtering does not exist and is out of scope. Chips are display only — not links, not filter controls.
- **Every user-facing string needs `en`/`th`/`vi`** in `src/translations/`, matching each locale's existing wording. Never leave English in `th.ts` or `vi.ts`.
- **After ANY edit under `src/lib/108jobs-client/src/`, run BOTH commands, in this order:**
  ```bash
  cd src/lib/108jobs-client && npm run build && cd - && pnpm install
  ```
  `node_modules/108jobs-client` resolves to a hard copy, not a link. Building without reinstalling leaves `tsc` reading the old shape.
- **Every 108jobs-clean task ends with `npx tsc --noEmit` and `npx eslint` clean** before its commit.
- Commit with `git add -A src/ tsconfig.tsbuildinfo` — an untracked `.claude/worktrees/` directory holds another session's work and must never be committed.

---

### Task 1: Give `Tag` camelCase wire keys (api-108jobs)

Repo: `/Users/koeyl/108-ecosystem/108jobs/api-108jobs`. This is the only task in that repo. Work on a branch off `main`; `Cargo.lock` is intentionally dirty there and must be left alone.

**Files:**
- Modify: `crates/db/src/source/tag.rs`

- [ ] **Step 1: Confirm the premise before changing anything**

```bash
grep -c 'rename_all = "camelCase"' crates/db/src/source/tag.rs
```
Expected: `0`. If it is already 1, stop — the fix has landed and this task is done.

- [ ] **Step 2: Add the attribute**

In `crates/db/src/source/tag.rs`, on the `Tag` struct only, add **both** of these — the directional serde form, and ts-rs's own attribute:

```rust
#[serde(rename_all(serialize = "camelCase"))]
#[cfg_attr(feature = "ts-rs", ts(optional_fields, export, rename_all = "camelCase"))]
```

**Do not use the plain `#[serde(rename_all = "camelCase")]`.** It renames both directions, and `Tag` is deserialized from Postgres via raw-SQL `json_agg(tag.*)` (through `impl FromSql<Nullable<Json>, Pg> for TagsView`), which emits real snake_case column names. The plain form makes every post, proposal, or category that has a tag fail to load. It fails the `post_tags_present` test with `missing field apId`.

ts-rs does not parse the directional form and silently falls back to raw field names, which is why its own `rename_all` is needed alongside — otherwise the generated binding says `display_name` while the wire says `displayName`.

Leave `#[skip_serializing_none]` where it is.

Do **not** add it to any other struct in the file or the crate.

- [ ] **Step 3: Check nothing asserts on the old snake_case JSON**

```bash
grep -rn "display_name\|ap_id" --include="*.rs" crates/ | grep -iE "json!|assert|expect" | grep -i tag
```
Expected: no matches. If a test asserts on `"display_name"` in serialized tag JSON, update that assertion to `"displayName"` — the test is asserting the bug.

- [ ] **Step 4: Run the CI gates**

```bash
RUSTFMT="$(rustup which --toolchain nightly rustfmt)" cargo +nightly fmt --all -- --check
cargo clippy --workspace --tests --all-targets -- -D warnings
```
Expected: both clean. (`cargo nextest run` is the fuller gate; run it if the clippy pass touches anything unexpected.)

- [ ] **Step 5: Commit**

```bash
git add crates/db/src/source/tag.rs && git commit -m "fix(tag): serialize Tag with camelCase keys like every other API struct"
```

---

### Task 2: Add the three client tag methods

**Files:**
- Modify: `src/lib/108jobs-client/src/http.ts`

**Interfaces:**
- Consumes: `CreateCategoryTag`, `UpdateCategoryTag`, `DeleteCategoryTag` (already exist in `src/lib/108jobs-client/src/types/`), and `Tag` as the response type.
- Produces: `createCategoryTag`, `updateCategoryTag`, `deleteCategoryTag` — used by Task 3.

- [ ] **Step 1: Read the shape of an existing category method**

Open `src/lib/108jobs-client/src/http.ts` and read the `createCategory` method (search `@Post("/category")`). Your three methods copy its structure exactly: decorators, `@Tags(...)`, `#wrapper<Request, Response>` call, JSDoc `@summary`. Match it rather than inventing a shape.

- [ ] **Step 2: Add the three methods**

Place them immediately after the existing category methods so the file stays grouped by domain. Each mirrors a route already served by the backend:

- `createCategoryTag` → `@Post("/category/tag")`, `#wrapper<CreateCategoryTag, Tag>`
- `updateCategoryTag` → `@Put("/category/tag")`, `#wrapper<UpdateCategoryTag, Tag>`
- `deleteCategoryTag` → `@Delete("/category/tag")`, `#wrapper<DeleteCategoryTag, Tag>`

Use `@Tags("Category")` on all three — they are category-scoped operations, and `@Tags` names the domain.

Add the three type imports at the top alongside the other type imports.

- [ ] **Step 3: Verify the response type against the backend**

```bash
grep -n -A 6 "pub async fn create_category_tag" /Users/koeyl/108-ecosystem/108jobs/api-108jobs/crates/category/src/create_tag.rs
```
Confirm what the handler returns. If it is not a bare `Tag`, use the type it actually returns and say so in your report — do not assume.

- [ ] **Step 4: Rebuild, reinstall, verify**

```bash
cd src/lib/108jobs-client && npm run build && cd - && pnpm install && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A src/ tsconfig.tsbuildinfo && git commit -m "feat(client): add category tag CRUD methods"
```

---

### Task 3: Tag management in Manage Category

Tags are owned by a category, so they live inside the category admin page rather than getting a page of their own.

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx`
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts`

- [ ] **Step 1: Read the page's existing CRUD patterns first**

`src/app/[lang]/admin/manage-category/page.tsx` (423 lines) already does create / edit / delete for categories, with its own modal, loading, error, and empty states. Read it before adding anything and reuse those patterns — the same modal shell, the same `isSuccess`/`isFailed` handling, the same toast calls.

**Critical:** `useHttpPost`/`useHttpPut`/`useHttpDelete` **never reject**. They resolve with `{state: REQUEST_STATE.FAILED}`. Guard every call with `isSuccess`/`isFailed`; a `try/catch` around them cannot fire and will silently report success on failure.

- [ ] **Step 2: Show each category's tags**

Each category in the list already carries its tags — the page's data comes from `CategoryView`, which has `postTags: TagsView` (an `Array<Tag>`). No extra request is needed. Render them as a small chip row under the category, using `tag.displayName`.

Show a "no tags yet" empty state rather than an empty row.

- [ ] **Step 3: Add tag create**

An "Add tag" control per category, opening the page's existing modal pattern with a single name field. On submit call `createCategoryTag({categoryId, displayName})` — confirm the exact request field names against `src/lib/108jobs-client/src/types/CreateCategoryTag.ts` rather than assuming. Refetch the category list on success.

- [ ] **Step 4: Add tag rename and delete**

Rename reuses the same modal pre-filled with the current name, calling `updateCategoryTag`. Delete asks for confirmation first — reuse the page's existing delete-confirmation pattern — then calls `deleteCategoryTag`. Refetch on success; surface an error toast on `isFailed`.

- [ ] **Step 5: Translations**

Add keys under the page's existing `admin.manageCategory` block for: the tags section heading, "Add tag", the name field label and placeholder, the empty state, the delete confirmation, and the success/failure toasts. Write real Thai and Vietnamese, matching how the surrounding keys in each file word similar actions.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npx eslint "src/app/[lang]/admin/manage-category/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
```
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add -A src/ tsconfig.tsbuildinfo && git commit -m "feat(admin): manage a category's post tags"
```

---

### Task 4: Tag picker on the post form

**Files:**
- Modify: `src/components/Job/PostForm/index.tsx`
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts`

- [ ] **Step 1: Source the tags from data already in memory**

The form calls `useCategories()` at line 86, which returns `ListCategoriesResponse.categories: Array<CategoryView>` — and `CategoryView` carries `postTags`. **Do not add a request.** Find the `CategoryView` whose `category.id` matches the currently-selected `categoryId` and read its `postTags`.

- [ ] **Step 2: Add `tags` to the form state and schema — optional, capped at 5**

Add `tags: []` to the defaults (around line 96), and to the zod schema (around line 29, beside `categoryId`):

```ts
    tags: z.array(z.coerce.number().int().positive()).max(5, t("validation.tagsMax")).default([]),
```

**No minimum.** Tags are optional; a post may carry none. A minimum would make tagging compulsory once a category has tags — an author editing a post to fix its budget could not save without tagging — which forces the first tagged post into existence while `108jobs-flutter` still crashes on tagged posts.

`tags: []` in `defaultValues` is **load-bearing, not redundant**: react-hook-form's `register` ref callback only takes the array branch for a single-checkbox group when `_defaultValues[name]` is an array. Without it, a category offering exactly one tag yields a bare string instead of an array. Leave it, with a comment saying why.

- [ ] **Step 3: Render the picker**

A multi-select of the selected category's tags, labelled by `displayName`, placed directly after the category select (around line 363-372) since it depends on it.

Render the section **only** when a category is selected and its `postTags` is non-empty. A category with no tags shows nothing at all — not an empty picker.

Show the remaining allowance next to the label — "3 of 5" — so the ceiling is visible before it is hit rather than discovered by a validation error. Disable unselected options once 5 are chosen, rather than letting a sixth be clicked and then rejected.

- [ ] **Step 4: Clear the selection when the category changes**

When `categoryId` changes, reset `tags` to `[]`. A tag from the previous category would be rejected by the backend's own validation, which checks each tag against the category that owns it. Use a `useEffect` on the watched `categoryId`, matching how the file already reacts to field changes.

- [ ] **Step 5: Send it**

Add `tags: data.tags?.length ? data.tags : undefined` to the `CreatePost` payload (around line 144). Send `undefined` rather than `[]` when nothing is selected, so an untagged post does not send an empty array.

Do the same for the edit path, and pre-select from `post.tags` when editing — `PostView.tags` is an `Array<Tag>`, so map it to ids.

- [ ] **Step 6: Translations**

Keys for the picker label, its helper/allowance text ("{selected} of 5"), and the two validation messages `validation.tagsMax` and `validation.tagsMin`. Put the validation keys beside the file's existing `validation.*` entries, and the picker keys wherever the form's other field labels live — check where `categoryId`'s label lives rather than assuming.

Real Thai and Vietnamese, matching how each file words similar counts and limits elsewhere.

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit && npx eslint src/components/Job/PostForm/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
```

- [ ] **Step 8: Commit**

```bash
git add -A src/ tsconfig.tsbuildinfo && git commit -m "feat(jobs): choose a category's tags when posting a job"
```

---

### Task 5: Show tags on posts

**Files:**
- Modify: `src/app/[lang]/(job)/job-board/page.tsx`
- Modify: `src/components/JobBoardDetail/` (the detail view — locate the component that renders a single post's header)

- [ ] **Step 1: Find where a card already renders its metadata**

The job-board page renders cards carrying `jobType` and `intendedUse`. Read how those are displayed and follow the same visual treatment for tag chips — same spacing scale, same token-based colors. Do not introduce a new chip style.

- [ ] **Step 2: Render the chips**

From `post.tags` (an `Array<Tag>`), render `tag.displayName` only. A post with no tags renders no chip row at all — not an empty container.

Chips are **not** interactive: not links, not filters. Filtering by tag does not exist on the backend, and a chip that looks clickable but does nothing is worse than a plain one.

- [ ] **Step 3: Same on the detail view — but not on proposals**

Locate the component under `src/components/JobBoardDetail/` that renders the post header and add the same chip row there.

**Do not add chips to the proposal list.** `ProposalView.postTags` exists and is correctly populated, but every proposal under a job inherits the *same* tags from that one job — rendering them per proposal repeats the job's requirements once per offer. Tags belong to the post and are shown there. `JobBoardProposal/index.tsx` stays untouched by this task.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint "src/app/[lang]/(job)/job-board/page.tsx" src/components/JobBoardDetail
```

- [ ] **Step 5: Commit**

```bash
git add -A src/ tsconfig.tsbuildinfo && git commit -m "feat(jobs): show a post's tags"
```

---

### Task 6: Close the `EditPost.tags` gap, then verify

- [ ] **Step 1: Add the missing `tags` field to `EditPost.ts`**

The backend's `EditPost` struct accepts `pub tags: Option<Vec<TagId>>` (`crates/db/src/source/post_view/api.rs`, line ~15), but `src/lib/108jobs-client/src/types/EditPost.ts` declares no `tags` field at all. Task 4's edit path works only because it spreads the payload — TypeScript does not apply excess-property checks through a spread — so tags reach the wire despite the type not describing them.

That is drift of exactly the kind this package keeps producing: the type stops describing the wire, and the next person to touch it guesses. It is the same defect Task 2 fixed on `UpdateCategoryTag`.

Add, matching how `CreatePost.ts` declares the same field:

```ts
  tags?: Array<TagId>;
```

with the `TagId` import alongside the file's existing type imports. Check `CreatePost.ts` first and mirror its declaration exactly rather than inventing a shape.

Then rebuild and reinstall — this is an edit under `src/lib/108jobs-client/src/`:
```bash
cd src/lib/108jobs-client && npm run build && cd - && pnpm install
```

Confirm the spread in `PostForm` still compiles, and say in your report whether the field is now carried by the declared type rather than only by the spread.

- [ ] **Step 2: Full gates**

```bash
cd src/lib/108jobs-client && npm run build && cd - && pnpm install
npx tsc --noEmit && npx eslint src --ext .ts,.tsx
```
Expected: `tsc` clean; eslint 0 errors. Pre-existing warnings in untouched files are reported, not fixed.

- [ ] **Step 3: Confirm scope held**

```bash
grep -rn "post_tag\|tagFilter\|filterByTag" src --include="*.ts" --include="*.tsx" | grep -v "/dist/"
```
Expected: no matches — no filtering crept in.

- [ ] **Step 4: Commit any residual fixes**

```bash
git add -A src/ tsconfig.tsbuildinfo && git commit -m "chore(tags): final verification"
```

---

## Manual verification (against a dev API with Task 1 deployed)

`tsc` cannot see a wrong JSON key, so the casing fix needs eyes:

1. Create a tag in Manage Category → it appears in the chip row with its **name visible**, not blank. (A blank chip means Task 1 is not deployed to the API being used.)
2. Rename it, delete it — the list reflects both.
3. Post a job in that category → the tag picker offers it; select it and save.
4. The job board card and detail view show the chip.
5. Switch category mid-form → the tag selection clears.
6. Edit the tagged post → its tags are pre-selected.

## Before this reaches production

`108jobs-flutter`'s `PostView.tags` must be retyped from `List<String>` to
`List<Tag>` first. Tasks 1-3 and 5 are safe to deploy on their own; **Task 4 is
the one that must wait**, because it is what puts a tag on a post, and the first
tagged post throws a `TypeError` in the Flutter feed.
