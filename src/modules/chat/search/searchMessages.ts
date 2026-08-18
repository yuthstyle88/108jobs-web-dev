import type {ChatMessage} from "108jobs-client";

import {parseAttachment} from "@/modules/chat/attachments";
import {compareNewestFirst} from "@/modules/chat/utils/ordering";
import {parseStructured} from "@/modules/chat/utils/structured";

export type SearchHit = {
  messageId: string;
  senderId: number;
  createdAt: string;
  isOwner: boolean;
  /** A window of the matched text, ellipsised at either end when clipped. */
  snippet: string;
  /** Where the match starts *within the snippet*, for highlighting. */
  matchStart: number;
  matchLength: number;
};

/** Longest snippet rendered in a result row. */
const MAX_SNIPPET = 120;
/** How much context to keep before the match when windowing. */
const SNIPPET_LEAD = 32;
const ELLIPSIS = "…";

/**
 * What of a message a person could plausibly be searching for.
 *
 * Attachments contribute their filename and caption — things a human typed or
 * chose — but not their URL, which nobody searches for and which would match
 * every attachment in the room on a substring like the proxy path. Workflow
 * messages contribute nothing: they are machine JSON, and matching their raw
 * text would surface a quotation for the word "proposed".
 */
export function searchableText(message: ChatMessage): string | null {
  const content = message?.content;
  if (typeof content !== "string") return null;

  const attachment = parseAttachment(content);
  if (attachment) {
    // `parseAttachment` falls back to the url itself as an attachment's
    // "name" when the envelope has neither `name` nor a path segment to
    // derive one from (a url ending in `/`). That fallback is still a url,
    // not something a human typed -- drop it so it can't reintroduce the
    // exact url match this function otherwise deliberately excludes.
    const name = attachment.name === attachment.url ? undefined : attachment.name;
    return [name, attachment.caption].filter(Boolean).join(" ");
  }

  // `parseStructured` -- not a bare `startsWith("{")` guess -- is the
  // codebase's one definition of "this content is structured JSON, not text
  // a person wrote." A message that merely starts with `{` (a pasted code
  // snippet, say) but fails to parse is still plain text and stays
  // searchable; `parseAttachment` above already shares this same guard for
  // envelopes that do parse.
  if (parseStructured(content) !== null) return null;
  return content;
}

/**
 * A window of `text` around `index`, plus where the match now starts in it.
 *
 * `matchLength` is needed, not just `index`: the default trailing budget
 * (`MAX_SNIPPET - SNIPPET_LEAD`) is only enough for a short query. A query
 * longer than that would otherwise get clipped by `end` before it finishes,
 * so the returned `matchStart` would point at a match the snippet doesn't
 * fully contain. `end` therefore grows to cover the whole match when needed
 * — the snippet is allowed to exceed `MAX_SNIPPET` rather than ever slice
 * through the middle of what it claims to have matched.
 */
function windowAround(text: string, index: number, matchLength: number) {
  if (text.length <= MAX_SNIPPET) {
    return {snippet: text, matchStart: index};
  }

  const start = Math.max(0, index - SNIPPET_LEAD);
  const end = Math.min(text.length, Math.max(start + MAX_SNIPPET, index + matchLength));
  const leading = start > 0 ? ELLIPSIS : "";
  const trailing = end < text.length ? ELLIPSIS : "";

  return {
    snippet: `${leading}${text.slice(start, end)}${trailing}`,
    matchStart: index - start + leading.length,
  };
}

/**
 * Every message in the room whose searchable text contains `rawQuery`,
 * newest first.
 *
 * Runs over whatever `chatStore` holds, which is decrypted — the server never
 * sees a query and could not answer one anyway, since it only ever held
 * ciphertext. Results therefore cover exactly as much history as has been
 * loaded, which is why the panel backfills while the user types.
 *
 * Case-insensitive only. Not diacritic- or stem-insensitive: stripping
 * combining marks would broaden Thai matching incorrectly, because Thai vowels
 * and tone marks are semantically load-bearing.
 */
export function searchMessages(
  messages: readonly ChatMessage[],
  rawQuery: string,
): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const hits: SearchHit[] = [];

  for (const message of messages) {
    const text = searchableText(message);
    if (!text) continue;

    const index = text.toLowerCase().indexOf(query);
    if (index < 0) continue;

    const {snippet, matchStart} = windowAround(text, index, query.length);
    hits.push({
      messageId: String(message.id),
      senderId: Number(message.senderId) || 0,
      createdAt: message.createdAt,
      isOwner: Boolean(message.isOwner),
      snippet,
      matchStart,
      matchLength: query.length,
    });
  }

  return hits.sort(compareNewestFirst);
}
