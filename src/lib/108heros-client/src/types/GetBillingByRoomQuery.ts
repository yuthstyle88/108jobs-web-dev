import {ChatRoomId} from "./ChatRoomId";

// Matches backend query with serde(rename_all = "camelCase")
export type GetBillingByRoomQuery = {
  roomId: ChatRoomId;
};
