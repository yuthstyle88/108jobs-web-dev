// @vitest-environment jsdom
/**
 * Regression coverage for the WebSocketContext sender wiring bug: the
 * context's own `sender` (consumed directly by useChatRoom.sendMessage,
 * the primary "send a new message" path) was built from `adapter` --
 * getChannelAdapter's WebSocket-style wrapper, whose .emit() writes to the
 * wire via channel.push() internally but discards that push's ack/receive
 * chain and returns immediately -- instead of from `channel`
 * (adapter.channel, the real ChatChannel), even though `channel` was
 * already computed one line above in the same memo for exactly this kind
 * of use.
 *
 * Against the bug, ChatSenderAdapter.sendMessage() takes its `.emit()`
 * branch, so it calls adapter.emit(), not channel.push() directly -- this
 * test asserts the channel's `.push()` is what a message send goes through
 * (matching ChatBridgeProvider's already-correct, separately-wired sender),
 * not the adapter's fire-and-forget `.emit()`.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/chat/services/ChatSocketService", () => ({
  getChannelAdapter: vi.fn(),
}));

// Imports below must come after vi.mock so they pick up the mocked module.
import { getChannelAdapter } from "@/modules/chat/services/ChatSocketService";
import { WebSocketProvider, useWebSocketContext } from "@/modules/chat/contexts/WebSocketContext";

const ROOM_ID = "room-sender-wiring-1";
const SENDER_ID = 1;

/** A fake ChatChannel-shaped object: has .push() (returns a chainable
 * Push-like object), matching ChatSocketService's real ChatChannel. */
function makeFakeRawChannel() {
  const push = vi.fn((_event: string, payload: unknown) => {
    const pushObj: any = {};
    pushObj.receive = vi.fn((status: string, cb: (resp?: any) => void) => {
      if (status === "ok") {
        Promise.resolve().then(() => cb({ id: `server-${(payload as any)?.id ?? "x"}` }));
      }
      return pushObj;
    });
    return pushObj;
  });
  return { on: vi.fn(), off: vi.fn(), push };
}

/** A fake of the RealtimeChannelAdapter returned by getChannelAdapter:
 * WebSocket-style single-slot callbacks plus fire-and-forget emit/send,
 * and the `.channel` field carrying the raw channel. */
function makeFakeAdapter(rawChannel: ReturnType<typeof makeFakeRawChannel>) {
  return {
    readyState: 0,
    onopen: undefined as (() => void) | undefined,
    onmessage: undefined as ((e: { data: string }) => void) | undefined,
    onclose: undefined as (() => void) | undefined,
    onerror: undefined as ((e?: unknown) => void) | undefined,
    send: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
    channel: rawChannel,
  };
}

/** Captures the latest WebSocketContext value so the test can drive
 * `sender.sendMessage(...)` directly, exactly like useChatRoom does. */
function ContextProbe({ onUpdate }: { onUpdate: (ctx: ReturnType<typeof useWebSocketContext>) => void }) {
  const ctx = useWebSocketContext();
  onUpdate(ctx);
  return null;
}

describe("WebSocketContext sender wiring", () => {
  let container: HTMLDivElement;
  let root: Root;
  let rawChannel: ReturnType<typeof makeFakeRawChannel>;
  let fakeAdapter: ReturnType<typeof makeFakeAdapter>;
  let latestCtx: ReturnType<typeof useWebSocketContext> | null = null;

  beforeEach(() => {
    rawChannel = makeFakeRawChannel();
    fakeAdapter = makeFakeAdapter(rawChannel);
    latestCtx = null;

    (getChannelAdapter as unknown as ReturnType<typeof vi.fn>).mockReset();
    (getChannelAdapter as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => fakeAdapter);

    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  async function mount() {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(
          WebSocketProvider,
          {
            options: {
              token: "test-token",
              roomId: ROOM_ID,
              senderId: SENDER_ID,
              autoConnect: true,
              autoJoin: false,
              autoReconnect: false,
              reconnectOnVisible: false,
              disableInactivityTimeout: true,
            },
            joinInProvider: false,
          },
          React.createElement(ContextProbe, {
            onUpdate: (ctx) => {
              latestCtx = ctx;
            },
          })
        )
      );
    });

    await act(async () => {
      fakeAdapter.onopen?.();
    });

    await act(async () => {
      await Promise.resolve();
    });
  }

  it("binds the context sender to the channel (channel.push), not the adapter's fire-and-forget emit", async () => {
    await mount();

    expect(latestCtx?.sender).not.toBeNull();

    await act(async () => {
      await latestCtx!.sender!.sendMessage("message", {
        id: "client-send-1",
        roomId: ROOM_ID,
        senderId: SENDER_ID,
        content: "hello from test",
        secure: false,
        createdAt: new Date().toISOString(),
        status: "sending",
      } as any);
    });

    expect(rawChannel.push).toHaveBeenCalled();
    const call = rawChannel.push.mock.calls.find(([, payload]: any[]) => payload?.id === "client-send-1");
    expect(call).toBeTruthy();

    // The adapter's own emit()/send() -- the fire-and-forget path the bug
    // took -- must NOT be what the primary sender used.
    expect(fakeAdapter.emit).not.toHaveBeenCalled();
    expect(fakeAdapter.send).not.toHaveBeenCalled();
  });
});
