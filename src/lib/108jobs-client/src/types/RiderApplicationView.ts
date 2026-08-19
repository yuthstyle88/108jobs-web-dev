import {RiderApplicationFields} from "./RiderApplicationFields";
import {RiderDocumentSlot} from "./RiderDocumentSlot";
import {RiderDecision} from "./RiderDecision";
import {RiderReviewDetail} from "./RiderReviewDetail";

export type RiderApplicationView = {
    fields: RiderApplicationFields;
    documents: RiderDocumentSlot[];
    decision: RiderDecision;

    /** Admin only. Absent when the caller is the rider themselves. */
    review?: RiderReviewDetail | null;
};
