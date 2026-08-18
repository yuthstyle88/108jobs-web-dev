import {create} from 'zustand';

export type SidebarTab = 'orders' | 'media';
export type MediaTab = 'imageVideo' | 'files';

export type BackfillPhase =
  | 'idle'
  | 'running'
  | 'complete'
  | 'cancelled'
  | 'capped'
  | 'error';

export type BackfillState = {
  phase: BackfillPhase;
  pagesLoaded: number;
  error?: string;
};

const IDLE: BackfillState = {phase: 'idle', pagesLoaded: 0};

interface ChatPanelState {
  sidebarTab: SidebarTab;
  mediaTab: MediaTab;
  isSearchOpen: boolean;
  backfillByRoom: Record<string, BackfillState>;
  /** A jump the message list has not acted on yet. */
  pendingJumpMessageId: string | null;
  /** The message currently wearing the "you jumped here" ring. */
  highlightedMessageId: string | null;
}

interface ChatPanelActions {
  setSidebarTab: (tab: SidebarTab) => void;
  setMediaTab: (tab: MediaTab) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setBackfill: (roomId: string, patch: Partial<BackfillState>) => void;
  requestJump: (messageId: string) => void;
  /** Takes the pending jump and clears it, so it fires once. */
  consumeJump: () => string | null;
  setHighlight: (messageId: string) => void;
  clearHighlight: () => void;
}

/**
 * UI state for the chat room's side panel and search.
 *
 * A store rather than context because `JobFlowSidebar` renders the sidebar's
 * content inside its own `<aside>`, which is not a descendant of
 * `ChatRoomView` -- a provider mounted there is simply not an ancestor of the
 * component that would consume it. The jump channel has the same shape of
 * problem: the media panel asks, and the virtualized list on the other side of
 * that boundary answers.
 */
export const useChatPanelStore = create<ChatPanelState & ChatPanelActions>((set, get) => ({
  sidebarTab: 'orders',
  mediaTab: 'imageVideo',
  isSearchOpen: false,
  backfillByRoom: {},
  pendingJumpMessageId: null,
  highlightedMessageId: null,

  setSidebarTab: (sidebarTab) => set({sidebarTab}),
  setMediaTab: (mediaTab) => set({mediaTab}),
  openSearch: () => set({isSearchOpen: true}),
  closeSearch: () => set({isSearchOpen: false}),

  setBackfill: (roomId, patch) =>
    set((s) => ({
      backfillByRoom: {
        ...s.backfillByRoom,
        [roomId]: {...(s.backfillByRoom[roomId] ?? IDLE), ...patch},
      },
    })),

  requestJump: (messageId) => set({pendingJumpMessageId: messageId}),

  consumeJump: () => {
    const pending = get().pendingJumpMessageId;
    if (pending !== null) set({pendingJumpMessageId: null});
    return pending;
  },

  setHighlight: (messageId) => set({highlightedMessageId: messageId}),
  clearHighlight: () => set({highlightedMessageId: null}),
}));

/** What a room's backfill can be told to do. */
export type BackfillRunner = {start: () => void; cancel: () => void};

/**
 * Runners live outside the store deliberately: they are functions bound to a
 * live `useChatHistory` instance, and putting them in state would re-render
 * every panel each time a room mounted.
 */
const runners = new Map<string, BackfillRunner>();

/** Returns the unregister function, for a `useEffect` cleanup. */
export function registerBackfillRunner(roomId: string, runner: BackfillRunner): () => void {
  runners.set(roomId, runner);
  return () => {
    if (runners.get(roomId) === runner) runners.delete(roomId);
  };
}

export function startBackfill(roomId: string): void {
  runners.get(roomId)?.start();
}

export function cancelBackfill(roomId: string): void {
  runners.get(roomId)?.cancel();
}

/** A room's backfill state, defaulted, for use as a selector. */
export function selectBackfill(roomId: string) {
  return (s: ChatPanelState): BackfillState => s.backfillByRoom[roomId] ?? IDLE;
}
