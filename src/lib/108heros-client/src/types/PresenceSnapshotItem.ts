import {PresenceStatus} from "./PresenceStatus";
import {LocalUserId} from "./LocalUserId";

export type PresenceSnapshotItem = {
    userId: LocalUserId;
    status: PresenceStatus;
    at: string;
    lastSeen?: string;
};
