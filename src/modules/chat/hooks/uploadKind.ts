import {classifyMime} from "@/modules/chat/attachments";
import type {MediaKind} from "@/services/media/madUpload";

/**
 * Which MAD kind to declare for a file being uploaded.
 *
 * MAD's own enum is `image | video | audio | file`, but the frontend only ever
 * declares two of them. Video and audio go up as `file` deliberately: `File`
 * is "stored and served verbatim, never processed/transcoded", which is
 * exactly what a chat attachment needs, and what keeps `media_proxy`'s
 * `/internal/assets/{id}/bytes` returning the original bytes. Declaring
 * `video` would instead place the asset in a transcoding pipeline it has no
 * business being in.
 *
 * MAD does not validate `contentType` against `kind`, so getting this wrong
 * is silent — which is how every chat attachment came to be declared an image.
 */
export function uploadKindForMime(mime?: string, filename?: string): MediaKind {
  return classifyMime(mime, filename) === "image" ? "image" : "file";
}
