import {ChatMessage, LocalUserId} from "108heros-client";
import { WS_EVENT, type WsEventValue } from "@/modules/chat/protocol/wireEvents";

export type WsMessageSender = (data: MessagePayload) => void | Promise<void>;

export interface MessagePayload {
    message: string;
    senderId: LocalUserId;
    secure: boolean,
    id?: string;
    /** See `ChatMessage.assetId`. Set only for attachment messages. */
    assetId?: string;
}
/**
 * Canonical typing detail for `typing` events.
 * - roomId: room identifier (the bare id the wire's `room` field carries)
 * - senderId: local user id of the typist
 * - typing: true when typing starts, false when stops
 * - createdAt: optional ISO timestamp when the event was generated (server/client)
 */
export interface ChatTypingDetail {
    roomId: string;
    senderId: LocalUserId;
    typing: boolean;
    createdAt?: string;
}
export const TYPING_EVENT_NAMES = [WS_EVENT.Typing];

export const EVENTS = [
    'reply',
    'forward',
    'historyPage',
];

/**
 * Every event name this frontend may put on, or match against, the wire.
 * `WsEventValue` covers the protocol proper (including v2's `join`/`leave`/
 * `reply`, which replaced the `phx_*` names the Elixir relay imposed); the
 * extra members are this app's own non-protocol frames.
 */
export type ChatWireEvent =
  | WsEventValue
  | "forward"
  | "historyPage";

export type ChatMessageModel = ChatMessage & {
    isOwner: boolean
};

export type WebSocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ChatPacket<T = any> {
    event: ChatWireEvent;
    payload?: T;
}

export interface SendMessageDeps {
    isE2EMock: boolean;
    roomId: string;
    sentSet: Set<string>;
    // เชื่อม Chat Store แบบ optional: ถ้าไม่ได้ส่งมาก็ยังทำงานผ่าน DOM event เหมือนเดิม
    adapter?: {
        send: (packet: any) => Promise<string | false> | string | false;
        emit?: (event: string, payload: any) => void;
        onMessage?: (cb: (packet: any) => void) => () => void;
        onAny?: (cb: (event: string, payload: any) => void) => () => void;
    };
    /**
     * High-level message sender (preferred when available).
     * If provided, sendChatMessage may delegate the actual transport to this sender.
     */
    sender?: {
        /**
         * Send a fully prepared ChatMessage (content/id/roomId/senderId set).
         * Returns the server id when available, else the client id; `false` on failure.
         */
        sendMessage: (event: string, msg: ChatMessage) => Promise<boolean>;
    };

}