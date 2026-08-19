/**
 * How many times to retry a failed attachment load, and how long to wait
 * before each attempt.
 *
 * Why this exists: the server acks a sent message on the Redis buffer write,
 * then persists `chat_message.asset_id` in a task it spawns *after* that ack
 * (see api-108jobs's `broker/bridge_message.rs`). The optimistic bubble --
 * sender and recipient alike, since the message is broadcast to the room
 * from the same handler that spawns the persist -- can therefore paint an
 * `<img>`/`<video>` pointed at `/api/media/{assetId}` before the row exists,
 * and `media_proxy` answers 404 for that first request. Browsers never retry
 * a failed image/video load on their own, so without this the attachment
 * stayed a broken image until a full page reload, by which time the row was
 * always there.
 *
 * The same bounded retry also covers a genuine, permanent 404/403 (a deleted
 * asset, revoked room access): an `onError` event carries no HTTP status, so
 * there is no way to tell the two cases apart from the DOM alone, and no
 * need to -- every element that uses this policy still falls back to the
 * existing "preview unavailable" treatment once attempts run out. A real
 * failure just takes a few extra seconds to get there instead of failing on
 * the first try.
 */
export const MEDIA_RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

/**
 * How long to wait before the next retry, or `null` once the caller should
 * give up and show the permanent failure state.
 *
 * `failureCount` is the number of load attempts that have failed so far --
 * 1 right after the first `onError`, 2 once the first retry has also
 * failed, and so on. Deterministic on purpose, with no jitter: this is one
 * element's own local retry after a single-row database race, not a
 * mass-reconnect scramble shared across many clients, so there is nothing
 * here for jitter to protect against, and a fixed schedule is what makes the
 * policy trivial to unit test.
 */
export function nextMediaRetryDelayMs(failureCount: number): number | null {
  if (!Number.isFinite(failureCount) || failureCount < 1) return null;
  const delay = MEDIA_RETRY_DELAYS_MS[failureCount - 1];
  return delay ?? null;
}
