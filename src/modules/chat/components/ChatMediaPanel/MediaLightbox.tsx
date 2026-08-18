"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

import type {AttachmentItem} from "@/modules/chat/attachments";

type Props = {
    item: AttachmentItem;
    onClose: () => void;
    onJump: (messageId: string) => void;
};

/**
 * Full-size viewer for one image or video.
 *
 * Video is `controls` + `preload="metadata"` and never autoplays — opening a
 * viewer is not the same as asking for sound.
 */
export const MediaLightbox: React.FC<Props> = ({item, onClose, onJump}) => {
    const {t} = useTranslation();
    const closeRef = React.useRef<HTMLButtonElement>(null);

    // Mount-only: focuses the close button once, and restores focus to
    // whatever triggered the lightbox when it unmounts. Deliberately `[]` --
    // ChatMediaPanel re-renders while its own backfill delivers pages, which
    // passes a brand-new `onClose` closure each time. If this effect
    // depended on `onClose` it would re-run on every such render and yank
    // focus back to Close mid-interaction, fighting whatever the keyboard
    // user is doing with the video/jump controls at that moment.
    React.useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => {
            previouslyFocused?.focus();
        };
    }, []);

    // Separate effect for the Escape listener, which does need to stay
    // current with `onClose` -- re-running this one only re-attaches a
    // window listener, it never touches focus.
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label={item.attachment.name}
        >
            <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm text-white">{item.attachment.name}</p>
                <button
                    type="button"
                    onClick={() => onJump(item.messageId)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                >
                    {t("profileChat.mediaPanel.jumpToMessage")}
                </button>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label={t("profileChat.mediaPanel.closeViewer")}
                    className="rounded-md p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                {item.attachment.kind === "video" ? (
                    <video
                        src={item.attachment.url}
                        controls
                        preload="metadata"
                        className="max-h-full max-w-full"
                    >
                        {t("profileChat.mediaPanel.videoUnsupported")}
                    </video>
                ) : (
                    <img
                        src={item.attachment.url}
                        alt={item.attachment.name}
                        className="max-h-full max-w-full object-contain"
                    />
                )}
            </div>
        </div>
    );
};
