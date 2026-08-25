import {AdminListUsers} from "./types/AdminListUsers";
import {CategoryIdQuery} from "./types/CategoryIdQuery";
import {ChatHistoryQuery} from "./types/ChatHistoryQuery";
import {DeleteImageParams} from "./types/DeleteImageParams";
import {GetBankAccounts} from "./types/GetBankAccounts";
import {GetBillingByRoomQuery} from "./types/GetBillingByRoomQuery";
import {GetCategory} from "./types/GetCategory";
import {GetProposals} from "./types/GetProposals";
import {GetPersonDetails} from "./types/GetPersonDetails";
import {GetPost} from "./types/GetPost";
import {GetPosts} from "./types/GetPosts";
import {GetSiteMetadata} from "./types/GetSiteMetadata";
import {LastReadQuery} from "./types/LastReadQuery";
import {ListCategories} from "./types/ListCategories";
import {ListMedia} from "./types/ListMedia";
import {ListPersonCreated} from "./types/ListPersonCreated";
import {NotificationPageQuery} from "./types/NotificationPageQuery";
import {ListRidersQuery} from "./types/ListRidersQuery";
import {ListUserChatRoomsQuery} from "./types/ListUserChatRoomsQuery";
import {ListUserReviewsQuery} from "./types/ListUserReviewsQuery";
import {PeerStatusQuery} from "./types/PeerStatusQuery";
import {Search} from "./types/Search";

export const VERSION = "v4";

export interface UploadImage {
    image: File | Buffer;
}

// tsoa doesn't currently support types in GET queries, so these need to be extended.
// https://github.com/lukeautry/tsoa/issues/1743
export interface ListMediaI extends ListMedia {
}

export interface SearchI extends Search {
}

export interface GetCategoryI extends GetCategory {
}

export interface ListCategoriesI extends ListCategories {
}

export interface GetPostI extends GetPost {
}

export interface GetPostsI extends GetPosts {
}

export interface GetSiteMetadataI extends GetSiteMetadata {
}

export interface GetProposalsI extends GetProposals {
}

export interface GetPersonDetailsI extends GetPersonDetails {
}

export interface ListPersonCreatedI extends ListPersonCreated {
}

export interface DeleteImageParamsI extends DeleteImageParams {
}

export interface AdminListUsersI extends AdminListUsers {
}

export interface CategoryIdQueryI extends CategoryIdQuery {
}

export interface ListUserChatRoomsQueryI extends ListUserChatRoomsQuery {
}

export interface ListUserReviewsQueryI extends ListUserReviewsQuery {
}

export interface ChatHistoryQueryI extends ChatHistoryQuery {
}

export interface LastReadQueryI extends LastReadQuery {
}

export interface PeerStatusQueryI extends PeerStatusQuery {
}

export interface GetBillingByRoomQueryI extends GetBillingByRoomQuery {
}

export interface GetBankAccountsI extends GetBankAccounts {
}

export interface ListRidersQueryI extends ListRidersQuery {
}

export interface NotificationPageQueryI extends NotificationPageQuery {
}
