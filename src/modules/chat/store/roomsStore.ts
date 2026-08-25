import {create} from 'zustand';

import {useUnreadStore} from '@/modules/chat/store/unreadStore';
import {useReadLastIdStore} from "@/modules/chat/store/readStore";
import {ChatParticipantView, LocalUserId} from "108heros-client";
import {RoomView} from "@/modules/chat/types";

// Utility functions for store interactions
const sortRooms = (rooms: RoomView[]) => {
    return [...rooms].sort((a, b) => {
        const aDate = new Date(a.lastMessageAt || a.lastMessage?.createdAt || a.room.createdAt).getTime();
        const bDate = new Date(b.lastMessageAt || b.lastMessage?.createdAt || b.room.createdAt).getTime();
        return bDate - aDate;
    });
};

const unreadStoreUtils = {
    getState: () => useUnreadStore.getState(),
    pruneByRooms: async (rooms: RoomView[]) => {
        try {
            const {pruneUnreadByRooms} = await import('@/modules/chat/store/unreadStore');
            if (typeof pruneUnreadByRooms === 'function') {
                pruneUnreadByRooms(rooms);
            }
        } catch {
        }
    },
    removeRoom: (roomId: string) => {
        const state = useUnreadStore.getState();
        if (typeof state.removeRoom === 'function') {
            state.removeRoom(roomId);
        }
    },
    resetRoom: (roomId: string) => {
        const state = useUnreadStore.getState();
        if (typeof state.reset === 'function') {
            state.reset(roomId);
        } else if (typeof state._setCount === 'function') {
            state._setCount(roomId, 0);
        }
    },
    setCount: (roomId: string, count: number) => {
        const state = useUnreadStore.getState();
        const val = Math.max(0, Number(count) || 0);
        if (typeof state._setCount === 'function') {
            state._setCount(roomId, val);
        } else if (val === 0 && typeof state.reset === 'function') {
            state.reset(roomId);
        }
    },
    incrementCount: (roomId: string, delta: number) => {
        const state = useUnreadStore.getState();
        const step = Number.isFinite(delta) ? Number(delta) : 1;
        if (typeof state._inc === 'function') {
            state._inc(roomId, step);
        } else if (typeof state._setCount === 'function') {
            const cur = Math.max(0, Number(state?.perRoom?.[roomId]) || 0);
            state._setCount(roomId, Math.max(0, cur + step));
        }
    },
    getUnreadCount: (roomId: string) => {
        const state = useUnreadStore.getState();
        const cur = state?.perRoom?.[roomId];
        return Math.max(0, Number(cur) || 0);
    }
};

const readLastIdStoreUtils = {
    getState: () => useReadLastIdStore.getState(),
    pruneByRooms: async (rooms: RoomView[]) => {
        try {
            const {pruneReadLastByRooms} = await import('@/modules/chat/store/readStore');
            if (typeof pruneReadLastByRooms === 'function') {
                pruneReadLastByRooms(rooms);
            }
        } catch {
        }
    },
    clearRoom: async (roomId: string) => {
        try {
            const {clearRoom} = await import('@/modules/chat/store/readStore');
            if (typeof clearRoom === 'function') {
                await clearRoom(roomId);
            }
        } catch {
        }
    },
    setPeerLastAt: (roomId: string, userId: number, timestamp: string) => {
        const state = useReadLastIdStore.getState();
        if (typeof state.setPeerLastReadAt === 'function') {
            state.setPeerLastReadAt(roomId, userId, timestamp);
        }
    }
};


export type RoomsState = {
    // state
    rooms: RoomView[];
    activeRoomId: string | null;
    wasUnreadPerRoom: Record<string, boolean>;
    nextPage: string | null;

    // basic mutators (kept for backward compatibility)
    setRooms: (rooms: RoomView[]) => void;
    addRoom: (room: RoomView) => void;
    removeRoom: (roomId: string) => void;
    /** Mark room as read: set unreadCount=0 and (optionally) sync readLastId to lastMessageId */
    markRoomRead: (roomId: string) => void;
    setActiveRoomId: (roomId: string | null) => void;
    /** Move a room to the top of the list (e.g., new message or focus) */
    bumpRoomToTop: (roomId: string) => void;
    /** Upsert room by id */
    upsertRoom: (room: RoomView, shouldBump?: boolean) => void;
    /** Get an immutable snapshot of all rooms */
    getRooms: () => RoomView[];
    /** Get a single room by id */
    getRoom: (roomId: string) => RoomView | undefined;
    /** Filter by room name (case-insensitive, partial match) */
    getRoomsByFilter: (query: string) => RoomView[];
    /** Active room id (derived) */
    getActiveRoomId: () => string | null;
    /** Active room (derived) */
    getActiveRoom: () => RoomView | undefined;
    /** Check if a given room is active */
    isActive: (roomId: string) => boolean;
    /** Update last message metadata */
    updateLastMessage: (
        roomId: string,
        readerUserId: number,
        lastMessageAt?: string,
        shouldBump?: boolean
    ) => void;
    /** Set unread count (delegates to unreadStore; roomsStore won't own the value) */
    setUnread: (roomId: string, count: number) => void;
    /** Increment unread count by delta (delegates to unreadStore) */
    incrementUnread: (roomId: string, delta?: number) => void;
    /** Read unread count from unreadStore (single source of truth) */
    getUnread: (roomId: string) => number;
    /** Find a room by participant id */
    findByParticipant: (participantId: number) => RoomView | undefined;
    findPartner: (roomId: string, currentUserId?: LocalUserId) => ChatParticipantView | undefined;

    markWasUnread: (roomId: string) => void;
    clearWasUnread: (roomId: string) => void;
    wasUnread: (roomId: string) => boolean;

    setPagination: (nextPage: string | null) => void;
    appendRooms: (rooms: RoomView[]) => void;

    /** Reset the store to initial (clear rooms) */
    reset: () => void;
};

export const useRoomsStore = create<RoomsState>((set, get) => ({
    rooms: [],
    activeRoomId: null,
    isHydrated: false,
    wasUnreadPerRoom: {},
    nextPage: null,

    // ——— Basic mutators (BC) ———
    setRooms: (rooms) => {
        const next = Array.isArray(rooms) ? sortRooms(rooms) : [];
        set({rooms: next});
        // Prune child stores to avoid stale entries
        unreadStoreUtils.pruneByRooms(next);
        readLastIdStoreUtils.pruneByRooms(next);
    },
    addRoom: (room) =>
        set((s) => ({
            rooms: s.rooms.some((r) => r.room.id === room.room.id)
                ? s.rooms
                : sortRooms([...s.rooms, room])
        })),
    removeRoom: (roomId) => {
        set((s) => ({
            rooms: s.rooms.filter((r) => r.room.id !== roomId),
            wasUnreadPerRoom: Object.fromEntries(
                Object.entries(s.wasUnreadPerRoom).filter(([id]) => id !== roomId)
            ),
        }));
        unreadStoreUtils.removeRoom(roomId);
        readLastIdStoreUtils.clearRoom(roomId);
    },
    // Delegate read-marking to unreadStore (roomsStore no longer owns unread counts)
    markRoomRead: (roomId) => {
        unreadStoreUtils.resetRoom(roomId);
    },
    setActiveRoomId: (roomId) =>
        set((s) => ({
            activeRoomId: roomId,
            rooms: s.rooms.map((roomView) => ({
                ...roomView,
                isActive: roomView.room.id === roomId,
            })),
        })),
    bumpRoomToTop: (roomId: string) => {
        set((s) => {
            const idx = s.rooms.findIndex((r) => r.room.id === roomId);
            if (idx === -1) return s; // room not found, no change
            const bumped = s.rooms[idx];
            const rest = s.rooms.filter((_, i) => i !== idx);
            return {rooms: [bumped, ...rest]};
        });
    },

    upsertRoom: (room, shouldBump = true) => {
        set((s) => ({
            rooms: s.rooms.some((r) => r.room.id === room.room.id)
                ? sortRooms(s.rooms.map((r) => (r.room.id === room.room.id ? {...r, ...room} : r)))
                : sortRooms([...s.rooms, room]),
        }));
    },

    getRooms: () => get().rooms.slice(),

    getRoom: (roomId) => get().rooms.find((r) => r.room.id === roomId),

    getRoomsByFilter: (query: string) => {
        const q = (query ?? '').trim().toLowerCase();
        if (!q) return get().rooms.slice();
        return get().rooms.filter((r) => r.room.roomName?.toLowerCase().includes(q));
    },

    getActiveRoomId: () => get().activeRoomId,

    getActiveRoom: () => {
        const id = get().activeRoomId;
        return id ? get().rooms.find((r) => r.room.id === id) : undefined;
    },

    isActive: (roomId) => !!get().rooms.find((r) => r.room.id === roomId && r.isActive),

    updateLastMessage: (roomId, readerUserId, lastMessageAt, shouldBump = true) => {
        // update room metadata for display (only lastMessageAt is kept)
        set((s) => {
            const isRoomActive = String(s.activeRoomId) === String(roomId);
            const nextRooms = s.rooms.map((r) =>
                r.room.id === roomId
                    ? {
                        ...r,
                        lastMessageAt: lastMessageAt ?? r.lastMessage?.createdAt,
                        // Ensure lastMessage structure is updated too for components relying on it
                        lastMessage: r.lastMessage ? {
                            ...r.lastMessage,
                            createdAt: lastMessageAt ?? r.lastMessage.createdAt
                        } : undefined
                    }
                    : r
            );

            // If the room is NOT active, we apply global sorting (which might move it)
            // If the room IS active, we keep the current list order to prevent the room from jumping while the user is looking at it
            return {
                rooms: isRoomActive ? nextRooms : sortRooms(nextRooms)
            };
        });

        // forward who-read info to readLastIdStore
        if (readerUserId != null && lastMessageAt) {
            readLastIdStoreUtils.setPeerLastAt(roomId, readerUserId, lastMessageAt);
        }
    },

    // Delegate unread mutations to unreadStore to avoid duplication
    setUnread: (roomId, count) => {
        unreadStoreUtils.setCount(roomId, count);
        if (count > 0) {
            set((s) => ({
                wasUnreadPerRoom: {...s.wasUnreadPerRoom, [roomId]: true},
            }));
        }
    },

    incrementUnread: (roomId, delta = 1) => {
        unreadStoreUtils.incrementCount(roomId, delta);
        if (delta > 0) {
            set((s) => ({
                wasUnreadPerRoom: {...s.wasUnreadPerRoom, [roomId]: true},
            }));
        }
    },

    getUnread: (roomId) => {
        return unreadStoreUtils.getUnreadCount(roomId);
    },

    findByParticipant: (participantId) => {
        const pid = Number(participantId);
        if (!Number.isFinite(pid)) return undefined;
        return get().rooms.find((r) => {
            const participants = r.participants ?? [];
            return participants.some((p) => {
                const mid = p?.id;
                return mid != null && Number(mid) === pid;
            });
        });
    },

    findPartner: (roomId: string, currentUserId?: LocalUserId) => {
        const room = get().rooms.find(r => r.room.id === roomId);
        if (!room) return undefined;
        const participants = room.participants ?? [];
        return participants.find((p) => {
            const memberId = p?.id;
            return memberId != null && memberId !== currentUserId;
        });
    },

    markWasUnread: (roomId) =>
        set((s) => ({
            wasUnreadPerRoom: {...s.wasUnreadPerRoom, [roomId]: true},
        })),

    clearWasUnread: (roomId) =>
        set((s) => ({
            wasUnreadPerRoom: {...s.wasUnreadPerRoom, [roomId]: false},
        })),

    wasUnread: (roomId) => get().wasUnreadPerRoom?.[roomId],

    setPagination: (nextPage) => set({nextPage}),
    appendRooms: (rooms) => {
        const existing = get().rooms;
        const newRooms = rooms.filter(nr => !existing.some(er => er.room.id === nr.room.id));
        if (newRooms.length > 0) {
            set({rooms: sortRooms([...existing, ...newRooms])});
        }
    },

    reset: () => set({rooms: [], wasUnreadPerRoom: {}, activeRoomId: null, nextPage: null}),
}));
