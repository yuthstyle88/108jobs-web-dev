import * as React from "react";
import type {NormalizedEnvelope} from "@/modules/chat/utils/chatSocketUtils";
import {
    broadcastToListeners,
    handleIncomingPayload,
    isChatMessageLike,
    isValidIncomingChatPayload,
    normalizeChatEnvelope,
    unwrapChatFrame,
} from "@/modules/chat/utils/chatSocketUtils";
import {emitChatTyping,} from "@/modules/chat/events/index";
import type {ChatMessage} from "@108-plaza/jh-client";
import { WS_EVENT } from "@/modules/chat/protocol/wireEvents";
import {
    buildMessageSignature,
    cleanupFetch,
    maybeHandlePresenceUpdate,
    maybeHandleReadReceipt,
    maybeHandleStatusChange,
    parseTypingDetail,
    tryFlushAutoAck
} from "@/modules/chat/utils";
import {ChatTypingDetail} from "@/modules/chat/types";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";

export interface HandlerRefs {
    /** set of processed message signatures for dedupe */
    processedMsgRef: React.RefObject<Set<string>>;
    /** mark that peer is active right now */
    peerActiveRef: React.RefObject<boolean>;
    /** pending page cursor setter from history fetch */
    setPageCursor?: (cursor: any) => void;
    setHasMoreMessages?: (b: boolean) => void;
    setIsFetching?: (b: boolean) => void;
    /** fetch coordination */
    fetchTimeoutRef?: React.RefObject<any>;
    fetchResolveRef?: React.RefObject<(() => void) | null>;
    /** read-ack support */
    readAckRef: React.RefObject<((lastId: string) => void) | null>;
    /** delivery-ack support */
    deliveryAckRef?: React.RefObject<((lastId: string) => void) | null>;
    ackCooldownRef: React.RefObject<number>;
}

export interface HandlerDeps extends HandlerRefs {
    roomId: string;
    /** current user id */
    localUserId: number;
    /** inform that peer is active (UI hint) */
    markPeerActive: () => void;
    /** optional: push typing state directly to UI in addition to DOM event */
    onRemoteTyping?: (detail: ChatTypingDetail) => void;
    upsertMessage: (msg: ChatMessage) => void;
}

export interface HandlerState {
    batchAckLastId: string | null;
    lastDeliveredId: string | null;
    lastAckedId: string | null;
}

/**
 * Factory to create a stable WS onmessage handler, with all external state passed via deps.
 */
export function createHandleWSMessage(deps: HandlerDeps) {
    const {
        roomId,
        localUserId,
        markPeerActive,
        onRemoteTyping,
        processedMsgRef,
        peerActiveRef,
        setPageCursor,
        setHasMoreMessages,
        setIsFetching,
        fetchTimeoutRef,
        fetchResolveRef,
        readAckRef,
        deliveryAckRef,
        ackCooldownRef,
        upsertMessage,
    } = deps;

    // Persistent state for this handler instance
    const state: HandlerState = {
        batchAckLastId: null,
        lastDeliveredId: null,
        lastAckedId: null,
    };

    const handlePeerActivity = (payload: any) => {
        try {
            const rawSender = payload?.data?.payload?.senderId ?? payload?.data?.payload?.readerId;
            const senderIdNum = rawSender != null ? Number(rawSender) : undefined;
            if (senderIdNum != null && senderIdNum !== localUserId) {
                markPeerActive();
            }
        } catch {
            // ignore peer active marking errors
        }
    };

    const handleSyncPending = () => {
        try {
            if (ackCooldownRef.current !== undefined) {
                (ackCooldownRef as any).current = 0;
            }

            const lastId = state.batchAckLastId || state.lastDeliveredId;
            if (lastId) {
                try {
                    deliveryAckRef?.current?.(lastId);
                } catch {
                }
                state.batchAckLastId = lastId;
                tryFlushAutoAck(state, roomId, readAckRef, ackCooldownRef);
            }
        } catch {
        }
    };

    const handleAckProtocol = (rawEvt: string, payload: any) => {
        try {
            // NOTE: this branch is currently unreachable. api-108heros sends its
            // ack-reminder response under the wire string "syncPending" (see
            // AnyIncomingEvent::SyncPending in bridge_message.rs), never a
            // distinct "ackReminder" string -- so this rich per-clientId
            // reconciliation (chatOutbox.markPending + chatChannel.ackConfirm)
            // never runs; the `evt === WS_EVENT.SyncPending` branch below handles
            // the real inbound event instead, via the simpler handleSyncPending()
            // (which does not read this payload's clientIds). Deliberately left
            // unwired rather than fixed here -- see the design spec's "Finding"
            // section: whether to make this fire is a product decision, not a
            // side effect of a naming pass. "ackReminder" has no WS_EVENT entry
            // since the backend has no matching ChatEvent variant.
            if (rawEvt === 'ackReminder') {
                const ids: string[] = payload?.data?.payload?.clientIds ?? [];
                (window as any)?.chatOutbox?.markPending?.(roomId, localUserId, ids);
                (window as any)?.chatChannel?.ackConfirm?.(ids);
            } else if (rawEvt === WS_EVENT.MessageAck) {
                const cid: string | undefined = payload?.data?.payload?.clientId;
                if (cid) {
                    (window as any)?.chatOutbox?.markDelivered?.(roomId, localUserId, cid);
                    (window as any)?.chatStore?.markMessageDelivered?.(roomId, cid);
                }
            }
        } catch {
        }
    };

    const handleTyping = (env: NormalizedEnvelope) => {
        const typingInfo = parseTypingDetail(env, roomId, localUserId);
        if (typingInfo) {
            try {
                emitChatTyping(typingInfo);
                onRemoteTyping?.(typingInfo);
            } catch {
            }
        }
    };

    const processIncomingMessages = async (payload: any) => {
        const msgs = await handleIncomingPayload(payload.data, {
            roomId: roomId,
            localUserId: localUserId,
            receivedSet: processedMsgRef.current,
            setPageCursor,
            setHasMoreMessages,
            setIsFetching,
            fetchTimeoutRef,
            fetchResolveRef,
        });

        if (!Array.isArray(msgs) || !msgs.length) return;

        let lastAckId: string | undefined;

        for (const item of msgs) {
            broadcastToListeners(item);
            if (!isChatMessageLike(item)) continue;

            const signature = buildMessageSignature(item);
            processedMsgRef.current?.add(signature);

            const fromSelf = Number(item.senderId) === localUserId;
            const peerActiveNow = peerActiveRef.current;
            const enhancedItem = {...item, unread: fromSelf ? !peerActiveNow : false} as ChatMessage;

            const msgId = String(item.id || "");
            const sameRoom = String(item.roomId) === roomId;
            if (sameRoom && !fromSelf && msgId) {
                lastAckId = msgId;
            }
            upsertMessage(enhancedItem);
        }

        if (lastAckId) {
            state.batchAckLastId = lastAckId;
            try {
                deliveryAckRef?.current?.(lastAckId);
                state.lastDeliveredId = lastAckId;
            } catch {
            }
        }

        tryFlushAutoAck(state, roomId, readAckRef, ackCooldownRef);
    };

    return async (event: any) => {
        let payload: any;
        try {
            payload = unwrapChatFrame(event);
            if (!payload?.data) return;

            const evt = payload.data.event;

            // 0) Pre-processing
            if (evt === WS_EVENT.Message && !isValidIncomingChatPayload(payload)) {
                try {
                    const store = useRoomsStore.getState();
                    if (typeof store.bumpRoomToTop === 'function') {
                        store.bumpRoomToTop(String(payload.data.roomId));
                    }
                } catch {
                }
            }

            const env: NormalizedEnvelope = normalizeChatEnvelope(payload.data, roomId);

            handlePeerActivity(payload);

            // 1) Status and Presence
            if (await maybeHandleStatusChange(env, roomId)) return null;
            if (await maybeHandlePresenceUpdate(env, localUserId)) return null;

            // 2) Sync and Ack Protocol
            if (evt === WS_EVENT.SyncPending) {
                handleSyncPending();
                return null;
            }

            if (evt === 'ackReminder' || evt === WS_EVENT.MessageAck) {
                handleAckProtocol(evt, payload);
                return;
            }

            // 3) Typing
            handleTyping(env);

            // 4) Read Receipt
            if (maybeHandleReadReceipt(env, roomId)) return;

            // 5) Message payloads
            await processIncomingMessages(payload);

        } catch (e) {
            cleanupFetch(setIsFetching, fetchTimeoutRef, fetchResolveRef);
            try {
                broadcastToListeners(payload ?? unwrapChatFrame(event));
            } catch {
            }
        }
    };
}
