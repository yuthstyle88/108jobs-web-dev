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
import {decodeRoomIdParam} from "@/modules/chat/utils/roomId";
import {hydratableWorkflowStatus} from "@/modules/chat/utils/hydrateWorkflow";
import {useStateMachineStore} from "@/modules/chat/store/stateMachineStore";

export default function MessageClient({roomId: rawRoomId}: { roomId: string }) {
    const isLoggedIn = UserService.Instance.isLoggedIn;
    const {user} = useUserStore();
    const rooms = useRoomsStore(s => s.rooms);
    const findPartner = useRoomsStore(s => s.findPartner);
    const upsertRoom = useRoomsStore(s => s.upsertRoom);

    // Shared with the chat layout, which uses the same value to open the
    // socket -- see decodeRoomIdParam for why the raw param cannot be used.
    const roomId = decodeRoomIdParam(rawRoomId);
    const room = rooms.find(r => r.room.id === roomId);

    // Zustand's rooms store resets on hard refresh / direct navigation, so when
    // the room isn't already in the store, fetch it directly instead of
    // assuming it doesn't exist.
    const {data, isLoading} = useHttpGet("getChatRoom", [roomId]);

    useEffect(() => {
        if (data?.room) {
            upsertRoom({...data.room, isActive: false} as RoomView, false);
        }
    }, [data, upsertRoom]);

    // Adopt the server's workflow stage.
    //
    // The stepper's store is client-only: it starts at
    // WaitForFreelancerQuotation and is advanced by local clicks, so a
    // reopened room showed a finished job as not started and the Orders tab
    // rendered no stage at all. The room payload has always carried the
    // answer -- `workflow` comes straight from the server -- it was simply
    // never read. See hydratableWorkflowStatus for when adopting is refused.
    const setWorkflowState = useStateMachineStore(s => s.set);
    const serverStatus = hydratableWorkflowStatus(data?.room);
    useEffect(() => {
        if (serverStatus) setWorkflowState(serverStatus);
    }, [serverStatus, setWorkflowState]);

    if (!room) {
        if (isLoading) {
            return <LoadingBlur text=""/>;
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
