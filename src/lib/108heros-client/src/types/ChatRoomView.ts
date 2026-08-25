import type {ChatRoom} from "./ChatRoom";
import type {PostPreview} from "./PostPreview";
import type {ChatParticipantView} from "./ChatParticipantView";
import {ChatMessage} from "./ChatMessage";
import {Workflow} from "./Workflow";

/**
 * A chat room view, including its participants.
 * Matches backend camelCase fields.
 */
export type ChatRoomView = {
    room: ChatRoom;
    // Not selectable by Diesel; assembled separately via additional query
    participants: ChatParticipantView[];
    post?: PostPreview;
    lastMessage?: ChatMessage;
    workflow?: Workflow;
};
