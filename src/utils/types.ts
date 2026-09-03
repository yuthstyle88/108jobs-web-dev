import {
    ProposalView,
    CategoryView,
    CreateOAuthProvider,
    GetSiteResponse, ListBankAccountsResponse,
    ListCategoriesResponse,
    ListUserChatRoomsResponse,
    MyUserInfo,
    PersonView,
} from "@108-plaza/jh-client";
import {RequestState} from "@/services/HttpService";
import {Match} from "@/utils/router"


export interface IsoData<T extends RouteData = RouteData> {
    jwt?: string;
    path: string;
    routeData: T;
    siteRes?: GetSiteResponse;
    categories?: ListCategoriesResponse,
    chatRooms?: ListUserChatRoomsResponse,
    bankAccounts?: ListBankAccountsResponse,
    myUserInfo?: MyUserInfo;
    errorPageData?: ErrorPageData;
    appUrl: string | undefined;
}

declare global {
    interface Window {
        isoData: IsoData;
        checkLazyScripts?: () => void;
    }
}

export interface InitialFetchRequest<
    P extends Record<string, string> = Record<string, never>,
    T extends object = Record<string, never>,
> {
    path: string;
    query: T;
    match: Match<P>;
    site: GetSiteResponse;
    headers: { [key: string]: string };
}

export interface IRouteProps {
    computedMatch?: Match | null;
    path?: string;
    exact?: boolean;
    strict?: boolean;
    sensitive?: boolean;
}

export enum ProposalViewType {
    Tree,
    Flat,
}

export enum DataType {
    Post,
    Proposal,
}

export enum BanType {
    Category,
    Site,
}

export type ProposalNodeView = ProposalView;

export interface ProposalNodeI {
    proposalView: ProposalNodeView;
    children: Array<ProposalNodeI>;
    depth: number;
}

export type RouteData = Record<string, RequestState<unknown>>;

export interface Choice {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface CategoryTribute {
    key: string;
    view: CategoryView;
}

export interface ErrorPageData {
    error?: string;
    adminMatrixIds?: string[];
}

export interface PersonTribute {
    key: string;
    view: PersonView;
}

export type QueryParams<T extends Record<string, unknown>> = {
    [key in keyof T]?: string;
};

export type RouteDataResponse<T extends Record<string, unknown>> = {
    [K in keyof T]: RequestState<T[K]>;
};

export type ThemeColor =
    | "primary"
    | "secondary"
    | "light"
    | "dark"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "blue"
    | "indigo"
    | "purple"
    | "pink"
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "teal"
    | "cyan"
    | "white"
    | "gray"
    | "gray-dark";

export interface CrossPostParams {
    name: string;
    url?: string;
    body?: string;
    altText?: string;
    nsfw?: StringBoolean;
    customThumbnailUrl?: string;
}

export type StringBoolean = "true" | "false";

export type ProviderToEdit = Omit<
    CreateOAuthProvider,
    "client_id" | "client_secret"
>;
