# Secure Chat Account Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the empty `/account-setting/manage` page real content — the
Secure Chat toggle the Flutter app already has and the backend just fixed —
carrying over Flutter's deliberately honest copy about what the encryption
does and does not do.

**Architecture:** Two missing fields added to the hand-maintained client
types, then one settings card on the existing page. The toggle updates the
user store optimistically, persists via `saveUserSettings`, and reverts if
the save fails.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, react-i18next
(en/th/vi), zustand (`useUserStore`), the `useHttpPut`-family hooks.

**Companion spec:** `docs/superpowers/specs/2026-08-17-account-settings-secure-chat-design.md`

## Global Constraints

- Touch only: `src/lib/108jobs-client/src/types/LocalUser.ts`,
  `src/lib/108jobs-client/src/types/SaveUserSettings.ts`,
  `src/app/[lang]/(profile)/account-setting/manage/page.tsx`,
  `src/containers/AccountSettingWrapper/index.tsx`,
  `src/translations/{en,th,vi}.ts`.
- **Never claim end-to-end encryption.** This is the point of the feature,
  not a stylistic note. Flutter's page documents why: the previous copy
  promised E2E, it was never true (the server holds the key so it can relay
  and moderate), and *"somebody could decide what to type on the strength of
  it."* No wording in the title, the toggle label, the body copy or any
  toast may imply the platform cannot read messages.
- **Rebuild the client package after editing anything under
  `src/lib/108jobs-client/src/`:**
  ```bash
  cd src/lib/108jobs-client && npm run build && cd -
  ```
  App code imports the package *name*, which resolves to `dist/` — without a
  rebuild `tsc` checks the stale build and accepts code contradicting your
  edit.
- Client type files use 2-space indentation; app code uses 4-space.
  Double-quoted strings.
- Mutation results go through `isSuccess`/`isFailed` from
  `@/services/HttpService`. These hooks resolve with a failed state instead
  of throwing, so a `try/catch` around `execute()` cannot catch a failure —
  it can only hide one.
- After each task: `npx tsc --noEmit` clean.

---

### Task 1: Add the two missing client fields

**Files:**
- Modify: `src/lib/108jobs-client/src/types/LocalUser.ts`
- Modify: `src/lib/108jobs-client/src/types/SaveUserSettings.ts`

**Interfaces:**
- Produces: `LocalUser.secureChatEnabled` (read by Task 2's toggle) and
  `SaveUserSettings.secureChatEnabled` (sent by Task 2's save).

Both exist on the backend and neither is in the web client. Confirmed
against `api-108jobs` `origin/main`: `local_user.secure_chat_enabled` is a
non-null `bool`, and `SaveUserSettings.secure_chat_enabled` is
`Option<bool>` — added by PR #233, whose commit message records that
`PUT /account/settings/save` previously accepted the field and silently
dropped it.

- [ ] **Step 1: Add the field to `LocalUser.ts`**

Append to the end of the `LocalUser` type, after `showPersonVotes`. It is
**required, not optional** — the backend column is non-null:

```ts
  /**
   * Whether this account's chat messages are encrypted in transit.
   *
   * Not end-to-end: 108jobs holds the key so it can relay and moderate.
   */
  secureChatEnabled: boolean;
```

- [ ] **Step 2: Add the field to `SaveUserSettings.ts`**

Append to the end of the `SaveUserSettings` type. Optional here, matching
`Option<bool>`:

```ts
  /**
   * Whether to encrypt this account's chat messages in transit.
   */
  secureChatEnabled?: boolean;
```

- [ ] **Step 3: Rebuild and verify**

```bash
cd src/lib/108jobs-client && npm run build && cd -
grep -n "secureChatEnabled" src/lib/108jobs-client/dist/types/LocalUser.d.ts src/lib/108jobs-client/dist/types/SaveUserSettings.d.ts
npx tsc --noEmit
```

Expected: both appear in the built `.d.ts` files, and `tsc` is clean.
Making `LocalUser.secureChatEnabled` required could surface errors anywhere
the app constructs a `LocalUser` literal — if it does, report the sites
rather than switching the field to optional to silence it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/108jobs-client/src/types/LocalUser.ts src/lib/108jobs-client/src/types/SaveUserSettings.ts
git commit -m "feat(client): add secureChatEnabled to LocalUser and SaveUserSettings"
```

---

### Task 2: Build the Secure Chat setting

**Files:**
- Modify: `src/app/[lang]/(profile)/account-setting/manage/page.tsx`
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts`

**Interfaces:**
- Consumes: Task 1's fields, `useUserStore` (`user`, `updateUser`),
  `useHttpPut("saveUserSettings")`.
- Produces: the finished page.

The page currently renders a header and nothing else.

- [ ] **Step 1: Add the translation keys to `en.ts`**

Inside the existing `accountManage` object, after `description`:

```ts
            secureChat: {
                title: "Secure Chat",
                toggleLabel: "Encrypt chat messages",
                toggleHint: "Applies to this account, on every device",
                bodyInTransit: "Messages are encrypted between your device and 108jobs, so nobody on the network in between can read them.",
                bodyNotE2e: "This is not end-to-end encryption: 108jobs holds the key and can read your messages, which is what lets us act on reports of abuse and scams.",
                enabled: "Message encryption enabled",
                disabled: "Message encryption disabled",
                saveError: "Couldn't save that. Please try again.",
            },
```

`bodyNotE2e` is the load-bearing sentence — do not soften or drop it.

- [ ] **Step 2: Add the same keys to `th.ts`** with real Thai text

```ts
            secureChat: {
                title: "แชทที่เข้ารหัส",
                toggleLabel: "เข้ารหัสข้อความแชท",
                toggleHint: "มีผลกับบัญชีนี้ในทุกอุปกรณ์",
                bodyInTransit: "ข้อความจะถูกเข้ารหัสระหว่างอุปกรณ์ของคุณกับ 108jobs ผู้อื่นบนเครือข่ายระหว่างทางจึงไม่สามารถอ่านได้",
                bodyNotE2e: "นี่ไม่ใช่การเข้ารหัสแบบต้นทางถึงปลายทาง (end-to-end): 108jobs เป็นผู้ถือกุญแจและสามารถอ่านข้อความของคุณได้ ซึ่งทำให้เราดำเนินการกับรายงานการฉ้อโกงและการละเมิดได้",
                enabled: "เปิดการเข้ารหัสข้อความแล้ว",
                disabled: "ปิดการเข้ารหัสข้อความแล้ว",
                saveError: "บันทึกไม่สำเร็จ กรุณาลองใหม่",
            },
```

- [ ] **Step 3: Add the same keys to `vi.ts`** with real Vietnamese text

```ts
            secureChat: {
                title: "Trò chuyện được mã hóa",
                toggleLabel: "Mã hóa tin nhắn trò chuyện",
                toggleHint: "Áp dụng cho tài khoản này trên mọi thiết bị",
                bodyInTransit: "Tin nhắn được mã hóa giữa thiết bị của bạn và 108jobs, nên không ai trên đường truyền có thể đọc được.",
                bodyNotE2e: "Đây không phải mã hóa đầu cuối: 108jobs giữ khóa và có thể đọc tin nhắn của bạn, điều này cho phép chúng tôi xử lý các báo cáo lạm dụng và lừa đảo.",
                enabled: "Đã bật mã hóa tin nhắn",
                disabled: "Đã tắt mã hóa tin nhắn",
                saveError: "Không thể lưu. Vui lòng thử lại.",
            },
```

- [ ] **Step 4: Build the page**

Replace the whole file. The toggle writes to the store first so it responds
immediately, then persists; a failed save puts the old value back rather
than leaving the switch showing a state the server never accepted.

```tsx
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { useHttpPut } from "@/hooks/api/http/useHttpPut";
import { isFailed, isSuccess } from "@/services/HttpService";
import { useUserStore } from "@/store/useUserStore";

export default function AccountManagePage() {
    const { t } = useTranslation();
    const { user, updateUser } = useUserStore();
    const [isSaving, setIsSaving] = useState(false);

    const { execute: saveUserSettings } = useHttpPut("saveUserSettings");

    const secureChatEnabled = user?.secureChatEnabled ?? false;

    const handleToggle = async () => {
        if (!user || isSaving) return;
        const next = !secureChatEnabled;

        // Optimistic: the switch should move on click, not after the
        // round-trip. Reverted below if the save fails.
        updateUser({ secureChatEnabled: next });
        setIsSaving(true);
        const res = await saveUserSettings({ secureChatEnabled: next });
        setIsSaving(false);

        if (isSuccess(res)) {
            toast.success(
                next
                    ? t("accountManage.secureChat.enabled")
                    : t("accountManage.secureChat.disabled"),
            );
        } else if (isFailed(res)) {
            updateUser({ secureChatEnabled: !next });
            toast.error(t("accountManage.secureChat.saveError"));
        }
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-md border border-border-primary p-6 space-y-8">
                {/* Header */}
                <div>
                    <h2 className="text-xl font-semibold text-black">
                        {t("accountManage.title")}
                    </h2>
                    <p className="text-sm text-gray-600">
                        {t("accountManage.description")}
                    </p>
                </div>

                {/* Secure Chat */}
                <div className="border rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                        {t("accountManage.secureChat.title")}
                    </h3>

                    <div className="flex justify-between items-center gap-4">
                        <label htmlFor="secure-chat-toggle" className="flex flex-col cursor-pointer">
                            <span className="text-sm font-medium text-gray-800">
                                {t("accountManage.secureChat.toggleLabel")}
                            </span>
                            <span className="text-xs text-gray-500">
                                {t("accountManage.secureChat.toggleHint")}
                            </span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                id="secure-chat-toggle"
                                type="checkbox"
                                className="sr-only peer"
                                checked={secureChatEnabled}
                                disabled={!user || isSaving}
                                onChange={handleToggle}
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-disabled:opacity-50 transition-colors duration-200 relative">
                                <span
                                    className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                                        secureChatEnabled ? "translate-x-5" : ""
                                    }`}
                                />
                            </div>
                        </label>
                    </div>

                    {/* What this does and does not protect against. The second
                        paragraph is deliberate: the platform holds the key. */}
                    <p className="text-xs text-gray-500">
                        {t("accountManage.secureChat.bodyInTransit")}
                    </p>
                    <p className="text-xs text-gray-500">
                        {t("accountManage.secureChat.bodyNotE2e")}
                    </p>
                </div>
            </div>
        </div>
    );
}
```

Check `react-toastify`'s call style in this file's neighbours before
committing — the page previously used `toast(msg, { type: "error" })`. If
`toast.success`/`toast.error` aren't used elsewhere in this app, match the
local convention instead.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/[lang]/(profile)/account-setting/manage/page.tsx"
```

Then in the browser at `/en/account-setting/manage`: the card renders with
both paragraphs, the switch reflects the saved value, clicking it moves it
immediately, and a reload shows the new value persisted. Confirm the
`PUT /account/settings/save` request body contains `{"secureChatEnabled": …}`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[lang]/(profile)/account-setting/manage/page.tsx" src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "feat(account): add the Secure Chat setting, matching the Flutter app

Carries over Flutter's copy decision: this is transit encryption, not
end-to-end, and the page says so."
```

---

### Task 3: Relabel the sidebar entry

**Files:**
- Modify: `src/containers/AccountSettingWrapper/index.tsx`
- Modify: `src/translations/en.ts`, `th.ts`, `vi.ts`

**Interfaces:**
- Consumes: Task 2. Produces nothing.

The entry reads "Consent management" and now points at a page that manages a
chat setting.

- [ ] **Step 1: Point the entry at a new key**

In `src/containers/AccountSettingWrapper/index.tsx` (~line 50):

```tsx
      { href: "/account-setting/manage", label: t("profileNavbar.consentManage"), icon: ShieldCheck },
```
becomes
```tsx
      { href: "/account-setting/manage", label: t("profileNavbar.settings"), icon: ShieldCheck },
```

Keep the `ShieldCheck` icon — it still fits a security setting.

- [ ] **Step 2: Add `profileNavbar.settings` in all three locales**

Beside the existing `consentManage` entry: `"Settings"` / `"การตั้งค่า"` /
`"Cài đặt"`.

Then check whether `profileNavbar.consentManage` is still referenced
anywhere:

```bash
grep -rn "consentManage" src/ --include="*.ts" --include="*.tsx"
```

If the only hits are the three translation files, remove the key from all
three. If anything else still uses it, leave it and report where.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
```

In the browser, the sidebar reads "Settings", and both other links to the
route — the profile dropdown (`src/components/Header/components/ProfileUser`)
and the privacy policy (`src/app/[lang]/content/privacy/page.tsx`) — still
reach the page.

```bash
git add src/containers/AccountSettingWrapper/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "i18n: the account-settings entry is Settings, not Consent management"
```

---

## After all tasks

- [ ] `npx tsc --noEmit` clean; `pnpm test:unit` still 157/157.
- [ ] `npx eslint` clean on touched files.
- [ ] Toggle on → reload → still on. Toggle off → reload → still off.
- [ ] Switch locale: title, toggle label, hint, **both** body paragraphs and
      the toasts are translated.
- [ ] Confirm no copy anywhere on the page claims end-to-end encryption.
- [ ] `git status` clean apart from intended changes — `tsconfig.tsbuildinfo`
      must not be committed.
