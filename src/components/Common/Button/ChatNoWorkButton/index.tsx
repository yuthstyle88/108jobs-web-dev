import React from "react";
import {Person, PersonId} from "@108-plaza/jh-client";
import {useTranslation} from "react-i18next";
import {useRouter} from "next/navigation";
import {dmRoomId} from "@/utils/helpers";
import {MessageCircle} from "lucide-react";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {REQUEST_STATE} from "@/services/HttpService";
import {RoomView} from "@/modules/chat/types";

interface ChatNoWorkButtonProps {
    profile: Person;
    currentUserId?: PersonId;
}

const ChatNoWorkButton: React.FC<ChatNoWorkButtonProps> = ({profile, currentUserId}) => {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const {upsertRoom} = useRoomsStore();
    const {execute: createChatRoom} = useHttpPost("createChatRoom");
    const handleChatClick = async () => {
        try {
            if (!currentUserId || !profile?.id || currentUserId === profile.id) return;
            const roomId = dmRoomId(currentUserId, profile.id, undefined);
            try {
                const res = await createChatRoom({partnerPersonId: profile.id, roomId});
                if (res.state === REQUEST_STATE.SUCCESS) {
                    upsertRoom(res.data.room as RoomView);
                }
            } catch (e) {
                // If room already exists or API fails, proceed to navigate anyway
            }
            router.push(`/${i18n.language}/chat/message/${roomId}?t=${Date.now()}`);
        } catch (err) {
            try {
                const fallbackId = dmRoomId(currentUserId, profile.id, undefined);
                router.push(`/${i18n.language}/chat/message/${fallbackId}?t=${Date.now()}`);
            } catch {
            }
        }
    };

    return (
        <button
            onClick={handleChatClick}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label={`Start a chat with ${profile?.name}`}
        >
            <MessageCircle className="w-5 h-5"/>
            <span>{t("profile.startChat") || "Start Chat"}</span>
        </button>
    );
};

export default ChatNoWorkButton;