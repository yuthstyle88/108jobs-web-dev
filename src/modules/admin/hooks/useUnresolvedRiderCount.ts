"use client";

import {useMemo} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";

/**
 * How many rider applications are waiting for an admin decision.
 *
 * `GET /admin/notifications/unresolved-count`. A role-addressed notification is
 * *resolved* by whoever acts on it rather than *read* by an owner, so this is a
 * queue depth, not an unread badge: it falls to zero when the applications are
 * decided, by any admin, and does not go down just because this one looked.
 *
 * The count is deliberately not derived from the Pending riders list. That list
 * is one page (10 by default), so counting it would report "10" for a queue of
 * fifty — and the two answer different questions anyway: a rider can sit in
 * Pending with no outstanding notification once an admin has acted.
 */
export const useUnresolvedRiderCount = () => {
    const {data, isLoading} = useHttpGet("adminUnresolvedNotificationCount", {
        // A queue depth other admins are changing under us. Revalidating on
        // focus is the cheapest way to stop showing a number that went stale
        // while this tab sat in the background.
        revalidateOnFocus: true,
    });

    // `count` is typed `bigint` because ts-rs maps Rust's `i64` that way, but
    // the runtime payload is always a plain `number` -- `JSON.parse` never
    // produces a real bigint. Anything downstream expecting a number (i18next's
    // `count`, a comparison, arithmetic) needs this conversion, and a `bigint`
    // reaching i18next silently renders nothing.
    const count = useMemo(() => {
        const raw = data?.count;
        if (raw === undefined || raw === null) return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }, [data?.count]);

    return {count, isLoading};
};
