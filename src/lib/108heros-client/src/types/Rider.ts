import {VehicleType} from "./VehicleType";
import {RiderVerificationStatus} from "./RiderVerificationStatus";
import {RiderId} from "./RiderId";
import {LocalUserId} from "./LocalUserId";
import {PersonId} from "./PersonId";

export type Rider = {
    id: RiderId;

    // References
    userId: LocalUserId;
    personId: PersonId;

    // Vehicle
    vehicleType: VehicleType;
    vehiclePlateNumber?: string | null;

    // Verification
    isVerified: boolean;
    isActive: boolean;
    verificationStatus: RiderVerificationStatus;

    // Performance
    rating: number;
    completedJobs: number;
    totalJobs: number;
    totalEarnings: number;
    pendingEarnings: number;

    // Availability
    isOnline: boolean;
    acceptingJobs: boolean;

    // Timestamps
    joinedAt?: string | null;
    lastActiveAt?: string | null;
    verifiedAt?: string | null;
};
