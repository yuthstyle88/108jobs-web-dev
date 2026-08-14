'use client';
// WebSocketContext.tsx
// ------------------------------------------------------------
// Purpose: Wrap the real useWebSocket hook with a React Context
// so consumers can access a single, shared websocket API.
// ------------------------------------------------------------

import React, {createContext, useContext} from 'react';
import type {UseWebSocketOptions, WebSocketAPI} from '@/modules/chat/hooks/useWebSocket';
import {useWebSocket} from '@/modules/chat/hooks/useWebSocket';
import {ChatSenderAdapter} from '@/modules/chat/adapters/ChatSenderAdapter';
import {WS_EVENT} from '@/modules/chat/protocol/wireEvents';

// ========================= Context Layer =======================
interface WebSocketContextValue extends WebSocketAPI {
  sender: ChatSenderAdapter | null;
  // The ChatChannel (adapter.channel) surfaced at top level so consumers
  // like ChatBridgeProvider's pickChannel() can find it via ws.channel
  // without reaching into ws.adapter.channel themselves.
  channel?: any;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// Track (roomId:senderId) pairs we've joined to avoid duplicates across mounts
const __joinedOnce = new Set<string>();

// This should be the only place where WebSocket context is provided; other providers (like useRoomWebSocket) have been deprecated.
export const WebSocketProvider: React.FC<React.PropsWithChildren<{ options?: UseWebSocketOptions; joinInProvider?: boolean }>> = ({ children, options, joinInProvider = true }) => {

  const ws = useWebSocket(options);
  const value = React.useMemo(() => {
    const anyWs: any = ws as any;
    const adapter: any = anyWs?.adapter ?? null;
    // The ChatChannel (has real .on()/.off()/.push()), as opposed to
    // `adapter` itself which is the WebSocket-style wrapper built by
    // getChannelAdapter (single-slot onopen/onmessage/... callbacks plus
    // fire-and-forget send/emit -- no .on()).
    const channel: any = adapter?.channel ?? null;

    // Normalized readiness: prefer adapter.isReady, fall back to legacy ws.isReady
    const isReady: boolean = Boolean(adapter?.isReady ?? anyWs?.isReady);

    // Normalized message subscription across adapter / legacy / EventEmitter
    const addMessageListener = (handler: (data: unknown) => void) => {
      if (adapter && typeof adapter.addMessageListener === 'function') {
        return adapter.addMessageListener(handler);
      }
      if (anyWs && typeof anyWs.addMessageListener === 'function') {
        return anyWs.addMessageListener(handler);
      }
      const target: any = adapter || anyWs;
      if (target && typeof target.on === 'function') {
        target.on('message', handler);
        return () => {
          try { target.off?.('message', handler); } catch {}
        };
      }
      return () => {};
    };

    // Message sender (single source of truth for sending + optimistic emit + ack handling)
    // Bind to `channel` (has real .push(), ChatSenderAdapter's ack-capturing
    // branch) rather than `adapter` (fire-and-forget .emit()/.send(), no ack)
    // -- falling back to `adapter` only if a channel somehow isn't available.
    const sender = channel ? new ChatSenderAdapter(channel) : (adapter ? new ChatSenderAdapter(adapter) : null);
    // Return the original ws enriched with normalized fields.
    // Cast to any to avoid narrowing issues if WebSocketAPI doesn’t yet declare these fields.
    return {
      ...anyWs,
      adapter,
      channel,
      sender,
      isReady,
      addMessageListener,
    } as any as WebSocketContextValue;
  }, [ws]);

  // Optional: perform room join here (centralized) when allowed via options
  React.useEffect(() => {
    const roomId = (options as any)?.roomId as string | undefined;
    const senderId = (options as any)?.senderId as number | undefined;

    const anyWs: any = ws as any;
    const adapter: any = anyWs?.adapter ?? null;

    // guard conditions (centralized join here only)
    if (!joinInProvider) return;                   // join only if providers allows
    if (!roomId || typeof senderId !== 'number') return;
    if (anyWs?.status !== 'connected') return;

    // avoid duplicate joins for the same pair across re-mounts
    const key = `${roomId}:${senderId}`;
    if (__joinedOnce.has(key)) return;

    // some adapters expose `requiresManualJoin` when they don't auto-join internally
    const requiresManual = adapter?.requiresManualJoin === true || typeof anyWs?.join === 'function';
    if (!requiresManual) return;

    try {
      if (typeof anyWs.join === 'function') {
        void anyWs.join({ roomId, senderId });
        __joinedOnce.add(key);
      } else if (adapter && typeof adapter.emit === 'function') {
        // wire v2: the adapter puts the room in the envelope's `room` field,
        // so the payload carries only what the join itself needs -- no topic
        // string, and no second `payload` nesting level.
        void adapter.emit(WS_EVENT.Join, { roomId, senderId });
        __joinedOnce.add(key);
      }
    } catch (e) {
      console.warn('[WebSocketContext] join failed', e);
    }
  }, [ws, options, joinInProvider]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

WebSocketProvider.displayName = 'WebSocketProvider';

export function useWebSocketContext(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used within WebSocketProvider');
  return ctx;
}

// Notes:
// - The real connection logic (socket adapter, events, retry, etc.) lives in `@/hooks/useWebSocket`.
// - This file now only exposes a Context/providers wrapper around that hook.