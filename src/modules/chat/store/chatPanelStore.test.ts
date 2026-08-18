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
    highlightedMessageId: null,
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

  it("highlights and clears", () => {
    useChatPanelStore.getState().setHighlight("m-1");
    expect(useChatPanelStore.getState().highlightedMessageId).toBe("m-1");
    useChatPanelStore.getState().clearHighlight();
    expect(useChatPanelStore.getState().highlightedMessageId).toBeNull();
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
