# Password Login (alongside phone+OTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password-login option to `/login`, reachable via a button next to the existing "Sign in with Google" button, using the already-working `loginWithIdentityPlatform` endpoint that no current UI calls.

**Architecture:** Two new pieces — a shared `completeSignIn` helper extracted out of `PhoneOtpAuthForm` (so both login paths redirect identically), and a new `PasswordLoginForm` component, sibling to `PhoneOtpAuthForm` rather than a branch inside it. `PhoneOtpAuthForm` gains one optional prop for the toggle button; `login/page.tsx` gains a small `authMode` state to swap between the two forms inside the existing `AuthFormContainer`. No backend changes.

**Tech Stack:** Next.js App Router, react-hook-form + zod, `useHttpPost` (the app's standard typed-mutation hook over `HttpService`/`Api108Jobs`), i18next, lucide-react icons.

## Global Constraints

- No backend changes. `Api108Jobs.loginWithIdentityPlatform(form: Login)` (`src/lib/108jobs-client/src/http.ts`) and its request/response types (`src/lib/108jobs-client/src/types/Login.ts`, `IdentityPlatformLoginResponse.ts`) already exist and are already generated — do not hand-edit anything under `src/lib/108jobs-client/`.
- Password-based **registration** and a **forgot-password** flow are explicitly out of scope (see spec, `docs/superpowers/specs/2026-08-14-admin-password-login-design.md`). Do not add either.
- Accounts with TOTP 2FA enabled (`Login.totp2faToken`) are not supported by this form in v1 — do not build a 2FA input.
- **Testing approach for this feature deviates from the standard TDD step template**, and this is intentional, not a shortcut: no component-level tests exist anywhere under `src/components/Authentication/` today (confirmed during brainstorming), and the codebase has no established pattern for mocking `UserService.Instance`'s cookie/refresh side effects or `window.location.href` navigation in a unit test. Inventing one for this feature alone would add fragile, one-off test infrastructure for marginal value. Each task's verification is `tsc --noEmit` + `eslint` (must be clean, matching every other change in this codebase) plus a manual browser check — the same testing strategy already used for every other change in this area (`PhoneOtpAuthForm` itself has none).
- Follow the existing code style in every file touched: no semicolon-free style, double-space-free — just match what's already there (this codebase is not auto-formatted; read the surrounding code before editing).

---

## Task 1: Extract `completeSignIn` into a shared helper

**Files:**
- Create: `src/services/authRedirect.ts`
- Modify: `src/components/Authentication/PhoneOtpAuthForm/index.tsx:76-102`, `:180-197`

**Interfaces:**
- Produces: `completeSignIn(accessToken: string, refreshToken: string | undefined, redirectUrl: string): Promise<void>` — exported from `src/services/authRedirect.ts`. Task 2's `PasswordLoginForm` calls this directly.

This is a pure code move — no behavior change. `PhoneOtpAuthForm`'s existing `completeSignIn` becomes a thin local wrapper (`finishSignIn`) that binds `redirectUrl` and calls the shared function, so its two existing call sites don't need to change their call shape.

- [ ] **Step 1: Create the shared helper**

Create `src/services/authRedirect.ts`:

```ts
import {jwtDecode} from "jwt-decode";
import {UserService} from "@/services";
import {isAdminClaims, Claims} from "@/services/UserService";

// Shared by every login form: persist the session, then route based on
// whether the token carries the admin role -- admins always land on the
// admin dashboard regardless of which form they signed in through.
export async function completeSignIn(
    accessToken: string,
    refreshToken: string | undefined,
    redirectUrl: string,
): Promise<void> {
    await UserService.Instance.login(accessToken, refreshToken);
    const claims = jwtDecode<Claims>(accessToken);
    if (isAdminClaims(claims)) {
        window.location.href = "/admin/dashboard";
        return;
    }
    window.location.href = redirectUrl;
}
```

- [ ] **Step 2: Update `PhoneOtpAuthForm` to use it**

In `src/components/Authentication/PhoneOtpAuthForm/index.tsx`:

Replace the import block's `jwtDecode`/`isAdminClaims`/`Claims` imports (currently used only by the local `completeSignIn`) with an import of the shared helper. Change:

```ts
import {jwtDecode} from "jwt-decode";
import {isAdminClaims, Claims} from "@/services/UserService";
```

to:

```ts
import {completeSignIn} from "@/services/authRedirect";
```

(`UserService` itself, imported separately on line 10, stays — it's still used elsewhere in this file.)

Replace the local `completeSignIn` (lines 76-85):

```ts
    const completeSignIn = useCallback(async (accessToken: string, refreshToken?: string) => {
            await UserService.Instance.login(accessToken, refreshToken);
            const claims = jwtDecode<Claims>(accessToken);
            if (isAdminClaims(claims)) {
                window.location.href = "/admin/dashboard";
                return;
            }
            window.location.href = redirectUrl;
        },
        [redirectUrl]);
```

with:

```ts
    const finishSignIn = useCallback(
        (accessToken: string, refreshToken?: string) => completeSignIn(accessToken, refreshToken, redirectUrl),
        [redirectUrl]);
```

Update the two call sites: `attemptPasskeyLogin` (around line 100, `await completeSignIn(res.data.accessToken, res.data.refreshToken);`) becomes `await finishSignIn(res.data.accessToken, res.data.refreshToken);`, and its `useCallback` dependency array (`[completeSignIn, t]`, line 102) becomes `[finishSignIn, t]`. `onSubmitCode` (around line 196, `await completeSignIn(login.accessToken, login.refreshToken);`) becomes `await finishSignIn(login.accessToken, login.refreshToken);`.

- [ ] **Step 3: Verify**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/services/authRedirect.ts src/components/Authentication/PhoneOtpAuthForm/index.tsx
```
Expected: no new errors (the pre-existing unrelated `EnsureSharedKeyBootstrap` typecheck errors and `any`-type eslint warnings elsewhere in the file are expected and not caused by this change).

Then in the browser preview: log in via phone+OTP as before. Confirm it still redirects to `/admin/dashboard` for an admin account, or to `/` (or the `redirect` query param) otherwise — identical to before this change, since this step only moved code.

- [ ] **Step 4: Commit**

```bash
git add src/services/authRedirect.ts src/components/Authentication/PhoneOtpAuthForm/index.tsx
git commit -m "refactor(auth): extract completeSignIn into a shared helper"
```

---

## Task 2: Build `PasswordLoginForm`

**Files:**
- Create: `src/components/Authentication/PasswordLoginForm/index.tsx`
- Modify: `src/translations/en.ts` (add 2 keys to the `authen` namespace)

**Interfaces:**
- Consumes: `completeSignIn(accessToken, refreshToken, redirectUrl)` from Task 1 (`@/services/authRedirect`).
- Produces: `PasswordLoginForm` — a self-contained React component, no props. Task 3 renders it directly: `<PasswordLoginForm/>`.

Not reachable from any page yet — Task 3 wires it in. Verification here is limited to typecheck/lint; full interactive verification happens in Task 3 once it's actually mounted.

- [ ] **Step 1: Add the two missing translation keys**

Everything else this form needs already exists in `src/translations/en.ts`'s `authen` namespace (`labelUsernameOrEmail`, `placeholderUsernameOrEmail`, `labelPassword`, `placeholderPassword`, `apiErrorState` — leftover from the pre-OTP-migration password form, never removed) plus `global.labelLoginButton` for the submit button text. Add these two new ones, alongside the existing `linkCreateAccount` key in the `authen` block (`src/translations/en.ts`, inside the `authen: { ... }` object that starts around line 384):

```ts
            buttonLoginPassword: "Log in with a password",
            linkBackToPhoneLogin: "Back to phone login",
```

(`th.ts`/`vi.ts` don't need matching keys right now — i18next's `fallbackLng: ["en"]` config, `src/services/I18NextService.ts:182`, means a missing key falls back to the English text rather than rendering blank or a raw key. A real Thai/Vietnamese translation can follow later.)

- [ ] **Step 2: Create the component**

Create `src/components/Authentication/PasswordLoginForm/index.tsx`:

```tsx
"use client";
import LoadingCircle from "@/components/Common/Loading/LoadingCircle";
import {CustomInput} from "@/components/ui/InputField";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useState} from "react";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "next/navigation";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {isSuccess} from "@/services/HttpService";
import {completeSignIn} from "@/services/authRedirect";
import {resolveApiErrorMessage} from "@/utils/errorMessage";

const passwordLoginSchema = z.object({
    usernameOrEmail: z.string().min(1),
    password: z.string().min(1),
});

export const PasswordLoginForm: React.FC = () => {
    const {t} = useTranslation();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const [apiError, setApiError] = useState<string | null>(null);

    const form = useForm<z.infer<typeof passwordLoginSchema>>({
        resolver: zodResolver(passwordLoginSchema),
        mode: "onChange",
    });

    const {execute: login} = useHttpPost("loginWithIdentityPlatform");

    const onSubmit = form.handleSubmit(async (data) => {
        setApiError(null);
        const res = await login(data);
        if (!isSuccess(res)) {
            setApiError(resolveApiErrorMessage(res.err, t, {fallback: t("authen.apiErrorState")}));
            return;
        }
        await completeSignIn(res.data.accessToken, res.data.refreshToken, redirectUrl);
    });

    const errors = form.formState.errors;

    return (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {apiError && (
                <p className="text-red-500 text-sm text-center mb-4">
                    {apiError}
                </p>
            )}

            <CustomInput
                label={t("authen.labelUsernameOrEmail")}
                type="text"
                name="usernameOrEmail"
                autoComplete="username"
                placeholder={t("authen.placeholderUsernameOrEmail")}
                register={form.register("usernameOrEmail")}
                error={errors.usernameOrEmail?.message}
            />

            <CustomInput
                label={t("authen.labelPassword")}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder={t("authen.placeholderPassword")}
                register={form.register("password")}
                error={errors.password?.message}
            />

            <div className="text-center">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={form.formState.isSubmitting}
                >
                    {form.formState.isSubmitting ? <LoadingCircle/> : t("global.labelLoginButton")}
                </button>
            </div>
        </form>
    );
};
```

No back-link inside this component — Task 3 wires `AuthFormContainer`'s existing `onBack` prop (an arrow button in the container's own header) to return to OTP, so there's no need for a second, duplicate back affordance inside the form itself.

- [ ] **Step 3: Verify**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/components/Authentication/PasswordLoginForm/index.tsx src/translations/en.ts
```
Expected: no new errors. (This component isn't mounted anywhere yet, so there's nothing to click through until Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/components/Authentication/PasswordLoginForm/index.tsx src/translations/en.ts
git commit -m "feat(auth): add PasswordLoginForm component"
```

---

## Task 3: Wire the toggle into `PhoneOtpAuthForm` and `/login`

**Files:**
- Modify: `src/components/Authentication/PhoneOtpAuthForm/index.tsx:1-33`, `:257-263`
- Modify: `src/app/[lang]/(authentication)/login/page.tsx:1-9`, `:97-99`

**Interfaces:**
- Consumes: `PasswordLoginForm` from Task 2 (`@/components/Authentication/PasswordLoginForm`).

This is the task where the feature becomes reachable end to end — real interactive testing happens here.

- [ ] **Step 1: Add the toggle button to `PhoneOtpAuthForm`**

In `src/components/Authentication/PhoneOtpAuthForm/index.tsx`, add the icon import alongside the existing `Image` import (near the top of the file, after the `resolveApiErrorMessage`/`AuthenticateIcon`/`Image` imports around line 21-23):

```ts
import {KeyRound} from "lucide-react";
```

Add the new prop to `PhoneOtpAuthFormProps` (currently just `{mode: "login" | "register"}`, lines 31-33):

```ts
interface PhoneOtpAuthFormProps {
    mode: "login" | "register";
    onSwitchToPassword?: () => void;
}
```

Destructure it in the component signature (currently `export const PhoneOtpAuthForm: React.FC<PhoneOtpAuthFormProps> = ({mode}) => {`):

```ts
export const PhoneOtpAuthForm: React.FC<PhoneOtpAuthFormProps> = ({mode, onSwitchToPassword}) => {
```

In the phone-step JSX, directly below the existing Google sign-in link (the `<a href="/api/auth/google/start" ...>` block, ending around line 255) and above the `{mode === "login" && (...create account link...)}` block, add:

```tsx
                    {mode === "login" && onSwitchToPassword && (
                        <button
                            type="button"
                            onClick={onSwitchToPassword}
                            className="flex items-center justify-center gap-2 cursor-pointer w-full py-3 rounded-md border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition duration-300 mt-3"
                        >
                            <KeyRound className="h-[18px] w-[18px]"/>
                            {t("authen.buttonLoginPassword")}
                        </button>
                    )}
```

- [ ] **Step 2: Add the toggle state to `/login`**

In `src/app/[lang]/(authentication)/login/page.tsx`, add imports:

```ts
import {useState} from "react";
import {PasswordLoginForm} from "@/components/Authentication/PasswordLoginForm";
```

(`"use client"` is already the first line; `React` isn't explicitly imported today since this file only uses JSX, so add `useState` from `"react"` as its own import rather than merging into a non-existent default import.)

Add local state inside the component body (`export default function LoginPage() { const {t} = useTranslation();` becomes):

```ts
export default function LoginPage() {
  const {t} = useTranslation();
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
```

Replace the form-rendering block (currently):

```tsx
          <AuthFormContainer title={t("authen.titleLoginForm")}>
            <PhoneOtpAuthForm mode="login"/>
          </AuthFormContainer>
```

with:

```tsx
          <AuthFormContainer
            title={t("authen.titleLoginForm")}
            onBack={authMode === "password" ? () => setAuthMode("otp") : undefined}
          >
            {authMode === "otp" ? (
              <PhoneOtpAuthForm mode="login" onSwitchToPassword={() => setAuthMode("password")}/>
            ) : (
              <PasswordLoginForm/>
            )}
          </AuthFormContainer>
```

- [ ] **Step 3: Verify — typecheck and lint**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/components/Authentication/PhoneOtpAuthForm/index.tsx "src/app/[lang]/(authentication)/login/page.tsx"
```
Expected: no new errors.

- [ ] **Step 4: Verify — manual browser check**

In the browser preview, navigate to `/en/login`:

1. Confirm the phone form shows by default, with a new "Log in with a password" button below the Google button.
2. Click it — confirm the container swaps to the username/email + password form, and a back-arrow now appears in the container header (top-left, from `AuthFormContainer`'s `onBack`).
3. Click the back arrow — confirm it returns to the phone form cleanly (no leftover error message or stale state from the password form).
4. Submit the password form with the credentials from `api-108jobs/docs/identity-platform-setup.md`'s walkthrough (or any account known to have a password set) — confirm a successful login redirects to `/admin/dashboard` if the account has the `jobs:admin` role, or to `/` otherwise.
5. Submit with deliberately wrong credentials — confirm an error message appears and the form stays usable (fields aren't cleared, another attempt is possible).

- [ ] **Step 5: Commit**

```bash
git add src/components/Authentication/PhoneOtpAuthForm/index.tsx "src/app/[lang]/(authentication)/login/page.tsx"
git commit -m "feat(auth): wire password login into the /login page"
```
