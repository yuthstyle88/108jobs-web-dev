import React from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { UserReviewView } from "108jobs-client";
import {Stars} from "@/components/RatingDisplay";

// Define interface for props
interface ReviewCardProps {
    reviewView: UserReviewView;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ reviewView }) => {
    const { t } = useTranslation();
    const { review, reviewer, reviewee, workflow } = reviewView;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 max-w-2xl mx-auto w-full">
            {/* Main container with reduced padding for less height */}
            <div className="flex flex-col space-y-4">
                {/* Reviewer Info Section */}
                <section className="flex items-center space-x-4">
                    {reviewer.avatar && (
                        <Image
                            src={reviewer.avatar}
                            alt={`${reviewer.name}'s avatar`}
                            width={48}
                            height={48}
                            className="rounded-full border-2 border-gray-200 shadow-sm"
                        />
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">
                            {reviewer.displayName || reviewer.name}
                        </h3>
                        {reviewer.bio && (
                            <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                                {reviewer.bio}
                            </p>
                        )}
                    </div>
                </section>

                {/* Review Details Section */}
                <section>
                    <div className="flex items-center space-x-3 mb-2">
                        <Stars rating={review.rating} />
                        <span className="text-xs text-gray-700 font-medium">
                            {t("profile.reviewPostedOn")} {new Date(review.createdAt).toLocaleDateString()}
                            {review.updatedAt && (
                                <span className="text-gray-500">
                                    {" "}
                                    ({t("profile.updatedOn")} {new Date(review.updatedAt).toLocaleDateString()})
                                </span>
                            )}
                        </span>
                    </div>
                    {review.proposal && (
                        <p className="text-sm text-gray-800 italic bg-gray-100 p-3 rounded-xl leading-relaxed shadow-inner">
                            {review.proposal}
                        </p>
                    )}
                </section>

                {/* Workflow Details Section */}
                <section className="border-t border-gray-200 pt-4">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                        {t("profile.workflowDetails")}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                        <p>
                            <span className="font-medium">{t("profile.workflowStatus")}:</span>{" "}
                            <span className="text-gray-900">{workflow.status}</span>
                        </p>
                        <p>
                            <span className="font-medium">{t("profile.revisionRequired")}:</span>{" "}
                            <span className="text-gray-900">
                                {workflow.revisionRequired ? t("global.yes") : t("global.no")}
                            </span>
                        </p>
                        <p>
                            <span className="font-medium">{t("profile.revisionCount")}:</span>{" "}
                            <span className="text-gray-900">{workflow.revisionCount}</span>
                        </p>
                        <p>
                            <span className="font-medium">{t("profile.deliverableVersion")}:</span>{" "}
                            <span className="text-gray-900">{workflow.deliverableVersion}</span>
                        </p>
                        {workflow.deliverableSubmittedAt && (
                            <p>
                                <span className="font-medium">{t("profile.deliverableSubmittedAt")}:</span>{" "}
                                <span className="text-gray-900">
                                    {new Date(workflow.deliverableSubmittedAt).toLocaleDateString()}
                                </span>
                            </p>
                        )}
                    </div>
                </section>

                {/* Reviewee Info Section */}
                <section className="border-t border-gray-200 pt-4">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                        {t("profile.reviewee")}
                    </h4>
                    <div className="flex items-center space-x-4">
                        {reviewee.avatar && (
                            <Image
                                src={reviewee.avatar}
                                alt={`${reviewee.name}'s avatar`}
                                width={48}
                                height={48}
                                className="rounded-full border-2 border-gray-200 shadow-sm"
                            />
                        )}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {reviewee.displayName || reviewee.name}
                            </h3>
                            {reviewee.bio && (
                                <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                                    {reviewee.bio}
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ReviewCard;