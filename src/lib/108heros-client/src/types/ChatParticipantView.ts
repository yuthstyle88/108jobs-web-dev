import {LocalUserId} from "./LocalUserId";
import {PersonId} from "./PersonId";
import {ChatRoomId} from "./ChatRoomId";

export type ChatParticipantView = {
    id: LocalUserId;
    personId: PersonId;
    name: string;
    displayName?: string;
    avatar?: string;
    available: boolean;
    roomId: ChatRoomId;
    joinedAt: string;
};
