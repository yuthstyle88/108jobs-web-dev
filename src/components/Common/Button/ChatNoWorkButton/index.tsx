import React from "react";
import {Person, PersonId} from "108jobs-client";
import {useTranslation} from "react-i18next";
import {useRouter} from "next/navigation";
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

            // The server owns the room id. This used to compute an FNV-1a hash
            // of two PersonIds and navigate to it -- a value the server has
            // never minted, so the "fallback" below landed on a room that did
            // not exist. There is no id to fall back TO; without a response
            // there is nowhere correct to go.
            const res = await createChatRoom({partnerPersonId: profile.id});
            if (res.state !== REQUEST_STATE.SUCCESS) return;

            const room = res.data.room as RoomView;
            upsertRoom(room);
            const roomId = room?.room?.id;
            if (!roomId) return;
            // Raw, per `decodeRoomIdParam` (#134): the browser encodes the
            // colons and the reader decodes them exactly once.
            router.push(`/${i18n.language}/chat/message/${roomId}?t=${Date.now()}`);
        } catch {
            // Nothing to navigate to: the id only exists in the response.
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