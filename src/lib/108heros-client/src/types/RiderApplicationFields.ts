import {DrivingLicenseType} from "./DrivingLicenseType";
import {VehicleRegistrationType} from "./VehicleRegistrationType";

export type RiderApplicationFields = {
    // Identity, off the card and confirmed by the applicant.
    nationalIdNumber?: string | null;
    idCardAddress?: string | null;
    fatherFullName?: string | null;
    motherFullName?: string | null;
    dateOfBirth?: string | null;

    // Licence.
    licenseNumber?: string | null;
    licenseExpiryDate?: string | null;
    licenseType?: DrivingLicenseType | null;
    licenseIssuedOn?: string | null;
    licenseIssuedAt?: string | null;

    // Vehicle and registration.
    vehicleRegistrationType?: VehicleRegistrationType | null;
    engineDisplacementCc?: number | null;
    vehicleFirstRegisteredOn?: string | null;
    vehicleTitleHolderName?: string | null;
    vehicleTitleHolderIdNumber?: string | null;
    vehiclePossessorName?: string | null;
    vehiclePossessorIdNumber?: string | null;

    // Insurance, both policies.
    insurancePolicyNumber?: string | null;
    insuranceExpiresOn?: string | null;
    compulsoryInsurancePolicyNumber?: string | null;
    compulsoryInsuranceExpiresOn?: string | null;

    // Payment.
    bankAccountName?: string | null;
    bankAccountNumber?: string | null;
    bankName?: string | null;

    // Emergency contact.
    emergencyContactName?: string | null;
    emergencyContactRelationship?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactAddress?: string | null;

    // Consent -- the applicant's own acts.
    faceConsentGrantedAt?: string | null;
    faceConsentVersion?: string | null;
    faceConsentWithdrawnAt?: string | null;
    emergencyContactConsentedAt?: string | null;
    criminalRecordConsentedAt?: string | null;
    criminalDeclarationAcceptedAt?: string | null;
};
