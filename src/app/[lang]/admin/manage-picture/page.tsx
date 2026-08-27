"use client";

import React, {useState} from "react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
import {callHttp, isFailed, isSuccess} from "@/services/HttpService";
import {toast} from "sonner";
import Image from "next/image";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faUpload, faGlobe} from "@fortawesome/free-solid-svg-icons";
import {useSiteStore} from "@/store/useSiteStore";
import {useTranslation} from "react-i18next";

export default function SiteAppearancePage() {
    const {t} = useTranslation();
    // Site data is already seeded here by UserServiceProvider from the SSR
    // fetchIsoData pass every page gets -- no need to re-fetch getSite on
    // mount just to read it back.
    const {siteRes, setSiteRes} = useSiteStore();
    const {execute: uploadIcon, isMutating: uploadingIcon} = useHttpPost("uploadSiteIcon");
    const {execute: uploadBanner, isMutating: uploadingBanner} = useHttpPost("uploadSiteBanner");
    const {execute: removeIcon, isMutating: removingIcon} = useHttpDelete("deleteSiteIcon");
    const {execute: removeBanner, isMutating: removingBanner} = useHttpDelete("deleteSiteBanner");

    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [iconPreviewOverride, setIconPreviewOverride] = useState<string | null>(null);
    const [bannerPreviewOverride, setBannerPreviewOverride] = useState<string | null>(null);

    const siteName = siteRes?.siteView?.localSite?.name || "Your Site";

    // The locally-selected file preview (if any) takes priority over the
    // image currently stored on the site; once uploaded, the override is
    // cleared and this falls back to the (now refreshed) store data.
    const iconPreview = iconPreviewOverride ?? siteRes?.siteView?.localSite?.icon ?? null;
    const bannerPreview = bannerPreviewOverride ?? siteRes?.siteView?.localSite?.banner ?? null;

    const handleFileChange = (
        type: "icon" | "banner",
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // === BLOCK DANGEROUS FILE TYPES ===
        const fileName = file.name.toLowerCase();
        const blockedExtensions = ['.svg', '.xml', '.php', '.html', '.htm', '.js', '.exe'];

        if (blockedExtensions.some(ext => fileName.endsWith(ext))) {
            toast.error(t("admin.picture.blockedFileType"));
            e.target.value = ''; // Clear input
            return;
        }

        // Optional: stricter MIME type check (SVG can fake image/svg+xml)
        const allowedTypes = [
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
            'image/gif'
        ];

        if (!allowedTypes.includes(file.type)) {
            toast.error(t("admin.picture.invalidFileType"));
            e.target.value = '';
            return;
        }

        // Size check
        if (file.size > 10 * 1024 * 1024) {
            toast.error(t("admin.picture.fileTooLarge"));
            e.target.value = '';
            return;
        }

        // All good → proceed
        if (type === "icon") {
            setIconFile(file);
        } else {
            setBannerFile(file);
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (type === "icon") setIconPreviewOverride(result);
            else setBannerPreviewOverride(result);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async (type: "icon" | "banner") => {
        const file = type === "icon" ? iconFile : bannerFile;
        if (!file) {
            toast.error(type === "icon" ? t("admin.picture.selectLogoFirst") : t("admin.picture.selectBannerFirst"));
            return;
        }

        const execute = type === "icon" ? uploadIcon : uploadBanner;

        const res = await execute({ image: file });

        if (isSuccess(res) && res.data?.url) {
            toast.success(type === "icon" ? t("admin.picture.logoUpdated") : t("admin.picture.bannerUpdated"));
            // Refresh the shared store with the canonical site data now that
            // it actually changed -- everywhere else that reads useSiteStore
            // (header, homepage banner, ...) picks up the new icon/banner too.
            const refreshed = await callHttp("getSite");
            if (isSuccess(refreshed)) {
                setSiteRes(refreshed.data);
            }
            if (type === "icon") {
                setIconFile(null);
                setIconPreviewOverride(null);
            } else {
                setBannerFile(null);
                setBannerPreviewOverride(null);
            }
        } else if (isFailed(res)) {
            toast.error(type === "icon" ? t("admin.picture.logoUploadFailed") : t("admin.picture.bannerUploadFailed"));
        }
    };

    const handleRemove = async (type: "icon" | "banner") => {
        const execute = type === "icon" ? removeIcon : removeBanner;
        const res = await execute(undefined);

        if (isSuccess(res)) {
            toast.success(type === "icon" ? t("admin.picture.logoRemoved") : t("admin.picture.bannerRemoved"));
            const refreshed = await callHttp("getSite");
            if (isSuccess(refreshed)) {
                setSiteRes(refreshed.data);
            }
        } else if (isFailed(res)) {
            toast.error(type === "icon" ? t("admin.picture.logoRemoveFailed") : t("admin.picture.bannerRemoveFailed"));
        }
    };

    return (
        <AdminLayout>
            <div className="bg-[#F6F9FE] min-h-screen py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <FontAwesomeIcon icon={faGlobe} className="text-3xl text-primary"/>
                            <h1 className="text-3xl font-bold text-gray-900">{t("admin.picture.title")}</h1>
                        </div>

                        <p className="text-gray-600 mb-10">
                            {t("admin.picture.subtitle")}
                        </p>

                        {/* Site Logo */}
                        <div className="mb-12">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">{t("admin.picture.logoHeading")}</h2>
                            <div className="grid md:grid-cols-2 gap-8 items-start">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {iconPreviewOverride ? t("admin.picture.previewLabel") : t("admin.picture.currentLogo")}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt={t("admin.picture.logoAlt")}
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">{t("admin.picture.noLogoSet")}</p>
                                        )}
                                        {iconPreviewOverride && (
                                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                {t("admin.picture.previewBadge")}
                                            </span>
                                        )}
                                    </div>
                                    {siteRes?.siteView?.localSite?.icon && (
                                        <button
                                            onClick={() => handleRemove("icon")}
                                            disabled={removingIcon}
                                            className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            {removingIcon ? t("admin.picture.removing") : t("admin.picture.removeLogo")}
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="logo-upload" className="block text-sm font-medium text-gray-700 mb-3">{t("admin.picture.uploadNewLogo")}</label>
                                    <div className="space-y-4">
                                        <input
                                            id="logo-upload"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={(e) => handleFileChange("icon", e)}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
                                        {iconFile && (
                                            <button
                                                onClick={() => handleUpload("icon")}
                                                disabled={uploadingIcon}
                                                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 disabled:opacity-70 transition"
                                            >
                                                <FontAwesomeIcon icon={faUpload}/>
                                                {uploadingIcon ? t("admin.picture.uploadingLogo") : t("admin.picture.uploadNewLogo")}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="my-12 border-gray-200"/>

                        {/* Hero Banner */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                {t("admin.picture.bannerHeading")}
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {bannerPreviewOverride ? t("admin.picture.previewLabel") : t("admin.picture.currentBanner")}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt={t("admin.picture.bannerAlt")}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">{t("admin.picture.welcomeSubtitle")}</p>
                                                </div>
                                                {bannerPreviewOverride && (
                                                    <span className="absolute top-3 right-3 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        {t("admin.picture.previewBadge")}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">{t("admin.picture.noBannerSet")}</p>
                                            </div>
                                        )}
                                    </div>
                                    {siteRes?.siteView?.localSite?.banner && (
                                        <button
                                            onClick={() => handleRemove("banner")}
                                            disabled={removingBanner}
                                            className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            {removingBanner ? t("admin.picture.removing") : t("admin.picture.removeBanner")}
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="banner-upload" className="block text-sm font-medium text-gray-700 mb-3">{t("admin.picture.uploadNewBanner")}</label>
                                    <input
                                        id="banner-upload"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(e) => handleFileChange("banner", e)}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                    />
                                    {bannerFile && (
                                        <button
                                            onClick={() => handleUpload("banner")}
                                            disabled={uploadingBanner}
                                            className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 disabled:opacity-70 transition"
                                        >
                                            <FontAwesomeIcon icon={faUpload}/>
                                            {uploadingBanner ? t("admin.picture.uploadingBanner") : t("admin.picture.uploadNewBanner")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 pt-8 border-t border-gray-200">
                            <p className="text-sm text-gray-500 text-center">
                                {t("admin.picture.footerNote")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}