"use client";

import React from "react";
import {useTranslation} from "react-i18next";

import ChatMediaPanel from "@/modules/chat/components/ChatMediaPanel";
import {useChatPanelStore, type SidebarTab} from "@/modules/chat/store/chatPanelStore";

const TABS: Array<{id: SidebarTab; labelKey: string}> = [
    {id: "orders", labelKey: "profileChat.orders"},
    {id: "media", labelKey: "profileChat.media"},
];

type Props = {
    roomId: string;
    partnerName: string;
    /** The existing job-flow panel, rendered verbatim under Orders. */
    orders: React.ReactNode;
};

/**
 * Orders and Media as siblings inside the sidebar container that already
 * exists. Orders is the panel that was always here; nothing about it changes.
 */
export const ChatSidebarTabs: React.FC<Props> = ({roomId, partnerName, orders}) => {
    const {t} = useTranslation();
    const sidebarTab = useChatPanelStore((s) => s.sidebarTab);
    const setSidebarTab = useChatPanelStore((s) => s.setSidebarTab);

    // Roving-tabindex focus targets: both tab buttons are always mounted (only
    // their tabIndex/aria-selected differ), so the ref for the tab an arrow
    // key is about to select already exists by the time the handler runs.
    const tabRefs = React.useRef<Map<SidebarTab, HTMLButtonElement>>(new Map());

    // This component is mounted twice at once: once inside JobFlowSidebar's
    // permanent desktop `<aside>` (`hidden md:flex`, so still present in the
    // DOM below `md`), and again inside ChatRoomView's inline `md:hidden`
    // Order pane -- both rendering the same `sidebarContent`, so both mount a
    // copy of this component. Without a per-instance suffix,
    // `sidebar-tab-*`/`sidebar-panel-*` collide between the two, and
    // id-based resolution (`aria-controls`/`aria-labelledby`) always picks
    // the first (hidden) one (Finding 4, FINAL-findings.md).
    const uid = React.useId();

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === sidebarTab);
        const next = e.key === "ArrowRight" ? index + 1 : index - 1;
        const nextId = TABS[(next + TABS.length) % TABS.length].id;
        setSidebarTab(nextId);
        // Moves the actual focus ring, not just aria-selected/tabIndex --
        // without this the ring stays stranded on the old (now tabIndex=-1)
        // button, which a keyboard user can no longer Tab back to.
        tabRefs.current.get(nextId)?.focus();
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200">
                <div
                    role="tablist"
                    aria-label={t("profileChat.jobFlow")}
                    onKeyDown={onKeyDown}
                    className="flex flex-1"
                >
                    {TABS.map((tab) => {
                        const selected = tab.id === sidebarTab;
                        return (
                            <button
                                key={tab.id}
                                ref={(el) => {
                                    if (el) tabRefs.current.set(tab.id, el);
                                    else tabRefs.current.delete(tab.id);
                                }}
                                id={`sidebar-tab-${tab.id}-${uid}`}
                                role="tab"
                                type="button"
                                aria-selected={selected}
                                aria-controls={`sidebar-panel-${tab.id}-${uid}`}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => setSidebarTab(tab.id)}
                                className={`flex-1 -mb-px border-b-2 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    selected
                                        ? "border-gray-900 font-medium text-gray-900"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {t(tab.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div
                id={`sidebar-panel-${sidebarTab}-${uid}`}
                role="tabpanel"
                aria-labelledby={`sidebar-tab-${sidebarTab}-${uid}`}
                tabIndex={0}
                className="flex min-h-0 flex-1 flex-col"
            >
                {sidebarTab === "orders" ? (
                    orders
                ) : (
                    <ChatMediaPanel roomId={roomId} partnerName={partnerName} />
                )}
            </div>
        </div>
    );
};

export default ChatSidebarTabs;
