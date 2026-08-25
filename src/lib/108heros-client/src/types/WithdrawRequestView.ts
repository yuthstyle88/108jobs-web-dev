import {LocalUser} from "./LocalUser";
import {BankAccount} from "./BankAccount";
import {WithdrawRequest} from "./WithdrawRequest";

/**
 * A Withdrawal Request view, including withdraw_request, local_user, and bank_account.
 */
export type WithdrawRequestView = {
    withdrawRequest: WithdrawRequest;
    localUser: LocalUser;
    bankAccount: BankAccount;
};
