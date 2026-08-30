# Chat Mobile Responsive: App-Style Tabs

## Status (2026-08-30): three of the four changes shipped separately

While this was being implemented, fixes for items 2, 3 and 4 below were written
independently and merged to `main` as PRs #126, #127 and #128, closing issues #123, #124
and #125. **Only item 1 — the Chat | Order tab bar — is still delivered by this work.**

- Item 2 (emoji picker clamp) → superseded by #126.
- Item 3 (`100dvh`) → superseded by #127.
- Item 4 (composer safe-area padding) → superseded by #128, whose implementation is
  better than the one designed here: it folds the inset into the existing responsive
  padding with `pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]` instead of adding a
  wrapper element. This branch adopts main's version verbatim.

One caveat recorded during that work and still open: `env(safe-area-inset-bottom)`
resolves to `0` on iOS unless the viewport declares `viewportFit: "cover"`, which this
repo does nowhere. #125 is closed, but its symptom likely still reproduces. See the
comment on that issue.

The rest of this document is the design as originally approved, kept as the record of
why the tab bar is shaped the way it is.

## Scope

Make the job-board chat's mobile web layout (`/[lang]/chat/message/[roomId]`) behave more like the
108Heros mobile app's chat screen, at the `md` breakpoint (768px) and below. Desktop layout is
unchanged. Four independent fixes:

1. Replace the mobile "Show Flow" toggle button + slide-over drawer with a persistent
   Chat | Order tab bar under the header.
2. Fix the emoji picker's fixed-pixel positioning going off-screen on narrow viewports.
3. Switch `100vh`-based heights in the chat layout to `100dvh` so mobile browser chrome
   (address bar show/hide) doesn't clip or jump the layout.
4. Add bottom safe-area padding to the composer for notched/home-indicator devices.

Reference for "mobile app style": `108heros-flutter-dev`'s chat UI shell (`ChatAppBar`,
`ChatWebStyle`, `InputBar`). Its job/order workflow content was removed from that app in a
prior split (#531), so only the structural/visual patterns are being followed here, not any
literal job-flow content — the job-flow content itself is web's own existing
`ChatSidebarTabs`/`JobFlowContent`, unchanged.

## Approved behavior

### 1. Chat | Order tab bar

- On mobile (`md:hidden`), a two-tab strip renders directly under `ChatHeader`: **Chat** and
  **Order**, styled with a bottom-border indicator in the primary color when selected —
  matching the mobile app's `TabBar` (`labelColor`/`indicatorColor: primary`,
  `indicatorWeight: 2`).
- The tab bar drives the existing `isFlowOpen`/`setOpen` state from `JobFlowSidebarContext`
  (already mobile-only in meaning: desktop's static sidebar ignores it entirely). `isFlowOpen
  === false` → Chat tab selected; `true` → Order tab selected. No new state is introduced.
- `ChatHeader` loses its "Show Flow"/"Hide Flow" button (`onToggleFlow`/`isFlowOpen` props and
  the button UI removed).
- `JobFlowSidebar`'s mobile branch changes from a `fixed` slide-over with `translate-x`
  animation and a backdrop, to a normal in-flow full-width panel: shown (`flex`) when
  `isOpen`, hidden (`hidden`) otherwise. No `fixed`, no `z-40` backdrop, no transform.
- The message list + composer area in `ChatRoomView` gets a matching mobile visibility rule:
  hidden when `isFlowOpen` is true on mobile, always visible on desktop (`md:flex` regardless
  of state) — the two panes become mutually exclusive on mobile instead of one overlaying the
  other.
- `ChatSidebarTabs`' mobile-only "X" close button is removed: with a persistent tab bar as the
  single source of navigation between Chat and Order, a second, redundant "close" affordance
  invites two different mental models for the same action. Its own inner Orders/Media tabs are
  unchanged.
- Desktop (`md:` and up): no visible change. The sidebar keeps rendering statically regardless
  of `isFlowOpen`, exactly as today.

New/changed i18n keys under `profileChat` (en/th/vi — `src/translations/{en,th,vi}.ts`):
- `tabChat`: "Chat" tab label.
- `tabOrder`: "Order" tab label (kept distinct from the existing `orders`/"Orders" key used by
  the inner sidebar tab — same word, different UI element, no forced reuse).

### 2. Emoji picker viewport clamping

In `ChatInput`, the effect that positions the emoji picker (currently `top = button.top - 410`,
`left = button.left - 280`) additionally clamps both axes into the visible viewport:

```
left = clamp(desiredLeft, 8, window.innerWidth - pickerWidth - 8)
top  = clamp(desiredTop, 8, window.innerHeight - pickerHeight - 8)
```

using the picker's own fixed 320×400 size. This changes only the position math; the picker's
open/close triggers and outside-click handling are untouched.

### 3. `100vh` → `100dvh`

Every `vh`-based height in `src/app/[lang]/chat/layout.tsx` (the two `h-screen`/
`h-[calc(100vh-56px)]`-style rules driving the fixed content area) and in `JobFlowSidebar`'s
mobile panel height (`h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)]`) is changed to the `dvh`
equivalent. Pure value swap — no other layout rule changes.

### 4. Composer safe-area padding

The input container in `ChatRoomView`
(`<div ref={inputContainerRef} className="border-t px-3 py-2 sm:px-4 sm:py-3 bg-white">`) gets
additional bottom padding of `env(safe-area-inset-bottom)`, added via an inline style or a small
utility class, stacked on top of the existing `py-2`/`py-3`. Evaluates to `0` on browsers/devices
without a safe-area inset, so no visible change outside notched/home-indicator mobile contexts.

## Out of scope

- Any change to message bubble rendering, `ChatMessageBubble`, or `ChatRoomMessages`.
- Any visual/typography change to `ChatHeader`'s avatar/name/typing row, or to `ChatInput`'s
  icon/border styling.
- Any change to `ChatSidebarTabs`' inner Orders/Media tab behavior beyond removing the mobile
  "X" button.
- Any behavior change on desktop viewports.

## Verification

- Unit/component test coverage for: tab bar selection driving `isFlowOpen`, mutual exclusivity
  of the message pane vs. flow pane on mobile, and the emoji picker's clamped position at a
  narrow viewport width.
- `npm run build` and `eslint` on touched files stay clean.
- Manual check in the browser pane at a mobile viewport width (e.g. 375px): confirm the tab bar
  switches views with no overlay/backdrop, the emoji picker stays fully on-screen near both
  screen edges, the layout doesn't clip/jump when the simulated mobile chrome is toggled, and
  desktop viewport (≥768px) is pixel-unchanged from before.
