import {useTranslation} from 'react-i18next';
import {v4 as uuidv4} from 'uuid';
import {StatusKey} from "@/modules/chat/components/FreelanceChatFlow";
import {LocalUserId} from "108heros-client";
import React from "react";

interface ReviewDeliveryModalProps {
    showReviewDeliveryModal: boolean;
    setShowReviewDeliveryModal: (show: boolean) => void;
    goToStatus: (status: StatusKey) => void;
    sendMessage: (message: { message: string; senderId: number; secure: boolean; id: string }) => void;
    requestRevisionAction: () => Promise<boolean>;
    localUser?: { id: LocalUserId };
}

export const ReviewDeliveryModal: React.FC<ReviewDeliveryModalProps> = ({
                                                                            showReviewDeliveryModal,
                                                                            setShowReviewDeliveryModal,
                                                                            goToStatus,
                                                                            sendMessage,
                                                                            requestRevisionAction,
                                                                            localUser,
                                                                        }) => {
    const { t } = useTranslation();

    if (!showReviewDeliveryModal) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-[95%] sm:w-[90%] max-w-md text-center shadow-lg">
                <h3 className="text-base sm:text-lg font-semibold mb-2">
                    {t("profileChat.reviewDeliveryTitle") || "Review Delivery"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                    {t("profileChat.reviewDeliveryDesc") ||
                        "The freelancer submitted work. Do you want to accept or request revision?"}
                </p>
                <div className="flex justify-center gap-2 sm:gap-3">
                    <button
                        className="rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm transition-all duration-200"
                        onClick={() => {
                            setShowReviewDeliveryModal(false);
                            goToStatus("Completed");
                            sendMessage({
                                message: JSON.stringify({ type: 'delivery-accepted' }),
                                senderId: Number(localUser?.id) || 0,
                                secure: Boolean((localUser as any)?.isMessageSecure),
                                id: uuidv4(),
                            });
                        }}
                    >
                        {t("profileChat.acceptAndRelease") || "Accept & Release Payment"}
                    </button>
                    <button
                        className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm transition-all duration-200"
                        onClick={async () => {
                            setShowReviewDeliveryModal(false);
                            await requestRevisionAction();
                        }}
                    >
                        {t("profileChat.requestRevision") || "Request Revision"}
                    </button>
                </div>
            </div>
        </div>
    );
};