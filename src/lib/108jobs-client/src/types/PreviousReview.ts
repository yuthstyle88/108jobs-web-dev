import {RiderDocumentKind} from "./RiderDocumentKind";
import {RiderRejectionIssue} from "./RiderRejectionIssue";

export type PreviousReview = {
    reason: string;

    /** Which document the previous rejection named, when it named one. */
    rejectedDocument?: RiderDocumentKind | null;
    reviewedAt?: string | null;

    /** Every problem the previous rejection named, in the admin's own order. */
    issues: Array<RiderRejectionIssue>;
};
