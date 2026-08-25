import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useHttpGet } from "@/hooks/api/http/useHttpGet";
import { REQUEST_STATE } from "@/services/HttpService";
import { PersonId } from "108heros-client";
import { useCursorPagination } from "@/hooks/data/useCursorPagination";

interface UsePaginatedReviewsProps {
    profileId: PersonId;
    limit?: number;
}

export const usePaginatedReviews = ({ profileId, limit = 10 }: UsePaginatedReviewsProps) => {
    const { t } = useTranslation();

    const pager = useCursorPagination();

    const {
        state: searchState,
        data: reviewsPagination,
        isMutating: isReviewsLoading,
        isLoading: isInitialLoading,
    } = useHttpGet("listUserReviews", {
        profileId,
        pageCursor: pager.currentCursor,
        limit,
    });

    const reviewViews = useMemo(() => reviewsPagination?.reviews || [], [reviewsPagination?.reviews]);
    const error = useMemo(() => {
        if (searchState.state === REQUEST_STATE.FAILED) {
            return t("profile.errorFetchingReviews") || "Failed to fetch reviews.";
        }
        return null;
    }, [searchState.state, t]);

    return {
        reviewViews,
        isLoading: isReviewsLoading || isInitialLoading,
        error,
        hasPreviousPage: pager.hasPreviousPage,
        hasNextPage: Boolean(reviewsPagination?.nextPage),
        loadNextReviews: () => pager.handleNextPage(reviewsPagination?.nextPage),
        loadPreviousReviews: pager.handlePrevPage,
    };
};