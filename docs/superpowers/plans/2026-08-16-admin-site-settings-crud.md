# Admin Site Settings CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the backend's already-existing `PUT /site` endpoint into the
frontend, and build a new `/admin/site-settings` page letting admins edit
the site's identity, registration/access rules, moderation settings,
content defaults, and all 7 rate-limit pairs — while also correcting a
stale frontend type that still claims a fully-removed captcha subsystem
exists.

**Architecture:** Two small client-wiring tasks (new types + method,
removing a stale type) followed by five page-building tasks that
progressively add sections to one new form. The zod schema and submit
handler are established complete in Task 3 (with all 36 fields typed from
the start), so later tasks only add JSX for fields the schema already
knows about — no task after Task 3 touches the schema or submit logic.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS,
react-i18next (en/th/vi), `react-hook-form` + `zod` +
`@hookform/resolvers` (established dependencies, precedent:
`AddBankAccountModal`), `useHttpPut` (established mutation-hook
convention), zustand (`useSiteStore`).

## Global Constraints

- Touch only: `src/lib/108heros-client/src/types/EditSiteRequest.ts` (new),
  `src/lib/108heros-client/src/types/SiteResponse.ts` (new),
  `src/lib/108heros-client/src/http.ts`,
  `src/lib/108heros-client/src/index.ts`,
  `src/lib/108heros-client/src/types/PlatformConfig.ts`,
  `src/app/[lang]/admin/dashboard/page.tsx`,
  `src/app/[lang]/admin/site-settings/page.tsx` (new),
  `src/modules/admin/components/layout/AdminSidebar/index.tsx`,
  `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`.
- No new npm dependencies — `react-hook-form`, `zod`,
  `@hookform/resolvers` are already installed and used elsewhere
  (`AddBankAccountModal`, `PostForm`).
- New translation keys go under `admin.siteSettings.*`, matching the
  existing `admin.<page>.*` convention. Where an existing key already
  covers the exact same concept (`dashboard.siteInfo.registrationMode.*`,
  added by an earlier batch), reuse it instead of duplicating.
- Double-quoted strings, 4-space indentation, matching each file's
  existing style.
- Every field on the form is optional — matching the backend's
  `Option<T>`-everywhere design (an absent field means "leave
  unchanged," not "clear this value").
- `defaultPostListingType` accepts only `"All"` or `"Local"` — confirmed
  by reading the backend's own validation
  (`site_default_post_listing_type_check`); any other `ListingType`
  value is rejected server-side. The select only offers these two.
- No component-test infrastructure exists for any of these files —
  verify manually per each task's own steps.

---

### Task 1: Wire the `updateSite` client method

**Files:**
- Create: `src/lib/108heros-client/src/types/EditSiteRequest.ts`
- Create: `src/lib/108heros-client/src/types/SiteResponse.ts`
- Modify: `src/lib/108heros-client/src/http.ts`
- Modify: `src/lib/108heros-client/src/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EditSiteRequest` (36 optional fields, all consumed by Task 3's
  zod schema), `SiteResponse = {siteView: SiteView}`, and
  `WrappedApi108Heros["updateSite"]` — the method Task 3's submit handler
  calls via `useHttpPut("updateSite")`.

This package is hand-maintained, not auto-generated from the backend in
this repo — new types are authored to match the backend Rust struct
field-for-field (confirmed by reading `EditSiteRequest` directly in
`api-108jobs`), converting `snake_case` → `camelCase` and `Option<T>` →
an optional TS field, matching every existing generated type's own
convention.

- [ ] **Step 1: Create `EditSiteRequest.ts`**

```ts
// This file was hand-authored to match the backend's EditSiteRequest struct.
// Keep in sync with crates/db/src/source/site_view/api.rs in api-108jobs.
import type {ListingType} from "./ListingType";
import type {PostListingMode} from "./PostListingMode";
import type {PostSortType} from "./PostSortType";
import type {ProposalSortType} from "./ProposalSortType";
import type {RegistrationMode} from "./RegistrationMode";

/**
 * Edits a site.
 */
export type EditSiteRequest = {
    name?: string;
    /**
     * A sidebar for the site, in markdown.
     */
    sidebar?: string;
    /**
     * A shorter, one line description of your site.
     */
    description?: string;
    /**
     * Limits category creation to admins only.
     */
    categoryCreationAdminOnly?: boolean;
    /**
     * Whether to require email verification.
     */
    requireEmailVerification?: boolean;
    /**
     * Your application question form. This is in markdown, and can be many questions.
     */
    applicationQuestion?: string;
    /**
     * The default theme. Usually "browser"
     */
    defaultTheme?: string;
    /**
     * The default post listing type. Only "All" or "Local" are accepted.
     */
    defaultPostListingType?: ListingType;
    /**
     * Default value for listing mode, usually "List"
     */
    defaultPostListingMode?: PostListingMode;
    /**
     * The default post sort, usually "Active"
     */
    defaultPostSortType?: PostSortType;
    /**
     * A default time range limit to apply to post sorts, in seconds. 0 means none.
     */
    defaultPostTimeRangeSeconds?: number;
    /**
     * The default proposal sort, usually "Hot"
     */
    defaultProposalSortType?: ProposalSortType;
    /**
     * An optional page of legal information
     */
    legalInformation?: string;
    /**
     * Whether to email admins when receiving a new application.
     */
    applicationEmailAdmins?: boolean;
    /**
     * A regex string of items to filter.
     */
    slurFilterRegex?: string;
    /**
     * The max length of actor names.
     */
    actorNameMaxLength?: number;
    /**
     * The number of messages allowed in a given time frame.
     */
    rateLimitMessageMaxRequests?: number;
    rateLimitMessageIntervalSeconds?: number;
    /**
     * The number of posts allowed in a given time frame.
     */
    rateLimitPostMaxRequests?: number;
    rateLimitPostIntervalSeconds?: number;
    /**
     * The number of registrations allowed in a given time frame.
     */
    rateLimitRegisterMaxRequests?: number;
    rateLimitRegisterIntervalSeconds?: number;
    /**
     * The number of image uploads allowed in a given time frame.
     */
    rateLimitImageMaxRequests?: number;
    rateLimitImageIntervalSeconds?: number;
    /**
     * The number of proposals allowed in a given time frame.
     */
    rateLimitProposalMaxRequests?: number;
    rateLimitProposalIntervalSeconds?: number;
    /**
     * The number of searches allowed in a given time frame.
     */
    rateLimitSearchMaxRequests?: number;
    rateLimitSearchIntervalSeconds?: number;
    /**
     * The number of settings imports or exports allowed in a given time frame.
     */
    rateLimitImportUserSettingsMaxRequests?: number;
    rateLimitImportUserSettingsIntervalSeconds?: number;
    registrationMode?: RegistrationMode;
    /**
     * Whether to email admins for new reports.
     */
    reportsEmailAdmins?: boolean;
    /**
     * If present, self-promotion content is visible by default.
     */
    contentWarning?: string;
    /**
     * Whether or not external auth methods can auto-register users.
     */
    oauthRegistration?: boolean;
    /**
     * Block NSFW/self-promotion content being created.
     */
    disallowSelfPromotionContent?: boolean;
    /**
     * Don't send email notifications to users for new replies, mentions etc.
     */
    disableEmailNotifications?: boolean;
};
```

- [ ] **Step 2: Create `SiteResponse.ts`**

```ts
// This file was hand-authored to match the backend's SiteResponse struct.
// Keep in sync with crates/db/src/source/site_view/api.rs in api-108jobs.
import type {SiteView} from "./SiteView";

/**
 * A response for a site edit.
 */
export type SiteResponse = {
    siteView: SiteView;
};
```

- [ ] **Step 3: Add `updateSite` to `http.ts`**

Current (the `getSite` method — find this exact block; `updateSite` is
added immediately after it):
```tsx
    async getSite(@Inject() options?: RequestOptions) {
        return this.#wrapper<never, GetSiteResponse>(
            HttpType.Get,
            "/site",
            undefined,
            options,
        );
    }
```

Change to (adds the new method right after, `getSite` itself unchanged):
```tsx
    async getSite(@Inject() options?: RequestOptions) {
        return this.#wrapper<never, GetSiteResponse>(
            HttpType.Get,
            "/site",
            undefined,
            options,
        );
    }

    /**
     * Edit a site.
     */
    @Security("bearerAuth")
    @Put("/site")
    @Tags("Admin", "Site")
    async updateSite(
        @Body() form: EditSiteRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<EditSiteRequest, SiteResponse>(
            HttpType.Put,
            "/site",
            form,
            options,
        );
    }
```

Then add the two new type imports to the top of `http.ts`, alongside its
existing `GetSiteResponse` import (find that import line and add both
new ones immediately after it, keeping the existing line unchanged):
```tsx
import type {EditSiteRequest} from "./types/EditSiteRequest";
import type {SiteResponse} from "./types/SiteResponse";
```

- [ ] **Step 4: Export both new types from `index.ts`**

Current (the `GetSiteResponse` export line — find this exact line):
```tsx
export type {GetSiteResponse} from "./types/GetSiteResponse";
```

Change to (adds two new export lines immediately after, existing line
unchanged):
```tsx
export type {GetSiteResponse} from "./types/GetSiteResponse";
export type {EditSiteRequest} from "./types/EditSiteRequest";
export type {SiteResponse} from "./types/SiteResponse";
```

- [ ] **Step 5: Verify**

`npx tsc --noEmit` shows no new errors. `useHttpPut("updateSite")`
type-checks (this is exercised for real starting in Task 3, but confirm
here that `WrappedApi108Heros["updateSite"]`'s inferred parameter/return
types resolve without error by checking the IDE/tsc output on the new
`http.ts` method itself).

- [ ] **Step 6: Commit**

```bash
git add src/lib/108heros-client/src/types/EditSiteRequest.ts src/lib/108heros-client/src/types/SiteResponse.ts src/lib/108heros-client/src/http.ts src/lib/108heros-client/src/index.ts
git commit -m "feat(admin): wire the updateSite client method (backend endpoint already existed, unwired)"
```

---

### Task 2: Fix the stale captcha type

**Files:**
- Modify: `src/lib/108heros-client/src/types/PlatformConfig.ts`
- Modify: `src/app/[lang]/admin/dashboard/page.tsx`
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

The backend removed `captcha_enabled`/`captcha_difficulty` entirely three
weeks ago (confirmed: DB columns dropped, removed from every API
response, commit message notes captcha "will be redesigned and
reintroduced in a future sub-project") — but the frontend's
`PlatformConfig` type still declares both fields as always-present, and
the dashboard still renders a Captcha row reading them.

- [ ] **Step 1: Remove the two fields from `PlatformConfig.ts`**

Current (find these two fields — they sit together, likely near other
boolean/string site-config fields):
```ts
    /**
     * Whether captcha is enabled.
     */
    captchaEnabled: boolean;
    /**
     * The captcha difficulty.
     */
    captchaDifficulty: string;
```

Change to: delete both fields (and their doc comments) entirely. Nothing
replaces them.

- [ ] **Step 2: Remove the Captcha row from the dashboard**

Current (the `AlertTriangle`-icon Captcha row in the site-info bar):
```tsx
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4"/>
                            <span className="font-medium">{t("dashboard.siteInfo.captcha")}:</span>{" "}
                            {localSite?.captchaEnabled
                                ? t("dashboard.siteInfo.enabled", {
                                    difficulty: captchaDifficultyLabels[localSite.captchaDifficulty ?? "easy"] ?? (localSite.captchaDifficulty ?? "easy"),
                                })
                                : t("dashboard.siteInfo.disabled")}
                        </div>
```

Change to: delete this entire `<div>` block. Nothing replaces it — the
site-info bar's remaining rows (Instance, Version, Registration, Email
Verification) close out the `CardContent` normally.

- [ ] **Step 3: Remove the now-dead `captchaDifficultyLabels` lookup**

Current (in the component body, alongside `registrationModeLabels`):
```tsx
    const captchaDifficultyLabels: Record<string, string> = {
        easy: t("dashboard.siteInfo.captchaDifficulty.easy"),
        medium: t("dashboard.siteInfo.captchaDifficulty.medium"),
        hard: t("dashboard.siteInfo.captchaDifficulty.hard"),
    };
```

Change to: delete this block entirely. `registrationModeLabels` (the
adjacent, still-needed lookup) stays untouched.

- [ ] **Step 4: Remove the now-dead translation keys from `en.ts`**

Current (`dashboard.siteInfo`, containing both keys being removed —
`captcha`, `enabled`, `disabled`, and the `captchaDifficulty` object; keep
everything else in this object exactly as-is):
```ts
                captcha: "Captcha",
                required: "Required",
                optional: "Optional",
                enabled: "Enabled ({{difficulty}})",
                disabled: "Disabled",
                unknown: "Unknown",
                registrationMode: {
                    open: "Open",
                    closed: "Closed",
                    requireApplication: "Application Required",
                },
                captchaDifficulty: {
                    easy: "Easy",
                    medium: "Medium",
                    hard: "Hard",
                },
            },
```

Change to (removes `captcha`, `enabled`, `disabled`, and the whole
`captchaDifficulty` object — `required`/`optional`/`unknown`/
`registrationMode` all stay, since `required`/`optional` are still used
by the Email Verification row and `registrationMode` is still needed):
```ts
                required: "Required",
                optional: "Optional",
                unknown: "Unknown",
                registrationMode: {
                    open: "Open",
                    closed: "Closed",
                    requireApplication: "Application Required",
                },
            },
```

- [ ] **Step 5: Remove the now-dead translation keys from `th.ts`**

Current (`dashboard.siteInfo`, using the file's actual existing Thai
wording for the keys that stay, whatever it is — only remove `captcha`/
`enabled`/`disabled`/`captchaDifficulty`):
```ts
                captcha: "แคปต์ชา",
                required: "จำเป็น",
                optional: "ไม่บังคับ",
                enabled: "เปิดใช้งาน ({{difficulty}})",
                disabled: "ปิดใช้งาน",
                unknown: "ไม่ทราบ",
                registrationMode: {
                    open: "เปิด",
                    closed: "ปิด",
                    requireApplication: "ต้องยื่นคำขอ",
                },
                captchaDifficulty: {
                    easy: "ง่าย",
                    medium: "ปานกลาง",
                    hard: "ยาก",
                },
            },
```

Change to:
```ts
                required: "จำเป็น",
                optional: "ไม่บังคับ",
                unknown: "ไม่ทราบ",
                registrationMode: {
                    open: "เปิด",
                    closed: "ปิด",
                    requireApplication: "ต้องยื่นคำขอ",
                },
            },
```

- [ ] **Step 6: Remove the now-dead translation keys from `vi.ts`**

Current (`dashboard.siteInfo`, using the file's actual existing
Vietnamese wording — only remove `captcha`/`enabled`/`disabled`/
`captchaDifficulty`):
```ts
                captcha: "Captcha",
                required: "Bắt buộc",
                optional: "Tùy chọn",
                enabled: "Đã bật ({{difficulty}})",
                disabled: "Đã tắt",
                unknown: "Không rõ",
                registrationMode: {
                    open: "Mở",
                    closed: "Đóng",
                    requireApplication: "Yêu cầu đơn đăng ký",
                },
                captchaDifficulty: {
                    easy: "Dễ",
                    medium: "Trung bình",
                    hard: "Khó",
                },
            },
```

Change to:
```ts
                required: "Bắt buộc",
                optional: "Tùy chọn",
                unknown: "Không rõ",
                registrationMode: {
                    open: "Mở",
                    closed: "Đóng",
                    requireApplication: "Yêu cầu đơn đăng ký",
                },
            },
```

- [ ] **Step 7: Verify**

`npx tsc --noEmit` shows no new errors (confirms nothing else in the
codebase reads `localSite.captchaEnabled`/`captchaDifficulty` — if it
does, that's a real remaining reference this step's removal would
correctly surface as a compile error, and should be investigated, not
worked around). The dashboard's site-info bar renders its remaining rows
without a visual gap where Captcha used to be.

- [ ] **Step 8: Commit**

```bash
git add src/lib/108heros-client/src/types/PlatformConfig.ts "src/app/[lang]/admin/dashboard/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): remove the stale captchaEnabled/captchaDifficulty type and dashboard display -- the backend removed this subsystem three weeks ago"
```

---

### Task 3: Scaffold the Site Settings page, complete schema, submit handler, and Site Identity section

**Files:**
- Create: `src/app/[lang]/admin/site-settings/page.tsx`
- Modify: `src/modules/admin/components/layout/AdminSidebar/index.tsx`
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: `updateSite` (Task 1), `isSuccess`/`isFailed` from
  `@/services/HttpService` (established pattern), `useSiteStore` (already
  populated app-wide).
- Produces: `SiteSettingsFormValues` (the zod-inferred type covering all
  36 fields) and the `register`/`handleSubmit`/`errors` bindings from
  `useForm<SiteSettingsFormValues>(...)` — every later task (4-7) adds
  JSX that calls `register("fieldName")` and reads `errors.fieldName`
  from this same `useForm` instance; none of them touch the schema or
  the `useForm` call itself.

This task establishes the page's entire foundation in one pass — the
complete validation schema (all 36 fields, even though only 5 are
editable via UI until Tasks 4-7 land), the submit handler (diff-only
payload, `isSuccess`/`isFailed`, store refresh), the empty/error guard
(matching the dashboard's own established pattern for a possibly-null
`localSite`), and the first visible section, so the page is genuinely
useable (if partially filled out) at the end of this task rather than
only becoming testable once every later task lands too.

- [ ] **Step 1: Create the page with imports, zod schema, and empty/error
  guard**

```tsx
"use client";

import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import {AlertTriangle} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {Card} from "@/components/ui/Card";
import {CustomInput} from "@/components/ui/InputField";
import {useHttpPut} from "@/hooks/api/http/useHttpPut";
import {isSuccess, isFailed, callHttp} from "@/services/HttpService";
import {useSiteStore} from "@/store/useSiteStore";
import type {EditSiteRequest, SiteView} from "108heros-client";

const getSiteSettingsSchema = (t: (key: string) => string) => z.object({
    name: z.string()
        .min(1, t("admin.siteSettings.fields.name.errorMin"))
        .max(20, t("admin.siteSettings.fields.name.errorMax"))
        .optional(),
    sidebar: z.string().optional(),
    description: z.string().max(150, t("admin.siteSettings.fields.description.errorMax")).optional(),
    categoryCreationAdminOnly: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    applicationQuestion: z.string().optional(),
    defaultTheme: z.string().optional(),
    defaultPostListingType: z.enum(["All", "Local"]).optional(),
    defaultPostListingMode: z.enum(["List", "Card", "SmallCard"]).optional(),
    defaultPostSortType: z.enum([
        "Active", "Hot", "New", "Old", "Top", "MostComments", "NewComments", "Controversial", "Scaled",
    ]).optional(),
    defaultPostTimeRangeSeconds: z.number().int().min(0).optional(),
    defaultProposalSortType: z.enum(["Hot", "Top", "New", "Old", "Controversial"]).optional(),
    legalInformation: z.string().optional(),
    applicationEmailAdmins: z.boolean().optional(),
    slurFilterRegex: z.string().optional(),
    actorNameMaxLength: z.number().int().min(1).optional(),
    rateLimitMessageMaxRequests: z.number().int().min(0).optional(),
    rateLimitMessageIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitPostMaxRequests: z.number().int().min(0).optional(),
    rateLimitPostIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitRegisterMaxRequests: z.number().int().min(0).optional(),
    rateLimitRegisterIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitImageMaxRequests: z.number().int().min(0).optional(),
    rateLimitImageIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitProposalMaxRequests: z.number().int().min(0).optional(),
    rateLimitProposalIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitSearchMaxRequests: z.number().int().min(0).optional(),
    rateLimitSearchIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitImportUserSettingsMaxRequests: z.number().int().min(0).optional(),
    rateLimitImportUserSettingsIntervalSeconds: z.number().int().min(0).optional(),
    registrationMode: z.enum(["Open", "Closed", "RequireApplication"]).optional(),
    reportsEmailAdmins: z.boolean().optional(),
    contentWarning: z.string().optional(),
    oauthRegistration: z.boolean().optional(),
    disallowSelfPromotionContent: z.boolean().optional(),
    disableEmailNotifications: z.boolean().optional(),
});

type SiteSettingsFormValues = z.infer<ReturnType<typeof getSiteSettingsSchema>>;

// useForm's defaultValues is captured once at first render -- if the store
// populates later (retry button, or the refresh after a successful save),
// this rebuilds the object so an effect can reset() the form onto it.
const buildDefaultValues = (siteView?: SiteView | null): SiteSettingsFormValues => {
    const localSite = siteView?.localSite;
    const rateLimit = siteView?.localSiteRateLimit;
    return {
        name: localSite?.name,
        sidebar: localSite?.sidebar ?? undefined,
        description: localSite?.description ?? undefined,
        categoryCreationAdminOnly: localSite?.categoryCreationAdminOnly,
        requireEmailVerification: localSite?.requireEmailVerification,
        applicationQuestion: localSite?.applicationQuestion ?? undefined,
        defaultTheme: localSite?.defaultTheme,
        defaultPostListingType: localSite?.defaultPostListingType,
        defaultPostListingMode: localSite?.defaultPostListingMode,
        defaultPostSortType: localSite?.defaultPostSortType,
        defaultPostTimeRangeSeconds: localSite?.defaultPostTimeRangeSeconds ?? undefined,
        defaultProposalSortType: localSite?.defaultProposalSortType,
        legalInformation: localSite?.legalInformation ?? undefined,
        applicationEmailAdmins: localSite?.applicationEmailAdmins,
        slurFilterRegex: localSite?.slurFilterRegex ?? undefined,
        actorNameMaxLength: localSite?.actorNameMaxLength ?? undefined,
        rateLimitMessageMaxRequests: rateLimit?.messageMaxRequests ?? undefined,
        rateLimitMessageIntervalSeconds: rateLimit?.messageIntervalSeconds ?? undefined,
        rateLimitPostMaxRequests: rateLimit?.postMaxRequests ?? undefined,
        rateLimitPostIntervalSeconds: rateLimit?.postIntervalSeconds ?? undefined,
        rateLimitRegisterMaxRequests: rateLimit?.registerMaxRequests ?? undefined,
        rateLimitRegisterIntervalSeconds: rateLimit?.registerIntervalSeconds ?? undefined,
        rateLimitImageMaxRequests: rateLimit?.imageMaxRequests ?? undefined,
        rateLimitImageIntervalSeconds: rateLimit?.imageIntervalSeconds ?? undefined,
        rateLimitProposalMaxRequests: rateLimit?.proposalMaxRequests ?? undefined,
        rateLimitProposalIntervalSeconds: rateLimit?.proposalIntervalSeconds ?? undefined,
        rateLimitSearchMaxRequests: rateLimit?.searchMaxRequests ?? undefined,
        rateLimitSearchIntervalSeconds: rateLimit?.searchIntervalSeconds ?? undefined,
        rateLimitImportUserSettingsMaxRequests: rateLimit?.importUserSettingsMaxRequests ?? undefined,
        rateLimitImportUserSettingsIntervalSeconds: rateLimit?.importUserSettingsIntervalSeconds ?? undefined,
        registrationMode: localSite?.registrationMode,
        reportsEmailAdmins: localSite?.reportsEmailAdmins,
        contentWarning: localSite?.contentWarning ?? undefined,
        oauthRegistration: localSite?.oauthRegistration,
        disallowSelfPromotionContent: localSite?.disallowSelfPromotionContent,
        disableEmailNotifications: localSite?.disableEmailNotifications,
    };
};

const SiteSettingsPage = () => {
    const {t} = useTranslation();
    const {siteRes, setSiteRes} = useSiteStore();
    const localSite = siteRes?.siteView?.localSite;
    const [retrying, setRetrying] = useState(false);

    const {execute: updateSite, isMutating: isSaving} = useHttpPut("updateSite");

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, dirtyFields},
    } = useForm<SiteSettingsFormValues>({
        resolver: zodResolver(getSiteSettingsSchema(t)),
        defaultValues: buildDefaultValues(siteRes?.siteView),
    });

    useEffect(() => {
        if (siteRes?.siteView) {
            reset(buildDefaultValues(siteRes.siteView));
        }
    }, [siteRes, reset]);

    const handleRetry = async () => {
        setRetrying(true);
        const res = await callHttp("getSite");
        if (isSuccess(res)) {
            setSiteRes(res.data);
        }
        setRetrying(false);
    };

    if (!localSite) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-gray-600">
                    <AlertTriangle className="w-10 h-10 text-destructive"/>
                    <p className="text-lg font-medium">{t("admin.siteSettings.loadError.title")}</p>
                    <p className="text-sm max-w-md">{t("admin.siteSettings.loadError.description")}</p>
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="px-4 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                    >
                        {retrying ? t("admin.siteSettings.loadError.retrying") : t("admin.siteSettings.loadError.retry")}
                    </button>
                </div>
            </AdminLayout>
        );
    }

    const onSubmit = async (values: SiteSettingsFormValues) => {
        // Only send fields the admin actually edited -- the backend treats
        // an absent field as "leave unchanged," not "clear this value".
        const changedKeys = Object.keys(dirtyFields) as Array<keyof SiteSettingsFormValues>;
        const payload = Object.fromEntries(
            changedKeys.map((key) => [key, values[key]]),
        ) as EditSiteRequest;
        const res = await updateSite(payload);
        if (isSuccess(res)) {
            toast.success(t("admin.siteSettings.saveSuccess"));
            const refreshed = await callHttp("getSite");
            if (isSuccess(refreshed)) {
                setSiteRes(refreshed.data);
            }
        } else if (isFailed(res)) {
            toast.error(t("admin.siteSettings.saveFailed"));
        }
    };

    return (
        <AdminLayout>
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t("admin.siteSettings.title")}</h1>
                    <p className="mt-2 text-muted-foreground">{t("admin.siteSettings.description")}</p>
                </div>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.identity.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="name"
                        register={register("name")}
                        label={t("admin.siteSettings.fields.name.label")}
                        placeholder={t("admin.siteSettings.fields.name.placeholder")}
                        error={errors.name?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="text"
                        name="description"
                        register={register("description")}
                        label={t("admin.siteSettings.fields.description.label")}
                        placeholder={t("admin.siteSettings.fields.description.placeholder")}
                        error={errors.description?.message}
                    />

                    <CustomInput
                        tag="textarea"
                        name="sidebar"
                        register={register("sidebar")}
                        label={t("admin.siteSettings.fields.sidebar.label")}
                        placeholder={t("admin.siteSettings.fields.sidebar.placeholder")}
                        rows={6}
                        error={errors.sidebar?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="text"
                        name="contentWarning"
                        register={register("contentWarning")}
                        label={t("admin.siteSettings.fields.contentWarning.label")}
                        error={errors.contentWarning?.message}
                    />

                    <CustomInput
                        tag="textarea"
                        name="legalInformation"
                        register={register("legalInformation")}
                        label={t("admin.siteSettings.fields.legalInformation.label")}
                        rows={6}
                        error={errors.legalInformation?.message}
                    />
                </Card>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                    >
                        {isSaving ? t("admin.siteSettings.saving") : t("admin.siteSettings.saveButton")}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
};

export default SiteSettingsPage;
```

Note: `CustomInput`'s `register` prop accepts a `UseFormRegisterReturn`
(confirmed from its own type definition) — this is `react-hook-form`'s
standard `register()` return value, the direct wiring approach (simpler
than `AddBankAccountModal`'s older `watch()`/`setValue()` pattern, and
the more common `react-hook-form` idiom); both are valid in this
codebase, this task uses `register()` directly since it composes more
simply across 36 fields.

- [ ] **Step 2: Add the sidebar nav entry**

Current (`navigationItems`, the array's last entry):
```tsx
    {key: "manageRiders", url: "/admin/manage-riders", icon: Motorbike},
];
```

Change to:
```tsx
    {key: "manageRiders", url: "/admin/manage-riders", icon: Motorbike},
    {key: "siteSettings", url: "/admin/site-settings", icon: Settings},
];
```

Add `Settings` to the existing `lucide-react` import (already imported
elsewhere in this codebase, e.g. `dashboard/page.tsx`, confirming it's
available):
```tsx
import {
    Users,
    Plus,
    Minus,
    LayoutDashboard,
    Handbag, CreditCard, ChartColumnStacked, Image as ImageIcon, Motorbike, Settings
} from "lucide-react";
```

- [ ] **Step 3: Add the new translation keys to `en.ts`**

First, add the sidebar nav entry's own title/description. Current
(`admin.layout.sidebar.nav`, its last entry):
```ts
                        manageRiders: {title: "Manage Riders", description: "Manage riders for 108heros"},
                    },
                },
            },
```

Change to:
```ts
                        manageRiders: {title: "Manage Riders", description: "Manage riders for 108heros"},
                        siteSettings: {title: "Site Settings", description: "Configure site identity, registration, and rate limits"},
                    },
                },
            },
```

Then add a new top-level `siteSettings` object under the existing `admin`
namespace (find `admin: {` — the object already containing
`bankManagement`, `riders`, `withdraw`; add `siteSettings` as a new
sibling entry anywhere inside it, e.g. right after `withdraw` closes):
```ts
            siteSettings: {
                title: "Site Settings",
                description: "Configure your site's identity, registration, moderation, and rate limits.",
                saveButton: "Save Changes",
                saving: "Saving...",
                saveSuccess: "Settings saved successfully",
                saveFailed: "Failed to save settings. Please try again.",
                loadError: {
                    title: "Unable to load site information",
                    description: "Something went wrong loading this site's configuration.",
                    retry: "Retry",
                    retrying: "Retrying…",
                },
                sections: {
                    identity: {title: "Site Identity"},
                },
                fields: {
                    name: {
                        label: "Site Name",
                        placeholder: "e.g. 108Heros",
                        errorMin: "Site name is required",
                        errorMax: "Site name must be 20 characters or fewer",
                    },
                    description: {
                        label: "Description",
                        placeholder: "A short, one-line description",
                        errorMax: "Description must be 150 characters or fewer",
                    },
                    sidebar: {label: "Sidebar (Markdown)", placeholder: "Additional site information shown to visitors"},
                    contentWarning: {label: "Content Warning"},
                    legalInformation: {label: "Legal Information (Markdown)"},
                },
            },
```

- [ ] **Step 4: Add the new translation keys to `th.ts`**

First, add the sidebar nav entry's own title/description. Current
(`admin.layout.sidebar.nav`, its last entry):
```ts
                        manageRiders: {title: "จัดการไรเดอร์", description: "จัดการไรเดอร์สำหรับ 108heros"},
                    },
                },
            },
```

Change to:
```ts
                        manageRiders: {title: "จัดการไรเดอร์", description: "จัดการไรเดอร์สำหรับ 108heros"},
                        siteSettings: {title: "การตั้งค่าไซต์", description: "ตั้งค่าข้อมูลไซต์ การลงทะเบียน และขีดจำกัดอัตราการใช้งาน"},
                    },
                },
            },
```

Then add the same structure, real Thai text:
```ts
            siteSettings: {
                title: "การตั้งค่าไซต์",
                description: "ตั้งค่าข้อมูลไซต์ การลงทะเบียน การกลั่นกรอง และขีดจำกัดอัตราการใช้งาน",
                saveButton: "บันทึกการเปลี่ยนแปลง",
                saving: "กำลังบันทึก...",
                saveSuccess: "บันทึกการตั้งค่าเรียบร้อยแล้ว",
                saveFailed: "บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่",
                loadError: {
                    title: "ไม่สามารถโหลดข้อมูลไซต์ได้",
                    description: "เกิดข้อผิดพลาดขณะโหลดการตั้งค่าของไซต์นี้",
                    retry: "ลองใหม่",
                    retrying: "กำลังลองใหม่…",
                },
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                },
                fields: {
                    name: {
                        label: "ชื่อไซต์",
                        placeholder: "เช่น 108Heros",
                        errorMin: "กรุณากรอกชื่อไซต์",
                        errorMax: "ชื่อไซต์ต้องมีความยาวไม่เกิน 20 ตัวอักษร",
                    },
                    description: {
                        label: "คำอธิบาย",
                        placeholder: "คำอธิบายสั้น ๆ หนึ่งบรรทัด",
                        errorMax: "คำอธิบายต้องมีความยาวไม่เกิน 150 ตัวอักษร",
                    },
                    sidebar: {label: "แถบข้างเคียง (Markdown)", placeholder: "ข้อมูลเพิ่มเติมของไซต์ที่แสดงต่อผู้เยี่ยมชม"},
                    contentWarning: {label: "คำเตือนเนื้อหา"},
                    legalInformation: {label: "ข้อมูลทางกฎหมาย (Markdown)"},
                },
            },
```

- [ ] **Step 5: Add the new translation keys to `vi.ts`**

First, add the sidebar nav entry's own title/description. Current
(`admin.layout.sidebar.nav`, its last entry):
```ts
                        manageRiders: {title: "Quản lý tài xế", description: "Quản lý tài xế cho 108heros"},
                    },
                },
            },
```

Change to:
```ts
                        manageRiders: {title: "Quản lý tài xế", description: "Quản lý tài xế cho 108heros"},
                        siteSettings: {title: "Cài Đặt Trang Web", description: "Cấu hình thông tin trang web, đăng ký và giới hạn tần suất"},
                    },
                },
            },
```

Then add the same structure, real Vietnamese text:
```ts
            siteSettings: {
                title: "Cài Đặt Trang Web",
                description: "Cấu hình thông tin trang web, đăng ký, kiểm duyệt và giới hạn tần suất.",
                saveButton: "Lưu Thay Đổi",
                saving: "Đang lưu...",
                saveSuccess: "Đã lưu cài đặt thành công",
                saveFailed: "Lưu cài đặt thất bại. Vui lòng thử lại.",
                loadError: {
                    title: "Không thể tải thông tin trang web",
                    description: "Đã xảy ra lỗi khi tải cấu hình của trang web này.",
                    retry: "Thử lại",
                    retrying: "Đang thử lại…",
                },
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                },
                fields: {
                    name: {
                        label: "Tên Trang Web",
                        placeholder: "ví dụ: 108Heros",
                        errorMin: "Vui lòng nhập tên trang web",
                        errorMax: "Tên trang web không được vượt quá 20 ký tự",
                    },
                    description: {
                        label: "Mô Tả",
                        placeholder: "Mô tả ngắn gọn, một dòng",
                        errorMax: "Mô tả không được vượt quá 150 ký tự",
                    },
                    sidebar: {label: "Thanh Bên (Markdown)", placeholder: "Thông tin bổ sung của trang web hiển thị cho khách truy cập"},
                    contentWarning: {label: "Cảnh Báo Nội Dung"},
                    legalInformation: {label: "Thông Tin Pháp Lý (Markdown)"},
                },
            },
```

- [ ] **Step 6: Verify in the browser**

The Site Settings page appears in the admin sidebar, navigates
correctly, pre-fills the Site Identity fields with the site's actual
current values, and saving changes to the site name persists (reload
confirms the new value, both on this page and on the dashboard's
read-only display). Clearing the name field or typing more than 20
characters shows `errorMin`/`errorMax`'s real translated text (not a
raw zod default message) inline, and switching locale changes that
message's language too — confirm in all three locales. Open the
Network tab, edit only the site name, and save: confirm the `PUT /site`
request body contains just `{"name": "..."}`, not all 36 fields —
this is the `dirtyFields` diff-only behavior working correctly.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/site-settings/page.tsx" src/modules/admin/components/layout/AdminSidebar/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(admin): add the Site Settings page with its Site Identity section, full schema, and submit handler"
```

---

### Task 4: Registration & Access section

**Files:**
- Modify: `src/app/[lang]/admin/site-settings/page.tsx:` (the Site
  Identity `Card`'s closing tag, and the `translations` files' new
  `siteSettings.sections`/`siteSettings.fields` objects)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: `register`, `errors` from Task 3's `useForm` call (unchanged
  — this task only adds JSX, no schema/logic changes).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the new `Card` section, right after the Site Identity
  `Card` closes and before the submit button's `<div>`**

Current (post-Task-3 state — the boundary between the Site Identity card
and the submit button):
```tsx
                    <CustomInput
                        tag="textarea"
                        name="legalInformation"
                        register={register("legalInformation")}
                        label={t("admin.siteSettings.fields.legalInformation.label")}
                        rows={6}
                        error={errors.legalInformation?.message}
                    />
                </Card>

                <div className="flex justify-end">
```

Change to:
```tsx
                    <CustomInput
                        tag="textarea"
                        name="legalInformation"
                        register={register("legalInformation")}
                        label={t("admin.siteSettings.fields.legalInformation.label")}
                        rows={6}
                        error={errors.legalInformation?.message}
                    />
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.registration.title")}</h2>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.registrationMode.label")}
                        </label>
                        <select
                            {...register("registrationMode")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="Open">{t("dashboard.siteInfo.registrationMode.open")}</option>
                            <option value="Closed">{t("dashboard.siteInfo.registrationMode.closed")}</option>
                            <option value="RequireApplication">{t("dashboard.siteInfo.registrationMode.requireApplication")}</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("requireEmailVerification")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.requireEmailVerification.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("categoryCreationAdminOnly")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.categoryCreationAdminOnly.label")}</span>
                    </label>

                    <CustomInput
                        tag="textarea"
                        name="applicationQuestion"
                        register={register("applicationQuestion")}
                        label={t("admin.siteSettings.fields.applicationQuestion.label")}
                        rows={4}
                        error={errors.applicationQuestion?.message}
                    />

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("applicationEmailAdmins")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.applicationEmailAdmins.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("oauthRegistration")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.oauthRegistration.label")}</span>
                    </label>
                </Card>

                <div className="flex justify-end">
```

- [ ] **Step 2: Add the new translation keys to `en.ts`**

Current (`admin.siteSettings.sections`, post-Task-3 state — its only
entry):
```ts
                sections: {
                    identity: {title: "Site Identity"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-3 state — its last
entry before the closing brace):
```ts
                    legalInformation: {label: "Legal Information (Markdown)"},
                },
```

Change to:
```ts
                    legalInformation: {label: "Legal Information (Markdown)"},
                    registrationMode: {label: "Registration Mode"},
                    requireEmailVerification: {label: "Require Email Verification"},
                    categoryCreationAdminOnly: {label: "Limit Category Creation to Admins"},
                    applicationQuestion: {label: "Application Question"},
                    applicationEmailAdmins: {label: "Notify Admins on New Application"},
                    oauthRegistration: {label: "Allow OAuth Registration"},
                },
```

- [ ] **Step 3: Add the new translation keys to `th.ts`**

Current (`admin.siteSettings.sections`, post-Task-3 state):
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-3 state — its last
entry):
```ts
                    legalInformation: {label: "ข้อมูลทางกฎหมาย (Markdown)"},
                },
```

Change to:
```ts
                    legalInformation: {label: "ข้อมูลทางกฎหมาย (Markdown)"},
                    registrationMode: {label: "โหมดการลงทะเบียน"},
                    requireEmailVerification: {label: "ต้องยืนยันอีเมล"},
                    categoryCreationAdminOnly: {label: "จำกัดการสร้างหมวดหมู่เฉพาะแอดมิน"},
                    applicationQuestion: {label: "คำถามใบสมัคร"},
                    applicationEmailAdmins: {label: "แจ้งเตือนแอดมินเมื่อมีใบสมัครใหม่"},
                    oauthRegistration: {label: "อนุญาตการลงทะเบียนผ่าน OAuth"},
                },
```

- [ ] **Step 4: Add the new translation keys to `vi.ts`**

Current (`admin.siteSettings.sections`, post-Task-3 state):
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-3 state — its last
entry):
```ts
                    legalInformation: {label: "Thông Tin Pháp Lý (Markdown)"},
                },
```

Change to:
```ts
                    legalInformation: {label: "Thông Tin Pháp Lý (Markdown)"},
                    registrationMode: {label: "Chế Độ Đăng Ký"},
                    requireEmailVerification: {label: "Yêu Cầu Xác Minh Email"},
                    categoryCreationAdminOnly: {label: "Giới Hạn Tạo Danh Mục Chỉ Cho Admin"},
                    applicationQuestion: {label: "Câu Hỏi Đơn Đăng Ký"},
                    applicationEmailAdmins: {label: "Thông Báo Admin Khi Có Đơn Đăng Ký Mới"},
                    oauthRegistration: {label: "Cho Phép Đăng Ký Qua OAuth"},
                },
```

- [ ] **Step 5: Verify in the browser**

The Registration & Access section appears between Site Identity and the
Save button, pre-filled with the site's real current values. Changing
the registration mode and saving persists the change (confirm against
the dashboard's own read-only Registration badge). All 4 checkboxes
toggle and persist correctly.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/site-settings/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(admin): add the Registration & Access section to Site Settings"
```

---

### Task 5: Moderation section

**Files:**
- Modify: `src/app/[lang]/admin/site-settings/page.tsx` (post-Task-4
  state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: `register`, `errors` from Task 3's `useForm` call.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the new `Card` section, right after the Registration
  & Access `Card` closes**

Current (post-Task-4 state — the boundary between the Registration &
Access card and the submit button):
```tsx
                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("oauthRegistration")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.oauthRegistration.label")}</span>
                    </label>
                </Card>

                <div className="flex justify-end">
```

Change to:
```tsx
                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("oauthRegistration")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.oauthRegistration.label")}</span>
                    </label>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.moderation.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="slurFilterRegex"
                        register={register("slurFilterRegex")}
                        label={t("admin.siteSettings.fields.slurFilterRegex.label")}
                        error={errors.slurFilterRegex?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="number"
                        name="actorNameMaxLength"
                        register={register("actorNameMaxLength", {valueAsNumber: true})}
                        label={t("admin.siteSettings.fields.actorNameMaxLength.label")}
                        error={errors.actorNameMaxLength?.message}
                    />

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disallowSelfPromotionContent")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disallowSelfPromotionContent.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("reportsEmailAdmins")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.reportsEmailAdmins.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disableEmailNotifications")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disableEmailNotifications.label")}</span>
                    </label>
                </Card>

                <div className="flex justify-end">
```

- [ ] **Step 2: Add the new translation keys to `en.ts`**

Current (`admin.siteSettings.sections`, post-Task-4 state):
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                    moderation: {title: "Moderation"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-4 state — its last
entry):
```ts
                    oauthRegistration: {label: "Allow OAuth Registration"},
                },
```

Change to:
```ts
                    oauthRegistration: {label: "Allow OAuth Registration"},
                    slurFilterRegex: {label: "Slur Filter (Regex)"},
                    actorNameMaxLength: {label: "Max Username Length"},
                    disallowSelfPromotionContent: {label: "Block Self-Promotion Content"},
                    reportsEmailAdmins: {label: "Notify Admins on New Reports"},
                    disableEmailNotifications: {label: "Disable Email Notifications"},
                },
```

- [ ] **Step 3: Add the new translation keys to `th.ts`**

Current (`admin.siteSettings.sections`, post-Task-4 state):
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                    moderation: {title: "การกลั่นกรอง"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-4 state — its last
entry):
```ts
                    oauthRegistration: {label: "อนุญาตการลงทะเบียนผ่าน OAuth"},
                },
```

Change to:
```ts
                    oauthRegistration: {label: "อนุญาตการลงทะเบียนผ่าน OAuth"},
                    slurFilterRegex: {label: "ตัวกรองคำหยาบ (Regex)"},
                    actorNameMaxLength: {label: "ความยาวชื่อผู้ใช้สูงสุด"},
                    disallowSelfPromotionContent: {label: "บล็อกเนื้อหาโปรโมตตัวเอง"},
                    reportsEmailAdmins: {label: "แจ้งเตือนแอดมินเมื่อมีรายงานใหม่"},
                    disableEmailNotifications: {label: "ปิดการแจ้งเตือนทางอีเมล"},
                },
```

- [ ] **Step 4: Add the new translation keys to `vi.ts`**

Current (`admin.siteSettings.sections`, post-Task-4 state):
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                    moderation: {title: "Kiểm Duyệt"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-4 state — its last
entry):
```ts
                    oauthRegistration: {label: "Cho Phép Đăng Ký Qua OAuth"},
                },
```

Change to:
```ts
                    oauthRegistration: {label: "Cho Phép Đăng Ký Qua OAuth"},
                    slurFilterRegex: {label: "Bộ Lọc Từ Ngữ Xúc Phạm (Regex)"},
                    actorNameMaxLength: {label: "Độ Dài Tên Người Dùng Tối Đa"},
                    disallowSelfPromotionContent: {label: "Chặn Nội Dung Tự Quảng Cáo"},
                    reportsEmailAdmins: {label: "Thông Báo Admin Khi Có Báo Cáo Mới"},
                    disableEmailNotifications: {label: "Tắt Thông Báo Qua Email"},
                },
```

- [ ] **Step 5: Verify in the browser**

The Moderation section appears between Registration & Access and the
Save button, pre-filled with real current values. `actorNameMaxLength`
only accepts numbers (`valueAsNumber: true` correctly coerces the input
value). All 3 checkboxes toggle and persist correctly.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/site-settings/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(admin): add the Moderation section to Site Settings"
```

---

### Task 6: Content Defaults section

**Files:**
- Modify: `src/app/[lang]/admin/site-settings/page.tsx` (post-Task-5
  state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: `register`, `errors` from Task 3's `useForm` call.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the new `Card` section, right after the Moderation
  `Card` closes**

Current (post-Task-5 state — the boundary between the Moderation card
and the submit button):
```tsx
                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disableEmailNotifications")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disableEmailNotifications.label")}</span>
                    </label>
                </Card>

                <div className="flex justify-end">
```

Change to:
```tsx
                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disableEmailNotifications")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disableEmailNotifications.label")}</span>
                    </label>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.contentDefaults.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="defaultTheme"
                        register={register("defaultTheme")}
                        label={t("admin.siteSettings.fields.defaultTheme.label")}
                        placeholder="browser"
                        error={errors.defaultTheme?.message}
                    />

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.defaultPostListingType.label")}
                        </label>
                        <select
                            {...register("defaultPostListingType")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="All">{t("admin.siteSettings.fields.defaultPostListingType.all")}</option>
                            <option value="Local">{t("admin.siteSettings.fields.defaultPostListingType.local")}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.defaultPostListingMode.label")}
                        </label>
                        <select
                            {...register("defaultPostListingMode")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="List">{t("admin.siteSettings.fields.defaultPostListingMode.list")}</option>
                            <option value="Card">{t("admin.siteSettings.fields.defaultPostListingMode.card")}</option>
                            <option value="SmallCard">{t("admin.siteSettings.fields.defaultPostListingMode.smallCard")}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.defaultPostSortType.label")}
                        </label>
                        <select
                            {...register("defaultPostSortType")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="Active">{t("admin.siteSettings.fields.defaultPostSortType.active")}</option>
                            <option value="Hot">{t("admin.siteSettings.fields.defaultPostSortType.hot")}</option>
                            <option value="New">{t("admin.siteSettings.fields.defaultPostSortType.new")}</option>
                            <option value="Old">{t("admin.siteSettings.fields.defaultPostSortType.old")}</option>
                            <option value="Top">{t("admin.siteSettings.fields.defaultPostSortType.top")}</option>
                            <option value="MostComments">{t("admin.siteSettings.fields.defaultPostSortType.mostComments")}</option>
                            <option value="NewComments">{t("admin.siteSettings.fields.defaultPostSortType.newComments")}</option>
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultPostSortType.controversial")}</option>
                            <option value="Scaled">{t("admin.siteSettings.fields.defaultPostSortType.scaled")}</option>
                        </select>
                    </div>

                    <CustomInput
                        tag="input"
                        type="number"
                        name="defaultPostTimeRangeSeconds"
                        register={register("defaultPostTimeRangeSeconds", {valueAsNumber: true})}
                        label={t("admin.siteSettings.fields.defaultPostTimeRangeSeconds.label")}
                        error={errors.defaultPostTimeRangeSeconds?.message}
                    />

                    <div>
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.defaultProposalSortType.label")}
                        </label>
                        <select
                            {...register("defaultProposalSortType")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="Hot">{t("admin.siteSettings.fields.defaultProposalSortType.hot")}</option>
                            <option value="Top">{t("admin.siteSettings.fields.defaultProposalSortType.top")}</option>
                            <option value="New">{t("admin.siteSettings.fields.defaultProposalSortType.new")}</option>
                            <option value="Old">{t("admin.siteSettings.fields.defaultProposalSortType.old")}</option>
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultProposalSortType.controversial")}</option>
                        </select>
                    </div>
                </Card>

                <div className="flex justify-end">
```

- [ ] **Step 2: Add the new translation keys to `en.ts`**

Current (`admin.siteSettings.sections`, post-Task-5 state):
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                    moderation: {title: "Moderation"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                    moderation: {title: "Moderation"},
                    contentDefaults: {title: "Content Defaults"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-5 state — its last
entry):
```ts
                    disableEmailNotifications: {label: "Disable Email Notifications"},
                },
```

Change to:
```ts
                    disableEmailNotifications: {label: "Disable Email Notifications"},
                    defaultTheme: {label: "Default Theme"},
                    defaultPostListingType: {
                        label: "Default Post Listing",
                        all: "All",
                        local: "Local",
                    },
                    defaultPostListingMode: {
                        label: "Default Post View",
                        list: "List",
                        card: "Card",
                        smallCard: "Small Card",
                    },
                    defaultPostSortType: {
                        label: "Default Post Sort",
                        active: "Active",
                        hot: "Hot",
                        new: "New",
                        old: "Old",
                        top: "Top",
                        mostComments: "Most Comments",
                        newComments: "New Comments",
                        controversial: "Controversial",
                        scaled: "Scaled",
                    },
                    defaultPostTimeRangeSeconds: {label: "Default Post Time Range (seconds, 0 = none)"},
                    defaultProposalSortType: {
                        label: "Default Proposal Sort",
                        hot: "Hot",
                        top: "Top",
                        new: "New",
                        old: "Old",
                        controversial: "Controversial",
                    },
                },
```

- [ ] **Step 3: Add the new translation keys to `th.ts`**

Current (`admin.siteSettings.sections`, post-Task-5 state):
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                    moderation: {title: "การกลั่นกรอง"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                    moderation: {title: "การกลั่นกรอง"},
                    contentDefaults: {title: "ค่าเริ่มต้นเนื้อหา"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-5 state — its last
entry):
```ts
                    disableEmailNotifications: {label: "ปิดการแจ้งเตือนทางอีเมล"},
                },
```

Change to:
```ts
                    disableEmailNotifications: {label: "ปิดการแจ้งเตือนทางอีเมล"},
                    defaultTheme: {label: "ธีมเริ่มต้น"},
                    defaultPostListingType: {
                        label: "รายการโพสต์เริ่มต้น",
                        all: "ทั้งหมด",
                        local: "ภายในไซต์",
                    },
                    defaultPostListingMode: {
                        label: "มุมมองโพสต์เริ่มต้น",
                        list: "รายการ",
                        card: "การ์ด",
                        smallCard: "การ์ดขนาดเล็ก",
                    },
                    defaultPostSortType: {
                        label: "การเรียงโพสต์เริ่มต้น",
                        active: "ใช้งานอยู่",
                        hot: "มาแรง",
                        new: "ใหม่ล่าสุด",
                        old: "เก่าที่สุด",
                        top: "ยอดนิยม",
                        mostComments: "ความคิดเห็นมากที่สุด",
                        newComments: "ความคิดเห็นใหม่",
                        controversial: "เป็นที่ถกเถียง",
                        scaled: "ปรับสัดส่วน",
                    },
                    defaultPostTimeRangeSeconds: {label: "ช่วงเวลาโพสต์เริ่มต้น (วินาที, 0 = ไม่จำกัด)"},
                    defaultProposalSortType: {
                        label: "การเรียงข้อเสนอเริ่มต้น",
                        hot: "มาแรง",
                        top: "ยอดนิยม",
                        new: "ใหม่ล่าสุด",
                        old: "เก่าที่สุด",
                        controversial: "เป็นที่ถกเถียง",
                    },
                },
```

- [ ] **Step 4: Add the new translation keys to `vi.ts`**

Current (`admin.siteSettings.sections`, post-Task-5 state):
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                    moderation: {title: "Kiểm Duyệt"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                    moderation: {title: "Kiểm Duyệt"},
                    contentDefaults: {title: "Mặc Định Nội Dung"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-5 state — its last
entry):
```ts
                    disableEmailNotifications: {label: "Tắt Thông Báo Qua Email"},
                },
```

Change to:
```ts
                    disableEmailNotifications: {label: "Tắt Thông Báo Qua Email"},
                    defaultTheme: {label: "Giao Diện Mặc Định"},
                    defaultPostListingType: {
                        label: "Danh Sách Bài Đăng Mặc Định",
                        all: "Tất cả",
                        local: "Nội bộ",
                    },
                    defaultPostListingMode: {
                        label: "Chế Độ Xem Bài Đăng Mặc Định",
                        list: "Danh sách",
                        card: "Thẻ",
                        smallCard: "Thẻ nhỏ",
                    },
                    defaultPostSortType: {
                        label: "Sắp Xếp Bài Đăng Mặc Định",
                        active: "Đang hoạt động",
                        hot: "Nổi bật",
                        new: "Mới nhất",
                        old: "Cũ nhất",
                        top: "Hàng đầu",
                        mostComments: "Nhiều bình luận nhất",
                        newComments: "Bình luận mới",
                        controversial: "Gây tranh cãi",
                        scaled: "Theo tỷ lệ",
                    },
                    defaultPostTimeRangeSeconds: {label: "Khoảng Thời Gian Bài Đăng Mặc Định (giây, 0 = không giới hạn)"},
                    defaultProposalSortType: {
                        label: "Sắp Xếp Đề Xuất Mặc Định",
                        hot: "Nổi bật",
                        top: "Hàng đầu",
                        new: "Mới nhất",
                        old: "Cũ nhất",
                        controversial: "Gây tranh cãi",
                    },
                },
```

- [ ] **Step 5: Verify in the browser**

The Content Defaults section appears between Moderation and the Save
button, pre-filled with real current values. All 4 selects show only
their valid options (in particular, confirm the Default Post Listing
select offers only "All"/"Local," matching the backend's own
`site_default_post_listing_type_check` constraint). Saving a changed
value persists it.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/site-settings/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(admin): add the Content Defaults section to Site Settings"
```

---

### Task 7: Rate Limits section

**Files:**
- Modify: `src/app/[lang]/admin/site-settings/page.tsx` (post-Task-6
  state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`

**Interfaces:**
- Consumes: `register`, `errors` from Task 3's `useForm` call.
- Produces: nothing later tasks depend on. This is the plan's last task.

- [ ] **Step 1: Add the new `Card` section, right after the Content
  Defaults `Card` closes**

Current (post-Task-6 state — the boundary between the Content Defaults
card and the submit button):
```tsx
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultProposalSortType.controversial")}</option>
                        </select>
                    </div>
                </Card>

                <div className="flex justify-end">
```

Change to:
```tsx
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultProposalSortType.controversial")}</option>
                        </select>
                    </div>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.rateLimits.title")}</h2>

                    {([
                        {key: "message", max: "rateLimitMessageMaxRequests", interval: "rateLimitMessageIntervalSeconds"},
                        {key: "post", max: "rateLimitPostMaxRequests", interval: "rateLimitPostIntervalSeconds"},
                        {key: "register", max: "rateLimitRegisterMaxRequests", interval: "rateLimitRegisterIntervalSeconds"},
                        {key: "image", max: "rateLimitImageMaxRequests", interval: "rateLimitImageIntervalSeconds"},
                        {key: "proposal", max: "rateLimitProposalMaxRequests", interval: "rateLimitProposalIntervalSeconds"},
                        {key: "search", max: "rateLimitSearchMaxRequests", interval: "rateLimitSearchIntervalSeconds"},
                        {key: "importUserSettings", max: "rateLimitImportUserSettingsMaxRequests", interval: "rateLimitImportUserSettingsIntervalSeconds"},
                    ] as const).map((row) => (
                        <div key={row.key} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                            <p className="text-sm font-medium sm:col-span-1">
                                {t(`admin.siteSettings.fields.rateLimits.${row.key}`)}
                            </p>
                            <CustomInput
                                tag="input"
                                type="number"
                                name={row.max}
                                register={register(row.max, {valueAsNumber: true})}
                                label={t("admin.siteSettings.fields.rateLimits.maxRequests")}
                                error={errors[row.max]?.message}
                            />
                            <CustomInput
                                tag="input"
                                type="number"
                                name={row.interval}
                                register={register(row.interval, {valueAsNumber: true})}
                                label={t("admin.siteSettings.fields.rateLimits.intervalSeconds")}
                                error={errors[row.interval]?.message}
                            />
                        </div>
                    ))}
                </Card>

                <div className="flex justify-end">
```

- [ ] **Step 2: Add the new translation keys to `en.ts`**

Current (`admin.siteSettings.sections`, post-Task-6 state):
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                    moderation: {title: "Moderation"},
                    contentDefaults: {title: "Content Defaults"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Site Identity"},
                    registration: {title: "Registration & Access"},
                    moderation: {title: "Moderation"},
                    contentDefaults: {title: "Content Defaults"},
                    rateLimits: {title: "Rate Limits"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-6 state — its last
entry, right before the closing of the whole `siteSettings` object):
```ts
                    defaultProposalSortType: {
                        label: "Default Proposal Sort",
                        hot: "Hot",
                        top: "Top",
                        new: "New",
                        old: "Old",
                        controversial: "Controversial",
                    },
                },
            },
```

Change to:
```ts
                    defaultProposalSortType: {
                        label: "Default Proposal Sort",
                        hot: "Hot",
                        top: "Top",
                        new: "New",
                        old: "Old",
                        controversial: "Controversial",
                    },
                    rateLimits: {
                        maxRequests: "Max Requests",
                        intervalSeconds: "Interval (seconds)",
                        message: "Messages",
                        post: "Posts",
                        register: "Registrations",
                        image: "Image Uploads",
                        proposal: "Proposals",
                        search: "Search",
                        importUserSettings: "Settings Import/Export",
                    },
                },
            },
```

- [ ] **Step 3: Add the new translation keys to `th.ts`**

Current (`admin.siteSettings.sections`, post-Task-6 state):
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                    moderation: {title: "การกลั่นกรอง"},
                    contentDefaults: {title: "ค่าเริ่มต้นเนื้อหา"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "ข้อมูลไซต์"},
                    registration: {title: "การลงทะเบียนและการเข้าถึง"},
                    moderation: {title: "การกลั่นกรอง"},
                    contentDefaults: {title: "ค่าเริ่มต้นเนื้อหา"},
                    rateLimits: {title: "ขีดจำกัดอัตราการใช้งาน"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-6 state — its last
entry, right before the closing of the whole `siteSettings` object):
```ts
                    defaultProposalSortType: {
                        label: "การเรียงข้อเสนอเริ่มต้น",
                        hot: "มาแรง",
                        top: "ยอดนิยม",
                        new: "ใหม่ล่าสุด",
                        old: "เก่าที่สุด",
                        controversial: "เป็นที่ถกเถียง",
                    },
                },
            },
```

Change to:
```ts
                    defaultProposalSortType: {
                        label: "การเรียงข้อเสนอเริ่มต้น",
                        hot: "มาแรง",
                        top: "ยอดนิยม",
                        new: "ใหม่ล่าสุด",
                        old: "เก่าที่สุด",
                        controversial: "เป็นที่ถกเถียง",
                    },
                    rateLimits: {
                        maxRequests: "จำนวนคำขอสูงสุด",
                        intervalSeconds: "ช่วงเวลา (วินาที)",
                        message: "ข้อความ",
                        post: "โพสต์",
                        register: "การลงทะเบียน",
                        image: "การอัปโหลดรูปภาพ",
                        proposal: "ข้อเสนอ",
                        search: "การค้นหา",
                        importUserSettings: "การนำเข้า/ส่งออกการตั้งค่า",
                    },
                },
            },
```

- [ ] **Step 4: Add the new translation keys to `vi.ts`**

Current (`admin.siteSettings.sections`, post-Task-6 state):
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                    moderation: {title: "Kiểm Duyệt"},
                    contentDefaults: {title: "Mặc Định Nội Dung"},
                },
```

Change to:
```ts
                sections: {
                    identity: {title: "Thông Tin Trang Web"},
                    registration: {title: "Đăng Ký & Truy Cập"},
                    moderation: {title: "Kiểm Duyệt"},
                    contentDefaults: {title: "Mặc Định Nội Dung"},
                    rateLimits: {title: "Giới Hạn Tần Suất"},
                },
```

Current (`admin.siteSettings.fields`, post-Task-6 state — its last
entry, right before the closing of the whole `siteSettings` object):
```ts
                    defaultProposalSortType: {
                        label: "Sắp Xếp Đề Xuất Mặc Định",
                        hot: "Nổi bật",
                        top: "Hàng đầu",
                        new: "Mới nhất",
                        old: "Cũ nhất",
                        controversial: "Gây tranh cãi",
                    },
                },
            },
```

Change to:
```ts
                    defaultProposalSortType: {
                        label: "Sắp Xếp Đề Xuất Mặc Định",
                        hot: "Nổi bật",
                        top: "Hàng đầu",
                        new: "Mới nhất",
                        old: "Cũ nhất",
                        controversial: "Gây tranh cãi",
                    },
                    rateLimits: {
                        maxRequests: "Số Yêu Cầu Tối Đa",
                        intervalSeconds: "Khoảng Thời Gian (giây)",
                        message: "Tin nhắn",
                        post: "Bài đăng",
                        register: "Đăng ký",
                        image: "Tải Ảnh Lên",
                        proposal: "Đề xuất",
                        search: "Tìm kiếm",
                        importUserSettings: "Nhập/Xuất Cài Đặt",
                    },
                },
            },
```

- [ ] **Step 5: Verify in the browser**

The Rate Limits section appears as the final card before the Save
button, with all 7 rows pre-filled with the site's actual current rate
limit values. Changing one pair (e.g. Post's max requests) and saving
persists only that change — the other 6 pairs are unaffected. Switching
locale changes every row label and both column headers in all three
languages.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/site-settings/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(admin): add the Rate Limits section to Site Settings, completing the page"
```

---

## After all tasks: whole-branch check

Once all 7 tasks are committed, before opening a PR:

- [ ] Run `npx tsc --noEmit` and confirm zero errors.
- [ ] Run `pnpm test:unit` and confirm it's still 157/157 (or more, if any
  new tests exist by then) passing.
- [ ] Run ESLint scoped to the touched files and confirm no new errors.
- [ ] Do one full manual pass on the Site Settings page — every item in
  the spec's "Testing" section — not just the per-task checks done in
  isolation. In particular: submit the form with every section touched
  at once (not just one field at a time, as the per-task checks did) and
  confirm all changes persist together correctly.
- [ ] Confirm `git status` is clean relative to the branch (no stray
  uncommitted files, no dirtied `tsconfig.tsbuildinfo`) before pushing.
