/** How a backfill ended. `capped` means the results are partial. */
export type BackfillOutcome = "complete" | "cancelled" | "capped";

export type BackfillDeps = {
  /** Pulls exactly one older page and writes it to the store. */
  fetchOnePage: () => Promise<void>;
  /** Read fresh each iteration — it changes as pages land. */
  hasMore: () => boolean;
  /** Anything with an `aborted` flag; an `AbortSignal` satisfies this. */
  signal?: {aborted: boolean};
  onPage?: (pagesLoaded: number) => void;
  maxPages?: number;
};

/**
 * A hard stop so a server that always returns a next-cursor cannot spin this
 * forever. At the hook's page size of 40 this is 8,000 messages -- still far
 * beyond any realistic 1:1 job conversation, but a fraction of the previous
 * 1000-page cap's 40,000: opening a tab auto-starts this, and each page is a
 * sequential authorized request plus client-side decryption, so the old cap
 * meant up to 1000 of those, unprompted, before the `capped` banner (which
 * already tells the truth about a partial result either way) would ever show.
 */
const DEFAULT_MAX_PAGES = 200;

/**
 * Pull older history until there is none left, the caller cancels, or the cap
 * trips.
 *
 * Extracted from React so the interesting parts — that cancellation is checked
 * before starting a page as well as after, that the cap is reported rather
 * than silently swallowed — are testable without a component.
 */
export async function runBackfill(deps: BackfillDeps): Promise<BackfillOutcome> {
  const maxPages = deps.maxPages ?? DEFAULT_MAX_PAGES;
  let pagesLoaded = 0;

  while (deps.hasMore()) {
    if (deps.signal?.aborted) return "cancelled";
    if (pagesLoaded >= maxPages) return "capped";

    await deps.fetchOnePage();
    pagesLoaded += 1;
    deps.onPage?.(pagesLoaded);

    if (deps.signal?.aborted) return "cancelled";
  }

  return "complete";
}
