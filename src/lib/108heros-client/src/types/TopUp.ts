import type {CurrencyId} from "./CurrencyId";
import type {TopUpRequestId} from "./TopUpRequestId";
import type {TopUpStatus} from "./TopUpStatus";

/**
 * Ask the server to open a top-up.
 *
 * `amountMinor` is the only number the client chooses, and it is in the
 * currency's MINOR units — satang for THB, so ฿100 is `10000`. The old SCB
 * endpoint took an entire bank QR body with the amount as a free-text string;
 * everything else about the payment is now the server's decision.
 */
export type CreateTopUpRequest = {
    amountMinor: number;
};

export type TopUpResponse = {
    topUpRequestId: TopUpRequestId;
    /** Quote this back to poll the status. */
    paymentIntentId: string;
    /**
     * EMVCo PromptPay payload — a string, not an image. The gateway returns the
     * payload and the client renders the QR itself; SCB used to hand back a
     * ready-made base64 PNG (`qrImage`).
     */
    qrPayload?: string | null;
    amountMinor: number;
    amountCoin: number;
    currencyCode: string;
    currencyId: CurrencyId;
    status: TopUpStatus;
    expiresAt: string;
    paidAt?: string | null;
};
