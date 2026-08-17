"use client";

import {useEffect, useMemo, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import {AlertTriangle} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {Card} from "@/components/ui/Card";
import {CustomInput} from "@/components/ui/InputField";
import {useHttpPut} from "@/hooks/api/http/useHttpPut";
import {isSuccess, isFailed, callHttp} from "@/services/HttpService";
import {useSiteStore} from "@/store/useSiteStore";
import type {EditSiteRequest, SiteView} from "108jobs-client";

const getSiteSettingsSchema = (t: (key: string) => string) => z.object({
    name: z.string()
        .min(1, t("admin.siteSettings.fields.name.errorMin"))
        .max(20, t("admin.siteSettings.fields.name.errorMax"))
        .optional(),
    sidebar: z.string().optional(),
    description: z.string().max(150, t("admin.siteSettings.fields.description.errorMax")).optional(),
    categoryCreationAdminOnly: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    applicationQuestion: z.string().optional(),
    defaultTheme: z.string().optional(),
    defaultPostListingType: z.enum(["All", "Local"]).optional(),
    defaultPostListingMode: z.enum(["List", "Card", "SmallCard"]).optional(),
    defaultPostSortType: z.enum([
        "Active", "Hot", "New", "Old", "Top", "MostProposals", "NewProposals", "Controversial", "Scaled",
    ]).optional(),
    defaultPostTimeRangeSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    defaultProposalSortType: z.enum(["Hot", "Top", "New", "Old", "Controversial"]).optional(),
    legalInformation: z.string().optional(),
    applicationEmailAdmins: z.boolean().optional(),
    slurFilterRegex: z.string().optional(),
    actorNameMaxLength: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(1, t("admin.siteSettings.fields.errorMinOne")).optional(),
    rateLimitMessageMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitMessageIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitPostMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitPostIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitRegisterMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitRegisterIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitImageMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitImageIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitProposalMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitProposalIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitSearchMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitSearchIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitImportUserSettingsMaxRequests: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    rateLimitImportUserSettingsIntervalSeconds: z.number({invalid_type_error: t("admin.siteSettings.fields.errorNotANumber")}).int().min(0, t("admin.siteSettings.fields.errorMinValue")).optional(),
    registrationMode: z.enum(["Open", "Closed", "RequireApplication"]).optional(),
    reportsEmailAdmins: z.boolean().optional(),
    contentWarning: z.string().optional(),
    oauthRegistration: z.boolean().optional(),
    disallowSelfPromotionContent: z.boolean().optional(),
    disableEmailNotifications: z.boolean().optional(),
});

type SiteSettingsFormValues = z.infer<ReturnType<typeof getSiteSettingsSchema>>;

// useForm's defaultValues is captured once at first render -- if the store
// populates later (retry button, or the refresh after a successful save),
// this rebuilds the object so an effect can reset() the form onto it.
const buildDefaultValues = (siteView?: SiteView | null): SiteSettingsFormValues => {
    const localSite = siteView?.localSite;
    const rateLimit = siteView?.localSiteRateLimit;
    return {
        name: localSite?.name,
        sidebar: localSite?.sidebar ?? undefined,
        description: localSite?.description ?? undefined,
        categoryCreationAdminOnly: localSite?.categoryCreationAdminOnly,
        requireEmailVerification: localSite?.requireEmailVerification,
        applicationQuestion: localSite?.applicationQuestion ?? undefined,
        defaultTheme: localSite?.defaultTheme,
        // PlatformConfig types this as the full ListingType union, but the
        // backend only ever accepts/returns "All" or "Local" here (see
        // EditSiteRequest's doc comment) -- narrow to match the form schema.
        defaultPostListingType: localSite?.defaultPostListingType as SiteSettingsFormValues["defaultPostListingType"],
        defaultPostListingMode: localSite?.defaultPostListingMode,
        defaultPostSortType: localSite?.defaultPostSortType,
        defaultPostTimeRangeSeconds: localSite?.defaultPostTimeRangeSeconds ?? undefined,
        defaultProposalSortType: localSite?.defaultProposalSortType,
        legalInformation: localSite?.legalInformation ?? undefined,
        applicationEmailAdmins: localSite?.applicationEmailAdmins,
        slurFilterRegex: localSite?.slurFilterRegex ?? undefined,
        actorNameMaxLength: localSite?.actorNameMaxLength ?? undefined,
        rateLimitMessageMaxRequests: rateLimit?.messageMaxRequests ?? undefined,
        rateLimitMessageIntervalSeconds: rateLimit?.messageIntervalSeconds ?? undefined,
        rateLimitPostMaxRequests: rateLimit?.postMaxRequests ?? undefined,
        rateLimitPostIntervalSeconds: rateLimit?.postIntervalSeconds ?? undefined,
        rateLimitRegisterMaxRequests: rateLimit?.registerMaxRequests ?? undefined,
        rateLimitRegisterIntervalSeconds: rateLimit?.registerIntervalSeconds ?? undefined,
        rateLimitImageMaxRequests: rateLimit?.imageMaxRequests ?? undefined,
        rateLimitImageIntervalSeconds: rateLimit?.imageIntervalSeconds ?? undefined,
        rateLimitProposalMaxRequests: rateLimit?.proposalMaxRequests ?? undefined,
        rateLimitProposalIntervalSeconds: rateLimit?.proposalIntervalSeconds ?? undefined,
        rateLimitSearchMaxRequests: rateLimit?.searchMaxRequests ?? undefined,
        rateLimitSearchIntervalSeconds: rateLimit?.searchIntervalSeconds ?? undefined,
        rateLimitImportUserSettingsMaxRequests: rateLimit?.importUserSettingsMaxRequests ?? undefined,
        rateLimitImportUserSettingsIntervalSeconds: rateLimit?.importUserSettingsIntervalSeconds ?? undefined,
        registrationMode: localSite?.registrationMode,
        reportsEmailAdmins: localSite?.reportsEmailAdmins,
        contentWarning: localSite?.contentWarning ?? undefined,
        oauthRegistration: localSite?.oauthRegistration,
        disallowSelfPromotionContent: localSite?.disallowSelfPromotionContent,
        disableEmailNotifications: localSite?.disableEmailNotifications,
    };
};

const SiteSettingsPage = () => {
    const {t} = useTranslation();
    const {siteRes, setSiteRes} = useSiteStore();
    const localSite = siteRes?.siteView?.localSite;
    const [retrying, setRetrying] = useState(false);

    const {execute: updateSite, isMutating: isSaving} = useHttpPut("updateSite");

    const siteSettingsSchema = useMemo(() => getSiteSettingsSchema(t), [t]);

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, dirtyFields, isDirty},
    } = useForm<SiteSettingsFormValues>({
        resolver: zodResolver(siteSettingsSchema),
        defaultValues: buildDefaultValues(siteRes?.siteView),
    });

    useEffect(() => {
        if (siteRes?.siteView) {
            reset(buildDefaultValues(siteRes.siteView));
        }
    }, [siteRes, reset]);

    const handleRetry = async () => {
        setRetrying(true);
        const res = await callHttp("getSite");
        if (isSuccess(res)) {
            setSiteRes(res.data);
        }
        setRetrying(false);
    };

    if (!localSite) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-gray-600">
                    <AlertTriangle className="w-10 h-10 text-destructive"/>
                    <p className="text-lg font-medium">{t("admin.siteSettings.loadError.title")}</p>
                    <p className="text-sm max-w-md">{t("admin.siteSettings.loadError.description")}</p>
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="px-4 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                    >
                        {retrying ? t("admin.siteSettings.loadError.retrying") : t("admin.siteSettings.loadError.retry")}
                    </button>
                </div>
            </AdminLayout>
        );
    }

    const onSubmit = async (values: SiteSettingsFormValues) => {
        // Only send fields the admin actually edited -- the backend treats
        // an absent field as "leave unchanged," not "clear this value".
        const changedKeys = Object.keys(dirtyFields) as Array<keyof SiteSettingsFormValues>;
        const payload = Object.fromEntries(
            changedKeys.map((key) => [key, values[key]]),
        ) as EditSiteRequest;
        const res = await updateSite(payload);
        if (isSuccess(res)) {
            toast.success(t("admin.siteSettings.saveSuccess"));
            const refreshed = await callHttp("getSite");
            if (isSuccess(refreshed)) {
                setSiteRes(refreshed.data);
            }
        } else if (isFailed(res)) {
            toast.error(t("admin.siteSettings.saveFailed"));
        }
    };

    return (
        <AdminLayout>
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t("admin.siteSettings.title")}</h1>
                    <p className="mt-2 text-muted-foreground">{t("admin.siteSettings.description")}</p>
                </div>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.identity.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="name"
                        register={register("name")}
                        label={t("admin.siteSettings.fields.name.label")}
                        placeholder={t("admin.siteSettings.fields.name.placeholder")}
                        error={errors.name?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="text"
                        name="description"
                        register={register("description")}
                        label={t("admin.siteSettings.fields.description.label")}
                        placeholder={t("admin.siteSettings.fields.description.placeholder")}
                        error={errors.description?.message}
                    />

                    <CustomInput
                        tag="textarea"
                        name="sidebar"
                        register={register("sidebar")}
                        label={t("admin.siteSettings.fields.sidebar.label")}
                        placeholder={t("admin.siteSettings.fields.sidebar.placeholder")}
                        rows={6}
                        error={errors.sidebar?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="text"
                        name="contentWarning"
                        register={register("contentWarning")}
                        label={t("admin.siteSettings.fields.contentWarning.label")}
                        error={errors.contentWarning?.message}
                    />

                    <CustomInput
                        tag="textarea"
                        name="legalInformation"
                        register={register("legalInformation")}
                        label={t("admin.siteSettings.fields.legalInformation.label")}
                        rows={6}
                        error={errors.legalInformation?.message}
                    />
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.registration.title")}</h2>

                    <div>
                        <label htmlFor="registrationMode" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.siteSettings.fields.registrationMode.label")}
                        </label>
                        <select
                            id="registrationMode"
                            {...register("registrationMode")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="Open">{t("dashboard.siteInfo.registrationMode.open")}</option>
                            <option value="Closed">{t("dashboard.siteInfo.registrationMode.closed")}</option>
                            <option value="RequireApplication">{t("dashboard.siteInfo.registrationMode.requireApplication")}</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("requireEmailVerification")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.requireEmailVerification.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("categoryCreationAdminOnly")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.categoryCreationAdminOnly.label")}</span>
                    </label>

                    <CustomInput
                        tag="textarea"
                        name="applicationQuestion"
                        register={register("applicationQuestion")}
                        label={t("admin.siteSettings.fields.applicationQuestion.label")}
                        rows={4}
                        error={errors.applicationQuestion?.message}
                    />

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("applicationEmailAdmins")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.applicationEmailAdmins.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("oauthRegistration")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.oauthRegistration.label")}</span>
                    </label>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.moderation.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="slurFilterRegex"
                        register={register("slurFilterRegex")}
                        label={t("admin.siteSettings.fields.slurFilterRegex.label")}
                        error={errors.slurFilterRegex?.message}
                    />

                    <CustomInput
                        tag="input"
                        type="number"
                        name="actorNameMaxLength"
                        register={register("actorNameMaxLength", {valueAsNumber: true})}
                        label={t("admin.siteSettings.fields.actorNameMaxLength.label")}
                        error={errors.actorNameMaxLength?.message}
                    />

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disallowSelfPromotionContent")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disallowSelfPromotionContent.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("reportsEmailAdmins")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.reportsEmailAdmins.label")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" {...register("disableEmailNotifications")} className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t("admin.siteSettings.fields.disableEmailNotifications.label")}</span>
                    </label>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.contentDefaults.title")}</h2>

                    <CustomInput
                        tag="input"
                        type="text"
                        name="defaultTheme"
                        register={register("defaultTheme")}
                        label={t("admin.siteSettings.fields.defaultTheme.label")}
                        placeholder="browser"
                        error={errors.defaultTheme?.message}
                    />

                    <div>
                        <label htmlFor="defaultPostListingType" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.siteSettings.fields.defaultPostListingType.label")}
                        </label>
                        <select
                            id="defaultPostListingType"
                            {...register("defaultPostListingType")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="All">{t("admin.siteSettings.fields.defaultPostListingType.all")}</option>
                            <option value="Local">{t("admin.siteSettings.fields.defaultPostListingType.local")}</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultPostListingMode" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.siteSettings.fields.defaultPostListingMode.label")}
                        </label>
                        <select
                            id="defaultPostListingMode"
                            {...register("defaultPostListingMode")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="List">{t("admin.siteSettings.fields.defaultPostListingMode.list")}</option>
                            <option value="Card">{t("admin.siteSettings.fields.defaultPostListingMode.card")}</option>
                            <option value="SmallCard">{t("admin.siteSettings.fields.defaultPostListingMode.smallCard")}</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultPostSortType" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.siteSettings.fields.defaultPostSortType.label")}
                        </label>
                        <select
                            id="defaultPostSortType"
                            {...register("defaultPostSortType")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="Active">{t("admin.siteSettings.fields.defaultPostSortType.active")}</option>
                            <option value="Hot">{t("admin.siteSettings.fields.defaultPostSortType.hot")}</option>
                            <option value="New">{t("admin.siteSettings.fields.defaultPostSortType.new")}</option>
                            <option value="Old">{t("admin.siteSettings.fields.defaultPostSortType.old")}</option>
                            <option value="Top">{t("admin.siteSettings.fields.defaultPostSortType.top")}</option>
                            <option value="MostProposals">{t("admin.siteSettings.fields.defaultPostSortType.mostProposals")}</option>
                            <option value="NewProposals">{t("admin.siteSettings.fields.defaultPostSortType.newProposals")}</option>
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultPostSortType.controversial")}</option>
                            <option value="Scaled">{t("admin.siteSettings.fields.defaultPostSortType.scaled")}</option>
                        </select>
                    </div>

                    <CustomInput
                        tag="input"
                        type="number"
                        name="defaultPostTimeRangeSeconds"
                        register={register("defaultPostTimeRangeSeconds", {valueAsNumber: true})}
                        label={t("admin.siteSettings.fields.defaultPostTimeRangeSeconds.label")}
                        error={errors.defaultPostTimeRangeSeconds?.message}
                    />

                    <div>
                        <label htmlFor="defaultProposalSortType" className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.siteSettings.fields.defaultProposalSortType.label")}
                        </label>
                        <select
                            id="defaultProposalSortType"
                            {...register("defaultProposalSortType")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="Hot">{t("admin.siteSettings.fields.defaultProposalSortType.hot")}</option>
                            <option value="Top">{t("admin.siteSettings.fields.defaultProposalSortType.top")}</option>
                            <option value="New">{t("admin.siteSettings.fields.defaultProposalSortType.new")}</option>
                            <option value="Old">{t("admin.siteSettings.fields.defaultProposalSortType.old")}</option>
                            <option value="Controversial">{t("admin.siteSettings.fields.defaultProposalSortType.controversial")}</option>
                        </select>
                    </div>
                </Card>

                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">{t("admin.siteSettings.sections.rateLimits.title")}</h2>

                    {([
                        {key: "message", max: "rateLimitMessageMaxRequests", interval: "rateLimitMessageIntervalSeconds"},
                        {key: "post", max: "rateLimitPostMaxRequests", interval: "rateLimitPostIntervalSeconds"},
                        {key: "register", max: "rateLimitRegisterMaxRequests", interval: "rateLimitRegisterIntervalSeconds"},
                        {key: "image", max: "rateLimitImageMaxRequests", interval: "rateLimitImageIntervalSeconds"},
                        {key: "proposal", max: "rateLimitProposalMaxRequests", interval: "rateLimitProposalIntervalSeconds"},
                        {key: "search", max: "rateLimitSearchMaxRequests", interval: "rateLimitSearchIntervalSeconds"},
                        {key: "importUserSettings", max: "rateLimitImportUserSettingsMaxRequests", interval: "rateLimitImportUserSettingsIntervalSeconds"},
                    ] as const).map((row) => (
                        <div key={row.key} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                            <p className="text-sm font-medium sm:col-span-1 mb-4">
                                {t(`admin.siteSettings.fields.rateLimits.${row.key}`)}
                            </p>
                            <CustomInput
                                tag="input"
                                type="number"
                                name={row.max}
                                register={register(row.max, {valueAsNumber: true})}
                                label={t("admin.siteSettings.fields.rateLimits.maxRequests")}
                                error={errors[row.max]?.message}
                            />
                            <CustomInput
                                tag="input"
                                type="number"
                                name={row.interval}
                                register={register(row.interval, {valueAsNumber: true})}
                                label={t("admin.siteSettings.fields.rateLimits.intervalSeconds")}
                                error={errors[row.interval]?.message}
                            />
                        </div>
                    ))}
                </Card>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving || !isDirty}
                        className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                    >
                        {isSaving ? t("admin.siteSettings.saving") : t("admin.siteSettings.saveButton")}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
};

export default SiteSettingsPage;
