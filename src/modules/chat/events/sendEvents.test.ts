// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "108jobs-client";
import { sendChatMessage, sendDeliveryAck, sendReadReceipt, sendTyping } from "@/modules/chat/events/sendEvents";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { decrypt } from "@/modules/chat/utils/security/crypto";
import { UserService } from "@/services";
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
  const originalAuthInfo = UserService.Instance.authInfo;

  beforeEach(() => {
    useChatStore.setState({ retryMeta: {}, listMessages: [], messagesByRoom: {} });
  });

  afterEach(() => {
    // This suite is the only one in the file that ever populates
    // authInfo.sharedKey -- restore it so a real key set up for one test
    // can't silently make a *later* test (here or in another file sharing
    // this module registry) start encrypting when it did not ask to.
    UserService.Instance.authInfo = originalAuthInfo;
  });

  it("puts the asset id beside the encrypted content, not inside it", async () => {
    // The previous version of this test never put a `sharedKey` in the
    // fixture, so `sendChatMessage`'s `useEnc` check was always false and
    // `encrypt()` was never called -- it asserted only the sibling field
    // and its name overstated what it proved (Finding 8, FINAL-findings.md).
    // A real AES-GCM key here, and a round trip back through `decrypt()`
    // with that same key, is what actually proves the server-visible
    // `content` is ciphertext and not the plaintext JSON envelope.
    const key = await crypto.subtle.generateKey({name: "AES-GCM", length: 256}, true, [
      "encrypt",
      "decrypt",
    ]);
    UserService.Instance.authInfo = {sharedKey: key};

    // The server cannot read an encrypted envelope, so this is the only way
    // chat_message.asset_id gets populated -- and media_proxy resolves the
    // owning room from that column to check membership.
    const sent: any[] = [];
    const deps = makeDeps(sent);   // reuse the helper this file already has
    const plaintext = JSON.stringify({type: "file", url: "u", name: "n.pdf", assetId: "a-1"});

    await sendChatMessage(deps, {
      message: plaintext,
      senderId: 1 as never,
      secure: true,
      id: "m-1",
      assetId: "a-1",
    });

    expect(sent[0]).toMatchObject({assetId: "a-1", secure: true});
    expect(sent[0].content).not.toBe(plaintext);
    await expect(decrypt(sent[0].content, key)).resolves.toBe(plaintext);
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
