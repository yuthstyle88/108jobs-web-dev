# Wire-Event Naming Alignment (Stage 1) Implementation Plan

> **Completed, and superseded in part (2026-08-07) by
> [`../specs/2026-08-07-chat-wire-v2.md`](../specs/2026-08-07-chat-wire-v2.md).**
> Do not execute this plan again. Its event names all still hold, but every
> step below that names Phoenix is stale: the `phoenix` npm client and the
> `phx_join`/`phx_leave`/`phx_reply` wire strings are gone, `PhoenixEvent` is
> now `ChatWireEvent`, and `PhoenixSocketService` is `ChatSocketService`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every WebSocket wire-protocol event-name string this frontend sends or matches identical to api-108heros's `ChatEvent::as_str()` canonical values, sourced from one new constant module, with real unit tests proving the contract — not just inspection.

**Architecture:** A new module, `src/modules/chat/protocol/wireEvents.ts`, exports `WS_EVENT` — a frozen const object mirroring the backend's `ChatEvent` enum variant-for-variant. Every file that currently references a wire-protocol event name as an inline string literal switches to reference `WS_EVENT.X` instead. `types/common.ts`'s `PhoenixEvent` type union and `EVENTS` array are extended (additively — nothing existing is removed except one confirmed-dead typo) to include every `WS_EVENT` value. A new Vitest setup provides real unit tests: a contract test pinning `WS_EVENT`'s values, a no-stray-literal regression test, and behavioral tests on the outbound builders.

**Tech Stack:** TypeScript, Next.js 16, React 19, Vitest (new).

## Global Constraints

- `WS_EVENT`'s values must exactly match api-108heros's `ChatEvent::as_str()` (`crates/ws/src/protocol/impls.rs` in the api-108heros repo, already verified during design): `PhxJoin: "phx_join"`, `PhxLeave: "phx_leave"`, `Heartbeat: "heartbeat"`, `Message: "chat:message"`, `MessageAck: "messageAck"`, `AckConfirm: "ackConfirm"`, `SyncPending: "sync:pending"`, `ReadUpTo: "readUpTo"`, `ActiveRooms: "chat:activeRooms"`, `Typing: "chat:typing"`, `TypingStart: "typing:start"`, `TypingStop: "typing:stop"`, `Update: "chat:update"`, `ChatsSignal: "chats:signal"`, `GlobalOnline: "globalOnline"`, `GlobalOffline: "globalOffline"`.
- `src/modules/chat/events/chatEvents.ts`'s `CHAT_EVENT` constant is a **separate, unrelated concern** (in-browser DOM `CustomEvent` names for cross-component signaling) — it must not be touched or conflated with `WS_EVENT`.
- The `ackReminder` branch in `handleWSMessage.ts` is confirmed dead code (the backend sends its reminder under `"sync:pending"`, never `"ackReminder"` — see the design spec's Finding section). This plan documents that fact with a code comment; it does **not** rewire the branch to fire, since that would be a behavior change outside this stage's scope.
- No unit-testing framework exists in this project today (only Playwright E2E, no chat coverage). This plan adds Vitest as a new dev dependency.
- This repo's path alias `@/*` maps to `./src/*` (`tsconfig.json`). Vitest config must resolve this the same way `next dev`/`tsc` do.
- Every existing `PhoenixEvent` union member is preserved except `"phxElose"` (a confirmed, zero-usage typo for "phxClose" — verified via a repo-wide grep finding it referenced only in its own type declaration, never compared against anywhere) — this plan removes only that one entry, nothing else.
- Standing verification for this repo: `npx tsc --noEmit` (type-check) and the new `npm run test:unit` (or `pnpm test:unit`, matching this repo's `packageManager: pnpm@8.15.4`) must both pass clean before every commit in this plan.

---

### Task 1: Add Vitest and create `WS_EVENT` with a contract test

**Files:**
- Create: `src/modules/chat/protocol/wireEvents.ts`
- Create: `src/modules/chat/protocol/wireEvents.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (new devDependencies + `test:unit` script)

**Interfaces:**
- Produces: `export const WS_EVENT: Readonly<{ PhxJoin: "phx_join"; PhxLeave: "phx_leave"; Heartbeat: "heartbeat"; Message: "chat:message"; MessageAck: "messageAck"; AckConfirm: "ackConfirm"; SyncPending: "sync:pending"; ReadUpTo: "readUpTo"; ActiveRooms: "chat:activeRooms"; Typing: "chat:typing"; TypingStart: "typing:start"; TypingStop: "typing:stop"; Update: "chat:update"; ChatsSignal: "chats:signal"; GlobalOnline: "globalOnline"; GlobalOffline: "globalOffline"; }>` — every later task imports this from `@/modules/chat/protocol/wireEvents`.

- [ ] **Step 1: Add Vitest to `package.json`**

Add to `devDependencies` (alongside the existing `playwright` entry):

```json
"vitest": "^3.2.4",
"vite-tsconfig-paths": "^5.1.4"
```

Add to `scripts` (alongside the existing `"test": "playwright test"`):

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

Run: `pnpm install`
Expected: `vitest` and `vite-tsconfig-paths` appear in `node_modules/.pnpm` and `package-lock.json`/`pnpm-lock.yaml` are updated.

- [ ] **Step 2: Add `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

This resolves the `@/*` alias from `tsconfig.json` the same way `next dev`/`tsc` do, via the `vite-tsconfig-paths` plugin — no manual alias duplication.

- [ ] **Step 3: Write the failing contract test**

```typescript
// src/modules/chat/protocol/wireEvents.test.ts
import { describe, expect, it } from "vitest";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";

// Pins this frontend's wire-protocol event names to api-108heros's
// ChatEvent::as_str() (crates/ws/src/protocol/impls.rs) -- one assertion per
// variant, so a change to either side that isn't mirrored here fails loudly
// instead of silently drifting (the exact failure mode that caused real,
// silently-dropped-message bugs before api-108heros PR #132).
describe("WS_EVENT matches the backend's ChatEvent::as_str() exactly", () => {
  it("PhxJoin is the real phoenix.js wire format", () => {
    expect(WS_EVENT.PhxJoin).toBe("phx_join");
  });

  it("PhxLeave is the real phoenix.js wire format", () => {
    expect(WS_EVENT.PhxLeave).toBe("phx_leave");
  });

  it("Heartbeat", () => {
    expect(WS_EVENT.Heartbeat).toBe("heartbeat");
  });

  it("Message", () => {
    expect(WS_EVENT.Message).toBe("chat:message");
  });

  it("MessageAck (inbound only, server->client)", () => {
    expect(WS_EVENT.MessageAck).toBe("messageAck");
  });

  it("AckConfirm (outbound, client->server)", () => {
    expect(WS_EVENT.AckConfirm).toBe("ackConfirm");
  });

  it("SyncPending", () => {
    expect(WS_EVENT.SyncPending).toBe("sync:pending");
  });

  it("ReadUpTo matches the backend's canonical outgoing string", () => {
    expect(WS_EVENT.ReadUpTo).toBe("readUpTo");
  });

  it("ActiveRooms", () => {
    expect(WS_EVENT.ActiveRooms).toBe("chat:activeRooms");
  });

  it("Typing", () => {
    expect(WS_EVENT.Typing).toBe("chat:typing");
  });

  it("TypingStart", () => {
    expect(WS_EVENT.TypingStart).toBe("typing:start");
  });

  it("TypingStop", () => {
    expect(WS_EVENT.TypingStop).toBe("typing:stop");
  });

  it("Update", () => {
    expect(WS_EVENT.Update).toBe("chat:update");
  });

  it("ChatsSignal", () => {
    expect(WS_EVENT.ChatsSignal).toBe("chats:signal");
  });

  it("GlobalOnline", () => {
    expect(WS_EVENT.GlobalOnline).toBe("globalOnline");
  });

  it("GlobalOffline", () => {
    expect(WS_EVENT.GlobalOffline).toBe("globalOffline");
  });

  it("is frozen (Object.freeze) so no call site can mutate a shared value", () => {
    expect(Object.isFrozen(WS_EVENT)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit`
Expected: FAIL — `Cannot find module '@/modules/chat/protocol/wireEvents'` (the module doesn't exist yet).

- [ ] **Step 3: Create `WS_EVENT`**

```typescript
// src/modules/chat/protocol/wireEvents.ts
/**
 * WebSocket wire-protocol event names, mirroring api-108heros's ChatEvent
 * enum variant-for-variant (crates/ws/src/protocol/api.rs's enum definition,
 * crates/ws/src/protocol/impls.rs's ChatEvent::as_str()/FromStr). A developer
 * working on either side of the wire can look up a name here and find the
 * exact match on the other.
 *
 * Separate from `src/modules/chat/events/chatEvents.ts`'s `CHAT_EVENT`
 * constant, which is an unrelated concern: in-browser DOM CustomEvent names
 * for cross-component signaling within this frontend, not the WebSocket
 * wire protocol.
 *
 * PhxJoin/PhxLeave's values are the real `phoenix` npm client library's own
 * hardcoded wire format (sent internally by Channel.join()/.leave(), not by
 * this frontend's own code) -- included here for documentation/completeness
 * so any code that needs to recognize these frames references this constant
 * instead of a bare literal.
 */
export const WS_EVENT = Object.freeze({
  PhxJoin: "phx_join",
  PhxLeave: "phx_leave",
  Heartbeat: "heartbeat",
  Message: "chat:message",
  MessageAck: "messageAck",
  AckConfirm: "ackConfirm",
  SyncPending: "sync:pending",
  ReadUpTo: "readUpTo",
  ActiveRooms: "chat:activeRooms",
  Typing: "chat:typing",
  TypingStart: "typing:start",
  TypingStop: "typing:stop",
  Update: "chat:update",
  ChatsSignal: "chats:signal",
  GlobalOnline: "globalOnline",
  GlobalOffline: "globalOffline",
} as const);

export type WsEventValue = (typeof WS_EVENT)[keyof typeof WS_EVENT];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit`
Expected: `wireEvents.test.ts` — 16 passed.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/modules/chat/protocol/wireEvents.ts src/modules/chat/protocol/wireEvents.test.ts
git commit -m "feat(chat): add Vitest + WS_EVENT constant mirroring the backend's ChatEvent"
```

---

### Task 2: Extend `PhoenixEvent`/`EVENTS` and switch `sendEvents.ts` (+ the coupled `chat:read` emitter pair) to `WS_EVENT`

**Files:**
- Modify: `src/modules/chat/types/common.ts`
- Modify: `src/modules/chat/events/sendEvents.ts`
- Modify: `src/modules/chat/utils/chatSocketUtils.ts` (one call site only — `makeEmitReadAcker`'s `emit('chat:read', ...)` call; its other call sites are Task 3's job)
- Modify: `src/modules/chat/utils/socket-emitter.ts`
- Test: `src/modules/chat/events/sendEvents.test.ts` (new)

**Interfaces:**
- Consumes: `WS_EVENT` (Task 1).
- Produces: `PhoenixEvent` now includes every `WsEventValue`; `sendReadReceipt`/`sendDeliveryAck` now emit `WS_EVENT.ReadUpTo`/`WS_EVENT.AckConfirm` instead of `'chat:readUpTo'`/`'chat:ack'`; the coupled `makeEmitReadAcker`/`makeReadAckEmitter` pair (used together in `useChatRoom.ts`) now uses `WS_EVENT.ReadUpTo` instead of the third, previously-undiscovered `'chat:read'` literal — after this task, `"chat:read"` has zero remaining real call sites in the codebase.

- [ ] **Step 1: Write the failing behavioral tests**

```typescript
// src/modules/chat/events/sendEvents.test.ts
import { describe, expect, it, vi } from "vitest";
import { sendDeliveryAck, sendReadReceipt, sendTyping } from "@/modules/chat/events/sendEvents";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";

// A fake adapter that just records what gets pushed, so these tests assert
// on the actual packet.event value sendEvents.ts constructs -- not on the
// string literal in the test itself, which wouldn't catch a typo'd literal
// still lingering in the source.
function fakeAdapter() {
  const sent: Array<{ event: unknown; payload: unknown }> = [];
  return {
    sent,
    adapter: {
      send: vi.fn(),
      emit: (event: string, payload: unknown) => {
        sent.push({ event, payload });
      },
    },
  };
}

describe("sendEvents.ts outbound builders use WS_EVENT, not re-typed literals", () => {
  it("sendReadReceipt emits WS_EVENT.ReadUpTo", () => {
    const { adapter, sent } = fakeAdapter();
    sendReadReceipt({ roomId: "room1", senderId: 1 as any, adapter }, "msg-123");
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe(WS_EVENT.ReadUpTo);
  });

  it("sendDeliveryAck emits WS_EVENT.AckConfirm", () => {
    const { adapter, sent } = fakeAdapter();
    sendDeliveryAck({ roomId: "room1", senderId: 1 as any, adapter }, "msg-123");
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe(WS_EVENT.AckConfirm);
  });

  it("sendTyping emits WS_EVENT.Typing", () => {
    const { adapter, sent } = fakeAdapter();
    sendTyping({ roomId: "room1", senderId: 1 as any, adapter }, true);
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe(WS_EVENT.Typing);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit`
Expected: FAIL — `sent[0].event` is `"chat:readUpTo"` (not `WS_EVENT.ReadUpTo` = `"readUpTo"`) for the read-receipt test; `"chat:ack"` (not `WS_EVENT.AckConfirm`) for the delivery-ack test. The typing test passes already (no change needed there, but keep it as a regression guard going forward).

- [ ] **Step 3: Extend `PhoenixEvent` and `EVENTS` in `types/common.ts`**

Replace the current `EVENTS` array and `PhoenixEvent` type (currently lines 26-51) with:

```typescript
import type { WsEventValue } from "@/modules/chat/protocol/wireEvents";

export const EVENTS = [
    'phxReply',
    'forward',
    'historyPage',
];

export type PhoenixEvent =
  | WsEventValue
  | "phxJoin"
  | "phxLeave"
  | "phxReply"
  | "phxError"
  | "forward"
  | "historyPage";
```

(`EVENTS`, the array, has zero importers anywhere in this codebase besides its own declaration -- confirmed via a repo-wide search -- so it's safe to trim to just the non-`WS_EVENT` markers; nothing depends on its previous contents. The type union `PhoenixEvent` keeps every existing member except the confirmed-dead `"phxElose"` typo, and gains every `WS_EVENT` value via `WsEventValue`. `"chat:readUpTo"` and `"chat:ack"` are dropped from the literal list since `WsEventValue` already provides their canonical replacements (`ReadUpTo`/`AckConfirm`). `"chat:read"` is also dropped here -- Step 4 below confirms it has real call sites elsewhere that get fixed, after which it has zero remaining real usages in the codebase.)

Add the top-of-file import (near the existing `ChatMessage, LocalUserId` import):

```typescript
import type { WsEventValue } from "@/modules/chat/protocol/wireEvents";
```

- [ ] **Step 4: `"chat:read"` has a real, active call site — fix it here, not just in the type**

Investigation found `"chat:read"` is not just a type-union entry: it's actively sent over the wire via a coupled pair of functions used together in `useChatRoom.ts`:

```typescript
// useChatRoom.ts:256-257 (context only, not modified by this task)
const emit = makeReadAckEmitter(((ws as any)?.adapter ?? ws) as any, Number(localUser.id) || 0);
const baseAcker = makeEmitReadAcker(emit, roomId, 0);
```

`makeEmitReadAcker` (`src/modules/chat/utils/chatSocketUtils.ts`) calls `emit('chat:read', payload)` — and that `emit` argument is exactly `makeReadAckEmitter`'s (`src/modules/chat/utils/socket-emitter.ts`) returned function, whose body only normalizes payload keys `if (evt === 'chat:read')`. These two literals **must change together** — if only one changes, the normalization logic silently stops firing for a value the other side no longer sends. This is a second, previously-undiscovered wire-string call site for the same read-receipt concept as `sendReadReceipt` (Task 2 Step 5), now sending a **third** distinct string (`chat:read`) for it. The backend already accepts `"chat:read"` as a legacy alias for `ReadUpTo` (confirmed during design), so this isn't currently silently broken — but it should align to the same canonical string as everything else.

In `src/modules/chat/utils/chatSocketUtils.ts`, add the import (alongside the one added in this task's Step 3):
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```
(if not already added by Step 3 above — check first, don't duplicate the import statement)

Change (currently line 650):
```typescript
                emit('chat:read', payload);
```
to:
```typescript
                emit(WS_EVENT.ReadUpTo, payload);
```

In `src/modules/chat/utils/socket-emitter.ts`, add the import (at the top of the file):
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```

Change (currently line 23):
```typescript
    // Normalize only for chat:read — backend expects camelCase keys: roomId, readerId, lastReadMessageId
    if (evt === 'chat:read') {
```
to:
```typescript
    // Normalize only for WS_EVENT.ReadUpTo — backend expects camelCase keys: roomId, readerId, lastReadMessageId
    if (evt === WS_EVENT.ReadUpTo) {
```

With this fix in place, `"chat:read"` has zero remaining real call sites in this codebase (only its `types/common.ts` declarations and `chatEvents.ts`'s unrelated `CHAT_EVENT.READ` DOM-event constant, which is explicitly out of scope). Drop `"chat:read"` from the `PhoenixEvent` union entirely — it is fully superseded by `WsEventValue`'s `ReadUpTo` (`"readUpTo"`). Re-verify with:
```bash
grep -rn "'chat:read'\|\"chat:read\"" src/modules/chat/
```
Expected: only `types/common.ts` (if you haven't yet removed the declaration — remove it now) and `chatEvents.ts:20`'s unrelated `CHAT_EVENT.READ: 'chat:read'` (leave that one; it's the separate DOM-event constant, not a wire string).

- [ ] **Step 5: Switch `sendEvents.ts` to `WS_EVENT`**

At the top of the file, add:
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```

Change (currently lines 36, 42, 55, 65, 89):
```typescript
    wsSend(a, createEvent('chat:typing', {typing, senderId: deps.senderId, roomId: deps.roomId}));
```
to:
```typescript
    wsSend(a, createEvent(WS_EVENT.Typing, {typing, senderId: deps.senderId, roomId: deps.roomId}));
```

```typescript
    const pkt = createEvent('chat:readUpTo', {
```
to:
```typescript
    const pkt = createEvent(WS_EVENT.ReadUpTo, {
```

```typescript
    wsSend(a, createEvent('chat:update', {roomId: deps.roomId, ...update}));
```
to:
```typescript
    wsSend(a, createEvent(WS_EVENT.Update, {roomId: deps.roomId, ...update}));
```

```typescript
    const pkt = createEvent('chat:ack', {
```
to:
```typescript
    const pkt = createEvent(WS_EVENT.AckConfirm, {
```

```typescript
        const result = await s.sendMessage('chat:message', msg);
```
to:
```typescript
        const result = await s.sendMessage(WS_EVENT.Message, msg);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test:unit`
Expected: `sendEvents.test.ts` — 3 passed. `wireEvents.test.ts` — still 16 passed (regression check).

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/chat/types/common.ts src/modules/chat/events/sendEvents.ts src/modules/chat/events/sendEvents.test.ts src/modules/chat/utils/chatSocketUtils.ts src/modules/chat/utils/socket-emitter.ts
git commit -m "feat(chat): switch sendEvents.ts + the coupled chat:read emitter pair to WS_EVENT

makeEmitReadAcker (chatSocketUtils.ts) and makeReadAckEmitter
(socket-emitter.ts) are chained together in useChatRoom.ts and were
sending/matching a third, previously-undiscovered literal ('chat:read')
for the same read-receipt concept sendReadReceipt already sends via
WS_EVENT.ReadUpTo. Both sides of the pair updated together so the
normalization logic keeps firing."
```

---

### Task 3: Switch remaining inbound/outbound literals to `WS_EVENT`

**Files:**
- Modify: `src/modules/chat/services/PhoenixSocketService.ts`
- Modify: `src/modules/chat/utils/helpers.ts`
- Modify: `src/modules/chat/utils/chatSocketUtils.ts`
- Modify: `src/modules/chat/events/handleWSMessage.ts`

**Interfaces:**
- Consumes: `WS_EVENT` (Task 1).
- Produces: nothing new — this task only changes references, not behavior (every string value referenced already matches `WS_EVENT`'s values exactly; this is a pure rename).

- [ ] **Step 1: `PhoenixSocketService.ts`**

Add the import (near the existing `buildActixWsUrl` import):
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```

Change (currently lines 28-31):
```typescript
const isInternalEvent = (ev?: string): boolean => !!ev && (
    ev.startsWith("chan_reply") || ev === "heartbeat" || ev === "presence_state" || ev === "presence_diff" ||
    ev === "phx_reply" || ev === "phx_error" || ev === "phx_leave"
);
```
to:
```typescript
const isInternalEvent = (ev?: string): boolean => !!ev && (
    ev.startsWith("chan_reply") || ev === WS_EVENT.Heartbeat || ev === "presence_state" || ev === "presence_diff" ||
    ev === "phx_reply" || ev === "phx_error" || ev === WS_EVENT.PhxLeave
);
```
(`"phx_reply"`/`"phx_error"`/`"presence_state"`/`"presence_diff"`/`"chan_reply"` are Phoenix transport-level or presence-library concepts with no corresponding `ChatEvent` variant on the backend -- left as literals, out of scope for this mirror.)

Change (currently line 62):
```typescript
            (ch as any).push("chat:message", payload);
```
to:
```typescript
            (ch as any).push(WS_EVENT.Message, payload);
```

Change (currently line 106):
```typescript
            (ch as any).push("ackConfirm", { roomId, senderId, clientIds });
```
to:
```typescript
            (ch as any).push(WS_EVENT.AckConfirm, { roomId, senderId, clientIds });
```

Change (currently lines 75-79, `sendHeartbeat`'s body):
```typescript
        sendHeartbeat(payload?: Record<string, any>) {
            const base = { senderId, event: "heartbeat" };
            const merged = typeof payload === 'object' && payload ? { ...base, ...payload } : base;
            try {
                ch.push("heartbeat", merged);
```
to:
```typescript
        sendHeartbeat(payload?: Record<string, any>) {
            const base = { senderId, event: WS_EVENT.Heartbeat };
            const merged = typeof payload === 'object' && payload ? { ...base, ...payload } : base;
            try {
                ch.push(WS_EVENT.Heartbeat, merged);
```

Change (currently lines 110-115, `adapter.syncPending`'s body):
```typescript
    adapter.syncPending = (list: string[], sseqNext?: string) => {
        try {
            (ch as any).push("sync:pending", {
                roomId, senderId, list,
                sseqHello: sseqNext ? { next: sseqNext } : undefined,
            });
```
to:
```typescript
    adapter.syncPending = (list: string[], sseqNext?: string) => {
        try {
            (ch as any).push(WS_EVENT.SyncPending, {
                roomId, senderId, list,
                sseqHello: sseqNext ? { next: sseqNext } : undefined,
            });
```

(This file is untouched by Tasks 1-2, so these line numbers are stable — but always verify against the live file before editing, per standard practice.)

- [ ] **Step 2: `helpers.ts`**

Add the import (near the top, alongside existing imports):
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```

Change (currently line 84):
```typescript
        if (evName !== "readUpTo") return false;
```
to:
```typescript
        if (evName !== WS_EVENT.ReadUpTo) return false;
```

- [ ] **Step 3: `chatSocketUtils.ts`**

Note: Task 2 already added the `WS_EVENT` import to this file and fixed one call site in it (`makeEmitReadAcker`'s `emit('chat:read', ...)` → `emit(WS_EVENT.ReadUpTo, ...)`, at what was line 650). Don't re-add the import or redo that change — check the current file first; this step covers the two remaining, separate call sites.

Change (currently line 129):
```typescript
        if (evLower === 'chat:update') {
```
to:
```typescript
        if (evLower === WS_EVENT.Update) {
```

Change (currently line 141):
```typescript
        if (ev === 'readUpTo') {
```
to:
```typescript
        if (ev === WS_EVENT.ReadUpTo) {
```

(Line 152's `payload.event === 'phx_reply'` is left as a literal -- `phx_reply` is Phoenix's own transport-level reply frame, not a `ChatEvent` variant, same reasoning as Step 1.)

- [ ] **Step 4: `handleWSMessage.ts`**

Add the import (alongside the existing `@/modules/chat/types` import):
```typescript
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
```

Change (currently line 123), adding the dead-code documentation the design spec calls for:
```typescript
            if (rawEvt === 'ackReminder') {
```
to:
```typescript
            // NOTE: this branch is currently unreachable. api-108heros sends its
            // ack-reminder response under the wire string "sync:pending" (see
            // AnyIncomingEvent::SyncPending in bridge_message.rs), never a
            // distinct "ackReminder" string -- so this rich per-clientId
            // reconciliation (chatOutbox.markPending + chatChannel.ackConfirm)
            // never runs; the `evt === 'sync:pending'` branch below handles
            // the real inbound event instead, via the simpler handleSyncPending()
            // (which does not read this payload's clientIds). Deliberately left
            // unwired rather than fixed here -- see the design spec's "Finding"
            // section: whether to make this fire is a product decision, not a
            // side effect of a naming pass. "ackReminder" has no WS_EVENT entry
            // since the backend has no matching ChatEvent variant.
            if (rawEvt === 'ackReminder') {
```

Change (currently line 127):
```typescript
            } else if (rawEvt === 'messageAck') {
```
to:
```typescript
            } else if (rawEvt === WS_EVENT.MessageAck) {
```

Change (currently line 224):
```typescript
            if (evt === 'sync:pending') {
```
to:
```typescript
            if (evt === WS_EVENT.SyncPending) {
```

Change (currently line 229):
```typescript
            if (evt === 'ackReminder' || evt === 'messageAck') {
```
to:
```typescript
            if (evt === 'ackReminder' || evt === WS_EVENT.MessageAck) {
```

- [ ] **Step 5: Run full verification**

```bash
npx tsc --noEmit
pnpm test:unit
```
Expected: both clean; `wireEvents.test.ts` (16) + `sendEvents.test.ts` (3) still passing, no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/modules/chat/services/PhoenixSocketService.ts src/modules/chat/utils/helpers.ts src/modules/chat/utils/chatSocketUtils.ts src/modules/chat/events/handleWSMessage.ts
git commit -m "feat(chat): switch remaining inbound/outbound wire strings to WS_EVENT

Also documents (without fixing) the ackReminder dead-code finding: the
backend sends its ack-reminder response under \"sync:pending\", never
\"ackReminder\", so that branch's richer per-clientId reconciliation has
never actually run. Left unwired -- a product decision, not a side
effect of this naming pass."
```

---

### Task 4: No-stray-literal regression test + full verification + manual smoke test

**Files:**
- Create: `src/modules/chat/protocol/wireEvents.no-stray-literals.test.ts`

**Interfaces:**
- Consumes: `WS_EVENT` (Task 1). No new production interfaces.

- [ ] **Step 1: Write the failing regression test**

```typescript
// src/modules/chat/protocol/wireEvents.no-stray-literals.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHAT_MODULE_ROOT = join(__dirname, "..", "..");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

// Guards against someone re-introducing an inline literal instead of using
// WS_EVENT -- the exact kind of drift that caused the original bug (this
// frontend's outbound "chat:readUpTo"/"chat:ack" silently diverging from
// the backend's canonical "readUpTo"/"ackConfirm").
describe("no stray legacy wire-string literals remain outside wireEvents.ts", () => {
  const files = listTsFiles(CHAT_MODULE_ROOT).filter(
    (f) => !f.endsWith(`${join("protocol", "wireEvents.ts")}`)
  );

  it("'chat:readUpTo' does not appear anywhere in src/modules/chat/", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("chat:readUpTo"));
    expect(offenders).toEqual([]);
  });

  it("'chat:ack' does not appear anywhere in src/modules/chat/ (outside comments already reviewed)", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("'chat:ack'") || readFileSync(f, "utf8").includes('"chat:ack"'));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit`
Expected: this specific test FAILS if any of Task 2/3's replacements were missed (report the offending file paths from the assertion failure). If Tasks 2-3 were done completely and correctly, it may already pass here — that's fine, it's still a real regression guard going forward, not a wasted step (its value is protecting against *future* re-introduction, not necessarily catching something new right now).

- [ ] **Step 3: Fix any remaining offenders found**

If Step 2 failed, open each offending file, replace the literal with the matching `WS_EVENT.X` reference (following the exact pattern from Task 3), add the import if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit`
Expected: all test files passing (`wireEvents.test.ts`, `sendEvents.test.ts`, `wireEvents.no-stray-literals.test.ts`).

- [ ] **Step 5: Full type-check**

Run: `npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 6: Manual smoke test**

Start the dev server (`pnpm dev`), open the app, navigate to a real chat room with another test account or a second browser session, and confirm, watching the browser's network/WS inspector or console logs:
1. Joining a room still works (the real `phx_join` frame is unaffected by this plan — nothing in this plan touches how `phoenix.js`'s own `Channel.join()` is invoked).
2. Sending a chat message is received by the other session.
3. Marking a message as read sends a `readUpTo`-event packet (verify in the browser's WS frame inspector, or via `console.log`/`dbg()` output already present in `sendReadReceipt`) and the peer sees a normal read-receipt update.
4. A delivery ack (`ackConfirm`) is sent for an incoming message and the sender sees it marked delivered.

Report what you observed for each of these 4 points — this is the final proof that the rename didn't change any actual runtime behavior, mirroring how the backend side of this fix was verified live.

- [ ] **Step 7: Commit**

```bash
git add src/modules/chat/protocol/wireEvents.no-stray-literals.test.ts
git commit -m "test(chat): add no-stray-literal regression guard for wire-event strings"
```

---

## Self-Review Notes

- **Spec coverage**: every section of the design spec maps to a task — new `WS_EVENT` module + Vitest setup (Task 1), `sendEvents.ts` + type union extension (Task 2), remaining inbound/outbound call sites + `ackReminder` documentation (Task 3), regression guard + manual verification (Task 4).
- **Type consistency**: `WS_EVENT`'s exact key names (`ReadUpTo`, `AckConfirm`, `MessageAck`, `SyncPending`, `Typing`, `Update`, `Message`, `Heartbeat`, `PhxLeave`) are used identically across every task that references them — no task introduces a differently-cased or differently-named accessor.
- **Scope discipline**: `CHAT_EVENT` (chatEvents.ts) is explicitly never touched. The `ackReminder` dead-code branch is documented, not rewired. `"phx_reply"`/`"phx_error"`/`"presence_state"`/`"presence_diff"`/`"chan_reply"` literals are explicitly left alone (no backend `ChatEvent` counterpart). Only the confirmed-dead `"phxElose"` typo is removed from the type union — everything else in `PhoenixEvent`/`EVENTS` is preserved or additively extended.
- **No placeholders**: every step shows the complete before/after code; Task 3 Step 1's heartbeat/sync:pending replacement is the one step that asks the implementer to re-read the live file rather than trust exact stale line numbers, flagged explicitly as such (that file is untouched by Tasks 1-2, so its line numbers are otherwise stable, but this keeps the instruction honest about what's verified vs. what needs a fresh read).
