import {PaginationCursor} from "./PaginationCursor";
import {UserReviewView} from "./UserReviewView";

export type ListUserReviewsResponse = {
    reviews: UserReviewView[];
    nextPage?: PaginationCursor;
    prevPage?: PaginationCursor;
};