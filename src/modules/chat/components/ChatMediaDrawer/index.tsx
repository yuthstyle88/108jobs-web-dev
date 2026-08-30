"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

import AvatarBadge from "@/components/AvatarBadge";
import ChatMediaPanel from "@/modules/chat/components/ChatMediaPanel";
import {usePeerOnline} from "@/modules/chat/store/presenceStore";
import {useChatPanelStore} from "@/modules/chat/store/chatPanelStore";

type Props = {
    roomId: string;
    partnerName: string;
    partnerAvatar?: string;
    partnerId: number;
};

/**
 * Everything shared in a room, behind the chat header's media button.
 *
 * Mobile-only (`md:hidden`), and deliberately a separate surface from the
 * Chat/Order tabs rather than a third tab beside them: in the app, Media is
 * an app-bar action that slides in over the conversation, not a destination
 * you navigate to and have to navigate back from. Overlaying is the whole
 * point -- whatever pane was showing stays selected underneath, so closing
 * the drawer returns you exactly where you were.
 *
 * Led by who you are talking to, matching the app: a shared-files panel is
 * usually a step towards a person, which is why a messenger puts the contact
 * at the top of its details pane instead of opening straight into a grid.
 *
 * Desktop is untouched by all of this. It keeps Media as a permanent tab
 * beside Orders in `ChatSidebarTabs`, and nothing there opens this drawer.
 */
export const ChatMediaDrawer: React.FC<Props> = ({
    roomId,
    partnerName,
    partnerAvatar,
    partnerId,
}) => {
    const {t} = useTranslation();
    const isMediaOpen = useChatPanelStore((s) => s.isMediaOpen);
    const closeMedia = useChatPanelStore((s) => s.closeMedia);
    // Same presence source the header's avatar reads, so the two agree: the
    // header stays visible behind the scrim, and a green dot in one place
    // with a grey one in the other reads as a bug.
    const online = usePeerOnline(partnerId);

    const closeRef = React.useRef<HTMLButtonElement>(null);
    const panelRef = React.useRef<HTMLDivElement>(null);

    // Escape closes the drawer -- deliberately as a *native* listener on the
    // panel element, not a window listener and not React's `onKeyDown`.
    //
    // ChatMediaPanel's lightbox is a nested dialog with an Escape handler of
    // its own, and it is portalled to <body>. A window listener here would
    // fire alongside it, so one Escape meant for an image would dismiss the
    // whole drawer too. React's `onKeyDown` has the same problem for the
    // opposite reason: synthetic events propagate along the *React* tree, in
    // which the portalled lightbox is still a descendant of this panel.
    // Native bubbling is the only one of the three that stops at <body>,
    // which is exactly the boundary wanted: the lightbox closes alone, and
    // Escape from anywhere genuinely inside the drawer closes the drawer.
    React.useEffect(() => {
        const panel = panelRef.current;
        if (!isMediaOpen || !panel) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeMedia();
        };
        panel.addEventListener("keydown", onKeyDown);
        return () => panel.removeEventListener("keydown", onKeyDown);
    }, [isMediaOpen, closeMedia]);

    // Moves real focus into the drawer on open and hands it back on close.
    // Without this, a keyboard or screen-reader user who opens the drawer is
    // still focused on the header button behind it, and Tab walks the
    // conversation underneath instead of the panel that just appeared.
    React.useEffect(() => {
        if (!isMediaOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => {
            // The trigger can be gone by the time this runs (a room switch
            // unmounts the header). `.focus()` on a detached node is a silent
            // no-op that would strand focus on <body>, so check first.
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, [isMediaOpen]);

    if (!isMediaOpen) return null;

    return (
        <>
            {/* Pointer affordance only, hence `aria-hidden`: the dialog has a
                real Close button and Escape, which is what assistive tech and
                keyboards use. */}
            <div
                aria-hidden="true"
                onClick={closeMedia}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />

            {/* `md:hidden` is display:none, not an unmount -- widening past
                768px while the drawer is open leaves it open but invisible,
                with the desktop sidebar's Media tab available instead. The
                same is true of the panes behind it, and reopening below 768px
                shows it again unchanged. */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("profileChat.media")}
                className="fixed inset-y-0 right-0 z-40 flex w-[86%] max-w-sm flex-col bg-white pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] shadow-xl md:hidden"
            >
                <div className="relative flex flex-shrink-0 flex-col items-center gap-2 border-b border-gray-200 px-4 pb-4 pt-6">
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={closeMedia}
                        aria-label={t("profileChat.closeDrawer")}
                        className="absolute right-2 top-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <AvatarBadge
                        name={partnerName}
                        avatarUrl={partnerAvatar}
                        online={online}
                        isActive
                        size={72}
                    />
                    <span className="max-w-full truncate text-base font-semibold text-text-primary">
                        {partnerName}
                    </span>
                </div>

                {/* ChatMediaPanel brings its own Image & Video / Files tabs;
                    this drawer only supplies the person above them. */}
                <div className="flex min-h-0 flex-1 flex-col">
                    <ChatMediaPanel roomId={roomId} partnerName={partnerName} />
                </div>
            </div>
        </>
    );
};

export default ChatMediaDrawer;
