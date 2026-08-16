// This file was hand-authored to match the backend's EditSiteRequest struct.
// Keep in sync with crates/db/src/source/site_view/api.rs in api-108jobs.
import type {ListingType} from "./ListingType";
import type {PostListingMode} from "./PostListingMode";
import type {PostSortType} from "./PostSortType";
import type {ProposalSortType} from "./ProposalSortType";
import type {RegistrationMode} from "./RegistrationMode";

/**
 * Edits a site.
 */
export type EditSiteRequest = {
    name?: string;
    /**
     * A sidebar for the site, in markdown.
     */
    sidebar?: string;
    /**
     * A shorter, one line description of your site.
     */
    description?: string;
    /**
     * Limits category creation to admins only.
     */
    categoryCreationAdminOnly?: boolean;
    /**
     * Whether to require email verification.
     */
    requireEmailVerification?: boolean;
    /**
     * Your application question form. This is in markdown, and can be many questions.
     */
    applicationQuestion?: string;
    /**
     * The default theme. Usually "browser"
     */
    defaultTheme?: string;
    /**
     * The default post listing type. Only "All" or "Local" are accepted.
     */
    defaultPostListingType?: ListingType;
    /**
     * Default value for listing mode, usually "List"
     */
    defaultPostListingMode?: PostListingMode;
    /**
     * The default post sort, usually "Active"
     */
    defaultPostSortType?: PostSortType;
    /**
     * A default time range limit to apply to post sorts, in seconds. 0 means none.
     */
    defaultPostTimeRangeSeconds?: number;
    /**
     * The default proposal sort, usually "Hot"
     */
    defaultProposalSortType?: ProposalSortType;
    /**
     * An optional page of legal information
     */
    legalInformation?: string;
    /**
     * Whether to email admins when receiving a new application.
     */
    applicationEmailAdmins?: boolean;
    /**
     * A regex string of items to filter.
     */
    slurFilterRegex?: string;
    /**
     * The max length of actor names.
     */
    actorNameMaxLength?: number;
    /**
     * The number of messages allowed in a given time frame.
     */
    rateLimitMessageMaxRequests?: number;
    rateLimitMessageIntervalSeconds?: number;
    /**
     * The number of posts allowed in a given time frame.
     */
    rateLimitPostMaxRequests?: number;
    rateLimitPostIntervalSeconds?: number;
    /**
     * The number of registrations allowed in a given time frame.
     */
    rateLimitRegisterMaxRequests?: number;
    rateLimitRegisterIntervalSeconds?: number;
    /**
     * The number of image uploads allowed in a given time frame.
     */
    rateLimitImageMaxRequests?: number;
    rateLimitImageIntervalSeconds?: number;
    /**
     * The number of proposals allowed in a given time frame.
     */
    rateLimitProposalMaxRequests?: number;
    rateLimitProposalIntervalSeconds?: number;
    /**
     * The number of searches allowed in a given time frame.
     */
    rateLimitSearchMaxRequests?: number;
    rateLimitSearchIntervalSeconds?: number;
    /**
     * The number of settings imports or exports allowed in a given time frame.
     */
    rateLimitImportUserSettingsMaxRequests?: number;
    rateLimitImportUserSettingsIntervalSeconds?: number;
    registrationMode?: RegistrationMode;
    /**
     * Whether to email admins for new reports.
     */
    reportsEmailAdmins?: boolean;
    /**
     * If present, self-promotion content is visible by default.
     */
    contentWarning?: string;
    /**
     * Whether or not external auth methods can auto-register users.
     */
    oauthRegistration?: boolean;
    /**
     * Block NSFW/self-promotion content being created.
     */
    disallowSelfPromotionContent?: boolean;
    /**
     * Don't send email notifications to users for new replies, mentions etc.
     */
    disableEmailNotifications?: boolean;
};
