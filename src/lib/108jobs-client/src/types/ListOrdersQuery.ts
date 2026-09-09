import type { ChatRoomId } from "./ChatRoomId";

export type ListOrdersQuery = {
    roomId: ChatRoomId,
    limit?: number,
    offset?: number,
};
