import type {OrderSummary} from "@/lib/108jobs-client/src";

/**
 * How the Orders tab groups a conversation's orders.
 *
 * A 108Jobs room holds every order two people have run together, and completed
 * and cancelled ones must stay visible -- that is the whole of #136, where a
 * room reported only its single "current" workflow and ten finished orders with
 * real billings were unreachable.
 *
 * Active is anything not yet terminal. There can be more than one: two people
 * may run two jobs at the same time.
 */
export type OrderGroups = {
    active: OrderSummary[];
    completed: OrderSummary[];
    cancelled: OrderSummary[];
};

const TERMINAL = new Set(["Completed", "Cancelled"]);

export function isActiveOrder(order: OrderSummary): boolean {
    return !TERMINAL.has(order.status as string);
}

/**
 * Groups without reordering. The server returns newest first and that is the
 * order each group keeps -- re-sorting here would mean two sources of truth for
 * "which is the current deal", and the server's is the one with the sequence
 * number.
 */
export function groupOrders(orders: readonly OrderSummary[]): OrderGroups {
    const groups: OrderGroups = {active: [], completed: [], cancelled: []};
    for (const order of orders) {
        if (order.status === "Completed") groups.completed.push(order);
        else if (order.status === "Cancelled") groups.cancelled.push(order);
        else groups.active.push(order);
    }
    return groups;
}

/**
 * The order a freshly opened room should select.
 *
 * The newest active one, because that is the deal in progress. Falling back to
 * the newest of anything at all matters: a conversation whose orders have all
 * finished still has a history worth showing, and selecting nothing there is
 * what made the tab look empty.
 */
export function defaultSelectedOrder(
    orders: readonly OrderSummary[],
): OrderSummary | null {
    return orders.find(isActiveOrder) ?? orders[0] ?? null;
}

/**
 * Whether "Hire Again" can pick the job itself.
 *
 * Only when the conversation has exactly one job in its history. With several,
 * silently reusing the most recent one would start a real order, holding real
 * coins, against a job the employer did not choose -- so the UI has to ask.
 */
export function canInferPostForRehire(
    orders: readonly OrderSummary[],
): number | null {
    const postIds = new Set(orders.map(o => Number(o.postId)));
    if (postIds.size !== 1) return null;
    const [only] = [...postIds];
    return Number.isFinite(only) ? only : null;
}

/**
 * The job "Hire again" offers as its default -- never the one it starts with.
 *
 * The draft context is the post the chat was opened from, so it is the first
 * choice to offer. Failing that, a conversation about exactly one job may offer
 * that job. Failing that, nothing: with several jobs in the history, picking
 * the most recent would start a real order, holding real coins, against a job
 * the employer never chose.
 */
export function preselectPostForRehire(
    draftPostId: number | null | undefined,
    orders: readonly OrderSummary[],
): number | null {
    if (draftPostId != null && Number.isFinite(Number(draftPostId))) {
        return Number(draftPostId);
    }
    return canInferPostForRehire(orders);
}
