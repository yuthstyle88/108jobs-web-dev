// src/modules/chat/store/chatStore.ts
import {create} from 'zustand'
import {ChatMessage, ChatStatus} from '@108-plaza/jh-client'
import {normRoom} from "@/utils/helpers";
import {useReadLastIdStore} from "@/modules/chat/store/readStore";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {isBrowser} from "@/utils";

// Utility function for read-last-id store interaction
const readLastIdUtils = {
    setLastReadAt: (roomId: string, senderId: number, createdAt: string) => {
        try {
            const state = useReadLastIdStore.getState();
            if (typeof state.setLastReadAt === 'function') {
                state.setLastReadAt(roomId, senderId, createdAt);
            }
        } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.debug('[chatStore.readLastIdUtils] setLastReadAt failed', e);
            }
        }
    }
};


// --- local pure helpers (no Zustand refs) ---
function mergeIntoMessages(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
    const k = String(msg.id);
    const map = new Map(list.map(m => [String(m.id), m]));
    const prev = map.get(k);
    map.set(k, prev ? {...prev, ...msg} : msg);
    return Array.from(map.values());
}

function removeAt<T>(arr: T[], index: number): T[] {
    if (index < 0 || index >= arr.length) return arr.slice();
    return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

function flushByStatus(
    getFn: () => ChatStoreState & ChatStoreActions,
    status: ChatStatus,
    roomId?: string
): ChatMessage[] {
    const {listMessages, retryMeta} = getFn();
    const now = Date.now();
    const norm = roomId ? normRoom(String(roomId)) : undefined;
    return listMessages.filter((m: any) => {
        const isRoomOk = !norm || normRoom(String(m.roomId)) === norm;
        const isStatus = m.status === status;
        const meta = retryMeta[String(m.id)];
        const due = !meta || meta.next <= now;
        return isRoomOk && isStatus && due;
    });
}

type RetryMeta = Record<string, { retry: number; next: number }>

interface ChatStoreState {
    retryMeta: RetryMeta
    listMessages: ChatMessage[]
    messagesByRoom: Record<string, ChatMessage[]>;
}

interface ChatStoreActions {
    addMessage: (msg: ChatMessage) => void
    upsertHistory: (roomId: string, items: ChatMessage[]) => void;
    upsertMessage: (msg: ChatMessage) => void
    addSending: (msg: ChatMessage) => void
    removeSending: (roomId: string, id: string) => void;
    promoteToDelivered: (roomId: string, id: string) => void;
    markFailed: (roomId: string, id: string) => void;
    upsertRetryMeta: (id: string, meta: { retry: number; next: number }) => void
    dropRetryMeta: (id: string) => void
    getByRoom: (roomId: string) => ChatMessage[]
    getMessageById: (id: string) => ChatMessage | undefined
    commitStatus: (roomId: string, id: string, status: ChatStatus) => void;
    retryMessage: (id: string) => void
    flushFailed: (roomId?: string) => ChatMessage[]
    removeMessage: (roomId: string, id: string) => void;
    addSendingMessage: (msg: ChatMessage) => void
    clearSendingMessages: (roomId: string) => void;
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>((set, get) => ({
    retryMeta: {},
    listMessages: [],
    messagesByRoom: {},

    addMessage: (msg) => {
        if (!msg?.roomId) return;
        const roomId = normRoom(String(msg.roomId));

        if (isBrowser() && msg.senderId && msg.createdAt) {
            const ts = Date.parse(String(msg.createdAt));
            if (Number.isFinite(ts)) {
                try {
                    useReadLastIdStore.getState().setLastReadAt?.(
                        roomId,
                        msg.senderId,
                        msg.createdAt
                    );
                } catch {
                }

                // Update room list's last message time to allow sorting by newest
                try {
                    const roomsStore = useRoomsStore.getState();
                    const isRoomActive = String(roomsStore.activeRoomId) === String(roomId);
                    // Explicitly pass true for shouldBump if not active, or if it's our own message being added
                    // Actually, if we're adding a message, it's ALWAYS activity, so we should bump if not active.
                    // If it is active, we don't bump to avoid UI jump.
                    roomsStore.updateLastMessage?.(roomId, msg.senderId, msg.createdAt, !isRoomActive);
                } catch {
                }
            }
        }

        set((s) => {
            const existing = s.messagesByRoom[roomId] ?? [];
            const exists = existing.some((m) => String(m.id) === String(msg.id));
            const next = exists
                ? existing.map((m) =>
                    String(m.id) === String(msg.id) ? {...m, ...msg} : m
                )
                : [...existing, msg];
            return {
                messagesByRoom: {...s.messagesByRoom, [roomId]: next},
            };
        });
    },

    upsertHistory: (roomId, items) => {
        if (!Array.isArray(items) || items.length === 0) return;

        set((s) => {
            const existing = s.messagesByRoom[roomId] ?? [];

            // create lookup for quick deduplication
            const existingIds = new Set(existing.map((m) => String(m.id)));

            // keep only unique messages
            const uniqueNew = items.filter((m) => !existingIds.has(String(m.id)));

            if (uniqueNew.length === 0) return s;

            // merge and sort chronologically (oldest → newest)
            const merged = [...existing, ...uniqueNew].sort((a, b) => {
                const ta = new Date(a.createdAt).getTime();
                const tb = new Date(b.createdAt).getTime();
                return ta - tb;
            });

            return {
                messagesByRoom: {
                    ...s.messagesByRoom,
                    [roomId]: merged,
                },
            };
        });
    },

    upsertMessage: (msg) => get().addMessage(msg),

    addSending: (msg) => {
        const withPending = {
            ...(msg as any),
            clientId: (msg as any).id,
            isOwner: true,
            status: 'sending' as ChatStatus
        } as ChatMessage;
        get().addMessage(withPending);
    },

    removeSending: (roomId, id) =>
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.filter(
                    (m) => String(m.id) !== String(id)
                ),
            },
        })),


    promoteToDelivered: (roomId, id) => {
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.map((m) =>
                    (String(m.id) === String(id) || (m as any).clientId === String(id))
                        ? {...m, status: "delivered" as ChatStatus}
                        : m
                ),
            },
        }));
    },

    markFailed: (roomId, id) =>
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.map((m) =>
                    String(m.id) === String(id)
                        ? {...m, status: "failed" as ChatStatus}
                        : m
                ),
            },
        })),

    upsertRetryMeta: (id, meta) =>
        set((s) => ({retryMeta: {...s.retryMeta, [id]: meta}})),

    dropRetryMeta: (id) =>
        set((s) => {
            const meta = {...s.retryMeta}
            delete meta[id]
            return {retryMeta: meta}
        }),

    getByRoom: (roomId) => get().messagesByRoom[roomId] ?? [],

    getMessageById: (id) => get().listMessages.find(m => String(m.id) === String(id)),

    commitStatus: (roomId, id, status) =>
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.map((m) =>
                    (String(m.id) === String(id) || (m as any).clientId === String(id)) ? {...m, status} : m
                ),
            },
        })),

    retryMessage: (id) => set((s) => {
        const cur = s.retryMeta[id] ?? {retry: 0, next: 0};
        const retry = cur.retry + 1;
        const delay = Math.min(60000, Math.round(1500 * Math.pow(2, retry)));
        const nextTime = Date.now() + delay;
        return {
            listMessages: s.listMessages.map((m) =>
                String(m.id) === String(id) ? ({...m, status: 'retrying' as ChatStatus} as ChatMessage) : m
            ),
            retryMeta: {...s.retryMeta, [id]: {retry, next: nextTime}},
        };
    }),

    flushFailed: (roomId) => flushByStatus(get, 'failed', roomId),

    removeMessage: (roomId, id) =>
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.filter(
                    (m) => String(m.id) !== String(id)
                ),
            },
        })),

    addSendingMessage: (msg) => get().addSending(msg),
    clearSendingMessages: (roomId) =>
        set((s) => ({
            messagesByRoom: {
                ...s.messagesByRoom,
                [roomId]: s.messagesByRoom[roomId]?.filter(
                    (m) =>
                        m.status !== "sending" &&
                        m.status !== "retrying" &&
                        m.status !== "failed"
                ),
            },
        })),

}))