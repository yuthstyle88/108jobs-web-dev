import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchHistoryPage} from '@/modules/chat/utils/chatSocketUtils';
import {runBackfill, type BackfillOutcome} from '@/modules/chat/hooks/historyBackfill';
import {createHistoryPager, type HistoryPager} from '@/modules/chat/hooks/historyPager';
import {ChatMessage} from "108heros-client";

export type UseChatHistoryOptions = {
    roomId: string;
    pageSize?: number;
    isE2EMock?: boolean;
    localUserId: number;
    receivedSet: Set<string>;
    broadcast: (m: any) => void;
    upsertHistory: (roomId: string, items: ChatMessage[]) => void;
};

export type UseChatHistoryResult = {
    state: {
        pageCursor: string | null;
        hasMore: boolean;
        isFetching: boolean;
    };
    actions: {
        fetchHistory: () => Promise<void>;
        reset: () => void;
        /**
         * Pull older pages until the room is exhausted or the caller cancels.
         * Used by the media panel and by search, which both need history the
         * user has not scrolled to. Rejects if a page fails.
         */
        loadOlderUntilDone: (opts?: {
            signal?: AbortSignal;
            onPage?: (pagesLoaded: number) => void;
        }) => Promise<BackfillOutcome>;
    };
};

export function useChatHistory(opts: UseChatHistoryOptions): UseChatHistoryResult {
    const {roomId, pageSize = 40, isE2EMock = false, localUserId, receivedSet, broadcast, upsertHistory} = opts;

    const [pageCursor, setPageCursor] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // The pager below is created exactly once per hook instance and lives
    // for the component's lifetime (see pagerRef). This ref holds whatever
    // the latest render's fetch inputs were, so the pager's long-lived
    // fetchPage callback reads current values at call time instead of
    // whatever was in scope the one time the pager was constructed. Written
    // from an effect, not during render: refs may only be mutated outside
    // the render phase, in an effect or an event handler.
    const latestRef = useRef({roomId, pageSize, localUserId, receivedSet, broadcast, upsertHistory});
    useEffect(() => {
        latestRef.current = {roomId, pageSize, localUserId, receivedSet, broadcast, upsertHistory};
    });

    // One pager per hook instance, created once on mount and held for the
    // component's lifetime. It owns the cursor/hasMore/last-cursor/in-flight
    // machinery that must not live in React state or be rebuilt on every
    // render -- see historyPager.ts for why, and for the single-flight/reset
    // mechanism this hook merely wires up here.
    //
    // Built inside an effect, not during render: `createHistoryPager` is a
    // plain function, not a React hook, so React's lint rules can't verify
    // it won't call `fetchPage` (which reads `latestRef.current`)
    // synchronously -- so a ref-capturing closure can't be constructed or
    // passed to it during render. The `== null` guard is what the lazy-init
    // pattern requires so this only ever runs once.
    const pagerRef = useRef<HistoryPager | null>(null);
    useEffect(() => {
        if (pagerRef.current == null) {
            pagerRef.current = createHistoryPager({
                fetchPage: async (cursor) => {
                    const {roomId, pageSize, localUserId, receivedSet, broadcast, upsertHistory} = latestRef.current;
                    const {prev, items} = await fetchHistoryPage(
                        {roomId, cursor, limit: pageSize},
                        {localUserId, receivedSet, broadcast},
                    );

                    if (items && Array.isArray(items)) {
                        // Reverse items before inserting to match ascending render order
                        upsertHistory(roomId, items.reverse());
                    }

                    // For backfill, use `prev` to continue going backward.
                    const prevCursor = (typeof prev === 'string' && prev.length > 0) ? prev : null;
                    return {prevCursor};
                },
                onState: (state) => {
                    setPageCursor(state.pageCursor);
                    setHasMore(state.hasMore);
                    setIsFetching(state.isFetching);
                },
            });
        }
    }, []);

    // Reset cursor/state when room changes
    useEffect(() => {
        pagerRef.current?.reset();
    }, [roomId]);

    const fetchOnePage = useCallback((): Promise<void> => {
        if (isE2EMock) return Promise.resolve();
        return pagerRef.current?.fetchOnePage() ?? Promise.resolve();
    }, [isE2EMock]);

    // The public action keeps swallowing errors exactly as it always did --
    // its callers are scroll handlers that have nowhere to show one. The
    // backfill uses `fetchOnePage` directly, because a panel that pulled half
    // a room's history and then hit a network error does have something to say.
    const fetchHistory = useCallback(async () => {
        try {
            await fetchOnePage();
        } catch (e) {
            console.error('[useChatHistory] fetchHistory failed', e);
        }
    }, [fetchOnePage]);

    const loadOlderUntilDone = useCallback(
        (loadOpts?: {signal?: AbortSignal; onPage?: (pagesLoaded: number) => void}) =>
            runBackfill({
                fetchOnePage,
                hasMore: () => pagerRef.current?.hasMore() ?? false,
                signal: loadOpts?.signal,
                onPage: loadOpts?.onPage,
            }),
        [fetchOnePage],
    );

    const reset = useCallback(() => {
        pagerRef.current?.reset();
    }, []);

    return {
        state: {pageCursor, hasMore, isFetching},
        actions: {fetchHistory, reset, loadOlderUntilDone},
    };
}
