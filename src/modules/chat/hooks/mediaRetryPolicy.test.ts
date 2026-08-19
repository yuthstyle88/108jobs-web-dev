import {describe, expect, it} from "vitest";

import {MEDIA_RETRY_DELAYS_MS, nextMediaRetryDelayMs} from "./mediaRetryPolicy";

/**
 * Mirrors `FLUSH_INTERVAL_SECS` in api-108jobs's
 * `crates/chat_realtime/src/broker/manager.rs:30` -- the periodic-flush
 * interval that bounds how long `chat_message` can take to persist to
 * Postgres, which is the real constraint `MEDIA_RETRY_DELAYS_MS` has to
 * outlast (see that constant's own doc comment). Kept as a separate literal
 * here rather than imported, since that constant lives in a different
 * repo/language; if it ever changes, this one -- and the retry schedule it
 * guards -- needs a matching look.
 */
const CHAT_FLUSH_INTERVAL_MS = 10_000;

describe("nextMediaRetryDelayMs", () => {
  it("returns the first backoff delay right after the first failure", () => {
    expect(nextMediaRetryDelayMs(1)).toBe(MEDIA_RETRY_DELAYS_MS[0]);
  });

  it("walks the whole schedule in order as failures keep happening", () => {
    const delays = MEDIA_RETRY_DELAYS_MS.map((_, i) => nextMediaRetryDelayMs(i + 1));
    expect(delays).toEqual([...MEDIA_RETRY_DELAYS_MS]);
  });

  it("backs off -- each scheduled delay is longer than the last", () => {
    for (let i = 1; i < MEDIA_RETRY_DELAYS_MS.length; i++) {
      expect(MEDIA_RETRY_DELAYS_MS[i]!).toBeGreaterThan(MEDIA_RETRY_DELAYS_MS[i - 1]!);
    }
  });

  it("gives up once every scheduled attempt has been used", () => {
    // This is the contract a genuine, permanent 404/403 relies on: retrying
    // must eventually stop rather than hammering the server forever.
    expect(nextMediaRetryDelayMs(MEDIA_RETRY_DELAYS_MS.length + 1)).toBeNull();
    expect(nextMediaRetryDelayMs(MEDIA_RETRY_DELAYS_MS.length + 10)).toBeNull();
  });

  it("treats zero or negative failure counts as nothing to retry yet", () => {
    expect(nextMediaRetryDelayMs(0)).toBeNull();
    expect(nextMediaRetryDelayMs(-1)).toBeNull();
  });

  it("is bounded to a small number of attempts, not unlimited", () => {
    expect(MEDIA_RETRY_DELAYS_MS.length).toBeGreaterThan(0);
    expect(MEDIA_RETRY_DELAYS_MS.length).toBeLessThanOrEqual(5);
  });

  it("treats a non-finite failure count as nothing to retry", () => {
    expect(nextMediaRetryDelayMs(Number.NaN)).toBeNull();
    expect(nextMediaRetryDelayMs(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("comfortably outlives the chat flush interval, not just the common-case latency", () => {
    // This is the whole point of the schedule: the asset is genuinely
    // unreadable until api-108jobs's periodic flush persists it (up to
    // `CHAT_FLUSH_INTERVAL_MS`), so the budget must clear that hard interval
    // -- not just some assumed-brief latency -- with real margin, or a
    // large fraction of loads will exhaust their retries before the row
    // ever lands (see the measured evidence in mediaRetryPolicy.ts).
    const totalCoverageMs = MEDIA_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);

    expect(totalCoverageMs).toBeGreaterThan(CHAT_FLUSH_INTERVAL_MS);

    // Require a real cushion, not a near-miss that flakes the moment the
    // flush is running a little behind schedule or a retry request itself
    // takes non-trivial time.
    const marginMs = totalCoverageMs - CHAT_FLUSH_INTERVAL_MS;
    expect(marginMs).toBeGreaterThanOrEqual(5_000);
  });

  it("still resolves the common 3-4s case as fast as the original schedule did", () => {
    // The brief's other hard requirement: widening the budget for the slow
    // tail must not make the common, fast case wait any longer. The first
    // three attempts are the entire original [500, 1000, 2000] schedule, so
    // the cumulative time to the third attempt must be unchanged.
    const cumulativeAtThirdAttempt = MEDIA_RETRY_DELAYS_MS.slice(0, 3).reduce(
      (sum, delay) => sum + delay,
      0,
    );

    expect(cumulativeAtThirdAttempt).toBe(3_500);
  });
});
