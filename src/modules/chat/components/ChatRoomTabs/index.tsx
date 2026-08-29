"use client";

import React from "react";
import {useTranslation} from "react-i18next";

export type ChatRoomTab = "chat" | "order";

const TABS: Array<{id: ChatRoomTab; labelKey: string}> = [
    {id: "chat", labelKey: "profileChat.tabChat"},
    {id: "order", labelKey: "profileChat.tabOrder"},
];

interface ChatRoomTabsProps {
    activeTab: ChatRoomTab;
    onSelect: (tab: ChatRoomTab) => void;
}

/**
 * Chat and Order as peers, directly under the room header, on mobile only.
 *
 * The order half of this screen used to sit behind a "Show Flow" button that
 * opened a slide-over -- which made the commercial half of the conversation
 * something you had to know to look for, and named it after the code's own
 * word for it. The mobile app replaced that with these two tabs for exactly
 * that reason; this is the web following it.
 *
 * Stateless by design: the selected tab *is* `JobFlowSidebarContext`'s
 * `isOpen`, which already meant "is the mobile flow panel showing". Holding a
 * second copy here would be two sources of truth for one boolean.
 */
const ChatRoomTabs: React.FC<ChatRoomTabsProps> = ({activeTab, onSelect}) => {
    const {t} = useTranslation();

    // Roving-tabindex focus targets. Both buttons are always mounted (only
    // their tabIndex/aria-selected differ), so the ref for the tab an arrow
    // key is about to select already exists when the handler runs.
    const tabRefs = React.useRef<Map<ChatRoomTab, HTMLButtonElement>>(new Map());

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === activeTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        const nextId = TABS[(next + TABS.length) % TABS.length].id;
        onSelect(nextId);
        // Moves the actual focus ring, not just aria-selected/tabIndex --
        // without this the ring stays stranded on the old (now tabIndex=-1)
        // button, which a keyboard user can no longer Tab back to.
        tabRefs.current.get(nextId)?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={t("profileChat.jobFlow")}
            onKeyDown={onKeyDown}
            className="flex flex-shrink-0 border-b border-gray-200 bg-white md:hidden"
        >
            {TABS.map((tab) => {
                const selected = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        ref={(el) => {
                            if (el) tabRefs.current.set(tab.id, el);
                            else tabRefs.current.delete(tab.id);
                        }}
                        id={`chat-room-tab-${tab.id}`}
                        role="tab"
                        type="button"
                        aria-selected={selected}
                        aria-controls={`chat-room-panel-${tab.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onSelect(tab.id)}
                        className={`flex-1 -mb-px border-b-2 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selected
                                ? "border-primary font-semibold text-primary"
                                : "border-transparent font-medium text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {t(tab.labelKey)}
                    </button>
                );
            })}
        </div>
    );
};

export default ChatRoomTabs;
