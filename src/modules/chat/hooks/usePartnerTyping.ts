// src/modules/chat/hooks/usePartnerTyping.ts
// hooks/usePartnerTyping.ts
// Single-partner typing indicator with auto-decay, filtered by room and self user id.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatRoomId, LocalUserId } from '@108-plaza/jh-client';
import { CHAT_EVENT } from '@/modules/chat/events';

export type TypingEvent = { roomId: ChatRoomId; senderId: LocalUserId; typing: boolean };

type Options = {
  channel: { on?: (e: string, cb: (p: any) => void) => void; off?: (e: string, cb?: (p: any) => void) => void } | null | undefined;
  roomId: ChatRoomId;
  localUserId: LocalUserId | number;
  decayMs?: number; // auto-off if no explicit stop
  onRemoteTyping?: (evt: TypingEvent) => void;
  dispatchDomEvent?: (name: string, detail: any) => void; // optional DOM bridge
};

export function usePartnerTyping(opts: Options) {
  const { channel, roomId, localUserId, decayMs = 2000, onRemoteTyping, dispatchDomEvent } = opts;
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const decayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStateRef = useRef<{ typing: boolean; ts: number } | null>(null);
  const EVENT = CHAT_EVENT.TYPING as string;

  const clearDecay = useCallback(() => {
    if (decayRef.current) {
      try { clearTimeout(decayRef.current); } catch {}
      decayRef.current = null;
    }
  }, []);

  const armDecay = useCallback((senderId: number) => {
    clearDecay();
    decayRef.current = setTimeout(() => {
      setIsPartnerTyping(false);
      dispatchDomEvent?.('chat:partner-typing', { roomId, senderId, typing: false });
    }, decayMs);
  }, [clearDecay, decayMs, dispatchDomEvent, roomId]);

  const me = Number(localUserId) || 0;
  const roomKey = String(roomId);

  // Unified handler used by both Channel and DOM
  const handleTyping = (p: any) => {
    const evt: TypingEvent = {
      roomId: p?.roomId as ChatRoomId,
      senderId: Number(p?.senderId) as LocalUserId,
      typing: Boolean(p?.typing),
    };
    if (!evt.roomId || !evt.senderId) return;
    if (String(evt.roomId) !== roomKey) return;
    if (Number(evt.senderId) === me) return; // ignore self

    // De-duplicate very frequent identical state
    const now = Date.now();
    if (lastStateRef.current && lastStateRef.current.typing === evt.typing && (now - lastStateRef.current.ts) < 120) {
      return;
    }
    lastStateRef.current = { typing: evt.typing, ts: now };

    if (!evt.typing) {
      setIsPartnerTyping(false);
      clearDecay();
      dispatchDomEvent?.('chat:partner-typing', { roomId, senderId: Number(evt.senderId) || 0, typing: false });
      onRemoteTyping?.(evt);
      return;
    }

    setIsPartnerTyping(true);
    dispatchDomEvent?.('chat:partner-typing', { roomId, senderId: Number(evt.senderId) || 0, typing: true });
    armDecay(Number(evt.senderId) || 0);
    onRemoteTyping?.(evt);
  };

  // Primary: listen to adapter/channel if available
  useEffect(() => {
    if (!channel || typeof channel.on !== 'function') return;

    channel.on?.(EVENT, handleTyping);
    return () => channel.off?.(EVENT, handleTyping);
  }, [channel, EVENT, handleTyping]);

  // Fallback: listen to unified DOM typing event emitted by handleWSMessage
  useEffect(() => {
    // Skip DOM fallback when a channel is present
    if (channel && typeof channel.on === 'function') return;
    if (typeof window === 'undefined') return; // SSR guard

    const onDomTyping = (e: Event) => {
      const anyEvt = e as CustomEvent<any>;
      handleTyping(anyEvt?.detail ?? {});
    };

    try {
      window.addEventListener(EVENT as any, onDomTyping as any);
      document?.addEventListener?.(EVENT as any, onDomTyping as any);
    } catch {}
    return () => {
      try {
        window.removeEventListener(EVENT as any, onDomTyping as any);
        document?.removeEventListener?.(EVENT as any, onDomTyping as any);
      } catch {}
    };
  }, [channel, EVENT, handleTyping]);

  // Cleanup on unmount
  useEffect(() => () => { clearDecay(); }, [clearDecay]);

  return { isPartnerTyping } as const;
}