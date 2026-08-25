import type {ChatRoomView} from "./ChatRoomView";
import type {LastMessage} from "./LastMessage";
import type {Workflow} from "./Workflow";

// Matches backend ChatRoomResponse with camelCase fields
export type ChatRoomResponse = {
    room: ChatRoomView;
};

export type ChatRoomData = ChatRoomResponse;