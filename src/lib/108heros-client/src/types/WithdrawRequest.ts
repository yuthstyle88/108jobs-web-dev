import {WithdrawRequestId} from "./WithdrawRequestId";
import {LocalUserId} from "./LocalUserId";
import {WalletId} from "./WalletId";
import {BankAccountId} from "./BankAccountId";
import {WithdrawStatus} from "./WithdrawStatus";
import {Coin} from "./Coin";
import {CurrencyId} from "./CurrencyId";

/**
 * Withdrawal Request data.
 */
export type WithdrawRequest = {
    id: WithdrawRequestId;
    localUserId: LocalUserId;
    walletId: WalletId;
    userBankAccountId: BankAccountId;
    amount: Coin;
    currencyId: CurrencyId;
    amountCurrency: number;
    conversionRateUsed: number;
    status: WithdrawStatus;
    reason?: string;
    createdAt: string;
    updatedAt: string;
};
