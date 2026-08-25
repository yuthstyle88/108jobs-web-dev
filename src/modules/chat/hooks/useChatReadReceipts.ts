import {useCallback, useEffect, useRef, useMemo} from "react";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {isBrowser} from "@/utils";
import {ChatMessage, ChatRoomId, LocalUserId} from "108heros-client";

interface UseChatReadReceiptsProps {
    roomId: ChatRoomId;
    messages: ChatMessage[];
    localUserId: LocalUserId;
    sendReadReceipt: (roomId: ChatRoomId, lastId: string) => void;
}

export function useChatReadReceipts({
                                        roomId,
                                        messages,
                                        localUserId,
                                        sendReadReceipt,
                                    }: UseChatReadReceiptsProps) {
    const markRoomReadInStore = useRoomsStore((s) => s.markRoomRead);
    const lastReadSentRef = useRef<string | null>(null);

    const sendLatestRead = useCallback(() => {
        if (typeof document === "undefined" || document.visibilityState !== "visible" || !document.hasFocus()) {
            return;
        }
        const last = messages[messages.length - 1];
        if (!last) return;

        if (last.senderId === localUserId) return;

        const lastId = last.id;
        if (lastReadSentRef.current === lastId) return;

        try {
            sendReadReceipt(roomId, lastId);
            lastReadSentRef.current = lastId;
        } catch (e) {
            // ignore
        }
    }, [messages, localUserId, roomId, sendReadReceipt]);

    // Reset dedupe tracker when room changes
    useEffect(() => {
        lastReadSentRef.current = null;
    }, [roomId]);

    // Sync with store and server when latest message changes
    const lastMsgId = useMemo(() => (
        messages.length ? String(messages[messages.length - 1]?.id ?? "") : null
    ), [messages]);

    useEffect(() => {
        if (lastMsgId) {
            sendLatestRead();
        }
    }, [lastMsgId, sendLatestRead]);

    // Re-send when page becomes active
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;

        const trySend = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
                    sendLatestRead();
                    markRoomReadInStore(roomId);
                }
            }, 120);
        };

        window.addEventListener("focus", trySend);
        document.addEventListener("visibilitychange", trySend);
        window.addEventListener("pageshow", trySend);
        window.addEventListener("online", trySend);

        trySend();

        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener("focus", trySend);
            document.removeEventListener("visibilitychange", trySend);
            window.removeEventListener("pageshow", trySend);
            window.removeEventListener("online", trySend);
        };
    }, [roomId, sendLatestRead, markRoomReadInStore]);

    // Presence room:leave event
    useEffect(() => {
        return () => {
            if (isBrowser()) {
                try {
                    window.dispatchEvent(
                        new CustomEvent("chat:status-change", {
                            detail: {roomId, status: "room:leave"},
                        })
                    );
                } catch (e) {
                }
            }
        };
    }, [roomId]);

    return {sendLatestRead};
}
