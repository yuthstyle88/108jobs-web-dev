import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {callHttp, REQUEST_STATE} from "@/services/HttpService";
import type {OrderSummary} from "@108-plaza/jh-client";
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
/** The server's own default page size, which `loadMore` asks by offset against. */
const PAGE_SIZE = 20;

export function useOrders(roomId: string | null | undefined) {
    const res = useHttpGet(
        "listOrdersByRoom",
        roomId ? ({roomId} as never) : undefined,
        {revalidateOnFocus: true},
    );

    // `res.state` is the object SWR cached and `res.data` is read off it, so
    // both are stable while the data is. `res.execute` is NOT: `useHttpGet`
    // builds it as a fresh closure on every render.
    const firstPage: OrderSummary[] = useMemo(() => {
        if (!roomId) return [];
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return [];
        return (res.data?.orders ?? []) as OrderSummary[];
    }, [res?.state, res?.data, roomId]);

    /**
     * The server's count for the whole conversation.
     *
     * The endpoint answers 20 at a time and says how many there are; this hook
     * used to ignore both, so a conversation with 21 orders showed the newest
     * 20 and said nothing about the rest (#156).
     */
    const total: number = useMemo(() => {
        if (!roomId) return 0;
        if (res?.state?.state !== REQUEST_STATE.SUCCESS) return 0;
        return Number(res.data?.total ?? 0);
    }, [res?.state, res?.data, roomId]);

    // Pages beyond the first, which SWR does not hold: its cache is keyed by
    // the query, and every further page is a different query.
    const [extraPages, setExtraPages] = useState<OrderSummary[]>([]);
    const loadingMoreRef = useRef(false);

    // A different conversation is a different history, and a refresh of the
    // first page invalidates what was appended to it.
    //
    // Same reference when there is nothing to clear: `setExtraPages([])` is a
    // new array every time, so it re-renders on every mount -- and this hook's
    // whole contract is that identical data hands back identical objects, or
    // `ChatRoomView`'s sidebar effect loops (see the note above `groups`).
    useEffect(() => {
        setExtraPages(prev => (prev.length === 0 ? prev : []));
    }, [roomId, firstPage]);

    const orders: OrderSummary[] = useMemo(
        () => (extraPages.length === 0 ? firstPage : [...firstPage, ...extraPages]),
        [firstPage, extraPages],
    );

    const hasMore = orders.length < total;

    /**
     * Reads the next page and appends it.
     *
     * Refuses to run twice at once: the modal asks from a scroll handler, which
     * fires many times per gesture.
     */
    const loadMore = useCallback(async () => {
        if (!roomId || loadingMoreRef.current) return;
        if (orders.length >= total) return;

        loadingMoreRef.current = true;
        try {
            const res = await callHttp("listOrdersByRoom", {
                roomId,
                limit: PAGE_SIZE,
                offset: orders.length,
            } as never);
            const page = ((res as {data?: {orders?: OrderSummary[]}})?.data?.orders ??
                []) as OrderSummary[];
            if (page.length > 0) setExtraPages(prev => [...prev, ...page]);
        } finally {
            loadingMoreRef.current = false;
        }
    }, [roomId, orders.length, total]);

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
    // Updated from an effect, not during render: writing a ref while rendering
    // is what `react-hooks/refs` refuses, and the initial `useRef` value covers
    // a `refresh` called before the first effect runs.
    useEffect(() => {
        executeRef.current = res?.execute;
    });
    const refresh = useCallback(() => executeRef.current?.(), []);

    return {
        orders,
        groups,
        /** How many orders the conversation has, loaded or not. */
        total,
        /** Whether anything past `orders` is still on the server. */
        hasMore,
        /** Reads the next page and appends it. */
        loadMore,
        /** The order a freshly opened room should show. */
        fallbackSelection,
        isLoading: !!roomId && !!res?.isLoading,
        /** Re-read from the server; used after an action changes an order. */
        refresh,
    };
}
