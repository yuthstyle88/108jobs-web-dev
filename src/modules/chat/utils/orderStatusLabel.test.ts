import {describe, expect, it} from "vitest";

import {orderStatusLabelKey} from "./orderStatusLabel";

/**
 * This app's own word for an order's status.
 *
 * The history rows and the selector line both showed the server's raw enum --
 * `WaitForFreelancerQuotation` -- while the stepper right beside them said
 * "Wait For Quotation" and the phone said the same. One order read as two
 * different things depending on where you looked.
 *
 * The stepper's own seven labels already exist; this maps a status onto them so
 * there is one wording, on both clients.
 */
describe("the word for an order's status", () => {
    it("uses the stepper's own labels", () => {
        expect(orderStatusLabelKey("WaitForFreelancerQuotation")).toBe("profileChat.step1");
        expect(orderStatusLabelKey("QuotationPendingReview")).toBe("profileChat.step2");
        expect(orderStatusLabelKey("OrderApproved")).toBe("profileChat.step3");
        expect(orderStatusLabelKey("InProgress")).toBe("profileChat.step4");
        expect(orderStatusLabelKey("PendingEmployerReview")).toBe("profileChat.step5");
        expect(orderStatusLabelKey("Completed")).toBe("profileChat.step6");
        expect(orderStatusLabelKey("Cancelled")).toBe("profileChat.step7");
    });

    it("falls back to the server's own word for one it does not know", () => {
        // A newer server can add a status, and an unknown one must read as
        // itself rather than as blank.
        expect(orderStatusLabelKey("SomethingNewer")).toBeNull();
        expect(orderStatusLabelKey(undefined)).toBeNull();
    });
});
