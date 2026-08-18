import {beforeEach, describe, expect, it, vi} from "vitest";

import {
  cancelBackfill,
  registerBackfillRunner,
  startBackfill,
  useChatPanelStore,
} from "@/modules/chat/store/chatPanelStore";

const reset = () =>
  useChatPanelStore.setState({
    sidebarTab: "orders",
    mediaTab: "imageVideo",
    isSearchOpen: false,
    backfillByRoom: {},
    pendingJumpMessageId: null,
    jumpToken: 0,
    highlightedMessageId: null,
    highlightToken: 0,
  });

describe("chatPanelStore", () => {
  beforeEach(reset);

  it("starts on Orders so the existing panel is what people see", () => {
    expect(useChatPanelStore.getState().sidebarTab).toBe("orders");
    expect(useChatPanelStore.getState().mediaTab).toBe("imageVideo");
  });

  it("switches tabs", () => {
    useChatPanelStore.getState().setSidebarTab("media");
    useChatPanelStore.getState().setMediaTab("files");
    expect(useChatPanelStore.getState().sidebarTab).toBe("media");
    expect(useChatPanelStore.getState().mediaTab).toBe("files");
  });

  it("opens and closes search", () => {
    useChatPanelStore.getState().openSearch();
    expect(useChatPanelStore.getState().isSearchOpen).toBe(true);
    useChatPanelStore.getState().closeSearch();
    expect(useChatPanelStore.getState().isSearchOpen).toBe(false);
  });

  it("tracks backfill per room, merging partial updates", () => {
    const {setBackfill} = useChatPanelStore.getState();
    setBackfill("room-1", {phase: "running", pagesLoaded: 2});
    setBackfill("room-2", {phase: "complete"});
    setBackfill("room-1", {phase: "complete"});

    expect(useChatPanelStore.getState().backfillByRoom["room-1"]).toEqual({
      phase: "complete",
      pagesLoaded: 2,
    });
    expect(useChatPanelStore.getState().backfillByRoom["room-2"]?.phase).toBe("complete");
  });

  it("hands a jump request over exactly once", () => {
    useChatPanelStore.getState().requestJump("m-1");
    expect(useChatPanelStore.getState().pendingJumpMessageId).toBe("m-1");

    expect(useChatPanelStore.getState().consumeJump()).toBe("m-1");
    expect(useChatPanelStore.getState().pendingJumpMessageId).toBeNull();
    expect(useChatPanelStore.getState().consumeJump()).toBeNull();
  });

  it("notifies again on a repeat jump request to the same message", () => {
    // The real story: someone clicks a search result, scrolls away, then
    // clicks the *same* result again. pendingJumpMessageId alone repeats
    // "m-1" -> "m-1", which a useSyncExternalStore-based selector scoped to
    // just that field sees as no change at all -- and never re-renders.
    // jumpToken is the piece that must move on every request, including
    // this one, so a selector paired with it always observes the repeat.
    useChatPanelStore.getState().requestJump("m-1");
    const {pendingJumpMessageId: idAfterFirst, jumpToken: tokenAfterFirst} =
      useChatPanelStore.getState();

    useChatPanelStore.getState().requestJump("m-1");
    const {pendingJumpMessageId: idAfterSecond, jumpToken: tokenAfterSecond} =
      useChatPanelStore.getState();

    expect(idAfterSecond).toBe(idAfterFirst);
    expect(tokenAfterSecond).not.toBe(tokenAfterFirst);
  });

  it("highlights and clears", () => {
    useChatPanelStore.getState().setHighlight("m-1");
    expect(useChatPanelStore.getState().highlightedMessageId).toBe("m-1");
    useChatPanelStore.getState().clearHighlight();
    expect(useChatPanelStore.getState().highlightedMessageId).toBeNull();
  });

  it("notifies again on a repeat highlight of the same message (Finding 6)", () => {
    // The real story: a search result is still ringed from the first click,
    // and the user clicks it again. `highlightedMessageId` alone repeats
    // "m-1" -> "m-1", which the ring's timer effect (keyed on that field)
    // would see as no change and let the original 2s timer run out on the
    // first click's schedule. `highlightToken` is the piece that must move
    // on every call, including this one, so the effect always re-runs and
    // restarts the ring's countdown.
    useChatPanelStore.getState().setHighlight("m-1");
    const tokenAfterFirst = useChatPanelStore.getState().highlightToken;

    useChatPanelStore.getState().setHighlight("m-1");
    const {highlightedMessageId, highlightToken: tokenAfterSecond} = useChatPanelStore.getState();

    expect(highlightedMessageId).toBe("m-1");
    expect(tokenAfterSecond).not.toBe(tokenAfterFirst);
  });

  it("routes start and cancel to the room's registered runner", () => {
    const start = vi.fn();
    const cancel = vi.fn();
    const unregister = registerBackfillRunner("room-1", {start, cancel});

    startBackfill("room-1");
    cancelBackfill("room-1");

    expect(start).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);

    unregister();
    startBackfill("room-1");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a room with no runner instead of throwing", () => {
    expect(() => startBackfill("nobody")).not.toThrow();
    expect(() => cancelBackfill("nobody")).not.toThrow();
  });
});
