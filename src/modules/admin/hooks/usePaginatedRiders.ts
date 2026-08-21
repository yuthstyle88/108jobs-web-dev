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
    const [isLoading, setIsLoading] = useState(false);

    const {
        data: paginationData,
        isMutating: isRidersLoading,
        state: fetchState,
        execute: refetch,
    } = useHttpGet("adminListRiders", {
        pageCursor: currentCursor,
        pageBack: false,
        limit,
        status,
    });

    const riders = useMemo(() => paginationData?.riders ?? [], [paginationData?.riders]);

    // The riders endpoint returns the final row as `nextPage` even when the
    // result set is already exhausted. A short page therefore proves there
    // is no next page, regardless of that cursor.
    const hasNextPage = useMemo(
        () => riders.length >= limit && !!paginationData?.nextPage,
        [limit, paginationData?.nextPage, riders.length],
    );
    const hasPreviousPage = useMemo(() => cursorHistory.length > 0, [cursorHistory]);
    const currentPage = cursorHistory.length + 1;

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
        }
    }, [paginationData?.nextPage, currentCursor]);

    const loadPreviousPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            // Each history entry is the forward cursor that originally
            // produced that page. Replaying it with pageBack=false is exact;
            // sending the same cursor as a reverse boundary skips or empties
            // the page, especially when returning to the first page.
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
        }
    }, [cursorHistory]);

    useEffect(() => {
        setIsLoading(isRidersLoading);
    }, [isRidersLoading]);

    // A tab switch changes `status`, which alone forces useHttpGet's SWR key
    // to refetch -- but `currentCursor` and `cursorHistory` are
    // local state, untouched by that key change, so without this the new
    // tab's first fetch still carries whatever cursor was live for the
    // previous tab. Past the end of the new tab's own results, that comes
    // back empty. Pre-existing with the old two-tab toggle; three tabs make
    // it materially easier to hit. See #90.
    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
    }, [status]);

    return {
        riders,
        isLoading,
        error,
        hasNextPage,
        hasPreviousPage,
        currentPage,
        loadNextPage,
        loadPreviousPage,
        refetch,
    };
};
