import {RiderVerificationStatus} from "./RiderVerificationStatus";
import {RiderDocumentKind} from "./RiderDocumentKind";
import {RiderRejectionIssue} from "./RiderRejectionIssue";
import {PreviousReview} from "./PreviousReview";

export type RiderDecision = {
    status: RiderVerificationStatus;
    verifiedAt?: string | null;

    /**
     * Derived from the first issue in `issues`. Populated only when
     * `status` is `"Rejected"`. Still served, and not deprecated -- kept so
     * a shipped client that only reads this field keeps working.
     */
    rejectionReason?: string | null;

    /** Derived from the first issue's document, when it named one. */
    rejectedDocument?: RiderDocumentKind | null;
    reviewedAt?: string | null;

    /** Every problem this rejection named, in the admin's own order. */
    issues: Array<RiderRejectionIssue>;

    /**
     * Populated only when a stored reason no longer explains the current
     * status -- i.e. a resubmission put the application back to Pending.
     */
    previousReview?: PreviousReview | null;
};
