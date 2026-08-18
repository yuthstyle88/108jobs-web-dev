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
        abortRef.current = null;
      });
  }, [roomId, loadOlderUntilDone, setBackfill]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => registerBackfillRunner(roomId, {start, cancel}), [roomId, start, cancel]);

  // Leaving the room stops the pull; nothing is left fetching in the
  // background for a conversation nobody is looking at.
  useEffect(() => () => abortRef.current?.abort(), []);
}
