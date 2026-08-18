// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "108jobs-client";
import { sendChatMessage, sendDeliveryAck, sendReadReceipt, sendTyping } from "@/modules/chat/events/sendEvents";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
import { useChatStore } from "@/modules/chat/store/chatStore";
import type { SendMessageDeps } from "@/modules/chat/types";

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

// Builds SendMessageDeps with a fake `sender.sendMessage` that records the
// full ChatMessage payload doSend() hands it (mirrors the `sender` shape used
// by the success-path test above) and resolves `true`, matching what a real
// sender returns on success.
function makeDeps(sent: ChatMessage[]): SendMessageDeps {
  return {
    isE2EMock: false,
    roomId: "room-9",
    sentSet: new Set<string>(),
    sender: {
      sendMessage: vi.fn(async (_event: string, msg: ChatMessage) => {
        sent.push(msg);
        return true;
      }),
    },
  };
}

describe("sendChatMessage attachment metadata", () => {
  beforeEach(() => {
    useChatStore.setState({ retryMeta: {}, listMessages: [], messagesByRoom: {} });
  });

  it("puts the asset id beside the encrypted content, not inside it", async () => {
    // The server cannot read an encrypted envelope, so this is the only way
    // chat_message.asset_id gets populated -- and media_proxy resolves the
    // owning room from that column to check membership.
    const sent: any[] = [];
    const deps = makeDeps(sent);   // reuse the helper this file already has

    await sendChatMessage(deps, {
      message: JSON.stringify({type: "file", url: "u", name: "n.pdf", assetId: "a-1"}),
      senderId: 1 as never,
      secure: true,
      id: "m-1",
      assetId: "a-1",
    });

    expect(sent[0]).toMatchObject({assetId: "a-1"});
  });

  it("omits the field entirely for an ordinary text message", async () => {
    const sent: any[] = [];
    const deps = makeDeps(sent);

    await sendChatMessage(deps, {
      message: "hello",
      senderId: 1 as never,
      secure: false,
      id: "m-2",
    });

    expect(sent[0]).not.toHaveProperty("assetId");
  });
});
