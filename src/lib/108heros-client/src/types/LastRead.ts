import {LocalUserId} from "./LocalUserId";
import {ChatRoomId} from "./ChatRoomId";

export type LastRead = {
    localUserId: LocalUserId;
    roomId: ChatRoomId;
    lastReadMsgId: number;
    updatedAt?: string | null;
}