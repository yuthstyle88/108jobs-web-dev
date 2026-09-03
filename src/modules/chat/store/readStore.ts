import { create } from 'zustand'
import { ChatRoomId, LocalUserId } from "@108-plaza/jh-client";
import {toMsNormalized} from "@/modules/chat/utils";
import {RoomView} from "@/modules/chat/types";

// Helper to normalize room id (string/number)
function normRoom(roomId: string | number): string {
    return String(roomId);
}

interface ReadStoreState {
    /** Unified map: key = `${roomId}:${userId}` */
    byRoomUser: Record<string, { lastReadAt?: string; lastReadMsgId?: string }>;

    // self-side (legacy API kept)
    setLastReadAt: (roomId: ChatRoomId, userId: LocalUserId, at: string | null | undefined) => void;
    getLastReadAt: (roomId: ChatRoomId, userId: LocalUserId) => string | undefined;

    // peer-side (use same map)
    setPeerLastReadAt: (roomId: ChatRoomId, userId: LocalUserId | number, at: string | null | undefined) => void;
    getPeerLastReadAt: (roomId: ChatRoomId, userId: LocalUserId | number) => string | undefined;

    // clear helpers
    clearRoom: (roomId: string) => void;
    clearAll: () => void;
}

export const useReadLastIdStore = create<ReadStoreState>((set, get) => ({
    byRoomUser: {},

    setLastReadAt: (roomId, userId, at) => {
        if (at == null) return; // ignore clears here to prevent accidental overwrites
        const k = `${normRoom(roomId)}:${String(userId)}`;
        const nextVal = String(at);
        const nextMs = toMsNormalized(nextVal);
        if (!Number.isFinite(nextMs) || nextMs <= 0) return;
        set((s) => {
            const prev = s.byRoomUser[k]?.lastReadAt;
            const prevMs = toMsNormalized(prev);
            // update only if strictly newer
            if (prevMs && nextMs <= prevMs) return s;
            return {
                byRoomUser: {
                    ...s.byRoomUser,
                    [k]: { ...s.byRoomUser[k], lastReadAt: nextVal },
                },
            };
        });
    },

    getLastReadAt: (roomId, userId) => {
        const k = `${normRoom(roomId)}:${String(userId)}`;
        return get().byRoomUser[k]?.lastReadAt;
    },

    setPeerLastReadAt: (roomId, userId, at) => {
        // Reuse the exact same guarded update logic
        // Peer & self share the same storage semantics
        const api: any = get();
        return api.setLastReadAt(roomId as any, userId as any, at as any);
    },

    getPeerLastReadAt: (roomId, userId) => {
        const k = `${normRoom(roomId)}:${String(userId)}`;
        return get().byRoomUser[k]?.lastReadAt;
    },

    clearRoom: (roomId) => {
        const rk = String(normRoom(roomId));
        set((s) => {
            const next = { ...s.byRoomUser };
            for (const k of Object.keys(next)) if (k.startsWith(`${rk}:`)) delete next[k];
            return { byRoomUser: next };
        });
    },

    clearAll: () => set({ byRoomUser: {} }),
}));

export function pruneReadLastByRooms(rooms: RoomView[]) {
    // Normalize all room IDs from nested `room.id`
    const allowed = new Set<string>(
        Array.isArray(rooms)
            ? rooms.map((r) => String(normRoom(r?.room?.id ?? "")))
            : []
    );

    const st = useReadLastIdStore.getState();
    const next: Record<string, { lastReadAt?: string; lastReadMsgId?: string }> = {};
    let changed = false;

    for (const [k, v] of Object.entries(st.byRoomUser)) {
        const [rk] = k.split(":"); // rk = room key
        if (allowed.has(String(rk))) {
            next[k] = v;
        } else {
            changed = true;
        }
    }

    if (changed) {
        useReadLastIdStore.setState({ byRoomUser: next });
    }
}

export async function clearRoom(roomId: string) {
    const rk = String(roomId);
    const st = useReadLastIdStore.getState();
    const next = { ...st.byRoomUser };
    for (const k of Object.keys(next)) if (k.startsWith(`${rk}:`)) delete next[k];
    useReadLastIdStore.setState({ byRoomUser: next });
}