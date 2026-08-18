"use client";

import React from "react";
import {useTranslation} from "react-i18next";

/** Centred, quiet block used for every non-content state in the panel. */
export const MediaNotice: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-gray-500">
        {children}
    </div>
);

export const MediaEmpty: React.FC<{messageKey: string}> = ({messageKey}) => {
    const {t} = useTranslation();
    return <MediaNotice>{t(messageKey)}</MediaNotice>;
};

export const MediaError: React.FC<{onRetry: () => void}> = ({onRetry}) => {
    const {t} = useTranslation();
    return (
        <MediaNotice>
            <p role="alert">{t("profileChat.mediaPanel.error")}</p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-[#063a68] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {t("profileChat.mediaPanel.retry")}
            </button>
        </MediaNotice>
    );
};

/** The progressive-history banner: what is happening, and how to stop it. */
export const MediaBackfillBanner: React.FC<{
    phase: "running" | "capped";
    onCancel: () => void;
}> = ({phase, onCancel}) => {
    const {t} = useTranslation();

    if (phase === "capped") {
        return (
            <p className="px-3 py-2 text-xs text-gray-600 bg-amber-50 border-b border-amber-100">
                {t("profileChat.mediaPanel.partial")}
            </p>
        );
    }

    return (
        <div
            className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 bg-blue-50 border-b border-blue-100"
            role="status"
            aria-live="polite"
        >
            <span>{t("profileChat.mediaPanel.loadingOlder")}</span>
            <button
                type="button"
                onClick={onCancel}
                className="rounded px-2 py-1 font-medium text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {t("profileChat.mediaPanel.stopLoading")}
            </button>
        </div>
    );
};
