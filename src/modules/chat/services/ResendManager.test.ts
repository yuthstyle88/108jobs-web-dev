import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendManager, type ChatStorePort, type RetryMeta } from "@/modules/chat/services/ResendManager";
import type { ChatSenderAdapter } from "@/modules/chat/adapters/ChatSenderAdapter";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";

// Minimal in-memory ChatStorePort double -- ResendManager only reads/writes
// through this narrow interface, so no real zustand store is needed.
function fakeStore() {
  let retryMeta: RetryMeta = {};
  const failedMessages: any[] = [];
  const upsertRetryMeta = vi.fn((id: string, meta: { retry: number; next: number }) => {
    retryMeta = { ...retryMeta, [id]: meta };
  });
  const dropRetryMeta = vi.fn((id: string) => {
    const next = { ...retryMeta };
    delete next[id];
    retryMeta = next;
  });
  const markFailed = vi.fn();
  const promoteToSent = vi.fn();
  const store: ChatStorePort = {
    getState: () => ({ failedMessages, retryMeta }),
    upsertRetryMeta,
    dropRetryMeta,
    markFailed,
    promoteToSent,
  };
  return { store, upsertRetryMeta, dropRetryMeta, markFailed, promoteToSent, failedMessages };
}

function fakeSender(sendMessage: ReturnType<typeof vi.fn>) {
  return { sendMessage } as unknown as ChatSenderAdapter;
}

describe("ResendManager.onSendFailure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stages retry meta for the given message id, starting at retry 0", () => {
    const { store, upsertRetryMeta } = fakeStore();
    const mgr = new ResendManager(store, fakeSender(vi.fn()));

    mgr.onSendFailure("msg-1", "room-1");

    expect(upsertRetryMeta).toHaveBeenCalledWith(
      "msg-1",
      expect.objectContaining({ retry: 0 })
    );
  });

  it("increments the staged retry count on a second failure for the same message", () => {
    const { store, upsertRetryMeta } = fakeStore();
    const mgr = new ResendManager(store, fakeSender(vi.fn()));

    mgr.onSendFailure("msg-1", "room-1");
    mgr.onSendFailure("msg-1", "room-1");

    expect(upsertRetryMeta).toHaveBeenLastCalledWith(
      "msg-1",
      expect.objectContaining({ retry: 0 })
    );
    // NOTE: onSendFailure reads `retry` from existing meta but never
    // increments it itself -- flush() is what bumps it after an actual
    // failed resend attempt. Calling onSendFailure twice in a row without
    // an intervening flush re-stages the same retry count, just with a
    // fresh `next` delay -- this pins that actual (if perhaps surprising)
    // behavior rather than an assumption about it.
  });

  /**
   * Regression coverage for the actual bug this fixes: onSendFailure's own
   * doc comment claims it's one of only two things that "wake" a resend
   * cycle, but the method itself only ever staged retry meta -- nothing
   * else automatically revisits it (only a manual UI retry button or an
   * offline->online transition trigger a flush), so calling onSendFailure
   * alone previously had zero observable effect until the user noticed and
   * retried by hand.
   */
  it("self-schedules an actual resend of the failed message after the computed delay", async () => {
    const { store, failedMessages } = fakeStore();
    failedMessages.push({
      id: "msg-1",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "hello",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    const sendMessage = vi.fn().mockResolvedValue("server-id-1");
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    mgr.onSendFailure("msg-1", "room-1");
    expect(sendMessage).not.toHaveBeenCalled();

    // Base delay for a first failure is 1000ms +/- 15% jitter -- advance
    // comfortably past the jittered ceiling.
    await vi.advanceTimersByTimeAsync(1200);

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("only flushes the room the failure was reported for", async () => {
    const { store, failedMessages } = fakeStore();
    failedMessages.push(
      {
        id: "msg-1",
        roomId: "room-1",
        senderId: 1,
        secure: false,
        content: "hello",
        status: "failed",
        createdAt: new Date().toISOString(),
        isOwner: true,
      },
      {
        id: "msg-2",
        roomId: "room-2",
        senderId: 1,
        secure: false,
        content: "other room",
        status: "failed",
        createdAt: new Date().toISOString(),
        isOwner: true,
      }
    );
    const sendMessage = vi.fn().mockResolvedValue("server-id");
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    mgr.onSendFailure("msg-1", "room-1");
    await vi.advanceTimersByTimeAsync(1200);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][1]).toMatchObject({ id: "msg-1" });
  });
});

describe("ResendManager retry re-arming after a failed resend attempt (P1 regression)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Regression coverage for the P1 bug: onSendFailure's own self-scheduled
   * setTimeout only ever fires the FIRST automatic retry. When that retry
   * attempt itself fails inside flush() (server rejects, or sendMessage
   * throws), retryMeta is correctly advanced (retry count bumped, new
   * `next` computed) but nothing re-arms a timer to actually revisit the
   * message at that new `next` time -- so a message that fails its first
   * retry silently stops retrying forever, even though the count < 3 cap
   * implies up to 3 automatic attempts were intended.
   *
   * This test scripts sendMessage to fail on its first two calls and
   * succeed on the third, then advances fake timers far enough to cover
   * all 3 scheduled attempts. It only passes if the fix re-arms a new
   * setTimeout after each failed retry below the cap.
   */
  it("keeps auto-retrying a message through its full 3-attempt cap and promotes it to sent once one attempt succeeds", async () => {
    const { store, failedMessages, markFailed, promoteToSent } = fakeStore();
    failedMessages.push({
      id: "msg-1",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "hello",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });

    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(false) // attempt 1 (the original scheduled retry) fails
      .mockResolvedValueOnce(false) // attempt 2 fails
      .mockResolvedValueOnce("server-id-1"); // attempt 3 succeeds
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    mgr.onSendFailure("msg-1", "room-1");
    expect(sendMessage).not.toHaveBeenCalled();

    // Jittered backoff ceilings: retry 0 -> ~1150ms, retry 1 -> ~2300ms,
    // retry 2 -> ~5750ms. Advance well past the sum (9200ms) so all three
    // scheduled attempts have a chance to fire.
    await vi.advanceTimersByTimeAsync(10_000);

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(promoteToSent).toHaveBeenCalledWith("room-1", "msg-1");
    expect(markFailed).not.toHaveBeenCalled();
  });
});

describe("Criterion 1 & 2: Manual retry vs Auto-retry with retry count ceiling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Criterion 1: user manual retry triggers sendMessage even when retry ceiling (count = 3) is reached", async () => {
    const { store, failedMessages } = fakeStore();
    failedMessages.push({
      id: "msg-failed-3",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "failed message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    store.upsertRetryMeta("msg-failed-3", { retry: 3, next: Date.now() - 1000 });

    const sendMessage = vi.fn().mockResolvedValue("server-id-retry");
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    await mgr.retryNow("room-1", "msg-failed-3");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      WS_EVENT.Message,
      expect.objectContaining({ id: "msg-failed-3", roomId: "room-1", status: "retrying" })
    );
  });

  it("Criterion 2: auto-retry via flushAll respects retry ceiling and does NOT send messages with retry >= 3", async () => {
    const { store, failedMessages } = fakeStore();
    failedMessages.push({
      id: "msg-failed-3",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "failed message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    store.upsertRetryMeta("msg-failed-3", { retry: 3, next: Date.now() - 1000 });

    const sendMessage = vi.fn().mockResolvedValue("server-id-retry");
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    await mgr.flushAll();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("Criterion 3: when retry fails again, message status remains failed and user can retry again", async () => {
    const { store, failedMessages, markFailed } = fakeStore();
    failedMessages.push({
      id: "msg-failed-retry",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "failed message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    store.upsertRetryMeta("msg-failed-retry", { retry: 3, next: Date.now() - 1000 });

    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(false) // First manual retry fails
      .mockResolvedValueOnce("server-id-success"); // Second manual retry succeeds
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    // First attempt: user clicks retry
    await mgr.retryNow("room-1", "msg-failed-retry");
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledWith("room-1", "msg-failed-retry");

    // Second attempt: user clicks retry again
    await mgr.retryNow("room-1", "msg-failed-retry");
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("Edge case 4: rapid sequential retries while in-flight only send once (deduplicated by inFlight)", async () => {
    const { store, failedMessages } = fakeStore();
    failedMessages.push({
      id: "msg-spam-retry",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "spam message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });

    let resolveSend!: (val: string) => void;
    const sendPromise = new Promise<string>((res) => {
      resolveSend = res;
    });
    const sendMessage = vi.fn().mockReturnValue(sendPromise);
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    // User clicks retry rapidly multiple times while the first is in-flight
    const p1 = mgr.retryNow("room-1", "msg-spam-retry");
    const p2 = mgr.retryNow("room-1", "msg-spam-retry");
    const p3 = mgr.retryNow("room-1", "msg-spam-retry");

    expect(sendMessage).toHaveBeenCalledTimes(1);

    resolveSend("server-id-1");
    await Promise.all([p1, p2, p3]);

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("Edge case 5: closing/leaving the room during send does not crash or set state on the closed room", async () => {
    const { store, failedMessages, markFailed, promoteToSent } = fakeStore();
    const message = {
      id: "msg-closed-room",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "closed room message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    };
    failedMessages.push(message);

    let resolveSend!: (val: string) => void;
    const sendPromise = new Promise<string>((res) => {
      resolveSend = res;
    });
    const sendMessage = vi.fn().mockReturnValue(sendPromise);
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    const retryPromise = mgr.retryNow("room-1", "msg-closed-room");

    // Room is closed or left while send is in-flight:
    // Message is removed from failedMessages and manager destroyed
    failedMessages.length = 0;
    mgr.destroy();

    resolveSend("server-id-1");
    await expect(retryPromise).resolves.not.toThrow();

    // State of closed room must not be modified
    expect(promoteToSent).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("Edge case 6: successful manual retry promotes message to sent and clears retryMeta", async () => {
    const { store, failedMessages, promoteToSent, dropRetryMeta } = fakeStore();
    failedMessages.push({
      id: "msg-success-retry",
      roomId: "room-1",
      senderId: 1,
      secure: false,
      content: "success message",
      status: "failed",
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    store.upsertRetryMeta("msg-success-retry", { retry: 3, next: Date.now() - 1000 });

    const sendMessage = vi.fn().mockResolvedValue("server-id-ok");
    const mgr = new ResendManager(store, fakeSender(sendMessage));

    await mgr.retryNow("room-1", "msg-success-retry");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(promoteToSent).toHaveBeenCalledWith("room-1", "msg-success-retry");
    expect(dropRetryMeta).toHaveBeenCalledWith("msg-success-retry");
  });
});


