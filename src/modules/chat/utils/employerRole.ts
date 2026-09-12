/** What an order says about the two people on it. Absent on orders that predate the columns. */
type OrderParties = {
    employerId?: number | string | null;
};

/**
 * Which side of the selected order this person is on.
 *
 * A role exists per order, not per conversation: one room holds every order two
 * people have run together and the same two swap sides between orders. Deriving
 * it from the room's post creator told the employer of a finished order that
 * they were the freelancer, and hid every employer-only control from them
 * (#151).
 *
 * `roomFallback` is that older answer, and is still the right one for an order
 * created before the server recorded `employer_id`. `undefined` means "not
 * known yet" and must stay distinguishable from `false`: the caller renders
 * neither side's controls until it is known.
 */
export function employerOnOrder(
    order: OrderParties | null | undefined,
    myLocalUserId: number | string | null | undefined,
    roomFallback: boolean | undefined,
): boolean | undefined {
    const employerId = order?.employerId;
    if (employerId == null) return roomFallback;
    if (myLocalUserId == null) return undefined;
    return String(employerId) === String(myLocalUserId);
}

/** What `ChatRoomView` keeps about the order the panel is showing. */
export type OrderSelection = {
    workflowId: number;
    billingId: number | null;
    status: string | null;
    statusBeforeCancel: string | null;
    /** Per order, not per room: these two swap sides between orders. */
    employerId: number | null;
    /** What the selector line names the order by (#156). */
    seqNumber: number;
    postName: string | null;
};

/**
 * The selection built from a listed order.
 *
 * Shared by the two places that select one -- the default on open and a click
 * in the list -- because `employerOnOrder` can only answer when the selection
 * carries the parties, and a shape assembled twice drifts on one side.
 */
export function selectionFromOrder(order: {
    workflowId: number | string;
    billingId?: number | string | null;
    status?: string | null;
    statusBeforeCancel?: string | null;
    employerId?: number | string | null;
    seqNumber?: number | string | null;
    postName?: string | null;
}): OrderSelection {
    return {
        workflowId: Number(order.workflowId),
        billingId: order.billingId == null ? null : Number(order.billingId),
        status: order.status ?? null,
        statusBeforeCancel: order.statusBeforeCancel ?? null,
        employerId: order.employerId == null ? null : Number(order.employerId),
        seqNumber: Number(order.seqNumber ?? 0),
        postName: order.postName ?? null,
    };
}
