/**
 * Query-string pagination for `GET /notifications` and
 * `GET /admin/notifications`. `limit` is bounded by `check_fetch_limit` at the
 * handler, never trusted as-is -- an unbounded value there would be a
 * denial-of-service vector.
 *
 * ts-rs generates these two as `bigint`, because Rust types them `i64`. That is
 * right for a field coming *back* over the wire (see `NotificationCountResponse`,
 * kept verbatim and converted with `Number()` at its boundary), but wrong for one
 * going *out*: these become query-string parameters, callers hold plain numbers,
 * and `JSON.stringify` throws on a real bigint. `ListRidersQuery` resolves the
 * same tension the same way, so this matches its shape rather than the generator's.
 */
export type NotificationPageQuery = {
    limit?: number | null;
    offset?: number | null;
};
