import {RiderId} from "./RiderId";
import {RiderDocumentKind} from "./RiderDocumentKind";

export type AdminVerifyRiderRequest = {
    riderId: RiderId;
    /** approve = true will mark rider as verified; false will reject */
    approve: boolean;

    /** Every problem with the application. Required when `approve` is false. */
    issues?: Array<{ document: RiderDocumentKind | null; reason: string }> | null;
    /** @deprecated single-issue form; `issues` wins when both are sent. */
    reason?: string | null;
    /** @deprecated pairs with `reason`. */
    rejectedDocument?: RiderDocumentKind | null;
};
