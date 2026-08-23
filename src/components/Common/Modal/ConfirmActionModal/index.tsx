"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import {CircleAlert, Trash2, Info, Loader2} from "lucide-react";
import {useTranslation} from "react-i18next";

export type ConfirmActionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string | React.ReactNode;
  message?: string | React.ReactNode;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  icon?: "alert" | "trash" | "info" | React.ReactNode;
  variant?: "danger" | "primary";
  isLoading?: boolean;
};

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText,
  cancelText,
  icon = "alert",
  variant = "danger",
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const bodyText = message ?? description;

  const renderIcon = () => {
    if (React.isValidElement(icon)) return icon;
    if (icon === "trash") {
      return <Trash2 className="w-[56px] h-[56px] text-[#EA6357]" />;
    }
    if (icon === "info") {
      return <Info className="w-[56px] h-[56px] text-primary" />;
    }
    return <CircleAlert className="w-[56px] h-[56px] text-[#EA6357]" />;
  };

  const confirmBtnClass = variant === "primary"
    ? "bg-primary hover:bg-[#063a68] text-white"
    : "bg-[#EA6357] hover:bg-[#DE5E53] text-white";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md p-0 w-full"
      closeOnOutsideClick={false}
    >
      <section className="px-[12px] w-full flex flex-col gap-6 justify-center items-center">
        {renderIcon()}
        <article className="text-center">
          {title && (
            <h1 className="text-[18px] font-medium text-text-primary">{title}</h1>
          )}
          {bodyText && (
            <div className="text-[14px] font-sans text-text-secondary pt-3">{bodyText}</div>
          )}
        </article>
      </section>
      <div className="flex flex-row gap-2 pt-8 w-full">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-10 py-3 w-full text-text-secondary font-normal rounded-md shadow-lg hover:bg-gray-100 transition duration-300 disabled:opacity-50"
        >
          {cancelText || t("global.buttonCancel") || "Cancel"}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={`px-10 py-3 w-full font-normal rounded-md shadow-lg transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 ${confirmBtnClass}`}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {confirmText || t("global.buttonConfirm") || "Confirm"}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmActionModal;
