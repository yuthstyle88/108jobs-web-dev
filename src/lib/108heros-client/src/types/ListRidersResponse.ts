import {RiderView} from "./RiderView";
import {PaginationCursor} from "./PaginationCursor";

export type ListRidersResponse = {
    riders: RiderView[];
    nextPage?: PaginationCursor | null;
    prevPage?: PaginationCursor | null;
};
