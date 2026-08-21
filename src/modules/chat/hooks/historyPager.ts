/**
 * The paging state a caller (React or a test) needs to observe.
 */
export type HistoryPagerState = {
  pageCursor: string | null;
  hasMore: boolean;
  isFetching: boolean;
};

export type FetchPageResult = {
  /**
   * Where to resume from on the next page, or `null` if there is nothing
   * older. This is the *only* thing the pager needs back from a fetch --
   * all network I/O, decryption and store writes happen inside `fetchPage`
   * itself, which keeps this module free of React/network/store concerns.
   */
  prevCursor: string | null;
};

export type HistoryPagerDeps = {
  /** Fetch exactly one page starting at `cursor` (`null` = the first page). */
  fetchPage: (cursor: string | null) => Promise<FetchPageResult>;
  /** Called synchronously after every state transition. */
  onState?: (state: HistoryPagerState) => void;
};

export type HistoryPager = {
  /**
   * Pulls one older page. A caller that arrives while a page is already in
   * flight gets handed that same promise rather than starting a second
   * fetch -- see the single-flight comment below for why that matters.
   */
  fetchOnePage: () => Promise<void>;
  /** True while there is a next page to fetch. Read fresh -- it changes as pages land. */
  hasMore: () => boolean;
  /** Clears the cursor, hasMore, the last-cursor memo and the in-flight slot. */
  reset: () => void;
};

/**
 * Owns the mutable paging state that must not live in React state or in a
 * fresh closure per call: the cursor to resume from, whether there is more
 * to fetch, the last cursor seen (so a server that repeats itself doesn't
 * spin forever), and the in-flight promise used for single-flight
 * coalescing.
 *
 * This is deliberately not a React hook. `useChatHistory`'s scroll handler
 * and a programmatic backfill (`runBackfill`, see historyBackfill.ts) both
 * need to call `fetchOnePage` repeatedly -- the backfill potentially many
 * times inside one render. A cursor closed over by `useState` would still
 * read "page one" on every one of those calls, because state updates don't
 * apply until the next render. Plain variables closed over by this factory
 * give every caller, synchronous or not, the latest value immediately.
 * Extracting that into its own module -- exactly as `historyBackfill.ts`
 * extracts the loop -- is also what makes it possible to test this
 * mechanism at all: this repo's test environment is `node`, with no
 * `@testing-library/react`, so a React hook has no way to be exercised by
 * a test directly.
 */
export function createHistoryPager(deps: HistoryPagerDeps): HistoryPager {
  const {fetchPage, onState} = deps;

  let cursor: string | null = null;
  let hasMoreFlag = true;
  let lastCursor: string | null = null;
  let isFetching = false;
  // Single-flight. Handing a concurrent caller the promise already running
  // -- instead of a boolean "busy" flag that just no-ops -- is what stops
  // the scroll handler and a backfill loop from racing two fetches against
  // one shared cursor.
  let inFlight: Promise<void> | null = null;
  // Identifies which fetchOnePage() call currently owns `inFlight`. A run
  // reads its own generation before starting; if a *newer* run has since
  // taken the slot (bumping this counter), a stale run finishing late must
  // not clear the newer run's slot -- see the finally block below. (A
  // simple `const run = (async () => { ...; if (inFlight === run) ... })()`
  // would express the same check more directly, but TypeScript rejects
  // referencing `run` inside its own initializer -- TS2454 -- even though
  // it is only read after an `await`, by which point the assignment has
  // long completed; the counter sidesteps that by not self-referencing.
  let inFlightGeneration = 0;

  const emitState = () => {
    onState?.({pageCursor: cursor, hasMore: hasMoreFlag, isFetching});
  };

  const fetchOnePage = (): Promise<void> => {
    if (!hasMoreFlag) return Promise.resolve();
    if (inFlight) return inFlight;

    const myGeneration = ++inFlightGeneration;

    const run = (async () => {
      isFetching = true;
      emitState();
      try {
        const {prevCursor} = await fetchPage(cursor);

        // A newer run has since taken the in-flight slot -- meaning `reset()`
        // ran while this fetch was still outstanding (see the comment on
        // `inFlightGeneration` above). This run's result describes a room
        // state that no longer exists; writing it now would clobber
        // whatever `reset()` (or a fresher run already in flight) has since
        // established. Concretely: a stale page reporting `prevCursor: null`
        // would otherwise set `hasMoreFlag = false` on a pager `reset()`
        // just promised callers was back to a fresh room's `hasMore() ===
        // true`, so the next `fetchOnePage()`/`runBackfill` would silently
        // no-op and report "complete" having made zero network calls.
        if (inFlightGeneration !== myGeneration) return;

        const sameCursor = prevCursor !== null && prevCursor === lastCursor;

        if (!prevCursor || sameCursor) {
          cursor = null;
          hasMoreFlag = false;
        } else {
          lastCursor = prevCursor;
          cursor = prevCursor;
          hasMoreFlag = true;
        }
      } finally {
        // Both writes guarded by the same generation check, for the same
        // reason the cursor/hasMoreFlag writes above are: a newer run may
        // already be genuinely in flight (its own `isFetching = true` at the
        // top of this same function already ran). This run finishing late
        // must not report the pager as idle out from under that newer run --
        // reachable in production, not just defensive: `useChatHistory`
        // calls `reset()` on every room change (`[roomId]` effect), so a
        // slow page from the *previous* room can resolve after the new
        // room's own fetch is already under way.
        if (inFlightGeneration === myGeneration) {
          isFetching = false;
          inFlight = null;
        }
        emitState();
      }
    })();

    inFlight = run;
    return run;
  };

  const reset = () => {
    cursor = null;
    hasMoreFlag = true;
    lastCursor = null;
    isFetching = false;
    inFlight = null;
    // Invalidates any run still executing in the background: its eventual
    // `cursor`/`hasMoreFlag` writes are for the room state this reset just
    // discarded, and the generation check in `fetchOnePage`'s `try` block
    // above drops them instead of applying them.
    inFlightGeneration += 1;
    emitState();
  };

  return {
    fetchOnePage,
    hasMore: () => hasMoreFlag,
    reset,
  };
}
