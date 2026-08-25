import {PaginationCursor} from "./PaginationCursor";
import {RiderVerificationStatus} from "./RiderVerificationStatus";

export type ListRidersQuery = {
    pageCursor?: PaginationCursor | null;
    pageBack?: boolean | null;
    limit?: number | null;

    /** Shipped parameter, still honoured. `status` wins when both are sent. */
    verified?: boolean | null;

    /**
     * The rider's actual state. `verified` cannot express Rejected: both
     * Pending and Rejected read as `false` through it.
     */
    status?: RiderVerificationStatus | null;
};
