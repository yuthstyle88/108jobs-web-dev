"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {ImageOff, Play} from "lucide-react";

import {attachmentSrc, type AttachmentItem} from "@/modules/chat/attachments";
import {useMediaLoadRetry} from "@/modules/chat/hooks/useMediaLoadRetry";

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
    const isVideo = item.attachment.kind === "video";
    const src = attachmentSrc(item.attachment);
    // A just-sent attachment can 404 on its first load, for the sender and
    // any recipient alike -- see `mediaRetryPolicy.ts`. This replaces the
    // grid's old immediate give-up-on-first-error with a bounded retry,
    // landing on the exact same `thumbnailFailed` treatment once (and only
    // once) every attempt is exhausted.
    const {attemptKey, failed, loaded, handleError, handleLoad} = useMediaLoadRetry(src);
    // Only the image branch below ever renders something that can be
    // "pending" -- the video branch is a static card, never a real
    // `<video>` element (see its own comment) -- but this still reads as
    // `false` for it either way, so the ternary below stays simple.
    const isPending = !isVideo && !failed && !loaded;

    return (
        // `group` belongs on the li, not the tile button: the jump control is
        // the button's sibling, so a group on the button would never reach it.
        <li className="group relative">
            <button
                type="button"
                onClick={onOpen}
                aria-label={item.attachment.name}
                // This tile's own `bg-gray-100 ring-1 ring-black/5` already
                // *is* the quiet placeholder: while pending, the `<img>`
                // below is `opacity-0`, so this background shows through in
                // its place -- no separate skeleton element needed.
                // `animate-pulse` is the only thing added for the pending
                // case, to read as "loading" rather than a dead tile.
                className={`block aspect-square w-full overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isPending ? "animate-pulse" : ""
                }`}
            >
                {isVideo ? (
                    // Deliberately not a <video preload="metadata"> here: the
                    // grid can hold every clip in the room's history, and one
                    // such element per tile means one authenticated
                    // media-proxy request per video the instant Media opens,
                    // whether or not it is ever played. A flat card costs
                    // nothing over the wire -- the real video loads once, on
                    // demand, when the lightbox opens it. Nothing to retry or
                    // hide here: this card never fetches anything, so it has
                    // no broken-image moment to guard against.
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
                    // Kept mounted (never conditionally removed) and hidden
                    // via `opacity`, not `display: none`, for the entire
                    // pending/retrying window: a `display: none` image has no
                    // layout box, so it can never be observed as "near the
                    // viewport" and `loading="lazy"` would never fire its
                    // request at all while hidden that way (verified against
                    // the IntersectionObserver spec, which native lazy-load
                    // shares its viewport-distance heuristic with) --
                    // `opacity` keeps the box, so the fetch (and this retry)
                    // still happens exactly as before.
                    <img
                        key={attemptKey}
                        src={src}
                        alt=""
                        loading="lazy"
                        onError={handleError}
                        onLoad={handleLoad}
                        className={`h-full w-full object-cover transition duration-200 group-hover:scale-105 ${
                            loaded ? "opacity-100" : "opacity-0"
                        }`}
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
        return (
            <MediaEmpty
                messageKey="profileChat.mediaPanel.emptyImageVideo"
                icon={<ImageOff className="h-8 w-8 text-gray-300" aria-hidden="true" />}
            />
        );
    }

    return (
        <ul className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
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
