# Wire-Event Naming Alignment (Stage 1) Design

> **Superseded in part (2026-08-07) by
> [`2026-08-07-chat-wire-v2.md`](./2026-08-07-chat-wire-v2.md).** This document
> is kept as the record of why `WS_EVENT` exists, and the alignment it
> describes still holds: every event name it pinned is byte-identical today.
> What it can no longer be trusted on is Phoenix. It describes this frontend
> as using the real `phoenix` npm client, and documents `WS_EVENT.PhxJoin` /
> `PhxLeave` as "the real phoenix.js wire format" — that dependency is gone,
> along with the Elixir relay that made us speak its dialect. The three names
> that were Phoenix's own are now `join`, `leave` and `reply`, and the
> five-element array envelope `[join_ref, ref, topic, event, payload]` is a
> JSON object. Read the v2 spec for the frame shape; read on for the naming
> history.

## Context

An investigation into api-108heros's realtime chat protocol found that this frontend uses the real `phoenix` npm client library (`Channel.join()`/`.leave()` send the wire-protocol-mandated `"phx_join"`/`"phx_leave"`), and that several of this frontend's own outbound event names didn't match the backend's canonical wire strings: `"chat:readUpTo"` (this frontend sends) vs. `"readUpTo"` (backend's canonical outgoing string for the same event), and `"chat:ack"` vs. `"ackConfirm"`. The backend (api-108heros PR #132) was fixed to accept both forms as aliases, so nothing is currently broken — but the two sides' wire-string tables have drifted, exactly the kind of drift that caused real, silently-dropped-message bugs on the backend side (a join event, a read receipt, and a delivery ack were all silently discarded before that fix).

This is Stage 1 of a larger, explicitly staged effort to bring this frontend's entire realtime module up to a better standard (see the sequencing decision below) — it covers only wire-string alignment and centralization. Larger structural/type-safety/performance work is deferred to later stages, each to be separately brainstormed and planned.

## Goal

Make every WebSocket wire-protocol event-name string this frontend sends or matches against identical to the backend's `ChatEvent::as_str()` canonical values, sourced from one new, dedicated constant module — and add real unit tests (using a newly-added test framework, since none currently exists) proving the two sides' contracts match, not just inspection.

## Non-Goals (deferred to later stages)

- Decomposing the oversized files (`useWebSocket.ts` 588 lines, `useChatRoom.ts` 494 lines, `chatSocketUtils.ts` 716 lines) — Stage 3.
- Fixing the 3 concrete correctness/performance bugs found during investigation (AckMatcher's unbounded `setTimeout` accumulation, `useWebSocket`'s dependency-array churn causing listener re-binding, `PhoenixChatBridgeProvider`'s silent-miss channel-attachment race) — Stage 2.
- Replacing `any`-typed inbound frame handling with real schema validation — Stage 4.
- Deciding whether to wire up the dead `ackReminder` reconciliation logic (see Finding below) to actually run — flagged, not fixed, in this stage.

## Finding: `ackReminder`'s handler is dead code

While tracing exactly which wire strings the backend sends for the ack-reminder mechanism, found that `api-108heros`'s `ack_reminder` response is sent under `ChatEvent::SyncPending` (wire string `"sync:pending"`, see `bridge_message.rs`'s `SyncPending` arm), never under a distinct `"ackReminder"` string. This frontend's `handleWSMessage.ts` has two separate branches: one for `evt === 'sync:pending'` (calls `handleSyncPending()`, which ignores the reminder payload's `clientIds` entirely and just re-sends the client's own last-known delivery ack) and one for `evt === 'ackReminder'` (calls `handleAckProtocol()`, which *would* read `clientIds` from the payload and proactively re-confirm each one via `chatOutbox.markPending`/`chatChannel.ackConfirm`) — but the second branch can never fire, since the backend never sends that string.

This is a genuine behavioral gap (the richer reconciliation logic has been unreachable, possibly for a long time), not just a naming inconsistency. Fixing the naming in this stage will make this dead-ness explicit and documented (a code comment at the unreachable branch explaining why), but will **not** rewire the branch to fire — doing so would be a behavior change with product implications (e.g., how aggressively the client re-acks after a reconnect) that deserves its own explicit decision, not a silent side effect of a rename pass.

## Architecture

A new module, `src/modules/chat/protocol/wireEvents.ts`, exports a single frozen const object, `WS_EVENT`, mirroring api-108heros's `ChatEvent` Rust enum variant-for-variant — same semantic names (`PhxJoin`, `PhxLeave`, `Heartbeat`, `Message`, `MessageAck`, `AckConfirm`, `SyncPending`, `ReadUpTo`, `ActiveRooms`, `Typing`, `TypingStart`, `TypingStop`, `Update`, `ChatsSignal`, `GlobalOnline`, `GlobalOffline`), each mapped to the exact string the backend's `ChatEvent::as_str()` (`crates/ws/src/protocol/impls.rs`) emits for that variant. A developer working on either side of the wire can look up a name and find the exact match on the other.

This is a **separate concern** from `src/modules/chat/events/chatEvents.ts`'s existing `CHAT_EVENT` constant, which is an in-browser DOM `CustomEvent` name registry for cross-component signaling within this frontend — it happens to reuse some of the same string values (e.g. `"chat:message"`), but is unrelated to the WebSocket wire protocol and is not touched by this stage.

`WS_EVENT`'s values:

```typescript
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
```

Note: `PhxJoin`/`PhxLeave`'s values are the real `phoenix` npm client library's own hardcoded wire format (not sent by this frontend's own code directly — `Channel.join()`/`.leave()` send them internally) — included in `WS_EVENT` for documentation/completeness and so any code that needs to *recognize* these frames (e.g. `isInternalEvent` in `PhoenixSocketService.ts`) references the constant instead of a bare literal.

## Components Changed

- **`src/modules/chat/protocol/wireEvents.ts`** (new): the `WS_EVENT` const, with a doc comment pointing at the backend file (`crates/ws/src/protocol/impls.rs`) it mirrors.
- **`src/modules/chat/events/sendEvents.ts`**: `createEvent('chat:readUpTo', ...)` → `createEvent(WS_EVENT.ReadUpTo, ...)`; `createEvent('chat:ack', ...)` → `createEvent(WS_EVENT.AckConfirm, ...)`. Other `createEvent(...)` calls (`chat:typing`, `chat:update`) also switch to `WS_EVENT.X` for consistency, even though their string values are unchanged.
- **`src/modules/chat/services/PhoenixSocketService.ts`**: the `isInternalEvent` check and the `"ackConfirm"`/`"heartbeat"`/`"sync:pending"` literal pushes switch to `WS_EVENT.X`.
- **`src/modules/chat/utils/helpers.ts`**, **`src/modules/chat/utils/chatSocketUtils.ts`**: inbound `evName === "readUpTo"` / `ev === 'readUpTo'` checks switch to `WS_EVENT.ReadUpTo` (value unchanged, reference changed).
- **`src/modules/chat/events/handleWSMessage.ts`**: `evt === 'sync:pending'`, `evt === 'messageAck'` switch to `WS_EVENT.SyncPending`/`WS_EVENT.MessageAck`. The `evt === 'ackReminder'` branch gets a doc comment explaining it's unreachable (see Finding above) but is otherwise left as-is — its string is not added to `WS_EVENT` since the backend has no such variant.
- **`src/modules/chat/types/common.ts`**: the `PhoenixEvent` type union and `EVENTS` array get regenerated from `WS_EVENT`'s values (via `typeof WS_EVENT[keyof typeof WS_EVENT]` or equivalent) rather than hand-maintained separately, closing the same "two independent hand-maintained tables" risk this whole investigation started from on the backend side.
- **`src/modules/chat/events/chatEvents.ts`**: untouched.

## Testing

No unit-testing framework currently exists in this project (only Playwright E2E, which has no chat coverage). This stage adds **Vitest** (minimal config, no React-rendering infra needed since this stage tests pure logic, not components) as a new dev dependency, plus a `test:unit` package.json script.

New tests:
1. **Contract test** (`wireEvents.test.ts`): asserts every `WS_EVENT` entry equals its documented backend-matching string literal, one assertion per variant — directly analogous to the round-trip regression test added on the Rust side, pinning the cross-repo contract explicitly.
2. **No-stray-literal regression test**: reads the actual source files under `src/modules/chat/` (via Node's `fs`) and asserts the old literal strings (`'chat:readUpTo'`, `'chat:ack'`) no longer appear anywhere outside `wireEvents.ts` itself.
3. **Behavioral tests** for `sendEvents.ts`'s outbound builders: call the read-receipt/ack-send functions and assert the resulting packet's `event` field is exactly `WS_EVENT.ReadUpTo`/`WS_EVENT.AckConfirm`.

Manual smoke test (dev server, real chat flow: join room, send message, read receipt, ack) remains the final end-to-end check, mirroring how the backend side was verified live.

## Error Handling

This is a pure rename plus one new module and one new dev dependency — no new runtime error paths are introduced. Existing error handling (try/catch swallowing in the adapter, `?? []`/`?.` optional chaining throughout) is untouched.

## Self-Review

- **Placeholder scan**: none — every section states exact file paths, exact constant values, and exact test names.
- **Internal consistency**: `WS_EVENT`'s values match what was independently confirmed against api-108heros's `ChatEvent::as_str()` in `crates/ws/src/protocol/impls.rs` during investigation; the `ackReminder` finding is explicitly scoped out of this stage's changes (documented, not fixed).
- **Scope check**: bounded to wire-string alignment + centralization + a new unit-test setup; explicitly excludes the other 3 stages already agreed with the user.
- **Ambiguity check**: `CHAT_EVENT` vs. `WS_EVENT`'s separate purposes are stated explicitly to prevent conflating them during implementation.
