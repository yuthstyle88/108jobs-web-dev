"use client";
import React, {useEffect, useState} from "react";
import Modal from "@/components/ui/Modal";
import {ArrowRightLeft, User, Calendar, Hash, Clock, CheckCircle2, Loader2} from "lucide-react";
import {useTranslation} from "react-i18next";

interface TransferConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
    transfer: {
        userName?: string;
        reason: string;
        amount: number;
        paymentCode?: string;
        date: string;
    } | null;
}

export const TransferConfirmModal: React.FC<TransferConfirmModalProps> = ({
                                                                              isOpen,
                                                                              onClose,
                                                                              onConfirm,
                                                                              isLoading = false,
                                                                              transfer,
                                                                          }) => {
    const {t} = useTranslation();
    const [currentTime, setCurrentTime] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        const updateTime = () => {
            const now = new Date();
            const formatted = now.toLocaleString("en-US", {
                timeZone: "Asia/Ho_Chi_Minh",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZoneName: "short",
            });
            setCurrentTime(formatted);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!transfer) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            className="max-w-md p-6 w-full text-gray-600"
            closeOnOutsideClick={false}
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mb-3">
                        <ArrowRightLeft className="w-7 h-7 text-white"/>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                        {t("profileCoins.transferModal.title") || "Confirm Coin Transfer"}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {t("profileCoins.transferModal.description") ||
                            "Transfer coins from this top-up to the user's wallet."}
                    </p>
                </div>

                {/* Transfer Details */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <User className="w-4 h-4"/>
                            User
                        </span>
                        <span className="text-base font-bold text-gray-900">{transfer.userName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Hash className="w-4 h-4"/>
                            Payment Code
                        </span>
                        <code className="text-sm font-mono bg-white/70 px-2 py-1 rounded">
                            {transfer.paymentCode || "—"}
                        </code>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4"/>
                            Date
                        </span>
                        <span className="text-sm font-medium text-gray-800">{transfer.date}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-emerald-200">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Clock className="w-4 h-4"/>
                            Current Time
                        </span>
                        <span className="text-sm font-mono font-bold text-gray-900 bg-white/80 px-3 py-1.5 rounded-lg">
                            {currentTime}
                        </span>
                    </div>
                </div>

                {/* Amount Highlight */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl p-4 text-center">
                    <p className="text-sm font-medium">Transfer Amount</p>
                    <p className="text-2xl font-bold">
                        +{transfer.amount.toLocaleString()} coins
                    </p>
                </div>

                {/* Reason */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Reason</p>
                    <p className="text-sm text-gray-800">{transfer.reason}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 pt-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                        {t("global.cancel") || "Cancel"}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-medium bg-primary text-white hover:bg-[#063a68] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t("profileCoins.processing") || "Processing..."}</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{t("profileCoins.transferModal.confirm") || "Confirm Transfer"}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};