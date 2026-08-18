/** The minimum a record needs to be ordered in a chat timeline. */
export type TimelineOrdered = {createdAt: string; messageId: string};

/**
 * Newest first, with the message id as a stable tiebreak.
 *
 * Two attachments sent in the same millisecond, or a timestamp the server
 * wrote in a shape `Date.parse` cannot read, must still produce a total order
 * — otherwise the list reshuffles on every render.
 */
export function compareNewestFirst(a: TimelineOrdered, b: TimelineOrdered): number {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.messageId.localeCompare(a.messageId);
}
