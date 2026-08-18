"use client";

import type {ChatMessage} from "108jobs-client";
import React from "react";
import {useTranslation} from "react-i18next";

import {collectAttachments, type AttachmentItem} from "@/modules/chat/attachments";
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

    const [viewing, setViewing] = React.useState<AttachmentItem | null>(null);

    // Opening Media pulls the rest of the room's history, so the panel shows
    // everything rather than only what the user happened to scroll past.
    // Search shares this runner, so if it already ran this is instant.
    React.useEffect(() => {
        if (backfill.phase === "idle") startBackfill(roomId);
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
        },
        [requestJump],
    );

    const onTabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === mediaTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        setMediaTab(TABS[(next + TABS.length) % TABS.length].id);
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
                            id={`media-tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={selected}
                            aria-controls={`media-panel-${tab.id}`}
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

            {(backfill.phase === "running" || backfill.phase === "capped") && (
                <MediaBackfillBanner
                    phase={backfill.phase}
                    onCancel={() => cancelBackfill(roomId)}
                />
            )}

            <div
                id={`media-panel-${mediaTab}`}
                role="tabpanel"
                aria-labelledby={`media-tab-${mediaTab}`}
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
                <MediaLightbox item={viewing} onClose={() => setViewing(null)} onJump={onJump} />
            )}
        </div>
    );
};

export default ChatMediaPanel;
