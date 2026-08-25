import React from "react";
import {useTranslation} from "react-i18next";
import ReviewCard from "@/components/Profile/Reviews/ReviewCard";
import {PersonId} from "108heros-client";
import {usePaginatedReviews} from "@/hooks/data/usePaginatedReviews";
import {PaginationControls} from "@/components/PaginationControls";

const ITEMS_PER_PAGE = 1;

interface ReviewsProps {
    profileId: PersonId;
}

const Reviews: React.FC<ReviewsProps> = ({profileId}) => {
    const {t} = useTranslation();
    const {
        reviewViews,
        isLoading,
        error,
        hasPreviousPage,
        hasNextPage,
        loadNextReviews,
        loadPreviousReviews,
    } = usePaginatedReviews({profileId, limit: ITEMS_PER_PAGE});

    return (
        <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="border-b border-gray-200 mb-6">
                <div className="flex space-x-6 overflow-x-auto pb-2">
                    <span className="flex-shrink-0 pb-2 text-sm font-medium text-primary border-b-2 border-primary">
                        {t("profile.reviewTab")}
                    </span>
                </div>
            </div>
            {error && (
                <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100 text-center mb-6">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}
            <div className="space-y-6">
                {reviewViews.length > 0 ? (
                    reviewViews.map((reviewView) => <ReviewCard key={reviewView.review.id} reviewView={reviewView}/>)
                ) : (
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 text-center">
                        <p className="text-gray-600 text-sm">{t("profile.noReviews") || "No reviews available yet."}</p>
                    </div>
                )}
                {isLoading && (
                    <div className="text-center text-gray-600 text-sm">{t("profile.loading") || "Loading..."}</div>
                )}

                {(hasPreviousPage || hasNextPage) && (
                    <div className="flex justify-center mt-8">
                        <PaginationControls
                            hasPrevious={hasPreviousPage}
                            hasNext={hasNextPage}
                            onPrevious={loadPreviousReviews}
                            onNext={loadNextReviews}
                            isLoading={isLoading}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reviews;