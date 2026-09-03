"use client";
import React, {createContext, useContext, useEffect, useMemo, useRef} from "react";
import {useChatStore} from "@/modules/chat/store/chatStore";
import {useNetworkStore} from "@/store/networkStore";
import {useWebSocketContext} from "@/modules/chat/contexts/WebSocketContext";
import {ChatSenderAdapter} from "@/modules/chat/adapters/ChatSenderAdapter";
import {type ChatStorePort, ResendManager} from "@/modules/chat/services/ResendManager";
import {GlobalAckMatcher} from "@/modules/chat/utils/AckMatcher";
import {isBrowser} from "@/utils/browser";
import {ChatMessageModel} from "@/modules/chat/types";
import {ChatRoomId, ChatStatus} from "@108-plaza/jh-client";
import {WS_EVENT} from "@/modules/chat/protocol/wireEvents";


/**
 * Filters+maps a messagesByRoom snapshot down to the subset ResendManager
 * can safely act on: status "failed" with every field its retry path
 * needs. Extracted as its own pure function (no React/store coupling) so
 * this selection logic is directly unit-testable -- this exact selection
 * previously read from the store's `listMessages` field, which no real
 * message-adding code path (addMessage/addSending/upsertMessage) ever
 * populates, so it always returned an empty list and ResendManager could
 * never find anything to resend, regardless of status or retry meta.
 */
export function selectFailedMessagesForResend(
    messagesByRoom: Record<string, any[]> | undefined | null
): ChatMessageModel[] {
    const rawList = Object.values(messagesByRoom ?? {}).flatMap((arr) =>
        Array.isArray(arr) ? arr : []
    );
    return rawList
        .filter((m: any) => (
            m?.status === "failed" &&
            typeof m?.id === "string" && m.id.length > 0 &&
            typeof m?.roomId === "string" && m.roomId.length > 0 &&
            typeof m?.senderId === "number" && Number.isFinite(m.senderId) &&
            typeof m?.content === "string" && m.content.length > 0 &&
            typeof m?.createdAt === "string" && m.createdAt.length > 0
        ))
        .map((m: any) => ({
            id: m.id as string,
            roomId: m.roomId as ChatRoomId,
            senderId: m.senderId as number,
            secure: Boolean(m.secure),
            content: m.content as string,
            status: "failed" as ChatStatus,
            createdAt: m.createdAt as string,
            isOwner: Boolean(m.isOwner),
        }));
}

/**
 * Extracts {clientId, roomId} from a raw messageNack WS event, handling the
 * same defensive envelope-unwrapping (single vs. double-wrapped "forward"
 * envelope) as the existing ack path (see the `toAck` handler below).
 * Returns null when the payload carries no clientId, or when no roomId can
 * be resolved from either the payload or the fallback. Extracted as a pure
 * function so this parsing is directly unit-testable without a real WS/DOM
 * harness.
 */
export function parseNackPayload(
    raw: any,
    fallbackRoomId: string | undefined
): { clientId: string; roomId: string } | null {
    const inner = raw?.payload?.payload ?? raw?.payload ?? raw;
    const isForward = inner?.event && inner?.payload;
    const p = isForward ? inner.payload : inner;
    const clientId = p?.clientId ? String(p.clientId) : undefined;
    if(!clientId) return null;
    const roomId = String(p?.roomId ?? fallbackRoomId ?? "");
    if(!roomId) return null;
    return {clientId, roomId};
}

function pickChannel(ws: any, roomId?: string) {
    if(!ws) return null;
    if(ws.channel && typeof ws.channel.on === "function") return ws.channel;
    if(ws.chan && typeof ws.chan.on === "function") return ws.chan;
    if(ws.currentChannel && typeof ws.currentChannel.on === "function") return ws.currentChannel;
    const list = ws.channels || ws._channels || ws.__channels__;
    if(Array.isArray(list) && list.length) {
        if(roomId) {
            // A ChatChannel is addressed by its bare `room` -- there is no
            // `room:`-prefixed topic string to reconstruct any more.
            const byRoom = list.find((c: any) => String(c?.room || "") === String(roomId));
            if(byRoom) return byRoom;
        }
        return list[0];
    }
    return null;
}

interface WebSocketProviderProps {
    isLoggedIn: boolean;
    roomId: string;
    peerPublicKeyHex?: string;
    children: React.ReactNode;
}

// ----- Chat Services Context (for optional consumers) -----
export type ChatServices = {
    sender: ChatSenderAdapter | null;
    resend: ResendManager | null;
};
const ChatServicesContext = createContext<ChatServices>({sender: null, resend: null});
export const useChatServices = () => useContext(ChatServicesContext);

/**
 * ChatBridgeProvider (new design)
 * -------------------------------------
 * - ประกอบ sender/resend/ack matcher ตามดีไซน์ใหม่
 * - ไม่ setSender ตรงใน store อีกต่อไป
 * - ใช้ AckMatcher จับคู่ clientId ↔ serverId แล้ว promote ใน store
 */
export const ChatBridgeProvider: React.FC<WebSocketProviderProps> = ({children, roomId}) => {
    const ws = useWebSocketContext?.() as any;
    const store = useChatStore();
    const setOnline = useNetworkStore(s => s.setOnline);
    const isOnline = useNetworkStore(s => s.isOnline());

    const wiredWsRef = useRef<any>(null);
    const servicesRef = useRef<ChatServices>({sender: null, resend: null});
    const wasOnlineRef = useRef<boolean>(isOnline);

    // Build ResendManager + Sender when ws/channel ready
    useEffect(() => {
        if(!ws) return;
        const ch = pickChannel(ws, roomId);
        if(!ch) return;

        // Avoid rebuilding on same instance
        if(wiredWsRef.current === ch) return;
        wiredWsRef.current = ch;

        // Build sender bound to channel
        const sender = new ChatSenderAdapter(ch);

        // Map store to ChatStorePort (抓เฉพาะที่ ResendManager ใช้)
        const port: ChatStorePort = {
            getState: () => {
                const s = useChatStore.getState();
                // Strict gate (see selectFailedMessagesForResend): only messages
                // with complete required fields are allowed to resend. This
                // prevents resend loops when malformed drafts slip into the
                // failed list.
                return {
                    failedMessages: selectFailedMessagesForResend(s.messagesByRoom),
                    retryMeta: s.retryMeta,
                };
            },
            upsertRetryMeta: useChatStore.getState().upsertRetryMeta,
            dropRetryMeta: useChatStore.getState().dropRetryMeta,
            markFailed: useChatStore.getState().markFailed,
            promoteToSent: useChatStore.getState().promoteToDelivered,
        };

        const resend = new ResendManager(port, sender);
        servicesRef.current = {sender, resend};

        // Online/Offline wiring
        const onOpen = () => {
            setOnline(true);
        };
        const onClose = () => {
            setOnline(false);
        };

        const onError = () => {
            setOnline(false);
        };

        const onWindowOffline = () => {
            setOnline(false);
        };

        const onWindowOnline = () => {
            setOnline(true);
        };

        if(isBrowser()) {
            window.addEventListener('offline', onWindowOffline);
            window.addEventListener('online', onWindowOnline);
        }
        try {
            ws.on?.('error', onError);
        } catch {
        }

        try {
            ws.on?.("open", onOpen);
        } catch {
        }
        try {
            ws.on?.("close", onClose);
        } catch {
        }

        if(typeof ws?.connected === "boolean" && ws.connected) onOpen();

        return () => {
            if(isBrowser()) {
                window.removeEventListener('offline', onWindowOffline);
                window.removeEventListener('online', onWindowOnline);
            }
            try {
                ws.off?.('error', onError);
            } catch {
            }
            try {
                ws.off?.("open", onOpen);
            } catch {
            }
            try {
                ws.off?.("close", onClose);
            } catch {
            }
            servicesRef.current = {sender: null, resend: null};
            wiredWsRef.current = null;
        };
    }, [ws, roomId, store]);

    // Inbound: pipe to AckMatcher and promote in store when clientId matched
    useEffect(() => {
        if(!ws) return;
        const ch = pickChannel(ws, roomId);
        // No dead ws.on(...) fallback here: `ws` (the WebSocketContext
        // value) never has an `.on` method -- only the real channel
        // resolved by pickChannel does -- so a fallback branch trying
        // ws.on?.(...) can never attach a listener. Bail out instead of
        // leaving code that can never work.
        if(!ch || typeof ch.on !== "function") return;

        const toAck = (raw: any) => {
            try {
                const inner = raw?.payload?.payload ?? raw?.payload ?? raw;
                const isForward = inner?.event && inner?.payload;
                const p = isForward ? inner.payload : inner;
                const serverId = String(p?.id ?? "");
                if(!serverId) return;
                const clientId = p?.clientId ? String(p.clientId) : undefined;
                const rid = String(p?.roomId ?? roomId ?? "");
                const sid = Number(p?.senderId ?? 0);
                GlobalAckMatcher.onAck({clientId, serverId, roomId: rid, senderId: sid});
            } catch {
            }
        };

        try {
            ch.on(WS_EVENT.Message, toAck);
        } catch {
        }
        try {
            ch.on("forward", toAck);
        } catch {
        }
        return () => {
            try {
                ch.off?.(WS_EVENT.Message, toAck);
            } catch {
            }
            try {
                ch.off?.("forward", toAck);
            } catch {
            }
        };
    }, [ws, roomId]);

    // Inbound: messageNack -> mark the message failed and arm ResendManager's
    // retry, using the same clientId the message was originally sent with.
    // Mirrors the api-108heros contract: a nack means the message never made
    // it into durable storage, so the client should react like any other
    // send failure (see ResendManager.onSendFailure's own doc comment)
    // instead of only finding out via a much longer ack-wait timeout.
    useEffect(() => {
        if(!ws) return;
        const ch = pickChannel(ws, roomId);
        // No dead ws.on(...) fallback here: `ws` (the WebSocketContext
        // value) never has an `.on` method -- only the real channel
        // resolved by pickChannel does -- so a fallback branch trying
        // ws.on?.(...) can never attach a listener. Bail out instead of
        // leaving code that can never work.
        if(!ch || typeof ch.on !== "function") return;

        const toNack = (raw: any) => {
            try {
                const parsed = parseNackPayload(raw, roomId);
                if(!parsed) return;
                store.markFailed(parsed.roomId, parsed.clientId);
                servicesRef.current.resend?.onSendFailure(parsed.clientId, parsed.roomId);
            } catch {
            }
        };

        try {
            ch.on(WS_EVENT.MessageNack, toNack);
        } catch {
        }
        return () => {
            try {
                ch.off?.(WS_EVENT.MessageNack, toNack);
            } catch {
            }
        };
    }, [ws, roomId, store]);

    // Promote in store when AckMatcher confirms a clientId
    useEffect(() => {
        const unsub = GlobalAckMatcher.subscribe((ack) => {
            if(ack.clientId) {
                try {
                    store.promoteToDelivered(ack.roomId, ack.clientId);
                    store.dropRetryMeta(ack.clientId);
                } catch {
                }
            }
        });
        return () => {
            unsub();
        };
    }, [store]);
    // Flush resend when going from offline -> online
    useEffect(() => {
        const justBecameOnline = isOnline && !wasOnlineRef.current;
        if(justBecameOnline) {
            try {
                servicesRef.current.resend?.flushAll();
            } catch {
            }
        }
        wasOnlineRef.current = isOnline;
    }, [isOnline]);

    const services = useMemo(() => servicesRef.current, [servicesRef.current]);
    return (
      <ChatServicesContext.Provider value={services}>
          {children}
      </ChatServicesContext.Provider>
    );

};
