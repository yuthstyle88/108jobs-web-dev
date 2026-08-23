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
        setCurrentCursor(undefined);
        setCursorHistory([]);
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
