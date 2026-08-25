import {TopUpRequestView} from "./TopUpRequestView";
import type {PaginationCursor} from "./PaginationCursor";

export type ListTopUpRequestResponse = {
    topUpRequests: TopUpRequestView[];
    nextPage?: PaginationCursor;
    prevPage?: PaginationCursor;
};