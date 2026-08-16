# Admin Picture + Users + Riders Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Critical/Important bugs the admin audit found on `manage-picture`, `manage-users`, and `manage-riders` — a settings page with several real gaps, and two moderation-list pages whose divergence from each other turns out to hide real bugs, not just visual inconsistency.

**Architecture:** Three page-groups, fixed as three task sequences in one plan (Tasks 1-5 for `manage-picture`, Tasks 6-11 for `manage-users`, Tasks 12-14 for `manage-riders`). No shared files between groups, only within-group ordering dependencies noted per task.

**Tech Stack:** Next.js App Router, `react-i18next`, the app's generic `useHttpGet`/`useHttpPost`/`useHttpDelete` SWR-backed hooks, `sonner` toasts, `lucide-react` icons — no new dependencies.

## Global Constraints

- No new npm dependencies.
- Every new user-facing string goes through `t()` with real English, Thai, and Vietnamese copy — no English-only additions, no machine-garbage translations. New keys for `manage-picture` live under `admin.picture.*`, matching the existing `admin.<page>.*` nested-namespace convention.
- No component-test infrastructure exists for any file touched here (confirmed: no `*.test.tsx` alongside any of the six files, no `@testing-library/react` in this project). Verify manually in the browser preview, consistent with both prior merged admin batches (PR #37, #38).
- Touch only the files named in this plan. Everything the spec's "Out of scope" section lists (manage-picture's remaining visual divergences, full focus-trap, manage-riders' remaining cross-page differences, every other admin page) stays untouched.
- Follow existing code conventions exactly: double-quoted strings, 4-space indent.

---

## Part A: `manage-picture`

### Task 1: Fix upload labels not opening the file picker

**Files:**
- Modify: `src/app/[lang]/admin/manage-picture/page.tsx:159-168,220-228`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Associate the logo label with its input**

Current (lines 159-168):
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Logo</label>
                                    <div className="space-y-4">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={(e) => handleFileChange("icon", e)}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
```

Change to:
```tsx
                                <div>
                                    <label htmlFor="logo-upload" className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Logo</label>
                                    <div className="space-y-4">
                                        <input
                                            id="logo-upload"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={(e) => handleFileChange("icon", e)}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
```

- [ ] **Step 2: Associate the banner label with its input**

Current (lines 220-228):
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Banner</label>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(e) => handleFileChange("banner", e)}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                    />
```

Change to:
```tsx
                                <div>
                                    <label htmlFor="banner-upload" className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Banner</label>
                                    <input
                                        id="banner-upload"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(e) => handleFileChange("banner", e)}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                    />
```

- [ ] **Step 3: Verify in the browser**

Reload `/en/admin/manage-picture`. Click directly on the "Upload New Logo" label text (not the file-picker control below it) — confirm the OS file picker opens. Do the same for "Upload New Banner".

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-picture/page.tsx"
git commit -m "fix(admin): associate manage-picture's upload labels with their file inputs"
```

---

### Task 2: Fix the SVG-support copy mismatch

**Files:**
- Modify: `src/app/[lang]/admin/manage-picture/page.tsx:138-139`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

SVG is deliberately blocked (both by extension blocklist and MIME allowlist) for security — arbitrary SVG can carry embedded scripts. Fix the copy, not the validation.

- [ ] **Step 1: Drop "SVG" from the logo heading**

Current (lines 138-139):
```tsx
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Site Logo (Recommended: 512×512px,
                                PNG/SVG)</h2>
```

Change to:
```tsx
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Site Logo (Recommended: 512×512px,
                                PNG)</h2>
```

- [ ] **Step 2: Verify in the browser**

Confirm the logo section's heading now reads "Site Logo (Recommended: 512×512px, PNG)" — no mention of SVG anywhere on the page (the banner heading already correctly says "JPG/PNG", untouched).

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-picture/page.tsx"
git commit -m "fix(admin): manage-picture no longer advertises SVG support it blocks"
```

---

### Task 3: Distinguish an unsaved preview from the live saved image

**Files:**
- Modify: `src/app/[lang]/admin/manage-picture/page.tsx:142-156,193-217`

**Interfaces:**
- Consumes: `iconPreviewOverride`/`bannerPreviewOverride` state (already exists).
- Produces: nothing later tasks depend on.

`iconPreview`/`bannerPreview` silently prefer a locally-picked-but-not-yet-uploaded file over the live saved image, under an unconditional "Current Logo"/"Current Banner" label. Add a visual distinction driven directly by whether the override state is set.

- [ ] **Step 1: Fix the logo preview box**

Current (lines 142-156):
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Current Logo</label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex items-center justify-center">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt="Current site logo"
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">No logo set</p>
                                        )}
                                    </div>
                                </div>
```

Change to:
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {iconPreviewOverride ? "Preview" : "Current Logo"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt="Current site logo"
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">No logo set</p>
                                        )}
                                        {iconPreviewOverride && (
                                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                Preview — not saved yet
                                            </span>
                                        )}
                                    </div>
                                </div>
```

- [ ] **Step 2: Fix the banner preview box**

Current (lines 193-217):
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Current
                                        Banner</label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt="Current hero banner"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">Welcome to your marketplace</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">No banner set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
```

Change to:
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {bannerPreviewOverride ? "Preview" : "Current Banner"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt="Current hero banner"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">Welcome to your marketplace</p>
                                                </div>
                                                {bannerPreviewOverride && (
                                                    <span className="absolute top-3 right-3 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        Preview — not saved yet
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">No banner set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
```

- [ ] **Step 3: Verify in the browser**

Pick a new logo file (don't click Upload yet) — confirm the label switches to "Preview" and an amber "Preview — not saved yet" badge appears. Reload the page (discarding the unsaved pick) — confirm it goes back to "Current Logo" with no badge. Repeat for banner.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-picture/page.tsx"
git commit -m "fix(admin): visually distinguish an unsaved logo/banner preview from the live saved image"
```

---

### Task 4: Add a "Remove" action

**Files:**
- Modify: `src/app/[lang]/admin/manage-picture/page.tsx:1-32,142-156` (post-Task-3 state), `193-217` (post-Task-3 state)

**Interfaces:**
- Consumes: Task 3's already-applied preview-box changes — this task's "before" for the two preview boxes reflects that state, not the original file.
- Produces: nothing later tasks depend on.

The backend already has `deleteSiteIcon`/`deleteSiteBanner` endpoints — this is a missing-UI gap, not a missing-backend one.

- [ ] **Step 1: Import `useHttpDelete` and instantiate the two delete hooks**

Current (line 5, part of the import block):
```tsx
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
```

Change to:
```tsx
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
```

Current (lines 18-19):
```tsx
    const {execute: uploadIcon, isMutating: uploadingIcon} = useHttpPost("uploadSiteIcon");
    const {execute: uploadBanner, isMutating: uploadingBanner} = useHttpPost("uploadSiteBanner");
```

Change to:
```tsx
    const {execute: uploadIcon, isMutating: uploadingIcon} = useHttpPost("uploadSiteIcon");
    const {execute: uploadBanner, isMutating: uploadingBanner} = useHttpPost("uploadSiteBanner");
    const {execute: removeIcon, isMutating: removingIcon} = useHttpDelete("deleteSiteIcon");
    const {execute: removeBanner, isMutating: removingBanner} = useHttpDelete("deleteSiteBanner");
```

- [ ] **Step 2: Add the `handleRemove` function**

Add this new function right after `handleUpload`'s closing brace (after line 119 in the original file, i.e. right after `handleUpload`'s definition, before the `return (`):

```tsx
    const handleRemove = async (type: "icon" | "banner") => {
        const execute = type === "icon" ? removeIcon : removeBanner;
        const res = await execute();

        if (isSuccess(res)) {
            toast.success(`${type === "icon" ? "Logo" : "Banner"} removed`);
            const refreshed = await callHttp("getSite");
            if (isSuccess(refreshed)) {
                setSiteRes(refreshed.data);
            }
        } else if (isFailed(res)) {
            toast.error(`Failed to remove ${type === "icon" ? "logo" : "banner"}`);
        }
    };
```

- [ ] **Step 3: Add the "Remove Logo" button**

Current, reflecting Task 3's already-applied change:
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {iconPreviewOverride ? "Preview" : "Current Logo"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt="Current site logo"
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">No logo set</p>
                                        )}
                                        {iconPreviewOverride && (
                                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                Preview — not saved yet
                                            </span>
                                        )}
                                    </div>
                                </div>
```

Change to (adding the Remove button after the closing `</div>` of the preview box, still inside the outer `<div>`):
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {iconPreviewOverride ? "Preview" : "Current Logo"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt="Current site logo"
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">No logo set</p>
                                        )}
                                        {iconPreviewOverride && (
                                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                Preview — not saved yet
                                            </span>
                                        )}
                                    </div>
                                    {siteRes?.siteView?.localSite?.icon && (
                                        <button
                                            onClick={() => handleRemove("icon")}
                                            disabled={removingIcon}
                                            className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            {removingIcon ? "Removing..." : "Remove Logo"}
                                        </button>
                                    )}
                                </div>
```

- [ ] **Step 4: Add the "Remove Banner" button**

Current, reflecting Task 3's already-applied change:
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {bannerPreviewOverride ? "Preview" : "Current Banner"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt="Current hero banner"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">Welcome to your marketplace</p>
                                                </div>
                                                {bannerPreviewOverride && (
                                                    <span className="absolute top-3 right-3 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        Preview — not saved yet
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">No banner set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
```

Change to:
```tsx
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {bannerPreviewOverride ? "Preview" : "Current Banner"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt="Current hero banner"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">Welcome to your marketplace</p>
                                                </div>
                                                {bannerPreviewOverride && (
                                                    <span className="absolute top-3 right-3 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        Preview — not saved yet
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">No banner set</p>
                                            </div>
                                        )}
                                    </div>
                                    {siteRes?.siteView?.localSite?.banner && (
                                        <button
                                            onClick={() => handleRemove("banner")}
                                            disabled={removingBanner}
                                            className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            {removingBanner ? "Removing..." : "Remove Banner"}
                                        </button>
                                    )}
                                </div>
```

- [ ] **Step 5: Verify in the browser**

With a live logo already set, confirm a "Remove Logo" link appears below the preview box; click it, confirm a success toast and the box switches to "No logo set" with the link now gone (since there's no live image to remove anymore). Repeat for banner.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/manage-picture/page.tsx"
git commit -m "fix(admin): add Remove actions for the site logo/banner, wiring the existing delete endpoints"
```

---

### Task 5: Add i18n to `manage-picture`, fix the sidebar naming mismatch

**Files:**
- Modify: `src/app/[lang]/admin/manage-picture/page.tsx` (full file, after Tasks 1-4)
- Modify: `src/translations/en.ts`
- Modify: `src/translations/th.ts`
- Modify: `src/translations/vi.ts`

**Interfaces:**
- Consumes: the full render structure and toasts from Tasks 1-4 (all landed by the time this task runs).
- Produces: the `admin.picture.*` translation namespace, not consumed by any other task in this plan.

This is the only one of 9 admin pages with zero i18n. While touching the sidebar's translations for this page anyway: the sidebar calls it "Manage Picture" but the page's own heading says "Site Appearance" — fix the sidebar label to match.

- [ ] **Step 1: Add the translation keys**

In `src/translations/en.ts`, find the `admin: { layout: { ... }, category: { ... }, withdraw: { ... } }` structure (from the two prior merged batches) and add a new `picture` key as a sibling of `category`, before `withdraw`:

```ts
            picture: {
                title: "Site Appearance",
                subtitle: "Update your site's logo and hero banner. These will appear on the homepage and across the platform.",
                logoHeading: "Site Logo (Recommended: 512×512px, PNG)",
                bannerHeading: "Hero Banner (Recommended: 1920×1080px or larger, JPG/PNG)",
                currentLogo: "Current Logo",
                currentBanner: "Current Banner",
                previewLabel: "Preview",
                previewBadge: "Preview — not saved yet",
                noLogoSet: "No logo set",
                noBannerSet: "No banner set",
                logoAlt: "Current site logo",
                bannerAlt: "Current hero banner",
                welcomeSubtitle: "Welcome to your marketplace",
                uploadNewLogo: "Upload New Logo",
                uploadNewBanner: "Upload New Banner",
                uploadingLogo: "Uploading...",
                uploadingBanner: "Uploading Banner...",
                removeLogo: "Remove Logo",
                removeBanner: "Remove Banner",
                removing: "Removing...",
                footerNote: "Changes take effect immediately across the site.",
                blockedFileType: "This file type is not allowed for security reasons.",
                invalidFileType: "Only PNG, JPG, WebP, and GIF files are allowed.",
                fileTooLarge: "Image must be under 10MB",
                selectLogoFirst: "Please select a logo first",
                selectBannerFirst: "Please select a banner first",
                logoUpdated: "Logo updated successfully!",
                bannerUpdated: "Banner updated successfully!",
                logoUploadFailed: "Failed to upload logo",
                bannerUploadFailed: "Failed to upload banner",
                logoRemoved: "Logo removed",
                bannerRemoved: "Banner removed",
                logoRemoveFailed: "Failed to remove logo",
                bannerRemoveFailed: "Failed to remove banner",
            },
```

In `src/translations/th.ts`, the same insertion (Thai copy):
```ts
            picture: {
                title: "รูปลักษณ์เว็บไซต์",
                subtitle: "อัปเดตโลโก้และแบนเนอร์หลักของเว็บไซต์ ซึ่งจะแสดงบนหน้าแรกและทั่วทั้งแพลตฟอร์ม",
                logoHeading: "โลโก้เว็บไซต์ (แนะนำ: 512×512px, PNG)",
                bannerHeading: "แบนเนอร์หลัก (แนะนำ: 1920×1080px ขึ้นไป, JPG/PNG)",
                currentLogo: "โลโก้ปัจจุบัน",
                currentBanner: "แบนเนอร์ปัจจุบัน",
                previewLabel: "ตัวอย่าง",
                previewBadge: "ตัวอย่าง — ยังไม่ได้บันทึก",
                noLogoSet: "ยังไม่ได้ตั้งค่าโลโก้",
                noBannerSet: "ยังไม่ได้ตั้งค่าแบนเนอร์",
                logoAlt: "โลโก้เว็บไซต์ปัจจุบัน",
                bannerAlt: "แบนเนอร์หลักปัจจุบัน",
                welcomeSubtitle: "ยินดีต้อนรับสู่มาร์เก็ตเพลสของคุณ",
                uploadNewLogo: "อัปโหลดโลโก้ใหม่",
                uploadNewBanner: "อัปโหลดแบนเนอร์ใหม่",
                uploadingLogo: "กำลังอัปโหลด...",
                uploadingBanner: "กำลังอัปโหลดแบนเนอร์...",
                removeLogo: "ลบโลโก้",
                removeBanner: "ลบแบนเนอร์",
                removing: "กำลังลบ...",
                footerNote: "การเปลี่ยนแปลงจะมีผลทันทีทั่วทั้งเว็บไซต์",
                blockedFileType: "ไม่อนุญาตให้ใช้ไฟล์ประเภทนี้ด้วยเหตุผลด้านความปลอดภัย",
                invalidFileType: "อนุญาตเฉพาะไฟล์ PNG, JPG, WebP และ GIF เท่านั้น",
                fileTooLarge: "รูปภาพต้องมีขนาดไม่เกิน 10MB",
                selectLogoFirst: "กรุณาเลือกโลโก้ก่อน",
                selectBannerFirst: "กรุณาเลือกแบนเนอร์ก่อน",
                logoUpdated: "อัปเดตโลโก้สำเร็จแล้ว!",
                bannerUpdated: "อัปเดตแบนเนอร์สำเร็จแล้ว!",
                logoUploadFailed: "อัปโหลดโลโก้ไม่สำเร็จ",
                bannerUploadFailed: "อัปโหลดแบนเนอร์ไม่สำเร็จ",
                logoRemoved: "ลบโลโก้แล้ว",
                bannerRemoved: "ลบแบนเนอร์แล้ว",
                logoRemoveFailed: "ลบโลโก้ไม่สำเร็จ",
                bannerRemoveFailed: "ลบแบนเนอร์ไม่สำเร็จ",
            },
```

In `src/translations/vi.ts`, the same insertion (Vietnamese copy):
```ts
            picture: {
                title: "Giao diện trang web",
                subtitle: "Cập nhật logo và banner chính của trang web. Chúng sẽ hiển thị trên trang chủ và trên toàn nền tảng.",
                logoHeading: "Logo trang web (Khuyến nghị: 512×512px, PNG)",
                bannerHeading: "Banner chính (Khuyến nghị: 1920×1080px trở lên, JPG/PNG)",
                currentLogo: "Logo hiện tại",
                currentBanner: "Banner hiện tại",
                previewLabel: "Xem trước",
                previewBadge: "Xem trước — chưa được lưu",
                noLogoSet: "Chưa thiết lập logo",
                noBannerSet: "Chưa thiết lập banner",
                logoAlt: "Logo trang web hiện tại",
                bannerAlt: "Banner chính hiện tại",
                welcomeSubtitle: "Chào mừng đến với chợ của bạn",
                uploadNewLogo: "Tải lên logo mới",
                uploadNewBanner: "Tải lên banner mới",
                uploadingLogo: "Đang tải lên...",
                uploadingBanner: "Đang tải banner lên...",
                removeLogo: "Xóa logo",
                removeBanner: "Xóa banner",
                removing: "Đang xóa...",
                footerNote: "Các thay đổi có hiệu lực ngay lập tức trên toàn trang web.",
                blockedFileType: "Loại tệp này không được phép vì lý do bảo mật.",
                invalidFileType: "Chỉ cho phép tệp PNG, JPG, WebP và GIF.",
                fileTooLarge: "Hình ảnh phải nhỏ hơn 10MB",
                selectLogoFirst: "Vui lòng chọn logo trước",
                selectBannerFirst: "Vui lòng chọn banner trước",
                logoUpdated: "Đã cập nhật logo thành công!",
                bannerUpdated: "Đã cập nhật banner thành công!",
                logoUploadFailed: "Tải logo lên không thành công",
                bannerUploadFailed: "Tải banner lên không thành công",
                logoRemoved: "Đã xóa logo",
                bannerRemoved: "Đã xóa banner",
                logoRemoveFailed: "Xóa logo không thành công",
                bannerRemoveFailed: "Xóa banner không thành công",
            },
```

- [ ] **Step 2: Fix the sidebar's nav label for this page**

In `src/translations/en.ts`, find:
```ts
                        managePicture: {title: "Manage Picture", description: "Manage picture for 108jobs"},
```
Change to:
```ts
                        managePicture: {title: "Site Appearance", description: "Manage picture for 108jobs"},
```

In `src/translations/th.ts`, find:
```ts
                        managePicture: {title: "จัดการรูปภาพ", description: "จัดการรูปภาพสำหรับ 108jobs"},
```
Change to:
```ts
                        managePicture: {title: "รูปลักษณ์เว็บไซต์", description: "จัดการรูปภาพสำหรับ 108jobs"},
```

In `src/translations/vi.ts`, find:
```ts
                        managePicture: {title: "Quản lý hình ảnh", description: "Quản lý hình ảnh cho 108jobs"},
```
Change to:
```ts
                        managePicture: {title: "Giao diện trang web", description: "Quản lý hình ảnh cho 108jobs"},
```

(Only each `title` value changes — `description` stays exactly as it is in all three files.)

- [ ] **Step 3: Wire `page.tsx`**

Add the import:
```tsx
import {useTranslation} from "react-i18next";
```

Add the hook as the first line of the component body:
```tsx
export default function SiteAppearancePage() {
    const {t} = useTranslation();
    // Site data is already seeded here by UserServiceProvider from the SSR
```

Then replace every plain-English literal with its `t()` call, one-for-one (each of these strings is unique in the file at this point, after Tasks 1-4 — locate and replace each):

| Current literal | Replace with |
|---|---|
| `toast.error("This file type is not allowed for security reasons.");` | `toast.error(t("admin.picture.blockedFileType"));` |
| `toast.error("Only PNG, JPG, WebP, and GIF files are allowed.");` | `toast.error(t("admin.picture.invalidFileType"));` |
| `toast.error("Image must be under 10MB");` | `toast.error(t("admin.picture.fileTooLarge"));` |
| `` toast.error(`Please select a ${type === "icon" ? "logo" : "banner"} first`); `` | `` toast.error(type === "icon" ? t("admin.picture.selectLogoFirst") : t("admin.picture.selectBannerFirst")); `` |
| `` toast.success(`${type === "icon" ? "Logo" : "Banner"} updated successfully!`); `` | `` toast.success(type === "icon" ? t("admin.picture.logoUpdated") : t("admin.picture.bannerUpdated")); `` |
| `` toast.error(`Failed to upload ${type === "icon" ? "logo" : "banner"}`); `` | `` toast.error(type === "icon" ? t("admin.picture.logoUploadFailed") : t("admin.picture.bannerUploadFailed")); `` |
| `` toast.success(`${type === "icon" ? "Logo" : "Banner"} removed`); `` | `` toast.success(type === "icon" ? t("admin.picture.logoRemoved") : t("admin.picture.bannerRemoved")); `` |
| `` toast.error(`Failed to remove ${type === "icon" ? "logo" : "banner"}`); `` | `` toast.error(type === "icon" ? t("admin.picture.logoRemoveFailed") : t("admin.picture.bannerRemoveFailed")); `` |
| `<h1 className="text-3xl font-bold text-gray-900">Site Appearance</h1>` | `<h1 className="text-3xl font-bold text-gray-900">{t("admin.picture.title")}</h1>` |
| `Update your site&apos;s logo and hero banner. These will appear on the homepage and across the platform.` (the `<p>` subtitle) | `{t("admin.picture.subtitle")}` (replace the entire text content of that `<p>`) |
| `Site Logo (Recommended: 512×512px, PNG)` (the logo `<h2>`) | `{t("admin.picture.logoHeading")}` |
| `Hero Banner (Recommended: 1920×1080px or larger, JPG/PNG)` (the banner `<h2>`) | `{t("admin.picture.bannerHeading")}` |
| `{iconPreviewOverride ? "Preview" : "Current Logo"}` | `{iconPreviewOverride ? t("admin.picture.previewLabel") : t("admin.picture.currentLogo")}` |
| `{bannerPreviewOverride ? "Preview" : "Current Banner"}` | `{bannerPreviewOverride ? t("admin.picture.previewLabel") : t("admin.picture.currentBanner")}` |
| `alt="Current site logo"` | `alt={t("admin.picture.logoAlt")}` |
| `alt="Current hero banner"` | `alt={t("admin.picture.bannerAlt")}` |
| `<p className="text-gray-500">No logo set</p>` (both occurrences — appears once in the logo section) | `<p className="text-gray-500">{t("admin.picture.noLogoSet")}</p>` |
| `<p className="text-gray-500">No banner set</p>` | `<p className="text-gray-500">{t("admin.picture.noBannerSet")}</p>` |
| `Preview — not saved yet` (both occurrences — logo badge and banner badge) | `{t("admin.picture.previewBadge")}` |
| `<p className="text-lg opacity-90">Welcome to your marketplace</p>` | `<p className="text-lg opacity-90">{t("admin.picture.welcomeSubtitle")}</p>` |
| `Upload New Logo` (the label text, from Task 1) | `{t("admin.picture.uploadNewLogo")}` |
| `Upload New Banner` (the label text, from Task 1) | `{t("admin.picture.uploadNewBanner")}` |
| `{uploadingIcon ? "Uploading..." : "Upload New Logo"}` (the button text) | `{uploadingIcon ? t("admin.picture.uploadingLogo") : t("admin.picture.uploadNewLogo")}` |
| `{uploadingBanner ? "Uploading Banner..." : "Upload New Banner"}` (the button text) | `{uploadingBanner ? t("admin.picture.uploadingBanner") : t("admin.picture.uploadNewBanner")}` |
| `{removingIcon ? "Removing..." : "Remove Logo"}` | `{removingIcon ? t("admin.picture.removing") : t("admin.picture.removeLogo")}` |
| `{removingBanner ? "Removing..." : "Remove Banner"}` | `{removingBanner ? t("admin.picture.removing") : t("admin.picture.removeBanner")}` |
| `<p className="text-sm text-gray-500 text-center">Changes take effect immediately across the site.</p>` | `<p className="text-sm text-gray-500 text-center">{t("admin.picture.footerNote")}</p>` |

(The two `<label>` text nodes are each a two-line JSX text node, e.g. `Upload New\n                                        Logo` — replace the whole text content with the single `{t(...)}` expression; the label's `htmlFor`/`className` attributes are untouched.)

- [ ] **Step 4: Verify in the browser**

Reload in English — every string should read identically to before this task. Switch to `/th/admin/manage-picture` — confirm the page title, both section headings, both preview labels, both upload buttons, the remove buttons, and the footer note are all Thai. Switch to `/vi/` — confirm Vietnamese. Check the sidebar nav — confirm it now says "Site Appearance" (matching the page heading) in all three locales, not "Manage Picture"/its translations.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-picture/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): add i18n to manage-picture, fix sidebar label to match the page's own heading"
```

---

## Part B: `manage-users`

### Task 6: Fix broken `{reason}`/`{name}` interpolation

**Files:**
- Modify: `src/translations/en.ts`
- Modify: `src/translations/th.ts`
- Modify: `src/translations/vi.ts`

**Interfaces:**
- Consumes: nothing new — the call sites (`manage-users/page.tsx:95,114`) already pass `{reason: banReason}`/`{name: person.name}` correctly; only the translation strings need the brace fix.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Fix `successWithReason` in all three locales**

In `src/translations/en.ts`, find:
```ts
                successWithReason: "User has been banned – {reason}",
```
Change to:
```ts
                successWithReason: "User has been banned – {{reason}}",
```

In `src/translations/th.ts`, find:
```ts
                successWithReason: "แบนผู้ใช้แล้ว – {reason}",
```
Change to:
```ts
                successWithReason: "แบนผู้ใช้แล้ว – {{reason}}",
```

In `src/translations/vi.ts`, find:
```ts
                successWithReason: "Đã cấm người dùng – {reason}",
```
Change to:
```ts
                successWithReason: "Đã cấm người dùng – {{reason}}",
```

- [ ] **Step 2: Fix `unbannedSuccess` in Thai and Vietnamese**

Both currently have the same single-brace bug, and both are also mistranslated as "banned" instead of "unbanned" — fix both issues together.

In `src/translations/th.ts`, find:
```ts
                unbannedSuccess: "แบน {name} แล้ว",
```
Change to:
```ts
                unbannedSuccess: "ปลดแบน {{name}} แล้ว",
```

In `src/translations/vi.ts`, find:
```ts
                unbannedSuccess: "Đã cấm {name}",
```
Change to:
```ts
                unbannedSuccess: "Đã bỏ cấm {{name}}",
```

(`en.ts`'s `unbannedSuccess: "Unbanned"` has no placeholder at all and isn't touched by this task — it's out of this batch's approved scope.)

- [ ] **Step 3: Verify in the browser**

Ban a user with a reason typed in — confirm the success toast shows the reason text substituted in (not the literal word "reason" in braces), in English. Switch to `/th/` and `/vi/`, repeat the ban-with-reason flow, confirm the reason substitutes correctly in both. Unban a user in Thai and Vietnamese — confirm the toast now correctly says "unbanned" (not "banned") with the person's name substituted in.

- [ ] **Step 4: Commit**

```bash
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): manage-users ban/unban toasts use double-brace i18next interpolation, fix vi/th unban mistranslation"
```

---

### Task 7: Fix fetch failure being indistinguishable from "no users"

**Files:**
- Modify: `src/app/[lang]/admin/manage-users/page.tsx:1-3,30,167-171`
- Modify: `src/translations/en.ts`
- Modify: `src/translations/th.ts`
- Modify: `src/translations/vi.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the `showLoading`/`isFetchFailed` local variables this task introduces are also used by Task 8 (pagination feedback) — Task 8's "before" state reflects this task's already-landed changes.

`useHttpGet`'s `error` field can never become truthy on a real API failure (the hook's fetcher catches internally and always resolves) — this is the identical root cause the prior batch already found and fixed in `manage-category`. Fix it the same correct way: derive the failure from `state`, not `error`, matching how `manage-riders` (via `usePaginatedRiders`) already does it correctly.

- [ ] **Step 1: Add the translation key**

In `src/translations/en.ts`, find the `manageUsers: { ... }` object (it has keys like `title`, `description`, `noUsersFound`) and add a new sibling key:
```ts
                noUsersFound: "No users found",
```
becomes:
```ts
                noUsersFound: "No users found",
                fetchError: "Something went wrong loading users",
```

In `src/translations/th.ts`, the same insertion point (Thai copy):
```ts
                fetchError: "เกิดข้อผิดพลาดขณะโหลดผู้ใช้",
```

In `src/translations/vi.ts`, the same insertion point (Vietnamese copy):
```ts
                fetchError: "Đã xảy ra lỗi khi tải người dùng",
```

- [ ] **Step 2: Import `isFailed` and destructure `isMutating`/`state`**

Current (line 1-3):
```tsx
"use client";
import {useState, useCallback} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
```

Change to:
```tsx
"use client";
import {useState, useCallback} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {isFailed} from "@/services/HttpService";
```

Current (line 30):
```tsx
    const {data, isLoading, execute: refetch} = useHttpGet("listUsers", {
```

Change to:
```tsx
    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("listUsers", {
```

Right after the `useHttpGet` call's closing (after the existing `pageBack: isGoingBack,\n    });` block), add two new derived values:
```tsx
    const showLoading = isLoading || isMutating;
    const isFetchFailed = isFailed(state);
```

- [ ] **Step 3: Add the error branch**

Current (lines 162-171, this is the top of the loading/empty/list ternary — the list-rendering branch further down is untouched by this task):
```tsx
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <div
                                className="w-8 h-8 border-2 border-t-transparent border-foreground/30 rounded-full animate-spin"></div>
                        </div>
                    ) : users.length === 0 ? (
                        <Card className="border-dashed p-12 text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">{t("manageUsers.noUsersFound")}</p>
                        </Card>
                    ) : (
```

Change to:
```tsx
                <div className="space-y-3">
                    {showLoading ? (
                        <div className="flex justify-center py-16">
                            <div
                                className="w-8 h-8 border-2 border-t-transparent border-foreground/30 rounded-full animate-spin"></div>
                        </div>
                    ) : isFetchFailed ? (
                        <Card className="border-dashed p-12 text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">{t("manageUsers.fetchError")}</p>
                        </Card>
                    ) : users.length === 0 ? (
                        <Card className="border-dashed p-12 text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">{t("manageUsers.noUsersFound")}</p>
                        </Card>
                    ) : (
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` and confirm no new errors (only the 3 pre-existing, unrelated ones in `src/modules/chat/EnsureSharedKeyBootstrap` should remain). In the browser, force the `listUsers` fetch to fail (block it in devtools' network panel, or temporarily point `useHttpGet` at a nonexistent method), confirm the distinct error message appears — not the "No users found" empty state — then revert the temporary change. Switch locale and confirm the error copy translates.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-users/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): manage-users fetch-failure state is distinct from empty, keyed off state not the never-truthy error field"
```

---

### Task 8: Fix pagination giving zero feedback after the first load

**Files:**
- Modify: `src/app/[lang]/admin/manage-users/page.tsx:258-264` (post-Task-7 state)

**Interfaces:**
- Consumes: Task 7's `showLoading` variable.
- Produces: nothing later tasks depend on.

`PaginationControls`'s `isLoading` prop was passed the raw `isLoading` (pre-first-data only, never fires again once `keepPreviousData` has real data). Task 7 already introduced `showLoading` (`isLoading || isMutating`) for the list spinner — reuse it here too.

- [ ] **Step 1: Pass `showLoading` to `PaginationControls`**

Current, reflecting Task 7's already-landed changes (lines 258-264):
```tsx
                {/* Pagination */}
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
                {/* Pagination */}
                <PaginationControls
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    onPrevious={handlePrevPage}
                    onNext={handleNextPage}
                    isLoading={showLoading}
                />
```

- [ ] **Step 2: Verify in the browser**

Load the user list, then click Next. Confirm `PaginationControls` visibly shows a loading state (spinner/disabled buttons, whatever `PaginationControls` renders for `isLoading`) during the revalidation — not silently doing nothing until the new page appears, as it did before.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-users/page.tsx"
git commit -m "fix(admin): manage-users pagination shows loading feedback on Next/Previous, not just first load"
```

---

### Task 9: Remove the fake "X Handle" link

**Files:**
- Modify: `src/modules/admin/components/Modal/BanConfirmationModal/index.tsx:6-18,101-117`
- Modify: `src/app/[lang]/admin/manage-users/page.tsx:280-284`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`person.displayName` (a short display name) is repurposed into a fake `x.com/<handle>` link — `Person` has no social-handle field at all. Remove this block entirely rather than showing something untrue.

- [ ] **Step 1: Remove `handle` from the props type**

Current (lines 6-18):
```tsx
interface BanConfirmationModalProps {
    isOpen: boolean;
    user: {
        id: number;
        name: string;
        handle?: string;
    };
    reason: string;
    onReasonChange: (reason: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}
```

Change to:
```tsx
interface BanConfirmationModalProps {
    isOpen: boolean;
    user: {
        id: number;
        name: string;
    };
    reason: string;
    onReasonChange: (reason: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}
```

- [ ] **Step 2: Remove the X Handle block**

Current (lines 101-117):
```tsx
                        {user.handle && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">X Handle</span>
                                <a
                                    href={`https://x.com/${user.handle.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    {user.handle}
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            d="M11.173 12.747l4.364-4.364a1.5 1.5 0 10-2.121-2.121l-4.364 4.364a1.5 1.5 0 000 2.121l4.364 4.364a1.5 1.5 0 102.121-2.121L11.173 12.747z"/>
                                    </svg>
                                </a>
                            </div>
                        )}


```

Delete this block entirely (including the two trailing blank lines right after it, before the "Time" row's `<div>`).

- [ ] **Step 3: Stop passing `handle` from `manage-users/page.tsx`**

Current (lines 280-284):
```tsx
                    user={{
                        id: banTarget?.id ?? 0,
                        name: banTarget?.name ?? "",
                        handle: banTarget?.displayName ?? "",
                    }}
```

Change to:
```tsx
                    user={{
                        id: banTarget?.id ?? 0,
                        name: banTarget?.name ?? "",
                    }}
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` — confirm no new errors. Open the ban confirmation modal for any user in the browser — confirm the red info box now shows only "User" and "Time" rows, no "X Handle" row.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/components/Modal/BanConfirmationModal/index.tsx "src/app/[lang]/admin/manage-users/page.tsx"
git commit -m "fix(admin): remove the fake X Handle link from the ban confirmation modal -- no real handle field exists"
```

---

### Task 10: Fix the Ban button's contrast at rest

**Files:**
- Modify: `src/app/[lang]/admin/manage-users/page.tsx:241`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`bg-red-500` (resting) is ~3.76:1 against white text, failing WCAG AA (4.5:1); `hover:bg-red-700` and the modal's own confirm button's `bg-red-600` both already pass.

- [ ] **Step 1: Change the resting background**

Current (line 241, part of the Ban button's className):
```tsx
                                        className="py-2 px-4 rounded-lg font-medium bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
```

Change to:
```tsx
                                        className="py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
```

- [ ] **Step 2: Verify in the browser**

Look at a non-banned user's Ban button at rest (not hovering) — confirm the red is visibly darker/more legible than before, matching the ban confirmation modal's own confirm button.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/manage-users/page.tsx"
git commit -m "fix(admin): manage-users Ban button passes WCAG AA contrast at rest, not just on hover"
```

---

### Task 11: Add dialog semantics to both modals

**Files:**
- Modify: `src/modules/admin/components/Modal/BanConfirmationModal/index.tsx:1-2,30-58` (post-Task-9 state)
- Modify: `src/modules/admin/components/Modal/UserDetailModal/index.tsx:1-23`

**Interfaces:**
- Consumes: `BanConfirmationModal`'s state/props post-Task-9 (this task's "before" for that file reflects Task 9's already-landed `handle` removal).
- Produces: nothing later tasks depend on.

Add `role="dialog"` + `aria-modal="true"`, an `Escape`-key handler, and (for `UserDetailModal` specifically, which currently has no backdrop click-to-close at all) a backdrop `onClick`. This is a lightweight fix — no focus-trap library, no cycling-Tab management — matching the pattern already used for the category-page lightbox fix in a prior batch.

- [ ] **Step 1: Add the Escape handler to `BanConfirmationModal`**

Current (line 1-2):
```tsx
"use client";
import {useState, useEffect} from "react";
```

This import is already correct (`useEffect` already imported) — no change needed here.

Current, the existing live-clock effect (lines 34-56), immediately followed by `if (!isOpen) return null;` and the return statement:
```tsx
    useEffect(() => {
        if (!isOpen) return;

        const updateTime = () => {
            const now = new Date();
            const formatted = now.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZoneName: "short",
                timeZone: "Asia/Ho_Chi_Minh", // VN time
            });
            setCurrentTime(formatted);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;
```

Change to (adding a new, separate effect for the Escape key right after the clock effect):
```tsx
    useEffect(() => {
        if (!isOpen) return;

        const updateTime = () => {
            const now = new Date();
            const formatted = now.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZoneName: "short",
                timeZone: "Asia/Ho_Chi_Minh", // VN time
            });
            setCurrentTime(formatted);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;
```

- [ ] **Step 2: Add `role`/`aria-modal` to `BanConfirmationModal`'s panel**

Current (lines 65-68, immediately reflecting Task 9's removal — this exact hunk is untouched by Task 9, shown here for insertion-point context):
```tsx
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6 transform transition-all animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
```

Change to:
```tsx
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6 transform transition-all animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
```

- [ ] **Step 3: Add `useEffect`, `role`/`aria-modal`, Escape handler, and backdrop-click to `UserDetailModal`**

Current (lines 1-23, the full top of the file):
```tsx
import {User, Mail, Calendar, FileText, X} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {LocalUserView} from "108jobs-client";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LocalUserView;
}

export function UserDetailModal({isOpen, onClose, user}: UserDetailModalProps) {
    if (!isOpen) return null;

    const {person, localUser, banned} = user;

    const getTypeLabel = () => "User";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
```

Change to:
```tsx
import {useEffect} from "react";
import {User, Mail, Calendar, FileText, X} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {LocalUserView} from "108jobs-client";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LocalUserView;
}

export function UserDetailModal({isOpen, onClose, user}: UserDetailModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const {person, localUser, banned} = user;

    const getTypeLabel = () => "User";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
```

(The `useEffect` call is placed before the `if (!isOpen) return null;` early return specifically because React hooks must run unconditionally on every render — the effect itself still no-ops via its own internal `if (!isOpen) return;` guard, matching the exact structure `BanConfirmationModal`'s own clock effect already uses.)

- [ ] **Step 4: Verify in the browser**

Open the ban confirmation modal — press Escape, confirm it closes. Reopen it, click the backdrop (outside the white panel) — confirm it still closes (unchanged behavior). Open the user detail modal — press Escape, confirm it now closes (previously impossible). Click its backdrop — confirm it now closes too (previously only the X button worked).

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/components/Modal/BanConfirmationModal/index.tsx src/modules/admin/components/Modal/UserDetailModal/index.tsx
git commit -m "fix(admin): add role=dialog, Escape-to-close, and backdrop-click-to-close to both manage-users modals"
```

---

## Part C: `manage-riders`

### Task 12: Add the Reject button and reason UI

**Files:**
- Modify: `src/app/[lang]/admin/manage-riders/page.tsx:11,25-30,45-55,233-249`

**Interfaces:**
- Consumes: nothing new. `AdminVerifyRiderRequest` (confirmed) already accepts an optional `reason?: string | null` alongside `approve: boolean`. `admin.riders.actionReject` and `admin.riders.rejectionReasonPlaceholder` translation keys already exist in all three locales — no new translation keys needed for this task.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add local state for which rider's reject-reason box is open**

Current (line 11, and lines 25-30 — the component's opening state declarations):
```tsx
import {JSX, useState} from "react";
```
(already imports `useState` — no import change needed here)

Current (lines 28-30):
```tsx
    const [viewMode, setViewMode] = useState<ViewMode>("unverified");
```

Change to:
```tsx
    const [viewMode, setViewMode] = useState<ViewMode>("unverified");
    const [rejectingRiderId, setRejectingRiderId] = useState<RiderId | null>(null);
    const [rejectReason, setRejectReason] = useState("");
```

- [ ] **Step 2: Thread `reason` through `handleVerify`**

Current (lines 45-55):
```tsx
    const handleVerify = async (riderId: RiderId, approve: boolean) => {
        try {
            await verifyRider({riderId, approve});
            toast.success(
                approve ? t("admin.riders.actionApproved") : t("admin.riders.actionRejected")
            );
            await refetch();
        } catch (err) {
            toast.error(t("common.errorOccurred") || "An error occurred");
        }
    };
```

Change to:
```tsx
    const handleVerify = async (riderId: RiderId, approve: boolean, reason?: string) => {
        try {
            await verifyRider({riderId, approve, reason: reason || undefined});
            toast.success(
                approve ? t("admin.riders.actionApproved") : t("admin.riders.actionRejected")
            );
            if (!approve) {
                setRejectingRiderId(null);
                setRejectReason("");
            }
            await refetch();
        } catch (err) {
            toast.error(t("common.errorOccurred") || "An error occurred");
        }
    };
```

- [ ] **Step 3: Add the Reject button and inline reason UI**

Current (lines 233-249):
```tsx
                                {isUnverified && (
                                    <div
                                        className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <Button
                                            className="flex-1 h-11 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => handleVerify(rider.id, true)}
                                            disabled={verifying}
                                        >
                                            {verifying ? (
                                                <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                                            ) : (
                                                <CheckCircle className="w-5 h-5 mr-2"/>
                                            )}
                                            {t("admin.riders.actionApprove")}
                                        </Button>
                                    </div>
                                )}
```

Change to:
```tsx
                                {isUnverified && (
                                    <div
                                        className="flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        {rejectingRiderId === rider.id ? (
                                            <div className="space-y-3">
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                    placeholder={t("admin.riders.rejectionReasonPlaceholder")}
                                                    className="w-full min-h-20 p-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    rows={2}
                                                />
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <Button
                                                        className="flex-1 h-11 text-base bg-red-600 hover:bg-red-700 text-white"
                                                        onClick={() => handleVerify(rider.id, false, rejectReason)}
                                                        disabled={verifying}
                                                    >
                                                        {verifying && (
                                                            <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                                                        )}
                                                        {t("admin.riders.actionReject")}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-11 text-base"
                                                        onClick={() => setRejectingRiderId(null)}
                                                        disabled={verifying}
                                                    >
                                                        {t("common.cancel") || "Cancel"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    className="flex-1 h-11 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={() => handleVerify(rider.id, true)}
                                                    disabled={verifying}
                                                >
                                                    {verifying ? (
                                                        <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                                                    ) : (
                                                        <CheckCircle className="w-5 h-5 mr-2"/>
                                                    )}
                                                    {t("admin.riders.actionApprove")}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 h-11 text-base border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                                    onClick={() => setRejectingRiderId(rider.id)}
                                                    disabled={verifying}
                                                >
                                                    {t("admin.riders.actionReject")}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
```

- [ ] **Step 4: Verify in the browser**

On an unverified rider, click Reject — confirm a reason textarea appears with Confirm/Cancel buttons in place of Approve/Reject. Type a reason and confirm — the rider should leave the unverified list and a "Rider rejected" toast should appear. On a different rider, click Reject then Cancel — confirm it reverts to Approve/Reject with no network call made. Try rejecting with the reason left blank — confirm it still works (reason is optional).

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/admin/manage-riders/page.tsx"
git commit -m "fix(admin): add the Reject button and optional reason input to manage-riders (backend already supported it)"
```

---

### Task 13: Fix Bicycle and Motorcycle sharing the same icon

**Files:**
- Modify: `src/app/[lang]/admin/manage-riders/page.tsx:6,17-21`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`lucide-react` has a distinct `Motorbike` icon — already imported and used elsewhere in this codebase (`AdminSidebar`'s own "Manage Riders" nav icon).

- [ ] **Step 1: Import `Motorbike`**

Current (line 6):
```tsx
import {CheckCircle, Loader2, UserCheck, UserX, Bike, Car, Star} from "lucide-react";
```

Change to:
```tsx
import {CheckCircle, Loader2, UserCheck, UserX, Bike, Motorbike, Car, Star} from "lucide-react";
```

- [ ] **Step 2: Use it for Motorcycle**

Current (lines 17-21):
```tsx
const vehicleIconMap: Record<VehicleType, JSX.Element> = {
    Bicycle: <Bike className="w-4 h-4"/>,
    Motorcycle: <Bike className="w-4 h-4"/>,
    Car: <Car className="w-4 h-4"/>,
};
```

Change to:
```tsx
const vehicleIconMap: Record<VehicleType, JSX.Element> = {
    Bicycle: <Bike className="w-4 h-4"/>,
    Motorcycle: <Motorbike className="w-4 h-4"/>,
    Car: <Car className="w-4 h-4"/>,
};
```

- [ ] **Step 3: Verify in the browser**

Find (or filter to) a rider with vehicle type Motorcycle and one with Bicycle — confirm they now show visually distinct icons.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-riders/page.tsx"
git commit -m "fix(admin): Bicycle and Motorcycle riders show distinct vehicle icons"
```

---

### Task 14: Show the real rider photo instead of a generic icon

**Files:**
- Modify: `src/app/[lang]/admin/manage-riders/page.tsx:1-16,161-166` (post-Task-13 state)

**Interfaces:**
- Consumes: Task 13's already-landed `Motorbike` import — this task's "before" for the import block reflects that.
- Produces: nothing later tasks depend on.

`RiderView` embeds the same `Person` type (with `avatar?: DbUrl`) that `manage-users` already renders correctly via `<AvatarImage src={person.avatar}/>`. Swap the static icon for the real photo when available, keeping the icon as a fallback.

- [ ] **Step 1: Import `next/image`**

Current (line 1-3, reflecting Task 13's already-landed icon import change):
```tsx
"use client";

import {Button} from "@/components/ui/Button";
```

Change to:
```tsx
"use client";

import Image from "next/image";
import {Button} from "@/components/ui/Button";
```

- [ ] **Step 2: Swap the icon box for the avatar when a photo exists**

Current (lines 161-166):
```tsx
                                                    <div
                                                        className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex-shrink-0">
                                                        <UserCheck
                                                            className={cn("w-7 h-7", isUnverified ? "text-amber-600" : "text-emerald-600")}
                                                        />
                                                    </div>
```

Change to:
```tsx
                                                    <div
                                                        className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                        {person.avatar ? (
                                                            <Image
                                                                src={person.avatar}
                                                                alt={person.name || person.displayName || t("common.unknown")}
                                                                width={28}
                                                                height={28}
                                                                className="w-7 h-7 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <UserCheck
                                                                className={cn("w-7 h-7", isUnverified ? "text-amber-600" : "text-emerald-600")}
                                                            />
                                                        )}
                                                    </div>
```

- [ ] **Step 3: Verify in the browser**

Find a rider whose person record has an avatar set — confirm their real photo now shows in the card (not the generic checkmark icon). Find one without an avatar — confirm it still shows the icon fallback, unchanged from before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/admin/manage-riders/page.tsx"
git commit -m "fix(admin): manage-riders shows the rider's real photo when available, matching manage-users"
```

---

## After all tasks: whole-branch check

Once all 14 tasks are committed, before opening a PR:

- [ ] Run `pnpm lint` (ESLint) and `pnpm build` (which also runs Next's TypeScript check) and fix anything the new code introduces.
- [ ] Run `pnpm test:unit` and confirm it's still 157/157 (or more, if any new tests exist by then) passing.
- [ ] Do one full manual pass on all three pages — every item in the spec's "Testing" section — not just the per-task checks done in isolation.
- [ ] Confirm `git status` is clean relative to the branch (no stray uncommitted files, no dirtied `tsconfig.tsbuildinfo`) before pushing.
