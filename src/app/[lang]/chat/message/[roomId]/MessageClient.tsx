"use client";

import {useEffect} from "react";
import ChatRoomView from "@/modules/chat/components/ChatRoomView";
import {UserService} from "@/services";
import {RoomNotFound} from "@/components/RoomNotFound";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {ChatBridgeProvider} from "@/modules/chat/contexts/ChatBridgeProvider";
import {useUserStore} from "@/store/useUserStore";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
import {RoomView} from "@/modules/chat/types";
import {isFailed} from "@/services/HttpService";
import {useTranslation} from "react-i18next";
import {AlertCircle, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/Button";

export default function MessageClient({roomId: rawRoomId}: { roomId: string }) {
    const {t} = useTranslation();
    const isLoggedIn = UserService.Instance.isLoggedIn;
    const {user} = useUserStore();
    const rooms = useRoomsStore(s => s.rooms);
    const findPartner = useRoomsStore(s => s.findPartner);
    const upsertRoom = useRoomsStore(s => s.upsertRoom);

    // Next.js does not decode dynamic route segments, and room ids contain
    // colons (e.g. "dm:4233:4238"), which the browser percent-encodes on
    // navigation (both a <Link> click and a hard refresh/direct URL). Every
    // room id elsewhere (the rooms store, API responses) is the decoded
    // form, so comparing against the raw param here always failed to match.
    const roomId = decodeURIComponent(rawRoomId);
    const room = rooms.find(r => r.room.id === roomId);

    // Zustand's rooms store resets on hard refresh / direct navigation, so when
    // the room isn't already in the store, fetch it directly instead of
    // assuming it doesn't exist.
    const {data, isLoading, state, execute: refetch} = useHttpGet("getChatRoom", [roomId]);

    useEffect(() => {
        if (data?.room) {
            upsertRoom({...data.room, isActive: false} as RoomView, false);
        }
    }, [data, upsertRoom]);

    if (!room) {
        if (isLoading) {
            return <LoadingBlur text=""/>;
        }
        if (isFailed(state)) {
            return (
                <div className="w-full min-h-screen bg-[#F6F9FE] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-100 shadow-sm text-center">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">
                            {t("error.serverError", "Failed to load chat room")}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {t("error.loadFailed", "An error occurred while connecting to the chat room. Please try again.")}
                        </p>
                        <Button
                            type="button"
                            onClick={() => refetch()}
                            className="inline-flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t("global.buttonRetry", "Retry")}
                        </Button>
                    </div>
                </div>
            );
        }
        return <RoomNotFound/>;
    }

    const partner = findPartner(roomId, user?.id);
    if (!partner) {
        return <RoomNotFound/>;
    }

    return (
        <ChatBridgeProvider isLoggedIn={isLoggedIn} roomId={roomId}>
            <ChatRoomView
                post={room.post}
                partner={partner}
                roomId={roomId}
                localUser={user!}
            />
        </ChatBridgeProvider>
    );
}
