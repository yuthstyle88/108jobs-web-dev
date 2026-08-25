# Admin Dashboard Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 confirmed display bugs on the admin `dashboard` page — an
invisible UI element, a design-token bypass, dead translation keys leaking
raw key strings into the UI, untranslated backend enum values, a silent
all-zeros render when site data hasn't loaded, a card that misrepresents
synthesized data as a real event log, and a broken interpolation brace in
one locale.

**Architecture:** All fixes live in a single file,
`src/app/[lang]/admin/dashboard/page.tsx` (220 lines, already using
`useTranslation`/i18n throughout — unlike `manage-picture` in the prior
batch, this page needs no i18n bootstrap, only new/corrected keys), plus
the three locale files it draws from. No new components, no new
dependencies, no backend changes — the site-data fetch/retry fix reuses a
pattern (`callHttp("getSite")` → `isSuccess` → `setSiteRes`) already
proven in `manage-picture/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, react-i18next
(en/th/vi), zustand (`useSiteStore`), the generated `108heros-client` types.

## Global Constraints

- Touch only: `src/app/[lang]/admin/dashboard/page.tsx`,
  `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts`.
- No new npm dependencies.
- No backend changes — this plan is entirely frontend, read-only display
  fixes. Site config editing (`PUT /api/v4/site`) is explicitly out of
  scope, deferred to a separate follow-on batch.
- New translation keys go under the existing `dashboard.*` namespace,
  matching the established `admin.<page>.*`/`dashboard.*` convention.
- Double-quoted strings, 4-space indentation, matching each file's
  existing style.
- No component-test infrastructure exists for any of these 4 files —
  verify manually in the browser preview per each task's own steps.

---

### Task 1: Fix invisible event-indicator dots

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:187, 200`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`bg-blue` is not a valid Tailwind class (no bare, unshaded `blue` token
exists in this project's Tailwind config or in Tailwind's own default
palette) — both status dots currently render with zero background color.
`bg-primary` is the project's existing brand-color token, already used
elsewhere for informational indicators.

- [ ] **Step 1: Fix both occurrences**

Current (line 187, inside the "Admin account active" event row):
```tsx
                                <div className="w-2 h-2 bg-blue rounded-full"></div>
```

Current (line 200, inside the "posts published" event row):
```tsx
                                    <div className="w-2 h-2 bg-blue rounded-full"></div>
```

Change both to (`bg-blue` → `bg-primary`, indentation unchanged):
```tsx
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
```
```tsx
                                    <div className="w-2 h-2 bg-primary rounded-full"></div>
```

- [ ] **Step 2: Verify in the browser**

Load `/en/admin/dashboard` as an admin — both indicator dots in the
bottom card show a solid color (the brand primary color), not an empty
circle.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx"
git commit -m "fix(admin): dashboard event dots use a real color instead of the invalid bg-blue class"
```

---

### Task 2: Registration badge uses design tokens

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:79` (post-Task-1 state
  — this task's own line is unaffected by Task 1's edits)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

Replaces hardcoded `text-green-700`/`text-red-800` with the `success`/
`destructive` design tokens the systemic-fixes batch (PR #37) established
(`tailwind.config.ts` maps `text-success`/`text-destructive` to
`var(--success)`/`var(--destructive)`).

- [ ] **Step 1: Swap the hardcoded colors for design tokens**

Current (lines 78-82):
```tsx
                            <span
                                className={localSite?.registrationMode === "Open" ? "text-green-700" : "text-red-800"}
                            >
                {localSite?.registrationMode ?? t("common.unknown")}
              </span>
```

Change to (only the className ternary's two string literals change — the
`t("common.unknown")` call on the next line is fixed separately in Task 3,
leave it exactly as-is here):
```tsx
                            <span
                                className={localSite?.registrationMode === "Open" ? "text-success" : "text-destructive"}
                            >
                {localSite?.registrationMode ?? t("common.unknown")}
              </span>
```

- [ ] **Step 2: Verify in the browser**

The "Registration" badge in the top info bar shows green text when the
site's registration mode is "Open," and red/destructive-colored text
otherwise — same red/green as the rest of the admin UI's success/error
states (e.g. compare against a toast or badge on another admin page).

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx"
git commit -m "fix(admin): dashboard registration badge uses the success/destructive design tokens"
```

---

### Task 3: Fix dead `common.*` translation keys

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:81, 207` (post-Task-2
  state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts` (each file's `dashboard.siteInfo` and
  `dashboard.events` objects)

**Interfaces:**
- Consumes: nothing new.
- Produces: `dashboard.siteInfo.unknown` and `dashboard.events.launch` —
  new translation keys. Task 5 adds sibling keys to the same
  `dashboard.siteInfo` object; Task 6 adds a sibling `dashboard.loadError`
  object; Task 7 edits `dashboard.events.title`/`adminActive` (unrelated
  keys in the same object) and removes two different, currently-unused
  keys (`dashboard.events.siteRefreshed`, `dashboard.events.never`) — none
  of those tasks touch `dashboard.events.launch`, added here.

`t("common.unknown")` and `t("common.launch")` reference a `common`
namespace that does not exist anywhere in this codebase — i18next's
missing-key fallback renders the literal key string in the UI.

- [ ] **Step 1: Fix the two call sites in `page.tsx`**

Current (line 81, inside the registration badge — post-Task-2 state):
```tsx
                {localSite?.registrationMode ?? t("common.unknown")}
```

Change to:
```tsx
                {localSite?.registrationMode ?? t("dashboard.siteInfo.unknown")}
```

Current (lines 205-208):
```tsx
                                        <p className="text-xs">
                                            {t("dashboard.events.sinceLaunch", {
                                                date: localSite?.publishedAt ? format(new Date(localSite.publishedAt), "PPP") : t("common.launch")
                                            })}
                                        </p>
```

Change to:
```tsx
                                        <p className="text-xs">
                                            {t("dashboard.events.sinceLaunch", {
                                                date: localSite?.publishedAt ? format(new Date(localSite.publishedAt), "PPP") : t("dashboard.events.launch")
                                            })}
                                        </p>
```

- [ ] **Step 2: Add the two new keys to `en.ts`**

Current (`dashboard.siteInfo`, the object's last entry):
```ts
                enabled: "Enabled ({{difficulty}})",
                disabled: "Disabled",
            },
```

Change to:
```ts
                enabled: "Enabled ({{difficulty}})",
                disabled: "Disabled",
                unknown: "Unknown",
            },
```

Current (`dashboard.events`, the `sinceLaunch` line):
```ts
                sinceLaunch: "Since {{date}}",
```

Change to:
```ts
                sinceLaunch: "Since {{date}}",
                launch: "Launch",
```

- [ ] **Step 3: Add the two new keys to `th.ts`**

Current (`dashboard.siteInfo`, the object's last entry):
```ts
                enabled: "เปิดใช้งาน ({{difficulty}})",
                disabled: "ปิดใช้งาน",
            },
```

Change to:
```ts
                enabled: "เปิดใช้งาน ({{difficulty}})",
                disabled: "ปิดใช้งาน",
                unknown: "ไม่ทราบ",
            },
```

Current (`dashboard.events`, the `sinceLaunch` line):
```ts
                sinceLaunch: "ตั้งแต่ {{date}}",
```

Change to:
```ts
                sinceLaunch: "ตั้งแต่ {{date}}",
                launch: "เปิดตัว",
```

- [ ] **Step 4: Add the two new keys to `vi.ts`**

Current (`dashboard.siteInfo`, the object's last entry):
```ts
                enabled: "Đã bật ({{difficulty}})",
                disabled: "Đã tắt",
            },
```

Change to:
```ts
                enabled: "Đã bật ({{difficulty}})",
                disabled: "Đã tắt",
                unknown: "Không rõ",
            },
```

Current (`dashboard.events`, the `sinceLaunch` line):
```ts
                sinceLaunch: "Từ {{date}}",
```

Change to:
```ts
                sinceLaunch: "Từ {{date}}",
                launch: "Ra mắt",
```

- [ ] **Step 5: Verify in the browser**

No literal `common.unknown` or `common.launch` text appears anywhere on
the dashboard, in any of the 3 locales. (The `sinceLaunch` fallback line
only renders once `localSite.posts > 0` and `localSite.publishedAt` is
falsy — a real site with a launch date won't show this fallback text at
all; harder to trigger live, so confirming via careful code read of the
final file is acceptable if a live repro isn't practical this session.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): dashboard no longer references the nonexistent common.* translation namespace"
```

---

### Task 4: Remove stray broken className

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:68` (post-Task-3 state
  — unaffected by Task 3's edits, different line)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`tex` is not a real Tailwind class — dead, meaningless fragment.

- [ ] **Step 1: Drop the stray text**

Current (lines 65-69):
```tsx
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4"/>
                            <span
                                className="font-medium tex">{t("dashboard.siteInfo.instance")}:</span> {localSite?.name ?? "108heros"}
                        </div>
```

Change to:
```tsx
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4"/>
                            <span
                                className="font-medium">{t("dashboard.siteInfo.instance")}:</span> {localSite?.name ?? "108heros"}
                        </div>
```

- [ ] **Step 2: Verify in the browser**

The "Instance" label in the top info bar renders identically to before
(the stray class had no visual effect either way, since `tex` isn't a
real utility) — this is a cleanliness fix, not a visual one. Confirm via
code read that the className is now exactly `"font-medium"`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx"
git commit -m "fix(admin): remove stray dead className fragment from dashboard instance label"
```

---

### Task 5: Translate raw backend enum values

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:1-20, 78-97`
  (post-Task-4 state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts` (each file's `dashboard.siteInfo` object)

**Interfaces:**
- Consumes: `RegistrationMode` type, exported from `108heros-client`
  (`export type RegistrationMode = "Closed" | "RequireApplication" |
  "Open";`). `dashboard.siteInfo.unknown` (Task 3).
- Produces: nothing later tasks depend on.

`localSite?.registrationMode` (a typed enum) and
`localSite?.captchaDifficulty` (a raw `string`, e.g. `"easy"`/`"medium"`/
`"hard"`) are currently interpolated directly into the page with no
translation layer.

- [ ] **Step 1: Import `RegistrationMode` and add two lookup maps**

Current (lines 1-9, the full top of the file):
```tsx
"use client";

import {StatsCard} from "@/components/ui/StatsCard";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import {Users, MessageSquare, Globe, Activity, Shield, CheckCircle, AlertTriangle, Settings} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useSiteStore} from "@/store/useSiteStore";
import {format} from "date-fns";
import {useTranslation} from "react-i18next";
```

Change to:
```tsx
"use client";

import {StatsCard} from "@/components/ui/StatsCard";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import {Users, MessageSquare, Globe, Activity, Shield, CheckCircle, AlertTriangle, Settings} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useSiteStore} from "@/store/useSiteStore";
import {format} from "date-fns";
import {useTranslation} from "react-i18next";
import {RegistrationMode} from "108heros-client";
```

Current (lines 11-20, the component's opening lines):
```tsx
const DashboardPage = () => {
    const {t} = useTranslation();
    const {siteRes} = useSiteStore();

    const localSite = siteRes?.siteView?.localSite;
    const rateLimit = siteRes?.siteView?.localSiteRateLimit;
    const admins = siteRes?.admins || [];
    const version = siteRes?.version;

    const siteName = localSite?.name ?? "108Heros";
```

Change to (adds the two lookup maps right after `siteName`; `localSite`/
`rateLimit`/`admins`/`version` are unchanged):
```tsx
const DashboardPage = () => {
    const {t} = useTranslation();
    const {siteRes} = useSiteStore();

    const localSite = siteRes?.siteView?.localSite;
    const rateLimit = siteRes?.siteView?.localSiteRateLimit;
    const admins = siteRes?.admins || [];
    const version = siteRes?.version;

    const siteName = localSite?.name ?? "108Heros";

    const registrationModeLabels: Record<RegistrationMode, string> = {
        Open: t("dashboard.siteInfo.registrationMode.open"),
        Closed: t("dashboard.siteInfo.registrationMode.closed"),
        RequireApplication: t("dashboard.siteInfo.registrationMode.requireApplication"),
    };

    const captchaDifficultyLabels: Record<string, string> = {
        easy: t("dashboard.siteInfo.captchaDifficulty.easy"),
        medium: t("dashboard.siteInfo.captchaDifficulty.medium"),
        hard: t("dashboard.siteInfo.captchaDifficulty.hard"),
    };
```

- [ ] **Step 2: Use the lookup maps at both render sites**

Current (lines 78-82, post-Task-2/3 state — the registration badge):
```tsx
                            <span
                                className={localSite?.registrationMode === "Open" ? "text-success" : "text-destructive"}
                            >
                {localSite?.registrationMode ?? t("dashboard.siteInfo.unknown")}
              </span>
```

Change to (the fallback logic changes from "value is missing" to "value
is missing OR unrecognized," using the lookup map instead of the raw
value):
```tsx
                            <span
                                className={localSite?.registrationMode === "Open" ? "text-success" : "text-destructive"}
                            >
                {localSite?.registrationMode ? registrationModeLabels[localSite.registrationMode] : t("dashboard.siteInfo.unknown")}
              </span>
```

Current (lines 91-97, the captcha row):
```tsx
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4"/>
                            <span className="font-medium">{t("dashboard.siteInfo.captcha")}:</span>{" "}
                            {localSite?.captchaEnabled
                                ? t("dashboard.siteInfo.enabled", {difficulty: localSite.captchaDifficulty ?? "easy"})
                                : t("dashboard.siteInfo.disabled")}
                        </div>
```

Change to:
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

- [ ] **Step 3: Add the new keys to `en.ts`**

Current (`dashboard.siteInfo`, post-Task-3 state — the object's last
entry):
```ts
                enabled: "Enabled ({{difficulty}})",
                disabled: "Disabled",
                unknown: "Unknown",
            },
```

Change to:
```ts
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

- [ ] **Step 4: Add the new keys to `th.ts`**

Current (`dashboard.siteInfo`, post-Task-3 state — the object's last
entry):
```ts
                enabled: "เปิดใช้งาน ({{difficulty}})",
                disabled: "ปิดใช้งาน",
                unknown: "ไม่ทราบ",
            },
```

Change to:
```ts
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

- [ ] **Step 5: Add the new keys to `vi.ts`**

Current (`dashboard.siteInfo`, post-Task-3 state — the object's last
entry):
```ts
                enabled: "Đã bật ({{difficulty}})",
                disabled: "Đã tắt",
                unknown: "Không rõ",
            },
```

Change to:
```ts
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

- [ ] **Step 6: Verify in the browser**

Switch between all three locales — the "Registration" badge and the
"Captcha" row both show real, translated words ("Open"/"Đóng"/"ง่าย"
etc.), never a raw English enum string, in every locale.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): dashboard translates registrationMode and captchaDifficulty instead of showing raw backend values"
```

---

### Task 6: Add a real empty/error state when site data hasn't loaded

**Files:**
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:1-20, end of file`
  (post-Task-5 state)
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts` (each file's `dashboard` object)

**Interfaces:**
- Consumes: `callHttp`, `isSuccess` from `@/services/HttpService` (already
  used this exact way in `manage-picture/page.tsx:110-113`:
  `const refreshed = await callHttp("getSite"); if (isSuccess(refreshed))
  { setSiteRes(refreshed.data); }`).
- Produces: nothing later tasks depend on.

`siteRes` is populated once at app-hydration time
(`UserServiceContext.tsx`), not fetched by this page. If it's ever `null`
when the dashboard renders, every field currently falls back to `0`/
`"N/A"` with no indication anything is wrong.

- [ ] **Step 1: Add the new imports and retry state**

Current (lines 1-9, post-Task-5 state — the full top of the file):
```tsx
"use client";

import {StatsCard} from "@/components/ui/StatsCard";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import {Users, MessageSquare, Globe, Activity, Shield, CheckCircle, AlertTriangle, Settings} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useSiteStore} from "@/store/useSiteStore";
import {format} from "date-fns";
import {useTranslation} from "react-i18next";
import {RegistrationMode} from "108heros-client";
```

Change to:
```tsx
"use client";

import {useState} from "react";
import {StatsCard} from "@/components/ui/StatsCard";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import {Users, MessageSquare, Globe, Activity, Shield, CheckCircle, AlertTriangle, Settings} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useSiteStore} from "@/store/useSiteStore";
import {format} from "date-fns";
import {useTranslation} from "react-i18next";
import {RegistrationMode} from "108heros-client";
import {callHttp, isSuccess} from "@/services/HttpService";
```

Current (line 13, post-Task-5 state):
```tsx
    const {siteRes} = useSiteStore();
```

Change to:
```tsx
    const {siteRes, setSiteRes} = useSiteStore();
    const [retrying, setRetrying] = useState(false);
```

- [ ] **Step 2: Add the retry handler and the early-return empty state**

Add this new function right after the `captchaDifficultyLabels` block
(added in Task 5) and before the `stats` array declaration:
```tsx
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
                    <p className="text-lg font-medium">{t("dashboard.loadError.title")}</p>
                    <p className="text-sm max-w-md">{t("dashboard.loadError.description")}</p>
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="px-4 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                    >
                        {retrying ? t("dashboard.loadError.retrying") : t("dashboard.loadError.retry")}
                    </button>
                </div>
            </AdminLayout>
        );
    }
```

This is a plain early return, placed after all the component's other hook
calls (`useTranslation`, `useSiteStore`, `useState`) so React's
rules-of-hooks are respected — no hook is called after this conditional.

- [ ] **Step 3: Add the new keys to `en.ts`**

Current (`dashboard.siteInfo`, post-Task-5 state — the object's closing
brace, immediately followed by `stats:`):
```ts
                captchaDifficulty: {
                    easy: "Easy",
                    medium: "Medium",
                    hard: "Hard",
                },
            },
            stats: {
```

Change to (adds a new sibling `loadError` object to `dashboard`, right
after `siteInfo` closes):
```ts
                captchaDifficulty: {
                    easy: "Easy",
                    medium: "Medium",
                    hard: "Hard",
                },
            },
            loadError: {
                title: "Unable to load site information",
                description: "Something went wrong loading this site's configuration.",
                retry: "Retry",
                retrying: "Retrying…",
            },
            stats: {
```

- [ ] **Step 4: Add the new keys to `th.ts`**

Current (`dashboard.siteInfo`, post-Task-5 state — the object's closing
brace, immediately followed by `stats:`):
```ts
                captchaDifficulty: {
                    easy: "ง่าย",
                    medium: "ปานกลาง",
                    hard: "ยาก",
                },
            },
            stats: {
```

Change to:
```ts
                captchaDifficulty: {
                    easy: "ง่าย",
                    medium: "ปานกลาง",
                    hard: "ยาก",
                },
            },
            loadError: {
                title: "ไม่สามารถโหลดข้อมูลไซต์ได้",
                description: "เกิดข้อผิดพลาดขณะโหลดการตั้งค่าของไซต์นี้",
                retry: "ลองใหม่",
                retrying: "กำลังลองใหม่…",
            },
            stats: {
```

- [ ] **Step 5: Add the new keys to `vi.ts`**

Current (`dashboard.siteInfo`, post-Task-5 state — the object's closing
brace, immediately followed by `stats:`):
```ts
                captchaDifficulty: {
                    easy: "Dễ",
                    medium: "Trung bình",
                    hard: "Khó",
                },
            },
            stats: {
```

Change to:
```ts
                captchaDifficulty: {
                    easy: "Dễ",
                    medium: "Trung bình",
                    hard: "Khó",
                },
            },
            loadError: {
                title: "Không thể tải thông tin trang web",
                description: "Đã xảy ra lỗi khi tải cấu hình của trang web này.",
                retry: "Thử lại",
                retrying: "Đang thử lại…",
            },
            stats: {
```

- [ ] **Step 6: Verify**

Live reproduction of `localSite === null` isn't practical without
disrupting the normal hydration flow (no admin auth session is available
this session either, per the rest of this batch's testing constraints).
Verify instead via careful code read: confirm `useState` is imported and
called before the early return, confirm the early return happens after
every hook call (no hooks below it), confirm `handleRetry` matches
`manage-picture`'s already-proven `callHttp("getSite")` →
`isSuccess`/`setSiteRes` pattern exactly, and confirm `npx tsc --noEmit`
shows no new errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[lang]/admin/dashboard/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): dashboard shows a real error state with retry instead of silent zeros when site data hasn't loaded"
```

---

### Task 7: Relabel "Recent System Events" as "Site Summary"

**Files:**
- Modify: `src/translations/en.ts`, `src/translations/th.ts`,
  `src/translations/vi.ts` (each file's `dashboard.events` object)

**Interfaces:**
- Consumes: nothing new. No `page.tsx` change is needed for this task —
  `page.tsx` already calls `t("dashboard.events.title")` and
  `t("dashboard.events.adminActive", {name: ...})` (unchanged key names);
  only the translated VALUES under those existing keys change.
- Produces: nothing later tasks depend on.

The card presents two lines as if they were a timestamped activity log,
but both are synthesized from existing site-summary data (the first
admin's name, the total post count) — not real, timestamped events. This
task corrects the framing without changing what data is shown.

- [ ] **Step 1: Update `en.ts`**

Current (`dashboard.events`, post-Task-3/6 state):
```ts
            events: {
                title: "Recent System Events",
                siteRefreshed: "Site refreshed successfully",
                adminActive: "Admin account active: @{name}",
                postsPublished: "{{count}} posts published",
                sinceLaunch: "Since {{date}}",
                launch: "Launch",
                never: "Never",
                instanceId: "Instance ID: {{id}}",
            },
```

Change to (relabels `title`/`adminActive`, drops the unused
`siteRefreshed` and `never` keys, everything else unchanged):
```ts
            events: {
                title: "Site Summary",
                adminActive: "Admin on record: @{name}",
                postsPublished: "{{count}} posts published",
                sinceLaunch: "Since {{date}}",
                launch: "Launch",
                instanceId: "Instance ID: {{id}}",
            },
```

- [ ] **Step 2: Update `th.ts`**

Current (`dashboard.events`, post-Task-3/6 state):
```ts
            events: {
                title: "เหตุการณ์ระบบล่าสุด",
                siteRefreshed: "รีเฟรชไซต์สำเร็จ",
                adminActive: "บัญชีแอดมินที่ใช้งาน: @{{name}}",
                postsPublished: "โพสต์ {{count}} รายการ",
                sinceLaunch: "ตั้งแต่ {{date}}",
                launch: "เปิดตัว",
                never: "ไม่เคย",
                instanceId: "ID อินสแตนซ์: {{id}}",
            },
```

Change to:
```ts
            events: {
                title: "สรุปข้อมูลไซต์",
                adminActive: "แอดมินที่บันทึกไว้: @{{name}}",
                postsPublished: "โพสต์ {{count}} รายการ",
                sinceLaunch: "ตั้งแต่ {{date}}",
                launch: "เปิดตัว",
                instanceId: "ID อินสแตนซ์: {{id}}",
            },
```

- [ ] **Step 3: Update `vi.ts`**

Current (`dashboard.events`, post-Task-3/6 state):
```ts
            events: {
                title: "Sự kiện hệ thống gần đây",
                siteRefreshed: "Làm mới trang thành công",
                adminActive: "Tài khoản admin đang hoạt động: @{{name}}",
                postsPublished: "{{count}} bài đã đăng",
                sinceLaunch: "Từ {{date}}",
                launch: "Ra mắt",
                never: "Chưa từng",
                instanceId: "ID hệ thống: {{id}}",
            },
```

Change to:
```ts
            events: {
                title: "Tóm tắt trang web",
                adminActive: "Admin được ghi nhận: @{{name}}",
                postsPublished: "{{count}} bài đã đăng",
                sinceLaunch: "Từ {{date}}",
                launch: "Ra mắt",
                instanceId: "ID hệ thống: {{id}}",
            },
```

- [ ] **Step 4: Verify in the browser**

The card previously titled "Recent System Events" now reads "Site
Summary" (or the equivalent Thai/Vietnamese copy) in all three locales,
and the admin-name line reads "Admin on record: @name" (or equivalent)
instead of "Admin account active: @name."

- [ ] **Step 5: Commit**

```bash
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): relabel dashboard's synthesized site-summary card honestly instead of implying a real event log"
```

---

### Task 8: Fix broken `{minutes}` interpolation in `vi.ts`

**Files:**
- Modify: `src/translations/vi.ts` (`dashboard.limits` object)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing later tasks depend on.

`dashboard.limits.perMinute` uses single-brace `{minutes}` in `vi.ts`
while `en.ts` and `th.ts` both correctly use double-brace `{{minutes}}` —
i18next needs double braces to interpolate; single braces render as
literal text. The call site (`page.tsx:147-149`) already passes a
`{minutes: ...}` interpolation object correctly — only this one string is
wrong.

- [ ] **Step 1: Fix the brace syntax**

Current (`dashboard.limits`):
```ts
                perMinute: "bài / {minutes} phút",
```

Change to:
```ts
                perMinute: "bài / {{minutes}} phút",
```

- [ ] **Step 2: Verify in the browser**

Switch to the Vietnamese locale — the Post Rate Limit card's second line
shows a real number (e.g. "bài / 10 phút"), not the literal text "bài /
{minutes} phút".

- [ ] **Step 3: Commit**

```bash
git add src/translations/vi.ts
git commit -m "fix(admin): dashboard's Vietnamese post-rate-limit text actually interpolates the minute count"
```

---

## After all tasks: whole-branch check

Once all 8 tasks are committed, before opening a PR:

- [ ] Run `npx tsc --noEmit` and confirm no new errors beyond the 3 known
  pre-existing, unrelated `EnsureSharedKeyBootstrap` errors.
- [ ] Run `pnpm test:unit` and confirm it's still 157/157 (or more, if any
  new tests exist by then) passing.
- [ ] Run ESLint scoped to the 4 touched files and confirm no new errors.
- [ ] Do one full manual pass on the dashboard page — every item in the
  spec's "Testing" section — not just the per-task checks done in
  isolation.
- [ ] Confirm `git status` is clean relative to the branch (no stray
  uncommitted files, no dirtied `tsconfig.tsbuildinfo`) before pushing.
