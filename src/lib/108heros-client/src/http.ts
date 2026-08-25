import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Path,
    Post,
    Put,
    Queries,
    Route,
    Security,
    Tags,
    UploadedFile,
} from "@tsoa/runtime";
import type {
    AdminListUsersI,
    ChatHistoryQueryI,
    CategoryIdQueryI,
    DeleteImageParamsI,
    GetBankAccountsI,
    GetBillingByRoomQueryI,
    GetProposalsI,
    GetCategoryI,
    GetPersonDetailsI,
    GetPostI,
    GetPostsI,
    GetSiteMetadataI,
    LastReadQueryI,
    ListCategoriesI,
    ListMediaI,
    ListPersonCreatedI,
    ListUserChatRoomsQueryI, ListUserReviewsQueryI, PeerStatusQueryI,
    SearchI,
    UploadImage, ListRidersQueryI,
} from "./other_types";
import {VERSION} from "./other_types";
import type {AdminListUsers} from "./types/AdminListUsers";
import type {AdminListUsersResponse} from "./types/AdminListUsersResponse";
import type {BanksResponse} from "./types/BankList";
import type {BanPerson} from "./types/BanPerson";
import type {BanPersonResponse} from "./types/BanPersonResponse";
import type {ProposalResponse} from "./types/ProposalResponse";
import type {CategoryIdQuery} from "./types/CategoryIdQuery";
import type {CategoryResponse} from "./types/CategoryResponse";
import type {CountriesResponse} from "./types/CountriesResponse";
import type {BankAccountForm} from "./types/BankAccountForm";
import type {CreateProposal} from "./types/CreateProposal";
import type {CreateCategory} from "./types/CreateCategory";
import type {CreateCategoryTag} from "./types/CreateCategoryTag";
import type {CreatePost} from "./types/CreatePost";
import type {DeleteAccount} from "./types/DeleteAccount";
import type {DeleteBankAccount} from "./types/DeleteBankAccount";
import type {DeleteProposal} from "./types/DeleteProposal";
import type {DeleteCategory} from "./types/DeleteCategory";
import type {DeleteCategoryTag} from "./types/DeleteCategoryTag";
import type {DeletePost} from "./types/DeletePost";
import type {EditProposal} from "./types/EditProposal";
import type {EditCategory} from "./types/EditCategory";
import type {EditPost} from "./types/EditPost";
import type {ExchangeKey} from "./types/ExchangeKey";
import type {ExchangeKeyResponse} from "./types/ExchangeKeyResponse";
import type {BankAccountsResponse} from "./types/GetBankAccountResponse";
import type {GetProposals} from "./types/GetProposals";
import type {GetProposalsResponse} from "./types/GetProposalsResponse";
import type {GetPost} from "./types/GetPost";
import type {GetPostResponse} from "./types/GetPostResponse";
import type {GetPosts} from "./types/GetPosts";
import type {GetPostsResponse} from "./types/GetPostsResponse";
import type {GetSiteResponse} from "./types/GetSiteResponse";
import type {EditSiteRequest} from "./types/EditSiteRequest";
import type {SiteResponse} from "./types/SiteResponse";
import type {GetUnreadSnapshotResponse} from "./types/GetUnreadSnapshotResponse";
import type {PresenceSnapshotItem} from "./types/PresenceSnapshotItem";
import type {IdentityPlatformAuthResponse} from "./types/IdentityPlatformAuthResponse";
import type {IdentityPlatformLoginResponse} from "./types/IdentityPlatformLoginResponse";
import type {ListCategories} from "./types/ListCategories";
import type {ListCategoriesResponse} from "./types/ListCategoriesResponse";
import type {ListPersonCreated} from "./types/ListPersonCreated";
import type {ListPersonCreatedResponse} from "./types/ListPersonCreatedResponse";
import type {ListBankAccountsResponse} from "./types/ListBankAccountsResponse";
import type {GetBankAccounts} from "./types/GetBankAccounts";
import type {Login} from "./types/Login";
import type {LoginResponse} from "./types/LoginResponse";
import type {MyUserInfo} from "./types/MyUserInfo";
import type {PostResponse} from "./types/PostResponse";
import type {RefreshIdentityPlatform} from "./types/RefreshIdentityPlatform";
import type {RegisterIdentityPlatform} from "./types/RegisterIdentityPlatform";
import type {ResendVerificationEmail} from "./types/ResendVerificationEmail";
import type {SaveUserProfile} from "./types/SaveUserProfile";
import type {SaveUserSettings} from "./types/SaveUserSettings";
import type {Search} from "./types/Search";
import type {SearchResponse} from "./types/SearchResponse";
import type {SetDefaultBankAccount} from "./types/SetDefaultBankAccount";
import type {SuccessResponse} from "./types/SuccessResponse";
import type {Tag} from "./types/Tag";
import type {UpdateCategoryTag} from "./types/UpdateCategoryTag";
import type {UploadImageResponse} from "./types/UploadImageResponse";
import type {FileUploadResponse} from "./types/FileUploadResponse";
import type {VerifyEmail} from "./types/VerifyEmail";
import type {VisitProfileResponse} from "./types/VisitProfileResponse";
import type {ListUserChatRoomsResponse} from "./types/ListUserChatRoomsResponse";
import type {ChatRoomId} from "./types/ChatRoomId";
import type {ChatRoomResponse} from "./types/ChatRoomResponse";
import type {CreateChatRoomRequest} from "./types/CreateChatRoomRequest";
import type {CreateInvoiceForm} from "./types/CreateInvoiceForm";
import type {CreateInvoiceResponse} from "./types/CreateInvoiceResponse";
import type {ApproveQuotationForm} from "./types/ApproveQuotationForm";
import type {WorkFlowOperationResponse} from "./types/WorkFlowOperationResponse";
import type {StartWorkflowForm} from "./types/StartWorkflowForm";
import type {SubmitStartWorkForm} from "./types/SubmitStartWorkForm";
import type {CancelJobForm} from "./types/CancelJobForm";
import type {RequestRevisionForm} from "./types/RequestRevisionForm";
import type {ApproveWorkForm} from "./types/ApproveWorkForm";
import type {UserKeysResponse} from "./types/UserKeysResponse";
import type {ChatHistoryQuery} from "./types/ChatHistoryQuery";
import type {ChatMessagesResponse} from "./types/ChatMessagesResponse";
import type {Billing} from "./types/Billing";
import type {GetBillingByRoomQuery} from "./types/GetBillingByRoomQuery";
import type {CreateTopUpRequest, TopUpResponse} from "./types/TopUp";
import type {BillingId} from "./types/BillingId";
import type {LastReadQuery} from "./types/LastReadQuery";
import type {LastReadResponse} from "./types/LastReadResponse";
import type {PeerReadResponse} from "./types/PeerReadResponse";
import type {PeerStatusQuery} from "./types/PeerStatusQuery";
import type {SubmitUserReviewForm} from "./types/SubmitUserReviewForm";
import type {SubmitUserReviewResponse} from "./types/SubmitUserReviewResponse";
import type {ListUserReviewsResponse} from "./types/ListUserReviewsResponse";
import type {ListUserReviewsQuery} from "./types/ListUserReviewsQuery";
import {BankAccountOperationResponse} from "./types/BankAccountOperationResponse";
import {UpdateBankAccount} from "./types/UpdateBankAccount";
import {ListTopUpRequestQuery} from "./types/ListTopUpRequestQuery";
import {ListTopUpRequestResponse} from "./types/ListTopUpRequestResponse";
import {AdminTopUpWallet} from "./types/AdminTopUpWallet";
import {AdminWalletOperationResponse} from "./types/AdminWalletOperationResponse";
import {ListWithdrawRequestQuery} from "./types/ListWithdrawRequestQuery";
import {ListWithdrawRequestResponse} from "./types/ListWithdrawRequestResponse";
import {SubmitWithdrawRequest} from "./types/SubmitWithdrawRequest";
import {AdminWithdrawWallet} from "./types/AdminWithdrawWallet";
import {RejectWithdrawalRequest} from "./types/RejectWithdrawalRequest";
import {ListBankAccountQuery} from "./types/ListBankAccountQuery";
import {VerifyBankAccount} from "./types/VerifyBankAccount";
import {ListRidersQuery} from "./types/ListRidersQuery";
import {ListRidersResponse} from "./types/ListRidersResponse";
import {AdminVerifyRiderRequest} from "./types/AdminVerifyRiderRequest";
import {GetRiderResponse} from "./types/GetRiderResponse";
import {ListUserChatRoomsQuery} from "./types/ListUserChatRoomsQuery";

enum HttpType {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Delete = "DELETE",
}

type RequestOptions = Pick<RequestInit, "signal">;

/**
 * HTTP client for the 108heros API.
 */
@Route("api/v4")
export class Api108Heros extends Controller {
    #apiUrl: string;
    #headers: { [key: string]: string } = {};
    #fetchFunction: typeof fetch = fetch.bind(globalThis);

    /**
     * Generates a new instance of Api108Heros.
     * @param baseUrl the base url, without the vX version: https://api.108heros.com -> goes to https://api.108heros.com/api/vX
     * @param headers optional headers. Should contain `x-real-ip` and `x-forwarded-for` .
     */
    constructor(
        baseUrl: string,
        options?: {
            fetchFunction?: typeof fetch;
            headers?: { [key: string]: string };
        },
    ) {
        super();
        this.#apiUrl = `${baseUrl.replace(/\/+$/, "")}/api/${VERSION}`;

        if (options?.headers) {
            this.#headers = options.headers;
        }
        if (options?.fetchFunction) {
            this.#fetchFunction = options.fetchFunction;
        }
    }

    /**
     * @summary Gets the site, and your profile data.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/site")
    @Tags("Site")
    async getSite(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, GetSiteResponse>(
            HttpType.Get,
            "/site",
            {},
            options,
        );
    }

    /**
     * Edit a site.
     */
    @Security("bearerAuth")
    @Put("/site")
    @Tags("Admin", "Site")
    async updateSite(
        @Body() form: EditSiteRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<EditSiteRequest, SiteResponse>(
            HttpType.Put,
            "/site",
            form,
            options,
        );
    }

    /**
     * @summary Get data of current profile.
     */
    @Security("bearerAuth")
    @Get("/account")
    @Tags("Account")
    async getMyUser(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, MyUserInfo>(
            HttpType.Get,
            "/account",
            {},
            options,
        );
    }

    /**
     * @summary Get data of current profile.
     */
    @Security("bearerAuth")
    @Get("/account/profile/countries")
    @Tags("Account")
    async getCountries(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, CountriesResponse>(
            HttpType.Get,
            "/account/profile/countries",
            {},
            options,
        );
    }

    /**
     * @summary List banks.
     */
    @Security("bearerAuth")
    @Get("/account/banks")
    @Tags("Account")
    async listBanks(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, BanksResponse>(
            HttpType.Get,
            "/account/banks",
            {},
            options,
        );
    }

    /**
     * @summary Export a backup of your profile settings.
     *
     * Export a backup of your profile settings, including your saved content,
     * followed categories, and blocks.
     */
    @Security("bearerAuth")
    @Get("/account/settings/export")
    @Tags("Account")
    async exportSettings(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, string>(
            HttpType.Get,
            "/account/settings/export",
            {},
            options,
        );
    }

    /**
     * @summary Import a backup of your profile settings.
     */
    @Security("bearerAuth")
    @Post("/account/settings/import")
    @Tags("Account")
    async importSettings(@Body() form: any, @Inject() options?: RequestOptions) {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Post,
            "/account/settings/import",
            form,
            options,
        );
    }

    /**
     * @summary List all wallet topups (admin view).
     */
    @Security("bearerAuth")
    @Get("/admin/wallet/top-ups")
    @Tags("Admin", "TopUpRequests")
    async adminListTopUpRequests(
        @Queries() form: ListTopUpRequestQuery = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListTopUpRequestQuery, ListTopUpRequestResponse>(
            HttpType.Get,
            "/admin/wallet/top-ups",
            form,
            options,
        );
    }

    /**
     * @summary List all wallet WithdrawalRequests (admin view).
     */
    @Security("bearerAuth")
    @Get("/admin/wallet/withdraw-requests")
    @Tags("Admin", "WithdrawalRequests")
    async adminListWithdrawRequests(
        @Queries() form: ListWithdrawRequestQuery = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListWithdrawRequestQuery, ListWithdrawRequestResponse>(
            HttpType.Get,
            "/admin/wallet/withdraw-requests",
            form,
            options,
        );
    }

    /**
     * @summary List all BankAccounts (admin view).
     */
    @Security("bearerAuth")
    @Get("/admin/bank-account/list")
    @Tags("Admin", "BankAccounts")
    async adminListBankAccounts(
        @Queries() form: ListBankAccountQuery = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListBankAccountQuery, ListBankAccountsResponse>(
            HttpType.Get,
            "/admin/bank-account/list",
            form,
            options,
        );
    }

    /**
     * Admin top up
     */
    @Security("bearerAuth")
    @Post("/admin/bank-account/verify")
    @Tags("Admin", "Top-up")
    async adminVerifyBankAccount(
        @Body() form: VerifyBankAccount,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<VerifyBankAccount, SuccessResponse>(
            HttpType.Post,
            "/admin/bank-account/verify",
            form,
            options,
        );
    }


    /**
     * Admin top up
     */
    @Security("bearerAuth")
    @Post("/admin/wallet/top-up")
    @Tags("Admin", "Top-up")
    async adminTopUpWallet(
        @Body() form: AdminTopUpWallet,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<AdminTopUpWallet, AdminWalletOperationResponse>(
            HttpType.Post,
            "/admin/wallet/top-up",
            form,
            options,
        );
    }

    /**
     * Admin withdraws coin for user
     */
    @Security("bearerAuth")
    @Post("/admin/wallet/withdraw")
    @Tags("Admin", "Withdraw")
    async adminWithdrawWallet(
        @Body() form: AdminWithdrawWallet,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<AdminWithdrawWallet, AdminWalletOperationResponse>(
            HttpType.Post,
            "/admin/wallet/withdraw",
            form,
            options,
        );
    }

    /**
     * Admin withdraws coin for user
     */
    @Security("bearerAuth")
    @Post("/admin/wallet/withdraw-requests/reject")
    @Tags("Admin", "Withdraw")
    async adminRejectWithdrawRequest(
        @Body() form: RejectWithdrawalRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RejectWithdrawalRequest, SuccessResponse>(
            HttpType.Post,
            "/admin/wallet/withdraw-requests/reject",
            form,
            options,
        );
    }

    /**
     * @summary Search. If `search-term` is a url it also attempts to fetch it.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/search")
    @Tags("Miscellaneous")
    async search(@Queries() form: SearchI, @Inject() options?: RequestOptions) {
        return this.#wrapper<Search, SearchResponse>(
            HttpType.Get,
            "/search",
            form,
            options,
        );
    }

    /**
     * @summary Create a new category.
     */
    @Security("bearerAuth")
    @Post("/category")
    @Tags("Category")
    async createCategory(
        @Body() form: CreateCategory,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateCategory, CategoryResponse>(
            HttpType.Post,
            "/category",
            form,
            options,
        );
    }

    /**
     * @summary Edit a category.
     */
    @Security("bearerAuth")
    @Put("/category")
    @Tags("Category")
    async editCategory(
        @Body() form: EditCategory,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<EditCategory, CategoryResponse>(
            HttpType.Put,
            "/category",
            form,
            options,
        );
    }

    /**
     * @summary List categories, with various filters.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/category/list")
    @Tags("Category")
    async listCategories(
        @Queries() form: ListCategoriesI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListCategories, ListCategoriesResponse>(
            HttpType.Get,
            "/category/list",
            form,
            options,
        );
    }

    /**
     * @summary Delete a category.
     */
    @Security("bearerAuth")
    @Post("/category/delete")
    @Tags("Category")
    async deleteCategory(
        @Body() form: DeleteCategory,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeleteCategory, CategoryResponse>(
            HttpType.Post,
            "/category/delete",
            form,
            options,
        );
    }

    /**
     * @summary Create a category post tag.
     */
    @Security("bearerAuth")
    @Post("/category/tag")
    @Tags("Category")
    async createCategoryTag(
        @Body() form: CreateCategoryTag,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateCategoryTag, Tag>(
            HttpType.Post,
            "/category/tag",
            form,
            options,
        );
    }

    /**
     * @summary Update a category post tag.
     */
    @Security("bearerAuth")
    @Put("/category/tag")
    @Tags("Category")
    async updateCategoryTag(
        @Body() form: UpdateCategoryTag,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<UpdateCategoryTag, Tag>(
            HttpType.Put,
            "/category/tag",
            form,
            options,
        );
    }

    /**
     * @summary Delete a post tag in a category.
     */
    @Security("bearerAuth")
    @Delete("/category/tag")
    @Tags("Category")
    async deleteCategoryTag(
        @Body() form: DeleteCategoryTag,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeleteCategoryTag, Tag>(
            HttpType.Delete,
            "/category/tag",
            form,
            options,
        );
    }

    /**
     * @summary Create a post.
     */
    @Security("bearerAuth")
    @Post("/post")
    @Tags("Post")
    async createPost(
        @Body() form: CreatePost,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreatePost, PostResponse>(
            HttpType.Post,
            "/post",
            form,
            options,
        );
    }

    /**
     * @summary Get / fetch a post.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/post")
    @Tags("Post")
    async getPost(
        @Queries() form: GetPostI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<GetPost, GetPostResponse>(
            HttpType.Get,
            "/post",
            form,
            options,
        );
    }

    /**
     * @summary Edit a post.
     */
    @Security("bearerAuth")
    @Put("/post")
    @Tags("Post")
    async editPost(@Body() form: EditPost, @Inject() options?: RequestOptions) {
        return this.#wrapper<EditPost, PostResponse>(
            HttpType.Put,
            "/post",
            form,
            options,
        );
    }

    /**
     * @summary Delete a post.
     */
    @Security("bearerAuth")
    @Post("/post/delete")
    @Tags("Post")
    async deletePost(
        @Body() form: DeletePost,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeletePost, PostResponse>(
            HttpType.Post,
            "/post/delete",
            form,
            options,
        );
    }

    /**
     * @summary Get / fetch posts, with various filters.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/post/list")
    @Tags("Post")
    async getPosts(
        @Queries() form: GetPostsI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<GetPosts, GetPostsResponse>(
            HttpType.Get,
            "/post/list",
            form,
            options,
        );
    }

    /**
     * @summary Create a proposal.
     */
    @Security("bearerAuth")
    @Post("/proposal")
    @Tags("Proposal")
    async createProposal(
        @Body() form: CreateProposal,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateProposal, ProposalResponse>(
            HttpType.Post,
            "/proposal",
            form,
            options,
        );
    }

    /**
     * @summary Edit a proposal.
     */
    @Security("bearerAuth")
    @Put("/proposal")
    @Tags("Proposal")
    async editProposal(
        @Body() form: EditProposal,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<EditProposal, ProposalResponse>(
            HttpType.Put,
            "/proposal",
            form,
            options,
        );
    }

    /**
     * @summary Delete a proposal.
     */
    @Security("bearerAuth")
    @Post("/proposal/delete")
    @Tags("Proposal")
    async deleteProposal(
        @Body() form: DeleteProposal,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeleteProposal, ProposalResponse>(
            HttpType.Post,
            "/proposal/delete",
            form,
            options,
        );
    }

    /**
     * @summary Get / fetch proposals.
     */
    @Security("bearerAuth")
    @Security({})
    @Get("/proposal/list")
    @Tags("Proposal")
    async getProposals(
        @Queries() form: GetProposalsI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<GetProposals, GetProposalsResponse>(
            HttpType.Get,
            "/proposal/list",
            form,
            options,
        );
    }

    /**
     * @summary Log in via Identity-Platform.
     */
    @Post("/account/auth/login/identity-platform")
    @Tags("Account")
    async loginWithIdentityPlatform(@Body() form: Login, @Inject() options?: RequestOptions) {
        return this.#wrapper<Login, IdentityPlatformLoginResponse>(
            HttpType.Post,
            "/account/auth/login/identity-platform",
            form,
            options,
        );
    }

    /**
     * @summary Refresh an access token via Identity-Platform.
     */
    @Post("/account/auth/refresh/identity-platform")
    @Tags("Account")
    async refreshWithIdentityPlatform(
        @Body() form: RefreshIdentityPlatform,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RefreshIdentityPlatform, IdentityPlatformLoginResponse>(
            HttpType.Post,
            "/account/auth/refresh/identity-platform",
            form,
            options,
        );
    }

    /**
     * @summary Register (and immediately log in) via Identity-Platform.
     */
    @Post("/account/auth/register/identity-platform")
    @Tags("Account")
    async registerWithIdentityPlatform(
        @Body() form: RegisterIdentityPlatform,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RegisterIdentityPlatform, IdentityPlatformAuthResponse>(
            HttpType.Post,
            "/account/auth/register/identity-platform",
            form,
            options,
        );
    }

    /**
     * @summary Exchange public key.
     */
    @Security("bearerAuth")
    @Post("/account/auth/exchange-public-key")
    @Tags("Account")
    async exchangePublicKey(
        @Body() form: ExchangeKey,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ExchangeKey, ExchangeKeyResponse>(
            HttpType.Post,
            "/account/auth/exchange-public-key",
            form,
            options,
        );
    }

    /**
     * @summary Invalidate the currently used auth token.
     */
    @Security("bearerAuth")
    @Post("/account/auth/logout")
    @Tags("Account")
    async logout(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Post,
            "/account/auth/logout",
            {},
            options,
        );
    }

    /**
     * @summary Ban a person from your site.
     */
    @Security("bearerAuth")
    @Post("/admin/ban")
    @Tags("Admin")
    async banPerson(@Body() form: BanPerson, @Inject() options?: RequestOptions) {
        return this.#wrapper<BanPerson, BanPersonResponse>(
            HttpType.Post,
            "/admin/ban",
            form,
            options,
        );
    }

    /**
     * @summary Get a list of users.
     */
    @Security("bearerAuth")
    @Get("/admin/users")
    @Tags("Admin", "Miscellaneous")
    async listUsers(
        @Queries() form: AdminListUsersI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<AdminListUsers, AdminListUsersResponse>(
            HttpType.Get,
            "/admin/users",
            form,
            options,
        );
    }

    /**
     * @summary Delete your account.
     */
    @Security("bearerAuth")
    @Post("/account/delete")
    @Tags("Account")
    async deleteAccount(
        @Body() form: DeleteAccount,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeleteAccount, SuccessResponse>(
            HttpType.Post,
            "/account/delete",
            form,
            options,
        );
    }

    /**
     * @summary Get bank account.
     */
    @Get("/account/bank-account")
    @Tags("Account")
    async getBankAccount(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, BankAccountsResponse>(
            HttpType.Get,
            "/account/bank-account",
            {},
            options,
        );
    }

    /**
     * @summary Set Default Bank Account.
     */
    @Security("bearerAuth")
    @Put("/account/bank-account/default")
    @Tags("Bank")
    async setDefaultBankAccount(
        @Body() form: SetDefaultBankAccount,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SetDefaultBankAccount, SuccessResponse>(
            HttpType.Put,
            "/account/bank-account/default",
            form,
            options,
        );
    }

    /**
     * @summary Create new bank account.
     */
    @Security("bearerAuth")
    @Post("/account/bank-account")
    @Tags("Account")
    async createBankAccount(
        @Body() form: BankAccountForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<BankAccountForm, BankAccountOperationResponse>(
            HttpType.Post,
            "/account/bank-account",
            form,
            options,
        );
    }

    /**
     * @summary update bank account.
     */
    @Security("bearerAuth")
    @Post("/account/bank-account")
    @Tags("Account")
    async updateBankAccount(
        @Body() form: UpdateBankAccount,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<UpdateBankAccount, BankAccountOperationResponse>(
            HttpType.Put,
            "/account/bank-account",
            form,
            options,
        );
    }

    /**
     * @summary Delete bank account.
     */
    @Security("bearerAuth")
    @Post("/account/bank-account/delete")
    @Tags("Account")
    async deleteBankAccount(
        @Body() form: DeleteBankAccount,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<DeleteBankAccount, SuccessResponse>(
            HttpType.Post,
            "/account/bank-account/delete",
            form,
            options,
        );
    }

    /**
     * @summary List user bank accounts
     */
    @Security("bearerAuth")
    @Get("/account/bank-account")
    @Tags("Account")
    async listUserBankAccounts(
        @Queries() form: GetBankAccountsI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<GetBankAccounts, ListBankAccountsResponse>(
            HttpType.Get,
            "/account/bank-account",
            form,
            options,
        );
    }

    /**
     * @summary Save your profile settings.
     */
    @Security("bearerAuth")
    @Put("/account/settings/save")
    @Tags("Account")
    async saveUserSettings(
        @Body() form: SaveUserSettings,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SaveUserSettings, SuccessResponse>(
            HttpType.Put,
            "/account/settings/save",
            form,
            options,
        );
    }

    /**
     * @summary Save your profile settings.
     */
    @Security("bearerAuth")
    @Put("/account/settings/update-profile")
    @Tags("Account")
    async updateProfile(
        @Body() form: SaveUserProfile,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SaveUserProfile, MyUserInfo>(
            HttpType.Put,
            "/account/settings/update-profile",
            form,
            options,
        );
    }

    /**
     * @summary Resend a verification email.
     */
    @Post("/account/auth/resend-verification-email")
    @Tags("Account")
    async resendVerificationEmail(
        @Body() form: ResendVerificationEmail,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ResendVerificationEmail, SuccessResponse>(
            HttpType.Post,
            "/account/auth/resend-verification-email",
            form,
            options,
        );
    }

    /**
     * @summary submit user review.
     */
    @Post("/reviews")
    @Tags("Reviews")
    async submitUserReview(
        @Body() form: SubmitUserReviewForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SubmitUserReviewForm, SubmitUserReviewResponse>(
            HttpType.Post,
            "/reviews",
            form,
            options,
        );
    }

    /**
     * @summary List user reviews
     */
    @Security("bearerAuth")
    @Get("/reviews")
    @Tags("Reviews")
    async listUserReviews(
        @Queries() form: ListUserReviewsQueryI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListUserReviewsQuery, ListUserReviewsResponse>(
            HttpType.Get,
            "/reviews",
            form,
            options,
        );
    }

    /**
     * @summary send a verification email.
     */
    @Post("/account/auth/verify-email")
    @Tags("Account")
    async verifyEmail(
        @Body() form: VerifyEmail,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<VerifyEmail, LoginResponse>(
            HttpType.Post,
            "/account/auth/verify-email",
            form,
            options,
        );
    }

    /**
     * @summary List your created content.
     */
    @Security("bearerAuth")
    @Get("/account/created")
    @Tags("Account")
    async listPersonCreated(
        @Queries() form: ListPersonCreatedI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListPersonCreated, ListPersonCreatedResponse>(
            HttpType.Get,
            "/account/created",
            form,
            options,
        );
    }

    /**
     * @summary List rider profile (admin only).
     */
    @Security("bearerAuth")
    @Get("/admin/riders/list")
    @Tags("Riders")
    async adminListRiders(
        @Queries() form: ListRidersQueryI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListRidersQuery, ListRidersResponse>(
            HttpType.Get,
            "/admin/riders/list",
            form,
            options,
        );
    }

    /**
     * @summary Admin verify rider
     */
    @Security("bearerAuth")
    @Post("/admin/riders/verify")
    @Tags("Admin", "Riders")
    async adminVerifyRider(
        @Body() form: AdminVerifyRiderRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<AdminVerifyRiderRequest, SuccessResponse>(
            HttpType.Post,
            "/admin/riders/verify",
            form,
            options,
        );
    }

    /**
     * @summary Read one rider's profile, with their application when the
     * caller is the rider or an admin.
     */
    @Security("bearerAuth")
    @Get("/riders/profile/{riderId}")
    @Tags("Riders")
    async getRiderApplication(
        @Path() riderId: number,
        @Inject() options?: RequestOptions,
    ): Promise<GetRiderResponse> {
        return this.#wrapper<object, GetRiderResponse>(
            HttpType.Get,
            `/riders/profile/${riderId}`,
            {},
            options,
        );
    }

    /**
     * @summary Visit profile
     */
    @Get("/account/profile")
    @Tags("Account")
    async visitProfile(
        @Path() username: string,
        @Inject() options?: RequestOptions
    ) {
        return this.#wrapper<object, VisitProfileResponse>(
            HttpType.Get,
            `/account/profile/${username}`,
            {},
            options
        );
    }

    /**
     * @summary Upload new profile avatar.
     */
    @Security("bearerAuth")
    @Post("/account/avatar")
    @Tags("Account", "Media")
    async uploadUserAvatar(
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#upload("/account/avatar", image, options);
    }

    /**
     * @summary Delete the profile avatar.
     */
    @Security("bearerAuth")
    @Delete("/account/avatar")
    @Tags("Account", "Media")
    async deleteUserAvatar(
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Delete,
            "/account/avatar",
            {},
            options,
        );
    }

    /**
     * @summary Upload new profile banner.
     */
    @Security("bearerAuth")
    @Post("/account/banner")
    @Tags("Account", "Media")
    async uploadUserBanner(
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#upload("/account/banner", image, options);
    }

    /**
     * @summary Upload a file to user account.
     */
    @Security("bearerAuth")
    @Post("/account/files")
    @Tags("Account", "Media")
    async uploadFile(
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<FileUploadResponse> {
        return this.#upload<FileUploadResponse>("/account/files", image, options);
    }

    /**
     * @summary Delete a previously uploaded user file by filename.
     */
    @Security("bearerAuth")
    @Delete("/account/files/{filename}")
    @Tags("Account", "Media")
    async deleteFile(
        @Path() filename: string,
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Delete,
            `/account/files/${filename}`,
            {},
            options,
        );
    }

    /**
     * @summary Delete the profile banner.
     */
    @Security("bearerAuth")
    @Delete("/account/banner")
    @Tags("Account", "Media")
    async deleteUserBanner(@Inject() options?: RequestOptions) {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Delete,
            "/account/banner",
            {},
            options,
        );
    }

    /**
     * @summary Upload new category icon.
     */
    @Security("bearerAuth")
    @Post("/category/icon")
    @Tags("Category", "Media")
    async uploadCategoryIcon(
        @Queries() query: CategoryIdQueryI,
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#uploadWithQuery("/category/icon", query, image, options);
    }

    /**
     * @summary Delete the category icon.
     */
    @Security("bearerAuth")
    @Delete("/category/icon")
    @Tags("Category", "Media")
    async deleteCategoryIcon(
        @Body() form: CategoryIdQuery,
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<CategoryIdQuery, SuccessResponse>(
            HttpType.Delete,
            "/category/icon",
            form,
            options,
        );
    }

    /**
     * @summary Upload new category banner.
     */
    @Security("bearerAuth")
    @Post("/category/banner")
    @Tags("Category", "Media")
    async uploadCategoryBanner(
        @Queries() query: CategoryIdQueryI,
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#uploadWithQuery("/category/banner", query, image, options);
    }

    /**
     * @summary Delete the category banner.
     */
    @Security("bearerAuth")
    @Delete("/category/banner")
    @Tags("Category", "Media")
    async deleteCategoryBanner(
        @Body() form: CategoryIdQuery,
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<CategoryIdQuery, SuccessResponse>(
            HttpType.Delete,
            "/category/banner",
            form,
            options,
        );
    }

    /**
     * @summary Upload new site icon.
     */
    @Security("bearerAuth")
    @Post("/site/icon")
    @Tags("Site", "Media")
    async uploadSiteIcon(
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#upload("/site/icon", image, options);
    }

    /**
     * @summary Delete the site icon.
     */
    @Security("bearerAuth")
    @Delete("/site/icon")
    @Tags("Site", "Media")
    async deleteSiteIcon(
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Delete,
            "/site/icon",
            {},
            options,
        );
    }

    /**
     * @summary Upload new site banner.
     */
    @Security("bearerAuth")
    @Post("/site/banner")
    @Tags("Site", "Media")
    async uploadSiteBanner(
        @UploadedFile() image: UploadImage,
        @Inject() options?: RequestOptions,
    ): Promise<UploadImageResponse> {
        return this.#upload("/site/banner", image, options);
    }

    /**
     * @summary Delete the site banner.
     */
    @Security("bearerAuth")
    @Delete("/site/banner")
    @Tags("Site", "Media")
    async deleteSiteBanner(
        @Inject() options?: RequestOptions,
    ): Promise<SuccessResponse> {
        return this.#wrapper<object, SuccessResponse>(
            HttpType.Delete,
            "/site/banner",
            {},
            options,
        );
    }

    /**
     * @summary Open a wallet top-up and mint its QR.
     *
     * Replaces `POST /scb/qrcode/create`, which took a whole bank QR body from
     * the client. The server now owns every field but the amount, and answers
     * with an EMVCo payload to render rather than a ready-made image.
     */
    @Security("bearerAuth")
    @Post("/payments/top-up")
    @Tags("TopUpRequests")
    async createTopUp(
        @Body() form: CreateTopUpRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateTopUpRequest, TopUpResponse>(
            HttpType.Post,
            "/payments/top-up",
            form,
            options,
        );
    }

    /**
     * @summary Ask whether a top-up has been paid.
     *
     * Replaces `POST /scb/inquire`. Read `status` — the old endpoint reported a
     * bank status code that callers had to guess at (`0 || 200 || 1000`).
     */
    @Security("bearerAuth")
    @Get("/payments/top-up/{paymentIntentId}")
    @Tags("TopUpRequests")
    async getTopUpStatus(
        @Path() paymentIntentId: string,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, TopUpResponse>(
            HttpType.Get,
            `/payments/top-up/${paymentIntentId}`,
            {},
            options,
        );
    }

    /**
     * @summary Create an invoice / quotation for a job.
     */
    @Security("bearerAuth")
    @Post("/account/services/create-invoice")
    @Tags("Billing")
    async createInvoice(
        @Body() form: CreateInvoiceForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateInvoiceForm, CreateInvoiceResponse>(
            HttpType.Post,
            "/account/services/create-invoice",
            form,
            options,
        );
    }

    /**
     * @summary Approve quotation and convert to order.
     */
    @Security("bearerAuth")
    @Post("/account/services/approve-quotation")
    @Tags("Billing")
    async approveQuotation(
        @Body() form: ApproveQuotationForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ApproveQuotationForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/approve-quotation",
            form,
            options,
        );
    }

    /**
     * @summary Submit a withdrawal request
     */
    @Security("bearerAuth")
    @Post("/account/wallet/withdraw-requests")
    @Tags("Wallet")
    async submitWithdraw(
        @Body() form: SubmitWithdrawRequest,
        @Inject() options?: RequestOptions
    ) {
        return this.#wrapper<SubmitWithdrawRequest, SuccessResponse>(
            HttpType.Post,
            "/account/wallet/withdraw-requests",
            form,
            options
        );
    }

    /**
     * @summary Get billing by proposal id.
     */
    @Security("bearerAuth")
    @Get("/account/services/billing/by-room")
    @Tags("Billing")
    async getBillingByRoom(
        @Queries() form: GetBillingByRoomQueryI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<GetBillingByRoomQuery, Billing>(
            HttpType.Get,
            "/account/services/billing/by-room",
            form,
            options,
        );
    }

    /**
     * @summary Get wallet top-ups for a user.
     */
    @Security("bearerAuth")
    @Get("/account/wallet/top-ups")
    @Tags("TopUpRequests")
    async listTopUpRequests(
        @Queries() form: ListTopUpRequestQuery,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListTopUpRequestQuery, ListTopUpRequestResponse>(
            HttpType.Get,
            "/account/wallet/top-ups",
            form,
            options,
        );
    }

    /**
     * @summary Get wallet withdraw-requests for a user.
     */
    @Security("bearerAuth")
    @Get("/account/wallet/withdraw-requests")
    @Tags("WithdrawRequests")
    async listWithdrawRequests(
        @Queries() form: ListWithdrawRequestQuery,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListWithdrawRequestQuery, ListWithdrawRequestResponse>(
            HttpType.Get,
            "/account/wallet/withdraw-requests",
            form,
            options,
        );
    }


    /**
     * @summary Get a Billing by ID.
     */
    @Security("bearerAuth")
    @Get("/account/services/billing/{id}")
    @Tags("Chat", "Billing")
    async getBillingById(
        @Path() id: BillingId,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, Billing>(
            HttpType.Get,
            `/account/services/billing/${id}`,
            {},
            options,
        );
    }

    /**
     * @summary Start or initialize a workflow for a post/sequence in a chat room.
     */
    @Security("bearerAuth")
    @Post("/account/services/start-workflow")
    @Tags("Services")
    async startWorkflow(
        @Body() form: StartWorkflowForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<StartWorkflowForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/start-workflow",
            form,
            options,
        );
    }

    /**
     * @summary Submit completed work (freelancer starts work).
     */
    @Security("bearerAuth")
    @Post("/account/services/start-work")
    @Tags("Services")
    async submitStartWork(
        @Body() form: SubmitStartWorkForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SubmitStartWorkForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/start-work",
            form,
            options,
        );
    }

    /**
     * @summary Submit work (freelancer finishes work by submitting their project).
     */
    @Security("bearerAuth")
    @Post("/account/services/submit-work")
    @Tags("Services")
    async submitWork(
        @Body() form: SubmitStartWorkForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<SubmitStartWorkForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/submit-work",
            form,
            options,
        );
    }

    /**
     * @summary Request revision on a submitted work (employer requests changes from freelancer).
     */
    @Security("bearerAuth")
    @Post("/account/services/request-revision")
    @Tags("Services")
    async requestRevision(
        @Body() form: RequestRevisionForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<RequestRevisionForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/request-revision",
            form,
            options,
        );
    }

    /**
     * @summary Approve work and release payment (employer approves).
     */
    @Security("bearerAuth")
    @Post("/account/services/approve-work")
    @Tags("Services")
    async approveWork(
        @Body() form: ApproveWorkForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ApproveWorkForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/approve-work",
            form,
            options,
        );
    }

    /**
     * @summary Cancel a workflow job.
     */
    @Security("bearerAuth")
    @Post("/account/services/cancel-job")
    @Tags("Services")
    async cancelJob(
        @Body() form: CancelJobForm,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CancelJobForm, WorkFlowOperationResponse>(
            HttpType.Post,
            "/account/services/cancel-job",
            form,
            options,
        );
    }

    /**
     * @summary Create a chat room.
     */
    @Security("bearerAuth")
    @Post("/chat/rooms")
    @Tags("Chat", "Room")
    async createChatRoom(
        @Body() form: CreateChatRoomRequest,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<CreateChatRoomRequest, ChatRoomResponse>(
            HttpType.Post,
            "/chat/rooms",
            form,
            options,
        );
    }

    /**
     * @summary Get a list of chat rooms.
     */
    @Security("bearerAuth")
    @Get("/chat/rooms")
    @Tags("Chat", "Room")
    async listChatRooms(
        @Queries() form: ListUserChatRoomsQueryI = {},
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ListUserChatRoomsQuery, ListUserChatRoomsResponse>(
            HttpType.Get,
            "/chat/rooms",
            form,
            options,
        );
    }

    /**
     * @summary Fetch chat history for a room.
     */
    @Security("bearerAuth")
    @Get("/chat/history")
    @Tags("Chat")
    async getChatHistory(
        @Queries() form: ChatHistoryQueryI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<ChatHistoryQuery, ChatMessagesResponse>(
            HttpType.Get,
            "/chat/history",
            form,
            options,
        );
    }

    /**
     * @summary Fetch last read for a user of a room.
     */
    @Security("bearerAuth")
    @Get("/chat/last-read")
    @Tags("Chat")
    async getLastRead(
        @Queries() form: LastReadQueryI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<LastReadQuery, LastReadResponse>(
            HttpType.Get,
            "/chat/last-read",
            form,
            options,
        );
    }

    /**
     * @summary Fetch last read for a user of a room.
     */
    @Security("bearerAuth")
    @Get("/chat/get-peer-status")
    @Tags("Chat")
    async getPeerStatus(
        @Queries() form: PeerStatusQueryI,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<PeerStatusQuery, PeerReadResponse>(
            HttpType.Get,
            "/chat/get-peer-status",
            form,
            options,
        );
    }

    /**
     * @summary Get unread snapshot for all rooms.
     */
    @Security("bearerAuth")
    @Get("/chat/unread-snapshot")
    @Tags("Chat")
    async getUnreadSnapshot(
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, GetUnreadSnapshotResponse>(
            HttpType.Get,
            "/chat/unread-snapshot",
            {},
            options,
        );
    }

    /**
     * @summary Get presence snapshot for all contacts.
     */
    @Security("bearerAuth")
    @Get("/chat/presence-snapshot")
    @Tags("Chat")
    async getPresenceSnapshot(
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, PresenceSnapshotItem[]>(
            HttpType.Get,
            "/chat/presence-snapshot",
            {},
            options,
        );
    }

    /**
     * @summary Get a chat room by ID.
     */
    @Security("bearerAuth")
    @Get("/chat/rooms/{id}")
    @Tags("Chat", "Room")
    async getChatRoom(
        @Path() id: ChatRoomId,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, ChatRoomResponse>(
            HttpType.Get,
            `/chat/rooms/${id}`,
            {},
            options,
        );
    }

    /**
     * @summary Get a user's published public keys.
     */
    @Security("bearerAuth")
    @Get("/users/{id}/keys")
    @Tags("User")
    async getUserKey(
        @Path() id: number,
        @Inject() options?: RequestOptions,
    ) {
        return this.#wrapper<object, UserKeysResponse>(
            HttpType.Get,
            `/users/${id}/keys`,
            {},
            options,
        );
    }

    /**
     * Set the headers (can be used to set the auth header)
     */
    setHeaders(headers: { [key: string]: string }) {
        this.#headers = headers;
    }

    #buildFullUrl(endpoint: string) {
        return `${this.#apiUrl}${endpoint}`;
    }

    async #upload<ResponseType>(
        path: string,
        {image}: UploadImage,
        options?: RequestOptions,
    ): Promise<ResponseType> {
        const isFileUpload = path.includes("/account/files") || path.includes("/chat/files");
        const fieldName = isFileUpload ? "file" : "images[]";
        const formData = createFormData(image, fieldName);

        const response = await this.#fetchFunction(this.#buildFullUrl(path), {
            ...options,
            method: HttpType.Post,
            body: formData as unknown as BodyInit,
            headers: this.#headers,
        });
        return response.json();
    }

    async #uploadWithQuery<QueryType extends object, ResponseType>(
        path: string,
        query: QueryType,
        {image}: UploadImage,
        options?: RequestOptions,
    ): Promise<ResponseType> {
        const qs = encodeGetParams(query);
        return this.#upload<ResponseType>(
            qs ? `${path}?${qs}` : path,
            {image},
            options,
        );
    }

    async #wrapper<BodyType extends object, ResponseType>(
        type_: HttpType,
        endpoint: string,
        form: BodyType,
        options: RequestOptions | undefined,
    ): Promise<ResponseType> {
        let response: Response;
        if (type_ === HttpType.Get) {
            const qs = encodeGetParams(form as object);
            const getUrl = qs ? `${this.#buildFullUrl(endpoint)}?${qs}` : this.#buildFullUrl(endpoint);
            response = await this.#fetchFunction(getUrl, {
                ...options,
                method: HttpType.Get,
                headers: this.#headers,
            });
        } else {
            response = await this.#fetchFunction(this.#buildFullUrl(endpoint), {
                ...options,
                method: type_,
                headers: {
                    "Content-Type": "application/json",
                    ...this.#headers,
                },
                body: JSON.stringify(form),
            });
        }

        let json: any | undefined = undefined;

        try {
            json = await response.json();
        } catch {
            throw new ApiRequestError(response.statusText);
        }

        if (!response.ok) {
            throw new ApiRequestError(json.error ?? response.statusText, json.message);
        } else {
            return json;
        }
    }
}

function encodeGetParams<BodyType extends object>(p: BodyType): string {
    return Object.entries(p)
        .filter(kv => kv[1] !== undefined && kv[1] !== null)
        .map(kv => kv.map(encodeURIComponent).join("="))
        .join("&");
}

function createFormData(image: File | Buffer, fieldName: string = "images[]"): FormData {
    const formData = new FormData();

    if (image instanceof File) {
        formData.append(fieldName, image);
    } else {
        const isUploadFile = fieldName === "uploadFile";
        const mime = isUploadFile ? "application/octet-stream" : "image/jpeg";
        const blob = new Blob([Buffer.isBuffer(image) ? new Uint8Array(image) : (image as unknown as ArrayBuffer)], {type: mime});
        const filename = isUploadFile ? "file.bin" : "image.jpg";
        formData.append(fieldName, blob, filename);
    }

    return formData;
}

/**
 * Thrown when an API request fails.
 *
 * The name is the i18n translatable error code.
 * The msg is either an empty string, or extra non-translatable info.
 */
export class ApiRequestError extends Error {
    constructor(name: string, msg?: string) {
        super(msg ?? "");
        this.name = name;

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ApiRequestError.prototype);
    }
}
