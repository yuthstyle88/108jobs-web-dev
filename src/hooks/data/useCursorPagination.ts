import {useCallback, useMemo, useState} from "react";

export interface UseCursorPaginationOptions {
    nextPage?: string | null;
    initialCursor?: string;
}

export interface UseCursorPaginationReturn {
    currentCursor: string | undefined;
    cursorHistory: string[];
    isGoingBack: boolean;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    handleNextPage: (nextPageOverride?: string | null) => void;
    handlePrevPage: () => void;
    resetPagination: () => void;
    setCurrentCursor: (cursor: string | undefined) => void;
}

/**
 * The cursor history after a reset.
 *
 * Returns `prev` itself when there is nothing to reset, so React's `Object.is`
 * check sees no change and schedules no render. Exported because the identity,
 * not the contents, is the whole point: a version returning a fresh `[]` is
 * indistinguishable by value and re-renders every time.
 */
export function resetCursorHistory(prev: string[]): string[] {
    return prev.length === 0 ? prev : [];
}

export function useCursorPagination(options?: UseCursorPaginationOptions): UseCursorPaginationReturn {
    const [currentCursor, setCurrentCursor] = useState<string | undefined>(options?.initialCursor);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);

    const hasNextPage = useMemo(() => Boolean(options?.nextPage), [options?.nextPage]);
    const hasPreviousPage = useMemo(() => cursorHistory.length > 0, [cursorHistory.length]);

    const handleNextPage = useCallback((nextPageOverride?: string | null) => {
        const targetNext = nextPageOverride ?? options?.nextPage;
        if (targetNext) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(targetNext);
            setIsGoingBack(false);
        }
    }, [options?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    }, [cursorHistory]);

    const resetPagination = useCallback(() => {
        // Every setter here has to be able to do nothing.
        //
        // `setCurrentCursor(undefined)` and `setIsGoingBack(false)` already
        // bail out on their own: React compares with `Object.is`, and passing
        // the value a piece of state already holds schedules no render. The
        // history did not, because `[]` is a fresh array every time and is
        // never equal to the empty array already in state. So resetting a
        // pager that was already on page one still re-rendered.
        //
        // That is only a wasted render until somebody calls this from an
        // effect keyed on `resetPagination`'s identity -- which the job board
        // does. A function identity is stable in steady state and is NOT
        // stable across a Fast Refresh or a remount, and each re-run then
        // produced a guaranteed render, which produced another re-run:
        //
        //   Maximum update depth exceeded
        //     at useCursorPagination[resetPagination]
        //     at commitHookEffectListMount
        //
        // reproducible on a cold `next dev` compile of /en/job-board. Making
        // the reset idempotent removes the whole class: an extra call is now
        // free, whatever caused it.
        setCurrentCursor(undefined);
        setCursorHistory(resetCursorHistory);
        setIsGoingBack(false);
    }, []);

    return {
        currentCursor,
        cursorHistory,
        isGoingBack,
        hasPreviousPage,
        hasNextPage,
        handleNextPage,
        handlePrevPage,
        resetPagination,
        setCurrentCursor,
    };
}
