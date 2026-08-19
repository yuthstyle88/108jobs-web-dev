import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {MEDIA_RETRY_DELAYS_MS} from "@/modules/chat/hooks/mediaRetryPolicy";

import {
  LOCAL_PREVIEW_HOLD_MS,
  useLocalAttachmentPreviewStore,
} from "./localAttachmentPreviewStore";

const reset = () => useLocalAttachmentPreviewStore.setState({byAssetId: {}});

describe("localAttachmentPreviewStore", () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain anything still scheduled before switching back to real timers --
    // an un-flushed fake timer from one test must never bleed into the next.
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("makes a registered object url readable by its assetId", () => {
    useLocalAttachmentPreviewStore.getState().register("asset-1", "blob:1");

    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBe("blob:1");
  });

  it("revokes and forgets an entry on release", () => {
    const {register, release} = useLocalAttachmentPreviewStore.getState();
    register("asset-1", "blob:1");

    release("asset-1");

    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBeUndefined();
  });

  it("is a safe no-op releasing an assetId that was never registered", () => {
    expect(() => useLocalAttachmentPreviewStore.getState().release("nobody")).not.toThrow();
    expect(useLocalAttachmentPreviewStore.getState().byAssetId).toEqual({});
  });

  it("does not disturb other entries when releasing one", () => {
    const {register, release} = useLocalAttachmentPreviewStore.getState();
    register("asset-1", "blob:1");
    register("asset-2", "blob:2");

    release("asset-1");

    expect(useLocalAttachmentPreviewStore.getState().byAssetId).toEqual({"asset-2": "blob:2"});
  });

  it("revokes the previous url if the same assetId is somehow registered twice", () => {
    // Should not happen in practice (assetId is a server-issued UUID, one
    // per upload) but a second registration must never silently strand the
    // first blob un-revoked in memory.
    const {register} = useLocalAttachmentPreviewStore.getState();
    register("asset-1", "blob:1");

    register("asset-1", "blob:2");

    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBe("blob:2");
  });

  it("auto-releases after the hold window so the preview cannot pin memory forever", () => {
    useLocalAttachmentPreviewStore.getState().register("asset-1", "blob:1");

    vi.advanceTimersByTime(LOCAL_PREVIEW_HOLD_MS);

    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBeUndefined();
  });

  it("does not release early, before the hold window elapses", () => {
    useLocalAttachmentPreviewStore.getState().register("asset-1", "blob:1");

    vi.advanceTimersByTime(LOCAL_PREVIEW_HOLD_MS - 1);

    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBe("blob:1");
  });

  it("does not error when its own auto-release fires after an explicit release already happened", () => {
    const {register, release} = useLocalAttachmentPreviewStore.getState();
    register("asset-1", "blob:1");
    release("asset-1");

    expect(() => vi.advanceTimersByTime(LOCAL_PREVIEW_HOLD_MS)).not.toThrow();
    expect(useLocalAttachmentPreviewStore.getState().byAssetId["asset-1"]).toBeUndefined();
  });

  it("comfortably outlives the media retry budget it hands off to (see mediaRetryPolicy.ts)", () => {
    // The handoff from this local blob to the network `attachmentSrc()` URL
    // must land after that URL's own retry-hardened load has essentially
    // always already succeeded -- otherwise releasing the blob early would
    // reintroduce the exact broken-image window `MEDIA_RETRY_DELAYS_MS`
    // exists to cover. Asserted here, against the real constant, instead of
    // relying on the two files' doc comments staying in sync by hand.
    const mediaRetryTotalCoverageMs = MEDIA_RETRY_DELAYS_MS.reduce(
      (sum, delay) => sum + delay,
      0,
    );

    expect(LOCAL_PREVIEW_HOLD_MS).toBeGreaterThan(mediaRetryTotalCoverageMs);
  });

  it("releaseAll revokes and forgets everything", () => {
    const {register, releaseAll} = useLocalAttachmentPreviewStore.getState();
    register("asset-1", "blob:1");
    register("asset-2", "blob:2");

    releaseAll();

    expect(useLocalAttachmentPreviewStore.getState().byAssetId).toEqual({});
  });
});
