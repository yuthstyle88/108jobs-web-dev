import type {ChatRoomId} from "./ChatRoomId";

export interface UnreadSnapshotItem {
  roomId: ChatRoomId;
  unreadCount: number;
  lastMessageId?: string;
  lastMessageAt?: string;
}
