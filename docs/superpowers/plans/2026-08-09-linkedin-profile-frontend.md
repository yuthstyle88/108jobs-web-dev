# LinkedIn-Style Profile Page (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/profile/[username]` as a single-column, LinkedIn-style stacked-card layout, and replace the Portfolio image gallery with a single-file Resume upload/download feature.

**Architecture:** New focused components (`ProfileHero`, `AboutCard`, `SkillsCard`, `ContactCard`, `ResumeCard`, `EditButton`) replace `ProfileHeader` + `ProfileSidebar`; `WorkSamplesSlider`/`Reviews` are restyled in place to match the new card rhythm. A new `useResumeForm` hook + `ResumeUpload` component (account-setting) replace `usePortfolioImagesForm` + `PortfolioImages`. The upload path (`useFileUpload`/`uploadToMad`) gains a `kind` parameter so the resume flow can send `kind: "file"` instead of the hardcoded `"image"`.

**Tech Stack:** Next.js (App Router), React, Tailwind, react-i18next, Zustand, vitest.

## Global Constraints

- **This plan depends on the backend plan already being done.** `docs/superpowers/plans/2026-08-09-resume-field-backend.md` (in the sibling `api-108heros` repo) must have completed Task 3 (its type-sync step) before Task 2 of this plan — `Person.resumeUrl`/`resumeFileName` and `SaveUserSettings.resumeUrl`/`resumeFileName` must already exist in `src/lib/108heros-client/src/types/` or this plan's code will not compile. Verify with: `grep -n resumeUrl src/lib/108heros-client/src/types/Person.ts` before starting Task 2.
- No new test framework is introduced. This repo has **no** React component-rendering tests anywhere (no `@testing-library/react` dependency, no `.test.tsx` files) and **no** existing Playwright coverage of the profile or account-setting pages (`tests/` has only `login.spec.ts`, `home.spec.ts`, `protected-redirect.spec.ts`, `job-board.spec.ts`). This plan does not add either — that would be a separate, bigger decision than this feature warrants. Testing here means: (a) extending the one real test file this feature touches (`madUpload.test.ts`, a pure-logic vitest suite with an established pattern), and (b) manual verification in a browser at the end (Task 9), consistent with "for UI changes, use the feature in a browser before calling it done."
- Every new/changed component must compile under `pnpm tsc --noEmit`, pass `pnpm lint`, and the final state must pass `pnpm build` — checked cumulatively in Task 9, and after every task that touches shared files (Task 1's hook signature change, Task 7's rewiring).
- Deletions only happen after verifying zero remaining importers via `grep` — shown explicitly in the steps below, not assumed.
- New/changed user-facing copy is added to all three locales (`en.ts`, `th.ts`, `vi.ts`) in the same task that introduces it — never English-only.
- Follow existing card visual language throughout: `bg-white shadow-lg rounded-2xl p-6` for a standalone profile-page section, `text-primary font-semibold` for section headings, the existing `EditButton` pencil-icon pattern for own-profile edit affordances linking to the relevant `account-setting/*` page.

---

### Task 1: Generalize the upload path for a `kind` parameter

**Files:**
- Modify: `src/services/media/madUpload.ts`
- Modify: `src/modules/chat/hooks/useFileUpload.ts`
- Modify: `src/services/media/madUpload.test.ts`

**Interfaces:**
- Produces: `MediaKind = "image" | "file"` (exported from `madUpload.ts`); `uploadToMad(file, visibility, kind = "image")`; `useFileUpload({ setError, t, visibility?, kind? })` — `kind` defaults to `"image"` so every existing caller (avatar upload, chat attachments) is unaffected. Consumed by Task 2's `useResumeForm`.

- [ ] **Step 1: Write the failing test**

  In `src/services/media/madUpload.test.ts`, add a new test inside the `describe("uploadToMad", ...)` block, right after the existing `"declares length and content type up front"` test:

  ```typescript
  it("sends the given kind instead of the image default", async () => {
    const calls = stubFetch([SESSION, BYTES, COMPLETE]);

    await uploadToMad(file, "private", "file");

    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      kind: "file",
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `pnpm vitest run src/services/media/madUpload.test.ts -t "sends the given kind"`
  Expected: FAIL — `uploadToMad` currently takes only 2 parameters, so this either fails to typecheck or (since it's plain JS at runtime under vitest) the third argument is silently ignored and the assertion fails because the body still has `kind: "image"`.

- [ ] **Step 3: Add `MediaKind` and thread it through `uploadToMad`**

  In `src/services/media/madUpload.ts`, change:

  ```typescript
  export type MediaVisibility = "private" | "public";
  ```

  to:

  ```typescript
  export type MediaVisibility = "private" | "public";

  /**
   * What kind of asset is being uploaded. MAD partitions storage/serving
   * behaviour by this — `"image"` assets may get rendition processing,
   * `"file"` assets are stored and served verbatim (documents, etc.).
   */
  export type MediaKind = "image" | "file";
  ```

  Then change:

  ```typescript
  export async function uploadToMad(
    file: File,
    visibility: MediaVisibility,
  ): Promise<UploadedAsset> {
  ```

  to:

  ```typescript
  export async function uploadToMad(
    file: File,
    visibility: MediaVisibility,
    kind: MediaKind = "image",
  ): Promise<UploadedAsset> {
  ```

  Then change the session-open body:

  ```typescript
      body: JSON.stringify({
        // MAD partitions by kind; everything this app sends is an image.
        kind: "image",
        declaredContentLength: file.size,
        contentType,
        visibility,
      }),
  ```

  to:

  ```typescript
      body: JSON.stringify({
        kind,
        declaredContentLength: file.size,
        contentType,
        visibility,
      }),
  ```

- [ ] **Step 4: Run the test to verify it passes**

  Run: `pnpm vitest run src/services/media/madUpload.test.ts`
  Expected: PASS, all tests in the file (the new one plus every pre-existing one — the default-parameter change must not break the existing assertions that expect `kind: "image"` with only 2 call args).

- [ ] **Step 5: Thread `kind` through `useFileUpload`**

  In `src/modules/chat/hooks/useFileUpload.ts`, change:

  ```typescript
  import { madGatewayUrl, uploadToMad, type MediaVisibility } from '@/services/media/madUpload';
  ```

  to:

  ```typescript
  import { madGatewayUrl, uploadToMad, type MediaKind, type MediaVisibility } from '@/services/media/madUpload';
  ```

  Change the props interface:

  ```typescript
      visibility?: MediaVisibility;
  }
  ```

  to:

  ```typescript
      visibility?: MediaVisibility;
      /**
       * What kind of asset this upload is. Defaults to `'image'`, matching
       * every caller before the resume feature. Only meaningful on the MAD
       * path — the legacy `/account/files` endpoint has no such concept.
       */
      kind?: MediaKind;
  }
  ```

  Change the destructure:

  ```typescript
      const { setError, t, visibility = 'private' } = opts;
  ```

  to:

  ```typescript
      const { setError, t, visibility = 'private', kind = 'image' } = opts;
  ```

  Change the MAD call:

  ```typescript
                  if (madGatewayUrl()) {
                      const asset = await uploadToMad(file, visibility);
  ```

  to:

  ```typescript
                  if (madGatewayUrl()) {
                      const asset = await uploadToMad(file, visibility, kind);
  ```

- [ ] **Step 6: Type-check**

  Run: `pnpm tsc --noEmit`
  Expected: no new errors (existing callers of `useFileUpload` pass no `kind`, which is fine since it's optional with a default).

- [ ] **Step 7: Commit**

  ```bash
  git add src/services/media/madUpload.ts src/services/media/madUpload.test.ts src/modules/chat/hooks/useFileUpload.ts
  git commit -m "feat: generalize upload path to accept a media kind"
  ```

---

### Task 2: `useResumeForm` hook

**Files:**
- Create: `src/hooks/forms/useResumeForm.ts`

**Interfaces:**
- Consumes: `useFileUpload({ setError, t, visibility: 'public', kind: 'file' })` (Task 1); `Person.resumeUrl`/`resumeFileName` and `SaveUserSettings.resumeUrl`/`resumeFileName` (backend plan, already in place per Global Constraints); `useHttpPost('saveUserSettings')`.
- Produces: `useResumeForm({ person, setPerson }) => { fileInputRef, handleSelectFile, handleFileChange, uploadError, isSubmitting }` — consumed by Task 3's `ResumeUpload` component.

Note: there is no "remove resume" here — the approved design (`docs/superpowers/specs/2026-08-09-linkedin-style-profile-page-design.md`) only calls for upload/replace. A remove flow would need the backend to treat an empty string specially (today, `save_user_settings`'s `avatar_url`-style validation would reject `resumeUrl: ""` as an invalid URL via `DbUrl::from_str`, mirroring how `avatar` itself has no working "clear" path today either) — out of scope here.

- [ ] **Step 1: Write the hook**

  Create `src/hooks/forms/useResumeForm.ts`:

  ```typescript
  'use client';

  import {useCallback, useRef, useState} from 'react';
  import {useTranslation} from 'react-i18next';
  import {Person, SaveUserSettings} from '108heros-client';
  import {useFileUpload} from '@/modules/chat/hooks/useFileUpload';
  import {useHttpPost} from '@/hooks/api/http/useHttpPost';
  import {REQUEST_STATE} from '@/services/HttpService';
  import useNotification from '@/hooks/ui/useNotification';

  type FileEvent = React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>;

  export interface UseResumeFormProps {
      person?: Person;
      setPerson: (person: Person | null) => void;
  }

  export const useResumeForm = ({person, setPerson}: UseResumeFormProps) => {
      const {t} = useTranslation();
      const {successMessage} = useNotification();
      const {execute: saveUserSettings, isMutating: isSubmitting} = useHttpPost('saveUserSettings');

      const [uploadError, setUploadError] = useState<string | null>(null);
      const fileInputRef = useRef<HTMLInputElement | null>(null);

      const {handleFileUpload} = useFileUpload({
          setError: setUploadError,
          t,
          visibility: 'public',
          kind: 'file',
      });

      const handleSelectFile = useCallback(() => {
          fileInputRef.current?.click();
      }, []);

      const handleFileChange = useCallback(
          async (e: FileEvent): Promise<void> => {
              const file =
                  (e as React.ChangeEvent<HTMLInputElement>).target?.files?.[0] ||
                  (e as React.DragEvent<HTMLDivElement>).dataTransfer?.files?.[0];
              if (!file || !person) return;

              const uploaded = await handleFileUpload(e as unknown as Event);
              if (!uploaded) {
                  setUploadError(t('profileInfo.resumeUploadFailed') || 'Resume upload failed');
                  return;
              }

              const payload: SaveUserSettings = {
                  displayName: person.displayName ?? '',
                  bio: person.bio ?? '',
                  skills: person.skills ?? '',
                  contacts: person.contacts ?? '',
                  resumeUrl: uploaded.fileUrl,
                  resumeFileName: uploaded.fileName,
              };

              const response = await saveUserSettings(payload);
              if (response.state === REQUEST_STATE.FAILED) {
                  setUploadError(t('error.title') || 'Failed to save resume');
                  return;
              }

              setPerson({...person, resumeUrl: uploaded.fileUrl, resumeFileName: uploaded.fileName});
              successMessage(null, null, t('profileInfo.resumeUpdated') ?? 'Resume updated!');
          },
          [handleFileUpload, person, saveUserSettings, setPerson, successMessage, t],
      );

      return {
          fileInputRef,
          handleSelectFile,
          handleFileChange,
          uploadError,
          isSubmitting,
      };
  };
  ```

- [ ] **Step 2: Type-check**

  Run: `pnpm tsc --noEmit`
  Expected: clean. (This step is the practical verification for this task — there is no test harness in this repo for hooks that call `useHttpPost`/store setters without a full app context; `usePortfolioImagesForm`, the hook this one mirrors, has none either.)

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/forms/useResumeForm.ts
  git commit -m "feat: add useResumeForm hook"
  ```

---

### Task 3: `ResumeUpload` component, route rename, nav update

**Files:**
- Create: `src/components/ResumeUpload/index.tsx`
- Modify (rename): `src/app/[lang]/(profile)/account-setting/portfolio/page.tsx` → `src/app/[lang]/(profile)/account-setting/resume/page.tsx`
- Modify: `src/containers/AccountSettingWrapper/index.tsx`
- Modify: `src/translations/en.ts`, `src/translations/th.ts`, `src/translations/vi.ts`

**Interfaces:**
- Consumes: `useResumeForm` (Task 2).

- [ ] **Step 1: Write `ResumeUpload`**

  Create `src/components/ResumeUpload/index.tsx`:

  ```tsx
  'use client';

  import {useTranslation} from 'react-i18next';
  import {FileText} from 'lucide-react';
  import {useResumeForm} from '@/hooks/forms/useResumeForm';
  import {useUserStore} from '@/store/useUserStore';

  export default function ResumeUpload() {
      const {t} = useTranslation();
      const {person, setPerson} = useUserStore();
      const {
          fileInputRef,
          handleSelectFile,
          handleFileChange,
          uploadError,
          isSubmitting,
      } = useResumeForm({person: person ?? undefined, setPerson});

      return (
          <div className="border border-border-primary rounded-lg bg-white py-6 mb-8">
              <div className="border-b border-border-primary px-6">
                  <h2 className="text-[16px] font-medium mb-2 text-text-primary">
                      {t('profileInfo.sectionResume')}
                  </h2>
                  <p className="text-gray-600 mb-6 text-[14px] font-sans">
                      {t('profileInfo.subtitleResume')}
                  </p>
              </div>

              <div className="px-6">
                  {person?.resumeUrl && (
                      <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <FileText className="w-8 h-8 text-primary shrink-0"/>
                          <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-800">
                                  {person.resumeFileName ?? t('profileInfo.resumeFile')}
                              </p>
                              <a
                                  href={person.resumeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                              >
                                  {t('profileInfo.download') || 'Download'}
                              </a>
                          </div>
                      </div>
                  )}

                  <div className="relative flex items-start space-x-4">
                      <div className="flex-1 max-w-md">
                          <div className="w-full h-12 border border-gray-300 rounded-lg flex items-center justify-between px-4 bg-gray-50">
                              <input
                                  type="file"
                                  ref={fileInputRef}
                                  className="hidden"
                                  accept=".pdf,.doc,.docx"
                                  onChange={handleFileChange}
                                  disabled={isSubmitting}
                              />
                              <span className="text-gray-500 text-sm truncate">
                                  {isSubmitting
                                      ? t('profileInfo.uploading') || 'Uploading...'
                                      : person?.resumeUrl
                                          ? t('profileInfo.replaceResume') || 'Replace resume'
                                          : t('profileInfo.selectResume') || 'Select resume file'}
                              </span>
                              <button
                                  type="button"
                                  onClick={handleSelectFile}
                                  className="flex items-center justify-center bg-primary rounded-full p-2 hover:bg-[#063a68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isSubmitting}
                              >
                                  <svg
                                      className="w-4 h-4 text-white"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                  >
                                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                                  </svg>
                              </button>
                          </div>
                          {uploadError && <p className="text-red-600 text-sm mt-2">{uploadError}</p>}
                      </div>
                  </div>
              </div>
          </div>
      );
  }
  ```

- [ ] **Step 2: Rename the route**

  ```bash
  git mv "src/app/[lang]/(profile)/account-setting/portfolio" "src/app/[lang]/(profile)/account-setting/resume"
  ```

  Then replace the contents of `src/app/[lang]/(profile)/account-setting/resume/page.tsx` (currently importing `PortfolioImages`) with:

  ```tsx
  import ResumeUpload from "@/components/ResumeUpload";

  export default function ResumePage() {
      return <ResumeUpload />;
  }
  ```

- [ ] **Step 3: Update the account-setting nav**

  In `src/containers/AccountSettingWrapper/index.tsx`, change the icon import:

  ```typescript
  import { Briefcase, BriefcaseBusiness, CreditCard, ShieldCheck, SquareUserRound, User } from "lucide-react";
  ```

  to:

  ```typescript
  import { Briefcase, BriefcaseBusiness, CreditCard, FileText, ShieldCheck, User } from "lucide-react";
  ```

  Change the menu item:

  ```typescript
        { href: "/account-setting/portfolio", label: t("profileNavbar.portfolio"), icon: SquareUserRound },
  ```

  to:

  ```typescript
        { href: "/account-setting/resume", label: t("profileNavbar.resume"), icon: FileText },
  ```

- [ ] **Step 4: Update translations**

  In `src/translations/en.ts`, in the `profileNavbar` block, change:

  ```typescript
              portfolio: "Portfolio",
              workSample: "Work Sample",
  ```

  to:

  ```typescript
              resume: "Resume",
              workSample: "Work Sample",
  ```

  In the `profileInfo` block, change:

  ```typescript
              sectionPortfolioImages: "Portfolio Images",
              subtitlePortfolioImages: "Upload images to showcase your work and attract clients.",
              imageTitle: "Image Title",
              selectImage: "Select Image",
              imageSelected: "Image Selected",
              addImage: "Add Image",
              editImage: "Edit Image",
              updateImage: "Update Image",
              cancel: "Cancel",
              imageTitleRequired: "Please enter a title for this image",
              imageTitlePlaceholder: "e.g. \"Website Redesign\", \"Mobile App UI\", \"Brand Logo Design\"",
  ```

  to (note `cancel` is kept — it's shared with `WorkSamples`, confirmed by grep before writing this plan):

  ```typescript
              cancel: "Cancel",
              sectionResume: "Resume",
              subtitleResume: "Upload your resume so clients can review your full background.",
              selectResume: "Select resume file",
              replaceResume: "Replace resume",
              uploading: "Uploading...",
              resumeFile: "Resume file",
              download: "Download",
              resumeUploadFailed: "Failed to upload resume. Please try again.",
              resumeUpdated: "Resume updated",
  ```

  (The rest of the removed keys — `sectionPortfolioImages` through `imageTitlePlaceholder` minus `cancel` — are deleted here; the remaining portfolio-only keys further down this same block — `imageRequired`, `deleteImage`, `errorUploadImage`, `errorDeleteImage`, `preview`, `fullScreenImage`, `uploadFailed`, `updateImage` — are removed in Task 8, once the files that use them are deleted, so this task and Task 8 don't fight over the same lines mid-edit.)

  Repeat the equivalent edits in `src/translations/th.ts`:

  ```typescript
              portfolio: "ผลงาน",
              workSample: "ตัวอย่างงาน",
  ```
  →
  ```typescript
              resume: "เรซูเม่",
              workSample: "ตัวอย่างงาน",
  ```

  ```typescript
              sectionPortfolioImages: "ภาพผลงาน",
              subtitlePortfolioImages: "อัปโหลดภาพเพื่อแสดงผลงานของคุณและดึงดูดลูกค้า",
              imageTitle: "ชื่อภาพ",
              selectImage: "เลือกภาพ",
              imageSelected: "เลือกภาพแล้ว",
              addImage: "เพิ่มภาพ",
              editImage: "แก้ไขภาพ",
              updateImage: "อัปเดตภาพ",
              cancel: "ยกเลิก",
              imageTitleRequired: "กรุณากรอกชื่อภาพ",
              imageTitlePlaceholder: "เช่น \"ออกแบบเว็บใหม่\", \"UI แอปมือถือ\", \"โลโก้แบรนด์\"",
  ```
  →
  ```typescript
              cancel: "ยกเลิก",
              sectionResume: "เรซูเม่",
              subtitleResume: "อัปโหลดเรซูเม่ของคุณเพื่อให้ลูกค้าดูประวัติโดยละเอียด",
              selectResume: "เลือกไฟล์เรซูเม่",
              replaceResume: "เปลี่ยนเรซูเม่",
              uploading: "กำลังอัปโหลด...",
              resumeFile: "ไฟล์เรซูเม่",
              download: "ดาวน์โหลด",
              resumeUploadFailed: "ไม่สามารถอัปโหลดเรซูเม่ได้ กรุณาลองใหม่",
              resumeUpdated: "อัปเดตเรซูเม่แล้ว",
  ```

  And in `src/translations/vi.ts`:

  ```typescript
              portfolio: "Danh mục đầu tư",
              workSample: "Mẫu công việc",
  ```
  →
  ```typescript
              resume: "Sơ yếu lý lịch",
              workSample: "Mẫu công việc",
  ```

  ```typescript
              sectionPortfolioImages: "Hình ảnh danh mục",
              subtitlePortfolioImages: "Tải lên hình ảnh để giới thiệu công việc của bạn và thu hút khách hàng.",
              imageTitle: "Tiêu đề hình ảnh",
              selectImage: "Chọn hình ảnh",
              imageSelected: "Đã chọn hình ảnh",
              addImage: "Thêm hình ảnh",
              editImage: "Chỉnh sửa hình ảnh",
              updateImage: "Cập nhật hình ảnh",
              cancel: "Hủy",
              imageTitleRequired: "Vui lòng nhập tiêu đề cho ảnh này",
              imageTitlePlaceholder: "ví dụ: \"Thiết kế lại website\", \"Giao diện ứng dụng\", \"Logo thương hiệu\"",
  ```
  →
  ```typescript
              cancel: "Hủy",
              sectionResume: "Sơ yếu lý lịch",
              subtitleResume: "Tải lên sơ yếu lý lịch để khách hàng xem toàn bộ hồ sơ của bạn.",
              selectResume: "Chọn tệp sơ yếu lý lịch",
              replaceResume: "Thay thế sơ yếu lý lịch",
              uploading: "Đang tải lên...",
              resumeFile: "Tệp sơ yếu lý lịch",
              download: "Tải xuống",
              resumeUploadFailed: "Không thể tải lên sơ yếu lý lịch. Vui lòng thử lại.",
              resumeUpdated: "Đã cập nhật sơ yếu lý lịch",
  ```

- [ ] **Step 5: Type-check and lint**

  Run: `pnpm tsc --noEmit && pnpm lint`
  Expected: clean.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/ResumeUpload "src/app/[lang]/(profile)/account-setting/resume" "src/app/[lang]/(profile)/account-setting/portfolio" src/containers/AccountSettingWrapper/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
  git commit -m "feat: replace portfolio account-setting page with resume upload"
  ```

---

### Task 4: `EditButton` + `ProfileHero`

**Files:**
- Create: `src/components/Profile/EditButton/index.tsx`
- Create: `src/components/Profile/ProfileHero/index.tsx`
- Modify: `src/components/Common/Button/ChatNoWorkButton/index.tsx`

**Interfaces:**
- Produces: `EditButton({ href, label })` — a shared component consumed by Tasks 5, 6, and this task. `ProfileHero({ profile, isOwnProfile, currentUserId })` — consumed by Task 7.

- [ ] **Step 1: Extract `EditButton`**

  Create `src/components/Profile/EditButton/index.tsx`:

  ```tsx
  import Link from "next/link";
  import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
  import {faEdit} from "@fortawesome/free-solid-svg-icons";
  import React from "react";

  interface EditButtonProps {
      href: string;
      label: string;
  }

  const EditButton: React.FC<EditButtonProps> = ({href, label}) => (
      <Link
          prefetch={false}
          href={href}
          className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label={label}
      >
          <FontAwesomeIcon icon={faEdit} className="text-gray-600"/>
      </Link>
  );

  export default EditButton;
  ```

- [ ] **Step 2: Simplify `ChatNoWorkButton`'s outer layout**

  It moves from a full-width sidebar slot into an inline action row in `ProfileHero`, so it should no longer force its own margin or full width. In `src/components/Common/Button/ChatNoWorkButton/index.tsx`, change:

  ```tsx
      return (
          <div className="mt-6">
              <button
                  onClick={handleChatClick}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  aria-label={`Start a chat with ${profile?.name}`}
              >
                  <MessageCircle className="w-5 h-5"/>
                  <span>{t("profile.startChat") || "Start Chat"}</span>
              </button>
          </div>
      );
  ```

  to:

  ```tsx
      return (
          <button
              onClick={handleChatClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              aria-label={`Start a chat with ${profile?.name}`}
          >
              <MessageCircle className="w-5 h-5"/>
              <span>{t("profile.startChat") || "Start Chat"}</span>
          </button>
      );
  ```

  (Verified this is the component's only call site before making this change — see Task 7, which is the only place `ChatNoWorkButton` is imported today, and remains so after this plan.)

- [ ] **Step 3: Write `ProfileHero`**

  Create `src/components/Profile/ProfileHero/index.tsx`:

  ```tsx
  "use client";
  import React from "react";
  import Image from "next/image";
  import {useTranslation} from "react-i18next";
  import {BadgeCheck} from "lucide-react";
  import {Person, PersonId} from "108heros-client";
  import {AssetIcon} from "@/constants/icons";
  import {ProfileImage} from "@/constants/images";
  import EditButton from "@/components/Profile/EditButton";
  import ChatNoWorkButton from "@/components/Common/Button/ChatNoWorkButton";

  interface ProfileHeroProps {
      profile: Person;
      isOwnProfile: boolean;
      currentUserId?: PersonId;
  }

  const ProfileHero: React.FC<ProfileHeroProps> = ({profile, isOwnProfile, currentUserId}) => {
      const {t} = useTranslation();
      const isVerified = profile.isVerified === "Verified";

      return (
          <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
              <div
                  className="relative h-48 sm:h-64 bg-gradient-to-r from-primary to-indigo-600 bg-cover bg-center"
                  style={profile.banner ? {backgroundImage: `url(${profile.banner})`} : undefined}
              >
                  {!profile.banner && (
                      <div className="absolute inset-0 bg-opacity-50 bg-black flex items-center justify-center">
                          <Image
                              src={AssetIcon.logoIcon}
                              alt="logoIcon"
                              className="opacity-20 object-contain"
                              width={200}
                              height={200}
                          />
                      </div>
                  )}
              </div>
              <div className="px-6 pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-16 sm:-mt-20">
                      <Image
                          src={profile.avatar || ProfileImage.avatar}
                          alt={profile.name}
                          width={160}
                          height={160}
                          className="rounded-full w-32 h-32 sm:w-40 sm:h-40 object-cover border-4 border-white shadow-md bg-white mx-auto sm:mx-0"
                      />
                      <div className="mt-4 sm:mt-0 sm:mb-2 flex justify-center sm:justify-end">
                          {isOwnProfile ? (
                              <EditButton
                                  href="/account-setting/basic-information"
                                  label={t("profile.editProfile") || "Edit profile"}
                              />
                          ) : (
                              <ChatNoWorkButton profile={profile} currentUserId={currentUserId}/>
                          )}
                      </div>
                  </div>
                  <div className="mt-4 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                          <h1 className="text-xl font-semibold text-gray-800">
                              {profile.displayName ?? profile.name}
                          </h1>
                          {isVerified && (
                              <span title={t("profile.verified")} className="text-primary">
                                  <BadgeCheck className="w-5 h-5"/>
                              </span>
                          )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-gray-600">
                          {profile.available && (
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                  {t("profile.availableForWork") || "Open to work"}
                              </span>
                          )}
                          {typeof profile.ratings === "number" && (
                              <span>★ {profile.ratings.toFixed(1)}</span>
                          )}
                          {profile.averageResponseTime && (
                              <span>
                                  {t("profile.averageResponseTime")}: {profile.averageResponseTime}
                              </span>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  export default ProfileHero;
  ```

  Note: `profile.isVerified` is `RiderVerificationStatus` serialized verbatim as `"Pending" | "Verified" | "Rejected"` (confirmed against `crates/db/src/enums.rs` in the backend and the existing comparison `isVerify === "Pending"` in `src/components/JobBoardDetail/index.tsx:49`) — `"Verified"` (capitalized, exact) is correct here, not a boolean or a lowercase string.

- [ ] **Step 4: Add new translation keys**

  In `src/translations/en.ts`, `profile` block, add (anywhere in the block; e.g. right after `verified`/`notVerified`):

  ```typescript
              editProfile: "Edit profile",
              availableForWork: "Open to work",
  ```

  In `src/translations/th.ts`, `profile` block:

  ```typescript
              editProfile: "แก้ไขโปรไฟล์",
              availableForWork: "พร้อมรับงาน",
  ```

  In `src/translations/vi.ts`, `profile` block:

  ```typescript
              editProfile: "Chỉnh sửa hồ sơ",
              availableForWork: "Sẵn sàng nhận việc",
  ```

- [ ] **Step 5: Type-check**

  Run: `pnpm tsc --noEmit`
  Expected: clean. (`ProfileHero` isn't wired into any page yet — Task 7 does that — so this just confirms the component and its dependencies compile in isolation.)

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Profile/EditButton src/components/Profile/ProfileHero src/components/Common/Button/ChatNoWorkButton/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
  git commit -m "feat: add ProfileHero and shared EditButton"
  ```

---

### Task 5: `AboutCard`, `SkillsCard`, `ContactCard`

**Files:**
- Create: `src/components/Profile/AboutCard/index.tsx`
- Create: `src/components/Profile/SkillsCard/index.tsx`
- Create: `src/components/Profile/ContactCard/index.tsx`

**Interfaces:**
- Consumes: `EditButton` (Task 4).
- Produces: `AboutCard({ profile, isOwnProfile })`, `SkillsCard({ profile, isOwnProfile })`, `ContactCard({ profile, isOwnProfile })` — consumed by Task 7.

- [ ] **Step 1: Write `AboutCard`**

  Create `src/components/Profile/AboutCard/index.tsx` (behavior — bio clamp/"see more" — lifted verbatim from `ProfileSidebar`'s `BioSection`, restyled as a standalone card):

  ```tsx
  "use client";
  import React, {useEffect, useRef, useState} from "react";
  import {useTranslation} from "react-i18next";
  import {Person} from "108heros-client";
  import EditButton from "@/components/Profile/EditButton";

  interface AboutCardProps {
      profile: Person;
      isOwnProfile: boolean;
  }

  const AboutCard: React.FC<AboutCardProps> = ({profile, isOwnProfile}) => {
      const {t} = useTranslation();
      const [showFullBio, setShowFullBio] = useState(false);
      const [isClamped, setIsClamped] = useState(false);
      const bioRef = useRef<HTMLParagraphElement>(null);

      useEffect(() => {
          if (bioRef.current) {
              setIsClamped(bioRef.current.scrollHeight > bioRef.current.clientHeight);
          }
      }, [profile?.bio]);

      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-primary font-semibold">{t("profile.bio")}</h3>
                  {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit bio"/>}
              </div>
              <p
                  ref={bioRef}
                  className={`text-gray-600 text-sm leading-relaxed ${showFullBio ? "" : "line-clamp-4"}`}
              >
                  {profile?.bio || t("profile.noBio")}
              </p>
              {isClamped && !showFullBio && (
                  <button
                      onClick={() => setShowFullBio(true)}
                      className="mt-2 text-primary text-sm font-medium hover:underline"
                  >
                      {t("profile.seeMore")}
                  </button>
              )}
          </div>
      );
  };

  export default AboutCard;
  ```

- [ ] **Step 2: Write `SkillsCard`**

  Create `src/components/Profile/SkillsCard/index.tsx` (lifted from `SkillsSection`):

  ```tsx
  "use client";
  import React from "react";
  import {useTranslation} from "react-i18next";
  import {Person} from "108heros-client";
  import EditButton from "@/components/Profile/EditButton";

  interface SkillsCardProps {
      profile: Person;
      isOwnProfile: boolean;
  }

  const SkillsCard: React.FC<SkillsCardProps> = ({profile, isOwnProfile}) => {
      const {t} = useTranslation();

      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-primary font-semibold">{t("profile.coreSkills")}</h3>
                  {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit skills"/>}
              </div>
              <div className="flex flex-wrap gap-2">
                  {profile?.skills ? (
                      profile.skills.split(",").map((skill, index) => (
                          <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
                          >
                              {skill.trim()}
                          </span>
                      ))
                  ) : (
                      <p className="text-gray-600 text-sm">{t("profile.noSkills")}</p>
                  )}
              </div>
          </div>
      );
  };

  export default SkillsCard;
  ```

- [ ] **Step 3: Write `ContactCard`**

  Create `src/components/Profile/ContactCard/index.tsx` (lifted from `ContactInfoSection`):

  ```tsx
  "use client";
  import React from "react";
  import {useTranslation} from "react-i18next";
  import {Person} from "108heros-client";
  import EditButton from "@/components/Profile/EditButton";

  interface ContactCardProps {
      profile: Person;
      isOwnProfile: boolean;
  }

  const ContactCard: React.FC<ContactCardProps> = ({profile, isOwnProfile}) => {
      const {t} = useTranslation();

      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-primary font-semibold">{t("profileInfo.sectionContactInfo")}</h3>
                  {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit contact info"/>}
              </div>
              <div className="flex flex-wrap gap-2">
                  {profile?.contacts ? (
                      profile.contacts.split(",").map((contact, index) => (
                          <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
                          >
                              {contact.trim()}
                          </span>
                      ))
                  ) : (
                      <p className="text-gray-600 text-sm">{t("profile.noContacts")}</p>
                  )}
              </div>
          </div>
      );
  };

  export default ContactCard;
  ```

- [ ] **Step 4: Type-check**

  Run: `pnpm tsc --noEmit`
  Expected: clean.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/Profile/AboutCard src/components/Profile/SkillsCard src/components/Profile/ContactCard
  git commit -m "feat: add AboutCard, SkillsCard, ContactCard"
  ```

---

### Task 6: `ResumeCard`

**Files:**
- Create: `src/components/Profile/ResumeCard/index.tsx`
- Modify: `src/translations/en.ts`, `src/translations/th.ts`, `src/translations/vi.ts`

**Interfaces:**
- Consumes: `EditButton` (Task 4); `Person.resumeUrl`/`resumeFileName` (backend plan).
- Produces: `ResumeCard({ profile, isOwnProfile })` — consumed by Task 7.

- [ ] **Step 1: Write `ResumeCard`**

  Create `src/components/Profile/ResumeCard/index.tsx`:

  ```tsx
  "use client";
  import React from "react";
  import Link from "next/link";
  import {useTranslation} from "react-i18next";
  import {FileText} from "lucide-react";
  import {Person} from "108heros-client";
  import EditButton from "@/components/Profile/EditButton";

  interface ResumeCardProps {
      profile: Person;
      isOwnProfile: boolean;
  }

  const ResumeCard: React.FC<ResumeCardProps> = ({profile, isOwnProfile}) => {
      const {t} = useTranslation();

      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-primary font-semibold">{t("profileInfo.sectionResume")}</h3>
                  {isOwnProfile && (
                      <EditButton
                          href="/account-setting/resume"
                          label={profile.resumeUrl ? "Replace resume" : "Add resume"}
                      />
                  )}
              </div>
              {profile.resumeUrl ? (
                  <Link
                      href={profile.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                  >
                      <FileText className="w-8 h-8 text-primary shrink-0"/>
                      <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">
                              {profile.resumeFileName ?? t("profileInfo.resumeFile")}
                          </p>
                          <span className="text-xs text-primary">{t("profileInfo.download") || "Download"}</span>
                      </div>
                  </Link>
              ) : (
                  <p className="text-gray-600 text-sm">{t("profile.noResume")}</p>
              )}
          </div>
      );
  };

  export default ResumeCard;
  ```

- [ ] **Step 2: Add the `profile.noResume` translation key**

  In `src/translations/en.ts`, `profile` block, add:

  ```typescript
              noResume: "No resume uploaded yet",
  ```

  In `src/translations/th.ts`, `profile` block:

  ```typescript
              noResume: "ยังไม่มีการอัปโหลดเรซูเม่",
  ```

  In `src/translations/vi.ts`, `profile` block:

  ```typescript
              noResume: "Chưa có sơ yếu lý lịch nào được tải lên",
  ```

- [ ] **Step 3: Type-check**

  Run: `pnpm tsc --noEmit`
  Expected: clean.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/Profile/ResumeCard src/translations/en.ts src/translations/th.ts src/translations/vi.ts
  git commit -m "feat: add ResumeCard"
  ```

---

### Task 7: Wire the new layout into `CurrentProfileUser`, restyle `WorkSamplesSlider`/`Reviews`, delete the old display-side Portfolio code

**Files:**
- Modify: `src/app/[lang]/(profile)/profile/components/CurrentProfileUser/index.tsx`
- Modify: `src/components/Profile/WorkSamplesSlider/index.tsx`
- Modify: `src/components/Profile/Reviews/index.tsx`
- Delete: `src/components/Profile/ProfileHeader`
- Delete: `src/components/Profile/ProfileSidebar`
- Delete: `src/components/Profile/PortfolioSlider`
- Delete: `src/components/Common/Modal/ImageModal`

**Interfaces:**
- Consumes: `ProfileHero` (Task 4), `AboutCard`/`SkillsCard`/`ContactCard` (Task 5), `ResumeCard` (Task 6).

- [ ] **Step 1: Rewrite `CurrentProfileUser`**

  Replace the full contents of `src/app/[lang]/(profile)/profile/components/CurrentProfileUser/index.tsx` with:

  ```tsx
  "use client";
  import React from "react";
  import {Person} from "108heros-client";
  import ProfileHero from "@/components/Profile/ProfileHero";
  import AboutCard from "@/components/Profile/AboutCard";
  import SkillsCard from "@/components/Profile/SkillsCard";
  import ContactCard from "@/components/Profile/ContactCard";
  import ResumeCard from "@/components/Profile/ResumeCard";
  import WorkSamplesSlider from "@/components/Profile/WorkSamplesSlider";
  import Reviews from "@/components/Profile/Reviews";
  import NotFound from "@/components/Common/NotFound";
  import {useUserStore} from "@/store/useUserStore";

  interface ProfileProps {
      profile: Person | null;
  }

  const CurrentProfileUser: React.FC<ProfileProps> = ({profile}) => {
      const {person: currentUserProfile} = useUserStore();
      const isOwnProfile = currentUserProfile?.id === profile?.id;

      if (!profile) {
          return <NotFound/>;
      }

      const workSamples = profile.workSamples ?? [];

      return (
          <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                  <ProfileHero profile={profile} isOwnProfile={isOwnProfile} currentUserId={currentUserProfile?.id}/>
                  <AboutCard profile={profile} isOwnProfile={isOwnProfile}/>
                  <SkillsCard profile={profile} isOwnProfile={isOwnProfile}/>
                  <ContactCard profile={profile} isOwnProfile={isOwnProfile}/>
                  <ResumeCard profile={profile} isOwnProfile={isOwnProfile}/>
                  <WorkSamplesSlider workSamples={workSamples} isOwnProfile={isOwnProfile}/>
                  <Reviews profileId={profile.id}/>
              </div>
          </main>
      );
  };

  export default CurrentProfileUser;
  ```

- [ ] **Step 2: Restyle `WorkSamplesSlider`'s wrapper to match the new card rhythm**

  In `src/components/Profile/WorkSamplesSlider/index.tsx`, change:

  ```tsx
      return (
          <div className="mb-8">
              <div className="flex justify-between items-center mb-4 sm:mb-5">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-700">
                      {t('profile.workSamples')}
                  </h2>
                  {isOwnProfile && (
                      <Link
                          prefetch={false}
                          href="/account-setting/work-sample"
                          className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
                          aria-label={workSamples.length > 0 ? t('profile.editWorkSamples') : t('profile.addWorkSamples')}
                      >
                          <FontAwesomeIcon icon={faEdit} className="text-gray-600 w-4 h-4 sm:w-5 sm:h-5"/>
                      </Link>
                  )}
              </div>
              {workSamples.length > 0 ? (
                  <div className="relative bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100">
                      <SlickSlider {...workSampleSettings}>
  ```

  to:

  ```tsx
      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-5">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-700">
                      {t('profile.workSamples')}
                  </h2>
                  {isOwnProfile && (
                      <Link
                          prefetch={false}
                          href="/account-setting/work-sample"
                          className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
                          aria-label={workSamples.length > 0 ? t('profile.editWorkSamples') : t('profile.addWorkSamples')}
                      >
                          <FontAwesomeIcon icon={faEdit} className="text-gray-600 w-4 h-4 sm:w-5 sm:h-5"/>
                      </Link>
                  )}
              </div>
              {workSamples.length > 0 ? (
                  <SlickSlider {...workSampleSettings}>
  ```

  And close out the now-removed wrapping `<div>` — change:

  ```tsx
                  </SlickSlider>
              </div>
          ) : (
  ```

  to:

  ```tsx
                  </SlickSlider>
          ) : (
  ```

- [ ] **Step 3: Restyle `Reviews`'s wrapper**

  In `src/components/Profile/Reviews/index.tsx`, change:

  ```tsx
      return (
          <div className="mt-8">
              <div className="border-b border-gray-200 mb-6">
  ```

  to:

  ```tsx
      return (
          <div className="bg-white shadow-lg rounded-2xl p-6">
              <div className="border-b border-gray-200 mb-6">
  ```

- [ ] **Step 4: Verify no remaining importers, then delete the old display components**

  ```bash
  grep -rln "Profile/ProfileHeader" src --include="*.tsx" --include="*.ts"
  grep -rln "Profile/ProfileSidebar" src --include="*.tsx" --include="*.ts"
  grep -rln "Profile/PortfolioSlider" src --include="*.tsx" --include="*.ts"
  grep -rln "Common/Modal/ImageModal'" src --include="*.tsx"
  grep -rln 'Common/Modal/ImageModal"' src --include="*.tsx"
  ```

  Expected: every command prints nothing (all four were confirmed sole-imported by `CurrentProfileUser`, which no longer imports any of them after Step 1). If any command prints a file, stop and investigate before deleting — something changed since this plan was written.

  Then:

  ```bash
  git rm -r src/components/Profile/ProfileHeader src/components/Profile/ProfileSidebar src/components/Profile/PortfolioSlider src/components/Common/Modal/ImageModal
  ```

- [ ] **Step 5: Remove the now-dead `profile.portfolio*` translation keys**

  In `src/translations/en.ts`, `profile` block, remove these three lines (all confirmed used only by the just-deleted `PortfolioSlider`, and `enlargedPortfolioImage` was already unused before this plan):

  ```typescript
              portfolio: "Portfolio",
  ```
  ```typescript
              enlargedPortfolioImage: "Enlarged portfolio image",
  ```
  ```typescript
              noPortfolio: "No portfolio listed",
  ```

  In `src/translations/th.ts`, `profile` block, remove the equivalent three lines (`portfolio`, `enlargedPortfolioImage`, `noPortfolio`).

  In `src/translations/vi.ts`, `profile` block, remove the equivalent three lines (`portfolio`, `enlargedPortfolioImage`, `noPortfolio`).

- [ ] **Step 6: Type-check, lint, build**

  Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
  Expected: clean. This is the step most likely to surface anything missed — any leftover import of a deleted file fails here immediately.

- [ ] **Step 7: Commit**

  ```bash
  git add -A
  git commit -m "feat: rebuild profile page as a single-column stacked layout"
  ```

---

### Task 8: Delete the old Portfolio account-setting code

**Files:**
- Delete: `src/components/PortfolioImages`
- Delete: `src/components/Common/Modal/PortfolioImageModal`
- Delete: `src/components/Common/Modal/FullScreenImageModal`
- Delete: `src/hooks/forms/usePortfolioImagesForm.ts`
- Modify: `src/translations/en.ts`, `src/translations/th.ts`, `src/translations/vi.ts`

**Interfaces:** none — this task only removes code Task 3 already stopped routing to.

- [ ] **Step 1: Verify no remaining importers**

  ```bash
  grep -rln "components/PortfolioImages" src --include="*.tsx" --include="*.ts"
  grep -rln "Common/Modal/PortfolioImageModal" src --include="*.tsx"
  grep -rln "Common/Modal/FullScreenImageModal" src --include="*.tsx"
  grep -rln "usePortfolioImagesForm" src --include="*.tsx" --include="*.ts"
  ```

  Expected: nothing (Task 3 already repointed the account-setting route to `ResumeUpload`, and these four were confirmed to have no other importers when this plan was written). If anything prints, stop and investigate.

- [ ] **Step 2: Delete**

  ```bash
  git rm -r src/components/PortfolioImages src/components/Common/Modal/PortfolioImageModal src/components/Common/Modal/FullScreenImageModal
  git rm src/hooks/forms/usePortfolioImagesForm.ts
  ```

- [ ] **Step 3: Remove the remaining dead `profileInfo.*` portfolio keys**

  These are the keys Task 3 deliberately left behind because they were still used by the files this task just deleted. In `src/translations/en.ts`, `profileInfo` block, remove:

  ```typescript
              imageRequired: "An image is required",
  ```
  ```typescript
              deleteImage: "Delete Image",
  ```
  ```typescript
              errorUploadImage: "Failed to upload image. Please try again.",
              errorDeleteImage: "Failed to delete image. Please try again.",
  ```
  ```typescript
              preview: "Image preview",
              fullScreenImage: "Full screen image",
              uploadFailed: "File upload failed",
  ```

  Also remove the never-referenced `updateImage: "Update Image",` line if it's still present (it was left in place by Task 3's edit since it wasn't part of the block that got replaced there — confirm with `grep -n "profileInfo.updateImage" src` returning nothing in `.tsx`/`.ts` files before removing; it had zero usages when this plan was written).

  **Do not remove** `imageRequired`'s neighbors that turned out to be shared — none were found shared in this specific list (unlike `cancel`, which Task 3 already correctly kept). Re-run this check before deleting, in case something changed:

  ```bash
  for key in imageRequired deleteImage errorUploadImage errorDeleteImage preview fullScreenImage uploadFailed updateImage; do
    echo "=== profileInfo.$key ==="
    grep -rn "profileInfo\.$key\b" src --include="*.tsx" --include="*.ts" | grep -v "/translations/"
  done
  ```

  Expected: every key prints nothing.

  Apply the equivalent removals in `src/translations/th.ts` and `src/translations/vi.ts` (same key names, same `profileInfo` block, language-appropriate values already in place — just delete the lines).

- [ ] **Step 4: Type-check, lint, build**

  Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
  Expected: clean.

- [ ] **Step 5: Commit**

  ```bash
  git add -A
  git commit -m "chore: remove dead Portfolio account-setting code"
  ```

---

### Task 9: Final validation

**Files:** none (verification only).

- [ ] **Step 1: Full automated gate**

  Run, in order:

  ```bash
  pnpm tsc --noEmit
  pnpm lint
  pnpm vitest run
  pnpm build
  ```

  Expected: all clean.

- [ ] **Step 2: Final dead-code sweep**

  ```bash
  grep -rn "PortfolioSlider\|PortfolioImages\|portfolioPics\|PortfolioImageModal\|FullScreenImageModal\|usePortfolioImagesForm" src --include="*.tsx" --include="*.ts" | grep -v "/lib/108heros-client/"
  ```

  Expected: nothing outside the vendored client library (`portfolioPics` legitimately still exists there — the backend plan deliberately keeps that field; the frontend just no longer reads or writes it from any call site, which this grep confirms).

- [ ] **Step 3: Manual browser verification**

  Start the dev server (`pnpm dev`) and check, for both an own-profile view and a visited-profile view, at both a desktop and a mobile viewport width:

  - `/profile/[your username]`: cover photo (gradient fallback, since no banner upload UI exists to set one), avatar overlapping it, name, verified badge only if actually verified, "Open to work" pill matches the account-setting availability toggle, About/Skills/Contact cards render and their edit pencils link to `account-setting/basic-information`, Resume card shows the empty state or an existing resume, Work Samples and Reviews render below.
  - `/account-setting/resume`: nav item reads "Resume" with a document icon; uploading a `.pdf` shows it immediately on the account-setting page and on the profile page after navigating there; re-uploading replaces it.
  - `/profile/[someone else's username]`: hero shows a "Start Chat" button instead of the edit pencil; no edit pencils appear anywhere; Resume card shows a working download link with no upload affordance.

  This step has no automated substitute in this repo today (see Global Constraints) — it is the actual verification for the visual/layout work this plan exists to do.

## Out of scope

- Any change to `Media-Platform-dev` or `api-108heros` beyond the already-completed backend plan.
- A "remove resume" feature (see Task 2's note).
- Banner upload UI.
- New component-testing or e2e infrastructure.
