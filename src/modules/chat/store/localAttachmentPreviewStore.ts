import {create} from "zustand";

/**
 * How long a just-uploaded file's local preview outlives its upload before
 * falling back to the network URL. Generous relative to
 * `MEDIA_RETRY_DELAYS_MS`'s ~15.5s worst case (see `mediaRetryPolicy.ts`,
 * whose own doc comment ties that number to api-108jobs's 10s chat-flush
 * interval), so the handoff is not itself a race: by the time this fires,
 * the row that whole policy works around has essentially always already
 * landed, and `ChatMessageBubble` falls back to the ordinary,
 * retry-hardened `attachmentSrc()` URL, which by then is virtually always
 * already servable. Bounded rather than held for the rest of the session
 * because an object URL pins the whole file's bytes in memory for as long
 * as it lives.
 *
 * Was 20s when the retry budget below it was ~3.5s (a 16.5s margin). That
 * budget widened to cover a 10s server-side flush interval it had
 * originally underestimated -- see `mediaRetryPolicy.ts` -- which would
 * have squeezed this hold's margin down to 4.5s if left unchanged. Widened
 * in step, to roughly 2x the new retry ceiling, to keep a comparably
 * comfortable cushion rather than a thin one.
 */
export const LOCAL_PREVIEW_HOLD_MS = 30_000;

interface LocalAttachmentPreviewState {
  /**
   * Object URL for a file this tab just uploaded, keyed by its MAD asset
   * id. Only ever written by `useFileUpload`, right after a private upload
   * succeeds -- a recipient's browser never has the bytes to create one of
   * these for the same message, so there is nothing to additionally scope
   * by room or session: the key itself is the server-issued, globally
   * unique id for one specific upload, and this map can only ever hold
   * entries this same tab created for messages it is the sender of.
   */
  byAssetId: Record<string, string>;
}

interface LocalAttachmentPreviewActions {
  /**
   * Registers an object URL for `assetId` and schedules its own release
   * after `LOCAL_PREVIEW_HOLD_MS` -- callers never need to remember to
   * clean up after themselves.
   */
  register: (assetId: string, objectUrl: string) => void;
  /** Revokes and forgets one entry. A safe no-op when there is none. */
  release: (assetId: string) => void;
  /** Revokes and forgets every entry. Nothing in the app calls this today;
   *  it exists as an explicit escape hatch and for tests. */
  releaseAll: () => void;
}

export const useLocalAttachmentPreviewStore = create<
  LocalAttachmentPreviewState & LocalAttachmentPreviewActions
>((set, get) => ({
  byAssetId: {},

  register: (assetId, objectUrl) => {
    // Should not happen in practice -- assetId is a server-issued UUID, one
    // per upload -- but a second registration under the same key must never
    // silently strand the first blob un-revoked.
    const prev = get().byAssetId[assetId];
    if (prev) URL.revokeObjectURL(prev);

    set((s) => ({byAssetId: {...s.byAssetId, [assetId]: objectUrl}}));
    setTimeout(() => get().release(assetId), LOCAL_PREVIEW_HOLD_MS);
  },

  release: (assetId) => {
    const url = get().byAssetId[assetId];
    if (!url) return;
    URL.revokeObjectURL(url);
    set((s) => {
      const next = {...s.byAssetId};
      delete next[assetId];
      return {byAssetId: next};
    });
  },

  releaseAll: () => {
    Object.values(get().byAssetId).forEach((url) => URL.revokeObjectURL(url));
    set({byAssetId: {}});
  },
}));
