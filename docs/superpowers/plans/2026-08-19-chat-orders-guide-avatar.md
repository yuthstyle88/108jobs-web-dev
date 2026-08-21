# Chat Orders Guide and Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put hiring help in the active room’s Orders tab, preserve linked-job workflow with a Job Details action, and prevent incoming avatars from stretching.

**Architecture:** `JobFlowContent` selects between a no-job `HowToHireGuide` and the existing linked-job workflow. `ChatRoomView` supplies the job ID and locale, while a focused `ChatMessageAvatar` component plus the Tailwind content-path correction owns avatar sizing.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 3, Vitest/JSDOM, in-app browser verification.

**Spec:** `docs/superpowers/specs/2026-08-19-chat-orders-guide-avatar-design.md`

## Global Constraints

- Work only in `.worktrees/chat-orders-guide-avatar-fix`, based on the latest `origin/main`.
- Preserve the existing `FreelanceChatFlow` behavior for rooms with a linked job.
- Use the existing locale route `/${lang}/job-board/${jobId}` and existing `profileChat.jobDetails` translation.
- Reuse the existing `HowToHireModal` and `profileChat.howToHire` translations.
- Fixes must reference GitHub issues #76 and #77 when opened as a pull request.

---

### Task 1: Orders content branching

**Files:**
- Create: `src/modules/chat/components/HowToHireGuide/index.tsx`
- Create: `src/modules/chat/components/JobFlowContent/index.test.ts`
- Modify: `src/modules/chat/components/JobFlowContent/index.tsx`
- Modify: `src/modules/chat/components/ChatRoomView/index.tsx`
- Modify: `src/app/[lang]/chat/page.tsx`

**Interfaces:**
- Consumes: `HowToHireModal`, `profileChat.howToHire.*`, `profileChat.jobDetails`, `post?.id ?? currentRoom.room.postId`, and the existing `renderFlowContent()` callback.
- Produces: `JobFlowContent({renderFlowContent, jobId, lang})`, with mutually exclusive no-job guide and linked-job workflow states.

- [ ] **Step 1: Write the failing Orders regression tests**

Use `createElement` and `renderToStaticMarkup` to assert that no `jobId` renders the hiring prompt without the flow sentinel, while `jobId={731}` renders the sentinel and an anchor with `href="/en/job-board/731"` without the hiring prompt.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test:unit -- src/modules/chat/components/JobFlowContent/index.test.ts`

Expected: FAIL because `JobFlowContent` does not yet accept job metadata or render the guide/details action.

- [ ] **Step 3: Implement the minimal Orders branch**

Create `HowToHireGuide` by moving the prompt state, translated copy construction, trigger, and existing modal out of the top-level chat page. Update `JobFlowContent` so its essential branch is:

```tsx
if (!jobId) return <HowToHireGuide />;

return (
  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
    <Link href={`/${lang}/job-board/${jobId}`}>{t("profileChat.jobDetails")}</Link>
    {renderFlowContent()}
  </div>
);
```

Derive `roomPostId` from `post?.id ?? currentRoom.room.postId`, pass it with `lang` from `ChatRoomView`, and restore `/[lang]/chat` to its neutral select-conversation placeholder.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm test:unit -- src/modules/chat/components/JobFlowContent/index.test.ts src/modules/chat/components/HowToHireModal/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the Orders behavior**

```bash
git add docs/superpowers src/app/[lang]/chat/page.tsx src/modules/chat/components/HowToHireGuide src/modules/chat/components/JobFlowContent src/modules/chat/components/ChatRoomView/index.tsx
git commit -m "fix(chat): move hiring guide into orders"
```

### Task 2: Stable incoming avatars

**Files:**
- Create: `src/modules/chat/components/ChatMessageAvatar/index.tsx`
- Create: `src/modules/chat/components/ChatMessageAvatar/index.test.ts`
- Create: `src/tailwind.config.test.ts`
- Modify: `src/modules/chat/components/ChatMessageBubble/index.tsx`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Consumes: `partnerAvatar?: string`, the existing default avatar asset, and Tailwind responsive sizing.
- Produces: `ChatMessageAvatar({src})`, a fixed 28px mobile/32px desktop, non-shrinking, cover-fitted avatar.

- [ ] **Step 1: Write the failing avatar regressions**

Render `ChatMessageAvatar` to static markup and assert the outer element has `shrink-0`, fixed responsive size, circular clipping, and the image has `object-cover`. Import the Tailwind config and assert its `content` includes `./src/modules/**/*.{js,ts,jsx,tsx,mdx}`.

- [ ] **Step 2: Run both tests and verify RED**

Run: `pnpm test:unit -- src/modules/chat/components/ChatMessageAvatar/index.test.ts src/tailwind.config.test.ts`

Expected: FAIL because the focused avatar component and module scan path do not exist.

- [ ] **Step 3: Implement the stable avatar**

Add the modules glob to `tailwind.config.ts`. Render incoming avatars through a fixed wrapper:

```tsx
<span className="relative mr-2 size-7 shrink-0 self-end overflow-hidden rounded-full sm:mr-3 sm:size-8">
  <Image fill sizes="(min-width: 640px) 2rem, 1.75rem" className="object-cover" />
</span>
```

Replace the bare incoming `Image` in `ChatMessageBubble` with `ChatMessageAvatar`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm test:unit -- src/modules/chat/components/ChatMessageAvatar/index.test.ts src/tailwind.config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the avatar behavior**

```bash
git add tailwind.config.ts src/tailwind.config.test.ts src/modules/chat/components/ChatMessageAvatar src/modules/chat/components/ChatMessageBubble/index.tsx
git commit -m "fix(chat): keep message avatars square"
```

### Task 3: Integrated verification

**Files:**
- Modify only if verification exposes an in-scope regression.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: evidence that the combined chat experience behaves correctly.

- [ ] **Step 1: Run focused and full automated checks**

Run `pnpm test:unit`, `pnpm lint`, `pnpm build`, and `git diff --check`.

- [ ] **Step 2: Verify the supplied room in a browser**

Start the worktree on an unused local port. Confirm that the Orders tab shows the hiring guide for a room without a linked job, the modal opens and closes, every incoming avatar remains square beside tall media, and older-history loading does not jump the viewport.

- [ ] **Step 3: Verify responsive behavior**

Repeat the Orders, modal, avatar, and scroll checks at a narrow mobile viewport, including the sidebar drawer.

- [ ] **Step 4: Review the final diff**

Check issue coverage, accessibility, locale-aware routing, unchanged existing workflow behavior, and unrelated-file cleanliness before handoff.
