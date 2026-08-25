import {WithdrawRequestId} from "./WithdrawRequestId";

export type RejectWithdrawalRequest = {
    withdrawalId: WithdrawRequestId;
    reason: string;
};