import {describe, expect, it, vi} from "vitest";

import {runBackfill} from "@/modules/chat/hooks/historyBackfill";

/** A fake history source with `pages` pages left to hand out. */
function source(pages: number) {
  let remaining = pages;
  return {
    fetchOnePage: vi.fn(async () => {
      remaining -= 1;
    }),
    hasMore: () => remaining > 0,
    get remaining() {
      return remaining;
    },
  };
}

describe("runBackfill", () => {
  it("keeps pulling until the history is exhausted", async () => {
    const s = source(4);

    const outcome = await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore});

    expect(outcome).toBe("complete");
    expect(s.fetchOnePage).toHaveBeenCalledTimes(4);
  });

  it("does nothing when there is nothing older", async () => {
    const s = source(0);

    expect(await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore})).toBe("complete");
    expect(s.fetchOnePage).not.toHaveBeenCalled();
  });

  it("reports progress so the panel can say how far it has got", async () => {
    const s = source(3);
    const seen: number[] = [];

    await runBackfill({fetchOnePage: s.fetchOnePage, hasMore: s.hasMore, onPage: (n) => seen.push(n)});

    expect(seen).toEqual([1, 2, 3]);
  });

  it("stops when cancelled, without starting another page", async () => {
    const s = source(10);
    const signal = {aborted: false};

    const outcome = await runBackfill({
      fetchOnePage: s.fetchOnePage,
      hasMore: s.hasMore,
      signal,
      onPage: () => {
        signal.aborted = true;
      },
    });

    expect(outcome).toBe("cancelled");
    expect(s.fetchOnePage).toHaveBeenCalledTimes(1);
  });

  it("does not start at all when cancelled before the first page", async () => {
    const s = source(10);

    const outcome = await runBackfill({
      fetchOnePage: s.fetchOnePage,
      hasMore: s.hasMore,
      signal: {aborted: true},
    });

    expect(outcome).toBe("cancelled");
    expect(s.fetchOnePage).not.toHaveBeenCalled();
  });

  it("reports cancelled when the abort lands on the very last page", async () => {
    // Regression guard for the post-fetch abort check. With exactly one page
    // left, `hasMore()` flips to false in the same tick `onPage` sets the
    // abort flag -- so there is no "next loop turn" for the pre-fetch check
    // to catch it on. Only the check immediately after `fetchOnePage` can
    // still report "cancelled" here; without it the loop would see
    // `hasMore() === false` and fall through to "complete" instead.
    const s = source(1);
    const signal = {aborted: false};

    const outcome = await runBackfill({
      fetchOnePage: s.fetchOnePage,
      hasMore: s.hasMore,
      signal,
      onPage: () => {
        signal.aborted = true;
      },
    });

    expect(outcome).toBe("cancelled");
    expect(s.fetchOnePage).toHaveBeenCalledTimes(1);
  });

  it("gives up rather than looping forever when the cursor never advances", async () => {
    // A server that keeps handing back a next-cursor would otherwise spin
    // here until the tab dies. `capped` exists so the UI can say the results
    // are partial instead of pretending they are complete.
    const fetchOnePage = vi.fn(async () => {});

    const outcome = await runBackfill({fetchOnePage, hasMore: () => true, maxPages: 3});

    expect(outcome).toBe("capped");
    expect(fetchOnePage).toHaveBeenCalledTimes(3);
  });

  it("lets a failing page reject so the caller can show an error", async () => {
    const fetchOnePage = vi.fn(async () => {
      throw new Error("network");
    });

    await expect(runBackfill({fetchOnePage, hasMore: () => true})).rejects.toThrow("network");
  });
});
