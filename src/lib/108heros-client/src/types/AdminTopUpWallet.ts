import {LocalUserId} from "./LocalUserId";

/**
 * Admin top-up payload. The amount is not carried here — the backend re-reads
 * it from the locked TopUpRequest row identified by the payment-intent id, so a
 * client-supplied amount would be ignored.
 */
export type AdminTopUpWallet = {
    targetUserId: LocalUserId;
    paymentIntentId: string;
    reason: string;
};
