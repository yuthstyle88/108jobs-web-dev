"use client";

import React from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";

interface CategoryFormData {
    name: string;
    icon?: string;
    banner?: string;
    description?: string;
    parent_id?: number | null;
}

interface CategoryModalProps {
    isOpen: boolean;
    isAddingNew: boolean;
    form: CategoryFormData;
    setForm: React.Dispatch<React.SetStateAction<CategoryFormData>>;
    iconMode: "url" | "upload";
    setIconMode: React.Dispatch<React.SetStateAction<"url" | "upload">>;
    bannerMode: "url" | "upload";
    setBannerMode: React.Dispatch<React.SetStateAction<"url" | "upload">>;
    uploadedIcon: string | null;
    setUploadedIcon: React.Dispatch<React.SetStateAction<string | null>>;
    uploadedBanner: string | null;
    setUploadedBanner: React.Dispatch<React.SetStateAction<string | null>>;
    onImageUpload: (type: "icon" | "banner", e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onClose: () => void;
}
export function CategoryModal({
                                  isOpen,
                                  isAddingNew,
                                  form,
                                  setForm,
                                  iconMode,
                                  setIconMode,
                                  bannerMode,
                                  setBannerMode,
                                  uploadedIcon,
                                  setUploadedIcon,
                                  uploadedBanner,
                                  setUploadedBanner,
                                  onImageUpload,
                                  onSave,
                                  onClose,
                              }: CategoryModalProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    {isAddingNew ? t("admin.category.modal.addTitle") : t("admin.category.modal.editTitle")}
                </h3>

                <div className="space-y-8">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("admin.category.modal.nameLabel")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                            placeholder={t("admin.category.modal.namePlaceholder")}
                        />
                    </div>

                    {/* Icon */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            {t("admin.category.modal.iconLabel")}
                        </label>
                        <div className="flex gap-4 mb-4 border-b border-gray-200">
                            <button
                                type="button"
                                onClick={() => setIconMode("url")}
                                className={`pb-2 px-1 text-sm font-medium border-b-2 ${
                                    iconMode === "url" ? "border-primary text-primary" : "border-transparent"
                                }`}
                            >
                                {t("admin.category.modal.tabUrl")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIconMode("upload")}
                                className={`pb-2 px-1 text-sm font-medium border-b-2 ${
                                    iconMode === "upload" ? "border-primary text-primary" : "border-transparent"
                                }`}
                            >
                                {t("admin.category.modal.tabUpload")}
                            </button>
                        </div>

                        {iconMode === "url" ? (
                            <>
                                <input
                                    type="url"
                                    value={form.icon || ""}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-lg"
                                    placeholder="https://..."
                                />
                                {!isAddingNew && (
                                    <p className="mt-2 text-xs text-amber-600">{t("admin.category.modal.urlEditWarning")}</p>
                                )}
                            </>
                        ) : (
                            <label className="block cursor-pointer">
                                {!uploadedIcon ? (
                                    <div className="h-32 border-2 border-dashed rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100">
                                        <p className="text-gray-500">{t("admin.category.modal.clickToUploadIcon")}</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Image src={uploadedIcon} alt={t("admin.category.modal.iconAlt")} width={100} height={100} className="rounded-lg mx-auto" />
                                        <button
                                            onClick={() => {
                                                setUploadedIcon(null);
                                                setForm({ ...form, icon: "" });
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageUpload("icon", e)} />
                            </label>
                        )}

                        {form.icon && (
                            <div className="mt-3 text-center">
                                <Image src={form.icon} alt={t("admin.category.modal.iconPreviewAlt")} width={80} height={80} className="rounded-lg mx-auto border" />
                            </div>
                        )}
                    </div>

                    {/* Banner */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            {t("admin.category.modal.bannerLabel")} <span className="text-gray-500 text-xs">{t("admin.category.modal.bannerHint")}</span>
                        </label>
                        <div className="flex gap-6 mb-4 border-b border-gray-200">
                            <button
                                type="button"
                                onClick={() => setBannerMode("url")}
                                className={`pb-3 px-2 text-sm font-medium border-b-2 transition ${
                                    bannerMode === "url" ? "border-primary text-primary" : "border-transparent"
                                }`}
                            >
                                {t("admin.category.modal.tabEnterUrl")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setBannerMode("upload")}
                                className={`pb-3 px-2 text-sm font-medium border-b-2 transition ${
                                    bannerMode === "upload" ? "border-primary text-primary" : "border-transparent"
                                }`}
                            >
                                {t("admin.category.modal.tabUploadImage")}
                            </button>
                        </div>

                        {/* URL Mode */}
                        {bannerMode === "url" && (
                            <div className="space-y-4">
                                <input
                                    type="url"
                                    value={form.banner || ""}
                                    onChange={(e) => setForm({ ...form, banner: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                                    placeholder="https://storage.googleapis.com/..."
                                />
                                {!isAddingNew && (
                                    <p className="mt-2 text-xs text-amber-600">{t("admin.category.modal.urlEditWarning")}</p>
                                )}
                                {form.banner && (
                                    <div className="relative rounded-xl overflow-hidden shadow-lg border">
                                        <Image src={form.banner} alt={t("admin.category.modal.bannerPreviewAlt")} width={800} height={300} className="w-full h-64 object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-4 left-6 text-white">
                                            <p className="text-2xl font-bold">{form.name || t("admin.category.modal.namePreviewFallback")}</p>
                                            <p className="text-sm opacity-90">{t("admin.category.modal.clickToEnlarge")}</p>
                                        </div>
                                        <button
                                            onClick={() => setForm({ ...form, banner: "" })}
                                            className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-9 h-9 hover:bg-red-600 shadow-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Upload Mode */}
                        {bannerMode === "upload" && (
                            <label className="block cursor-pointer">
                                {!uploadedBanner ? (
                                    <div className="h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition">
                                        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="text-gray-600 font-medium">{t("admin.category.modal.clickToUploadBanner")}</p>
                                        <p className="text-xs text-gray-500 mt-1">{t("admin.category.modal.bannerUploadHint")}</p>
                                    </div>
                                ) : (
                                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                                        <Image src={uploadedBanner} alt={t("admin.category.modal.bannerAlt")} width={800} height={300} className="w-full h-64 object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-4 left-6 text-white">
                                            <p className="text-2xl font-bold">{form.name || t("admin.category.modal.namePreviewFallback")}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setUploadedBanner(null);
                                                setForm({ ...form, banner: "" });
                                            }}
                                            className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-9 h-9 hover:bg-red-600 shadow-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageUpload("banner", e)} />
                            </label>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                        {t("admin.category.modal.cancel")}
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!form.name.trim()}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {isAddingNew ? t("admin.category.modal.create") : t("admin.category.modal.save")}
                    </button>
                </div>
            </div>
        </div>
    );
}