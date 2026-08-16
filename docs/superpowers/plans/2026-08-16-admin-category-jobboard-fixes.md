# Admin Category + Job Board Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Critical/Important bugs the admin audit found on `manage-category` and `manage-job-board` — broken save/edit flows, misleading loading/error states, dead buttons, a filter that silently does nothing, and missing i18n on the category page.

**Architecture:** Two independent pages, fixed as two task groups in one plan (Tasks 1-6 for `manage-category`, Tasks 7-13 for `manage-job-board`). Each task is a self-contained, independently reviewable fix — no shared files between the two groups, only within-group ordering dependencies noted per task.

**Tech Stack:** Next.js App Router, `react-i18next`, the app's generic `useHttpGet`/`useHttpPost`/`useHttpPut`/`useHttpDelete` SWR-backed hooks, `sonner` toasts — no new dependencies.

## Global Constraints

- No new npm dependencies.
- Every new user-facing string goes through `t()` with real English, Thai, and Vietnamese copy — no English-only additions, no machine-garbage translations. New keys for `manage-category` live under `admin.category.*` (page-level) and `admin.category.modal.*` (the create/edit modal), matching the existing `admin.<page>.*` nested-namespace convention.
- No component-test infrastructure exists for either file touched here (confirmed: no `*.test.tsx` alongside `manage-category/page.tsx`, `CategoryModal/index.tsx`, or `manage-job-board/page.tsx`, no `@testing-library/react` in this project). Verify manually in the browser preview, consistent with the prior merged admin batch (PR #37).
- Touch only the files named in this plan. Everything the spec's "Out of scope" section lists (raw-`<table>`→card redesign, `sort`/`intendedUse` filter UI, any other admin page's findings) stays untouched.
- Follow existing code conventions exactly: double-quoted strings, 4-space indent, the `t()`/`useTranslation` pattern already established on `manage-job-board` (which already has i18n) for the newly-added `manage-category` i18n.

---

## Part A: `manage-category`

### Task 1: Fix the loading/error/empty state logic

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx:51,226-238`

**Interfaces:**
- Consumes: nothing new.
- Produces: the `error` variable this task introduces (destructured from `useHttpGet`) is not consumed by any later task, but the render-branch structure it creates is what Task 6 later wraps in `t()`.

- [ ] **Step 1: Destructure `error` from the categories fetch**

Current line 51:
```tsx
const {data: categories, isLoading, execute: refetch} = useHttpGet("listCategories");
```

Change to:
```tsx
const {data: categories, isLoading, error, execute: refetch} = useHttpGet("listCategories");
```

- [ ] **Step 2: Fix the render logic**

Current (lines 226-238):
```tsx
{!isLoading && tree.length === undefined ? (
    <div className="py-16 text-center">
        <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
) : tree.length === 0 ? (
    <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No categories found</p>
        <button onClick={() => openAddModal(null)}
                className="mt-4 text-primary hover:underline">
            Create your first category
        </button>
    </div>
) : (
```

`tree.length === undefined` can never be true — `tree` (from the `useMemo` a few lines above) is always an array, so `.length` is always a number. That branch is dead code; the loading state should key off the hook's own `isLoading` flag instead. Replace with:

```tsx
{isLoading ? (
    <div className="py-16 text-center">
        <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
) : error ? (
    <div className="text-center py-16">
        <p className="text-red-600 text-lg">Something went wrong loading categories</p>
        <button onClick={() => refetch()}
                className="mt-4 text-primary hover:underline">
            Try again
        </button>
    </div>
) : tree.length === 0 ? (
    <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No categories found</p>
        <button onClick={() => openAddModal(null)}
                className="mt-4 text-primary hover:underline">
            Create your first category
        </button>
    </div>
) : (
```

(These new strings stay plain English literals for now — Task 6 converts the whole page and modal to `t()` in one pass, so intermediate tasks don't touch the same lines twice.)

- [ ] **Step 3: Verify in the browser**

Reload `/en/admin/manage-category`. Confirm the spinner shows briefly on load (throttle the network in devtools if it's too fast to see), and the list renders normally afterward. To check the error branch, temporarily break the fetch (e.g. rename the `listCategories` call to a nonexistent method, or block the request in devtools), confirm the red "Something went wrong loading categories" message appears — not the gray "No categories found" empty state — then revert the temporary change.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "fix(admin): manage-category loading/error states, dead spinner condition"
```

---

### Task 2: Guard category creation with isSuccess/isFailed

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx:140-151`

**Interfaces:**
- Consumes: `isSuccess`/`isFailed` (already imported at the top of the file).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Guard the create call**

Current (lines 140-151):
```tsx
        // --- NEW CATEGORY ---
        if (isAddingNew) {
            // CreateCategory has no parent-relationship field (hierarchy is
            // derived server-side from `path`) and requires `title`, which
            // this form doesn't collect separately from `name` -- mirror it
            // until subcategory creation gets a real form/product design.
            await createCategory({
                name: form.name,
                title: form.name,
                description: form.description,
                icon: iconUrl,
                banner: bannerUrl,
            });

            toast.success("Category created!");
            closeModal();
            return;
        }
```

Change to:
```tsx
        // --- NEW CATEGORY ---
        if (isAddingNew) {
            // CreateCategory has no parent-relationship field (hierarchy is
            // derived server-side from `path`) and requires `title`, which
            // this form doesn't collect separately from `name` -- mirror it
            // until subcategory creation gets a real form/product design.
            const res = await createCategory({
                name: form.name,
                title: form.name,
                description: form.description,
                icon: iconUrl,
                banner: bannerUrl,
            });

            if (isSuccess(res)) {
                toast.success("Category created!");
                closeModal();
            } else if (isFailed(res)) {
                toast.error("Failed to create the category. Please try again.");
            }
            return;
        }
```

- [ ] **Step 2: Verify in the browser**

Create a category with valid data — confirm the success toast and the modal closing, same as before. Then force a failure (e.g. temporarily point `createCategory` at a nonexistent method name, or disconnect the network) and confirm an error toast appears and the modal stays open — not a false "Category created!" — then revert the temporary change.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "fix(admin): guard category creation with isSuccess/isFailed, matching the icon/banner upload pattern"
```

---

### Task 3: Wire real edit persistence

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx:13-18,53-57,153-155`

**Interfaces:**
- Consumes: `useHttpPut` (`src/hooks/api/http/useHttpPut.ts`, already used elsewhere in this codebase for the identical pattern, e.g. `src/app/[lang]/(profile)/account-setting/bank-account/page.tsx`). The `editCategory` API method (`src/lib/108jobs-client/src/http.ts`) takes an `EditCategory` body: `{categoryId: CategoryId; title?: string; sidebar?: string; description?: string; nsfw?: boolean; postingRestrictedToMods?: boolean; visibility?: CategoryVisibility;}` — note there is no `name`, `icon`, or `banner` field on this type. This fix persists the category's name (via `title`) and description; icon/banner already persist correctly today when a new file is picked in upload mode (the `uploadIcon`/`uploadBanner` calls earlier in `handleSave` run regardless of `isAddingNew`) — that path isn't touched by this task.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Import `useHttpPut` and instantiate the edit hook**

Current (line 13, part of the import block):
```tsx
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
```

Change to:
```tsx
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpPut} from "@/hooks/api/http/useHttpPut";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
```

Current (lines 53-54):
```tsx
    const {execute: createCategory} = useHttpPost("createCategory");
    const {execute: deleteCategory} = useHttpDelete("deleteCategory");
```

Change to:
```tsx
    const {execute: createCategory} = useHttpPost("createCategory");
    const {execute: editCategory} = useHttpPut("editCategory");
    const {execute: deleteCategory} = useHttpDelete("deleteCategory");
```

- [ ] **Step 2: Call `editCategory` in the edit branch of `handleSave`**

Current, the end of `handleSave` (lines 153-155 — this is what execution falls through to when `isAddingNew` is false, i.e. editing):
```tsx
        closeModal();
        await refetch();
    };
```

Change to:
```tsx
        if (editingCategory) {
            const res = await editCategory({
                categoryId: editingCategory.category.id,
                title: form.name,
                description: form.description,
            });

            if (isFailed(res)) {
                toast.error("Failed to save changes. Please try again.");
                return;
            }
        }

        closeModal();
        await refetch();
    };
```

- [ ] **Step 3: Verify in the browser**

Edit an existing category's name and/or description, save, and reload the page — confirm the change actually persisted (previously it silently reverted, since no network call was made). Force a failure the same way as Task 2's verification and confirm an error toast appears with the modal staying open, not a silent success.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "fix(admin): persist category edits via editCategory (name/description previously never saved)"
```

---

### Task 4: Fix the "Coming soon" button

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx:202-219`

**Interfaces:**
- Consumes: `toast` (already imported from `sonner`).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace the disabled-button-with-hover-tooltip pattern**

The button is `disabled`, so a CSS `:focus` fix wouldn't help — disabled controls can't receive keyboard focus at all. The fix instead makes it a real, always-clickable button that shows the same message via a toast, reachable by mouse, touch, or keyboard alike.

Current (lines 202-219):
```tsx
                        <div className="relative group inline-block">
                            <button
                                disabled
                                className="inline-flex items-center bg-primary text-white py-3 px-6
                   rounded-xl text-sm font-semibold shadow-md opacity-60
                   cursor-not-allowed"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2"/>
                                Add Root Category
                            </button>

                            <span
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-2
                   bg-black text-white text-xs px-2 py-1 rounded
                   opacity-0 group-hover:opacity-100 transition-opacity">
        Coming soon
    </span>
                        </div>
```

Change to:
```tsx
                        <button
                            onClick={() => toast("Adding root categories isn't available yet — coming soon.")}
                            className="inline-flex items-center bg-primary text-white py-3 px-6
                   rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2"/>
                            Add Root Category
                        </button>
```

- [ ] **Step 2: Verify in the browser**

Click the button — confirm a toast with the "coming soon" message appears. Tab to it with the keyboard and press Enter/Space — confirm the same toast appears (this is the part that was previously unreachable).

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "fix(admin): make 'Add Root Category' reachable by touch and keyboard, not hover-only"
```

---

### Task 5: Fix the lightbox close button, add Escape-to-close

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx:3,66-70,300-303`

**Interfaces:**
- Consumes: nothing new.
- Produces: the `useEffect` import this task adds is relied on by Task 6 only in the sense that Task 6's "before" state for the import line must include it (noted there).

- [ ] **Step 1: Import `useEffect`**

Current (line 3):
```tsx
import React, {useState, useMemo} from "react";
```

Change to:
```tsx
import React, {useState, useMemo, useEffect} from "react";
```

- [ ] **Step 2: Add an Escape-key handler**

Current (lines 66-70, right after `openImageLightbox`'s definition):
```tsx
    const openImageLightbox = (src: string, alt: string) => {
        setLightboxSrc(src);
        setLightboxAlt(alt);
        setLightboxOpen(true);
    };
```

Change to:
```tsx
    const openImageLightbox = (src: string, alt: string) => {
        setLightboxSrc(src);
        setLightboxAlt(alt);
        setLightboxOpen(true);
    };

    useEffect(() => {
        if (!lightboxOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setLightboxOpen(false);
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [lightboxOpen]);
```

- [ ] **Step 3: Give the close button a real handler**

Current (lines 300-303):
```tsx
                            <button
                                className="absolute top-4 right-4 bg-white/90 text-black rounded-full w-10 h-10 text-2xl hover:bg-white">
                                ×
                            </button>
```

Change to:
```tsx
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxOpen(false);
                                }}
                                aria-label="Close image preview"
                                className="absolute top-4 right-4 bg-white/90 text-black rounded-full w-10 h-10 text-2xl hover:bg-white">
                                ×
                            </button>
```

(`e.stopPropagation()` isn't strictly required now that the button has its own handler — the backdrop's `onClick` would fire the same `setLightboxOpen(false)` regardless — but it's here so the button's behavior doesn't depend on bubbling to a specific ancestor, which was exactly the bug being fixed.)

- [ ] **Step 4: Verify in the browser**

Open a category's icon/banner in the lightbox. Click the × button — confirm it closes. Reopen it and press Escape — confirm it closes that way too.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx"
git commit -m "fix(admin): lightbox close button gets a real handler, add Escape-to-close"
```

---

### Task 6: Add i18n to `manage-category` and its modal

**Files:**
- Modify: `src/app/[lang]/admin/manage-category/page.tsx` (full file, after Tasks 1-5)
- Modify: `src/modules/admin/components/Modal/CategoryModal/index.tsx` (full file)
- Modify: `src/translations/en.ts`
- Modify: `src/translations/th.ts`
- Modify: `src/translations/vi.ts`

**Interfaces:**
- Consumes: the render structure, toasts, and JSX from Tasks 1-5 (all fully landed by the time this task runs — every string this task converts already exists as a plain-English literal from those tasks or from the original file).
- Produces: the `admin.category.*` / `admin.category.modal.*` translation namespace, not consumed by any other task in this plan.

- [ ] **Step 1: Add the translation keys**

In `src/translations/en.ts`, find the `admin: { layout: { ... }, withdraw: { ... } }` structure (from the prior merged batch) and add a new `category` key as a sibling of `layout`, before `withdraw`:

```ts
        admin: {
            layout: {
                header: {
                    logout: "Logout",
                    defaultAdminLabel: "Admin",
                },
                sidebar: {
                    ...
                },
            },
            category: {
                title: "Manage Categories",
                subtitle: "Organize your service catalog structure",
                addRoot: "Add Root Category",
                addRootComingSoon: "Adding root categories isn't available yet — coming soon.",
                imageTooLarge: "Image must be under 5MB",
                invalidImageType: "Please upload an image",
                nameRequired: "Category name is required",
                iconUploadError: "Some error occurred while uploading the icon. Please try again later.",
                bannerUploadError: "Some error occurred while uploading the banner. Please try again later.",
                created: "Category created!",
                createError: "Failed to create the category. Please try again.",
                saveError: "Failed to save changes. Please try again.",
                loadError: "Something went wrong loading categories",
                retry: "Try again",
                empty: "No categories found",
                createFirst: "Create your first category",
                columnCategory: "Category",
                columnParent: "Parent",
                columnSubcategories: "Subcategories",
                columnActions: "Actions",
                lightboxCaption: "{{name}} — Click to close",
                lightboxCloseLabel: "Close image preview",
                modal: {
                    addTitle: "Add New Category",
                    editTitle: "Edit Category",
                    nameLabel: "Name",
                    namePlaceholder: "Mobile Development",
                    namePreviewFallback: "Category Name",
                    iconLabel: "Icon (64x64 recommended)",
                    tabUrl: "URL",
                    tabUpload: "Upload",
                    clickToUploadIcon: "Click to upload icon",
                    iconAlt: "Category icon",
                    iconPreviewAlt: "Icon preview",
                    bannerLabel: "Banner Image",
                    bannerHint: "(Recommended: 1920×600px)",
                    tabEnterUrl: "Enter URL",
                    tabUploadImage: "Upload Image",
                    bannerPreviewAlt: "Banner preview",
                    clickToEnlarge: "Click banner to enlarge",
                    clickToUploadBanner: "Click to upload banner",
                    bannerUploadHint: "JPG, PNG · Max 5MB · 1920×600 recommended",
                    bannerAlt: "Banner image",
                    cancel: "Cancel",
                    create: "Create",
                    save: "Save",
                },
            },
            withdraw: {
```

(Only the new `category: { ... }` block is being added here — `layout` and `withdraw` already exist from the prior batch and are shown only for insertion-point context. `layout.header.defaultAdminLabel` was already added by the prior batch too, shown here only as more context — not part of this task.)

In `src/translations/th.ts`, the same insertion (Thai copy):
```ts
            category: {
                title: "จัดการหมวดหมู่",
                subtitle: "จัดระเบียบโครงสร้างแคตตาล็อกบริการของคุณ",
                addRoot: "เพิ่มหมวดหมู่หลัก",
                addRootComingSoon: "ยังไม่สามารถเพิ่มหมวดหมู่หลักได้ในขณะนี้ — เร็ว ๆ นี้",
                imageTooLarge: "รูปภาพต้องมีขนาดไม่เกิน 5MB",
                invalidImageType: "กรุณาอัปโหลดไฟล์รูปภาพ",
                nameRequired: "กรุณากรอกชื่อหมวดหมู่",
                iconUploadError: "เกิดข้อผิดพลาดขณะอัปโหลดไอคอน กรุณาลองใหม่อีกครั้งในภายหลัง",
                bannerUploadError: "เกิดข้อผิดพลาดขณะอัปโหลดแบนเนอร์ กรุณาลองใหม่อีกครั้งในภายหลัง",
                created: "สร้างหมวดหมู่สำเร็จแล้ว!",
                createError: "สร้างหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
                saveError: "บันทึกการเปลี่ยนแปลงไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
                loadError: "เกิดข้อผิดพลาดขณะโหลดหมวดหมู่",
                retry: "ลองใหม่อีกครั้ง",
                empty: "ไม่พบหมวดหมู่",
                createFirst: "สร้างหมวดหมู่แรกของคุณ",
                columnCategory: "หมวดหมู่",
                columnParent: "หมวดหมู่หลัก",
                columnSubcategories: "หมวดหมู่ย่อย",
                columnActions: "การดำเนินการ",
                lightboxCaption: "{{name}} — คลิกเพื่อปิด",
                lightboxCloseLabel: "ปิดตัวอย่างรูปภาพ",
                modal: {
                    addTitle: "เพิ่มหมวดหมู่ใหม่",
                    editTitle: "แก้ไขหมวดหมู่",
                    nameLabel: "ชื่อ",
                    namePlaceholder: "การพัฒนาแอปมือถือ",
                    namePreviewFallback: "ชื่อหมวดหมู่",
                    iconLabel: "ไอคอน (แนะนำ 64x64)",
                    tabUrl: "URL",
                    tabUpload: "อัปโหลด",
                    clickToUploadIcon: "คลิกเพื่ออัปโหลดไอคอน",
                    iconAlt: "ไอคอนหมวดหมู่",
                    iconPreviewAlt: "ตัวอย่างไอคอน",
                    bannerLabel: "รูปแบนเนอร์",
                    bannerHint: "(แนะนำ: 1920×600px)",
                    tabEnterUrl: "กรอก URL",
                    tabUploadImage: "อัปโหลดรูปภาพ",
                    bannerPreviewAlt: "ตัวอย่างแบนเนอร์",
                    clickToEnlarge: "คลิกที่แบนเนอร์เพื่อขยาย",
                    clickToUploadBanner: "คลิกเพื่ออัปโหลดแบนเนอร์",
                    bannerUploadHint: "JPG, PNG · สูงสุด 5MB · แนะนำ 1920×600",
                    bannerAlt: "รูปแบนเนอร์",
                    cancel: "ยกเลิก",
                    create: "สร้าง",
                    save: "บันทึก",
                },
            },
```

In `src/translations/vi.ts`, the same insertion (Vietnamese copy):
```ts
            category: {
                title: "Quản lý danh mục",
                subtitle: "Sắp xếp cấu trúc danh mục dịch vụ của bạn",
                addRoot: "Thêm danh mục gốc",
                addRootComingSoon: "Chưa thể thêm danh mục gốc — sắp ra mắt.",
                imageTooLarge: "Hình ảnh phải nhỏ hơn 5MB",
                invalidImageType: "Vui lòng tải lên một hình ảnh",
                nameRequired: "Vui lòng nhập tên danh mục",
                iconUploadError: "Đã xảy ra lỗi khi tải biểu tượng lên. Vui lòng thử lại sau.",
                bannerUploadError: "Đã xảy ra lỗi khi tải banner lên. Vui lòng thử lại sau.",
                created: "Đã tạo danh mục thành công!",
                createError: "Tạo danh mục không thành công. Vui lòng thử lại.",
                saveError: "Lưu thay đổi không thành công. Vui lòng thử lại.",
                loadError: "Đã xảy ra lỗi khi tải danh mục",
                retry: "Thử lại",
                empty: "Không tìm thấy danh mục",
                createFirst: "Tạo danh mục đầu tiên của bạn",
                columnCategory: "Danh mục",
                columnParent: "Danh mục cha",
                columnSubcategories: "Danh mục con",
                columnActions: "Hành động",
                lightboxCaption: "{{name}} — Nhấn để đóng",
                lightboxCloseLabel: "Đóng xem trước hình ảnh",
                modal: {
                    addTitle: "Thêm danh mục mới",
                    editTitle: "Chỉnh sửa danh mục",
                    nameLabel: "Tên",
                    namePlaceholder: "Phát triển ứng dụng di động",
                    namePreviewFallback: "Tên danh mục",
                    iconLabel: "Biểu tượng (khuyến nghị 64x64)",
                    tabUrl: "URL",
                    tabUpload: "Tải lên",
                    clickToUploadIcon: "Nhấn để tải biểu tượng lên",
                    iconAlt: "Biểu tượng danh mục",
                    iconPreviewAlt: "Xem trước biểu tượng",
                    bannerLabel: "Hình ảnh banner",
                    bannerHint: "(Khuyến nghị: 1920×600px)",
                    tabEnterUrl: "Nhập URL",
                    tabUploadImage: "Tải hình ảnh lên",
                    bannerPreviewAlt: "Xem trước banner",
                    clickToEnlarge: "Nhấn vào banner để phóng to",
                    clickToUploadBanner: "Nhấn để tải banner lên",
                    bannerUploadHint: "JPG, PNG · Tối đa 5MB · Khuyến nghị 1920×600",
                    bannerAlt: "Hình ảnh banner",
                    cancel: "Hủy",
                    create: "Tạo",
                    save: "Lưu",
                },
            },
```

- [ ] **Step 2: Wire `page.tsx`**

Add the import (alongside the others at the top):
```tsx
import {useTranslation} from "react-i18next";
```

Add the hook inside the component, as the first line of the function body:
```tsx
export default function AdminCategoriesPage() {
    const {t} = useTranslation();
    const [editingCategory, setEditingCategory] = useState<CategoryNodeView | null>(null);
```

Then replace every plain-English literal with its `t()` call, one-for-one (each of these strings is unique in the file at this point, after Tasks 1-5 — locate and replace each):

| Current literal | Replace with |
|---|---|
| `toast.error("Image must be under 5MB");` | `toast.error(t("admin.category.imageTooLarge"));` |
| `toast.error("Please upload an image");` | `toast.error(t("admin.category.invalidImageType"));` |
| `toast.error("Category name is required");` | `toast.error(t("admin.category.nameRequired"));` |
| `toast.error("Some error occurred while uploading the icon. Please try again later.");` | `toast.error(t("admin.category.iconUploadError"));` |
| `toast.error("Some error occurred while uploading the banner. Please try again later.");` | `toast.error(t("admin.category.bannerUploadError"));` |
| `toast.success("Category created!");` | `toast.success(t("admin.category.created"));` |
| `toast.error("Failed to create the category. Please try again.");` | `toast.error(t("admin.category.createError"));` |
| `toast.error("Failed to save changes. Please try again.");` | `toast.error(t("admin.category.saveError"));` |
| `<h1 className="text-2xl font-bold text-primary mb-1">Manage Categories</h1>` | `<h1 className="text-2xl font-bold text-primary mb-1">{t("admin.category.title")}</h1>` |
| `<p className="text-gray-600">Organize your service catalog structure</p>` | `<p className="text-gray-600">{t("admin.category.subtitle")}</p>` |
| `onClick={() => toast("Adding root categories isn't available yet — coming soon.")}` | `onClick={() => toast(t("admin.category.addRootComingSoon"))}` |
| `Add Root Category` (button text, inside the button from Task 4) | `{t("admin.category.addRoot")}` |
| `<p className="text-red-600 text-lg">Something went wrong loading categories</p>` | `<p className="text-red-600 text-lg">{t("admin.category.loadError")}</p>` |
| `Try again` (retry button text) | `{t("admin.category.retry")}` |
| `<p className="text-gray-500 text-lg">No categories found</p>` | `<p className="text-gray-500 text-lg">{t("admin.category.empty")}</p>` |
| `Create your first category` (button text) | `{t("admin.category.createFirst")}` |
| `<th ...>Category</th>` | `<th ...>{t("admin.category.columnCategory")}</th>` |
| `<th ...>Parent</th>` | `<th ...>{t("admin.category.columnParent")}</th>` |
| `<th ...>Subcategories</th>` | `<th ...>{t("admin.category.columnSubcategories")}</th>` |
| `<th ...>Actions</th>` | `<th ...>{t("admin.category.columnActions")}</th>` |
| `aria-label="Close image preview"` | `aria-label={t("admin.category.lightboxCloseLabel")}` |
| `{lightboxAlt} — Click to close` | `{t("admin.category.lightboxCaption", {name: lightboxAlt})}` |

(Every `<th>`'s full className is unchanged — only its text content is being wrapped in `t()`. The `<h1>`/`<p>` full lines are shown for exact-match context; only the text node inside changes.)

- [ ] **Step 3: Wire `CategoryModal/index.tsx`**

Add the import (line 3-6 area):
```tsx
"use client";

import React from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
```

Add the hook as the first line of the component body:
```tsx
export function CategoryModal({
                                  ...
                              }: CategoryModalProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;
```

Then replace every plain-English literal one-for-one:

| Current literal | Replace with |
|---|---|
| `{isAddingNew ? "Add New Category" : "Edit Category"}` | `{isAddingNew ? t("admin.category.modal.addTitle") : t("admin.category.modal.editTitle")}` |
| `Name <span className="text-red-500">*</span>` (label text before the span) | `{t("admin.category.modal.nameLabel")} <span className="text-red-500">*</span>` |
| `placeholder="Mobile Development"` (the name input) | `placeholder={t("admin.category.modal.namePlaceholder")}` |
| `Icon (64x64 recommended)` | `{t("admin.category.modal.iconLabel")}` |
| `URL` (icon tab button text) | `{t("admin.category.modal.tabUrl")}` |
| `Upload` (icon tab button text) | `{t("admin.category.modal.tabUpload")}` |
| `<p className="text-gray-500">Click to upload icon</p>` | `<p className="text-gray-500">{t("admin.category.modal.clickToUploadIcon")}</p>` |
| `<Image src={uploadedIcon} alt="Icon" ...>` | `<Image src={uploadedIcon} alt={t("admin.category.modal.iconAlt")} ...>` |
| `<Image src={form.icon} alt="Icon preview" ...>` | `<Image src={form.icon} alt={t("admin.category.modal.iconPreviewAlt")} ...>` |
| `Banner Image <span className="text-gray-500 text-xs">(Recommended: 1920×600px)</span>` | `{t("admin.category.modal.bannerLabel")} <span className="text-gray-500 text-xs">{t("admin.category.modal.bannerHint")}</span>` |
| `Enter URL` (banner tab button text) | `{t("admin.category.modal.tabEnterUrl")}` |
| `Upload Image` (banner tab button text) | `{t("admin.category.modal.tabUploadImage")}` |
| `<Image src={form.banner} alt="Banner preview" ...>` | `<Image src={form.banner} alt={t("admin.category.modal.bannerPreviewAlt")} ...>` |
| `<p className="text-2xl font-bold">{form.name \|\| "Category Name"}</p>` (both occurrences — URL-mode preview and upload-mode preview) | `<p className="text-2xl font-bold">{form.name \|\| t("admin.category.modal.namePreviewFallback")}</p>` |
| `<p className="text-sm opacity-90">Click banner to enlarge</p>` | `<p className="text-sm opacity-90">{t("admin.category.modal.clickToEnlarge")}</p>` |
| `<p className="text-gray-600 font-medium">Click to upload banner</p>` | `<p className="text-gray-600 font-medium">{t("admin.category.modal.clickToUploadBanner")}</p>` |
| `<p className="text-xs text-gray-500 mt-1">JPG, PNG · Max 5MB · 1920×600 recommended</p>` | `<p className="text-xs text-gray-500 mt-1">{t("admin.category.modal.bannerUploadHint")}</p>` |
| `<Image src={uploadedBanner} alt="Banner" ...>` | `<Image src={uploadedBanner} alt={t("admin.category.modal.bannerAlt")} ...>` |
| `Cancel` (button text) | `{t("admin.category.modal.cancel")}` |
| `{isAddingNew ? "Create" : "Save"}` | `{isAddingNew ? t("admin.category.modal.create") : t("admin.category.modal.save")}` |

The icon/banner URL-mode `placeholder="https://..."` and `placeholder="https://storage.googleapis.com/..."` stay as plain literals — they're format examples, not translatable content, same treatment as any other URL-syntax hint in this codebase.

- [ ] **Step 4: Verify in the browser**

Reload the page in English — everything should read identically to before this task (same words, now sourced from `t()`). Switch to `/th/admin/manage-category` — confirm the page title, empty/error states, table headers, and the create/edit modal (both add and edit mode) all render in Thai. Switch to `/vi/` — confirm Vietnamese. Trigger the lightbox and confirm its caption and close-button label are also translated.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-category/page.tsx" src/modules/admin/components/Modal/CategoryModal/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): add i18n to manage-category page and its create/edit modal"
```

---

## Part B: `manage-job-board`

### Task 7: Scope the loading state to the table region

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:26,356-360`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Remove the now-to-be-unused `LoadingBlur` import**

Current (line 26):
```tsx
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
```

Delete this line entirely (it's used nowhere else in this file).

- [ ] **Step 2: Replace the full-viewport blur with a scoped spinner**

`LoadingBlur` renders `fixed inset-0` (viewport-relative), so it covers the sidebar and header on every revalidation, not just first load, since `isLoading` here tracks SWR's `isValidating` (true on every filter change that reaches the query, not only the first fetch).

Current (lines 356-360):
```tsx
                        <div className="overflow-x-auto">
                            {isLoading ? (
                                <div className="py-12 text-center">
                                    <LoadingBlur text=""/>
                                </div>
                            ) : (
```

Change to:
```tsx
                        <div className="overflow-x-auto">
                            {isLoading ? (
                                <div className="py-12 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : (
```

(Same spinner markup `manage-category` already uses, for visual consistency between the two pages this plan touches.)

- [ ] **Step 3: Verify in the browser**

Change the Category or Job Type filter (either reaches the query and triggers `isValidating`). Confirm a small spinner appears inside the table area only — the sidebar and header stay fully visible and interactive, unlike before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): scope manage-job-board's loading state to the table, stop blurring the whole admin shell"
```

---

### Task 8: Re-enable the Hide/Delete buttons

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:29-34,428-454`

**Interfaces:**
- Consumes: `handleDelete`/`handleToggleVisibility` (already fully implemented, lines 183-203 — untouched by this task) and the `t()` keys they already reference (`admin.confirmDeleteJob`, `admin.jobDeleted`, `admin.jobDeleteFailed`, `admin.jobUnhidden`, `admin.jobHidden`, `admin.toggleFailed`, `admin.unhide`, `admin.hide`, `global.delete`) — all pre-existing, none added by this task.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Fix the icon imports**

`faTrash` (used by the commented-out Delete button) isn't imported anywhere in this file — un-commenting it as-is would fail to compile. `faBan` is imported but referenced nowhere in the file, including inside the commented block — it's dead.

Current (lines 29-34):
```tsx
import {
    faEye,
    faToggleOn,
    faToggleOff,
    faBan,
} from "@fortawesome/free-solid-svg-icons";
```

Change to:
```tsx
import {
    faEye,
    faToggleOn,
    faToggleOff,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
```

- [ ] **Step 2: Un-comment the Hide/Delete buttons**

Current (lines 428-454):
```tsx
                                                <td className="px-6 py-4 text-sm font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => router.push(`/job-board/${job.post.id}`)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                            title={t("global.view")}
                                                        >
                                                            <FontAwesomeIcon icon={faEye}/>
                                                        </button>
                                                        {/*<button*/}
                                                        {/*    onClick={() => handleToggleVisibility(job)}*/}
                                                        {/*    className={`${*/}
                                                        {/*        job.post.removed ? "text-green-600" : "text-orange-600"*/}
                                                        {/*    } hover:opacity-80`}*/}
                                                        {/*    title={job.post.removed ? t("admin.unhide") : t("admin.hide")}*/}
                                                        {/*>*/}
                                                        {/*    <FontAwesomeIcon*/}
                                                        {/*        icon={job.post.removed ? faToggleOff : faToggleOn}/>*/}
                                                        {/*</button>*/}
                                                        {/*<button*/}
                                                        {/*    onClick={() => handleDelete(job.post.id)}*/}
                                                        {/*    className="text-red-600 hover:text-red-800"*/}
                                                        {/*    title={t("global.delete")}*/}
                                                        {/*>*/}
                                                        {/*    <FontAwesomeIcon icon={faTrash}/>*/}
                                                        {/*</button>*/}
                                                    </div>
                                                </td>
```

Change to:
```tsx
                                                <td className="px-6 py-4 text-sm font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => router.push(`/job-board/${job.post.id}`)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                            title={t("global.view")}
                                                        >
                                                            <FontAwesomeIcon icon={faEye}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleVisibility(job)}
                                                            className={`${
                                                                job.post.removed ? "text-green-600" : "text-orange-600"
                                                            } hover:opacity-80`}
                                                            title={job.post.removed ? t("admin.unhide") : t("admin.hide")}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={job.post.removed ? faToggleOff : faToggleOn}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(job.post.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title={t("global.delete")}
                                                        >
                                                            <FontAwesomeIcon icon={faTrash}/>
                                                        </button>
                                                    </div>
                                                </td>
```

- [ ] **Step 3: Verify in the browser**

Confirm three icons now show per row: view (blue eye), hide/unhide (orange/green toggle), delete (red trash). Click hide on a visible post — confirm it toggles to "Hidden" in the Status column and a success toast appears. Click delete on a test post — confirm the browser's confirm dialog appears, and confirming it removes the post from the list with a success toast.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): re-enable Hide/Delete buttons on manage-job-board (fully wired, just never rendered)"
```

---

### Task 9: Remove the non-functional Status filter

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:45-53,63-71,85-97,123-141,205-228,230-240,242-253,317-325`

**Interfaces:**
- Consumes: nothing new.
- Produces: the post-removal shape of `FilterState`, the filters-reset `useEffect`, `clearFilters`, and the `useHttpGet` params object — Task 11 (clear-filters route) and Task 12 (`pageBack`) both edit code adjacent to what this task changes, and their "before" snippets reflect this task's result, not the original file.

The `Search` API request type has no `hidden`/`status` field at all — the commented-out `hidden:` line in the fetch call was speculative from the start, not something to uncomment. Per the design decision: remove the Status filter entirely rather than fake-filter client-side against a server-paginated result set. Every step below is part of one atomic removal — a partial removal would leave the file referencing a field that no longer exists.

- [ ] **Step 1: Remove `status` from `FilterState`**

Current (lines 45-53):
```tsx
interface FilterState {
    category: CategoryId | undefined;
    jobType: JobType | undefined;
    intendedUse: IntendedUse | undefined;
    budgetMin: number | undefined;
    budgetMax: number | undefined;
    sort: PostSortType | undefined;
    status: "all" | "active" | "hidden" | undefined;
}
```

Change to:
```tsx
interface FilterState {
    category: CategoryId | undefined;
    jobType: JobType | undefined;
    intendedUse: IntendedUse | undefined;
    budgetMin: number | undefined;
    budgetMax: number | undefined;
    sort: PostSortType | undefined;
}
```

- [ ] **Step 2: Remove `status` from the initial filter state**

Current (lines 63-71):
```tsx
    const [filters, setFilters] = useState<FilterState>({
        category: undefined,
        jobType: undefined,
        intendedUse: undefined,
        budgetMin: undefined,
        budgetMax: undefined,
        sort: undefined,
        status: undefined,
    });
```

Change to:
```tsx
    const [filters, setFilters] = useState<FilterState>({
        category: undefined,
        jobType: undefined,
        intendedUse: undefined,
        budgetMin: undefined,
        budgetMax: undefined,
        sort: undefined,
    });
```

- [ ] **Step 3: Remove the speculative `hidden:` comment from the fetch call**

Current (lines 85-97):
```tsx
    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
        execute: refreshJobs,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: filters.category,
        pageCursor: currentCursor,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        jobType: filters.jobType,
        intendedUse: filters.intendedUse,
        limit: ITEMS_PER_PAGE,
        // Add custom admin filter if backend supports
        // hidden: filters.status === "hidden" ? true : filters.status === "active" ? false : undefined,
    });
```

Change to:
```tsx
    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
        execute: refreshJobs,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: filters.category,
        pageCursor: currentCursor,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        jobType: filters.jobType,
        intendedUse: filters.intendedUse,
        limit: ITEMS_PER_PAGE,
    });
```

- [ ] **Step 4: Remove `status` from the URL-param sync in `handleFilterChange`**

Current (lines 123-141):
```tsx
            queueMicrotask(() => {
                const params = new URLSearchParams(searchParams);
                if (updatedFilters.category) params.set("category", updatedFilters.category.toString());
                else params.delete("category");
                if (updatedFilters.jobType) params.set("jobType", updatedFilters.jobType);
                else params.delete("jobType");
                if (updatedFilters.intendedUse) params.set("intendedUse", updatedFilters.intendedUse);
                else params.delete("intendedUse");
                if (updatedFilters.budgetMin) params.set("budgetMin", updatedFilters.budgetMin.toString());
                else params.delete("budgetMin");
                if (updatedFilters.budgetMax) params.set("budgetMax", updatedFilters.budgetMax.toString());
                else params.delete("budgetMax");
                if (updatedFilters.sort) params.set("sort", updatedFilters.sort);
                else params.delete("sort");
                if (updatedFilters.status && updatedFilters.status !== "all") params.set("status", updatedFilters.status);
                else params.delete("status");

                router.push(`?${params.toString()}`, {scroll: false});
            });
```

Change to:
```tsx
            queueMicrotask(() => {
                const params = new URLSearchParams(searchParams);
                if (updatedFilters.category) params.set("category", updatedFilters.category.toString());
                else params.delete("category");
                if (updatedFilters.jobType) params.set("jobType", updatedFilters.jobType);
                else params.delete("jobType");
                if (updatedFilters.intendedUse) params.set("intendedUse", updatedFilters.intendedUse);
                else params.delete("intendedUse");
                if (updatedFilters.budgetMin) params.set("budgetMin", updatedFilters.budgetMin.toString());
                else params.delete("budgetMin");
                if (updatedFilters.budgetMax) params.set("budgetMax", updatedFilters.budgetMax.toString());
                else params.delete("budgetMax");
                if (updatedFilters.sort) params.set("sort", updatedFilters.sort);
                else params.delete("sort");

                router.push(`?${params.toString()}`, {scroll: false});
            });
```

- [ ] **Step 5: Remove `status` from `clearFilters`, `hasActiveFilters`, and the URL-sync effect**

Current (lines 205-228):
```tsx
    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
            status: undefined,
        });
        router.push(`/admin/job-board`, {scroll: false});
    }, [router]);

    const hasActiveFilters = useMemo(
        () =>
            filters.category ||
            filters.jobType ||
            filters.intendedUse ||
            filters.budgetMin ||
            filters.budgetMax ||
            filters.sort ||
            filters.status,
        [filters]
    );
```

Change to:
```tsx
    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
        });
        router.push(`/admin/job-board`, {scroll: false});
    }, [router]);

    const hasActiveFilters = useMemo(
        () =>
            filters.category ||
            filters.jobType ||
            filters.intendedUse ||
            filters.budgetMin ||
            filters.budgetMax ||
            filters.sort,
        [filters]
    );
```

(`clearFilters`'s `router.push` line is deliberately left as-is here — Task 11 fixes it separately.)

Current (lines 230-240):
```tsx
    useEffect(() => {
        setFilters({
            category: searchParams.get("category") ? parseInt(searchParams.get("category")!) : undefined,
            jobType: searchParams.get("jobType") as JobType | undefined,
            intendedUse: searchParams.get("intendedUse") as IntendedUse | undefined,
            budgetMin: searchParams.get("budgetMin") ? parseInt(searchParams.get("budgetMin")!) : undefined,
            budgetMax: searchParams.get("budgetMax") ? parseInt(searchParams.get("budgetMax")!) : undefined,
            sort: searchParams.get("sort") as PostSortType | undefined,
            status: searchParams.get("status") as "all" | "active" | "hidden" | undefined,
        });
    }, [searchParams]);
```

Change to:
```tsx
    useEffect(() => {
        setFilters({
            category: searchParams.get("category") ? parseInt(searchParams.get("category")!) : undefined,
            jobType: searchParams.get("jobType") as JobType | undefined,
            intendedUse: searchParams.get("intendedUse") as IntendedUse | undefined,
            budgetMin: searchParams.get("budgetMin") ? parseInt(searchParams.get("budgetMin")!) : undefined,
            budgetMax: searchParams.get("budgetMax") ? parseInt(searchParams.get("budgetMax")!) : undefined,
            sort: searchParams.get("sort") as PostSortType | undefined,
        });
    }, [searchParams]);
```

- [ ] **Step 6: Remove `filters.status` from the cursor-reset effect's dependency array**

Current (lines 242-253):
```tsx
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
    }, [
        filters.category,
        filters.sort,
        filters.budgetMin,
        filters.budgetMax,
        filters.jobType,
        filters.intendedUse,
        filters.status,
    ]);
```

Change to:
```tsx
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
    }, [
        filters.category,
        filters.sort,
        filters.budgetMin,
        filters.budgetMax,
        filters.jobType,
        filters.intendedUse,
    ]);
```

- [ ] **Step 7: Remove the Status `<select>` from the filter bar**

Current (lines 316-325, including the leading comment and the blank line after):
```tsx
                            {/* Status */}
                            <select
                                value={filters.status || "all"}
                                onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
                                className="px-4 py-2 border rounded-lg text-sm"
                            >
                                <option value="all">{t("admin.statusAll")}</option>
                                <option value="active">{t("admin.statusActive")}</option>
                                <option value="hidden">{t("admin.statusHidden")}</option>
                            </select>

```

Delete this block entirely.

- [ ] **Step 8: Verify**

Run `npx tsc --noEmit` and confirm no new errors (only the 3 pre-existing, unrelated ones in `src/modules/chat/EnsureSharedKeyBootstrap` should remain — a leftover `filters.status` reference anywhere would surface as a real type error here). Reload the page in the browser and confirm the filter bar no longer shows a Status dropdown, and the other filters (Category, Job Type, Budget) still work.

- [ ] **Step 9: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): remove the Status filter -- the search API has no hidden/status param to wire it to"
```

---

### Task 10: Render the error state inside `AdminLayout`

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:259-264`

**Interfaces:**
- Consumes: `AdminLayout` (already imported), `ErrorState` (already imported).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Wrap the failed-state return in `AdminLayout`**

Current (lines 259-264):
```tsx
    if (searchState.state === REQUEST_STATE.FAILED) {
        return <ErrorState/>;
    }

    return (
        <AdminLayout>
```

Change to:
```tsx
    if (searchState.state === REQUEST_STATE.FAILED) {
        return (
            <AdminLayout>
                <ErrorState/>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
```

- [ ] **Step 2: Verify in the browser**

Force the search request to fail (block it in devtools' network panel, or temporarily point `useHttpGet` at a nonexistent method). Confirm the error message shows with the sidebar and header still present and navigable — not a bare full-screen error with no way back into the admin section. Revert the temporary change afterward.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): render manage-job-board's error state inside AdminLayout, keep sidebar/header on fetch failure"
```

---

### Task 11: Fix "Clear all filters" navigation

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:6,55-61,205-216`

**Interfaces:**
- Consumes: Task 9's already-`status`-free `clearFilters` (this task only touches its final `router.push` line).
- Produces: the `pathname` variable this task introduces is reused by Task 13's search-submit handler.

- [ ] **Step 1: Import and call `usePathname`**

Current (line 6):
```tsx
import {useRouter, useSearchParams} from "next/navigation";
```

Change to:
```tsx
import {useRouter, useSearchParams, usePathname} from "next/navigation";
```

Current (lines 55-61):
```tsx
const AdminJobBoard = () => {
    const {t} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();

    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? decodeURIComponent(encoded).trim() : "";
```

Change to:
```tsx
const AdminJobBoard = () => {
    const {t} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? decodeURIComponent(encoded).trim() : "";
```

- [ ] **Step 2: Fix `clearFilters`'s navigation**

Current, reflecting Task 9's already-landed removal of `status` (lines 205-216):
```tsx
    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
        });
        router.push(`/admin/job-board`, {scroll: false});
    }, [router]);
```

`/admin/job-board` isn't this page's route (the real route is `/admin/manage-job-board`, since the file lives at `src/app/[lang]/admin/manage-job-board/page.tsx`) — clicking "Clear all filters" 404s. Fix it by clearing the URL's search params on the *current* pathname instead of hardcoding a route string that can go stale again:

```tsx
    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
        });
        router.push(pathname, {scroll: false});
    }, [router, pathname]);
```

- [ ] **Step 3: Verify in the browser**

Apply a filter (e.g. select a Job Type) so the empty-state "Clear all filters" link can appear (search for something with no results, or pick a filter combination that returns zero posts), click it, and confirm it lands back on `/admin/manage-job-board` with filters reset — not a 404 or a wrong route.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): 'Clear all filters' no longer navigates to a nonexistent route"
```

---

### Task 12: Add `pageBack` wiring

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:72-74,85-97,168-181,242-253`

**Interfaces:**
- Consumes: Task 9's already-`status`-free `useHttpGet` params object and cursor-reset `useEffect` dependency array — this task's "before" snippets for both reflect that removal, not the original file.
- Produces: nothing later tasks depend on.

Every other cursor-paginated admin list page (`manage-users`, `manage-riders` via `usePaginatedRiders`, `topup-coins`, `bank-accounts`, `withdraw-coins`) tracks an `isGoingBack` boolean and sends it as `pageBack` on the fetch — this page never has. The `Search` request type supports `pageBack?: boolean`.

- [ ] **Step 1: Add the `isGoingBack` state**

Current (lines 72-74):
```tsx
    const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
```

Change to:
```tsx
    const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
```

- [ ] **Step 2: Send `pageBack` in the fetch**

Current, reflecting Task 9's already-landed removal of the `hidden:` comment (lines 85-97):
```tsx
    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
        execute: refreshJobs,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: filters.category,
        pageCursor: currentCursor,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        jobType: filters.jobType,
        intendedUse: filters.intendedUse,
        limit: ITEMS_PER_PAGE,
    });
```

Change to:
```tsx
    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
        execute: refreshJobs,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: filters.category,
        pageCursor: currentCursor,
        pageBack: isGoingBack,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        jobType: filters.jobType,
        intendedUse: filters.intendedUse,
        limit: ITEMS_PER_PAGE,
    });
```

- [ ] **Step 3: Set the flag on next/previous navigation**

Current (lines 168-181):
```tsx
    const handleNextPage = useCallback(() => {
        if (jobPostsPagination?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(jobPostsPagination.nextPage);
        }
    }, [jobPostsPagination?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
        }
    }, [cursorHistory]);
```

Change to:
```tsx
    const handleNextPage = useCallback(() => {
        if (jobPostsPagination?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(jobPostsPagination.nextPage);
            setIsGoingBack(false);
        }
    }, [jobPostsPagination?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    }, [cursorHistory]);
```

- [ ] **Step 4: Reset the flag whenever filters change**

Current, reflecting Task 9's already-landed removal of `filters.status` from the dependency array (lines 242-253):
```tsx
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
    }, [
        filters.category,
        filters.sort,
        filters.budgetMin,
        filters.budgetMax,
        filters.jobType,
        filters.intendedUse,
    ]);
```

Change to:
```tsx
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
        setIsGoingBack(false);
    }, [
        filters.category,
        filters.sort,
        filters.budgetMin,
        filters.budgetMax,
        filters.jobType,
        filters.intendedUse,
    ]);
```

(This effect already runs on every filter change, including via `clearFilters` — no separate reset needed in `handleFilterChange`/`clearFilters` themselves.)

- [ ] **Step 5: Verify in the browser**

Load the page, click Next a couple of times, then click Previous. Use the browser's network tab to inspect the `search` request payload/params on each click — confirm `pageBack` is `false` on Next and `true` on Previous, and that the returned page of results is correct going backward (not skipping or repeating).

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx"
git commit -m "fix(admin): wire pageBack on manage-job-board pagination, matching every sibling admin list page"
```

---

### Task 13: Add a search input

**Files:**
- Modify: `src/app/[lang]/admin/manage-job-board/page.tsx:63,285-300`
- Modify: `src/translations/en.ts`
- Modify: `src/translations/th.ts`
- Modify: `src/translations/vi.ts`

**Interfaces:**
- Consumes: `pathname` (from Task 11), `searchParams`/`router` (already in scope).
- Produces: nothing later tasks depend on.

`q` already flows through `sanitizedQuery` (derived from `searchParams.get("q")` at the top of the component) into the fetch call and the empty-state copy — there's just never been an `<input>` anywhere to set it.

- [ ] **Step 1: Add the two new translation keys**

In `src/translations/en.ts`, find `jobBoardManagement: "Job Board Management", jobBoardSubtitle: "Manage all job posts, visibility, and content",` (inside the `admin: { ... }` object) and add two sibling keys right after `jobBoardSubtitle`:

```ts
            jobBoardManagement: "Job Board Management",
            jobBoardSubtitle: "Manage all job posts, visibility, and content",
            jobBoardSearchPlaceholder: "Search job posts…",
            jobBoardSearchButton: "Search",
```

In `src/translations/th.ts`, the same insertion point (Thai copy):
```ts
            jobBoardSearchPlaceholder: "ค้นหาโพสต์งาน…",
            jobBoardSearchButton: "ค้นหา",
```

In `src/translations/vi.ts`, the same insertion point (Vietnamese copy):
```ts
            jobBoardSearchPlaceholder: "Tìm kiếm bài đăng việc làm…",
            jobBoardSearchButton: "Tìm kiếm",
```

- [ ] **Step 2: Add local state and a submit handler**

Current (line 63, right after `sanitizedQuery` is derived):
```tsx
    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? decodeURIComponent(encoded).trim() : "";
```

Change to:
```tsx
    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? decodeURIComponent(encoded).trim() : "";

    const [searchInput, setSearchInput] = useState(sanitizedQuery);

    const handleSearchSubmit = useCallback(() => {
        const params = new URLSearchParams(searchParams);
        const trimmed = searchInput.trim();
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        router.push(`${pathname}?${params.toString()}`, {scroll: false});
    }, [searchInput, searchParams, router, pathname]);
```

- [ ] **Step 3: Add the input to the filter bar**

Current (lines 286-289, the very start of the filter grid — inserting a new first item before the Category select):
```tsx
                        {/* Filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                            {/* Category */}
                            <select
```

Change to:
```tsx
                        {/* Filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                            {/* Search */}
                            <div className="flex gap-2 sm:col-span-2">
                                <input
                                    type="search"
                                    placeholder={t("admin.jobBoardSearchPlaceholder")}
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSearchSubmit();
                                    }}
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                />
                                <button
                                    onClick={handleSearchSubmit}
                                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                                >
                                    {t("admin.jobBoardSearchButton")}
                                </button>
                            </div>

                            {/* Category */}
                            <select
```

- [ ] **Step 4: Verify in the browser**

Type a job title (or part of one) into the new search box and press Enter — confirm the URL gains a `q=` param and the list filters to matching results. Clear the box and press Enter again — confirm the `q` param is removed and the full list returns. Click the Search button instead of pressing Enter — confirm it behaves identically.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-job-board/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): add a search input to manage-job-board, wiring the already-present q param"
```

---

## After all tasks: whole-branch check

Once all 13 tasks are committed, before opening a PR:

- [ ] Run `pnpm lint` (ESLint) and `pnpm build` (which also runs Next's TypeScript check) and fix anything the new code introduces.
- [ ] Run `pnpm test:unit` and confirm it's still 157/157 (or more, if any new tests exist by then) passing — this plan doesn't add unit tests (no seam for these two files, per Global Constraints), so the count shouldn't drop, only possibly still match.
- [ ] Do one full manual pass on both pages — every item in the spec's "Testing" section — not just the per-task checks done in isolation, since some interactions (e.g. pagination + a new filter, or the search box + Clear-all-filters) only show up when used together.
- [ ] Confirm `git status` is clean relative to the branch (no stray uncommitted files, no dirtied `tsconfig.tsbuildinfo`) before pushing.
