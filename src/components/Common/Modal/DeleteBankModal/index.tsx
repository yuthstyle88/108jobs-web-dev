"use client";

import React from "react";
import ConfirmActionModal from "@/components/Common/Modal/ConfirmActionModal";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = "Confirm Delete",
  description = "Are you sure you want to delete this item?",
}) => {
  return (
    <ConfirmActionModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmText="Delete"
      cancelText="Cancel"
      icon="trash"
      variant="danger"
      isLoading={isLoading}
    />
  );
};

export default ConfirmDeleteModal;
