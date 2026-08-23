"use client";
import React from "react";
import ConfirmActionModal from "@/components/Common/Modal/ConfirmActionModal";

interface ConfirmCloseJobProps {
  isOpen: boolean;
  onClose: () => void;
  handleConfirmChange: () => void;
  isDeleteLoading: boolean;
}

const ConfirmCloseJob: React.FC<ConfirmCloseJobProps> = ({
  isDeleteLoading,
  isOpen,
  onClose,
  handleConfirmChange,
}) => {
  return (
    <ConfirmActionModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmChange}
      title="Confirm Close Proposal"
      confirmText="Close job"
      cancelText="Cancel"
      icon="trash"
      variant="danger"
      isLoading={isDeleteLoading}
    />
  );
};

export default ConfirmCloseJob;
