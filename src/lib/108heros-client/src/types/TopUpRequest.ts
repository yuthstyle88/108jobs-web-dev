import {LocalUserId} from "./LocalUserId";
import {TopUpRequestId} from "./TopUpRequestId";
import {TopUpStatus} from "./TopUpStatus";
import {CurrencyId} from "./CurrencyId";
import {Coin} from "./Coin";

export type TopUpRequest = {
    id: TopUpRequestId;
    localUserId: LocalUserId;
    /** MINOR units of `currencyId` — satang for THB, so ฿100 is 10000. */
    amountMinor: number;
    currencyId: CurrencyId;
    amountCoin: Coin;
    conversionRateUsed: number;
    /** The Payment-Platform intent this top-up settles through. */
    paymentIntentId: string;
    expiresAt: string; // ISO 8601 datetime string
    status: TopUpStatus;
    transferred: boolean;
    createdAt: string; // ISO 8601 datetime string
    updatedAt: string; // ISO 8601 datetime string
    paidAt?: string | null; // Optional ISO datetime
};
