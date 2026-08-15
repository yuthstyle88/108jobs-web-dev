import {useCallback, useEffect, useRef, useState} from 'react';
// IMPORTANT: Adjust the import path if your service lives elsewhere
import {getChannelAdapter} from '@/modules/chat/services/ChatSocketService';
import {WS_EVENT} from '@/modules/chat/protocol/wireEvents';
import {WebSocketStatus} from "@/modules/chat/types";
import {onReadReceipt} from '@/modules/chat/events/chatEvents';
import {useReadLastIdStore} from '@/modules/chat/store/readStore';

export interface UseWebSocketOptions {
    // การยืนยันตัวตน/สโคป
    token?: string | null;
    roomId: string;
    senderId: number;
    // การเชื่อมต่อ
    autoConnect?: boolean;               // default: true
    // NOTE: autoJoin only runs when the underlying adapter sets `requiresManualJoin === true`
    autoJoin?: boolean;                  // default: true
    // ปิด/เปิดการ join room จาก hook นี้ (ค่าเริ่มต้น: ปิด)
    allowJoin?: boolean;
    // Reconnection settings
    reconnectOnVisible?: boolean;           // default: true - reconnect when tab becomes visible or window gains focus
    // Inactivity timeout settings
    inactivityTimeout?: number;          // default: 300000ms (5 minutes) - disconnect after no typing activity
    disableInactivityTimeout?: boolean;  // default: false - set to true to disable inactivity timeout

    /** Maps a room id to the wire address the socket attaches to. Defaults to
     * identity (v2 sends the bare room id); the per-user event channel
     * overrides it with `user:<id>:events`. Was `topicBuilder`. */
    roomBuilder?: (roomId: string) => string;
    /** Whether to send a `join` once the socket opens. Default true. The
     * per-user event channel sets it false: the server keeps no join
     * registry and gates user-scoped delivery on the id in the topic, so a
     * join there is a frame nobody reads. */
    joinOnConnect?: boolean;

    // callbacks ระดับ socket (ดิบ)
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: unknown) => void;
    onMessage?: (data: unknown) => void;
    onNewMessage?: (data: any) => void;
    onTyping?: (data: any) => void;
    onInactivityTimeout?: () => void;    // callback when inactivity timeout triggers
    // แผนที่ event → handler (ยืดหยุ่นกว่า onNewMessage/onTyping แบบ fix ชื่อ)
    eventHandlers?: Record<string, (payload: any) => void>; // e.g. {message: fn, typing: fn}

    debug?: boolean;
}

export interface WebSocketAPI {
    status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
    isReady: boolean;
    /** The wire address this connection is attached to -- the bare room id
     * for chat. Was `topic` while the wire used Phoenix channel topics. */
    room?: string;

    // The channel adapter currently built for this connection (see
    // ChatSocketService.getChannelAdapter), or null when not connected.
    // Reflects the current adapterRef.current across reconnects: it's
    // re-read from the return statement below on every render, and adapter
    // changes are always accompanied by a status/room state update (see
    // connect()), so it stays current the same way status/room already do.
    adapter?: any;

    // ควบคุมการเชื่อมต่อ/เข้าช่อง
    connect: () => void;
    disconnect: () => void;
    join: (params?: { roomId: string; senderId: number }) => Promise<void> | void;
    leave: () => Promise<void> | void;

    // สั่งงานดิบ
    emit: (event: string, payload: any) => Promise<void> | void;

    addMessageListener: (cb: (data: unknown) => void) => () => void;

    // Reset inactivity timer (call on typing or other user activity)
    resetInactivityTimer: () => void;
}

/**
 * React Hook that bridges to your ChatSocketService adapter.
 * It assumes the adapter behaves like a WebSocket/Channel bridge with
 * optional methods: connect(), disconnect()/close(), join(), leave(), emit().
 */
export function useWebSocket(options: Partial<UseWebSocketOptions> = {}): WebSocketAPI {
    const {
        token,
        roomId,
        senderId,
        autoConnect = true,
        autoJoin = true,
        reconnectOnVisible = true,
        inactivityTimeout = 300000,        // 5 minutes default
        disableInactivityTimeout = false,
        // wire v2 addresses a room by its bare id -- the `room:` topic prefix
        // went out with the Phoenix channel envelope. Consumers that speak to
        // a different namespace (the per-user event channel) still override it.
        roomBuilder = (roomId: string) => roomId,
        joinOnConnect = true,
        onOpen,
        onClose,
        onError,
        onMessage,
        onNewMessage,
        onTyping,
        onInactivityTimeout,
        eventHandlers,
        debug,
    } = options;

    const adapterRef = useRef<any | null>(null);
    const listenersRef = useRef<Set<(data: unknown) => void>>(new Set());
    const [status, setStatus] = useState<WebSocketStatus>('idle');
    const [room, setRoom] = useState<string | undefined>(undefined);

    // Inactivity timeout state
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityTimeRef = useRef<number>(Date.now());
    const disconnectRef = useRef<(() => void) | null>(null);

    const log = (...args: unknown[]) => {
        if (debug) console.log('[useWebSocket]', ...args);
    };

    // Clear inactivity timer
    const clearInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, []);

    // Start inactivity timeout
    const startInactivityTimer = useCallback(() => {
        if (disableInactivityTimeout) return;
        if (status !== 'connected') return;

        clearInactivityTimer();
        lastActivityTimeRef.current = Date.now();

        inactivityTimerRef.current = setTimeout(() => {
            log('inactivity timeout reached - disconnecting');
            try {
                onInactivityTimeout?.();
            } catch {
            }
            // Use ref to avoid circular dependency
            if (disconnectRef.current) {
                disconnectRef.current();
            }
        }, inactivityTimeout);

        log(`inactivity timer started (${inactivityTimeout}ms)`);
    }, [disableInactivityTimeout, status, inactivityTimeout, onInactivityTimeout, clearInactivityTimer]);

    // Reset inactivity timer (call on any user activity)
    const resetInactivityTimer = useCallback(() => {
        if (disableInactivityTimeout) return;
        if (status !== 'connected') return;

        lastActivityTimeRef.current = Date.now();
        startInactivityTimer();
    }, [disableInactivityTimeout, status, startInactivityTimer]);

    const bindAdapterHandlers = useCallback((adapter: any) => {
        if (!adapter) return;

        // Avoid double-binding on the same adapter instance
        if ((adapter as any).__ws_bound) return;
        (adapter as any).__ws_bound = true;

        // store heartbeat timer per adapter instance
        let heartbeatTimer: NodeJS.Timeout | null = null;

        const startHeartbeat = () => {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                if (adapter.readyState === 1 && typeof adapter.sendHeartbeat === "function") {
                    adapter.sendHeartbeat();
                }
            }, 20_000);
        };

        // Wire base-level handlers. Reconnection for transient drops is
        // ChatSocket's job (it retries silently on its own) -- onclose only
        // ever reaches here for a close ChatSocket has already decided is
        // terminal (client-initiated, or a policy/expired-token rejection),
        // and onerror precedes drops ChatSocket is already retrying. These
        // are notify-the-app callbacks only, not a second reconnect trigger.
        if ('onopen' in adapter) {
            adapter.onopen = () => {
                setStatus('connected');
                onOpen?.();
                log('onopen');

                // Start inactivity timer on successful connection
                startInactivityTimer();
                startHeartbeat();
            };
        }
        if ('onclose' in adapter) {
            adapter.onclose = () => {
                setStatus('disconnected');
                onClose?.();
                log('onclose');
            };
        }
        if ('onerror' in adapter) {
            adapter.onerror = (e: unknown) => {
                setStatus('error');
                onError?.(e);
                log('onerror', e);
            };
        }
        if ('onmessage' in adapter) {
            adapter.onmessage = (evt: any) => {
                const data = evt?.data ?? evt; // handle both {data} or raw
                let parsed: any = data;
                try {
                    parsed = typeof data === 'string' ? JSON.parse(data) : data;
                } catch {
                }

                // Reset inactivity timer on any message activity
                resetInactivityTimer();

                // top-level raw handler
                try {
                    onMessage?.(parsed);
                } catch {
                }

                // fan-out to local subscribers
                try {
                    listenersRef.current.forEach(fn => {
                        try {
                            fn(parsed);
                        } catch {
                        }
                    });
                } catch {
                }

                // event routing
                try {
                    const evName = (parsed && (parsed.event || parsed.type)) as string | undefined;
                    const payload = (parsed && (parsed.payload ?? parsed.data)) as any;
                    if (evName) {
                        // specific convenience callbacks
                        if (evName === WS_EVENT.Message) {
                            try {
                                onNewMessage?.(payload);
                            } catch {
                            }
                        } else if (evName === WS_EVENT.Typing) {
                            try {
                                onTyping?.(payload);
                            } catch {
                            }
                        }
                        // flexible map-based handlers
                        if (eventHandlers && typeof eventHandlers[evName] === 'function') {
                            eventHandlers[evName](payload);
                        }
                    }
                } catch {
                }
            };
        }
    }, [onOpen, onClose, onError, onMessage, onNewMessage, onTyping, eventHandlers, debug, startInactivityTimer, resetInactivityTimer]);

    const connect = useCallback(() => {
        if (!autoConnect) {
            setStatus('idle');
            return;
        }
        if (!token || !roomId) {
            setStatus('idle');
            return;
        }

        const nextRoom = roomBuilder(roomId);

        // Fast path: if current adapter is connected for the same room, do nothing
        const current = adapterRef.current as any;
        if (current && status === 'connected' && room === nextRoom) {
            log('connect skipped (already connected to same room)');
            return;
        }

        // Teardown existing adapter (if any) before reconnecting
        if (current) {
            try {
                current.close?.();
            } catch {
            }
            try {
                current.disconnect?.();
            } catch {
            }
        }

        setStatus('connecting');
        if (room !== nextRoom) setRoom(nextRoom);
        const adapter = getChannelAdapter(token, nextRoom, roomId, Number(senderId) ?? 0, {joinOnConnect});
        adapterRef.current = adapter;
        bindAdapterHandlers(adapter);
    }, [token, roomId, senderId, autoConnect, roomBuilder, joinOnConnect, bindAdapterHandlers, status, room]);

    const disconnect = useCallback(() => {
        const a = adapterRef.current;
        if (!a) return;

        // Clear inactivity timer
        clearInactivityTimer();

        try {
            a?.close?.();
        } catch {
        }
        try {
            a?.disconnect?.();
        } catch {
        }
        adapterRef.current = null;
        setStatus('disconnected');
        // Do not call onClose here; adapter.onclose will invoke it to avoid duplicates
        log('disconnect');
    }, [clearInactivityTimer]);

    const join = useCallback(async (params?: { roomId: string; senderId: number }) => {
        const a = adapterRef.current;
        if (!a) return;
        const rid = params?.roomId ?? roomId;
        if (!rid) return;
        const sid = params?.senderId ?? senderId;
        if (sid === undefined) return;
        const t = roomBuilder(rid);

        // Prevent duplicate join attempts for same room; delegate actual join to ChatSocketService
        if ((a as any).__joinedRoom === t) {
            if (debug) console.log('[useWebSocket] join skipped (already marked joined):', t);
            return;
        }
        (a as any).__joinedRoom = t;
        if (debug) console.log('[useWebSocket] join delegated to adapter/service for room:', t, {
            roomId: rid,
            senderId: sid
        });

        // Intentionally no direct join here to avoid double joins.
        return;
    }, [roomId, roomBuilder, senderId, debug]);

    const leave = useCallback(async () => {
        const a = adapterRef.current;
        if (!a) return;
        const rid = roomId;
        if (!rid) return;
        const t = roomBuilder(rid);
        if (typeof a.leave === 'function') {
            return await a.leave(t);
        }
        if (typeof a.emit === 'function') {
            // v2: the room rides in the envelope's `room` field, which the
            // adapter fills in from the channel -- the payload no longer
            // repeats it under a `topic` key.
            return await a.emit(WS_EVENT.Leave, {roomId: t});
        }
    }, [roomId, roomBuilder]);

    const emit = useCallback(async (event: string, payload: any) => {
        const a = adapterRef.current;
        if (!a) return;
        try {
            return await a.emit?.(event, payload);
        } catch (e) {
            log('emit error', {event, e});
        }
    }, []);

    const addMessageListener = useCallback((cb: (data: unknown) => void) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
    }, []);

    useEffect(() => {
        if (!autoConnect || !token || !roomId) {
            setStatus('idle');
            return;
        }
        connect();
        return () => {
            const a = adapterRef.current;
            if (a) {
                // For cleanup on unmount, we want a "silent" disconnect
                // that doesn't mark it as manual so that if we remount quickly
                // (due to React StrictMode or navigation) it can reconnect.
                clearInactivityTimer();
                try {
                    a.close?.();
                } catch {
                }
                try {
                    a.disconnect?.();
                } catch {
                }
                adapterRef.current = null;
                setStatus('disconnected');
            }
        };
    }, [autoConnect, token, roomId]);

    // Reconnect when the tab becomes visible or window gains focus
    useEffect(() => {
        if (!reconnectOnVisible) return;

        const tryConnect = () => {
            if (
                autoConnect &&
                document.visibilityState === 'visible' &&
                token &&
                roomId &&
                status !== 'connected'
            ) {
                connect();
            }
        };

        const onVisibility = () => tryConnect();
        const onFocus = () => tryConnect();

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onFocus);
        };
    }, [reconnectOnVisible, autoConnect, token, roomId, status, connect]);

    useEffect(() => {
        if (!autoJoin || status !== 'connected') return;
        if (!roomId) return;
        const a = adapterRef.current as any;
        // Only adapters that declare they require manual join will be joined here.
        if (a && a.requiresManualJoin === true) {
            if (roomId && typeof senderId === 'number') {
                void join({roomId, senderId});
            }
        }
    }, [autoJoin, status, roomId, senderId, join]);

    // Set up disconnect ref for inactivity timer
    useEffect(() => {
        disconnectRef.current = disconnect;
    }, [disconnect]);

    // Cleanup inactivity timer on unmount
    useEffect(() => {
        return () => {
            clearInactivityTimer();
        };
    }, [clearInactivityTimer]);

    // Wire read-receipt -> readLastId store update (production readiness: real-time updates)
    useEffect(() => {
        // Subscribe globally to read receipt events and update the store
        const unsubscribe = onReadReceipt(({roomId: rid, readerId}) => {
            try {
                const setPeerLastReadAt = useReadLastIdStore.getState().setPeerLastReadAt;
                if (typeof setPeerLastReadAt === 'function') {
                    const nowIso = new Date().toISOString();
                    setPeerLastReadAt(String(rid), Number(readerId), nowIso);
                }
            } catch {
            }
        });
        return () => {
            try {
                unsubscribe?.();
            } catch {
            }
        };
    }, []);

    return {
        status,
        isReady: status === 'connected',
        room,
        adapter: adapterRef.current,
        connect,
        disconnect,
        join,
        leave,
        emit,
        addMessageListener,
        resetInactivityTimer,
    };
}
