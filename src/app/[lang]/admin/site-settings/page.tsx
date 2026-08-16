"use client";

import {useEffect, useState} from "react";
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
        "Active", "Hot", "New", "Old", "Top", "MostComments", "NewComments", "Controversial", "Scaled",
    ]).optional(),
    defaultPostTimeRangeSeconds: z.number().int().min(0).optional(),
    defaultProposalSortType: z.enum(["Hot", "Top", "New", "Old", "Controversial"]).optional(),
    legalInformation: z.string().optional(),
    applicationEmailAdmins: z.boolean().optional(),
    slurFilterRegex: z.string().optional(),
    actorNameMaxLength: z.number().int().min(1).optional(),
    rateLimitMessageMaxRequests: z.number().int().min(0).optional(),
    rateLimitMessageIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitPostMaxRequests: z.number().int().min(0).optional(),
    rateLimitPostIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitRegisterMaxRequests: z.number().int().min(0).optional(),
    rateLimitRegisterIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitImageMaxRequests: z.number().int().min(0).optional(),
    rateLimitImageIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitProposalMaxRequests: z.number().int().min(0).optional(),
    rateLimitProposalIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitSearchMaxRequests: z.number().int().min(0).optional(),
    rateLimitSearchIntervalSeconds: z.number().int().min(0).optional(),
    rateLimitImportUserSettingsMaxRequests: z.number().int().min(0).optional(),
    rateLimitImportUserSettingsIntervalSeconds: z.number().int().min(0).optional(),
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

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, dirtyFields},
    } = useForm<SiteSettingsFormValues>({
        resolver: zodResolver(getSiteSettingsSchema(t)),
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
                        <label className="block text-sm font-medium mb-1.5">
                            {t("admin.siteSettings.fields.registrationMode.label")}
                        </label>
                        <select
                            {...register("registrationMode")}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
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

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
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
