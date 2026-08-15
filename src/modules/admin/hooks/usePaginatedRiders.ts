"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService"; // assuming you have this
import {PaginationCursor} from "108jobs-client";

interface UsePaginatedRidersProps {
    verified?: boolean;
    limit?: number;
}

export const usePaginatedRiders = ({
                                       verified = false,
                                       limit = 10,
                                   }: UsePaginatedRidersProps = {}) => {
    const {t} = useTranslation();

    const [currentCursor, setCurrentCursor] = useState<PaginationCursor | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<PaginationCursor[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {
        data: paginationData,
        isMutating: isRidersLoading,
        state: fetchState,
        execute: refetch,
    } = useHttpGet("adminListRiders", {
        pageCursor: currentCursor,
        pageBack: isGoingBack,
        limit,
        verified,
    });

    const riders = useMemo(() => paginationData?.riders ?? [], [paginationData?.riders]);

    const hasNextPage = useMemo(() => !!paginationData?.nextPage, [paginationData]);
    const hasPreviousPage = useMemo(() => cursorHistory.length > 0, [cursorHistory]);

    const error = useMemo(() => {
        if (fetchState?.state === REQUEST_STATE.FAILED) {
            return t("admin.riders.fetchError") || "Failed to load riders.";
        }
        return null;
    }, [fetchState?.state, t]);

    const loadNextPage = useCallback(() => {
        if (paginationData?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor ?? ""]);
            setCurrentCursor(paginationData.nextPage);
            setIsGoingBack(false);
        }
    }, [paginationData?.nextPage, currentCursor]);

    const loadPreviousPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    }, [cursorHistory]);

    useEffect(() => {
        setIsLoading(isRidersLoading);
    }, [isRidersLoading]);


    return {
        riders,
        isLoading,
        error,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        refetch,
    };
};