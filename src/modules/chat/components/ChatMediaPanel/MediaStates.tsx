"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {CircleAlert} from "lucide-react";

/**
 * Centred, quiet block used for every non-content state in the panel. `icon`
 * is an already-instantiated, muted glyph shown above the text -- optional so
 * a bare `<MediaNotice>` still works, and a plain element rather than a
 * component reference so each caller can size/color it (and mark it
 * `aria-hidden`) however fits that state instead of this component guessing.
 */
export const MediaNotice: React.FC<{children: React.ReactNode; icon?: React.ReactNode}> = ({
    children,
    icon,
}) => (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-gray-500">
        {icon}
        {children}
    </div>
);

export const MediaEmpty: React.FC<{messageKey: string; icon?: React.ReactNode}> = ({messageKey, icon}) => {
    const {t} = useTranslation();
    return <MediaNotice icon={icon}>{t(messageKey)}</MediaNotice>;
};

export const MediaError: React.FC<{onRetry: () => void}> = ({onRetry}) => {
    const {t} = useTranslation();
    return (
        <MediaNotice icon={<CircleAlert className="h-8 w-8 text-gray-300" aria-hidden="true" />}>
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
    phase: "running" | "capped" | "cancelled";
    onCancel: () => void;
    onRetry: () => void;
}> = ({phase, onCancel, onRetry}) => {
    const {t} = useTranslation();

    if (phase === "capped" || phase === "cancelled") {
        // Same live-region treatment as `running` below: a silent, plain <p>
        // here would mean a screen-reader user hears "loading older…" and
        // then nothing when it lands on capped/cancelled instead of running
        // to completion -- the same gap Task 20's review found and fixed in
        // the search panel's matching notice.
        //
        // Retry button: without it, this state had no way back other than
        // switching the sidebar tab away and back (Finding 5,
        // FINAL-findings.md) -- Search self-heals on its next keystroke,
        // but Media has no equivalent repeated trigger. Same
        // `profileChat.mediaPanel.retry` string `MediaError` already uses
        // below, not a new key.
        return (
            <div
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 bg-amber-50 border-b border-amber-100"
                role="status"
                aria-live="polite"
            >
                <span>{t("profileChat.mediaPanel.partial")}</span>
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded px-2 py-1 font-medium text-primary hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {t("profileChat.mediaPanel.retry")}
                </button>
            </div>
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
