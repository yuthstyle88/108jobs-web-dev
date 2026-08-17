import type {PersonId} from "./PersonId";
import type {ChatRoomId} from "./ChatRoomId";
import type {PostId} from "./PostId";
import type {ProposalId} from "./ProposalId";

// Request body for POST /chat/rooms (create_chat_room)
// Uses camelCase field names to match API expectations
export type CreateChatRoomRequest = {
  partnerPersonId: PersonId;
  roomId?: ChatRoomId;
  postId?: PostId;
  // Optional: id of the current comment used to start the chat
  currentCommentId?: ProposalId;
  roomName?: string;
};
