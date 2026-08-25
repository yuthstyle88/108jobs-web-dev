import {Coin} from "./Coin";
import {WithdrawStatus} from "./WithdrawStatus";

/**
 * Fetches a list of withdrawal requests for a user.
 */
export type ListWithdrawRequestQuery = {
    /** Minimum withdrawal amount filter */
    amountMin?: Coin;

    /** Maximum withdrawal amount filter */
    amountMax?: Coin;

    /** Optional filter by status (Pending, Rejected, Completed) */
    status?: WithdrawStatus;

    /** Optional filter by year of created_at */
    year?: number;

    /** Optional filter by month of created_at */
    month?: number;

    /** Optional filter by day of created_at */
    day?: number;

    /** Pagination cursor for forward/backward navigation */
    pageCursor?: string;

    /** If true, fetch results before the cursor instead of after */
    pageBack?: boolean;

    /** Limit results (default 20) */
    limit?: number;
};
