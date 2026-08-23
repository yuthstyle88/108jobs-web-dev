"use client";

import ConfirmActionModal from "@/components/Common/Modal/ConfirmActionModal";
import {useTranslation} from "react-i18next";

interface DeleteTagModalProps {
    isOpen: boolean;
    tagName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function DeleteTagModal({
                                    isOpen,
                                    tagName,
                                    onConfirm,
                                    onCancel,
                                    isLoading = false,
                                }: DeleteTagModalProps) {
    const {t} = useTranslation();

    return (
        <ConfirmActionModal
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title={t("admin.category.tags.deleteModal.title")}
            description={t("admin.category.tags.deleteModal.description", {name: tagName})}
            cancelText={t("admin.category.tags.deleteModal.cancel")}
            confirmText={isLoading ? t("admin.category.tags.deleteModal.deleting") : t("admin.category.tags.deleteModal.confirm")}
            icon="alert"
            variant="danger"
            isLoading={isLoading}
        />
    );
}
