"use client";

import type {ChatMessage} from "108jobs-client";
import React from "react";
import {useTranslation} from "react-i18next";
import {Search, X} from "lucide-react";

import {searchMessages} from "@/modules/chat/search/searchMessages";
import {useChatStore} from "@/modules/chat/store/chatStore";
import {
    cancelBackfill,
    selectBackfill,
    startBackfill,
    useChatPanelStore,
} from "@/modules/chat/store/chatPanelStore";

import {SearchResultItem} from "./SearchResultItem";

/** Stable empty array; see the note in ChatMediaPanel. */
const NO_MESSAGES: ChatMessage[] = [];
const DEBOUNCE_MS = 250;

type Props = {roomId: string; partnerName: string};

/**
 * Search within the open room.
 *
 * There is no server-side search and cannot be one: message content reaches
 * the server encrypted. So this runs over what `chatStore` holds — and starts
 * pulling the rest of the room's history the moment there is a query, because
 * otherwise "no results" would only ever mean "not in the pages you scrolled".
 */
export const ChatSearchPanel: React.FC<Props> = ({roomId, partnerName}) => {
    const {t} = useTranslation();
    const [rawQuery, setRawQuery] = React.useState("");
    const [query, setQuery] = React.useState("");

    const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? NO_MESSAGES);
    const closeSearch = useChatPanelStore((s) => s.closeSearch);
    const requestJump = useChatPanelStore((s) => s.requestJump);
    const backfill = useChatPanelStore(selectBackfill(roomId));

    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => inputRef.current?.focus(), []);

    React.useEffect(() => {
        const timer = setTimeout(() => setQuery(rawQuery), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [rawQuery]);

    // Only once there is something to search for -- opening the box should not
    // pull a year of history on its own.
    React.useEffect(() => {
        if (query.trim() && backfill.phase === "idle") startBackfill(roomId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, roomId]);

    const hits = React.useMemo(() => searchMessages(messages, query), [messages, query]);

    const onSelect = React.useCallback(
        (messageId: string) => {
            requestJump(messageId);
            if (typeof window !== "undefined" && window.innerWidth < 640) closeSearch();
        },
        [requestJump, closeSearch],
    );

    const trimmed = query.trim();
    const isSearchingOlder = Boolean(trimmed) && backfill.phase === "running";

    return (
        <div className="absolute inset-x-0 top-0 z-30 flex max-h-[70%] flex-col border-b bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <input
                    ref={inputRef}
                    type="search"
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                    placeholder={t("profileChat.roomSearch.placeholder")}
                    aria-label={t("profileChat.roomSearch.placeholder")}
                    className="min-w-0 flex-1 rounded bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={closeSearch}
                    aria-label={t("profileChat.roomSearch.close")}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {isSearchingOlder && (
                <div
                    className="flex items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs text-gray-600"
                    role="status"
                    aria-live="polite"
                >
                    <span>{t("profileChat.roomSearch.searchingOlder")}</span>
                    <button
                        type="button"
                        onClick={() => cancelBackfill(roomId)}
                        className="rounded px-2 py-1 font-medium text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {t("profileChat.roomSearch.stopSearching")}
                    </button>
                </div>
            )}

            {trimmed && backfill.phase === "capped" && (
                <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-gray-600">
                    {t("profileChat.roomSearch.partial")}
                </p>
            )}

            {trimmed && backfill.phase === "error" && (
                <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                    {t("profileChat.roomSearch.error")}
                </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
                {!trimmed ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                        {t("profileChat.roomSearch.hint")}
                    </p>
                ) : hits.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                        {isSearchingOlder
                            ? t("profileChat.roomSearch.searching")
                            : t("profileChat.roomSearch.noResults", {query: trimmed})}
                    </p>
                ) : (
                    <>
                        <p className="px-3 pt-2 text-xs text-gray-500" role="status" aria-live="polite">
                            {t("profileChat.roomSearch.resultCount", {count: hits.length})}
                        </p>
                        <ul aria-label={t("profileChat.roomSearch.results")}>
                            {hits.map((hit) => (
                                <SearchResultItem
                                    key={hit.messageId}
                                    hit={hit}
                                    partnerName={partnerName}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatSearchPanel;
