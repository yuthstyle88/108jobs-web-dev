import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useWebSocketContext} from '@/modules/chat/contexts/WebSocketContext';
import {createHandleWSMessage} from '@/modules/chat/events/handleWSMessage';
import {isBrowser} from "@/utils";
import {makeEmitReadAcker} from "@/modules/chat/utils";
import {
    sendChatMessage,
    SendEventDeps,
    sendReadReceipt as sendReadReceiptEvent,
    sendRoomUpdateEvent,
    sendDeliveryAck,
} from "@/modules/chat/events/sendEvents";
import {useTypingIndicator} from '@/modules/chat/hooks/useTypingIndicator';
import {ChatRoomView, LocalUser, LocalUserId} from "108jobs-client";
import {useChatStore} from "@/modules/chat/store/chatStore"
import {makeReadAckEmitter} from "@/modules/chat/utils/socket-emitter";
import {emitWsReconnected} from "@/modules/chat/events";
import {MessagePayload} from "@/modules/chat/types";
import {ChatSenderAdapter} from '@/modules/chat/adapters/ChatSenderAdapter';
import {usePresenceStore} from '@/modules/chat/store/presenceStore';
import {useReadLastIdStore} from "@/modules/chat/store/readStore";
import {usePartnerTyping} from '@/modules/chat/hooks/usePartnerTyping';
import {useRoomsStore} from "@/modules/chat/store/roomsStore";

// Safe DOM CustomEvent dispatcher
function dispatchDomEvent(name: string, detail: any) {
    try {
        if (isBrowser()) {
            window.dispatchEvent(new CustomEvent(name, {detail}));
        }
    } catch {
    }
}

// Must comfortably outlast ChatInput's own resend cadence for a continuous
// typing burst (TYPING_TRUE_THROTTLE_MS, 5000ms) -- a shorter value here
// makes the indicator decay between resends and flicker off almost as soon
// as it appears, even while the other person is still actively typing.
// The "stopped typing" case doesn't depend on this: ChatInput and
// useTypingIndicator's own idle timers (1500-2000ms) already send an
// explicit typing:false as soon as the user actually pauses -- this decay
// is only the fallback for a dropped/missed false event.
const TYPING_DECAY_MS = 6000;
const PEER_ACTIVE_DECAY_MS = 20000;
const PEER_ACTIVE_BUMP_MIN_MS = 1000; // throttle markPeerActive to avoid runaway timer churn

export interface UseChatRoomParams {
    roomId: string;
    onRemoteTyping?: (detail: { roomId: string; senderId: number; typing: boolean }) => void;
    localUser: LocalUser,
    roomData: ChatRoomView;
}

export function useChatRoom({
                                roomId,
                                onRemoteTyping,
                                localUser,
                                roomData,
                            }: UseChatRoomParams) {
    const [pageCursor, setPageCursor] = useState<string | null>(null);
    const fetchingRef = useRef(false);
    const hasMoreRef = useRef(true);

    const lastTypedSentRef = useRef<boolean>(false);
    const peerActiveRef = useRef<boolean>(false);
    const peerActiveDecayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPeerActiveBumpAtRef = useRef<number>(0);
    const peerActiveExpiresAtRef = useRef<number>(0);
    const {bumpRoomToTop} = useRoomsStore.getState();

    // Extract peer userId from roomData
    const peerUserId = React.useMemo(() => {
        const participants = roomData?.participants || [];
        const peer = participants.find((p: any) => String(p.memberId) !== String(localUser?.id));
        return peer ? Number(peer.id) : 0;
    }, [roomData?.participants, localUser?.id]);

    const markPeerActive = useCallback(() => {
        const now = Date.now();

        // Throttle to avoid churn from extremely frequent packets
        if (now - lastPeerActiveBumpAtRef.current < PEER_ACTIVE_BUMP_MIN_MS) {
            return;
        }
        lastPeerActiveBumpAtRef.current = now;

        // Mark active and push out the expiry
        peerActiveRef.current = true;
        peerActiveExpiresAtRef.current = now + PEER_ACTIVE_DECAY_MS;

        // Update presence store with userId-based tracking
        if (peerUserId > 0) {
            try {
                usePresenceStore.getState().setPeerOnline(peerUserId, now);
            } catch {
            }
        }

        // If there's already a decay timer running, do not create a new one.
        // Let the single timer extend its expiry by reading peerActiveExpiresAtRef when it wakes.
        if (!peerActiveDecayRef.current) {
            const tick = () => {
                const remaining = peerActiveExpiresAtRef.current - Date.now();
                if (remaining <= 0) {
                    // Expired: flip the flag and clear the timer handle
                    peerActiveRef.current = false;
                    peerActiveDecayRef.current = null;
                    return;
                }
                // Still active; schedule the next wake-up only once
                peerActiveDecayRef.current = setTimeout(tick, Math.min(remaining, PEER_ACTIVE_DECAY_MS));
            };
            // Start the one-and-only timer
            peerActiveDecayRef.current = setTimeout(tick, PEER_ACTIVE_DECAY_MS);
        }
    }, [roomId, peerUserId]);

    const isE2EMock = process.env.NEXT_PUBLIC_E2E_MODE === 'mock';
    const [refreshRoomData, setRefreshRoomData] = useState<ChatRoomView>(roomData);

    const sentMessagesRef = useRef<Set<string>>(new Set());
    const processedMsgRef = useRef<Set<string>>(new Set());

    const fetchResolveRef = useRef<((value?: void) => void) | null>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const ackCooldownRef = useRef<number>(0);
    const readAckRef = useRef<((id: number | string) => void) | null>(null);
    const deliveryAckRef = useRef<((id: number | string) => void) | null>(null);
    // Partner typing state handled by usePartnerTyping hook below
    const localSenderRef = useRef<any>(null);
    const ws = useWebSocketContext();
    const adapterAny: any = (ws as any)?.adapter ?? ws;
    const joinedRoomRef = useRef<string | null>(null);
    // Normalize readiness flag for legacy socket vs new adapter
    const isReady = !!((ws as any)?.isReady ?? (ws as any)?.adapter?.isReady);
    const upsertMessage = useChatStore(s => s.upsertMessage);
    // Typing indicator helper (centralized throttle/debounce)
    const typingEmitter = useTypingIndicator({
        wsAdapter: adapterAny,
        roomId,
        senderId: Number(localUser.id) || 0,
        onAfterSend: (v: boolean) => {
            lastTypedSentRef.current = v;
        },
    });
    // Normalized addMessageListener for both legacy socket and new adapter (or EventEmitter-style .on/.off)
    const addMessageListener = React.useCallback((handler: (data: unknown) => void) => {
        const a: any = (ws as any)?.adapter ?? null;
        // Preferred: adapter.addMessageListener(handler)
        if (a && typeof a.addMessageListener === 'function') {
            return a.addMessageListener(handler);
        }
        // Legacy: ws.addMessageListener(handler)
        if (ws && typeof (ws as any).addMessageListener === 'function') {
            return (ws as any).addMessageListener(handler);
        }
        // Fallback: EventEmitter-style
        const target: any = a || ws;
        if (target && typeof target.on === 'function') {
            target.on('message', handler);
            return () => {
                try {
                    target.off?.('message', handler);
                } catch {
                }
            };
        }
        // No-op unsubscriber
        return () => {
        };
    }, [ws]);

    useEffect(() => {
        if (!adapterAny) return;

        // If not ready: connect only once per adapter instance
        if (!isReady) {
            // Note: We used to call adapterAny.connect() here, but that is now handled 
            // by the useWebSocket hook in the WebSocketProvider to avoid race conditions.
            return;
        }

        // Ready now → ensure joined exactly once per roomId
        if (roomId && joinedRoomRef.current !== roomId) {
            try {
                // leave previous if applicable (best-effort)
                if (joinedRoomRef.current && typeof adapterAny.leave === 'function') {
                    try {
                        adapterAny.leave(joinedRoomRef.current);
                    } catch {
                    }
                }
                if (typeof adapterAny.join === 'function') {
                    adapterAny.join(roomId);
                }
                joinedRoomRef.current = roomId;
            } catch {
            }

            // Clear transient UI flags only on new join
            if (pageCursor !== null) setPageCursor(null);
            try {
                emitWsReconnected?.();
            } catch {
            }
        }
    }, [isReady, roomId, adapterAny]);

    const {isPartnerTyping} = usePartnerTyping({
        channel: adapterAny,
        roomId: roomId as any,
        localUserId: Number(localUser.id) || 0,
        decayMs: TYPING_DECAY_MS,
        onRemoteTyping,
        dispatchDomEvent: (name, detail) => dispatchDomEvent(name, detail),
    });

    const handleWSMessage = React.useMemo(() => createHandleWSMessage({
        roomId,
        localUserId: Number(localUser.id) || 0,
        markPeerActive,
        onRemoteTyping: () => {
        },
        processedMsgRef,
        peerActiveRef,
        setPageCursor,
        setHasMoreMessages: (val: boolean) => {
            hasMoreRef.current = val;
        },
        setIsFetching: (val: boolean) => {
            fetchingRef.current = val;
        },
        fetchTimeoutRef,
        fetchResolveRef,
        readAckRef,
        deliveryAckRef,
        ackCooldownRef,
        upsertMessage,
    }), [roomId, localUser.id, setRefreshRoomData, markPeerActive, upsertMessage]);

    useEffect(() => {
        if (!ws) return;
        const off = addMessageListener((data: unknown) => {
            try {
                handleWSMessage({data} as any);
            } catch {
            }
        });
        return () => {
            try {
                off?.();
            } catch {
            }
        };
    }, [ws, addMessageListener, handleWSMessage]);


    // Read-ack acker wiring
    useEffect(() => {
        if (isE2EMock || !roomId) {
            readAckRef.current = null;
            return;
        }
        const emit = makeReadAckEmitter(((ws as any)?.adapter ?? ws) as any, Number(localUser.id) || 0);
        const baseAcker = makeEmitReadAcker(emit, roomId, 0);
        readAckRef.current = (id: number | string) => {
            try {
                baseAcker(id);
            } catch (e) {
                try {
                    console.warn('[read-ack] baseAcker failed', e);
                } catch {
                }
            }
        };
        return () => {
            readAckRef.current = null;
        };
    }, [roomId, localUser.id, isE2EMock, ws]);

    // Delivery-ack wiring (confirm received to server)
    useEffect(() => {
        if (isE2EMock || !roomId) {
            deliveryAckRef.current = null;
            return;
        }
        const adapter = ((ws as any)?.adapter ?? ws) as any;
        const me = Number(localUser.id) || 0;
        deliveryAckRef.current = (id: number | string) => {
            try {
                const deps: SendEventDeps = {adapter, roomId, senderId: me} as any;
                sendDeliveryAck(deps, String(id));
            } catch (e) {
                try {
                    console.warn('[deliver-ack] failed', e);
                } catch {
                }
            }
        };
        return () => {
            deliveryAckRef.current = null;
        };
    }, [ws, roomId, localUser.id, isE2EMock]);

    useEffect(() => {
        return () => {
            if (peerActiveDecayRef.current) {
                try {
                    clearTimeout(peerActiveDecayRef.current);
                } catch {
                }
            }
            // Cleanup joined room state on unmount
            joinedRoomRef.current = null;
        };
    }, [roomId]);

    // Actions
    const sendMessage = useCallback(async (data: MessagePayload) => {
        // Normalize transports (prefer context sender; fallback to local sender from adapter)
        const ctx: any = ws as any;
        let sender = ctx?.sender as any;
        const adapter = (ctx?.adapter ?? ctx) as any;

        if (!sender && adapter) {
            // Lazily create a local sender bound to the adapter (one-time)
            if (!localSenderRef.current) {
                try {
                    localSenderRef.current = new ChatSenderAdapter(adapter);
                } catch {
                }
            }
            sender = localSenderRef.current;
        }

        if (!sender && !adapter) return; // require at least one transport

        // Ensure payload has a senderId (fallback to localUser.id)
        const payload: MessagePayload = {
            ...data,
            secure: Boolean((localUser as any)?.isMessageSecure),
            senderId: Number(localUser.id) || (data as any)?.senderId,
        };

        const deps = {
            isE2EMock,
            roomId,
            sentSet: sentMessagesRef.current,
            onAfterSend: () => {
                lastTypedSentRef.current = false;
            },
            ...(sender ? {sender} : {}),
            ...(adapter ? {adapter} : {}),
        } as const;
        await sendChatMessage(deps, payload);
        bumpRoomToTop(roomId);
    }, [ws, roomId, localUser.id, isE2EMock]);

    const resendMessage = useCallback(async (id: string) => {
        const st = useChatStore.getState();
        const sender = (ws as any)?.sender;
        try {
            // Resolve the latest message object from the store
            const lookup = (mid: string) => {
                const fromMsgs = (st as any).messages?.find?.((m: any) => String(m.id) === String(mid));
                if (fromMsgs) return fromMsgs;
                return (st as any).pendingMessages?.find?.((m: any) => String(m.id) === String(mid));
            };

            const msg = lookup(id);
            if (sender && typeof sender.send === 'function' && msg) {
                await sender.send(msg);
                return;
            }

            // Fallback: if we can't resolve the message object or no sender, trigger store retry + flush
            st.retryMessage?.(id);
            st.flushFailed?.();
        } catch (err) {
            try {
                console.warn('[chat] resendMessage failed, fallback to flush', err);
            } catch {
            }
            // Final fallback
            try {
                st.retryMessage?.(id);
                st.flushFailed?.();
            } catch {
            }
        }
    }, [ws]);

    const sendRoomUpdate = useCallback(
        (event: SendEventDeps, update: Record<string, any>) => {
            try {
                const adapter = ((ws as any)?.adapter ?? ws) as any;
                sendRoomUpdateEvent(
                    {adapter, roomId: event.roomId, senderId: event.senderId},
                    update
                );
            } catch (err) {
                console.error("[chat] sendRoomUpdateEvent failed:", err);
            }
        },
        [ws, localUser.id]
    );


    const flushPending = useCallback(async () => {
        try {
            useChatStore.getState().flushFailed?.();
        } catch {
        }
    }, []);

    const removePending = useCallback((id: string) => {
        try {
            useChatStore.getState().removeMessage?.(roomId, id);
        } catch {
        }
    }, []);

    // New read-receipt: only send event, do NOT optimistically update peer read state locally
    const sendReadReceipt = useCallback((roomIdArg: string, lastMessageAt: string) => {
        const adapter = ((ws as any)?.adapter ?? ws) as any;
        const me = Number(localUser.id) || 0;

        // Do NOT update peer read locally here.
        // Read-last is a property of the OTHER party; we wait for server/peer event to reflect it.
        if (!adapter) return;
        try {
            if (localStorage.getItem('debug_read_ack') === '1') {
                console.log('[read-ack] sendReadReceipt() 1', {roomId: roomIdArg, senderId: me, lastMessageAt});
            }
            (sendReadReceiptEvent as any)({adapter, roomId: roomIdArg, senderId: me}, lastMessageAt);
            console.log('[read-ack] sendReadReceipt() 2', {roomId: roomIdArg, senderId: me, lastMessageAt});
            try {
                (readAckRef.current as any)?.(lastMessageAt);
            } catch {
            }
        } catch (err) {
            console.error('Failed to send read receipt', err);
        }
    }, [ws, localUser.id]);

    const sendTyping = useCallback((isTyping: boolean) => {
        try {
            const a: any = adapterAny ?? (ws as any);
            const active = !!(
                a && (
                    a.isReady === true ||
                    a.connected === true ||
                    (typeof a.isOpen === 'function' && a.isOpen() === true)
                )
            );
            if (!active) return; // ไม่พร้อมก็ไม่ส่ง

            if (isTyping) {
                typingEmitter?.startTyping?.();
                typingEmitter?.onUserTyping?.();
            } else {
                typingEmitter?.stopTyping?.();
            }
        } catch {
        }
    }, [adapterAny, ws, typingEmitter]);

    const onWsErrorDuringFetch = useCallback(() => {
        if (fetchTimeoutRef.current) {
            try {
                clearTimeout(fetchTimeoutRef.current);
            } catch {
            }
            fetchTimeoutRef.current = null;
        }
        if (fetchResolveRef.current) {
            try {
                fetchResolveRef.current();
            } catch {
            }
            fetchResolveRef.current = null;
        }
        fetchingRef.current = false;
    }, []);

    // Getter: read-last (peer) — delegate to readLastIdStore (SSOT)
    const getPeerLastReadAt = useCallback((peerUserId: LocalUserId, roomIdArg?: string) => {
        const rid = roomIdArg ?? roomId;
        try {
            return useReadLastIdStore.getState().getPeerLastReadAt?.(rid, peerUserId);
        } catch {
            return undefined;
        }
    }, [roomId]);

    return {
        state: {pageCursor, refreshRoomData, isPartnerTyping, isPeerActive: peerActiveRef},
        actions: {sendMessage, resendMessage, flushPending, removePending, sendReadReceipt, sendTyping, sendRoomUpdate},
        utils: {onWsErrorDuringFetch, markPeerActive, getPeerLastReadAt},
    } as const;
}
