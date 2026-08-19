"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {Play} from "lucide-react";

import {attachmentSrc, type AttachmentItem} from "@/modules/chat/attachments";

import {MediaEmpty} from "./MediaStates";

type Props = {
    items: AttachmentItem[];
    onOpen: (item: AttachmentItem) => void;
    onJump: (messageId: string) => void;
};

/** One tile. Falls back to a plain label when the bytes will not render. */
const Tile: React.FC<{item: AttachmentItem; onOpen: () => void; onJump: () => void}> = ({
    item,
    onOpen,
    onJump,
}) => {
    const {t} = useTranslation();
    const [failed, setFailed] = React.useState(false);
    const isVideo = item.attachment.kind === "video";

    return (
        // `group` belongs on the li, not the tile button: the jump control is
        // the button's sibling, so a group on the button would never reach it.
        <li className="group relative">
            <button
                type="button"
                onClick={onOpen}
                aria-label={item.attachment.name}
                className="block aspect-square w-full overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {isVideo ? (
                    // Deliberately not a <video preload="metadata"> here: the
                    // grid can hold every clip in the room's history, and one
                    // such element per tile means one authenticated
                    // media-proxy request per video the instant Media opens,
                    // whether or not it is ever played. A flat card costs
                    // nothing over the wire -- the real video loads once, on
                    // demand, when the lightbox opens it.
                    <span className="flex h-full w-full items-center justify-center bg-gray-800" />
                ) : failed ? (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-gray-500">
                        {t("profileChat.mediaPanel.thumbnailFailed")}
                    </span>
                ) : (
                    // Same reasoning as the video placeholder above, applied
                    // to the one element in this tile that does fetch bytes:
                    // `loading="lazy"` defers the authenticated media-proxy
                    // request until the tile is actually near the viewport,
                    // instead of every image in the grid firing at once.
                    <img
                        src={attachmentSrc(item.attachment)}
                        alt=""
                        loading="lazy"
                        onError={() => setFailed(true)}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                )}
            </button>

            {isVideo && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                    <Play className="h-4 w-4" />
                </span>
            )}

            <button
                type="button"
                onClick={onJump}
                title={t("profileChat.mediaPanel.jumpToMessage")}
                aria-label={`${t("profileChat.mediaPanel.jumpToMessage")}: ${item.attachment.name}`}
                className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100 hover:opacity-100"
            >
                ↗
            </button>
        </li>
    );
};

export const MediaGrid: React.FC<Props> = ({items, onOpen, onJump}) => {
    if (items.length === 0) {
        return <MediaEmpty messageKey="profileChat.mediaPanel.emptyImageVideo" />;
    }

    return (
        <ul className="grid grid-cols-3 gap-1.5 p-2 sm:gap-2 sm:p-3">
            {items.map((item) => (
                <Tile
                    key={item.messageId}
                    item={item}
                    onOpen={() => onOpen(item)}
                    onJump={() => onJump(item.messageId)}
                />
            ))}
        </ul>
    );
};
