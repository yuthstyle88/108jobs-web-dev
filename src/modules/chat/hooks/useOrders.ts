import {useMemo} from "react";
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

    const orders: OrderSummary[] = useMemo(() => {
        if (!roomId) return [];
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return [];
        return (res.data?.orders ?? []) as OrderSummary[];
    }, [res?.state, res?.data, roomId]);

    return useMemo(
        () => ({
            orders,
            groups: groupOrders(orders),
            /** The order a freshly opened room should show. */
            fallbackSelection: defaultSelectedOrder(orders),
            isLoading: !!roomId && !!res?.isLoading,
            /** Re-read from the server; used after an action changes an order. */
            refresh: res?.execute,
        }),
        [orders, res?.isLoading, res?.execute, roomId],
    );
}
