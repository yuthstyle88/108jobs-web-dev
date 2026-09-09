// useWorkflow.ts (client hook)
import {useState} from "react";

/** The order the Orders tab has selected, when there is one. */
export interface SelectedOrder {
    workflowId: number;
    billingId?: number | null;
}

export function useWorkflow(
    roomId: string | undefined,
    roomData?: any,
    opts: { resetBillingOnRoomChange?: boolean; selectedOrder?: SelectedOrder | null } = {}
) {
    // options
    const { resetBillingOnRoomChange = true, selectedOrder = null } = opts;
    const [workflowId, setWorkflowId] = useState<number | null>(null);
    // billingId is created after quotation; start as null and resolve later
    const [billingId, setBillingId] = useState<number | null>(null);

    // Hydrate workflowId from backend payload whenever roomId/roomData changes.
    // This mirrors React's documented "adjust state when a prop changes" pattern:
    // we remember which (roomId, roomData) pair workflowId was last derived from,
    // and re-derive it synchronously during render (instead of in an effect) when
    // either one changes, avoiding an extra cascading render.
    const [workflowSyncedFor, setWorkflowSyncedFor] = useState<{ roomId: string | undefined; roomData: any }>({
        roomId: undefined,
        roomData: undefined,
    });
    if (roomId && (roomId !== workflowSyncedFor.roomId || roomData !== workflowSyncedFor.roomData)) {
        setWorkflowSyncedFor({ roomId, roomData });
        const idFromRoom =
            (roomData?.room?.workflow?.id as number) ??
            (roomData?.workflow?.id as number) ??
            undefined;
        const parsed = idFromRoom == null ? null : Number(idFromRoom);
        setWorkflowId(!Number.isNaN(parsed as number) ? (parsed as number) : null);
    }

    // Optionally reset billingId when switching rooms so new payload can hydrate it.
    // Same pattern: remember the roomId billingId was last reset for.
    const [billingResetForRoomId, setBillingResetForRoomId] = useState<string | undefined>(undefined);
    if (resetBillingOnRoomChange && roomId !== billingResetForRoomId) {
        setBillingResetForRoomId(roomId);
        setBillingId(null);
    }

    // Hydrate billingId from backend payload when available (do not overwrite if already resolved).
    // The `billingId == null` check itself is the "already synced" guard here, so this
    // naturally settles after one derivation and won't clobber a value resolved another
    // way (e.g., after createBilling API).
    // Not when an order is selected: that selection owns the billing, and this
    // block would put the room's single workflow's billing back over it -- so an
    // approve or a cancel would move another order's escrow. The `billingId ==
    // null` guard cannot see the difference between "nothing resolved yet" and
    // "resolved to none, deliberately".
    if (roomId && billingId == null && !selectedOrder) {
        const raw =
            (roomData as any)?.room?.workflow?.billingId ??
            (roomData as any)?.workflow?.billingId ??
            null;

        const parsedBilling = raw == null ? null : Number(raw);
        if (parsedBilling != null && !Number.isNaN(parsedBilling)) {
            setBillingId(parsedBilling);
        }
    }

    // An explicitly selected order wins over whatever the room says.
    //
    // Deliberately LAST. Three render-phase adjustments write these two values
    // -- the room-change reset, the room-payload hydration, and this -- and the
    // order they run in decides the answer. Placed earlier, the reset wiped the
    // selected order's billing back to null and the hydration then filled it
    // with the room's single workflow's billing, so an action aimed at one
    // order carried another order's money.
    //
    // `roomData.room.workflow` is a single `Option<Workflow>` -- the room's one
    // *active* workflow. A conversation now holds every order two people have
    // run together, so "the room's workflow" is no longer a way to name the one
    // an action is for: with two orders running it is a coin toss, and with all
    // of them finished it is whichever was newest. Once the Orders tab has a
    // selection, that is the answer.
    const [selectionSyncedFor, setSelectionSyncedFor] = useState<number | null>(null);
    if (selectedOrder && selectedOrder.workflowId !== selectionSyncedFor) {
        setSelectionSyncedFor(selectedOrder.workflowId);
        setWorkflowId(selectedOrder.workflowId);
        // Billing follows the order it belongs to. Leaving the previous order's
        // billing in place is how an action lands on another order's money.
        setBillingId(
            selectedOrder.billingId == null ? null : Number(selectedOrder.billingId),
        );
    }

    // expose setter ไว้ใช้หลังเรียก API (startWorkflow/…)
    return { workflowId, setWorkflowId, billingId, setBillingId };
}