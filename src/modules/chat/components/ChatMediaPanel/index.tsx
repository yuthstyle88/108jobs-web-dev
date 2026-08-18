"use client";

import type {ChatMessage} from "108jobs-client";
import React from "react";
import {useTranslation} from "react-i18next";

import {collectAttachments, type AttachmentItem} from "@/modules/chat/attachments";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";
import {useChatStore} from "@/modules/chat/store/chatStore";
import {
    cancelBackfill,
    selectBackfill,
    startBackfill,
    useChatPanelStore,
    type MediaTab,
} from "@/modules/chat/store/chatPanelStore";

import {MediaFileList} from "./MediaFileList";
import {MediaGrid} from "./MediaGrid";
import {MediaLightbox} from "./MediaLightbox";
import {MediaBackfillBanner, MediaError, MediaNotice} from "./MediaStates";

/** Stable empty array — returning a fresh `[]` from the selector on every read
 *  would make zustand see a new value each render and loop. */
const NO_MESSAGES: ChatMessage[] = [];

const TABS: Array<{id: MediaTab; labelKey: string}> = [
    {id: "imageVideo", labelKey: "profileChat.mediaPanel.imageVideo"},
    {id: "files", labelKey: "profileChat.mediaPanel.files"},
];

type Props = {roomId: string; partnerName: string};

export const ChatMediaPanel: React.FC<Props> = ({roomId, partnerName}) => {
    const {t} = useTranslation();
    const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? NO_MESSAGES);
    const mediaTab = useChatPanelStore((s) => s.mediaTab);
    const setMediaTab = useChatPanelStore((s) => s.setMediaTab);
    const requestJump = useChatPanelStore((s) => s.requestJump);
    const backfill = useChatPanelStore(selectBackfill(roomId));
    const {setOpen} = useJobFlowSidebar();

    const [viewing, setViewing] = React.useState<AttachmentItem | null>(null);

    // Suffixes every id this panel renders. JobFlowSidebar mounts both a
    // desktop `<aside>` (`hidden md:flex`, so still present in the DOM) and,
    // while open, a mobile one -- each carrying its own copy of `content`, so
    // without a per-instance suffix the two ChatMediaPanel instances would
    // render identical `media-tab-*`/`media-panel-*` ids, and id-based
    // resolution (`aria-controls`/`aria-labelledby`) would always pick the
    // first (hidden) one (Finding 4, FINAL-findings.md).
    const uid = React.useId();

    // Roving-tabindex focus targets -- see ChatSidebarTabs for why a ref map
    // keyed by tab id is what lets the arrow-key handler move real DOM focus
    // synchronously, instead of merely flipping which button is selected.
    const tabRefs = React.useRef<Map<MediaTab, HTMLButtonElement>>(new Map());

    // Where the lightbox restores focus to if the tile that opened it is gone
    // by the time it closes (e.g. the user switched imageVideo/files while it
    // was open, which unmounts MediaGrid/MediaFileList underneath it). This
    // div survives that swap -- only its children change -- so it's always a
    // valid landing spot.
    const tabpanelRef = React.useRef<HTMLDivElement>(null);

    // Opening Media pulls the rest of the room's history, so the panel shows
    // everything rather than only what the user happened to scroll past.
    // Search shares this runner, so if it already ran this is instant.
    //
    // Gated on "not running and not complete", not "idle" -- see the matching
    // comment in ChatSearchPanel. `cancelled`/`capped`/`error` all mean there
    // may be more history than what's loaded, and nothing ever moves the
    // phase back to `idle`; gating on `idle` alone means cancelling once and
    // reopening Media later in the same room would never retry, permanently
    // stuck showing only what had loaded at the moment of cancellation.
    React.useEffect(() => {
        if (backfill.phase !== "running" && backfill.phase !== "complete") startBackfill(roomId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const items = React.useMemo(() => collectAttachments(messages), [messages]);
    const gridItems = React.useMemo(
        () => items.filter((i) => i.attachment.kind !== "file"),
        [items],
    );
    const fileItems = React.useMemo(
        () => items.filter((i) => i.attachment.kind === "file"),
        [items],
    );

    const onJump = React.useCallback(
        (messageId: string) => {
            setViewing(null);
            requestJump(messageId);
            // Spec: "On mobile, jumping closes the drawer or search overlay."
            // Media lives inside JobFlowSidebar's slide-over, so without this
            // the drawer stayed open over the conversation and tapping
            // "Go to message" looked like it had done nothing (Finding 3,
            // FINAL-findings.md). Same breakpoint check ChatSearchPanel
            // already uses, so the two behave identically.
            if (typeof window !== "undefined" && window.innerWidth < 640) setOpen(false);
        },
        [requestJump, setOpen],
    );

    const onTabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === mediaTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        const nextId = TABS[(next + TABS.length) % TABS.length].id;
        setMediaTab(nextId);
        tabRefs.current.get(nextId)?.focus();
    };

    const isFirstLoad = backfill.phase === "running" && items.length === 0;

    return (
        <div className="flex h-full flex-col">
            <div
                role="tablist"
                aria-label={t("profileChat.media")}
                onKeyDown={onTabKeyDown}
                className="flex border-b border-gray-200 px-2"
            >
                {TABS.map((tab) => {
                    const selected = tab.id === mediaTab;
                    return (
                        <button
                            key={tab.id}
                            ref={(el) => {
                                if (el) tabRefs.current.set(tab.id, el);
                                else tabRefs.current.delete(tab.id);
                            }}
                            id={`media-tab-${tab.id}-${uid}`}
                            role="tab"
                            type="button"
                            aria-selected={selected}
                            aria-controls={`media-panel-${tab.id}-${uid}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setMediaTab(tab.id)}
                            className={`mr-4 border-b-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                selected
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            {(backfill.phase === "running" ||
                backfill.phase === "capped" ||
                backfill.phase === "cancelled") && (
                <MediaBackfillBanner
                    phase={backfill.phase}
                    onCancel={() => cancelBackfill(roomId)}
                />
            )}

            <div
                ref={tabpanelRef}
                id={`media-panel-${mediaTab}-${uid}`}
                role="tabpanel"
                aria-labelledby={`media-tab-${mediaTab}-${uid}`}
                tabIndex={0}
                className="flex-1 overflow-y-auto focus:outline-none"
            >
                {backfill.phase === "error" && items.length === 0 ? (
                    <MediaError onRetry={() => startBackfill(roomId)} />
                ) : isFirstLoad ? (
                    <MediaNotice>{t("profileChat.mediaPanel.loading")}</MediaNotice>
                ) : mediaTab === "imageVideo" ? (
                    <MediaGrid items={gridItems} onOpen={setViewing} onJump={onJump} />
                ) : (
                    <MediaFileList items={fileItems} partnerName={partnerName} onJump={onJump} />
                )}
            </div>

            {viewing && (
                <MediaLightbox
                    item={viewing}
                    onClose={() => setViewing(null)}
                    onJump={onJump}
                    fallbackFocusRef={tabpanelRef}
                />
            )}
        </div>
    );
};

export default ChatMediaPanel;
