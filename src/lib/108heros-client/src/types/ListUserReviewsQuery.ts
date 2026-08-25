import {PersonId} from "./PersonId";
import {PaginationCursor} from "./PaginationCursor";

export type ListUserReviewsQuery = {
    profileId: PersonId;
    pageCursor?: PaginationCursor;
    pageBack?: boolean;
    limit?: number;
};