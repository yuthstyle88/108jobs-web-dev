import {ChatRoomId} from "./ChatRoomId";
import type {PostId} from "./PostId";
import {ProposalId} from "./ProposalId";

export type ChatRoom = {
    id: ChatRoomId;
    roomName: string;
    createdAt: string;
    updatedAt?: string;
    postId?: PostId;
    currentCommentId?: ProposalId
}