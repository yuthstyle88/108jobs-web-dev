/**
 * How many times to retry a failed attachment load, and how long to wait
 * before each attempt.
 *
 * Why this exists: chat messages are written to Redis immediately, but only
 * persisted to Postgres by a periodic flush task -- every
 * `FLUSH_INTERVAL_SECS` (currently 10s; see api-108heros's
 * `crates/chat_realtime/src/broker/manager.rs:30`, consumed by the
 * `ctx.run_interval` a few hundred lines below it). `media_proxy` resolves
 * an asset to its room by reading `chat_message` in Postgres
 * (`ChatMessage::find_by_asset_id`), so the row -- and therefore the asset
 * at `/api/media/{assetId}` -- can be genuinely unreadable for up to just
 * under 10 seconds after a message is sent. That is a hard interval to
 * outlast, not a brief latency to paper over.
 *
 * An earlier version of this schedule (`[500, 1000, 2000]`, ~3.5s total) was
 * sized against the wrong mental model -- a quick "persist race" rather than
 * this 10s batch interval -- and lost a real fraction of loads to it.
 * Measured against the backend access log, per asset (offsets from the
 * message being sent):
 *
 *   366f948b:  404 @ +0.00s  404 @ +0.52s  404 @ +1.54s  200 @ +3.57s
 *   0a3eb70c:  404 @ +0.00s  404 @ +0.52s  404 @ +1.54s  404 @ +3.56s  200 @ +6.93s
 *
 * The second asset needed a fifth request, past 6.9s, to land -- well beyond
 * what the old 3.5s budget could ever cover. The gap between "sent" and
 * "flushed" is a random position inside the 10s window, so a budget that
 * only covers a third of it loses a large fraction of the time by
 * construction, independent of server load.
 *
 * The optimistic bubble -- sender and recipient alike, since the message is
 * broadcast to the room as soon as it lands in Redis -- can therefore paint
 * an `<img>`/`<video>` pointed at `/api/media/{assetId}` many seconds before
 * the Postgres row exists, and `media_proxy` answers 404 until it does.
 * Browsers never retry a failed image/video load on their own, so without
 * this the attachment stayed a broken image until a full page reload, by
 * which time the row was always there.
 *
 * The same bounded retry also covers a genuine, permanent 404/403 (a deleted
 * asset, revoked room access): an `onError` event carries no HTTP status, so
 * there is no way to tell the two cases apart from the DOM alone, and no
 * need to -- every element that uses this policy still falls back to the
 * existing "preview unavailable" treatment once attempts run out. A real
 * failure just takes a few extra seconds to get there instead of failing on
 * the first try.
 *
 * The schedule below doubles from 500ms across five attempts, landing at
 * cumulative +0.5s / +1.5s / +3.5s / +7.5s / +15.5s. The first three
 * attempts are byte-for-byte the old schedule, so the common case -- an
 * upload whose row lands within 3-4s -- still resolves exactly as fast as
 * before; nothing here makes the fast path slower. The total, 15.5s, clears
 * the 10s flush interval above with a 5.5s (55%) margin, so a load that just
 * misses one flush is still comfortably covered by the next one. If
 * `FLUSH_INTERVAL_SECS` ever changes, re-check this budget against it --
 * that exact mismatch is what made the previous schedule too short.
 */
export const MEDIA_RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000, 4000, 8000];

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
