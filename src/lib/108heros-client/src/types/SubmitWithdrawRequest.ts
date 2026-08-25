import {WalletId} from "./WalletId";
import {BankAccountId} from "./BankAccountId";
import {Coin} from "./Coin";
import {CurrencyId} from "./CurrencyId";

/**
 * Client submits a withdrawal request.
 */
export type SubmitWithdrawRequest = {
    /** The ID of the wallet from which funds will be withdrawn */
    walletId: WalletId;

    /** The ID of the user's bank account to receive the withdrawal */
    bankAccountId: BankAccountId;

    /** The amount of coins to withdraw */
    amount: Coin;

    /** The currency the withdrawal is denominated in (backend uses this to resolve the conversion rate) */
    currencyId: CurrencyId;

    /** Reason for the withdrawal, max 500 characters */
    reason: string;
};
