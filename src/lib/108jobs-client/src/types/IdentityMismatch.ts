/**
 * Two readings of one 13-digit number that do not agree.
 *
 * Reported, never adjudicated. `fromLicence` is read on the applicant's own
 * device and is NOT verified by the platform.
 */
export type IdentityMismatch = {
    fromCard: string;
    fromLicence: string;
};
