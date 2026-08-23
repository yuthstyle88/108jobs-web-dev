"use client";

import ConfirmActionModal from "@/components/Common/Modal/ConfirmActionModal";
import {useTranslation} from "react-i18next";

interface DeleteCategoryModalProps {
    isOpen: boolean;
    categoryName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function DeleteCategoryModal({
                                        isOpen,
                                        categoryName,
                                        onConfirm,
                                        onCancel,
                                        isLoading = false,
                                    }: DeleteCategoryModalProps) {
    const {t} = useTranslation();

    return (
        <ConfirmActionModal
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title={t("admin.category.deleteModal.title")}
            description={t("admin.category.deleteModal.description", {name: categoryName})}
            cancelText={t("admin.category.deleteModal.cancel")}
            confirmText={isLoading ? t("admin.category.deleteModal.deleting") : t("admin.category.deleteModal.confirm")}
            icon="alert"
            variant="danger"
            isLoading={isLoading}
        />
    );
}
