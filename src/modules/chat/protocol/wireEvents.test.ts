import { describe, expect, it } from "vitest";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";

// Pins this frontend's wire-protocol event names to api-108heros's
// ChatEvent::as_str() (crates/ws/src/protocol/impls.rs) -- one assertion per
// variant, so a change to either side that isn't mirrored here fails loudly
// instead of silently drifting (the exact failure mode that caused real,
// silently-dropped-message bugs before api-108heros PR #132).
describe("WS_EVENT matches the backend's ChatEvent::as_str() exactly", () => {
  it("Join replaced phx_join", () => {
    expect(WS_EVENT.Join).toBe("join");
  });

  it("Leave replaced phx_leave", () => {
    expect(WS_EVENT.Leave).toBe("leave");
  });

  it("Reply replaced phx_reply", () => {
    expect(WS_EVENT.Reply).toBe("reply");
  });

  // The v1 spellings are deleted, not deprecated: there is no third party to
  // stay compatible with, and an alias left lying around is how a protocol
  // quietly stays forked. Assert on the values too, since a stray `phx_join`
  // under some other key would be just as wrong as the old key surviving.
  it("carries no phx_* name under any key", () => {
    expect(Object.values(WS_EVENT).filter((v) => v.startsWith("phx"))).toEqual([]);
    expect(Object.keys(WS_EVENT).filter((k) => k.startsWith("Phx"))).toEqual([]);
  });

  it("Heartbeat", () => {
    expect(WS_EVENT.Heartbeat).toBe("heartbeat");
  });

  it("Message", () => {
    expect(WS_EVENT.Message).toBe("message");
  });

  it("MessageAck (inbound only, server->client)", () => {
    expect(WS_EVENT.MessageAck).toBe("messageAck");
  });

  it("MessageNack (inbound only, server->client)", () => {
    expect(WS_EVENT.MessageNack).toBe("messageNack");
  });

  it("AckConfirm (outbound, client->server)", () => {
    expect(WS_EVENT.AckConfirm).toBe("ackConfirm");
  });

  it("SyncPending", () => {
    expect(WS_EVENT.SyncPending).toBe("syncPending");
  });

  it("ReadUpTo matches the backend's canonical outgoing string", () => {
    expect(WS_EVENT.ReadUpTo).toBe("readUpTo");
  });

  it("ActiveRooms", () => {
    expect(WS_EVENT.ActiveRooms).toBe("activeRooms");
  });

  it("Typing", () => {
    expect(WS_EVENT.Typing).toBe("typing");
  });

  it("TypingStart", () => {
    expect(WS_EVENT.TypingStart).toBe("typingStart");
  });

  it("TypingStop", () => {
    expect(WS_EVENT.TypingStop).toBe("typingStop");
  });

  it("Update", () => {
    expect(WS_EVENT.Update).toBe("update");
  });

  it("ChatsSignal", () => {
    expect(WS_EVENT.ChatsSignal).toBe("chatsSignal");
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
