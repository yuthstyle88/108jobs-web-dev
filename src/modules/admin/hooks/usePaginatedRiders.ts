"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService"; // assuming you have this
import {PaginationCursor, RiderVerificationStatus} from "108jobs-client";

interface UsePaginatedRidersProps {
    status?: RiderVerificationStatus;
    limit?: number;
}

export const usePaginatedRiders = ({
                                       status = "Pending",
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
        status,
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

    // A tab switch changes `status`, which alone forces useHttpGet's SWR key
    // to refetch -- but `currentCursor`/`cursorHistory`/`isGoingBack` are
    // local state, untouched by that key change, so without this the new
    // tab's first fetch still carries whatever cursor was live for the
    // previous tab. Past the end of the new tab's own results, that comes
    // back empty. Pre-existing with the old two-tab toggle; three tabs make
    // it materially easier to hit. See #90.
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
        setIsGoingBack(false);
    }, [status]);

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