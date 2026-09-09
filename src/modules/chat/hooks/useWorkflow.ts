// useWorkflow.ts (client hook)
import {useState} from "react";

export function useWorkflow(
    roomId: string | undefined,
    roomData?: any,
    opts: { resetBillingOnRoomChange?: boolean } = {}
) {
    // options
    const { resetBillingOnRoomChange = true } = opts;
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
    if (roomId && billingId == null) {
        const raw =
            (roomData as any)?.room?.workflow?.billingId ??
            (roomData as any)?.workflow?.billingId ??
            null;

        const parsedBilling = raw == null ? null : Number(raw);
        if (parsedBilling != null && !Number.isNaN(parsedBilling)) {
            setBillingId(parsedBilling);
        }
    }

    // expose setter ไว้ใช้หลังเรียก API (startWorkflow/…)
    return { workflowId, setWorkflowId, billingId, setBillingId };
}