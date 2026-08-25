import {LocalUserId} from "./LocalUserId";
import {Coin} from "./Coin";
import {WithdrawRequestId} from "./WithdrawRequestId";

export type AdminWithdrawWallet = {
    targetUserId: LocalUserId;
    withdrawalId:  WithdrawRequestId;
    amount: Coin;
    reason: string;
};