"use client";

import React from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSave} from "@fortawesome/free-solid-svg-icons";
import {useTranslation} from "react-i18next";

interface TagModalProps {
    isOpen: boolean;
    isAddingNew: boolean;
    name: string;
    setName: (name: string) => void;
    onSave: () => void;
    onClose: () => void;
}

/**
 * Add/rename modal for a category's tags. Mirrors CategoryModal's shell
 * (same overlay, panel, label/input, and button classes) but scoped down to
 * the single field a tag needs -- max-w-md instead of max-w-2xl so the panel
 * isn't mostly empty space.
 */
export function TagModal({isOpen, isAddingNew, name, setName, onSave, onClose}: TagModalProps) {
    const {t} = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    {isAddingNew ? t("admin.category.tags.addModalTitle") : t("admin.category.tags.editModalTitle")}
                </h3>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("admin.category.tags.nameLabel")} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        placeholder={t("admin.category.tags.namePlaceholder")}
                        autoFocus
                    />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                        {t("admin.category.modal.cancel")}
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!name.trim()}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave}/>
                        {isAddingNew ? t("admin.category.modal.create") : t("admin.category.modal.save")}
                    </button>
                </div>
            </div>
        </div>
    );
}
