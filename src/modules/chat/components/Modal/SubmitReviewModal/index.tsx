import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { PersonId, SubmitUserReviewForm, WorkflowId } from '108heros-client';

interface SubmitReviewModalProps {
    showReviewModal: boolean;
    setShowReviewModal: (show: boolean) => void;
    revieweeId: PersonId;
    workflowId?: WorkflowId;
    submitReview: (form: SubmitUserReviewForm) => Promise<boolean>;
}

export const SubmitReviewModal: React.FC<SubmitReviewModalProps> = ({
                                                                        showReviewModal,
                                                                        setShowReviewModal,
                                                                        revieweeId,
                                                                        workflowId,
                                                                        submitReview,
                                                                    }) => {
    const { t } = useTranslation();
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState<string>('');
    const [error, setError] = useState<string>('');

    if (!showReviewModal) return null;

    const handleSubmit = async () => {
        if (rating < 1 || rating > 5) {
            setError(t('profileChat.ratingRequired') || 'Please select a rating (1-5).');
            return;
        }

        const form: SubmitUserReviewForm = {
            revieweeId,
            workflowId: workflowId ?? 0,
            rating,
            proposal: comment.trim() || undefined,
        };

        try {
            const success = await submitReview(form);
            if (success) {
                setShowReviewModal(false);
                setRating(0);
                setComment('');
                setError('');
            } else {
                setError(t('profileChat.submitReviewError') || 'Failed to submit review. Please try again.');
            }
        } catch {
            setError(t('profileChat.submitReviewError') || 'Failed to submit review. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-transform duration-300 sm:p-8">
                {/* Close Button */}
                <button
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => {
                        setShowReviewModal(false);
                        setRating(0);
                        setComment('');
                        setError('');
                    }}
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">
                    {t('profileChat.submitReviewTitle') || 'Submit Your Review'}
                </h3>
                <p className="mt-2 text-sm text-gray-500 sm:text-base">
                    {t('profileChat.submitReviewDesc') || 'Share your feedback about the freelancer.'}
                </p>

                {/* Error Message */}
                {error && (
                    <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 animate-fade-in">
                        {error}
                    </div>
                )}

                {/* Rating Section */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 sm:text-base">
                        {t('profileChat.ratingLabel') || 'Rating'} <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-2 flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className={`text-3xl transition-transform duration-200 hover:scale-125 focus:outline-none ${
                                    rating >= star ? 'text-yellow-500' : 'text-gray-300'
                                }`}
                                onClick={() => setRating(star)}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comment Section */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-primary sm:text-base">
                        {t('profileChat.commentLabel') || 'Comment (Optional)'}
                    </label>
                    <textarea
                        className="mt-2 w-full rounded-lg text-primary border border-gray-200 p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                        rows={5}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('profileChat.commentPlaceholder') || 'Share your thoughts...'}
                    />
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-all duration-200"
                        onClick={() => {
                            setShowReviewModal(false);
                            setRating(0);
                            setComment('');
                            setError('');
                        }}
                    >
                        {t('profileChat.cancel') || 'Cancel'}
                    </button>
                    <button
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200"
                        onClick={handleSubmit}
                    >
                        {t('profileChat.submitReview') || 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
};