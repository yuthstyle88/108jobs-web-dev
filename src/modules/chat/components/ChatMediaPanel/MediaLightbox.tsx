"use client";

import React from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

import type {AttachmentItem} from "@/modules/chat/attachments";

type Props = {
    item: AttachmentItem;
    onClose: () => void;
    onJump: (messageId: string) => void;
    /**
     * Where to send focus on close if the element that originally opened the
     * lightbox is no longer in the document (e.g. the user switched the
     * imageVideo/files tab while the lightbox was open, which unmounts the
     * tile underneath it). Optional so this component doesn't require a
     * caller to supply one, but without it the fallback is `document.body`.
     */
    fallbackFocusRef?: React.RefObject<HTMLElement | null>;
};

/** Elements a keyboard user can land on inside the dialog, in DOM order. */
const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Full-size viewer for one image or video.
 *
 * Video is `controls` + `preload="metadata"` and never autoplays — opening a
 * viewer is not the same as asking for sound.
 */
export const MediaLightbox: React.FC<Props> = ({item, onClose, onJump, fallbackFocusRef}) => {
    const {t} = useTranslation();
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const dialogRef = React.useRef<HTMLDivElement>(null);

    // Mount-only in effect, if not literally in deps: focuses the close
    // button once, and restores focus to whatever triggered the lightbox
    // when it unmounts. Does *not* depend on `onClose` -- ChatMediaPanel
    // re-renders while its own backfill delivers pages, which passes a
    // brand-new `onClose` closure each time, and depending on it here would
    // re-run this effect on every such render, yanking focus back to Close
    // mid-interaction and fighting whatever the keyboard user is doing with
    // the video/jump controls at that moment. `fallbackFocusRef` doesn't have
    // that problem -- it's a ref object, stable for the component's whole
    // lifetime -- so including it doesn't reintroduce the churn `onClose`
    // would have caused; it's here only so the cleanup reads its current
    // `.current` rather than one captured before ChatMediaPanel attached it.
    React.useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        // Captured now, not read fresh in the cleanup below: `fallbackFocusRef`
        // points at ChatMediaPanel's tabpanel div, which this effect's own
        // `[fallbackFocusRef]` dep confirms doesn't change identity for as
        // long as this lightbox instance lives, so there's nothing to gain
        // from a live read and eslint's `exhaustive-deps` flags one anyway
        // (a stale ref in a cleanup is generally unsafe, even though it
        // isn't here).
        const fallbackTarget = fallbackFocusRef?.current ?? null;
        closeRef.current?.focus();
        return () => {
            // `previouslyFocused` can be a detached node by the time this
            // runs: switching the imageVideo/files tab while the lightbox is
            // open unmounts MediaGrid/MediaFileList underneath it (the
            // lightbox itself isn't keyed to either), so the tile that
            // opened it may already be gone. Calling `.focus()` on a
            // detached element is a silent no-op, which would otherwise drop
            // focus to `<body>` with no indication anything happened.
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            } else {
                fallbackTarget?.focus();
            }
        };
    }, [fallbackFocusRef]);

    // Separate effect for the Escape/Tab listeners, which do need to stay
    // current with `onClose` -- re-running this one only re-attaches a
    // window listener, it never touches focus on setup (only in response to
    // a keypress), so it can't fight the mount-only effect above.
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key !== "Tab") return;

            // Focus trap: `aria-modal="true"` claims this dialog is the only
            // thing the page exposes to assistive tech, but nothing enforces
            // that on its own -- without this, Tab from the last focusable
            // element (or Shift+Tab from the first) walks focus straight
            // into the tablist behind it.
            const container = dialogRef.current;
            if (!container) return;
            const focusable = getFocusable(container);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const outside = !active || !container.contains(active);
            const shouldWrap = e.shiftKey ? outside || active === first : outside || active === last;

            if (shouldWrap) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    // Next.js renders this component's tree on the server first, where
    // `document` does not exist -- but by the time `viewing` (the state that
    // gates whether ChatMediaPanel even mounts this component) is truthy,
    // a browser click already set it, so this guard never actually trips in
    // practice. It stays because a portal target that assumes a browser is
    // exactly the kind of thing that turns into a server-render crash the
    // moment this component is reused somewhere less careful.
    if (typeof document === "undefined") return null;

    // Portalled straight to <body>, not rendered in place: on mobile,
    // JobFlowSidebar's slide-over carries a `translate-x-*` utility, and any
    // non-`none` CSS transform establishes a containing block for `position:
    // fixed` descendants -- so without the portal, this dialog's
    // `fixed inset-0` would resolve against the drawer's box instead of the
    // viewport, and the lightbox would render cropped to the drawer instead
    // of full-screen (Finding 2, FINAL-findings.md). Desktop's `<aside>` has
    // no transform, which is why the bug was mobile-only.
    return createPortal(
        <div
            ref={dialogRef}
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
        </div>,
        document.body,
    );
};
