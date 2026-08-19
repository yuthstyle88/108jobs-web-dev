import {describe, expect, it} from "vitest";

import {MEDIA_RETRY_DELAYS_MS, nextMediaRetryDelayMs} from "./mediaRetryPolicy";

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
});
