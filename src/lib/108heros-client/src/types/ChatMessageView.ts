import type {ChatMessage} from "./ChatMessage";
import type {LocalUser} from "./LocalUser";
import type {ChatRoom} from "./ChatRoom";

/**
 * A chat message view, including sender and room.
 */
export type ChatMessageView = {
  message: ChatMessage;
  sender: LocalUser;
  room: ChatRoom;
};
