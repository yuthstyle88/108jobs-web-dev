'use client';

import React, {createContext, useEffect, useMemo, useRef} from 'react';
import {useWebSocket} from '@/modules/chat/hooks/useWebSocket';
import {useUserStore} from '@/store/useUserStore';
import {UserService} from '@/services';
import {useRoomsStore} from '@/modules/chat/store/roomsStore';
import {callHttp, HttpService, REQUEST_STATE} from '@/services/HttpService';
import {hydrateUnread, useUnreadStore} from '@/modules/chat/store/unreadStore';
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {maybeHandlePresenceUpdate} from "@/modules/chat/utils";
import {usePresenceStore} from "@/modules/chat/store/presenceStore";
import {WS_EVENT} from "@/modules/chat/protocol/wireEvents";
import {PresenceSnapshotItem, PresenceStatus} from "@108-plaza/jh-client";

interface UserEventsContextValue {
    status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
    isReady: boolean;
    // We can add specific event listeners or methods here if needed
}

type UserEventEnvelope = {
    event?: string;
    payload?: {
        kind?: string;
        roomId?: string | number;
        unreadCount?: number;
        lastMessageAt?: string;
        senderId?: number;
    };
};

const UserEventsContext = createContext<UserEventsContextValue | undefined>(undefined);

export const UserEventsProvider: React.FC<React.PropsWithChildren> = ({children}) => {
    const {user} = useUserStore();
    const token = UserService.Instance.auth();
    const userId = user?.id;
    const roomFetchesRef = useRef(new Map<string, Promise<void>>());
    const requestGenerationRef = useRef(0);
    const unreadSnapshotHydratedRef = useRef(false);
    const liveUnreadBeforeSnapshotRef = useRef(new Set<string>());

    const wsOptions = useMemo(() => {
        if (!userId || !token) return null;
        return {
            token,
            senderId: Number(userId),
            // This channel is addressed by a namespace of its own rather than
            // a chat room id, so it overrides roomBuilder; roomId is still
            // required by the type and rides along in event payloads.
            roomId: String(userId),
            roomBuilder: (uid: string) => `user:${uid}:events`,
            // No join for this channel. The server keeps no join registry --
            // it decides whether a user-scoped frame is for this session by
            // parsing the id out of the topic and comparing it to the
            // session's authenticated user (PhoenixSession::should_deliver in
            // api-108heros). A join here would be a frame nobody reads.
            joinOnConnect: false,
            autoConnect: true,
            debug: process.env.NODE_ENV === 'development',
        };
    }, [userId, token]);

    // Only call useWebSocket if we have the necessary data
    // useWebSocket handles internal effects, but we pass null if not ready
    const ws = useWebSocket(wsOptions || {
        autoConnect: false,
        roomId: '',
        senderId: 0
    });
    const wsIsReady = ws.isReady;
    const addWsMessageListener = ws.addMessageListener;

    const value = useMemo(() => ({
        status: ws.status,
        isReady: ws.isReady,
    }), [ws.status, ws.isReady]);

    const {data: presenceRes, state: presenceState} = useHttpGet("getPresenceSnapshot");

    useEffect(() => {
        unreadSnapshotHydratedRef.current = false;
        liveUnreadBeforeSnapshotRef.current.clear();
        if (!userId || !token) return;

        let cancelled = false;
        HttpService.clearCacheEntry("getUnreadSnapshot");

        void callHttp("getUnreadSnapshot").then((snapshotResult) => {
            if (
                cancelled
                || snapshotResult.state !== REQUEST_STATE.SUCCESS
                || !Array.isArray(snapshotResult.data)
            ) {
                return;
            }

            const snapshot: Record<string, number> = {};
            snapshotResult.data.forEach((item) => {
                if (item.roomId) {
                    snapshot[String(item.roomId)] = item.unreadCount;
                }
            });

            const currentUnread = useUnreadStore.getState().perRoom;
            liveUnreadBeforeSnapshotRef.current.forEach((roomId) => {
                snapshot[roomId] = currentUnread[roomId] ?? 0;
            });
            hydrateUnread(snapshot);
            unreadSnapshotHydratedRef.current = true;
            liveUnreadBeforeSnapshotRef.current.clear();
        }).catch((error) => {
            console.error('[UserEvents] Failed to load unread snapshot:', error);
        });

        return () => {
            cancelled = true;
        };
    }, [token, userId]);

    useEffect(() => {
        const generation = ++requestGenerationRef.current;
        const roomFetches = roomFetchesRef.current;
        roomFetches.clear();

        return () => {
            if (requestGenerationRef.current === generation) {
                requestGenerationRef.current += 1;
            }
            roomFetches.clear();
        };
    }, [userId]);

    // Hydrate presence store from snapshot
    useEffect(() => {
        if (presenceState.state === REQUEST_STATE.SUCCESS && Array.isArray(presenceRes)) {
            const list = presenceRes.map((p: PresenceSnapshotItem) => ({
                userId: Number(p.userId),
                lastSeenAt: p.status === PresenceStatus.Online
                    ? (p.at ? new Date(p.at).getTime() : Date.now())
                    : (p.lastSeen ? new Date(p.lastSeen).getTime() : 0)
            }));
            usePresenceStore.getState().setSnapshot(list);
        }
    }, [presenceRes, presenceState.state]);

    useEffect(() => {
        if (!wsIsReady) return;

        const generation = requestGenerationRef.current;
        const roomFetches = roomFetchesRef.current;
        const isCurrentRequest = () => requestGenerationRef.current === generation;

        const handleUserEvent = async (data: unknown) => {
            const eventData = data as UserEventEnvelope;
            console.log('[UserEvents] Received message:', eventData);

            if (eventData?.event !== WS_EVENT.ChatsSignal) return;

            const payload = eventData.payload;
            const meId = Number(userId);

            if (payload?.kind === 'chat') {
                const {roomId, unreadCount, lastMessageAt, senderId} = payload;
                if (roomId && senderId !== undefined) {
                    const normalizedRoomId = String(roomId);
                    if (typeof unreadCount === 'number') {
                        if (!unreadSnapshotHydratedRef.current) {
                            liveUnreadBeforeSnapshotRef.current.add(normalizedRoomId);
                        }
                        useRoomsStore.getState().setUnread(normalizedRoomId, unreadCount);
                    }

                    const currentStore = useRoomsStore.getState();
                    if (!currentStore.getRoom(normalizedRoomId)) {
                        let roomFetch = roomFetches.get(normalizedRoomId);
                        if (!roomFetch) {
                            const request = (async () => {
                                const roomResult = await callHttp("getChatRoom", normalizedRoomId);
                                if (!isCurrentRequest()) return;

                                const latestStore = useRoomsStore.getState();
                                if (
                                    roomResult.state === REQUEST_STATE.SUCCESS
                                    && roomResult.data?.room
                                    && !latestStore.getRoom(normalizedRoomId)
                                ) {
                                    latestStore.upsertRoom({
                                        ...roomResult.data.room,
                                        isActive: String(latestStore.activeRoomId) === normalizedRoomId,
                                    }, true);
                                }
                            })();
                            const trackedRequest = request.finally(() => {
                                if (roomFetches.get(normalizedRoomId) === trackedRequest) {
                                    roomFetches.delete(normalizedRoomId);
                                }
                            });
                            roomFetch = trackedRequest;
                            roomFetches.set(normalizedRoomId, trackedRequest);
                        }
                        await roomFetch;
                    }

                    if (!isCurrentRequest()) return;

                    // If we have lastMessageAt, update metadata.
                    // Only bump if the room is NOT active.
                    const store = useRoomsStore.getState();
                    const isActive = String(store.activeRoomId) === normalizedRoomId;

                    if (lastMessageAt) {
                        store.updateLastMessage(
                            normalizedRoomId,
                            Number(senderId),
                            lastMessageAt,
                            !isActive
                        );
                    } else if (!isActive) {
                        store.bumpRoomToTop(normalizedRoomId);
                    }
                }
            }

            await maybeHandlePresenceUpdate(eventData, meId);
        };

        const unsubscribe = addWsMessageListener((data: unknown) => {
            void handleUserEvent(data).catch((error) => {
                console.error('[UserEvents] Failed to process message:', error);
            });
        });

        return () => {
            unsubscribe();
        };
    }, [wsIsReady, addWsMessageListener, userId]);

    return (
        <UserEventsContext.Provider value={value}>
            {children}
        </UserEventsContext.Provider>
    );
};
