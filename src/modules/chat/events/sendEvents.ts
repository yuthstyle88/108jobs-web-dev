import type {ChatMessage, LocalUserId} from "@108-plaza/jh-client";
import {UserService} from "@/services";
import {encrypt} from "@/utils";
import {dbg} from "@/modules/chat/utils";
import {MessagePayload, ChatWireEvent, ChatPacket, SendMessageDeps} from "@/modules/chat/types";
import {WS_EVENT} from "@/modules/chat/protocol/wireEvents";
import {createMessage} from "@/modules/chat/domain/entities/message";
import {wsSend} from "@/modules/chat/utils/socketSend";
import {useChatStore} from "@/modules/chat/store/chatStore";

// ---- Packet helpers ----
export function createEvent<T>(event: ChatWireEvent, payload?: T): ChatPacket<T> & {
    roomId?: string;
    timestamp: string
} {
    const p: any = {event, payload, timestamp: new Date().toISOString()};
    Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
    return p;
}

export interface SendEventDeps {
    roomId: string;
    senderId: LocalUserId;
    adapter?: SendMessageDeps['adapter'];
    sender?: SendMessageDeps['sender'];
}

// ---- Lightweight emits ----
export function sendTyping(deps: SendEventDeps, typing: boolean) {
    const a = (deps as any).adapter;
    if (!a) return;
    wsSend(a, createEvent(WS_EVENT.Typing, {typing, senderId: deps.senderId, roomId: deps.roomId}));
}

export function sendReadReceipt(deps: SendEventDeps, lastMessageId: string) {
    const a = (deps as any).adapter;
    if (!a) return;
    const pkt = createEvent(WS_EVENT.ReadUpTo, {
        secure: false,
        roomId: deps.roomId,
        readerId: deps.senderId,
        lastReadMessageId: lastMessageId || ''
    });
    dbg('sendReadReceipt', pkt);
    wsSend(a, pkt);
}

export function sendRoomUpdateEvent(deps: SendEventDeps, update: Record<string, any>) {
    const a = (deps as any).adapter;
    if (!a) return;
    wsSend(a, createEvent(WS_EVENT.Update, {roomId: deps.roomId, ...update}));
}

/**
 * Send delivery acknowledgment to server for a received message.
 * Minimal payload: roomId, receiverId (me), messageId
 */
export function sendDeliveryAck(deps: SendEventDeps, messageId: string) {
    const a = (deps as any).adapter;
    if (!a) return;
    const pkt = createEvent(WS_EVENT.AckConfirm, {
        roomId: deps.roomId,
        receiverId: deps.senderId,
        messageId: String(messageId || '')
    });
    dbg('sendDeliveryAck', pkt);
    wsSend(a, pkt);
}

// ---- Core send/ack ----
// sender.sendMessage() (ChatSenderAdapter, bound to the real channel) waits
// for the server's own reply frame before resolving -- a truthy result here
// already IS server confirmation, not just a wire write. No separate
// wait-for-ack loop is needed on top of it.
async function doSend(deps: SendMessageDeps, msg: ChatMessage): Promise<{ id: string; sent: boolean }> {
    const id = (msg as any).id; // keep the original id type (number/string) to match store keys
    const s = (deps as any).sender;
    if (!s) return {id, sent: false};
    dbg('doSend:start', {id, roomId: (deps as any)?.roomId});
    try {
        const result = await s.sendMessage(WS_EVENT.Message, msg);
        if (!result) return (dbg('doSend:sendMessage failed', {id}), {id, sent: false});

        try {
            useChatStore.getState()?.commitStatus?.(msg.roomId, id, 'sending' as any);
        } catch {
        }

        dbg('doSend:sendMessage returned serverId', {id, result});
        return {id: result, sent: true};
    } catch (err: any) {
        const reason = err?.message || err?.reason || String(err);
        dbg('doSend:error', {id, reason});
        return {id, sent: false};
    }
}

// ---- Public: send chat message ----
export async function sendChatMessage(deps: SendMessageDeps, data: MessagePayload): Promise<{
    id: string;
    sent: boolean
} | undefined> {
    const store = useChatStore.getState();
    const message = data?.message ?? '';
    if (!message) return;
    const hasSender = !!(deps as any)?.sender, hasRoom = !!(deps as any)?.roomId, hasSenderId = !!data?.senderId;
    if (!hasSender || !hasRoom || !hasSenderId) return;

    const msgId = (data as any)?.id; // keep id type; avoid string-casting
    const sentSet = (deps as any)?.sentSet as Set<any> | undefined;
    // Do not early-return if message id is already in sentSet — we still want to ensure it exists in the UI/store.
    // sentSet is only used to reduce duplicate transport sends, not to suppress UI state.

    const allowEncrypt = data?.secure !== false;
    const p = createMessage(message, (deps as any).roomId, data.senderId, data.secure, data.id);
    if (!p) return;
    p.status = 'sending' as any;
    // Beside the content, never inside it: the server persists this into
    // chat_message.asset_id, which is the only thing mapping the asset back
    // to a room for media_proxy's membership check, and it cannot read the
    // ciphertext this message is about to become.
    if (data.assetId) p.assetId = data.assetId;
    try {
        store?.addSending?.(p);
    } catch {
    }
    if (msgId) try {
        sentSet?.add?.(msgId);
    } catch {
    }

    try {
        const key = UserService.Instance.authInfo?.sharedKey;
        const useEnc = !!(key && message && allowEncrypt);
        const cipher = useEnc ? await encrypt(message, key!) : null;
        (p as any).content = cipher && cipher !== message ? cipher : message;
        (p as any).secure = !!(cipher && cipher !== message);
    } catch {
        (p as any).content = message;
        (p as any).secure = false;
    }

    if (!(deps as any)?.sender) return; // guard (shouldn’t happen; already checked)


    try {
        const res = await doSend(deps, p);
        const pid = (p as any).id;                   // preserve original type
        const rid = (res as any)?.id ?? pid;         // if server returns new id only on success
        // update status without changing identity type
        if (res?.sent) {
            // commitStatus is (roomId, id, status) -- match on the message's
            // own client id (pid), the same key it was added to the store
            // under; `rid` (the resolved server id) isn't a store key.
            store?.commitStatus?.(deps.roomId, pid, 'delivered');
            if (msgId != null) try {
                sentSet?.add?.(msgId);
            } catch {
            }
        } else {
            store?.commitStatus?.(deps.roomId, pid, 'failed');
            if (msgId != null) try {
                sentSet?.delete?.(msgId);
            } catch {
            }
        }
        return {id: rid, sent: !!res?.sent} as any;
    } catch (err) {
        dbg('sendChatMessage: transport error', err);
        store?.commitStatus?.(deps.roomId, (p as any).id, 'failed');
        if (msgId != null) try {
            sentSet?.delete?.(msgId);
        } catch {
        }
        return {id: (p as any).id, sent: false} as any;
    }
}