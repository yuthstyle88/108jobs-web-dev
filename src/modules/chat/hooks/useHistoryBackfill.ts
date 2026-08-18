'use client';

import {useCallback, useEffect, useRef} from 'react';

import type {UseChatHistoryResult} from '@/modules/chat/hooks/useChatHistory';
import {registerBackfillRunner, useChatPanelStore} from '@/modules/chat/store/chatPanelStore';

type Options = {
  roomId: string;
  loadOlderUntilDone: UseChatHistoryResult['actions']['loadOlderUntilDone'];
};

/**
 * Makes this room's history backfill reachable from panels that are not in
 * `ChatRoomView`'s subtree.
 *
 * The runner has to be created here, because it closes over the live
 * `useChatHistory` instance -- there is only one per room, and a second,
 * independent pager would return nothing at all: `mapIncomingToChatMessage`
 * dedupes against a `receivedSet` shared with this one. So the hook registers
 * the runner centrally and mirrors its progress into the store, which is what
 * the media panel and the search panel actually read.
 */
export function useHistoryBackfill({roomId, loadOlderUntilDone}: Options): void {
  const abortRef = useRef<AbortController | null>(null);
  const setBackfill = useChatPanelStore((s) => s.setBackfill);

  const start = useCallback(() => {
    // Already running: the second asker just watches the same progress.
    if (abortRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBackfill(roomId, {phase: 'running', pagesLoaded: 0, error: undefined});

    loadOlderUntilDone({
      signal: controller.signal,
      onPage: (pagesLoaded) => setBackfill(roomId, {phase: 'running', pagesLoaded}),
    })
      .then((outcome) => setBackfill(roomId, {phase: outcome}))
      .catch((e: unknown) =>
        setBackfill(roomId, {
          phase: 'error',
          error: e instanceof Error ? e.message : String(e),
        }),
      )
      .finally(() => {
        // Only clear it if it's still ours. The room-scoped cleanup below may
        // already have aborted and cleared this ref for a room switch, and a
        // fresh `start()` for the room now current may already have replaced
        // it with a new controller by the time this settles. Nulling
        // unconditionally here could drop that newer controller, making the
        // next `start()` wrongly think nothing is running.
        if (abortRef.current === controller) abortRef.current = null;
      });
  }, [roomId, loadOlderUntilDone, setBackfill]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => registerBackfillRunner(roomId, {start, cancel}), [roomId, start, cancel]);

  // Room-scoped, not just unmount: switching conversations reuses this same
  // hook instance instead of unmounting it, so an empty-deps cleanup here
  // only ever fired when the whole component went away -- the old room's
  // fetch kept running in the background, and its still-non-null `abortRef`
  // made `start()` for the new room silently no-op until the stale fetch's
  // own `.finally()` eventually cleared it. Keying this effect on `roomId`
  // aborts *and* clears the previous room's controller on every room change,
  // so the new room's `start()` never sees a stale, blocking ref. React still
  // runs this same cleanup on unmount, so that case stays covered too.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [roomId]);
}
