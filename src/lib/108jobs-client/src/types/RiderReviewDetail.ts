import {LocalUserId} from "./LocalUserId";
import {IdentityMismatch} from "./IdentityMismatch";

export type RiderReviewDetail = {
    reviewedBy?: LocalUserId | null;

    /**
     * The platform's finding, not the applicant's declaration. Their consent
     * to be checked lives on `RiderApplicationFields`; the result lives here.
     */
    criminalRecordCheckedAt?: string | null;
    criminalRecordIsClear?: boolean | null;
    criminalRecordCheckedBy?: LocalUserId | null;
    identityMismatch?: IdentityMismatch | null;
};
