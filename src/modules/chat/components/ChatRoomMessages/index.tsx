"use client";

import type {ChatMessage, LocalUserId} from "108jobs-client";
import ChatMessageItem from "../ChatMessageBubble";
import {StaticImageData} from "next/image";
import {Virtuoso, VirtuosoHandle} from "react-virtuoso";
import React from "react";
import {useParams} from "next/navigation";
import {formatDateToLong} from "@/utils";
import {getLocale} from "@/utils/date";
import {useTranslation} from "react-i18next";
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";

interface ChatRoomMessagesProps {
    messages: ChatMessage[];
    partnerAvatar: StaticImageData | string;
    customScrollParent?: HTMLElement | null;
    onTopReached?: () => void;
    hasMore?: boolean;
    isFetching?: boolean;
    onAtBottomChange?: (isAtBottom: boolean) => void;
    initialLoadDone?: boolean;
    partnerId: LocalUserId;
}

const ChatRoomMessages: React.FC<ChatRoomMessagesProps> = ({
                                                               messages,
                                                               partnerAvatar,
                                                               customScrollParent,
                                                               onTopReached,
                                                               hasMore,
                                                               isFetching,
                                                               onAtBottomChange,
                                                               initialLoadDone = false,
                                                               partnerId
                                                           }) => {
    const {t} = useTranslation();
    const params = useParams();

    const currentLang = (params?.lang as string) || "th";
    const currentLocale = getLocale(currentLang);
    const data = React.useMemo(() => [...messages], [messages]);
    const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
    const [isAtBottom, setIsAtBottom] = React.useState(true);
    const isAtBottomRef = React.useRef(true);

    const pendingJumpMessageId = useChatPanelStore((s) => s.pendingJumpMessageId);
    const jumpToken = useChatPanelStore((s) => s.jumpToken);
    const highlightedMessageId = useChatPanelStore((s) => s.highlightedMessageId);
    const highlightToken = useChatPanelStore((s) => s.highlightToken);

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

    const prevLengthRef = React.useRef(data.length);
    const headIdRef = React.useRef<string | null>(
        data.length ? String((data[0] as any)?.id ?? '') : null
    );
    const tailIdRef = React.useRef<string | null>(
        data.length ? String((data[data.length - 1] as any)?.id ?? '') : null
    );

    const rangeRef = React.useRef({startIndex: 0, endIndex: 0});
    const hasMoreRef = React.useRef(hasMore);
    const isFetchingRef = React.useRef(isFetching);
    const initialLoadDoneRef = React.useRef(initialLoadDone);

    React.useEffect(() => {
        hasMoreRef.current = hasMore;
        isFetchingRef.current = isFetching;
    }, [hasMore, isFetching]);

    React.useEffect(() => {
        initialLoadDoneRef.current = initialLoadDone;
    }, [initialLoadDone]);

    const onTopReachedRef = React.useRef(onTopReached);
    React.useEffect(() => {
        onTopReachedRef.current = onTopReached;
    }, [onTopReached]);

    const handleTopReached = React.useCallback(() => {
        if (!hasMoreRef.current || isFetchingRef.current) return;
        onTopReachedRef.current?.();
    }, []);

    const handleRangeChanged = React.useCallback((range: { startIndex: number; endIndex: number }) => {
        rangeRef.current = range;
        if (!initialLoadDoneRef.current && range.startIndex === 0) {
            return;
        }
        if (range.startIndex <= 2 && hasMoreRef.current && !isFetchingRef.current) {
            handleTopReached();
        }
    }, [handleTopReached]);

    React.useEffect(() => {
        const prevLength = prevLengthRef.current;
        const newLength = data.length;
        const added = newLength - prevLength;

        const prevHeadId = headIdRef.current;
        const newHeadId = newLength ? String((data[0] as any)?.id ?? '') : null;

        const prevTailId = tailIdRef.current;
        const newTailId = newLength ? String((data[newLength - 1] as any)?.id ?? '') : null;

        prevLengthRef.current = newLength;
        headIdRef.current = newHeadId;
        tailIdRef.current = newTailId;

        if (added <= 0) return;

        const isPrepend = prevHeadId !== newHeadId;
        const isAppend = prevTailId !== newTailId;

        // Gated on the user already being at (or near) the top of the loaded
        // window -- i.e. exactly the case this anchor exists for: they
        // scrolled up and asked for more, so snapping back to just past the
        // new page keeps their place. Ungated, this fired on *every* prepend,
        // including the ones the backfill now drives unprompted from the
        // moment Media opens or a query is typed (Finding 1,
        // FINAL-findings.md) -- dragging a user reading further down back up
        // to the head of the loaded window on every single page, and
        // overwriting the jump's smooth `scrollToIndex({align:'center'})`
        // moments after it landed.
        if (isPrepend && rangeRef.current.startIndex <= 2) {
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: added,
                    behavior: 'auto',
                    align: 'start',
                });
            }, 10);
        } else if (isAppend || isAtBottomRef.current) {
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: newLength - 1,
                    behavior: 'auto',
                    align: 'end',
                });
            }, 10);
        }
    }, [data]);

    const handleAtBottomChange = React.useCallback((bottom: boolean) => {
        isAtBottomRef.current = bottom;
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
        const prev = index > 0 ? data[index - 1] : null;
        const prevDate = prev ? formatDateToLong(prev.createdAt, currentLocale) : null;
        const showDate = currentDate !== prevDate;

        return (
            <div className="px-2 sm:px-4 last:mb-0"> {/* Responsive padding */}
                {showDate && (
                    <div className="w-full flex justify-center my-2 sm:my-3">
                        <div
                            className="inline-block px-2 sm:px-3 py-1 min-w-[80px] sm:min-w-[100px] text-gray-600 bg-gray-100 text-xs sm:text-sm font-medium text-center rounded-full"
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
    }, [data, currentLocale, partnerAvatar, partnerId, highlightedMessageId]);

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
                followOutput={true}
                customScrollParent={customScrollParent ?? undefined}
                computeItemKey={computeItemKey}
                alignToBottom
                rangeChanged={handleRangeChanged}
                atTopStateChange={(atTop) => {
                    // Intentionally empty to avoid double fetching
                }}
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