import {RiderVerificationStatus} from "./RiderVerificationStatus";
import {PreviousReview} from "./PreviousReview";

export type RiderDecision = {
    status: RiderVerificationStatus;
    verifiedAt?: string | null;

    /** Populated only when `status` is `"Rejected"`. */
    rejectionReason?: string | null;
    reviewedAt?: string | null;

    /**
     * Populated only when a stored reason no longer explains the current
     * status -- i.e. a resubmission put the application back to Pending.
     */
    previousReview?: PreviousReview | null;
};
