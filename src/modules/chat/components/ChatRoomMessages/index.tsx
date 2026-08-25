"use client";

import type {ChatMessage, LocalUserId} from "108heros-client";
import ChatMessageItem from "../ChatMessageBubble";
import {StaticImageData} from "next/image";
import {Virtuoso, VirtuosoHandle} from "react-virtuoso";
import React from "react";
import {useParams} from "next/navigation";
import {formatDateToLong} from "@/utils";
import {getLocale} from "@/utils/date";
import {useTranslation} from "react-i18next";
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";
import {
    CHAT_TIMELINE_START_INDEX,
    getTimelineArrayIndex,
    syncChatTimeline,
} from "@/modules/chat/components/ChatRoomMessages/timeline";

interface ChatRoomMessagesProps {
    messages: ChatMessage[];
    partnerAvatar: StaticImageData | string;
    onTopReached?: () => void;
    hasMore?: boolean;
    isFetching?: boolean;
    onAtBottomChange?: (isAtBottom: boolean) => void;
    partnerId: LocalUserId;
}

const ChatRoomMessages: React.FC<ChatRoomMessagesProps> = ({
                                                               messages,
                                                               partnerAvatar,
                                                               onTopReached,
                                                               hasMore,
                                                               isFetching,
                                                               onAtBottomChange,
                                                               partnerId
                                                           }) => {
    const {t} = useTranslation();
    const params = useParams();

    const currentLang = (params?.lang as string) || "th";
    const currentLocale = getLocale(currentLang);
    const [timeline, setTimeline] = React.useState(() => ({
        items: messages,
        firstItemIndex: CHAT_TIMELINE_START_INDEX,
    }));
    const data = timeline.items;
    const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
    const hasPositionedInitialMessagesRef = React.useRef(false);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const pendingJumpMessageId = useChatPanelStore((s) => s.pendingJumpMessageId);
    const jumpToken = useChatPanelStore((s) => s.jumpToken);
    const highlightedMessageId = useChatPanelStore((s) => s.highlightedMessageId);
    const highlightToken = useChatPanelStore((s) => s.highlightToken);

    // Keep the prop-driven message store and Virtuoso's inverse-scroll index
    // in one layout update. Older history becomes a real prepend, not a
    // delayed correction against an unrelated DOM scroll container.
    React.useLayoutEffect(() => {
        setTimeline((current) => syncChatTimeline(current, messages));
    }, [messages]);

    // A room can mount with cached messages already present or receive its
    // first page just after mount. In both cases, start at the newest message
    // exactly once. Later prepends keep their viewport through firstItemIndex,
    // so they must never trigger another jump to the tail.
    React.useLayoutEffect(() => {
        if (hasPositionedInitialMessagesRef.current || data.length === 0) return;

        hasPositionedInitialMessagesRef.current = true;
        virtuosoRef.current?.scrollToIndex({index: "LAST", behavior: "auto", align: "end"});
    }, [data.length]);

    // A jump can arrive before the message it names is in `data` -- the panel
    // that asked may still be backfilling the page it lives on. Leaving the
    // request pending and re-running on `data` is what makes it land once the
    // page arrives, instead of silently doing nothing.
    //
    // `jumpToken` is in the deps alongside `pendingJumpMessageId` on purpose:
    // a repeat click on the same search result calls `requestJump` with the
    // id already sitting in `pendingJumpMessageId` (e.g. the first click's
    // target hadn't arrived yet, so this effect returned early without
    // consuming it) -- setting a field to the value it already holds is not
    // a change that field alone can carry, but the bumped token is.
    //
    // No highlight timer in this effect: it depends on `pendingJumpMessageId`,
    // and `consumeJump()` below resets that very field, which looks like a
    // dep change on the next render and would tear a timer down long before
    // it was meant to fire. The timer lives in its own effect below, keyed
    // only on `highlightedMessageId`, so consuming the jump can't disturb it.
    React.useEffect(() => {
        if (!pendingJumpMessageId) return;

        const index = data.findIndex((m) => String((m as any)?.id) === pendingJumpMessageId);
        if (index < 0) return;

        const {consumeJump, setHighlight} = useChatPanelStore.getState();
        consumeJump();

        virtuosoRef.current?.scrollToIndex({index, behavior: 'smooth', align: 'center'});
        setHighlight(pendingJumpMessageId);
    }, [pendingJumpMessageId, jumpToken, data]);

    // Owns the "ring for 2 seconds" timer exclusively. Kept separate from the
    // effect above so that consuming the jump (which changes that effect's
    // own deps) can't cut this timer short -- this one only re-runs when the
    // highlighted message itself changes.
    //
    // `highlightToken` is in the deps alongside `highlightedMessageId` for
    // the same reason `jumpToken` sits beside `pendingJumpMessageId` above:
    // a repeat click on the search result that is *already* highlighted
    // calls `setHighlight` with the id it already holds, which
    // `highlightedMessageId` alone can't carry as a change -- so without the
    // token this effect would not re-run, and the ring would expire on the
    // first click's schedule instead of getting a fresh 2s.
    React.useEffect(() => {
        if (!highlightedMessageId) return;

        const timer = setTimeout(() => useChatPanelStore.getState().clearHighlight(), 2000);
        return () => clearTimeout(timer);
    }, [highlightedMessageId, highlightToken]);

    const hasMoreRef = React.useRef(hasMore);
    const isFetchingRef = React.useRef(isFetching);

    React.useEffect(() => {
        hasMoreRef.current = hasMore;
        isFetchingRef.current = isFetching;
    }, [hasMore, isFetching]);

    const onTopReachedRef = React.useRef(onTopReached);
    React.useEffect(() => {
        onTopReachedRef.current = onTopReached;
    }, [onTopReached]);

    const handleTopReached = React.useCallback(() => {
        if (!hasMoreRef.current || isFetchingRef.current) return;
        onTopReachedRef.current?.();
    }, []);

    const handleAtBottomChange = React.useCallback((bottom: boolean) => {
        setIsAtBottom((prev) => {
            if (prev === bottom) return prev;
            return bottom;
        });
    }, []);

    const onAtBottomChangeRef = React.useRef(onAtBottomChange);
    React.useEffect(() => {
        onAtBottomChangeRef.current = onAtBottomChange;
    }, [onAtBottomChange]);

    React.useEffect(() => {
        onAtBottomChangeRef.current?.(isAtBottom);
    }, [isAtBottom]);

    const FooterComponent = React.useMemo(() => {
        function Footer() {
            return <div className="h-4 sm:h-6"/>;
        }

        return Footer;
    }, []);
    const HeaderComponent = React.useMemo(() => {
        if (!hasMore) return undefined;

        function Header() {
            return (
                <div className="w-full flex justify-center my-2 sm:my-3">
                    <div
                        className={`inline-block px-4 sm:px-5 py-2 text-gray-800 bg-gradient-to-r from-gray-100 to-gray-200 text-xs sm:text-sm font-medium text-center rounded-full min-w-[100px] sm:min-w-[120px] shadow-sm hover:shadow-lg transition-all duration-300 border border-transparent ${isFetching ? 'border-blue-300' : ''}`}>
                        {isFetching ? (
                            <div className="flex space-x-1.5 justify-center items-center">
                                <span className="dot-flashing w-2.5 h-2.5 rounded-full"></span>
                                <span className="dot-flashing w-2.5 h-2.5 rounded-full"></span>
                                <span className="dot-flashing w-2.5 h-2.5 rounded-full"></span>
                            </div>
                        ) : (
                            t("profileChat.previousMessages")
                        )}
                    </div>
                </div>
            );
        }

        return Header;
    }, [hasMore, isFetching, t]);

    const itemContent = React.useCallback((index: number, msg: ChatMessage) => {
        const currentDate = formatDateToLong(msg.createdAt, currentLocale);
        const arrayIndex = getTimelineArrayIndex(index, timeline.firstItemIndex);
        const prev = arrayIndex > 0 ? data[arrayIndex - 1] : null;
        const prevDate = prev ? formatDateToLong(prev.createdAt, currentLocale) : null;
        const showDate = currentDate !== prevDate;

        return (
            <div className="px-3 py-1 sm:px-6 sm:py-1.5">
                {showDate && (
                    <div className="my-3 flex w-full justify-center sm:my-4">
                        <div
                            className="inline-block rounded-full bg-slate-200/80 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                            {currentDate}
                        </div>
                    </div>
                )}
                <ChatMessageItem
                    message={msg}
                    partnerAvatar={partnerAvatar}
                    partnerId={partnerId}
                    isHighlighted={highlightedMessageId === String((msg as any)?.id)}
                />
            </div>
        );
    }, [data, timeline.firstItemIndex, currentLocale, partnerAvatar, partnerId, highlightedMessageId]);

    const computeItemKey = React.useCallback((_index: number, msg: ChatMessage) => {
        const m: any = msg as any;
        const id = m?.id ?? m?.clientId;
        if (id != null) return String(id);
        const created = m?.createdAt ?? '';
        const sender = m?.senderId ?? '';
        return `${created}|${sender}`;
    }, []);

    return (
        <>
            <style jsx global>{`
                @keyframes dot-flashing {
                    0% {
                        opacity: 0.2;
                        transform: scale(0.8);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.2);
                    }
                    100% {
                        opacity: 0.2;
                        transform: scale(0.8);
                    }
                }

                .dot-flashing {
                    animation: dot-flashing 1.2s infinite ease-in-out;
                    background: #042b4a;
                }

                .dot-flashing:nth-child(2) {
                    animation-delay: 0.4s;
                }

                .dot-flashing:nth-child(3) {
                    animation-delay: 0.8s;
                }
            `}</style>
            <Virtuoso
                ref={virtuosoRef}
                data={data}
                firstItemIndex={timeline.firstItemIndex}
                followOutput={(isAtBottom) => isAtBottom ? "auto" : false}
                computeItemKey={computeItemKey}
                alignToBottom
                startReached={handleTopReached}
                atBottomStateChange={handleAtBottomChange}
                components={{
                    Footer: FooterComponent,
                    Header: HeaderComponent,
                }}
                itemContent={itemContent}
                className="w-full h-full overflow-x-hidden" // Replaced inline style with className
            />
        </>
    );
};


export default ChatRoomMessages;
