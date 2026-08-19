import type {ChatAttachment} from "./types";

/**
 * Where to actually load an attachment's bytes from, derived at render time.
 *
 * The stored envelope's `url` is left untouched everywhere it is written --
 * Flutter builds and reads the same envelope with its own bearer, so
 * changing the stored shape would fork that cross-client contract. The web
 * client instead derives a same-origin path here: `/api/media/{assetId}`
 * goes through `src/app/api/media/[assetId]/route.ts`, which reads the
 * browser's own cookie and forwards it as the bearer the backend actually
 * requires (see that route's comment for why the stored `url` alone 401s).
 * Legacy messages sent before `assetId` existed have nothing to derive it
 * from, so they fall back to the stored `url` unchanged.
 */
export function attachmentSrc(attachment: Pick<ChatAttachment, "url" | "assetId">): string {
  return attachment.assetId ? `/api/media/${attachment.assetId}` : attachment.url;
}
