// @vitest-environment jsdom
/**
 * Regression coverage for Bug A: the chat bridge never actually wires up a
 * real channel in production.
 *
 * Unlike the existing parseNackPayload/selectFailedMessagesForResend tests
 * in ChatBridgeProvider.test.ts (which only test pure parsing
 * helpers in isolation), this test mounts the REAL hook/provider chain --
 * useWebSocket -> WebSocketProvider (WebSocketContext) ->
 * ChatBridgeProvider -- with only the network boundary
 * (getChannelAdapter) mocked out, and asserts on observable, real behavior:
 *   1. sending a message actually calls the (fake) channel's push()
 *   2. a MessageNack event delivered on the (fake) channel actually reaches
 *      store.markFailed and ResendManager.onSendFailure (proven via the
 *      real chatStore's resulting state, not a spy on an internal method)
 *
 * Against the current/broken code, useWebSocket never exposes the adapter
 * it builds, so WebSocketContext's `adapter` is always null, so
 * ChatBridgeProvider's pickChannel(ws, roomId) never finds a
 * channel, so none of this ever wires up -- this test must FAIL against
 * that code (proving it exercises the real bug) before the fix, and PASS
 * after.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { useNetworkStore } from "@/store/networkStore";

vi.mock("@/modules/chat/services/ChatSocketService", () => ({
  getChannelAdapter: vi.fn(),
}));

// Imports below must come after vi.mock so they pick up the mocked module.
import { getChannelAdapter } from "@/modules/chat/services/ChatSocketService";
import { WebSocketProvider } from "@/modules/chat/contexts/WebSocketContext";
import {
  ChatBridgeProvider,
  useChatServices,
  type ChatServices,
} from "@/modules/chat/contexts/ChatBridgeProvider";

const ROOM_ID = "room-wiring-1";
const SENDER_ID = 1;

/** A fake ChatChannel-shaped object: has .on()/.off() (event
 * subscription, per ChatSocketService's ChatChannel) and .push() (returns
 * a chainable Push-like object), matching what a correctly-fixed
 * getChannelAdapter would expose. */
function makeFakeRawChannel() {
  const handlers: Record<string, Array<(payload: any) => void>> = {};
  const on = vi.fn((event: string, cb: (payload: any) => void) => {
    (handlers[event] ??= []).push(cb);
    return handlers[event].length;
  });
  const off = vi.fn((event: string) => {
    delete handlers[event];
  });
  const push = vi.fn((_event: string, payload: unknown) => {
    const pushObj: any = {};
    pushObj.receive = vi.fn((status: string, cb: (resp?: any) => void) => {
      if (status === "ok") {
        Promise.resolve().then(() =>
          cb({ id: `server-${(payload as any)?.id ?? "x"}` })
        );
      }
      return pushObj;
    });
    return pushObj;
  });
  return { on, off, push, handlers };
}

/** A fake of the RealtimeChannelAdapter returned by getChannelAdapter:
 * WebSocket-style single-slot callbacks (onopen/onmessage/onclose/onerror)
 * plus (once the fix lands) a `.channel` field carrying the raw channel. */
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
    // ChatChannel exposed for real channel-level wiring.
    channel: rawChannel,
  };
}

function findLatestHandler(
  rawChannel: ReturnType<typeof makeFakeRawChannel>,
  event: string
): ((payload: any) => void) | undefined {
  const calls = rawChannel.on.mock.calls.filter(([ev]) => ev === event);
  const last = calls[calls.length - 1];
  return last?.[1];
}

/** Captures the latest ChatServices exposed via context so the test can
 * drive `sender.sendMessage(...)` directly, exactly like real consumers
 * (e.g. useChatRoom) do. */
function ServiceProbe({ onUpdate }: { onUpdate: (s: ChatServices) => void }) {
  const services = useChatServices();
  onUpdate(services);
  return null;
}

describe("Chat bridge channel wiring (Bug A regression)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let rawChannel: ReturnType<typeof makeFakeRawChannel>;
  let fakeAdapter: ReturnType<typeof makeFakeAdapter>;
  let latestServices: ChatServices = { sender: null, resend: null };

  beforeEach(() => {
    // NOTE: no `replace=true` here -- that would wipe out the store's
    // action methods (markFailed, upsertRetryMeta, ...) along with the
    // data, since zustand's replace mode discards everything not in the
    // partial. A plain (merging) setState resets only the data fields.
    useChatStore.setState({ retryMeta: {}, listMessages: [], messagesByRoom: {} });
    useNetworkStore.setState({ online: false });

    rawChannel = makeFakeRawChannel();
    fakeAdapter = makeFakeAdapter(rawChannel);
    latestServices = { sender: null, resend: null };

    (getChannelAdapter as unknown as ReturnType<typeof vi.fn>).mockReset();
    (getChannelAdapter as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => fakeAdapter
    );

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
              reconnectOnVisible: false,
              disableInactivityTimeout: true,
            },
            joinInProvider: false,
          },
          React.createElement(
            ChatBridgeProvider,
            { isLoggedIn: true, roomId: ROOM_ID } as any,
            React.createElement(ServiceProbe, {
              onUpdate: (s: ChatServices) => {
                latestServices = s;
              },
            })
          )
        )
      );
    });

    // Simulate the socket successfully opening (useWebSocket's
    // bindAdapterHandlers wires adapter.onopen -> setStatus('connected')).
    await act(async () => {
      fakeAdapter.onopen?.();
    });

    // Flush any additional effect passes triggered by the resulting
    // re-renders (ws identity changes every render in this codebase).
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("wires a real sender bound to the channel, so sending a message actually calls channel.push", async () => {
    await mount();

    expect(latestServices.sender).not.toBeNull();

    await act(async () => {
      await latestServices.sender!.sendMessage("message", {
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
    const call = rawChannel.push.mock.calls.find(
      ([, payload]: any[]) => payload?.id === "client-send-1"
    );
    expect(call).toBeTruthy();
  });

  it("wires MessageNack from the real channel to store.markFailed and ResendManager.onSendFailure", async () => {
    await mount();

    // Seed a "sending" message the nack will mark failed.
    useChatStore.setState({
      messagesByRoom: {
        [ROOM_ID]: [
          {
            id: "client-nack-1",
            roomId: ROOM_ID,
            senderId: SENDER_ID,
            secure: false,
            content: "will fail",
            status: "sending",
            createdAt: new Date().toISOString(),
            isOwner: true,
          } as any,
        ],
      },
    });

    const toNack = findLatestHandler(rawChannel, WS_EVENT.MessageNack);
    expect(toNack).toBeTypeOf("function");

    act(() => {
      toNack!({ payload: { clientId: "client-nack-1", roomId: ROOM_ID } });
    });

    const msg = useChatStore
      .getState()
      .messagesByRoom[ROOM_ID]?.find((m: any) => m.id === "client-nack-1");
    expect(msg?.status).toBe("failed");

    // onSendFailure synchronously stages retry meta before its deferred
    // resend fires -- presence of retry meta proves it actually ran.
    expect(useChatStore.getState().retryMeta["client-nack-1"]).toBeDefined();
  });
});
