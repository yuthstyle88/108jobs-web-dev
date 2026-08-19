import {RiderDocumentKind} from "./RiderDocumentKind";

export type RiderDocumentSlot = {
    kind: RiderDocumentKind;
    uploadedAt?: string | null;
};
