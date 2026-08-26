"use client";
/**
 * Chat socket/channel adapter — wire protocol v2.
 *
 * This used to be PhoenixSocketService, a thin wrapper over the `phoenix` npm
 * client. That client existed because the realtime endpoint used to be an
 * Elixir relay; the relay is gone, the array envelope
 * `[join_ref, ref, topic, event, payload]` went with it, and what is left is
 * a plain WebSocket speaking a JSON object envelope:
 *
 *   client -> server   {"ref": "7", "room": "<id>", "event": "message", "payload": {}}
 *   server -> client   {"room": "<id>", "event": "messageAck", "payload": {}}
 *   server -> client   {"ref": "7", "room": "<id>", "event": "reply",
 *                       "payload": {"status": "ok", "response": {}}}
 *
 * `ref` is optional and client-chosen; the server echoes it on the reply, and
 * that echo is the only thing correlating a reply to the frame that asked for
 * one. `room` carries the bare room id — there is no `chat:`/`room:` topic
 * prefix any more.
 *
 * The Channel/Push shape below is deliberately preserved from the phoenix
 * client's API surface, because real behaviour depends on it:
 * ChatSenderAdapter needs `push()` to return something chainable whose
 * `.receive('ok'|'error'|'timeout', cb)` fires exactly once per logical send,
 * and ChatBridgeProvider needs `.on()/.off()` to subscribe to server pushes.
 * What changed is who implements it: the ref/reply correlation, the send
 * buffer and the reconnect backoff are ours now, not a dependency's.
 */
import { buildChatWsUrl } from "@/modules/chat/utils/chatSocketUtils";
import { UserService } from "@/services";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";

/** Client -> server frame. `ref` and `room` are omitted when not applicable
 * (a heartbeat carries neither). */
export interface OutboundFrame {
  ref?: string;
  room?: string;
  event: string;
  payload: unknown;
}

/** Server -> client frame. */
export interface InboundFrame {
  ref?: string;
  room?: string;
  event: string;
  payload?: any;
}

export type ReplyStatus = "ok" | "error" | "timeout";

const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** Default time to wait for a `reply` before a push gives up, matching the
 * timeout the phoenix client used so ack-wait behaviour is unchanged. */
const PUSH_TIMEOUT_MS = 10_000;

/** Transport reconnect backoff, in ms, indexed by attempt; the last value
 * repeats forever. The socket reconnects on its own for transient drops --
 * exactly as the phoenix client did -- so useWebSocket's own reconnect logic
 * stays the outer net for a channel that closes for good. */
const RECONNECT_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/** Close codes we must NOT retry: a deliberate client close, and a policy
 * rejection (an expired or invalid token), where retrying just burns the
 * same failure on a loop. */
const TERMINAL_CLOSE_CODES = new Set([1000, 1008]);

/**
 * Events the transport handles itself and must not forward to the app:
 * `join`/`leave` are our own outbound lifecycle frames, and `heartbeat` is a
 * keepalive with nothing in it. `reply` IS forwarded despite being protocol
 * plumbing, because chatSocketUtils' payload normalizer reads it directly
 * (a specific push's own reply is separately settled inside `onmessage`
 * above via the pending-ref map, independent of this forwarding).
 */
const isInternalEvent = (ev?: string): boolean =>
  !!ev && (ev === WS_EVENT.Heartbeat || ev === WS_EVENT.Join || ev === WS_EVENT.Leave);

/**
 * The handle returned by `ChatChannel.push()`. Mirrors the phoenix Push
 * object's contract, including the part that matters most: a `.receive()`
 * registered AFTER the reply already arrived still fires. Callers chain
 * `.receive('ok', ..).receive('error', ..)` synchronously right after
 * push() returns, but a reply for a queued frame can land at any time.
 */
export class ChatPush {
  private readonly handlers = new Map<string, Array<(response?: any) => void>>();
  private settled = false;
  private status: ReplyStatus | null = null;
  private response: any = undefined;

  receive(status: string, callback: (response?: any) => void): ChatPush {
    if (this.settled && this.status === status) {
      // Reply beat the subscription; deliver it rather than drop it.
      try {
        callback(this.response);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] push receive handler threw", e);
      }
      return this;
    }
    const list = this.handlers.get(status) ?? [];
    list.push(callback);
    this.handlers.set(status, list);
    return this;
  }

  /** Settles the push exactly once. Later replies with the same ref (a server
   * retransmit, say) are ignored rather than re-firing callbacks. */
  settle(status: ReplyStatus, response?: any): void {
    if (this.settled) return;
    this.settled = true;
    this.status = status;
    this.response = response;
    for (const cb of this.handlers.get(status) ?? []) {
      try {
        cb(response);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] push receive handler threw", e);
      }
    }
  }

  get isSettled(): boolean {
    return this.settled;
  }
}

type EventHandler = (payload: any, ref?: string) => void;

/**
 * One room's worth of the connection. Owns the event subscriptions and turns
 * `push()` into a ref-correlated frame on the shared socket.
 */
export class ChatChannel {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(
    private readonly socket: ChatSocket,
    readonly room: string
  ) {}

  on(event: string, callback: EventHandler): number {
    const list = this.handlers.get(event) ?? [];
    list.push(callback);
    this.handlers.set(event, list);
    return list.length;
  }

  off(event: string, callback?: EventHandler): void {
    if (!callback) {
      this.handlers.delete(event);
      return;
    }
    const list = this.handlers.get(event);
    if (!list) return;
    const next = list.filter((fn) => fn !== callback);
    if (next.length) this.handlers.set(event, next);
    else this.handlers.delete(event);
  }

  push(event: string, payload?: unknown, timeoutMs = PUSH_TIMEOUT_MS): ChatPush {
    return this.socket.push(this.room, event, payload ?? {}, timeoutMs);
  }

  join(payload?: Record<string, unknown>): ChatPush {
    return this.push(WS_EVENT.Join, payload ?? {});
  }

  leave(): ChatPush {
    return this.push(WS_EVENT.Leave, {});
  }

  /** Called by the socket for every inbound frame addressed to this room (or
   * carrying no room at all, which we treat as a broadcast). */
  dispatch(frame: InboundFrame): void {
    for (const fn of this.handlers.get(frame.event) ?? []) {
      try {
        fn(frame.payload, frame.ref);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] channel handler threw", { event: frame.event, e });
      }
    }
  }
}

/**
 * The WebSocket itself: one connection, one room. Owns ref allocation, the
 * pending-reply table, the send buffer for frames written before the socket
 * is open, and the reconnect backoff.
 */
export class ChatSocket {
  private ws: WebSocket | null = null;
  private refCounter = 0;
  private readonly pending = new Map<string, { push: ChatPush; timer: ReturnType<typeof setTimeout> }>();
  /** Frames written while the socket was not OPEN, replayed on connect. A
   * message typed during a reconnect must not be silently dropped. */
  private sendBuffer: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByClient = false;

  onFrame: ((frame: InboundFrame) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: ((info: { code?: number; reason?: string }) => void) | null = null;
  onError: ((err?: unknown) => void) | null = null;

  constructor(private readonly url: string) {}

  get isOpen(): boolean {
    return this.ws?.readyState === 1;
  }

  connect(): void {
    if (this.closedByClient) return;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch (e) {
      if (DEV) console.warn("[chat-ws] WebSocket constructor threw", e);
      this.onError?.(e);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.flushSendBuffer();
      this.onOpen?.();
    };

    socket.onmessage = (evt: MessageEvent) => {
      let frame: InboundFrame | null = null;
      try {
        frame = typeof evt.data === "string" ? JSON.parse(evt.data) : (evt.data as InboundFrame);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] unparseable frame", { data: evt.data, e });
        return;
      }
      if (!frame || typeof frame !== "object" || typeof frame.event !== "string") return;

      // A reply settles the push that carried its ref, and goes no further
      // unless something else is listening for replies too.
      if (frame.event === WS_EVENT.Reply && frame.ref) {
        const entry = this.pending.get(frame.ref);
        if (entry) {
          this.pending.delete(frame.ref);
          clearTimeout(entry.timer);
          const status: ReplyStatus = frame.payload?.status === "ok" ? "ok" : "error";
          entry.push.settle(status, frame.payload?.response);
        }
      }

      this.onFrame?.(frame);
    };

    socket.onerror = (e) => {
      if (DEV) console.warn("[chat-ws] socket error", e);
      this.onError?.(e);
    };

    socket.onclose = (evt: CloseEvent) => {
      this.ws = null;
      // Anything still waiting for a reply will never get one on this
      // connection. Time them out now rather than leaving callers hanging
      // until their own timer fires.
      this.failAllPending();
      if (this.closedByClient || TERMINAL_CLOSE_CODES.has(evt?.code)) {
        this.onClose?.({ code: evt?.code, reason: evt?.reason });
        return;
      }
      this.scheduleReconnect();
    };
  }

  /** Allocates a ref, registers the pending reply and writes the frame. */
  push(room: string | undefined, event: string, payload: unknown, timeoutMs: number): ChatPush {
    const push = new ChatPush();
    const ref = String(++this.refCounter);

    const timer = setTimeout(() => {
      if (this.pending.delete(ref)) push.settle("timeout");
    }, timeoutMs);
    this.pending.set(ref, { push, timer });

    this.send({ ref, room, event, payload });
    return push;
  }

  /** Fire-and-forget write: no ref, so the server sends no reply. */
  send(frame: OutboundFrame): void {
    const body: Record<string, unknown> = { event: frame.event, payload: frame.payload ?? {} };
    if (frame.ref !== undefined) body.ref = frame.ref;
    if (frame.room) body.room = frame.room;

    const encoded = JSON.stringify(body);
    if (this.isOpen) {
      try {
        this.ws!.send(encoded);
        return;
      } catch (e) {
        if (DEV) console.warn("[chat-ws] send failed, buffering", e);
      }
    }
    this.sendBuffer.push(encoded);
  }

  close(): void {
    this.closedByClient = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.failAllPending();
    this.sendBuffer = [];
    try {
      this.ws?.close(1000, "client closed");
    } catch {
      /* already gone */
    }
    this.ws = null;
  }

  private flushSendBuffer(): void {
    const queued = this.sendBuffer;
    this.sendBuffer = [];
    for (const encoded of queued) {
      try {
        this.ws?.send(encoded);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] buffered send failed", e);
        this.sendBuffer.push(encoded);
      }
    }
  }

  private failAllPending(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.push.settle("timeout");
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.closedByClient || this.reconnectTimer) return;
    const delay =
      RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.reconnectAttempt += 1;
    if (DEV) console.debug("[chat-ws] reconnecting", { attempt: this.reconnectAttempt, delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export interface RealtimeChannelAdapter {
  readyState: number; // 0 connecting, 1 open, 2 closing, 3 closed
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code?: number; reason?: string }) => void;
  onerror?: (event?: unknown) => void;
  onheartbeat?: (ts: number) => void;
  send: (data: string | Record<string, unknown>) => void;
  emit?: (event: string, payload: unknown) => void;
  sendHeartbeat?: (payload?: Record<string, unknown>) => void;
  ackConfirm?: (clientIds: string[]) => void;
  syncPending?: (list: string[], sseqNext?: string) => void;
  startHeartbeat?: (intervalMs: number) => void;
  stopHeartbeat?: () => void;
  close: () => void;
  /**
   * The ChatChannel backing this adapter. Exposed so consumers that need
   * real channel-level event subscription (`.on()`/`.off()`) and ack-aware
   * pushes (`.push()` returning a chainable ChatPush) -- e.g.
   * ChatBridgeProvider's pickChannel -- can reach it. This adapter's own
   * `send`/`emit` are fire-and-forget (no ack), so they are not a
   * substitute for this field.
   */
  channel?: ChatChannel;
}

/**
 * Builds the adapter the chat hooks consume: opens the socket, joins `room`
 * and forwards every non-internal inbound frame as a normalized envelope.
 *
 * `room` is the wire address (for chat, the bare room id — the `room:` topic
 * prefix died with the array envelope) and `roomId` is the chat room id the
 * event payloads carry. They are the same string for chat, and differ for
 * the per-user event channel, which addresses `user:<id>:events`.
 *
 * `joinOnConnect: false` opens the socket without sending a `join`. The
 * per-user event channel uses it: the server keeps no join registry, and
 * decides whether to deliver a user-scoped frame by parsing the id out of
 * the topic and comparing it to the session's authenticated user
 * (`PhoenixSession::should_deliver` in api-108heros' chat_realtime crate).
 * Joining that channel would be a frame the server has nothing to do with.
 */
export function getChannelAdapter(
  token: string,
  room: string,
  roomId: string,
  senderId: number,
  opts: { joinOnConnect?: boolean } = {}
): RealtimeChannelAdapter {
  const { joinOnConnect = true } = opts;
  // The key id says which device this is, so the relay uses this browser's key
  // rather than the one-per-person fallback. Read at connect time rather than
  // captured earlier: the exchange finishes after sign-in, and a socket built
  // before it lands would stay on the legacy key for the whole session.
  const url = buildChatWsUrl(token, UserService.Instance.authInfo?.chatKeyId);
  const socket = new ChatSocket(url);
  const ch = new ChatChannel(socket, room);

  let readyState = 0;
  const adapter: RealtimeChannelAdapter = {
    get readyState() {
      return readyState;
    },
    set readyState(v: number) {
      readyState = v;
    },
    onopen: undefined,
    onmessage: undefined,
    onclose: undefined,
    onerror: undefined,
    channel: ch,
    send(data: string | Record<string, any>) {
      try {
        const payload = typeof data === "string" ? JSON.parse(data) : data;
        ch.push(WS_EVENT.Message, payload);
      } catch (e) {
        if (DEV) console.error("[chat-ws] send() invalid JSON payload", { data, e });
        adapter.onerror?.({
          code: "INVALID_JSON",
          reason: "send() expects a JSON string or object",
          data,
        });
      }
    },
    emit(event: string, payload: any) {
      try {
        ch.push(event, payload);
      } catch (e) {
        if (DEV) console.warn("[chat-ws] emit failed", { event, e });
      }
    },
    sendHeartbeat(payload?: Record<string, any>) {
      // Per the v2 spec the heartbeat carries no room: it is a keepalive for
      // an idle connection, and the server counts ANY inbound frame as proof
      // of liveness. No ref either -- nothing is waiting for an answer.
      const base = { senderId, event: WS_EVENT.Heartbeat };
      const merged = typeof payload === "object" && payload ? { ...base, ...payload } : base;
      try {
        socket.send({ event: WS_EVENT.Heartbeat, payload: merged });
        try {
          adapter.onheartbeat?.(Date.now());
        } catch {
          /* listener errors must not kill the heartbeat */
        }
        try {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("chat:heartbeat"));
        } catch {
          /* no DOM (SSR/tests) */
        }
        if (DEV) console.debug("[chat-ws] heartbeat sent", merged);
      } catch (err) {
        console.warn("[chat-ws] heartbeat send failed", err);
      }
    },
    close() {
      if (readyState === 3) return;
      readyState = 2;
      try {
        ch.leave();
      } catch {
        /* best effort: the socket may already be gone */
      }
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      readyState = 3;
      adapter.onclose?.({ code: 1000, reason: "client closed" });
    },
  } as RealtimeChannelAdapter;

  // --- Protocol helpers ---
  adapter.ackConfirm = (clientIds: string[]) => {
    try {
      ch.push(WS_EVENT.AckConfirm, { roomId, senderId, clientIds });
    } catch (e) {
      if (DEV) console.warn("[chat-ws] ackConfirm failed", e);
    }
  };

  adapter.syncPending = (list: string[], sseqNext?: string) => {
    try {
      ch.push(WS_EVENT.SyncPending, {
        roomId,
        senderId,
        list,
        sseqHello: sseqNext ? { next: sseqNext } : undefined,
      });
    } catch (e) {
      if (DEV) console.warn("[chat-ws] syncPending failed", e);
    }
  };

  // Heartbeat scheduler (client-side trigger)
  let hbTimer: ReturnType<typeof setInterval> | null = null;
  adapter.startHeartbeat = (intervalMs: number) => {
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(() => adapter.sendHeartbeat?.(), Math.max(1000, intervalMs | 0));
  };
  adapter.stopHeartbeat = () => {
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = null;
  };

  // Forward every non-internal frame as a normalized envelope, and let the
  // channel's own .on() subscribers see it too.
  socket.onFrame = (frame) => {
    try {
      ch.dispatch(frame);
    } catch {
      /* dispatch already guards each handler */
    }
    if (isInternalEvent(frame.event)) return;
    const env = {
      event: frame.event,
      room: frame.room ?? room,
      roomId: frame.room ?? roomId,
      payload: frame.payload == null ? {} : frame.payload,
      ref: frame.ref,
    };
    try {
      adapter.onmessage?.({ data: JSON.stringify(env) });
    } catch {
      /* consumer errors must not break the socket */
    }
  };

  socket.onError = (e) => {
    if (DEV) console.log("[chat-ws] socket error", e);
    adapter.onerror?.(e);
  };

  socket.onClose = (info) => {
    if (DEV) console.log("[chat-ws] socket closed", info);
    readyState = 3;
    adapter.onclose?.({ code: info.code ?? 1006, reason: info.reason ?? "socket closed" });
  };

  // Join on every (re)connect: a reconnected socket has no idea which room
  // this client was in, so re-joining is what makes transport reconnect
  // transparent to everything above.
  socket.onOpen = () => {
    if (!joinOnConnect) {
      // Nothing to wait for, so the socket being open IS readiness here.
      if (readyState !== 1) {
        readyState = 1;
        adapter.onopen?.();
      }
      return;
    }
    try {
      ch.join({ roomId, senderId })
        .receive("ok", () => {
          if (DEV) console.log("[chat-ws] join ok", { room });
          if (readyState !== 1) {
            readyState = 1;
            adapter.onopen?.();
          }
          try {
            const pending: string[] =
              (typeof window !== "undefined" &&
                (window as any)?.chatOutbox?.pending?.(roomId, senderId)) ||
              [];
            adapter.syncPending?.(pending);
          } catch {
            /* no outbox installed */
          }
        })
        .receive("error", (e: any) => {
          if (DEV) console.log("[chat-ws] join error", { room, e });
          adapter.onerror?.(e);
        })
        .receive("timeout", () => {
          if (DEV) console.log("[chat-ws] join timeout", { room });
          adapter.onerror?.({ code: "JOIN_TIMEOUT", reason: "no reply to join" });
        });
    } catch (e) {
      if (DEV) console.log("[chat-ws] join exception", { room, e });
      adapter.onerror?.(e);
    }
  };

  socket.connect();

  return adapter;
}
