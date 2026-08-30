# Chat Mobile Responsive: App-Style Tabs — Implementation Plan

## Status (2026-08-30): executed, with Tasks 1 and 5 dropped

Tasks 2, 3, 4, 6 and 7 were executed. **Tasks 1 and 5 were dropped mid-execution**, and
Task 4's safe-area step was replaced, because equivalent fixes were written independently
and merged to `main` while this plan was running:

| Task | Outcome |
|---|---|
| 1 — emoji picker clamp | **Dropped.** Superseded by #126 (closes #123). |
| 2 — tab labels in en/th/vi | Done. |
| 3 — `ChatRoomTabs` component | Done. |
| 4 — slide-over → tab pane | Done. Its safe-area wrapper was replaced by main's better one-line padding from #128. |
| 5 — `100vh` → `100dvh` | **Dropped.** Superseded by #127 (closes #124). |
| 6 — comments + `JobFlowSidebar` test | Done. |
| 7 — browser verification | See the branch's PR. |

The branch was rebased onto the post-merge `main` and the two superseded commits were left
behind rather than replayed. The task text below is unchanged, so Tasks 1 and 5 describe
work that is no longer part of this branch.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the job-board chat room's mobile web layout behave like the 108Heros mobile app's chat screen — a persistent Chat | Order tab bar instead of a "Show Flow" toggle and slide-over drawer — plus three smaller mobile-web fixes.

**Architecture:** On mobile (`< md`, 768px), the Order content stops being a fixed-position slide-over rendered as a sibling of `<main>` and becomes an in-flow pane rendered *inside* `ChatRoomView`, directly below the header and a new tab bar. `JobFlowSidebar` reduces to the desktop-only static `<aside>` it always was on wide screens. The existing `isOpen`/`setOpen` state on `JobFlowSidebarContext` is reused verbatim as the tab selection (`false` = Chat tab, `true` = Order tab); no new state is introduced.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 3.4, Zustand, react-i18next, Vitest + jsdom.

## Global Constraints

- **Design spec:** `docs/superpowers/specs/2026-08-29-chat-mobile-responsive-app-style-design.md`. Read it before Task 1.
- **Breakpoint is `md` (768px), never `sm`.** Every mobile/desktop split in this feature uses `md:`. `JobFlowSidebar`, `ChatMediaPanel.onJump`, and this plan all key off 768; `ChatSearchPanel` uses `sm:` for its own unrelated overlay. Do not "align" them.
- **Desktop (≥768px) rendering must not change.** Any diff that alters desktop layout is wrong.
- **Tab copy is taken verbatim from the mobile app**, `108heros-flutter-dev/lib/l10n/intl_{en,th,vi}.arb` keys `profileChatTabChat` / `profileChatTabOrder`. Do not invent new wording:
  - en: `"Chat"` / `"Order"`
  - th: `"แชท"` / `"คำสั่งงาน"`
  - vi: `"Trò chuyện"` / `"Đơn hàng"`
- **Existing i18n key `profileChat.orders` ("Orders") is a different UI element** — the inner sidebar tab in `ChatSidebarTabs`. Do not reuse it for the new outer tab, and do not change it.
- Run `npm run test:unit` (Vitest) for tests, `npx eslint <file>` for lint, `npm run build` for typecheck/build.
- Commit after each task.

---

### Task 1: Viewport-clamped emoji picker position

The emoji picker is positioned with hardcoded offsets (`rect.top - 410`, `rect.left - 280`) that assume ~410px above and ~280px left of the button exist. On a narrow phone viewport they often don't, so the picker renders partly or fully off-screen. Extract the math into a pure function so it can be tested without a DOM, then clamp it.

**Files:**
- Create: `src/modules/chat/utils/clampPickerPosition.ts`
- Create: `src/modules/chat/utils/clampPickerPosition.test.ts`
- Modify: `src/modules/chat/components/ChatInput/index.tsx:92-107` (the positioning `useEffect`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `clampPickerPosition(input: PickerPositionInput): {top: number; left: number}` where
  `PickerPositionInput = {desiredTop: number; desiredLeft: number; width: number; height: number; viewportWidth: number; viewportHeight: number; margin?: number}`.
  Used only by `ChatInput` in this task; no later task depends on it.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/utils/clampPickerPosition.test.ts`:

```ts
import {describe, expect, it} from "vitest";

import {clampPickerPosition} from "@/modules/chat/utils/clampPickerPosition";

const PICKER = {width: 320, height: 400};

describe("clampPickerPosition", () => {
    it("leaves a position that already fits untouched", () => {
        expect(
            clampPickerPosition({
                desiredTop: 200,
                desiredLeft: 500,
                ...PICKER,
                viewportWidth: 1280,
                viewportHeight: 800,
            }),
        ).toEqual({top: 200, left: 500});
    });

    it("pulls a negative offset back to the margin", () => {
        // A 375px-wide phone: `rect.left - 280` is routinely negative, and
        // `rect.top - 410` is negative for any button below ~410px.
        expect(
            clampPickerPosition({
                desiredTop: -120,
                desiredLeft: -240,
                ...PICKER,
                viewportWidth: 375,
                viewportHeight: 667,
            }),
        ).toEqual({top: 8, left: 8});
    });

    it("pulls an overflowing offset back inside the far edge", () => {
        expect(
            clampPickerPosition({
                desiredTop: 640,
                desiredLeft: 1200,
                ...PICKER,
                viewportWidth: 1280,
                viewportHeight: 800,
            }),
        ).toEqual({top: 800 - 400 - 8, left: 1280 - 320 - 8});
    });

    it("prefers the near margin when the picker is larger than the viewport", () => {
        // Both clamps fight; the low bound must win so the picker's top-left
        // stays reachable rather than being pushed off the near edge.
        expect(
            clampPickerPosition({
                desiredTop: 300,
                desiredLeft: 300,
                ...PICKER,
                viewportWidth: 300,
                viewportHeight: 300,
            }),
        ).toEqual({top: 8, left: 8});
    });

    it("honours a custom margin", () => {
        expect(
            clampPickerPosition({
                desiredTop: -50,
                desiredLeft: -50,
                ...PICKER,
                viewportWidth: 375,
                viewportHeight: 667,
                margin: 16,
            }),
        ).toEqual({top: 16, left: 16});
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/modules/chat/utils/clampPickerPosition.test.ts`
Expected: FAIL — cannot resolve `@/modules/chat/utils/clampPickerPosition`.

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/chat/utils/clampPickerPosition.ts`:

```ts
export interface PickerPositionInput {
    /** Where the caller would put the picker if the viewport were infinite. */
    desiredTop: number;
    desiredLeft: number;
    /** The picker's own fixed size. */
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    /** Gap to keep between the picker and the viewport edge. */
    margin?: number;
}

/**
 * Keeps a fixed-position floating panel fully inside the viewport.
 *
 * `ChatInput` positions the emoji picker by subtracting its own size from the
 * trigger button's rect, which silently produces negative (or overflowing)
 * coordinates whenever the button sits near an edge -- routine on a phone,
 * where 320x400 is a large fraction of the screen. Clamping here rather than
 * at the call site keeps the arithmetic testable without a DOM.
 *
 * When the panel is larger than the viewport the two bounds conflict; the low
 * bound is applied last so the panel's top-left corner stays on screen, which
 * is the half a user can still interact with.
 */
export function clampPickerPosition({
    desiredTop,
    desiredLeft,
    width,
    height,
    viewportWidth,
    viewportHeight,
    margin = 8,
}: PickerPositionInput): {top: number; left: number} {
    return {
        top: Math.max(margin, Math.min(desiredTop, viewportHeight - height - margin)),
        left: Math.max(margin, Math.min(desiredLeft, viewportWidth - width - margin)),
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/modules/chat/utils/clampPickerPosition.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into ChatInput**

In `src/modules/chat/components/ChatInput/index.tsx`, add the import next to the existing ones:

```tsx
import {clampPickerPosition} from "@/modules/chat/utils/clampPickerPosition";
```

Then replace the whole positioning effect (currently `// === POSITION PICKER ABOVE SMILEY BUTTON ===` through its closing `}, [showEmojiPicker]);`) with:

```tsx
    // === POSITION PICKER ABOVE SMILEY BUTTON ===
    // Must match the picker's inline width/height below; the clamp needs the
    // real box to know when it would overflow.
    const PICKER_WIDTH = 320;
    const PICKER_HEIGHT = 400;

    useEffect(() => {
        if (!showEmojiPicker || !emojiButtonRef.current || !pickerRef.current) return;

        const button = emojiButtonRef.current;
        const picker = pickerRef.current;
        const rect = button.getBoundingClientRect();

        // Preferred spot: directly above the button, right edges aligned.
        // Clamped, because on a phone there is frequently neither 400px above
        // the composer nor 280px to its left.
        const {top, left} = clampPickerPosition({
            desiredTop: rect.top - PICKER_HEIGHT - 10,
            desiredLeft: rect.left - (PICKER_WIDTH - 40),
            width: PICKER_WIDTH,
            height: PICKER_HEIGHT,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });

        picker.style.position = "fixed";
        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
        picker.style.zIndex = "50";
    }, [showEmojiPicker]);
```

Then change the picker's inline style to use the same constants, replacing `style={{ width: 320, height: 400 }}` with:

```tsx
                                style={{ width: PICKER_WIDTH, height: PICKER_HEIGHT }}
```

- [ ] **Step 6: Verify lint and build**

Run: `npx eslint src/modules/chat/components/ChatInput/index.tsx src/modules/chat/utils/clampPickerPosition.ts`
Expected: 0 errors (pre-existing warnings elsewhere in the file are fine).

Run: `npm run build`
Expected: completes with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/chat/utils/clampPickerPosition.ts src/modules/chat/utils/clampPickerPosition.test.ts src/modules/chat/components/ChatInput/index.tsx
git commit -m "fix(chat): keep the emoji picker on screen on narrow viewports"
```

---

### Task 2: Tab labels in all three locales

**Files:**
- Modify: `src/translations/en.ts:37-42` (inside `profileChat`)
- Modify: `src/translations/th.ts:37-42`
- Modify: `src/translations/vi.ts:37-42`

**Interfaces:**
- Consumes: nothing.
- Produces: i18n keys `profileChat.tabChat` and `profileChat.tabOrder`, read by `ChatRoomTabs` in Task 3.

- [ ] **Step 1: Add the keys**

In each file the `profileChat` object already opens with `price`, `jobFlow`, `orders`, `media`, `closeDrawer`. Add the two new keys immediately after `media`, leaving every existing key untouched.

`src/translations/en.ts`:

```ts
            media: "Media",
            tabChat: "Chat",
            tabOrder: "Order",
```

`src/translations/th.ts`:

```ts
            media: "สื่อ",
            tabChat: "แชท",
            tabOrder: "คำสั่งงาน",
```

`src/translations/vi.ts`:

```ts
            media: "Phương tiện",
            tabChat: "Trò chuyện",
            tabOrder: "Đơn hàng",
```

- [ ] **Step 2: Verify the build still typechecks**

Run: `npm run build`
Expected: completes with no TypeScript errors. (`en.ts` is the shape the others are checked against, so a key added to only one file would fail here.)

- [ ] **Step 3: Commit**

```bash
git add src/translations/en.ts src/translations/th.ts src/translations/vi.ts
git commit -m "i18n(chat): add Chat/Order tab labels matching the mobile app"
```

---

### Task 3: The `ChatRoomTabs` component

A presentational, mobile-only tab bar. It owns no state — the caller passes the active tab and a setter, so the component stays trivially testable and the single source of truth remains `JobFlowSidebarContext`.

**Files:**
- Create: `src/modules/chat/components/ChatRoomTabs/index.tsx`
- Create: `src/modules/chat/components/ChatRoomTabs/index.test.ts`

**Interfaces:**
- Consumes: `profileChat.tabChat` / `profileChat.tabOrder` from Task 2.
- Produces:
  - `export type ChatRoomTab = "chat" | "order"`
  - `export default ChatRoomTabs` with props `{activeTab: ChatRoomTab; onSelect: (tab: ChatRoomTab) => void}`
  - DOM ids `chat-room-tab-chat` / `chat-room-tab-order`, and `aria-controls` pointing at `chat-room-panel-chat` / `chat-room-panel-order` — Task 4 puts those ids on the panes.

- [ ] **Step 1: Write the failing test**

Create `src/modules/chat/components/ChatRoomTabs/index.test.ts`:

```ts
// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ChatRoomTabs from "@/modules/chat/components/ChatRoomTabs";

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => ({
            "profileChat.tabChat": "Chat",
            "profileChat.tabOrder": "Order",
            "profileChat.jobFlow": "Job Flow",
        }[key] ?? key),
    }),
}));

describe("ChatRoomTabs", () => {
    let container: HTMLDivElement;
    let root: Root;

    const tabs = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        vi.restoreAllMocks();
    });

    function render(activeTab: "chat" | "order", onSelect = vi.fn()) {
        act(() => {
            root.render(createElement(ChatRoomTabs, {activeTab, onSelect}));
        });
        return onSelect;
    }

    it("renders both tabs and marks only the active one selected", () => {
        render("chat");

        expect(tabs().map((tab) => tab.textContent)).toEqual(["Chat", "Order"]);
        expect(tabs().map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    });

    it("points each tab at the pane it controls", () => {
        render("chat");

        expect(tabs().map((tab) => tab.id)).toEqual(["chat-room-tab-chat", "chat-room-tab-order"]);
        expect(tabs().map((tab) => tab.getAttribute("aria-controls"))).toEqual([
            "chat-room-panel-chat",
            "chat-room-panel-order",
        ]);
    });

    it("reports the tab the user clicked", () => {
        const onSelect = render("chat");

        act(() => tabs()[1].click());

        expect(onSelect).toHaveBeenCalledWith("order");
    });

    it("is hidden from the md breakpoint up", () => {
        render("chat");

        // The desktop layout keeps its permanent sidebar; a tab bar there
        // would offer a choice the desktop UI does not have.
        expect(document.querySelector('[role="tablist"]')?.className).toContain("md:hidden");
    });

    it("keeps a single tab stop and moves selection with the arrow keys", () => {
        const onSelect = render("chat");

        expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);

        act(() => {
            tabs()[0].dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true}));
        });

        expect(onSelect).toHaveBeenCalledWith("order");
    });

    it("wraps around when arrowing past either end", () => {
        const onSelect = render("chat");

        act(() => {
            tabs()[0].dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowLeft", bubbles: true}));
        });

        expect(onSelect).toHaveBeenCalledWith("order");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/modules/chat/components/ChatRoomTabs/index.test.ts`
Expected: FAIL — cannot resolve `@/modules/chat/components/ChatRoomTabs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/chat/components/ChatRoomTabs/index.tsx`:

```tsx
"use client";

import React from "react";
import {useTranslation} from "react-i18next";

export type ChatRoomTab = "chat" | "order";

const TABS: Array<{id: ChatRoomTab; labelKey: string}> = [
    {id: "chat", labelKey: "profileChat.tabChat"},
    {id: "order", labelKey: "profileChat.tabOrder"},
];

interface ChatRoomTabsProps {
    activeTab: ChatRoomTab;
    onSelect: (tab: ChatRoomTab) => void;
}

/**
 * Chat and Order as peers, directly under the room header, on mobile only.
 *
 * The order half of this screen used to sit behind a "Show Flow" button that
 * opened a slide-over -- which made the commercial half of the conversation
 * something you had to know to look for, and named it after the code's own
 * word for it. The mobile app replaced that with these two tabs for exactly
 * that reason; this is the web following it.
 *
 * Stateless by design: the selected tab *is* `JobFlowSidebarContext`'s
 * `isOpen`, which already meant "is the mobile flow panel showing". Holding a
 * second copy here would be two sources of truth for one boolean.
 */
const ChatRoomTabs: React.FC<ChatRoomTabsProps> = ({activeTab, onSelect}) => {
    const {t} = useTranslation();

    // Roving-tabindex focus targets. Both buttons are always mounted (only
    // their tabIndex/aria-selected differ), so the ref for the tab an arrow
    // key is about to select already exists when the handler runs.
    const tabRefs = React.useRef<Map<ChatRoomTab, HTMLButtonElement>>(new Map());

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === activeTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        const nextId = TABS[(next + TABS.length) % TABS.length].id;
        onSelect(nextId);
        // Moves the actual focus ring, not just aria-selected/tabIndex --
        // without this the ring stays stranded on the old (now tabIndex=-1)
        // button, which a keyboard user can no longer Tab back to.
        tabRefs.current.get(nextId)?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={t("profileChat.jobFlow")}
            onKeyDown={onKeyDown}
            className="flex flex-shrink-0 border-b border-gray-200 bg-white md:hidden"
        >
            {TABS.map((tab) => {
                const selected = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        ref={(el) => {
                            if (el) tabRefs.current.set(tab.id, el);
                            else tabRefs.current.delete(tab.id);
                        }}
                        id={`chat-room-tab-${tab.id}`}
                        role="tab"
                        type="button"
                        aria-selected={selected}
                        aria-controls={`chat-room-panel-${tab.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onSelect(tab.id)}
                        className={`flex-1 -mb-px border-b-2 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selected
                                ? "border-primary font-semibold text-primary"
                                : "border-transparent font-medium text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {t(tab.labelKey)}
                    </button>
                );
            })}
        </div>
    );
};

export default ChatRoomTabs;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/modules/chat/components/ChatRoomTabs/index.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/chat/components/ChatRoomTabs
git commit -m "feat(chat): add the mobile Chat/Order tab bar component"
```

---

### Task 4: Switch the mobile Order pane from slide-over to tab pane

The structural change. These four files must land together: removing `JobFlowSidebar`'s mobile `<aside>` without `ChatRoomView` rendering the content inline would leave mobile with no way to reach the Order content at all, and removing `ChatHeader`'s toggle without the tab bar would leave no way to switch.

**Files:**
- Modify: `src/modules/chat/components/ChatHeader/index.tsx` (drop `onToggleFlow` / `isFlowOpen` props and the toggle button)
- Modify: `src/modules/chat/components/JobFlowSidebar/index.tsx` (desktop-only)
- Modify: `src/modules/chat/components/ChatRoomView/index.tsx` (memoize sidebar content; render tabs and both panes; safe-area padding)
- Modify: `src/modules/chat/components/ChatSidebarTabs/index.tsx` (drop the now-redundant mobile close button)

**Interfaces:**
- Consumes: `ChatRoomTabs` and `ChatRoomTab` from Task 3; `isOpen` / `setOpen` / `content` / `setContent` from the existing `useJobFlowSidebar()`.
- Produces: DOM ids `chat-room-panel-chat` / `chat-room-panel-order` on the two panes (referenced by Task 3's `aria-controls`); `JobFlowSidebar` rendering exactly one `<aside role="complementary" aria-label="Job Flow Sidebar">` and nothing else (Task 6's test update depends on this).

- [ ] **Step 1: Make `ChatHeader` stop owning the flow toggle**

In `src/modules/chat/components/ChatHeader/index.tsx`, delete the two props from the interface:

```tsx
interface ChatHeaderProps {
    avatarUrl?: string;
    displayName: string;
    partnerId: LocalUserId;
    typingText?: string;
    onToggleSearch?: () => void;
    isSearchOpen?: boolean;
}
```

Delete them from the destructured parameter list too, leaving:

```tsx
const ChatHeader: React.FC<ChatHeaderProps> = ({
                                                   avatarUrl,
                                                   displayName,
                                                   typingText,
                                                   partnerId,
                                                   onToggleSearch,
                                                   isSearchOpen,
                                               }) => {
```

Then delete the entire `{/* Show Flow Button — only visible on mobile */}` comment and the `<button>` that follows it, so the actions row contains only the search button:

```tsx
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggleSearch}
                    aria-label={t("profileChat.roomSearch.open")}
                    aria-expanded={Boolean(isSearchOpen)}
                    className={`rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isSearchOpen ? "bg-gray-100 text-primary" : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    <Search className="h-5 w-5" />
                </button>
            </div>
```

- [ ] **Step 2: Reduce `JobFlowSidebar` to the desktop sidebar**

Replace the whole body of `src/modules/chat/components/JobFlowSidebar/index.tsx` with:

```tsx
"use client";

import React from "react";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";

/**
 * The permanent Order/Media sidebar, desktop only.
 *
 * Mobile used to get a second copy of this as a fixed slide-over with a
 * backdrop, toggled from the header. It is now an in-flow pane inside
 * `ChatRoomView`, selected by `ChatRoomTabs` -- see that component for why.
 * The context's `isOpen` still exists and still means "the mobile Order pane
 * is showing"; this component simply no longer has an opinion about it, which
 * is what makes the desktop sidebar unconditional.
 */
export default function JobFlowSidebar() {
  const {content} = useJobFlowSidebar();

  return (
    <aside
      className="hidden md:flex md:static md:order-last h-full md:w-64 lg:w-80 xl:w-96 max-w-[360px] border-l bg-gray-50 shadow-none flex-col"
      role="complementary"
      aria-label="Job Flow Sidebar"
    >
      {content}
    </aside>
  );
}
```

- [ ] **Step 3: Drop the redundant close button from `ChatSidebarTabs`**

In `src/modules/chat/components/ChatSidebarTabs/index.tsx`, delete the `useJobFlowSidebar` import, the `const {setOpen} = useJobFlowSidebar();` line together with its explanatory comment block, the `X` import from `lucide-react`, and the entire mobile-only close `<button>` plus its preceding comment. The tab bar is now the one and only way to leave the Order pane, so a second "close" affordance would be a second mental model for the same action.

The header row reduces to:

```tsx
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200">
                <div
                    role="tablist"
                    aria-label={t("profileChat.jobFlow")}
                    onKeyDown={onKeyDown}
                    className="flex flex-1"
                >
```

Leave everything else in the file — the roving tabindex, the `uid` suffixing, the Orders/Media panel switch — exactly as it is.

- [ ] **Step 4: Hoist `ChatRoomView`'s sidebar content into a memo**

In `src/modules/chat/components/ChatRoomView/index.tsx`, replace the `useLayoutEffect` that calls `setContent(...)` (the block beginning `// Provide the workflow-only Orders tab and the Media tab to the global sidebar.`) with a memo plus a much smaller effect, so the same element can be handed to the desktop sidebar *and* rendered inline for mobile:

```tsx
    // The Orders + Media panel. Built once per meaningful change rather than
    // inside the effect below, because it now has two consumers: the desktop
    // sidebar (via context) and the mobile Order pane, which renders it
    // inline. Same dependency list the effect carried before.
    const sidebarContent = useMemo(
        () => (
            <ChatSidebarTabs
                roomId={roomId}
                partnerName={partnerName || "User"}
                orders={
                    <JobFlowContent
                        renderFlowContent={renderFlowContent}
                        jobId={roomPostId}
                        lang={lang}
                    />
                }
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            currentRoom,
            isEmployer,
            isEmployerKnown,
            hasStarted,
            selectedFile,
            isDeletingFile,
            statusBeforeCancel,
            availableBalance,
            latestQuoteAmount,
            currentStatus,
            roomId,
            partnerName,
            roomPostId,
            lang,
        ],
    );

    useLayoutEffect(() => {
        setContent(sidebarContent);
        return () => setContent(null);
    }, [sidebarContent, setContent]);
```

- [ ] **Step 5: Render the tab bar and the two panes**

Still in `ChatRoomView`, add the import beside the other component imports:

```tsx
import ChatRoomTabs from "@/modules/chat/components/ChatRoomTabs";
```

Then replace the returned markup from the opening `<div className="flex-1 min-w-0 flex flex-col h-full w-full">` through the closing `</div>` of the composer container with:

```tsx
                <div className="flex-1 min-w-0 flex flex-col h-full w-full">
                    {/* Header: partner presence and typing indicator */}
                    <ChatHeader
                        avatarUrl={partnerAvatar}
                        displayName={partnerName || "User"}
                        typingText={isPartnerTyping ? (t("profileChat.typing") || "กำลังพิมพ์...") : undefined}
                        partnerId={partnerId}
                        onToggleSearch={() => (isSearchOpen ? closeSearch() : openSearch())}
                        isSearchOpen={isSearchOpen}
                    />

                    {/* Mobile only; desktop shows both panes side by side. */}
                    <ChatRoomTabs
                        activeTab={isFlowOpen ? "order" : "chat"}
                        onSelect={(tab) => setIsFlowOpen(tab === "order")}
                    />

                    <div
                        id="chat-room-panel-chat"
                        role="tabpanel"
                        aria-labelledby="chat-room-tab-chat"
                        className={`${isFlowOpen ? "hidden md:flex" : "flex"} min-h-0 flex-1 flex-col`}
                    >
                        <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
                            {isSearchOpen && (
                                <ChatSearchPanel roomId={roomId} partnerName={partnerName || "User"} />
                            )}
                            <ChatRoomMessages
                                key={roomId}
                                messages={messages}
                                partnerAvatar={partnerAvatar || ProfileImage.avatar}
                                onTopReached={handleOnTopReached}
                                hasMore={hasMore}
                                isFetching={isFetching}
                                partnerId={partnerId}
                            />
                        </div>
                        {/* The inset is the notch/home-indicator gap and resolves to
                            0 everywhere else, so this is inert on desktop. Applied
                            to a wrapper rather than the padded element itself
                            because an inline paddingBottom would override the
                            responsive `py-2 sm:py-3` below instead of adding to it. */}
                        <div
                            className="border-t bg-white"
                            style={{paddingBottom: "env(safe-area-inset-bottom)"}}
                        >
                            <div ref={inputContainerRef} className="px-3 py-2 sm:px-4 sm:py-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        {/* ... the existing error / attachmentPreview / ChatInput
                                            block is unchanged; keep it verbatim ... */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order pane. Mobile only -- on desktop this same element is
                        rendered by JobFlowSidebar as a permanent side panel, and
                        mounting it twice there would be two live copies of the
                        workflow. */}
                    {isFlowOpen && (
                        <div
                            id="chat-room-panel-order"
                            role="tabpanel"
                            aria-labelledby="chat-room-tab-order"
                            className="flex min-h-0 flex-1 flex-col md:hidden"
                        >
                            {sidebarContent}
                        </div>
                    )}
                </div>
```

Keep the `error` / `attachmentPreview` / `<ChatInput .../>` markup inside `<div className="flex-1">` exactly as it is today — only its two wrapping `<div>`s changed.

- [ ] **Step 6: Verify lint and build**

Run: `npx eslint src/modules/chat/components/ChatRoomView/index.tsx src/modules/chat/components/ChatHeader/index.tsx src/modules/chat/components/JobFlowSidebar/index.tsx src/modules/chat/components/ChatSidebarTabs/index.tsx`
Expected: 0 errors.

Run: `npm run build`
Expected: completes with no TypeScript errors. A `Property 'onToggleFlow' does not exist` error here means a `ChatHeader` call site was missed.

- [ ] **Step 7: Commit**

```bash
git add src/modules/chat/components/ChatRoomView/index.tsx src/modules/chat/components/ChatHeader/index.tsx src/modules/chat/components/JobFlowSidebar/index.tsx src/modules/chat/components/ChatSidebarTabs/index.tsx
git commit -m "feat(chat): replace the mobile flow slide-over with Chat/Order tabs"
```

---

### Task 5: Dynamic viewport height

`100vh` on mobile browsers counts the space the address bar occupies even while it is collapsed, so the chat column is taller than what is actually visible — the composer sits below the fold and the layout jumps as the bar hides and shows. `100dvh` tracks the real visible area. Tailwind 3.4 supports `dvh` natively.

**Files:**
- Modify: `src/app/[lang]/chat/layout.tsx:74-83`

**Interfaces:**
- Consumes: nothing from earlier tasks. Produces nothing for later tasks.

- [ ] **Step 1: Swap the units**

Replace the fixed container's `className` block with:

```tsx
            <div
                className={`
                    fixed 
                    ${!activeRoomId ? "top-16" : "top-0"}
                    sm:top-20 
                    left-0 right-0 
                    ${!activeRoomId ? "h-[calc(100dvh-56px)]" : "h-[100dvh]"}
                    sm:h-[calc(100dvh-80px)] 
                    overflow-hidden
               `}
            >
```

Three values change and nothing else: `100vh` → `100dvh` twice, and `h-screen` → `h-[100dvh]`.

- [ ] **Step 2: Confirm no `vh` is left in the chat layout**

Run: `grep -n "vh\]" "src/app/[lang]/chat/layout.tsx"`
Expected: only `dvh` matches; no bare `100vh`.

Run: `grep -rn "100vh" src/modules/chat src/app/\[lang\]/chat`
Expected: no matches. (`JobFlowSidebar`'s two `calc(100vh-…)` mobile heights were deleted with the slide-over in Task 4; if this prints anything, that deletion was incomplete.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[lang]/chat/layout.tsx"
git commit -m "fix(chat): size the mobile chat column with dvh instead of vh"
```

---

### Task 6: Update the comments and test that described the old slide-over

Three places document behavior that Task 4 changed. Left alone they are worse than no comment — each one confidently explains a mechanism that no longer exists.

**Files:**
- Modify: `src/modules/chat/components/ChatMediaPanel/index.tsx` (the `onJump` comment)
- Modify: `src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx` (the portal comment)
- Modify: `src/modules/chat/components/JobFlowSidebar/index.test.ts`

**Interfaces:**
- Consumes: `JobFlowSidebar`'s desktop-only markup from Task 4.
- Produces: nothing.

- [ ] **Step 1: Correct the `onJump` comment**

The *code* here is still right — `setOpen(false)` at `< 768` now means "switch back to the Chat tab", which is exactly what jumping to a message should do. Only the description is stale. In `src/modules/chat/components/ChatMediaPanel/index.tsx`, replace the comment inside `onJump` with:

```tsx
            // Spec: "On mobile, jumping closes the drawer or search overlay."
            // Media lives in the mobile Order pane, so without this the pane
            // stayed over the conversation and tapping "Go to message" looked
            // like it had done nothing (Finding 3, FINAL-findings.md). Setting
            // isOpen false is now what selects the Chat tab, which is the same
            // outcome by a different mechanism.
            // 768, not 640: this has to match the breakpoint the Order pane
            // itself switches on (`md:hidden`), not ChatSearchPanel's --
            // Search's overlay is `sm:`-scoped, so its own 640 check is correct
            // for Search but wrong here. Do not "helpfully" realign this to
            // 640; between 640-767px the Order pane is still the visible one.
```

Leave the `if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false);` line itself untouched.

- [ ] **Step 2: Correct the `MediaLightbox` portal comment**

**Keep the portal.** Its original trigger (the slide-over's `translate-x`) is gone, but portalling a full-screen dialog to `<body>` is correct regardless, and it is the kind of thing a future ancestor transform would silently break again. In `src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx`, replace the comment above the `createPortal(` call with:

```tsx
    // Portalled straight to <body>, not rendered in place. This originally
    // fixed a mobile-only crop: the Order pane used to be a slide-over
    // carrying a `translate-x-*` utility, and any non-`none` CSS transform
    // establishes a containing block for `position: fixed` descendants, so
    // this dialog's `fixed inset-0` resolved against the drawer's box instead
    // of the viewport (Finding 2, FINAL-findings.md). That transform is gone
    // now the pane is in-flow, but the portal stays: it is what makes this
    // dialog independent of *any* future transformed ancestor, and the bug it
    // prevents is invisible until someone is looking at a cropped lightbox.
```

- [ ] **Step 3: Update the `JobFlowSidebar` test to the new structure**

The test guards a real invariant that survives this change: the Orders/Media content is mounted in two places at once (the desktop `<aside>`, which stays mounted-but-hidden below `md`, and the mobile Order pane), and `HowToHireGuide` must still open exactly one modal and restore focus to whichever trigger is actually visible. What changed is only *where* the second copy lives — `ChatRoomView` now renders it, not `JobFlowSidebar`.

In `src/modules/chat/components/JobFlowSidebar/index.test.ts`, replace the `SidebarHarness` component and the `getClientRects` mock so the harness reproduces the new arrangement.

Replace the `vi.spyOn(HTMLElement.prototype, "getClientRects")` block in `beforeEach` with:

```ts
        vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
            const inMobilePane = this.closest<HTMLElement>('[data-testid="mobile-order-pane"]') !== null;
            const isVisible = window.innerWidth >= 768 ? !inMobilePane : inMobilePane;
            return (isVisible ? [new DOMRect()] : []) as unknown as DOMRectList;
        });
```

Replace `SidebarHarness` with:

```ts
/**
 * The two places the Orders/Media content is mounted at once, as
 * `ChatRoomView` and `JobFlowSidebar` arrange them: the permanent desktop
 * `<aside>` (still mounted, just `hidden`, below md) and the mobile Order
 * pane. Reproduced here rather than rendering `ChatRoomView`, which would
 * drag in the websocket, workflow and store stack for a question about
 * two DOM copies.
 */
function SidebarHarness() {
    const {setContent, setOpen, content} = useJobFlowSidebar();

    useLayoutEffect(() => {
        setContent(createElement(HowToHireGuide));
        setOpen(true);
        return () => setContent(null);
    }, [setContent, setOpen]);

    return createElement(
        "div",
        null,
        createElement(JobFlowSidebar),
        createElement("div", {"data-testid": "mobile-order-pane", className: "md:hidden"}, content),
    );
}
```

Then update the two lookups in the test body — the desktop one keeps its selector, and the mobile one now reads from the pane:

```ts
        const desktopSidebar = document.querySelector<HTMLElement>(
            'aside[role="complementary"][aria-label="Job Flow Sidebar"]',
        );
        const desktopTrigger = Array.from(desktopSidebar?.querySelectorAll("button") ?? [])
            .find((button) => button.textContent?.includes("How to hire"));
        const mobilePane = document.querySelector<HTMLElement>('[data-testid="mobile-order-pane"]');
        const mobileTrigger = Array.from(mobilePane?.querySelectorAll("button") ?? [])
            .find((button) => button.textContent?.includes("How to hire"));
```

Every assertion below that point stays exactly as written.

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS, including the updated `JobFlowSidebar` test and Tasks 1 and 3's new tests. No test may be skipped or deleted to get green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/chat/components/ChatMediaPanel/index.tsx src/modules/chat/components/ChatMediaPanel/MediaLightbox.tsx src/modules/chat/components/JobFlowSidebar/index.test.ts
git commit -m "test(chat): follow the Order pane out of the slide-over"
```

---

### Task 7: Verify in a real browser at both widths

Unit tests cover the tab bar's behavior and the clamp arithmetic. They cannot show that the panes actually swap, that nothing is clipped, or that desktop is untouched — those are layout facts, and the only honest check is looking.

**Files:** none modified.

**Interfaces:** consumes the finished feature.

- [ ] **Step 1: Start the dev server**

Use the Browser pane's `preview_start` with `{name: "108jobs-clean-dev"}` from `.claude/launch.json`. Do not start a server with Bash. If a server is already running on port 3000 from another session, point the preview at `http://localhost:3000` instead — Next.js refuses a second `next dev` instance.

Navigate to a chat room with an associated job: `/en/chat/message/<roomId>`. Sign-in is required; if no session is available, say so rather than reporting an unverified pass.

- [ ] **Step 2: Check the mobile layout**

`resize_window` to the `mobile` preset (375×812), then reload so any load-time layout settles.

Confirm with `read_page` / `computer {action: "screenshot"}`:
- The Chat | Order tab bar is visible directly under the room header.
- No "Show Flow" / "Hide Flow" button exists anywhere.
- The Chat tab is selected on arrival, and the message list and composer are visible.

- [ ] **Step 3: Check the tab switch**

Click the **Order** tab.

Confirm:
- The Order content fills the area below the tab bar.
- The header and tab bar are still visible above it.
- There is **no** dark backdrop overlaying the screen, and the Order content is not a panel floating over the conversation — the message list and composer are gone from the DOM's visible box, not merely covered.
- There is no "X" close button in the Order pane header.

Click the **Chat** tab and confirm the conversation returns.

- [ ] **Step 4: Check the emoji picker at both edges**

**No longer applicable:** the emoji picker clamp (Task 1) was dropped from this branch, superseded by PR #126 on main -- skip this step.

Back on the Chat tab at 375px wide, click the emoji (smiley) button in the composer.

Run in `javascript_tool`:

```js
const r = document.querySelector('.EmojiPickerReact')?.closest('div[style*="position: fixed"]')?.getBoundingClientRect();
({left: r?.left, top: r?.top, right: r?.right, bottom: r?.bottom, vw: innerWidth, vh: innerHeight});
```

Expected: `left >= 0`, `top >= 0`, `right <= vw`, `bottom <= vh`. Any negative or overflowing value means the clamp is not applied.

- [ ] **Step 5: Check the console and desktop**

Run `read_console_messages` with `onlyErrors: true`. Expected: no errors — in particular no "Maximum update depth exceeded" and no React key/prop warnings from the new tab bar.

Then `resize_window` to the `desktop` preset and reload. Confirm:
- The tab bar is **not** visible.
- The Order/Media sidebar is a permanent panel on the right.
- The conversation and composer render beside it, unchanged.

- [ ] **Step 6: Final gates**

Run: `npm run test:unit`
Expected: PASS.

Run: `npm run build`
Expected: completes with no errors.

Run: `git status`
Expected: no unintended files staged. `next-env.d.ts` and `tsconfig.tsbuildinfo` are gitignored build artifacts — if they show as modified, restore them rather than committing them.

- [ ] **Step 7: Open the pull request**

This is a feature, not a bug fix, so the repo's issue-first rule does not apply — no `Fixes #N` line is needed. Push the branch and open a PR against `main` summarizing the four changes and listing the browser checks from Steps 2–5 as the test plan.

Note for whoever opens it: CI's self-hosted runner was not picking up jobs as of 2026-08-29, so `npm run test:unit` and `npm run build` above are the real gate. Say so in the PR rather than implying CI verified the change.

---

## Self-Review

**Spec coverage.** Design doc section 1 (tab bar) → Tasks 2, 3, 4. Section 2 (emoji clamp) → Task 1. Section 3 (`100dvh`) → Task 5. Section 4 (safe-area padding) → Task 4, Step 5. The spec's "Out of scope" list is respected: no task touches `ChatMessageBubble`, `ChatRoomMessages`, header typography, or `ChatInput` styling.

**Deviation from the spec, deliberate.** The spec described the mobile pane as `JobFlowSidebar` switching from `fixed` to in-flow. That is not achievable where it stands: `JobFlowSidebar` is a sibling of `<main>`, while the header the pane must sit *below* is inside `ChatRoomView` inside `<main>`. Keeping it there would have required either magic-number `top-[Npx]` offsets matching the header height, or hoisting `ChatHeader` out of `ChatRoomView`. Task 4 instead renders the mobile pane inside `ChatRoomView`, which gets the ordering from ordinary flex layout with no hardcoded heights. Same user-visible result as the spec describes.

**Known imperfection, accepted.** `role="tabpanel"` stays on the chat pane at desktop widths, where the tablist that labels it is `display: none`. Making it viewport-conditional would need a JS media query and a re-render on resize — more moving parts than the imperfection costs. It degrades to an unlabelled region.

**Type consistency.** `ChatRoomTab` is `"chat" | "order"` in Task 3 and used with exactly those literals in Task 4. `clampPickerPosition`'s parameter names match between Task 1's test, its implementation, and its `ChatInput` call site. The ids `chat-room-tab-{chat,order}` and `chat-room-panel-{chat,order}` are consistent between Task 3's `aria-controls` and Task 4's panes. `profileChat.tabChat` / `profileChat.tabOrder` are spelled identically in Task 2 and Task 3.
