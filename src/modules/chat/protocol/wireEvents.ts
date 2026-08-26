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
 * Wire protocol v2 (see docs/superpowers/specs/2026-08-07-chat-wire-v2.md).
 * Two groups of names changed:
 *
 * 1. The three that were never ours. `phx_join`/`phx_leave`/`phx_reply` were
 *    the `phoenix` npm client's own hardcoded strings, inherited from an
 *    Elixir relay that no longer exists; they are now `join`/`leave`/`reply`.
 *
 * 2. The colon-prefixed ones. `chat:message`, `sync:pending`, `typing:start`
 *    and friends are prefix-free in v2 -- `message`, `syncPending`,
 *    `typingStart`. The prefix was a Phoenix topic-namespacing habit, not
 *    information: every frame already names its room in the envelope's
 *    `room` field, so the prefix said a second time, in a less reliable
 *    place, what the envelope already said.
 *
 * The v1 spellings are deleted, not aliased -- all three clients (this app,
 * api-108heros and the Flutter widget) ship together and there is no third
 * party to stay compatible with.
 *
 * Names carried over from v1 untouched: messageAck, messageNack, ackConfirm,
 * readUpTo, globalOnline, globalOffline, heartbeat.
 *
 * These strings are matched EXACTLY, never case-insensitively. Half of them
 * are camelCase now, so a `.toLowerCase()` before comparing -- which this
 * module's callers used to do while every name was lowercase-safe -- would
 * silently match nothing.
 */
export const WS_EVENT = Object.freeze({
  /** Client -> server: attach to a room. Carries a `ref`; the server answers
   * with a `Reply` echoing it. Was `phx_join`. */
  Join: "join",
  /** Client -> server: detach from a room. Was `phx_leave`. */
  Leave: "leave",
  /** Server -> client: the answer to a frame that carried a `ref`, with
   * payload `{status: "ok" | "error", response: {...}}`. Was `phx_reply`. */
  Reply: "reply",
  Heartbeat: "heartbeat",
  Message: "message",
  MessageAck: "messageAck",
  /** Server-to-client only: a sent message failed to make it into the
   * durable buffer backing persistence. Carries the same `clientId` shape
   * as MessageAck, so it can drive the same resend-until-ack tracking
   * instead of only a client-side timeout (see api-108heros'
   * crates/ws/src/broker/bridge_message.rs, add_messages_to_room). */
  MessageNack: "messageNack",
  AckConfirm: "ackConfirm",
  SyncPending: "syncPending",
  ReadUpTo: "readUpTo",
  ActiveRooms: "activeRooms",
  Typing: "typing",
  TypingStart: "typingStart",
  TypingStop: "typingStop",
  Update: "update",
  ChatsSignal: "chatsSignal",
  GlobalOnline: "globalOnline",
  GlobalOffline: "globalOffline",
} as const);

export type WsEventValue = (typeof WS_EVENT)[keyof typeof WS_EVENT];
