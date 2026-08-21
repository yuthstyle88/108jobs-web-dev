"use client";

import {useEffect} from "react";
import {AlertCircle, X} from "lucide-react";
import {useTranslation} from "react-i18next";

interface DeleteTagModalProps {
    isOpen: boolean;
    tagName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

/**
 * Delete-confirmation modal for a tag. Structurally identical to
 * DeleteCategoryModal (same shell, icon treatment, and button classes) --
 * kept as its own component rather than reused directly because the
 * category version's copy ("hides ... from the catalog. Its subcategories
 * must be removed first.") is category-specific and doesn't apply to tags.
 */
export function DeleteTagModal({
                                    isOpen,
                                    tagName,
                                    onConfirm,
                                    onCancel,
                                    isLoading = false,
                                }: DeleteTagModalProps) {
    const {t} = useTranslation();

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-100 rounded-full">
                            <AlertCircle className="w-5 h-5 text-red-600"/>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                            {t("admin.category.tags.deleteModal.title")}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label={t("admin.category.tags.deleteModal.cancel")}
                    >
                        <X className="w-5 h-5 text-gray-500"/>
                    </button>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                    {t("admin.category.tags.deleteModal.description", {name: tagName})}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {t("admin.category.tags.deleteModal.cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isLoading
                            ? t("admin.category.tags.deleteModal.deleting")
                            : t("admin.category.tags.deleteModal.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
}
