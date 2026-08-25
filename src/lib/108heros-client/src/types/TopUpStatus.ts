export enum TopUpStatus {
    Pending = "Pending",
    Success = "Success",
    /** The QR was never paid before it lapsed. */
    Expired = "Expired",
}
