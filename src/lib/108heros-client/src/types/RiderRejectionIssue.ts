import {RiderDocumentKind} from "./RiderDocumentKind";

export type RiderRejectionIssue = {
    document: RiderDocumentKind | null;
    reason: string;
};
