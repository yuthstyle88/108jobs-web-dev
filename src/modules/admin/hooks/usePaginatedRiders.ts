"use client";

import {useEffect, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService";
import {RiderVerificationStatus} from "108jobs-client";
import {useCursorPagination} from "@/hooks/data/useCursorPagination";

interface UsePaginatedRidersProps {
    status?: RiderVerificationStatus;
    limit?: number;
}

export const usePaginatedRiders = ({
                                       status = "Pending",
                                       limit = 10,
                                   }: UsePaginatedRidersProps = {}) => {
    const {t} = useTranslation();

    const pager = useCursorPagination();

    const {
        data: paginationData,
        isMutating: isRidersLoading,
        isLoading: isInitialLoading,
        state: fetchState,
        execute: refetch,
    } = useHttpGet("adminListRiders", {
        pageCursor: pager.currentCursor,
        pageBack: false,
        limit,
        status,
    });

    const riders = useMemo(() => paginationData?.riders ?? [], [paginationData?.riders]);

    // The riders endpoint returns the final row as `nextPage` even when the
    // result set is already exhausted. A short page therefore proves there
    // is no next page, regardless of that cursor.
    const hasNextPage = useMemo(
        () => riders.length >= limit && Boolean(paginationData?.nextPage),
        [limit, paginationData?.nextPage, riders.length],
    );
    const currentPage = pager.cursorHistory.length + 1;

    const error = useMemo(() => {
        if (fetchState?.state === REQUEST_STATE.FAILED) {
            return t("admin.riders.fetchError") || "Failed to load riders.";
        }
        return null;
    }, [fetchState?.state, t]);

    // Reset pagination when status filter tab changes
    useEffect(() => {
        pager.resetPagination();
    }, [status]);

    return {
        riders,
        isLoading: isRidersLoading || isInitialLoading,
        error,
        hasNextPage,
        hasPreviousPage: pager.hasPreviousPage,
        currentPage,
        loadNextPage: () => pager.handleNextPage(paginationData?.nextPage),
        loadPreviousPage: pager.handlePrevPage,
        refetch,
    };
};
