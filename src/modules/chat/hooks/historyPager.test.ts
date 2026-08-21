import {describe, expect, it, vi} from "vitest";

import {createHistoryPager, type HistoryPagerState} from "@/modules/chat/hooks/historyPager";

/** A promise plus its resolver, so a test can control exactly when a fetch settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return {promise, resolve};
}

describe("createHistoryPager", () => {
  it("coalesces a concurrent call onto the in-flight promise instead of starting a second fetch", async () => {
    const d = deferred<{prevCursor: string | null}>();
    const fetchPage = vi.fn(() => d.promise);
    const pager = createHistoryPager({fetchPage});

    const first = pager.fetchOnePage();
    const second = pager.fetchOnePage();

    expect(second).toBe(first);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    d.resolve({prevCursor: null});
    await first;
    await second;
  });

  it("clears the in-flight slot once a page resolves, so the next call fetches again", async () => {
    let n = 0;
    const fetchPage = vi.fn(async () => ({prevCursor: `cursor-${++n}`}));
    const pager = createHistoryPager({fetchPage});

    await pager.fetchOnePage();
    await pager.fetchOnePage();

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("clears the slot when a page rejects, and lets the rejection propagate", async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error("network");
    });
    const pager = createHistoryPager({fetchPage});

    await expect(pager.fetchOnePage()).rejects.toThrow("network");

    // Not wedged: a later call retries instead of hanging on a dead slot or
    // silently no-op'ing forever.
    await expect(pager.fetchOnePage()).rejects.toThrow("network");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("advances the cursor across successive pages instead of repeating page one", async () => {
    // This is the actual bug the cursor-ref refactor exists to prevent: a
    // cursor closed over by React state would hand `fetchPage` the same
    // "page one" cursor on every call inside a tight programmatic loop.
    const cursorsSeen: (string | null)[] = [];
    const nextCursors = ["cursor-1", "cursor-2", "cursor-3", null];
    let i = 0;
    const fetchPage = vi.fn(async (cursor: string | null) => {
      cursorsSeen.push(cursor);
      return {prevCursor: nextCursors[i++]};
    });
    const pager = createHistoryPager({fetchPage});

    await pager.fetchOnePage();
    await pager.fetchOnePage();
    await pager.fetchOnePage();
    await pager.fetchOnePage();

    expect(cursorsSeen).toEqual([null, "cursor-1", "cursor-2", "cursor-3"]);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(pager.hasMore()).toBe(false);
  });

  it("stops when there is no next cursor", async () => {
    const fetchPage = vi.fn(async () => ({prevCursor: null}));
    const pager = createHistoryPager({fetchPage});

    await pager.fetchOnePage();

    expect(pager.hasMore()).toBe(false);
    // hasMore() is false, so a further call must not fetch again.
    await pager.fetchOnePage();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("stops when the server repeats the same cursor instead of advancing", async () => {
    const fetchPage = vi.fn(async () => ({prevCursor: "stuck"}));
    const pager = createHistoryPager({fetchPage});

    await pager.fetchOnePage(); // first page: nothing to compare against yet
    expect(pager.hasMore()).toBe(true);

    await pager.fetchOnePage(); // second page: server hands back "stuck" again
    expect(pager.hasMore()).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("reset() clears the cursor and hasMore back to their start-of-room values", async () => {
    const fetchPage = vi.fn(async () => ({prevCursor: "cursor-1"}));
    const pager = createHistoryPager({fetchPage});

    await pager.fetchOnePage();
    expect(pager.hasMore()).toBe(true);

    pager.reset();
    expect(pager.hasMore()).toBe(true); // back to the fresh-room default, not false

    await pager.fetchOnePage();
    expect(fetchPage).toHaveBeenLastCalledWith(null); // cursor was cleared -- page one again
  });

  it("reset() also clears the in-flight slot, so a fetch started before it doesn't block a new one", async () => {
    const d = deferred<{prevCursor: string | null}>();
    const fetchPage = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue({prevCursor: null});
    const pager = createHistoryPager({fetchPage});

    const stale = pager.fetchOnePage(); // in flight, unresolved
    pager.reset();
    const fresh = pager.fetchOnePage(); // must not coalesce onto `stale`

    expect(fresh).not.toBe(stale);
    expect(fetchPage).toHaveBeenCalledTimes(2);

    d.resolve({prevCursor: null});
    await stale;
    await fresh;
  });

  it("Finding 3: a stale run resolving after reset() must not clear a newer run's in-flight slot", async () => {
    // Sequence under test: run1 starts, the room changes mid-fetch (reset()
    // clears the *tracked* slot but run1 keeps executing in the
    // background), run2 starts fresh into the now-empty slot, then the
    // stale run1 finally resolves. An unconditional `inFlight = null` in
    // run1's `finally` would null out run2's still-in-flight slot, and a
    // third caller would then slip in and start a concurrent run3 against
    // the same cursor -- exactly the bug the identity check prevents.
    const pending: ReturnType<typeof deferred<{prevCursor: string | null}>>[] = [];
    const fetchPage = vi.fn(() => {
      const d = deferred<{prevCursor: string | null}>();
      pending.push(d);
      return d.promise;
    });
    const pager = createHistoryPager({fetchPage});

    const p1 = pager.fetchOnePage(); // run1: fetchPage call #1
    pager.reset(); // simulates a room switch while run1 is still in flight
    const p2 = pager.fetchOnePage(); // run2: fetchPage call #2

    pending[0].resolve({prevCursor: "a"}); // the stale run1 completes now
    await p1;

    const p3 = pager.fetchOnePage(); // must coalesce onto run2, not start a third fetch

    expect(fetchPage).toHaveBeenCalledTimes(2); // a 3rd call here is exactly Finding 3's bug
    expect(p3).toBe(p2);

    pending[1].resolve({prevCursor: null});
    await p2;
    await p3;
  });

  it("Finding 7: a stale run resolving after reset() must not clobber the reset pager's cursor/hasMore", async () => {
    // Sequence under test: run1 starts (page one, cursor=null), reset()
    // fires while it is still in flight (e.g. a room switch), and only then
    // does run1's stale result land -- reporting `prevCursor: null`, i.e.
    // "no more pages". Without bumping the generation in reset() and
    // checking it before writing cursor/hasMoreFlag, that stale result
    // unconditionally sets hasMoreFlag = false, clobbering the fresh-room
    // state reset() just established -- so a subsequent fetchOnePage()
    // silently no-ops instead of fetching page one again.
    const d = deferred<{prevCursor: string | null}>();
    const fetchPage = vi.fn().mockReturnValueOnce(d.promise);
    const pager = createHistoryPager({fetchPage});

    const stale = pager.fetchOnePage(); // run1: fetchPage call #1, cursor=null
    pager.reset();
    expect(pager.hasMore()).toBe(true); // fresh-room default, right after reset()

    d.resolve({prevCursor: null}); // the stale run reports "no more pages"
    await stale;

    // The bug: an unguarded write here leaves hasMore() false, and the
    // reset room silently never pages again.
    expect(pager.hasMore()).toBe(true);

    fetchPage.mockResolvedValueOnce({prevCursor: "cursor-1"});
    await pager.fetchOnePage();

    expect(fetchPage).toHaveBeenCalledTimes(2); // the real, post-reset page one
    expect(fetchPage).toHaveBeenLastCalledWith(null);
  });

  it("Residual 2: a stale run resolving after a newer run has started must not report isFetching: false while that newer run is still in flight", async () => {
    // Sequence under test: run1 starts and is left pending, reset() fires
    // mid-flight (bumps the generation -- this is reachable in production,
    // not just a defensive scenario: useChatHistory calls reset() on every
    // room change), run2 starts fresh and is ALSO left pending, then run1's
    // stale result lands. Without guarding the `isFetching = false` write in
    // `finally` the same way the cursor/hasMoreFlag write in `try` is
    // guarded, run1's late resolution reports the pager idle while run2 --
    // the real, current fetch -- is still genuinely outstanding.
    const d1 = deferred<{prevCursor: string | null}>();
    const d2 = deferred<{prevCursor: string | null}>();
    const fetchPage = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
    const states: HistoryPagerState[] = [];
    const pager = createHistoryPager({fetchPage, onState: (s) => states.push({...s})});

    const p1 = pager.fetchOnePage(); // run1: fetchPage call #1, still pending
    pager.reset(); // simulates a room switch while run1 is still in flight
    const p2 = pager.fetchOnePage(); // run2: fetchPage call #2, also still pending

    states.length = 0; // only care about what's emitted from here on
    d1.resolve({prevCursor: null}); // the stale run1 resolves now
    await p1;

    // The bug: an unguarded write here reports isFetching: false even
    // though run2 is still genuinely fetching.
    expect(states[states.length - 1]?.isFetching).toBe(true);

    d2.resolve({prevCursor: "cursor-1"}); // run2, the real fetch, finishes
    await p2;

    expect(states[states.length - 1]).toEqual({
      pageCursor: "cursor-1",
      hasMore: true,
      isFetching: false,
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("reports isFetching around each page, and the resulting cursor/hasMore", async () => {
    const states: HistoryPagerState[] = [];
    const fetchPage = vi.fn(async () => ({prevCursor: "cursor-1"}));
    const pager = createHistoryPager({fetchPage, onState: (s) => states.push({...s})});

    await pager.fetchOnePage();

    expect(states).toEqual([
      {pageCursor: null, hasMore: true, isFetching: true},
      {pageCursor: "cursor-1", hasMore: true, isFetching: false},
    ]);
  });
});
