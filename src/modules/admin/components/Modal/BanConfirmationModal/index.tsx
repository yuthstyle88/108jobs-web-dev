"use client";
import {useState, useEffect} from "react";
import Modal from "@/components/ui/Modal";
import {AlertCircle, Loader2} from "lucide-react";
import {useTranslation} from "react-i18next";

interface BanConfirmationModalProps {
    isOpen: boolean;
    user: {
        id: number;
        name: string;
    };
    reason: string;
    onReasonChange: (reason: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function BanConfirmationModal({
                                         isOpen,
                                         user,
                                         reason,
                                         onReasonChange,
                                         onConfirm,
                                         onCancel,
                                         isLoading = false,
                                     }: BanConfirmationModalProps) {
    const {t} = useTranslation();

    // Live clock state
    const [currentTime, setCurrentTime] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        const updateTime = () => {
            const now = new Date();
            const formatted = now.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZoneName: "short",
                timeZone: "Asia/Ho_Chi_Minh", // VN time
            });
            setCurrentTime(formatted);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            className="max-w-md p-6 w-full"
            closeOnOutsideClick={false}
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-100 rounded-full animate-pulse">
                        <AlertCircle className="w-5 h-5 text-red-600"/>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                        {t("manageUsers.banConfirmationModal.title")}
                    </h3>
                </div>

                {/* User Info */}
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {t("manageUsers.banConfirmationModal.description")}
                    </p>

                    <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">User</span>
                            <span className="font-bold text-gray-900">{user.name}</span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-red-200">
                            <span className="text-sm font-medium text-gray-700">Time</span>
                            <span className="text-sm font-mono text-gray-900 bg-white/70 px-2 py-1 rounded">
                                {currentTime}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reason Input */}
                <div className="space-y-2">
                    <label htmlFor="ban-reason" className="text-sm font-semibold text-gray-800">
                        {t("manageUsers.banConfirmationModal.reasonPlaceholder")}
                    </label>
                    <textarea
                        id="ban-reason"
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        placeholder="e.g. Spam, harassment, policy violation..."
                        className="w-full min-h-24 p-3 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder:text-gray-400"
                        rows={3}
                        disabled={isLoading}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {t("manageUsers.banConfirmationModal.cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="py-2 px-5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? (t("common.processing") || "Processing...") : t("manageUsers.banConfirmationModal.confirm")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}