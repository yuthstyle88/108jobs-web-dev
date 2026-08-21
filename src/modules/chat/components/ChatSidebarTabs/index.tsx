"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

import ChatMediaPanel from "@/modules/chat/components/ChatMediaPanel";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";
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
    // The mobile drawer's only dismiss control used to live inside
    // JobFlowContent's own header, so it only existed while Orders was the
    // selected tab -- switching to Media left the slide-over with no visible,
    // keyboard-reachable way to close it (the backdrop tap in JobFlowSidebar
    // is pointer-only). Hoisting it here, next to the tabs both levels share,
    // keeps it available regardless of which tab is active.
    const {setOpen} = useJobFlowSidebar();

    // Roving-tabindex focus targets: both tab buttons are always mounted (only
    // their tabIndex/aria-selected differ), so the ref for the tab an arrow
    // key is about to select already exists by the time the handler runs.
    const tabRefs = React.useRef<Map<SidebarTab, HTMLButtonElement>>(new Map());

    // JobFlowSidebar mounts a desktop `<aside>` (`hidden md:flex`, so still
    // present in the DOM even when only the mobile one is visible) and,
    // while open, a mobile `<aside>` too -- both rendering the same `content`,
    // so both mount a copy of this component at once. Without a per-instance
    // suffix, `sidebar-tab-*`/`sidebar-panel-*` collide between the two, and
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

                {/* Mobile-only: the slide-over's one dismiss control (besides
                    tapping the backdrop, which a keyboard/screen-reader user
                    cannot reach). Not part of the tablist above -- it isn't a
                    tab, and a stray non-tab child would confuse the tablist's
                    own roving-tabindex/arrow-key semantics for assistive
                    tech. Same label the old JobFlowContent header button
                    used; left untranslated exactly as it was there, since
                    fixing that is a separate, pre-existing issue. */}
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("profileChat.closeDrawer")}
                    className="ml-2 flex-shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
                >
                    <X className="h-4 w-4" />
                </button>
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
