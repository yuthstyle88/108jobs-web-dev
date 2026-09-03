import React from "react";
import {ChatStatus} from "@108-plaza/jh-client";

interface Props {
    isOwner: boolean | undefined;
    msgStatus: ChatStatus;
    unread?: boolean;
    isRead: boolean | undefined;
    readTime: string | null
    t: any;
    onRetry?: () => void; // <- allow parent to wire resend.flushActive(roomId)
}

const SentIcon = () => (
    <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M2 12l9 7 11-14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const ReadIcon = () => (
    <svg className="w-4 h-4 inline-block text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 13l4 4 9-9M12 15l2 2 9-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const PendingSpinner = () => (
    <svg className="animate-spin w-4 h-4 inline-block text-gray-400" viewBox="0 0 24 24">
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="60"
            strokeDashoffset="0"
            fill="none"
        />
    </svg>
);

const FailedIcon = () => (
    <svg className="w-4 h-4 inline-block text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 9v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 17h.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const MessageStatusIndicator: React.FC<Props> = ({
                                             isOwner,
                                             msgStatus,
                                             unread,
                                             isRead,
                                             readTime,
                                             t,
                                             onRetry,
                                         }) => {
    // Incoming messages
    if (!isOwner) {
        if (unread === true) {
            return (
                <span className="ml-1 inline-flex items-center gap-1 text-primary">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500"/>
                    {t("profileChat.unread")}
        </span>
            );
        }
        return null;
    }

    // Outgoing messages
    // New business rule: if isRead is true, always show "Read" (overrides delivery status)
    if (isOwner) {
        if (isRead) {
            return (
                <span className="ml-1 inline-flex items-center gap-1 text-green-600 text-xs">
                    <ReadIcon/>
                    <span>{t("profileChat.read") || "Read"}</span>
                    <span className="opacity-70">{readTime}</span>
                </span>
            );
        }

        if (msgStatus === "failed") {
            return (
                <span className="ml-2 inline-flex items-center gap-2 text-red-500">
                    <FailedIcon/>
                    <span className="text-xs">{t("profileChat.failed") || "Failed"}</span>
                    {typeof onRetry === 'function' && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="text-xs px-2 py-0.5 rounded border border-red-400 text-red-600 hover:bg-red-50"
                        >
                            {t("profileChat.retry") || "Retry"}
                        </button>
                    )}
                </span>
            );
        }

        if (msgStatus === "sending" || msgStatus === "retrying") {
            const label = msgStatus.toLowerCase() === 'retrying'
              ? (t("profileChat.retrying") || "Retrying")
              : (t("profileChat.sending") || "Sending");
            return (
                <span className="ml-2 inline-flex items-center gap-1 text-gray-500">
                    <PendingSpinner/>
                    <span className="text-xs">{label}</span>
                </span>
            );
        }

        // Default for delivered but not read yet
        return (
            <span className="ml-1 inline-flex items-center gap-1 text-gray-500">
                <SentIcon/>
                <span className="text-xs">{t("profileChat.sent") || "Sent"}</span>
            </span>
        );
    }

    return null;
};

export default MessageStatusIndicator;
