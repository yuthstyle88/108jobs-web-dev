import {useMemo} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService";
import {toHireAgainPosts} from "@/modules/chat/utils/hireAgainPosts";

/**
 * The employer's own jobs, for the "Hire again" picker.
 *
 * Only jobs (`Normal`): rides and deliveries have no workflow and cannot carry
 * an order. Only fetched when the viewer is the employer, because nobody else
 * can start one.
 */
export function useHireAgainPosts(
    creatorId: number | null | undefined,
    enabled: boolean,
) {
    const active = Boolean(enabled && creatorId);
    const res = useHttpGet(
        "getPosts",
        active
            ? ({creatorId, postKind: "Normal", limit: 50} as never)
            : undefined,
    );

    // Derived from the data alone. `useHttpGet` rebuilds `execute` on every
    // render, and a dependency on it here would hand `FreelanceChatFlow` a new
    // array on every render -- the render loop `useOrders` documents.
    const posts = useMemo(() => {
        if (!active) return [];
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return [];
        return toHireAgainPosts(res.data?.posts as never);
    }, [active, res?.state, res?.data]);

    return {posts, isLoading: active && !!res?.isLoading};
}
