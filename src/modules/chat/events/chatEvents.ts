// Centralized chat event helpers for consistent usage across the app
// This provides typed helpers to emit and subscribe to chat CustomEvents
// keeping window and event-name details in one place.
import {isBrowser} from "@/utils/browser";

export const CHAT_EVENT = Object.freeze({
    TYPING: 'chat:typing',
    READ: 'chat:read',
    WS_RECONNECTED: 'ws:reconnected',
} as const);

export function emitWsReconnected(): void {
    if (!isBrowser()) return;
    try {
        window.dispatchEvent(new Event(CHAT_EVENT.WS_RECONNECTED as any));
    } catch {
    }
}

/** Emit a unified typing event */
export function emitChatTyping(detail: { roomId: string; senderId: number; typing: boolean }) {
    try {
        if (!isBrowser()) return;

        // Basic validation to avoid silent no-ops
        const roomId = String((detail as any)?.roomId || "");
        const senderId = Number((detail as any)?.senderId || 0);
        const typing = Boolean((detail as any)?.typing);
        if (!roomId || !Number.isFinite(senderId)) return;

        const baseInit: CustomEventInit = {
            detail: {roomId, senderId, typing},
            bubbles: true,
            composed: true,
            cancelable: false,
        };

        // Dispatch to window
        try {
            const evtWin = new CustomEvent(CHAT_EVENT.TYPING as string, baseInit);
            window.dispatchEvent(evtWin);
        } catch {
        }

        // Dispatch to document (if available)
        try {
            if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
                const evtDoc = new CustomEvent(CHAT_EVENT.TYPING as string, baseInit);
                document.dispatchEvent(evtDoc);
            }
        } catch {
        }
    } catch (e) {
        // swallow errors to keep callers simple
    }
}

/** Emit a unified read-receipt event */
export function emitReadReceipt(roomId: string, lastMessageId: string, readerId: number) {
    try {
        if (isBrowser()) window.dispatchEvent(new CustomEvent(CHAT_EVENT.READ, {
            detail: {
                roomId,
                lastMessageId,
                readerId
            }
        }));
    } catch {
    }
}

export type ChatReadReceiptDetail = { roomId: string; lastMessageId: string; readerId: number };

export type ChatReadReceiptHandler = (detail: ChatReadReceiptDetail) => void;

export function onReadReceipt(handler: ChatReadReceiptHandler): () => void {
    if (!isBrowser()) return () => {
    };
    const wrapped = (e: CustomEvent<ChatReadReceiptDetail>) => {
        try {
            const d = e.detail;
            if (!d) return;
            if (!Number.isFinite(d.readerId)) return;
            handler({roomId: d.roomId, lastMessageId: d.lastMessageId, readerId: Number(d.readerId)});
        } catch {
        }
    };
    window.addEventListener(CHAT_EVENT.READ as any, wrapped as any);
    return () => window.removeEventListener(CHAT_EVENT.READ as any, wrapped as any);
}
