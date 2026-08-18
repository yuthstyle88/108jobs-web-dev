import {classifyMime} from "./classifyMime";
import {ATTACHMENT_MESSAGE_TYPES, type ChatAttachment} from "./types";

const ATTACHMENT_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_MESSAGE_TYPES);

/** A string field that is actually present and not blank. */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : undefined;
}

/** Last path segment of a URL, percent-decoded when that is possible. */
function nameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  if (!lastSegment) return url;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    // A malformed escape sequence is not a reason to lose the whole message.
    return lastSegment;
  }
}

/**
 * The one place a chat message is inspected for a file envelope.
 *
 * Returns `null` for everything that is not one — plain text, malformed JSON,
 * workflow messages, envelopes with no usable url — and never throws, because
 * it runs against every message in a room including ones written by older
 * clients.
 */
export function parseAttachment(content: unknown): ChatAttachment | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || !ATTACHMENT_TYPES.has(record.type)) return null;

  const url = optionalString(record.url);
  if (!url) return null;

  const mime = optionalString(record.mime);
  const name = optionalString(record.name) ?? nameFromUrl(url);

  return {
    kind: classifyMime(mime, name, url),
    url,
    name,
    mime,
    caption: optionalString(record.caption),
    assetId: optionalString(record.assetId),
  };
}
