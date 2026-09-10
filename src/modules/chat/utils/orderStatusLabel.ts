/**
 * The translation key for this app's own word for an order's status.
 *
 * The history rows and the selector line showed the server's raw enum --
 * `WaitForFreelancerQuotation` -- while the stepper right beside them said
 * "Wait For Quotation", and the phone said the same. One order read as two
 * different things depending on where you looked.
 *
 * These are the stepper's own seven labels, so there is one wording per status
 * and nothing new to translate.
 *
 * `null` for a status this build does not know: a newer server can add one, and
 * the caller shows the server's own word rather than a blank.
 */
export function orderStatusLabelKey(status: string | null | undefined): string | null {
    switch (status) {
        case "WaitForFreelancerQuotation":
            return "profileChat.step1";
        case "QuotationPendingReview":
            return "profileChat.step2";
        case "OrderApproved":
            return "profileChat.step3";
        case "InProgress":
            return "profileChat.step4";
        case "PendingEmployerReview":
            return "profileChat.step5";
        case "Completed":
            return "profileChat.step6";
        case "Cancelled":
            return "profileChat.step7";
        default:
            return null;
    }
}
