// src/modules/chat/utils/selectors.ts
import memoizeOne from 'memoize-one';
import type {ChatMessage} from '@108-plaza/jh-client';

// Merge & sort for a room (defensive against undefined inputs)
function mergeRoomLists(
  base: ChatMessage[] | undefined,
  roomId: string | undefined,
): ChatMessage[] {
  const rid = roomId ?? '';
    return (base ?? []).filter((m) => String(m.roomId) === String(rid));
}

// === Memoized selectors ===
// 1) Curried selector for typical Zustand usage: make a selector per room
export const makeSelectRoomMessages = (() => {
  const memo = memoizeOne(mergeRoomLists);
  return (roomId: string) => (state?: { listMessages?: ChatMessage[] }) =>
    memo(state?.listMessages ?? [], roomId);
})();

// 2) Backward-compatible non-curried variant: (state, roomId)
export const selectRoomMessages = (() => {
  const memo = memoizeOne(mergeRoomLists);
  return (state?: { listMessages?: ChatMessage[] }, roomId?: string) =>
    memo(state?.listMessages ?? [], roomId ?? '');
})();