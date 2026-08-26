# Manage Category Full CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin "Manage Categories" screen from a page whose create
button shows a "coming soon" toast and whose delete button is commented out
into a real CRUD screen — create roots and subcategories, edit every field
the backend accepts, and delete with confirmation and feedback.

**Architecture:** Four already-existing client methods (`listCategories`,
`createCategory`, `editCategory`, `deleteCategory`) finally get correct
types and callers. `createCategory` and `deleteCategory` have never worked
because the endpoints did not exist; they are being added in the companion
backend batch, so this plan's types must match that new API exactly.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, react-i18next
(en/th/vi), the SWR-backed `useHttpGet`/`useHttpPost`/`useHttpPut`/
`useHttpDelete` hooks, `sonner` toasts.

**Companion spec:** `docs/superpowers/specs/2026-08-17-category-full-crud-design.md`
(section B).

**Companion backend branch:** `api-108heros` `feat/category-crud-api`, which
adds `POST /category` (with `parentId`), `POST /category/delete` (with
`deleted`), `icon`/`banner` on edit, and makes renaming persist. **This
frontend cannot be end-to-end verified against the currently-running dev API
on :8536**, which still 405s on create and 404s on delete — see the final
section for how to point a local run at a backend that has the new endpoints.

## Global Constraints

- Touch only: `src/lib/108heros-client/src/types/{Category,CreateCategory,EditCategory,DeleteCategory}.ts`,
  `src/modules/admin/components/CategoryRow/index.tsx`,
  `src/modules/admin/components/Modal/CategoryModal/index.tsx`,
  `src/modules/admin/components/Modal/DeleteCategoryModal/index.tsx` (new),
  `src/app/[lang]/admin/manage-category/page.tsx`,
  and `src/translations/{en,th,vi}.ts`.
- No new npm dependencies.
- Files under `src/lib/108heros-client/src/types/` use **2-space** indentation
  (their own long-standing convention). Everything else in this plan uses
  **4-space**, matching the file being edited. Double-quoted strings
  throughout.
- **After editing anything under `src/lib/108heros-client/src/`, rebuild the
  package** — app code imports the package name `"108heros-client"`, which
  resolves to `src/lib/108heros-client/dist/`, not to the sources. Without a
  rebuild, `tsc` type-checks against the stale build and will happily accept
  code that contradicts your edit:
  ```bash
  cd src/lib/108heros-client && npm run build && cd -
  ```
- Every mutation result goes through `isSuccess`/`isFailed` from
  `@/services/HttpService`. These hooks never reject — a `try/catch` around
  `execute()` cannot catch a failure, it can only hide one.
- New translation keys live under `admin.category.*`, and every key added to
  `en.ts` must be added to `th.ts` and `vi.ts` in the same task, with real
  translations rather than copied English.

---

### Task 1: Correct the category client types

**Files:**
- Modify: `src/lib/108heros-client/src/types/Category.ts`
- Modify: `src/lib/108heros-client/src/types/CreateCategory.ts`
- Modify: `src/lib/108heros-client/src/types/EditCategory.ts`
- Modify: `src/lib/108heros-client/src/types/DeleteCategory.ts`

**Interfaces:**
- Produces: the corrected `Category`, and the request types every later task
  sends. No app code currently reads `nsfw`, `comments`, or `is_new`
  (verified by grep), so the renames below break nothing downstream.

`Category` is wrong in three places. Confirmed twice over — against the Rust
source and against a live `GET /api/v4/category/list` response, which
returns `selfPromotion`, `proposals`, and `isNew` and does **not** return
`nsfw` or `comments`.

- [ ] **Step 1: Fix `Category.ts`**

Three edits inside `export type Category`:

```ts
  /**
   * Whether its a self-promotion category.
   */
  selfPromotion: boolean;
```
replaces the `nsfw: boolean;` field (and its doc comment).

```ts
  proposals: number;
```
replaces `comments: number;`.

```ts
  isNew: boolean;
```
replaces `is_new: boolean;` — the backend struct carries
`#[serde(rename_all = "camelCase")]`, so the wire name is camelCase like
every sibling field.

Also make `instanceId` optional, matching the backend's
`Option<InstanceId>`:
```ts
  instanceId?: InstanceId;
```

- [ ] **Step 2: Fix `CreateCategory.ts`**

Rename the `nsfw` field the same way:
```ts
  /**
   * Whether its a self-promotion category.
   */
  selfPromotion?: boolean;
```

Then add the field that makes subcategories possible, immediately after
`title`:
```ts
  /**
   * The parent to nest this category under. Omit to create a root category.
   */
  parentId?: CategoryId;
```
`CategoryId` needs importing — follow the `import type` style already used
by `EditCategory.ts` in the same directory.

- [ ] **Step 3: Fix `EditCategory.ts`**

Rename `nsfw` → `selfPromotion` as above, then add the four fields the
backend's `EditCategoryRequest` accepts that this type is missing:

```ts
  /**
   * The unique name.
   */
  name?: string;
  /**
   * An icon URL.
   */
  icon?: string;
  /**
   * A banner URL.
   */
  banner?: string;
  /**
   * Whether its new or not.
   */
  isNew?: boolean;
```

Put `name` directly after `categoryId` (matching the backend struct's
order), `icon`/`banner` after `description`, and `isNew` last.

- [ ] **Step 4: Fix `DeleteCategory.ts`**

The endpoint is a soft delete that can also restore, so it takes a flag:

```ts
export type DeleteCategory = {
  categoryId: CategoryId;
  /**
   * `true` deletes, `false` restores.
   */
  deleted: boolean;
};
```

- [ ] **Step 5: Rebuild the package and type-check**

```bash
cd src/lib/108heros-client && npm run build && cd -
npx tsc --noEmit
```

Expected: the build succeeds and `tsc` reports **errors in
`manage-category/page.tsx`** — specifically that `deleteCategory` is now
missing the required `deleted` property. That error is correct and expected;
Task 5 fixes the caller. Report the exact errors you see so the controller
can confirm they are only the anticipated ones.

- [ ] **Step 6: Commit**

```bash
git add src/lib/108heros-client/src/types/Category.ts src/lib/108heros-client/src/types/CreateCategory.ts src/lib/108heros-client/src/types/EditCategory.ts src/lib/108heros-client/src/types/DeleteCategory.ts
git commit -m "fix(client): correct the stale category types and add parentId/name/icon/banner/deleted"
```

---

### Task 2: Translation keys

**Files:**
- Modify: `src/translations/en.ts`, `src/translations/th.ts`, `src/translations/vi.ts`

**Interfaces:**
- Produces: every `admin.category.*` key Tasks 3–5 reference. Adding them
  first means no later task renders a raw key while it is being built.

- [ ] **Step 1: Add the new keys to `en.ts`**

Inside the existing `admin.category` object, **remove** the now-obsolete
`addRootComingSoon` key (Task 5 makes the button work, so the "coming soon"
copy becomes a lie), and add:

```ts
                addChild: "Add subcategory",
                addChildTitle: "Add a subcategory under {{name}}",
                edit: "Edit category",
                delete: "Delete category",
                rootLabel: "— Root Category —",
                subcategoryCount_one: "{{count}} subcategory",
                subcategoryCount_other: "{{count}} subcategories",
                noBanner: "No banner image",
                iconAlt: "{{name}} icon",
                bannerAlt: "{{name}} banner",
                deleted: "Category deleted",
                deleteError: "Failed to delete the category. Please try again.",
                deleteHasChildren: "Delete or move this category's subcategories first.",
                deleteModal: {
                    title: "Delete this category?",
                    description: "This hides {{name}} from the catalog. Its subcategories must be removed first.",
                    confirm: "Delete",
                    cancel: "Cancel",
                    deleting: "Deleting…",
                },
                modal: {
                    descriptionLabel: "Description",
                    descriptionPlaceholder: "A short, one-line description",
                    parentHint: "Will be created under {{name}}",
                    rootHint: "Will be created as a top-level category",
                },
```

The `modal` keys go **inside** the existing `admin.category.modal` object
(which already has `addTitle`, `nameLabel`, etc.), not as a second one.

`subcategoryCount_one`/`_other` are i18next plural forms — calling
`t("admin.category.subcategoryCount", {count: n})` picks the right one.

- [ ] **Step 2: Add the same keys to `th.ts`** with real Thai text

Thai has no plural distinction, so i18next expects a single
`subcategoryCount_other` form for it; provide both keys anyway with the same
string so a locale fallback can never produce a missing key.

```ts
                addChild: "เพิ่มหมวดหมู่ย่อย",
                addChildTitle: "เพิ่มหมวดหมู่ย่อยภายใต้ {{name}}",
                edit: "แก้ไขหมวดหมู่",
                delete: "ลบหมวดหมู่",
                rootLabel: "— หมวดหมู่หลัก —",
                subcategoryCount_one: "{{count}} หมวดหมู่ย่อย",
                subcategoryCount_other: "{{count}} หมวดหมู่ย่อย",
                noBanner: "ไม่มีรูปแบนเนอร์",
                iconAlt: "ไอคอนของ {{name}}",
                bannerAlt: "แบนเนอร์ของ {{name}}",
                deleted: "ลบหมวดหมู่แล้ว",
                deleteError: "ลบหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่",
                deleteHasChildren: "กรุณาลบหรือย้ายหมวดหมู่ย่อยก่อน",
                deleteModal: {
                    title: "ลบหมวดหมู่นี้หรือไม่?",
                    description: "การดำเนินการนี้จะซ่อน {{name}} ออกจากแคตตาล็อก ต้องลบหมวดหมู่ย่อยออกก่อน",
                    confirm: "ลบ",
                    cancel: "ยกเลิก",
                    deleting: "กำลังลบ…",
                },
```
plus, inside `admin.category.modal`:
```ts
                    descriptionLabel: "คำอธิบาย",
                    descriptionPlaceholder: "คำอธิบายสั้น ๆ หนึ่งบรรทัด",
                    parentHint: "จะถูกสร้างภายใต้ {{name}}",
                    rootHint: "จะถูกสร้างเป็นหมวดหมู่ระดับบนสุด",
```

- [ ] **Step 3: Add the same keys to `vi.ts`** with real Vietnamese text

```ts
                addChild: "Thêm danh mục con",
                addChildTitle: "Thêm danh mục con trong {{name}}",
                edit: "Sửa danh mục",
                delete: "Xóa danh mục",
                rootLabel: "— Danh mục gốc —",
                subcategoryCount_one: "{{count}} danh mục con",
                subcategoryCount_other: "{{count}} danh mục con",
                noBanner: "Không có ảnh bìa",
                iconAlt: "Biểu tượng của {{name}}",
                bannerAlt: "Ảnh bìa của {{name}}",
                deleted: "Đã xóa danh mục",
                deleteError: "Xóa danh mục thất bại. Vui lòng thử lại.",
                deleteHasChildren: "Vui lòng xóa hoặc di chuyển các danh mục con trước.",
                deleteModal: {
                    title: "Xóa danh mục này?",
                    description: "Thao tác này sẽ ẩn {{name}} khỏi danh mục. Phải xóa các danh mục con trước.",
                    confirm: "Xóa",
                    cancel: "Hủy",
                    deleting: "Đang xóa…",
                },
```
plus, inside `admin.category.modal`:
```ts
                    descriptionLabel: "Mô tả",
                    descriptionPlaceholder: "Mô tả ngắn gọn, một dòng",
                    parentHint: "Sẽ được tạo trong {{name}}",
                    rootHint: "Sẽ được tạo như một danh mục cấp cao nhất",
```

- [ ] **Step 4: Verify and commit**

Confirm all three files still parse (`npx tsc --noEmit` shows no new errors
in the translation files themselves) and that
`grep -c "addRootComingSoon" src/translations/*.ts` returns 0 for all three.

```bash
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "i18n(admin): add category CRUD strings, drop the coming-soon copy"
```

---

### Task 3: `CategoryRow` — restore the actions, fix the parent column

**Files:**
- Modify: `src/modules/admin/components/CategoryRow/index.tsx`

**Interfaces:**
- Consumes: Task 2's keys. Its `onAddChild`/`onDelete` props already exist in
  the component's signature and are already passed by the page — the buttons
  that call them are simply commented out.
- Produces: no signature change, so the page keeps working throughout.

- [ ] **Step 1: Restore the two commented-out action buttons**

The actions cell currently contains a commented-out "Add subcategory"
button, a live "Edit" button, and a commented-out "Delete" button. Restore
both, giving each a real accessible label from Task 2's keys (the originals
had `title="Add subcategory"` / `title="Delete"` hardcoded in English, and
the Edit button has no label at all):

```tsx
                        <button
                            onClick={() => onAddChild(node.category.id)}
                            className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"
                            title={t("admin.category.addChild")}
                            aria-label={t("admin.category.addChild")}
                        >
                            <FontAwesomeIcon icon={faPlus}/>
                        </button>
                        <button
                            onClick={() => onEdit(node)}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                            title={t("admin.category.edit")}
                            aria-label={t("admin.category.edit")}
                        >
                            <FontAwesomeIcon icon={faEdit}/>
                        </button>
                        <button
                            onClick={() => onDelete(node.category.id)}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                            title={t("admin.category.delete")}
                            aria-label={t("admin.category.delete")}
                        >
                            <FontAwesomeIcon icon={faTrash}/>
                        </button>
```

`faPlus` and `faTrash` are already imported at the top of the file (they
were left in place when the buttons were commented out), so no import change
is needed. Confirm that before assuming it.

- [ ] **Step 2: Fix the Parent column**

Current — it splits on `" > "`, but the real separator in `path` is `.`
(paths look like `Top.Graphic_design.Vector_graphics`), so `slice(0, -1)`
always yields an empty array and every child row renders `-`. Confirmed
live:

```tsx
                        {isRoot
                            ? "— Root Category —"
                            : node.category.path.split(" > ").slice(0, -1).join(" → ") || "-"
                        }
```

Change to — split on `.`, drop the leading `Top` segment as well as the
category's own trailing segment, and turn the remaining slugs back into
readable text:

```tsx
                        {isRoot
                            ? t("admin.category.rootLabel")
                            : node.category.path
                                .split(".")
                                .slice(1, -1)
                                .map((segment) => segment.replace(/_/g, " "))
                                .join(" → ") || "-"
                        }
```

- [ ] **Step 3: Translate the remaining hardcoded English**

Three more literals in this file, all currently English regardless of
locale:

- `{node.children?.length || 0} subcategories` in the banner overlay becomes
  `{t("admin.category.subcategoryCount", {count: node.children?.length || 0})}`
- `No banner image` becomes `{t("admin.category.noBanner")}`
- `alt="Icon"` and `alt="Banner"` become
  `alt={t("admin.category.iconAlt", {name: node.category.title})}` and
  `alt={t("admin.category.bannerAlt", {name: node.category.title})}`

The two `onImageClick(...)` calls also pass hardcoded `"Category Icon"` /
`"Banner"` strings as the lightbox caption — pass the same translated alt
text instead, since that caption is rendered to the user.

- [ ] **Step 4: Verify**

`npx tsc --noEmit` shows no new errors. In the browser, the actions column
now shows three buttons per row, the Parent column shows a real path for
child rows (e.g. `Graphic design`) rather than `-`, and switching locale
translates the subcategory count and the "no banner" placeholder.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/components/CategoryRow/index.tsx
git commit -m "feat(admin): restore the add-subcategory and delete actions, fix the parent path column"
```

---

### Task 4: The modal gains a description field and a parent hint; add a delete-confirmation modal

**Files:**
- Modify: `src/modules/admin/components/Modal/CategoryModal/index.tsx`
- Create: `src/modules/admin/components/Modal/DeleteCategoryModal/index.tsx`

**Interfaces:**
- Consumes: Task 2's keys.
- Produces: `CategoryModal` gains one optional prop, `parentName?: string | null`;
  `DeleteCategoryModal` is a new component Task 5 renders.

The modal's form state and the page's save handler both carry
`description`, but there has never been an input for it — so a category's
description can be read but never changed.

- [ ] **Step 1: Add the description field to `CategoryModal`**

Insert directly after the existing Name field's closing `</div>` and before
the Icon block:

```tsx
                    {/* Description */}
                    <div>
                        <label htmlFor="category-description" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.category.modal.descriptionLabel")}
                        </label>
                        <input
                            id="category-description"
                            type="text"
                            value={form.description || ""}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                            placeholder={t("admin.category.modal.descriptionPlaceholder")}
                        />
                    </div>
```

- [ ] **Step 2: Show where a new category will land**

Add `parentName` to `CategoryModalProps`:

```tsx
    parentName?: string | null;
```
and destructure it in the component's parameter list.

Then, when adding a new category, render a hint under the title so the admin
knows whether they are creating a root or a child — this is the only signal
distinguishing the two, since both open the same modal:

```tsx
                {isAddingNew && (
                    <p className="-mt-4 mb-6 text-sm text-gray-500">
                        {parentName
                            ? t("admin.category.modal.parentHint", {name: parentName})
                            : t("admin.category.modal.rootHint")}
                    </p>
                )}
```
Place it immediately after the `<h3>` heading.

- [ ] **Step 3: Create `DeleteCategoryModal`**

Model it on `src/modules/admin/components/Modal/BanConfirmationModal/index.tsx`
— same `role="dialog"`, `aria-modal="true"`, Escape-to-close effect, backdrop
click to cancel, and a disabled/spinner state while the request is in flight.

```tsx
"use client";

import {useEffect} from "react";
import {AlertCircle, X} from "lucide-react";
import {useTranslation} from "react-i18next";

interface DeleteCategoryModalProps {
    isOpen: boolean;
    categoryName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function DeleteCategoryModal({
                                        isOpen,
                                        categoryName,
                                        onConfirm,
                                        onCancel,
                                        isLoading = false,
                                    }: DeleteCategoryModalProps) {
    const {t} = useTranslation();

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-100 rounded-full">
                            <AlertCircle className="w-5 h-5 text-red-600"/>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                            {t("admin.category.deleteModal.title")}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label={t("admin.category.deleteModal.cancel")}
                    >
                        <X className="w-5 h-5 text-gray-500"/>
                    </button>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                    {t("admin.category.deleteModal.description", {name: categoryName})}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {t("admin.category.deleteModal.cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isLoading
                            ? t("admin.category.deleteModal.deleting")
                            : t("admin.category.deleteModal.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit` shows no new errors. (`parentName` is optional, so the
page compiles before Task 5 passes it.)

```bash
git add src/modules/admin/components/Modal/CategoryModal/index.tsx src/modules/admin/components/Modal/DeleteCategoryModal/index.tsx
git commit -m "feat(admin): add a description field, a parent hint, and a delete-confirmation modal"
```

---

### Task 5: Wire the page

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: the finished screen. This is the last task.

Five separate defects live in this one file, all in the save/delete paths.

- [ ] **Step 1: Make the "Add Root Category" button work**

Current:
```tsx
                            onClick={() => toast(t("admin.category.addRootComingSoon"))}
```
Change to:
```tsx
                            onClick={() => openAddModal(null)}
```
`openAddModal` already exists and already accepts a nullable parent id.

- [ ] **Step 2: Send `parentId` when creating, and refetch afterwards**

The create call currently drops `parentIdForNew` on the floor (so every
category would be a root even once the backend supports nesting) and returns
without refetching, so a new category doesn't appear until a manual reload.

Replace the whole `if (isAddingNew) { ... }` block with:

```tsx
        if (isAddingNew) {
            const res = await createCategory({
                name: form.name,
                title: form.name,
                parentId: parentIdForNew ?? undefined,
                description: form.description,
                icon: iconMode === "url" ? iconUrl : undefined,
                banner: bannerMode === "url" ? bannerUrl : undefined,
            });

            if (isSuccess(res)) {
                // Images can only be uploaded against an existing id, so the
                // upload tab's files are sent after the category exists.
                const newId = res.data?.categoryView?.category?.id;
                if (newId !== undefined) {
                    if (iconMode === "upload" && iconFile) {
                        await uploadIcon({id: newId}, {image: iconFile});
                    }
                    if (bannerMode === "upload" && bannerFile) {
                        await uploadBanner({id: newId}, {image: bannerFile});
                    }
                }
                toast.success(t("admin.category.created"));
                closeModal();
                await refetch();
            } else if (isFailed(res)) {
                toast.error(t("admin.category.createError"));
            }
            return;
        }
```

Note the `iconMode === "url"` guards: on the upload tab, `iconUrl` holds the
`FileReader`'s base64 `data:` URL from the preview, and sending that as the
category's icon URL is exactly the bug this replaces.

- [ ] **Step 3: Send every editable field on edit**

Current — only title and description are sent, so icon/banner URL edits and
renames are silently discarded:
```tsx
            const res = await editCategory({
                categoryId: editingCategory.category.id,
                title: form.name,
                description: form.description,
            });
```
Change to:
```tsx
            const res = await editCategory({
                categoryId: editingCategory.category.id,
                name: form.name,
                title: form.name,
                description: form.description,
                icon: iconUrl || undefined,
                banner: bannerUrl || undefined,
            });
```
`iconUrl`/`bannerUrl` already hold either the URL-tab value or the URL
returned by the upload earlier in this same handler, so both tabs now
persist.

- [ ] **Step 4: Replace the fire-and-forget delete**

Current — no confirmation, no result check, no refetch, no feedback:
```tsx
                                            onDelete={(id) => deleteCategory({categoryId: id})}
```

Add state near the other `useState` declarations:
```tsx
    const [deletingCategory, setDeletingCategory] = useState<CategoryNodeView | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
```

Change the row's prop so the button opens the confirmation instead of
deleting immediately. `CategoryRow` passes an id, so resolve it back to the
node for the modal's name — walk the tree rather than the flat list, since
the page only holds the tree:
```tsx
                                            onDelete={(id) => {
                                                const findNode = (nodes: CategoryNodeView[]): CategoryNodeView | null => {
                                                    for (const n of nodes) {
                                                        if (n.category.id === id) return n;
                                                        const found = findNode(n.children || []);
                                                        if (found) return found;
                                                    }
                                                    return null;
                                                };
                                                setDeletingCategory(findNode(tree));
                                            }}
```

Add the handler beside `handleSave`:
```tsx
    const handleConfirmDelete = async () => {
        if (!deletingCategory) return;
        setIsDeleting(true);
        const res = await deleteCategory({
            categoryId: deletingCategory.category.id,
            deleted: true,
        });
        setIsDeleting(false);

        if (isSuccess(res)) {
            toast.success(t("admin.category.deleted"));
            setDeletingCategory(null);
            await refetch();
        } else if (isFailed(res)) {
            // The backend refuses to delete a category that still has live
            // subcategories rather than orphaning them.
            toast.error(
                res.err?.error === "categoryHasChildren"
                    ? t("admin.category.deleteHasChildren")
                    : t("admin.category.deleteError"),
            );
        }
    };
```

Render the modal next to the existing `CategoryModal`:
```tsx
                <DeleteCategoryModal
                    isOpen={!!deletingCategory}
                    categoryName={deletingCategory?.category.title ?? ""}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeletingCategory(null)}
                    isLoading={isDeleting}
                />
```
and import it:
```tsx
import {DeleteCategoryModal} from "@/modules/admin/components/Modal/DeleteCategoryModal";
```

Note the failed branch deliberately leaves the modal open, so the admin can
read the error next to the category it refers to.

- [ ] **Step 5: Pass the parent's name to the modal**

`openAddModal` records `parentIdForNew` but nothing displays it. Give the
modal the name so Task 4's hint can render:
```tsx
                    parentName={
                        parentIdForNew !== null
                            ? (() => {
                                const findNode = (nodes: CategoryNodeView[]): CategoryNodeView | null => {
                                    for (const n of nodes) {
                                        if (n.category.id === parentIdForNew) return n;
                                        const found = findNode(n.children || []);
                                        if (found) return found;
                                    }
                                    return null;
                                };
                                return findNode(tree)?.category.title ?? null;
                            })()
                            : null
                    }
```

If Step 4 and Step 5 both end up needing the same tree-walk, hoist it to a
single `findNodeById(nodes, id)` helper defined once above the component and
call it from both places rather than duplicating the closure.

- [ ] **Step 6: Verify**

`npx tsc --noEmit` is clean and `npx eslint "src/app/[lang]/admin/manage-category/page.tsx"`
reports nothing. Then verify in the browser against a backend that has the
new endpoints (see the final section) — the create/delete flows **cannot**
be verified against the default :8536 dev API, which still 405s and 404s on
them.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "feat(admin): wire create, subcategory create, edit and delete on the category page"
```

---

## After all tasks: verification

The running dev API on :8536 predates the backend batch, so create and
delete will fail against it. To verify end to end, run the companion backend
branch on another port and point the frontend at it:

- [ ] Build and run `api-108heros` branch `feat/category-crud-api` on :8537.
- [ ] Temporarily set `NEXT_PUBLIC_API_BASE_URL="http://localhost:8537"` in
      `.env` and restart the frontend dev server so the value is picked up.
- [ ] Walk the spec's testing list: create a root, create a child under it,
      rename it and confirm the rename survives a reload, set an icon by URL
      on edit, try to delete the parent while the child is live (expect the
      "remove subcategories first" error), delete the child, then the parent.
- [ ] Check the Parent column shows real paths, and switch locale to confirm
      every string on the page and in both modals is translated.
- [ ] **Restore `.env` to `http://localhost:8536`** and restart the dev
      server, so the environment is left as it was found.
- [ ] Confirm `git status` is clean apart from intended changes — in
      particular `.env` must not be committed.
