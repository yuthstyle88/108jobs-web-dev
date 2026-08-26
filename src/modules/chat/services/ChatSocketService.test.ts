/**
 * Wire-protocol v2 contract tests for the socket that replaced the `phoenix`
 * npm client.
 *
 * These assert on the bytes on the wire, not on our own constants, because
 * the whole point of v2 is that three codebases (this app, api-108heros and
 * the Flutter client) have to agree frame-for-frame with no compatibility
 * shim between them. A test that compared `frame.event` to `WS_EVENT.Join`
 * would keep passing if both sides of that comparison drifted together.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getChannelAdapter } from "@/modules/chat/services/ChatSocketService";

const ROOM = "room-42";
const SENDER = 7;

type Sent = Record<string, any>;

/** A stand-in for the browser WebSocket: records what was written and lets a
 * test drive open/message/close by hand. */
class FakeWebSocket {
  static last: FakeWebSocket | null = null;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onclose: ((evt: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  closedWith: number | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.closedWith = code ?? null;
    this.readyState = 3;
  }

  /** Simulate the handshake completing. */
  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  /** Simulate an inbound frame. */
  deliver(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  get frames(): Sent[] {
    return this.sent.map((s) => JSON.parse(s));
  }

  frameFor(event: string): Sent | undefined {
    return this.frames.find((f) => f.event === event);
  }
}

describe("chat socket speaks wire v2", () => {
  beforeEach(() => {
    FakeWebSocket.last = null;
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("connects to /socket/websocket with the token in the query string", () => {
    getChannelAdapter("jwt-abc", ROOM, ROOM, SENDER);
    const url = FakeWebSocket.last!.url;
    expect(url).toContain("/socket/websocket");
    expect(url).toContain("token=jwt-abc");
  });

  it("joins with an object envelope named `join`, not a five-element array", () => {
    getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    FakeWebSocket.last!.open();

    const raw = FakeWebSocket.last!.sent[0];
    expect(raw.startsWith("[")).toBe(false);

    const frame = JSON.parse(raw);
    expect(frame.event).toBe("join");
    expect(frame.room).toBe(ROOM);
    // `room` is the bare id: the `chat:`/`room:` topic prefix went with the
    // relay that required it.
    expect(frame.room).not.toContain(":");
    expect(typeof frame.ref).toBe("string");
    expect(frame.payload).toMatchObject({ roomId: ROOM, senderId: SENDER });
  });

  it("treats a `reply` echoing the ref as the answer to that frame", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    const onopen = vi.fn();
    adapter.onopen = onopen;
    ws.open();

    const joinRef = ws.frameFor("join")!.ref;
    expect(onopen).not.toHaveBeenCalled();

    ws.deliver({
      ref: joinRef,
      room: ROOM,
      event: "reply",
      payload: { status: "ok", response: {} },
    });

    expect(onopen).toHaveBeenCalledTimes(1);
    expect(adapter.readyState).toBe(1);
  });

  it("ignores a reply whose ref does not match anything outstanding", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    const onopen = vi.fn();
    adapter.onopen = onopen;
    ws.open();

    ws.deliver({
      ref: "not-a-ref-we-sent",
      room: ROOM,
      event: "reply",
      payload: { status: "ok", response: {} },
    });

    expect(onopen).not.toHaveBeenCalled();
  });

  it("resolves a push through .receive('ok') with the reply's response", async () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    ws.open();

    const push = adapter.channel!.push("message", { id: "client-1" });
    const frame = ws.frameFor("message")!;
    expect(frame.room).toBe(ROOM);
    expect(frame.payload).toMatchObject({ id: "client-1" });

    const seen: any[] = [];
    push.receive("ok", (resp) => seen.push(resp));

    ws.deliver({
      ref: frame.ref,
      room: ROOM,
      event: "reply",
      payload: { status: "ok", response: { id: "server-1" } },
    });

    expect(seen).toEqual([{ id: "server-1" }]);
  });

  it("routes status:'error' to .receive('error'), not to 'ok'", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    ws.open();

    const push = adapter.channel!.push("message", { id: "client-2" });
    const frame = ws.frameFor("message")!;

    const ok = vi.fn();
    const err = vi.fn();
    push.receive("ok", ok).receive("error", err);

    ws.deliver({
      ref: frame.ref,
      room: ROOM,
      event: "reply",
      payload: { status: "error", response: { reason: "nope" } },
    });

    expect(ok).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("delivers a reply that arrived before .receive() was chained on", () => {
    // push() returns synchronously and callers chain .receive() right after,
    // but a buffered frame can be answered in between. Dropping that reply
    // would strand the send forever.
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    ws.open();

    const push = adapter.channel!.push("message", { id: "client-3" });
    const frame = ws.frameFor("message")!;

    ws.deliver({
      ref: frame.ref,
      room: ROOM,
      event: "reply",
      payload: { status: "ok", response: { id: "server-3" } },
    });

    const late = vi.fn();
    push.receive("ok", late);
    expect(late).toHaveBeenCalledWith({ id: "server-3" });
  });

  it("sends the heartbeat with no room, per the spec's keepalive", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    ws.open();

    adapter.sendHeartbeat?.();

    const frame = ws.frameFor("heartbeat")!;
    expect(frame).toBeTruthy();
    expect("room" in frame).toBe(false);
    expect("ref" in frame).toBe(false);
  });

  it("buffers a send made before the socket opens and flushes it on connect", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;

    // Socket not open yet: nothing may reach the wire, and nothing may be lost.
    adapter.channel!.push("message", { id: "queued-1" });
    expect(ws.sent).toEqual([]);

    ws.open();
    expect(ws.frameFor("message")?.payload).toMatchObject({ id: "queued-1" });
  });

  it("forwards a server push to onmessage, and swallows protocol-only frames", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    const seen: any[] = [];
    adapter.onmessage = (e) => seen.push(JSON.parse(e.data));
    ws.open();

    ws.deliver({ room: ROOM, event: "messageAck", payload: { clientId: "c1" } });
    ws.deliver({ event: "heartbeat", payload: {} });
    ws.deliver({ room: ROOM, event: "join", payload: {} });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      event: "messageAck",
      room: ROOM,
      payload: { clientId: "c1" },
    });
  });

  it("delivers a server push to a channel .on() subscriber", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    const onNack = vi.fn();
    adapter.channel!.on("messageNack", onNack);
    ws.open();

    ws.deliver({ room: ROOM, event: "messageNack", payload: { clientId: "c9" } });

    expect(onNack).toHaveBeenCalledTimes(1);
    expect(onNack.mock.calls[0][0]).toMatchObject({ clientId: "c9" });
  });

  it("re-joins after a transport reconnect", () => {
    vi.useFakeTimers();
    try {
      getChannelAdapter("jwt", ROOM, ROOM, SENDER);
      const first = FakeWebSocket.last!;
      first.open();
      expect(first.frameFor("join")).toBeTruthy();

      // An abnormal close (1006) is a dropped connection, not a goodbye.
      first.onclose?.({ code: 1006, reason: "gone" });
      vi.advanceTimersByTime(1000);

      const second = FakeWebSocket.last!;
      expect(second).not.toBe(first);
      second.open();
      // Without this the reconnected socket would be attached to no room and
      // every subsequent frame would vanish.
      expect(second.frameFor("join")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reconnect after a deliberate close", () => {
    vi.useFakeTimers();
    try {
      const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
      const first = FakeWebSocket.last!;
      first.open();

      adapter.close();
      first.onclose?.({ code: 1000, reason: "client closed" });
      vi.advanceTimersByTime(60_000);

      expect(FakeWebSocket.last).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends no join when joinOnConnect is false, and is ready as soon as the socket opens", () => {
    // The per-user event channel (`user:<id>:events`). The server keeps no
    // join registry: it decides whether a user-scoped frame belongs to this
    // session by parsing the id out of the topic and comparing it to the
    // authenticated user (PhoenixSession::should_deliver in api-108heros), so
    // a join here is a frame nobody reads -- and waiting for a reply to one
    // would leave the channel permanently "connecting".
    const adapter = getChannelAdapter("jwt", "user:7:events", "7", SENDER, {
      joinOnConnect: false,
    });
    const ws = FakeWebSocket.last!;
    const onopen = vi.fn();
    adapter.onopen = onopen;

    ws.open();

    expect(ws.frameFor("join")).toBeUndefined();
    expect(onopen).toHaveBeenCalledTimes(1);
    expect(adapter.readyState).toBe(1);
  });

  it("sends `leave` on close", () => {
    const adapter = getChannelAdapter("jwt", ROOM, ROOM, SENDER);
    const ws = FakeWebSocket.last!;
    ws.open();

    adapter.close();

    expect(ws.frameFor("leave")).toBeTruthy();
    expect(ws.frameFor("leave")!.room).toBe(ROOM);
  });
});
