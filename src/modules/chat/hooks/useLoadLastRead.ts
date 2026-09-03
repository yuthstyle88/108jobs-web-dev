import {useEffect} from "react";
import {isSuccess} from "@/services/HttpService";
import {ChatRoomId, LocalUserId} from "@108-plaza/jh-client";
import {useReadLastIdStore} from "@/modules/chat/store/readStore";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";

export function useLoadLastRead(roomId: ChatRoomId, peerId: LocalUserId) {
    // Only call the API when both IDs are valid
    const {state: lastReadState} = useHttpGet(
        "getLastRead",
        {roomId: roomId, peerId: peerId}
    );

    useEffect(() => {
        if (!roomId || !peerId) return;

        if (isSuccess(lastReadState) && lastReadState.data?.lastRead) {
            const lastRead = lastReadState.data.lastRead;
            const {setPeerLastReadAt} = useReadLastIdStore.getState();
            setPeerLastReadAt(roomId, lastRead.localUserId, lastRead.updatedAt);
        }
    }, [roomId, peerId, lastReadState]);
}
