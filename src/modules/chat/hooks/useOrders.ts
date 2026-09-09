import {useCallback, useMemo, useRef} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {REQUEST_STATE} from "@/services/HttpService";
import type {OrderSummary} from "@/lib/108jobs-client/src";
import {defaultSelectedOrder, groupOrders} from "@/modules/chat/utils/groupOrders";

/**
 * Every order in a conversation, from the server.
 *
 * The Orders tab used to read `room.workflow` — one `Option<Workflow>`, the
 * room's single *active* workflow. A conversation now holds every order two
 * people have run together, and a room whose newest order happened to be
 * cancelled reported exactly that and nothing else, hiding ten finished orders
 * with real billings (#136).
 *
 * Refreshing re-reads from the server rather than trusting local state: the
 * stepper was a client-only machine advanced by clicks, so reopening a room
 * showed a finished job as not started.
 */
export function useOrders(roomId: string | null | undefined) {
    const res = useHttpGet(
        "listOrdersByRoom",
        roomId ? ({roomId} as never) : undefined,
        {revalidateOnFocus: true},
    );

    // `res.state` is the object SWR cached and `res.data` is read off it, so
    // both are stable while the data is. `res.execute` is NOT: `useHttpGet`
    // builds it as a fresh closure on every render.
    const orders: OrderSummary[] = useMemo(() => {
        if (!roomId) return [];
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return [];
        return (res.data?.orders ?? []) as OrderSummary[];
    }, [res?.state, res?.data, roomId]);

    // Derived from `orders` and nothing else. These objects are what
    // `ChatRoomView` builds the sidebar node from, and a pre-existing
    // `useLayoutEffect` there pushes that node into `JobFlowSidebarContext`
    // through a plain `useState` setter whenever it changes. With `execute` in
    // this list the groups were rebuilt on every render, so every render set
    // the context, re-rendered the provider, re-rendered the view, and rebuilt
    // the groups -- React's "Maximum update depth exceeded", and an error
    // boundary where the conversation should have been.
    const groups = useMemo(() => groupOrders(orders), [orders]);
    const fallbackSelection = useMemo(() => defaultSelectedOrder(orders), [orders]);

    // A stable handle on the unstable closure, so a consumer may put `refresh`
    // in an effect's dependency list without re-running it every render.
    const executeRef = useRef(res?.execute);
    executeRef.current = res?.execute;
    const refresh = useCallback(() => executeRef.current?.(), []);

    return {
        orders,
        groups,
        /** The order a freshly opened room should show. */
        fallbackSelection,
        isLoading: !!roomId && !!res?.isLoading,
        /** Re-read from the server; used after an action changes an order. */
        refresh,
    };
}
