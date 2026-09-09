import { describe, expect, it, vi } from "vitest";
import { withDeadline } from "./withDeadline";

describe("withDeadline", () => {
  it("resolves with the value when the work finishes in time", async () => {
    const abort = new AbortController();
    await expect(
      withDeadline(Promise.resolve("done"), 1000, abort),
    ).resolves.toBe("done");
  });

  it("resolves null and aborts when the work outruns the deadline", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      // A promise that never settles -- the shape of a WebAuthn prompt that
      // is never answered, which is what left the sign-in button disabled.
      const never = new Promise<string>(() => {});
      const result = withDeadline(never, 10_000, abort);

      await vi.advanceTimersByTimeAsync(10_000);

      await expect(result).resolves.toBeNull();
      expect(abort.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates a rejection rather than swallowing it", async () => {
    const abort = new AbortController();
    await expect(
      withDeadline(Promise.reject(new Error("declined")), 1000, abort),
    ).rejects.toThrow("declined");
  });

  it("does not abort work that finished in time", async () => {
    const abort = new AbortController();
    await withDeadline(Promise.resolve("done"), 1000, abort);
    expect(abort.signal.aborted).toBe(false);
  });
});
