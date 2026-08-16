# Admin Systemic Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the missing design-token vocabulary and fix `AdminHeader`/`AdminSidebar` (rendered on all 9 admin pages), so both land in one branch as the systemic fixes identified by the admin UI/UX audit.

**Architecture:** Two independent layers. (1) `tailwind.config.ts` + `globals.css` gain the semantic color tokens (`destructive`, `success`, `muted`, `accent`, `card`) this project's real palette never defined, which silently repairs dozens of already-written call sites with zero JSX changes. (2) The handful of call sites using non-standard `bg-gradient-*` class names (not real Tailwind syntax, would never have worked) get rewritten to real syntax. Then `AdminHeader` and `AdminSidebar` — the two files that wrap all 9 admin pages — get their remaining component-level fixes: real contrast, the real logged-in admin's identity, dead menu items removed, and i18n.

**Tech Stack:** Next.js App Router, Tailwind CSS, `react-i18next`, Zustand (`useUserStore`) — no new dependencies.

## Global Constraints

- No new npm dependencies.
- Every new user-facing string goes through `t()` with real English, Thai, and Vietnamese copy — no English-only additions. New keys live under `admin.layout.header.*` / `admin.layout.sidebar.*`, following the existing `admin.<page>.*` nested-namespace convention already used throughout `src/translations/*.ts`.
- No component-test infrastructure exists for these files (confirmed: no `@testing-library/react` in this project, no `*.test.tsx` alongside either file) and the approved spec scopes verification to manual browser checks — consistent with how the most recent merged admin-adjacent work (password login) was verified. Don't introduce a new testing pattern for this plan alone.
- Touch only the files named in this plan. Page-specific bugs found by the audit (category's dead save, job-board's dead filter, the broken `{reason}`/`{name}` interpolation strings, etc.) are explicitly out of scope — separate follow-up work.
- Follow existing code conventions exactly: double-quoted strings, 4-space indent, `cn()` for conditional class composition, unquoted camelCase object keys.

---

### Task 1: Add the missing design tokens

**Files:**
- Modify: `src/app/globals.css:242-262`
- Modify: `tailwind.config.ts:17-25`

**Interfaces:**
- Consumes: nothing (this task only adds CSS custom properties and Tailwind color config).
- Produces: `destructive`, `success`, `muted`, `accent`, `card` Tailwind colors (each with a `DEFAULT` and `-foreground` variant, e.g. `bg-destructive`, `text-destructive-foreground`), consumed by dozens of already-written call sites across the app with no further changes, and by Task 2/3/4's new code in this plan.

- [ ] **Step 1: Confirm the current broken state**

Start the dev server (use the Browser preview tool's `preview_start`, not a raw shell command), then navigate to an admin page (e.g. `/en/admin/dashboard`) so Tailwind's JIT scans it at least once. Then check the compiled dev CSS for a rule that should not exist yet:

```bash
grep -rn "\.bg-destructive" .next/dev/static/chunks/*.css
```

Expected: no output. `destructive` isn't a registered Tailwind color yet, so `bg-destructive` (already used in `AdminHeader` and `StatsCard`) never generates a rule.

- [ ] **Step 2: Add the CSS custom properties**

In `src/app/globals.css`, the current block is:

```css
:root {
    --background: #ffffff;
    --foreground: #171717;
    --primary: #08439B;
    --secondary: #e3edfd;
    --third: #1d6ce2;
    --fourth: #f6f7f8;
    --fifth: #1754b0;
    --text-primary: #2b323bf2;
    --text-secondary: #2b323b99;
    --border-primary: #d6dae1;
    --border-secondary: #e8eaee;
    --skeleton: #e8eaee;
}

@media (prefers-color-scheme: dark) {
    :root {
        --background: #0a0a0a;
        --foreground: #ededed;
    }
}
```

Replace it with:

```css
:root {
    --background: #ffffff;
    --foreground: #171717;
    --primary: #08439B;
    --secondary: #e3edfd;
    --third: #1d6ce2;
    --fourth: #f6f7f8;
    --fifth: #1754b0;
    --text-primary: #2b323bf2;
    --text-secondary: #2b323b99;
    --border-primary: #d6dae1;
    --border-secondary: #e8eaee;
    --skeleton: #e8eaee;
    --destructive: #DC2626;
    --destructive-foreground: #ffffff;
    --success: #16A34A;
    --success-foreground: #ffffff;
    --muted: var(--fourth);
    --muted-foreground: #6B7280;
    --accent: var(--third);
    --accent-foreground: #ffffff;
    --card: var(--background);
    --card-foreground: var(--foreground);
}

@media (prefers-color-scheme: dark) {
    :root {
        --background: #0a0a0a;
        --foreground: #ededed;
        --destructive: #F87171;
        --destructive-foreground: #1B1A1D;
        --success: #4ADE80;
        --success-foreground: #1B1A1D;
        --muted: #27272A;
        --muted-foreground: #A1A1AA;
        --accent: var(--third);
        --accent-foreground: #ffffff;
        --card: #18181B;
        --card-foreground: var(--foreground);
    }
}
```

(`destructive`/`success` are new hues — they match the ad-hoc `red-*`/`green-*` Tailwind classes already scattered across these pages, just centralized. `muted`, `accent`, and `card` reuse the existing `fourth`/`third`/`background` tokens rather than inventing new ones, since this app's real palette has no gap there — see the design spec.)

- [ ] **Step 3: Add the matching Tailwind config entries**

In `tailwind.config.ts`, the current `colors` block starts:

```ts
                colors: {
                    background: "var(--background)",
                    foreground: "var(--foreground)",
                    primary: "var(--primary)",
                    secondary: "var(--secondary)",
                    third: "var(--third)",
                    fourth: "var(--fourth)",
                    fifth: "var(--fifth)",

                    // ✅ แบบใหม่ (ขีดกลาง): ใช้ได้กับ `text-text-primary`, `text-text-secondary`
```

Insert new entries right after the `fifth` line and before the blank line:

```ts
                colors: {
                    background: "var(--background)",
                    foreground: "var(--foreground)",
                    primary: "var(--primary)",
                    secondary: "var(--secondary)",
                    third: "var(--third)",
                    fourth: "var(--fourth)",
                    fifth: "var(--fifth)",
                    destructive: {
                        DEFAULT: "var(--destructive)",
                        foreground: "var(--destructive-foreground)",
                    },
                    success: {
                        DEFAULT: "var(--success)",
                        foreground: "var(--success-foreground)",
                    },
                    muted: {
                        DEFAULT: "var(--muted)",
                        foreground: "var(--muted-foreground)",
                    },
                    accent: {
                        DEFAULT: "var(--accent)",
                        foreground: "var(--accent-foreground)",
                    },
                    card: {
                        DEFAULT: "var(--card)",
                        foreground: "var(--card-foreground)",
                    },

                    // ✅ แบบใหม่ (ขีดกลาง): ใช้ได้กับ `text-text-primary`, `text-text-secondary`
```

- [ ] **Step 4: Confirm the fix**

Reload the admin dashboard page in the browser preview so the dev server recompiles, then re-run the same check:

```bash
grep -rn "\.bg-destructive" .next/dev/static/chunks/*.css
```

Expected: at least one match, containing `background-color:#dc2626` (or an oklch/rgb equivalent — whatever color format this Tailwind version emits).

Also take a screenshot of `/en/admin/dashboard`: the notification bell's red dot (still present until Task 3) and the `StatsCard` trend indicators should now show real red/green instead of being invisible.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "fix(admin): add missing destructive/success/muted/accent/card design tokens"
```

---

### Task 2: Rewrite the non-standard `bg-gradient-*` classes

**Files:**
- Modify: `src/components/ui/StatsCard/index.tsx:17,40`
- Modify: `src/app/[lang]/admin/dashboard/page.tsx:110,134,177`
- Modify: `src/modules/admin/components/layout/AdminSidebar/index.tsx:95`

**Interfaces:**
- Consumes: the `card`, `primary`, `third` Tailwind colors from Task 1.
- Produces: no new interfaces — this task only changes `className` strings.

`bg-gradient-card` and `bg-gradient-primary` aren't real Tailwind utility names — Tailwind's actual gradient utilities are `bg-gradient-to-{dir}` combined with `from-*`/`to-*` stop utilities. These never generated a rule, token fix or not.

- [ ] **Step 1: Confirm these are dead classes today**

```bash
grep -rn "\.bg-gradient-card\|\.bg-gradient-primary" .next/dev/static/chunks/*.css
```

Expected: no output (neither is a Tailwind class shape Tailwind recognizes, so it can't generate a rule regardless of Task 1).

- [ ] **Step 2: Fix `StatsCard`**

In `src/components/ui/StatsCard/index.tsx`, line 17:

```tsx
        <Card className="bg-gradient-card text-gray-600 border-border/50 hover:shadow-md transition-all">
```

becomes:

```tsx
        <Card className="bg-card text-gray-600 border-border/50 hover:shadow-md transition-all">
```

Line 40:

```tsx
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center ml-4">
```

becomes (a real two-stop gradient using existing tokens, since this one is a deliberate decorative icon badge, not a flat surface):

```tsx
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-third rounded-lg flex items-center justify-center ml-4">
```

- [ ] **Step 3: Fix the dashboard page**

In `src/app/[lang]/admin/dashboard/page.tsx`, at all three of lines 110, 134, and 177:

```tsx
                    <Card className="bg-gradient-card border-border/50">
```

becomes:

```tsx
                    <Card className="bg-card border-border/50">
```

- [ ] **Step 4: Fix `AdminSidebar`**

In `src/modules/admin/components/layout/AdminSidebar/index.tsx`, line 95:

```tsx
            <SidebarContent className="bg-gradient-card ">
```

becomes:

```tsx
            <SidebarContent className="bg-card">
```

- [ ] **Step 5: Verify visually**

Reload `/en/admin/dashboard` in the browser preview. Confirm: the four `StatsCard` icon chips now show a visible navy-to-blue gradient (not a blank/invisible chip), and every card on the page has a visible white/off-white background rather than whatever the browser's default fallback rendered before. Navigate to any other admin page and confirm the sidebar's background renders correctly too (no visible change expected there beyond it now actually being defined).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/StatsCard/index.tsx "src/app/[lang]/admin/dashboard/page.tsx" src/modules/admin/components/layout/AdminSidebar/index.tsx
git commit -m "fix(admin): replace non-standard bg-gradient-* classes with real Tailwind syntax"
```

---

### Task 3: Fix `AdminHeader` — contrast, real identity, remove dead menu items, i18n

**Files:**
- Modify: `src/modules/admin/components/layout/AdminHeader/index.tsx` (full file, ~70 lines)
- Modify: `src/translations/en.ts:3704-3705`
- Modify: `src/translations/th.ts:3620-3621`
- Modify: `src/translations/vi.ts:3728-3729`

**Interfaces:**
- Consumes: `useUserStore()` from `src/store/useUserStore.ts` (`userInfo?.localUserView.person` → `Person` with `.name`/`.displayName`/`.avatar`; `userInfo?.localUserView.localUser` → `LocalUser` with `.email`) — the exact same store and shape the main site's `UserProfileSection` (`src/components/Header/components/UserProfileSection/index.tsx`) already reads from. `ProfileImage.avatar` from `@/constants/images` as the avatar fallback, matching that same component.
- Produces: the `admin.layout.header.*` translation namespace (Task 4 adds a sibling `admin.layout.sidebar.*` key inside the same `layout` object these steps create).

- [ ] **Step 1: Add the header's translation keys**

In `src/translations/en.ts`, the `admin` block currently opens:

```ts
        admin: {
            withdraw: {
```

Insert a new `layout` key as the first entry:

```ts
        admin: {
            layout: {
                header: {
                    logout: "Logout",
                },
            },
            withdraw: {
```

In `src/translations/th.ts`, the same location:

```ts
        admin: {
            withdraw: {
```

becomes:

```ts
        admin: {
            layout: {
                header: {
                    logout: "ออกจากระบบ",
                },
            },
            withdraw: {
```

In `src/translations/vi.ts`, the same location:

```ts
        admin: {
            withdraw: {
```

becomes:

```ts
        admin: {
            layout: {
                header: {
                    logout: "Đăng xuất",
                },
            },
            withdraw: {
```

- [ ] **Step 2: Replace `AdminHeader/index.tsx`**

Replace the full contents of `src/modules/admin/components/layout/AdminHeader/index.tsx` with:

```tsx
import {Button} from "@/components/ui/Button";
import {SidebarTrigger} from "@/components/ui/Sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {ProfileImage} from "@/constants/images";
import React, {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {UserService} from "@/services";
import {useUserStore} from "@/store/useUserStore";

export function AdminHeader() {
    const logout = useCallback(() => UserService.Instance.logout(), []);
    const {t} = useTranslation();
    const {userInfo} = useUserStore();
    const person = userInfo?.localUserView.person;
    const email = userInfo?.localUserView.localUser.email;
    const displayName = person?.displayName || person?.name || "";
    const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "AD";

    return (
        <header
            className="h-16 border-b border-border bg-primary text-white flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="text-white/80 hover:text-white"/>
            </div>

            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 px-3 gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={person?.avatar || ProfileImage.avatar} alt={displayName || "Admin"}/>
                                <AvatarFallback className="bg-black text-white">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start text-left">
                                <span className="text-sm font-medium">{displayName}</span>
                                <span className="text-xs text-white/80">{email}</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{displayName}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem className="text-destructive" onSelect={logout}>
                            {t("admin.layout.header.logout")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
```

This removes the notification bell and Settings menu item entirely (neither had a working handler — see the design spec's "Out of scope" section on why removal, not a "coming soon" state, was chosen), fixes contrast by setting explicit white/light text on the navy header instead of relying on inherited body color, and replaces the hardcoded "Admin User" / `admin@108jobs.com` with the real logged-in admin.

- [ ] **Step 3: Verify in the browser**

Reload an admin page. Confirm:
- The header's `SidebarTrigger` icon and the admin name/email are clearly readable (light text on the navy bar), not near-black.
- The name and email shown match the actual admin account used to log in — not "Admin User" / `admin@108jobs.com`.
- The notification bell and its red dot are gone. Opening the avatar dropdown no longer shows a "Settings" item — only the admin's name/email and "Logout".
- Logout still works (click it, confirm you're signed out).

Then switch the app language (e.g. change the URL's locale segment between `/en/` and `/th/`) and confirm the Logout menu item's label changes accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/components/layout/AdminHeader/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): AdminHeader contrast, real admin identity, remove dead bell/settings, i18n"
```

---

### Task 4: Fix `AdminSidebar` — nav landmark, i18n

**Files:**
- Modify: `src/modules/admin/components/layout/AdminSidebar/index.tsx:1-27,29-84,86-95,115-168`
- Modify: `src/translations/en.ts` (inside the `admin.layout` object Task 3 created)
- Modify: `src/translations/th.ts` (same)
- Modify: `src/translations/vi.ts` (same)

**Interfaces:**
- Consumes: the `admin.layout` object created by Task 3 (this task adds a sibling `sidebar` key inside it — Task 3 must run first).
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Add the sidebar's translation keys**

In `src/translations/en.ts`, Task 3 left this structure:

```ts
        admin: {
            layout: {
                header: {
                    logout: "Logout",
                },
            },
            withdraw: {
```

Add a `sidebar` key as a sibling of `header`, inside `layout`:

```ts
        admin: {
            layout: {
                header: {
                    logout: "Logout",
                },
                sidebar: {
                    navLabel: "Admin navigation",
                    nav: {
                        dashboard: {title: "Dashboard", description: "System overview"},
                        manageUsers: {title: "Manage Users", description: "Review and manage user profiles"},
                        bankAccounts: {title: "Bank Accounts", description: "Manage user bank accounts"},
                        topupCoins: {title: "Top-up Coins", description: "Add coins to user accounts"},
                        withdrawCoins: {title: "Withdraw Coins", description: "Approve coin withdrawal requests"},
                        manageJobBoard: {title: "Manage Job Board", description: "Manage job board posts"},
                        manageCategory: {title: "Manage Category", description: "Manage categories for job board posts"},
                        managePicture: {title: "Manage Picture", description: "Manage picture for 108jobs"},
                        manageRiders: {title: "Manage Riders", description: "Manage riders for 108jobs"},
                    },
                },
            },
            withdraw: {
```

In `src/translations/th.ts`, the same insertion (Thai copy):

```ts
        admin: {
            layout: {
                header: {
                    logout: "ออกจากระบบ",
                },
                sidebar: {
                    navLabel: "เมนูนำทางผู้ดูแลระบบ",
                    nav: {
                        dashboard: {title: "แดชบอร์ด", description: "ภาพรวมระบบ"},
                        manageUsers: {title: "จัดการผู้ใช้", description: "ตรวจสอบและจัดการโปรไฟล์ผู้ใช้"},
                        bankAccounts: {title: "บัญชีธนาคาร", description: "จัดการบัญชีธนาคารของผู้ใช้"},
                        topupCoins: {title: "เติมเหรียญ", description: "เพิ่มเหรียญให้บัญชีผู้ใช้"},
                        withdrawCoins: {title: "ถอนเหรียญ", description: "อนุมัติคำขอถอนเหรียญ"},
                        manageJobBoard: {title: "จัดการบอร์ดงาน", description: "จัดการโพสต์บอร์ดงาน"},
                        manageCategory: {title: "จัดการหมวดหมู่", description: "จัดการหมวดหมู่สำหรับโพสต์บอร์ดงาน"},
                        managePicture: {title: "จัดการรูปภาพ", description: "จัดการรูปภาพสำหรับ 108jobs"},
                        manageRiders: {title: "จัดการไรเดอร์", description: "จัดการไรเดอร์สำหรับ 108jobs"},
                    },
                },
            },
            withdraw: {
```

In `src/translations/vi.ts`, the same insertion (Vietnamese copy):

```ts
        admin: {
            layout: {
                header: {
                    logout: "Đăng xuất",
                },
                sidebar: {
                    navLabel: "Điều hướng quản trị",
                    nav: {
                        dashboard: {title: "Bảng điều khiển", description: "Tổng quan hệ thống"},
                        manageUsers: {title: "Quản lý người dùng", description: "Xem xét và quản lý hồ sơ người dùng"},
                        bankAccounts: {title: "Tài khoản ngân hàng", description: "Quản lý tài khoản ngân hàng của người dùng"},
                        topupCoins: {title: "Nạp xu", description: "Thêm xu vào tài khoản người dùng"},
                        withdrawCoins: {title: "Rút xu", description: "Duyệt yêu cầu rút xu"},
                        manageJobBoard: {title: "Quản lý bảng việc làm", description: "Quản lý bài đăng trên bảng việc làm"},
                        manageCategory: {title: "Quản lý danh mục", description: "Quản lý danh mục cho bài đăng việc làm"},
                        managePicture: {title: "Quản lý hình ảnh", description: "Quản lý hình ảnh cho 108jobs"},
                        manageRiders: {title: "Quản lý tài xế", description: "Quản lý tài xế cho 108jobs"},
                    },
                },
            },
            withdraw: {
```

- [ ] **Step 2: Add the `useTranslation` import**

In `src/modules/admin/components/layout/AdminSidebar/index.tsx`, the current imports are:

```tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

import {
```

becomes:

```tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTranslation} from "react-i18next";

import {
```

- [ ] **Step 3: Simplify `navigationItems` to keys, not literal copy**

The current array (lines 29-84):

```tsx
const navigationItems = [
    {
        title: "Dashboard",
        url: "/admin/dashboard",
        icon: LayoutDashboard,
        description: "System overview"
    },
    {
        title: "Manage Users",
        url: "/admin/manage-users",
        icon: Users,
        description: "Review and manage user profiles"
    },
    {
        title: "Bank Accounts",
        url: "/admin/bank-accounts",
        icon: CreditCard,
        description: "Manage user bank accounts"
    },
    {
        title: "Top-up Coins",
        url: "/admin/topup-coins",
        icon: Plus,
        description: "Add coins to user accounts"
    },
    {
        title: "Withdraw Coins",
        url: "/admin/withdraw-coins",
        icon: Minus,
        description: "Approve coin withdrawal requests"
    },
    {
        title: "Manage Job Board",
        url: "/admin/manage-job-board",
        icon: Handbag,
        description: "Manage job board posts"
    },
    {
        title: "Manage Category",
        url: "/admin/manage-category",
        icon: ChartColumnStacked,
        description: "Manage categories for job board posts"
    },
    {
        title: "Manage Picture",
        url: "/admin/manage-picture",
        icon: ImageIcon,
        description: "Manage picture for 108jobs"
    },
    {
        title: "Manage Riders",
        url: "/admin/manage-riders",
        icon: Motorbike,
        description: "Manage riders for 108jobs"
    },
];
```

becomes:

```tsx
const navigationItems = [
    {key: "dashboard", url: "/admin/dashboard", icon: LayoutDashboard},
    {key: "manageUsers", url: "/admin/manage-users", icon: Users},
    {key: "bankAccounts", url: "/admin/bank-accounts", icon: CreditCard},
    {key: "topupCoins", url: "/admin/topup-coins", icon: Plus},
    {key: "withdrawCoins", url: "/admin/withdraw-coins", icon: Minus},
    {key: "manageJobBoard", url: "/admin/manage-job-board", icon: Handbag},
    {key: "manageCategory", url: "/admin/manage-category", icon: ChartColumnStacked},
    {key: "managePicture", url: "/admin/manage-picture", icon: ImageIcon},
    {key: "manageRiders", url: "/admin/manage-riders", icon: Motorbike},
];
```

- [ ] **Step 4: Read the sidebar's `t` function and wrap the nav in a landmark**

The component body currently starts (note: `bg-card` here already reflects Task 2's fix, not `bg-gradient-card`):

```tsx
export function AdminSidebar() {
    const {state} = useSidebar();
    const {siteView} = useSiteStore();
    const collapsed = state === "collapsed";
    const pathname = usePathname();
    const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");
    const logoUrl = siteView?.localSite?.icon || AssetIcon.logo.src;
    return (
        <Sidebar collapsible="icon">
            <SidebarContent className="bg-card">
```

becomes:

```tsx
export function AdminSidebar() {
    const {t} = useTranslation();
    const {state} = useSidebar();
    const {siteView} = useSiteStore();
    const collapsed = state === "collapsed";
    const pathname = usePathname();
    const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");
    const logoUrl = siteView?.localSite?.icon || AssetIcon.logo.src;
    return (
        <Sidebar collapsible="icon">
            <SidebarContent className="bg-card">
```

- [ ] **Step 5: Wrap the menu in a `<nav>` landmark and resolve titles/descriptions via `t()`**

The render body (lines 115-168):

```tsx
                <SidebarGroup className="px-4">
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-1">
                            {navigationItems.map((item) => {
                                const isActive = pathWithoutLocale === item.url;

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild>
                                            <Link
                                                href={item.url}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-lg transition-all group",
                                                    // Active state
                                                    isActive
                                                        ? "bg-primary text-white shadow-md"
                                                        : "hover:bg-muted/80",
                                                    // Collapsed: make button square + center icon
                                                    collapsed && "justify-center p-0 size-12",
                                                    // Expanded: normal padding
                                                    !collapsed && "px-3 py-2.5"
                                                )}
                                            >
                                                <item.icon
                                                    className={cn(
                                                        "w-5 h-5",
                                                        collapsed ? "w-10 h-10" : "",
                                                        isActive
                                                            ? "text-white"
                                                            : "text-muted-foreground group-hover:text-foreground"
                                                    )}
                                                />
                                                {!collapsed && (
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate">{item.title}</div>
                                                        <div
                                                            className={cn(
                                                                "text-xs truncate",
                                                                isActive ? "text-white/80" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {item.description}
                                                        </div>
                                                    </div>
                                                )}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
```

becomes:

```tsx
                <SidebarGroup className="px-4">
                    <SidebarGroupContent>
                        <nav aria-label={t("admin.layout.sidebar.navLabel")}>
                            <SidebarMenu className="space-y-1">
                                {navigationItems.map((item) => {
                                    const isActive = pathWithoutLocale === item.url;
                                    const title = t(`admin.layout.sidebar.nav.${item.key}.title`);
                                    const description = t(`admin.layout.sidebar.nav.${item.key}.description`);

                                    return (
                                        <SidebarMenuItem key={item.key}>
                                            <SidebarMenuButton asChild>
                                                <Link
                                                    href={item.url}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg transition-all group",
                                                        // Active state
                                                        isActive
                                                            ? "bg-primary text-white shadow-md"
                                                            : "hover:bg-muted/80",
                                                        // Collapsed: make button square + center icon
                                                        collapsed && "justify-center p-0 size-12",
                                                        // Expanded: normal padding
                                                        !collapsed && "px-3 py-2.5"
                                                    )}
                                                >
                                                    <item.icon
                                                        className={cn(
                                                            "w-5 h-5",
                                                            collapsed ? "w-10 h-10" : "",
                                                            isActive
                                                                ? "text-white"
                                                                : "text-muted-foreground group-hover:text-foreground"
                                                        )}
                                                    />
                                                    {!collapsed && (
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">{title}</div>
                                                            <div
                                                                className={cn(
                                                                    "text-xs truncate",
                                                                    isActive ? "text-white/80" : "text-muted-foreground"
                                                                )}
                                                            >
                                                                {description}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </nav>
                    </SidebarGroupContent>
                </SidebarGroup>
```

- [ ] **Step 6: Verify in the browser**

Reload any admin page. Confirm:
- All 9 sidebar nav items still show the correct icon, title, and description, unchanged in English.
- Switch locale to `/th/` — confirm all 9 titles/descriptions switch to Thai. Switch to `/vi/` — confirm Vietnamese.
- Using the accessibility tree (`read_page`), confirm a `nav` landmark now wraps the 9 menu items (search for `navigation` role or the `aria-label` text).
- Collapse the sidebar (icon-only mode) and confirm nothing breaks — icons still show, no layout shift.

- [ ] **Step 7: Commit**

```bash
git add src/modules/admin/components/layout/AdminSidebar/index.tsx src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "fix(admin): AdminSidebar nav landmark and i18n for all 9 nav items"
```

---

## After all tasks: whole-branch check

Once all 4 tasks are committed, before opening a PR:

- [ ] Run `pnpm lint` (ESLint) and `pnpm build` (which also runs Next's TypeScript check — there's no separate `typecheck` script) and fix anything the new code introduces.
- [ ] Do one full visual pass across all 9 admin pages (not just dashboard) confirming: header contrast, real identity, no dead bell/settings, sidebar nav landmark and i18n, and no broken-token visual regressions anywhere the shared header/sidebar render.
- [ ] Confirm `git status` is clean relative to the branch (no stray uncommitted files) before pushing.
