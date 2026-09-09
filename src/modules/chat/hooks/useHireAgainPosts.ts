import {useMemo} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService";
import {toHireAgainPosts} from "@/modules/chat/utils/hireAgainPosts";

/**
 * The viewer's own jobs, for the "Hire again" picker.
 *
 * `/account/created`, not the post list: `GetPosts` has no creator filter at
 * all on the server -- passing one returns everybody's posts, and an order
 * started against a job the viewer does not own is refused by
 * `require_post_creator` after they have already confirmed.
 *
 * Only jobs (`Normal`): rides and deliveries carry no workflow. Only fetched
 * for the employer, because nobody else can start an order.
 */
export function useHireAgainPosts(enabled: boolean) {
    const res = useHttpGet(
        "listPersonCreated",
        // 30 is the server's `MAX_FETCH_LIMIT`. Above it the request fails
        // outright with `invalidFetchLimit` -- an empty picker, not a short one.
        enabled ? ({postKind: "Normal", limit: 30} as never) : undefined,
    );

    // Derived from the data alone. `useHttpGet` rebuilds `execute` on every
    // render, and a dependency on it here would hand `FreelanceChatFlow` a new
    // array on every render -- the render loop `useOrders` documents.
    const posts = useMemo(() => {
        if (!enabled) return [];
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return [];
        return toHireAgainPosts(res.data?.created as never);
    }, [enabled, res?.state, res?.data]);

    return {posts, isLoading: enabled && !!res?.isLoading};
}
