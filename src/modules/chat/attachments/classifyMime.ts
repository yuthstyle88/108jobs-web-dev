import type {AttachmentKind} from "./types";

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "svg",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv", "3gp",
]);

/** A mime that tells us nothing — the upload hook's default when the browser
 *  reported no type, and what the legacy upload endpoint stores. */
const UNINFORMATIVE_MIMES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/** Lowercased extension of a filename or URL path, or `null`. */
function extensionOf(value: string): string | null {
  const withoutQuery = value.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0 || dot === lastSegment.length - 1) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

/**
 * Which tab an attachment belongs in.
 *
 * An explicit mime always wins — a `.png` served as `application/pdf` is a
 * pdf, and trusting the name over the type would be a lie. The `fallbacks`
 * (name, then url) are only consulted when the mime is missing or one of the
 * placeholder values that carry no information, which is exactly the shape of
 * a legacy `/account/files` attachment. MAD proxy URLs are extension-less
 * UUIDs but always carry a real mime, so they never reach the fallback.
 */
export function classifyMime(
  mime?: string,
  ...fallbacks: Array<string | undefined>
): AttachmentKind {
  const normalized = (mime ?? "").trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";

  if (UNINFORMATIVE_MIMES.has(normalized)) {
    for (const candidate of fallbacks) {
      if (!candidate) continue;
      const extension = extensionOf(candidate);
      if (!extension) continue;
      if (IMAGE_EXTENSIONS.has(extension)) return "image";
      if (VIDEO_EXTENSIONS.has(extension)) return "video";
    }
  }

  return "file";
}
