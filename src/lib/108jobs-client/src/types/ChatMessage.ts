import type {ChatRoomId} from "./ChatRoomId";
import {ChatStatus} from "./ChatStatus";
import {LocalUserId} from "./LocalUserId";

// Basic chat message entity from server
export type ChatMessage = {
  id: string;
  roomId: ChatRoomId;
  senderId: LocalUserId;
  content: string;
  secure: boolean;
  status: ChatStatus;
  createdAt: string;
  // UI-only field to help rendering; not required from server
  isOwner?: boolean;
  /**
   * MAD asset id of an attachment this message carries, sent as a sibling of
   * `content` because `content` may be encrypted. Mirrors `MessageModel`'s
   * `assetId` on the server. Absent on plain messages and on everything sent
   * before this shipped.
   */
  assetId?: string;
};
