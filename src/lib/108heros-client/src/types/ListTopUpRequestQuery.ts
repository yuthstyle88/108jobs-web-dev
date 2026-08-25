import {TopUpStatus} from "./TopUpStatus";
import {PaginationCursor} from "./PaginationCursor";

export type ListTopUpRequestQuery = {
    /** Filter bounds in MINOR units, matching the stored column. */
    amountMinMinor?: number;
    amountMaxMinor?: number;
    /** Optional filter by status (Pending, Success, Expired) */
    status?: TopUpStatus;
    /** Optional filter by year of createdAt */
    year?: number;
    /** Optional filter by month of createdAt */
    month?: number;
    /** Optional filter by day of createdAt */
    day?: number;
    /** Pagination cursor for forward/backward navigation */
    pageCursor?: PaginationCursor;
    pageBack?: boolean;
    /** Limit results (default 20) */
    limit?: number;
};