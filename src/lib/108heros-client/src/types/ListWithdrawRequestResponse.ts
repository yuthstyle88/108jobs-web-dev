import {WithdrawRequestView} from "./WithdrawRequestView";
import {PaginationCursor} from "./PaginationCursor";

/**
 * Response containing a list of withdrawal requests and pagination info.
 */
export type ListWithdrawRequestResponse = {
    /** The list of withdrawal requests (with user/bank info if needed) */
    withdrawRequests: WithdrawRequestView[];

    /** The pagination cursor to fetch the next page */
    nextPage?: PaginationCursor;

    /** The pagination cursor to fetch the previous page */
    prevPage?: PaginationCursor;
};
