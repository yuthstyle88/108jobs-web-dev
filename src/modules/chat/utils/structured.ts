import {v4 as uuidv4} from 'uuid';
import {LocalUserId} from "108jobs-client";
import {WsMessageSender} from "@/modules/chat/types";

export type Structured = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const parseStructured = (raw: unknown): Structured | null => {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(s);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const serializeStructured = (obj: Structured): string => {
    try {
        return JSON.stringify(obj);
    } catch {
        return '{}';
    }
};

export const sendStructured = async (
    sendMessage: WsMessageSender,
    roomId: string,
    payload: Structured,
    senderId: LocalUserId,
    opts: {
        previewText?: string;
        attach?: { url: string; name?: string } | null;
        secure?: boolean;
        /** See `ChatMessage.assetId`. */
        assetId?: string;
    } = {}
) => {
    const id = uuidv4();
    const content = serializeStructured(payload);
    const message = opts.attach
        ? serializeStructured({...payload, fileUrl: opts.attach.url, fileName: opts.attach.name})
        : content;

    // No optimistic-preview dispatch here: in the live app, the `sendMessage`
    // callback passed in resolves to `useChatRoom().actions.sendMessage`,
    // which itself calls `sendChatMessage` (`events/sendEvents.ts`) and
    // already adds the optimistic entry via `store.addSending`. This
    // function used to also fire a `dispatchPreview` -> `emitChatNewMessage`
    // CustomEvent for the same purpose, but nothing ever listened for it
    // (see chatEvents.ts's removed `CHAT_EVENT.MESSAGE`), so it was dead
    // weight.
    const secure = typeof opts.secure === 'boolean' ? opts.secure : false;
    await sendMessage({senderId: senderId, message, secure, id, assetId: opts.assetId});
    return id;
};

// Backward/semantic alias to better convey intent in callers
export const sendStructuredMessage = sendStructured;
