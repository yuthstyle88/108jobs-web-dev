"use client";

import React, {useState} from "react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {callHttp, isFailed, isSuccess} from "@/services/HttpService";
import {toast} from "sonner";
import Image from "next/image";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faUpload, faGlobe} from "@fortawesome/free-solid-svg-icons";
import {useSiteStore} from "@/store/useSiteStore";

export default function SiteAppearancePage() {
    // Site data is already seeded here by UserServiceProvider from the SSR
    // fetchIsoData pass every page gets -- no need to re-fetch getSite on
    // mount just to read it back.
    const {siteRes, setSiteRes} = useSiteStore();
    const {execute: uploadIcon, isMutating: uploadingIcon} = useHttpPost("uploadSiteIcon");
    const {execute: uploadBanner, isMutating: uploadingBanner} = useHttpPost("uploadSiteBanner");

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
            toast.error("This file type is not allowed for security reasons.");
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
            toast.error("Only PNG, JPG, WebP, and GIF files are allowed.");
            e.target.value = '';
            return;
        }

        // Size check
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Image must be under 10MB");
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
            toast.error(`Please select a ${type === "icon" ? "logo" : "banner"} first`);
            return;
        }

        const execute = type === "icon" ? uploadIcon : uploadBanner;

        const res = await execute({ image: file });

        if (isSuccess(res) && res.data?.images?.[0]?.imageUrl) {
            toast.success(`${type === "icon" ? "Logo" : "Banner"} updated successfully!`);
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
            toast.error(`Failed to upload ${type === "icon" ? "logo" : "banner"}`);
        }
    };

    return (
        <AdminLayout>
            <div className="bg-[#F6F9FE] min-h-screen py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <FontAwesomeIcon icon={faGlobe} className="text-3xl text-primary"/>
                            <h1 className="text-3xl font-bold text-gray-900">Site Appearance</h1>
                        </div>

                        <p className="text-gray-600 mb-10">
                            Update your site&apos;s logo and hero banner. These will appear on the homepage and across the
                            platform.
                        </p>

                        {/* Site Logo */}
                        <div className="mb-12">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Site Logo (Recommended: 512×512px,
                                PNG)</h2>
                            <div className="grid md:grid-cols-2 gap-8 items-start">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {iconPreviewOverride ? "Preview" : "Current Logo"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                        {iconPreview ? (
                                            <Image
                                                src={iconPreview}
                                                alt="Current site logo"
                                                width={160}
                                                height={160}
                                                className="rounded-lg object-contain max-h-40"
                                            />
                                        ) : (
                                            <p className="text-gray-500">No logo set</p>
                                        )}
                                        {iconPreviewOverride && (
                                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                Preview — not saved yet
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="logo-upload" className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Logo</label>
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
                                                {uploadingIcon ? "Uploading..." : "Upload New Logo"}
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
                                Hero Banner (Recommended: 1920×1080px or larger, JPG/PNG)
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {bannerPreviewOverride ? "Preview" : "Current Banner"}
                                    </label>
                                    <div
                                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
                                        {bannerPreview ? (
                                            <div className="relative aspect-video">
                                                <Image
                                                    src={bannerPreview}
                                                    alt="Current hero banner"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                                <div className="absolute bottom-6 left-6 text-white">
                                                    <h3 className="text-3xl font-bold">{siteName}</h3>
                                                    <p className="text-lg opacity-90">Welcome to your marketplace</p>
                                                </div>
                                                {bannerPreviewOverride && (
                                                    <span className="absolute top-3 right-3 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        Preview — not saved yet
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-64 flex items-center justify-center">
                                                <p className="text-gray-500">No banner set</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="banner-upload" className="block text-sm font-medium text-gray-700 mb-3">Upload New
                                        Banner</label>
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
                                            {uploadingBanner ? "Uploading Banner..." : "Upload New Banner"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 pt-8 border-t border-gray-200">
                            <p className="text-sm text-gray-500 text-center">
                                Changes take effect immediately across the site.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}