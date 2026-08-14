// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage, sendDeliveryAck, sendReadReceipt, sendTyping } from "@/modules/chat/events/sendEvents";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
import { useChatStore } from "@/modules/chat/store/chatStore";

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

describe("sendChatMessage success path (commitStatus argument-order regression)", () => {
  beforeEach(() => {
    useChatStore.setState({ retryMeta: {}, listMessages: [], messagesByRoom: {} });
  });

  it("commits the sent message to 'delivered' under its own room, not a bogus room keyed by the message id", async () => {
    const roomId = "room-42";
    const clientId = "client-msg-1";
    const sender = { sendMessage: vi.fn().mockResolvedValue("server-echoed-id") };

    await sendChatMessage(
      { isE2EMock: false, roomId, sentSet: new Set(), sender } as any,
      { message: "hello", senderId: 1 as any, secure: false, id: clientId }
    );

    const state = useChatStore.getState();
    const msg = state.messagesByRoom[roomId]?.find((m: any) => String(m.id) === clientId);
    expect(msg?.status).toBe("delivered");

    // The bug this guards against: commitStatus(pid, rid, 'delivered') used
    // the message's own id as a room key instead of deps.roomId, which
    // would leave a bogus entry here instead of updating messagesByRoom[roomId].
    expect(state.messagesByRoom[clientId]).toBeUndefined();
  });
});
