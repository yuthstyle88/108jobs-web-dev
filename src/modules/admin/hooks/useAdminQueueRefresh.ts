"use client";

import {useCallback} from "react";
import {useSWRConfig} from "swr";

/**
 * The cache keys that describe the rider review queue. `useHttpGet` builds a key
 * as `[methodName, ...args]`, so matching on the first element catches every
 * variant regardless of the page size or offset a caller asked for.
 */
const QUEUE_METHODS = new Set([
    "adminUnresolvedNotificationCount",
    "adminListNotifications",
]);

/**
 * Invalidate everything that describes the admin queue, after acting on it.
 *
 * Deciding an application resolves its queue notification, which changes both
 * the badge and the bell's list. Neither refreshes on its own: `revalidateOnFocus`
 * cannot help, because the decision happens in the same tab, which never loses
 * and regains focus.
 *
 * This invalidates by key rather than by calling each hook's own `refresh`, so a
 * component can say "the queue changed" without subscribing to data it does not
 * display -- the review page has no reason to fetch the bell's list just to be
 * able to expire it.
 */
export const useAdminQueueRefresh = () => {
    const {mutate} = useSWRConfig();

    return useCallback(
        () => mutate((key) => Array.isArray(key) && QUEUE_METHODS.has(key[0] as string)),
        [mutate],
    );
};
