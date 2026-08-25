// ฟังก์ชันย่อย สำหรับสร้าง chat:message event โดยเฉพาะ
import type {ChatMessage, ChatRoomId, ChatStatus, LocalUserId} from "108heros-client";

export function createMessage(
  content: string,
  roomId: ChatRoomId,
  senderId: LocalUserId,
  secure?: boolean,
  id?: string,
): ChatMessage {
    if (!content || content.trim().length === 0) {
        throw new Error("Message content is required");
    }
    const isSecure = secure ?? false;
    return {
        secure: isSecure,
        id: id ?? crypto.randomUUID(),
        roomId,
        senderId,
        content,
        status: "pending" as ChatStatus,
        createdAt: new Date().toISOString()
    };
}