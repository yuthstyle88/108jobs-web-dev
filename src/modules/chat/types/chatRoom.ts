import {ChatRoomView} from "108jobs-client";

// Each Room represents a 1-to-1 conversation, so it has exactly one participant besides the current user.
export type RoomView = ChatRoomView & {
    isActive: boolean;
    /** Latest activity timestamp received from the per-user chat signal. */
    lastMessageAt?: string;
};
