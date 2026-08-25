"use client";

import {useMemo} from "react";
import type {NotificationWithDecision} from "108jobs-client";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";

/**
 * How many rows the bell panel asks for. Deliberately small: this is a glance
 * surface, and `manage-riders` is where an admin works a queue properly. The
 * server bounds `limit` through `check_fetch_limit` regardless of what we send.
 */
export const ADMIN_NOTIFICATION_PANEL_LIMIT = 10;

/**
 * The rider applications waiting for an admin decision, newest first.
 *
 * `GET /admin/notifications` returns only UNRESOLVED rows, so this list and
 * `useUnresolvedRiderCount` always agree: deciding an application removes it
 * from both. That makes the panel a work queue rather than a history — there is
 * no endpoint that returns decided admin notifications, and an entry
 * disappearing is the intended outcome of acting on it, not a bug.
 *
 * Params go through as an array so the SWR options in the third argument stay
 * out of the query string: `useHttpGet` treats a bare object as *both* the
 * request form and the SWR config, which would send `revalidateOnFocus` to the
 * server as a query parameter.
 */
export const useAdminNotifications = (limit = ADMIN_NOTIFICATION_PANEL_LIMIT) => {
    const {data, isLoading, error, execute: refresh} = useHttpGet(
        "adminListNotifications",
        [{limit}],
        {
            // Another admin working the same queue changes this list under us.
            // Revalidating on focus is the cheapest way to stop showing entries
            // somebody else has already dealt with.
            revalidateOnFocus: true,
        },
    );

    const notifications: NotificationWithDecision[] = useMemo(
        () => data?.notifications ?? [],
        [data?.notifications],
    );

    return {notifications, isLoading, error, refresh};
};
