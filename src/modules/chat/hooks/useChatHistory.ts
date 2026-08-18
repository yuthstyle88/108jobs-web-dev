import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchHistoryPage} from '@/modules/chat/utils/chatSocketUtils';
import {runBackfill, type BackfillOutcome} from '@/modules/chat/hooks/historyBackfill';
import {ChatMessage} from "108jobs-client";

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

    // Refs, not state, because a programmatic backfill calls the fetcher many
    // times inside one render: a state-closed cursor would still be page one
    // on every iteration.
    const cursorRef = useRef<string | null>(null);
    const hasMoreRef = useRef<boolean>(true);
    const lastCursorRef = useRef<string | null>(null);
    // Single-flight. The scroll handler and the backfill both fetch, and
    // handing the second caller the promise already running is what keeps
    // them from interleaving pages against a shared cursor.
    const inFlightRef = useRef<Promise<void> | null>(null);

    // Reset cursor/state when room changes
    useEffect(() => {
        setPageCursor(null);
        setHasMore(true);
        cursorRef.current = null;
        hasMoreRef.current = true;
        lastCursorRef.current = null;
        inFlightRef.current = null;
    }, [roomId]);

    const fetchOnePage = useCallback(async (): Promise<void> => {
        if (isE2EMock || !hasMoreRef.current) return;
        if (inFlightRef.current) return inFlightRef.current;

        const run = (async () => {
            setIsFetching(true);
            try {
                const {prev, items} = await fetchHistoryPage(
                    {roomId, cursor: cursorRef.current, limit: pageSize},
                    {localUserId, receivedSet, broadcast},
                );

                if (items && Array.isArray(items)) {
                    // Reverse items before inserting to match ascending render order
                    upsertHistory(roomId, items.reverse());
                }

                // For backfill, use `prev` to continue going backward.
                const prevCursor = (typeof prev === 'string' && prev.length > 0) ? prev : null;
                const sameCursor = prevCursor !== null && prevCursor === lastCursorRef.current;

                if (!prevCursor || sameCursor) {
                    cursorRef.current = null;
                    hasMoreRef.current = false;
                    setPageCursor(null);
                    setHasMore(false);
                } else {
                    lastCursorRef.current = prevCursor;
                    cursorRef.current = prevCursor;
                    hasMoreRef.current = true;
                    setPageCursor(prevCursor);
                    setHasMore(true);
                }
            } finally {
                setIsFetching(false);
                inFlightRef.current = null;
            }
        })();

        inFlightRef.current = run;
        return run;
    }, [isE2EMock, roomId, pageSize, localUserId, receivedSet, broadcast, upsertHistory]);

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
                hasMore: () => hasMoreRef.current,
                signal: loadOpts?.signal,
                onPage: loadOpts?.onPage,
            }),
        [fetchOnePage],
    );

    const reset = useCallback(() => {
        setPageCursor(null);
        setHasMore(true);
        setIsFetching(false);
        cursorRef.current = null;
        hasMoreRef.current = true;
        lastCursorRef.current = null;
        inFlightRef.current = null;
    }, []);

    return {
        state: {pageCursor, hasMore, isFetching},
        actions: {fetchHistory, reset, loadOlderUntilDone},
    };
}
