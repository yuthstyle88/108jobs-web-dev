"use client";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {cn} from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  isBlur?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  contentClassName,
  showCloseButton = true,
  closeOnOutsideClick = true,
  isBlur = false,
}) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isLeaving, setIsLeaving] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const modalRef = useRef<HTMLDivElement>(null);

  // React to `isOpen` prop transitions synchronously during render (React's
  // documented "adjust state while rendering" pattern) instead of in an
  // effect, so opening/closing doesn't cost an extra render pass. `isVisible`
  // and `isLeaving` still need to be real state (not just derived) because
  // they also persist across the delayed close animation handled by the
  // timer effect below.
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsVisible(true);
    } else if (isVisible) {
      setIsLeaving(true);
    }
  }

  const handleClose = useCallback(() => {
      if (!isVisible) return;
      setIsLeaving(true);
    },
    [isVisible]);

  // Runs the close animation timer and finalizes the close once `isLeaving`
  // is set, regardless of whether it was triggered by the `isOpen` prop
  // flipping to false or by a manual close (button/outside click/Escape).
  // The setState calls here happen inside the timeout callback, not
  // synchronously in the effect body.
  useEffect(() => {
      if (!isLeaving) return;

      const timer = setTimeout(() => {
          setIsVisible(false);
          setIsLeaving(false);
          onClose();
        },
        200);

      return () => clearTimeout(timer);
    },
    [isLeaving, onClose]);

  useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.body.style.overflow = "";
      };
    },
    [isOpen]);


  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  useEffect(() => {
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isVisible) {
          handleClose();
        }
      };

      if (isVisible) {
        document.addEventListener("keydown",
          handleEscKey);
      }

      return () => {
        document.removeEventListener("keydown",
          handleEscKey);
      };
    },
    [isVisible, handleClose]);

  if (!isVisible) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/40 ",
        isLeaving ? "animate-backdrop-hide" : "animate-backdrop-show",
        isBlur ? " backdrop-blur-md" : ""
      )}
      onClick={handleOutsideClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        className={cn(
          "bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden",
          isLeaving ? "animate-modal-hide" : "animate-modal-show",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className={`flex items-center justify-between p-4 ${title ? "border-b" : ""}`}>
            {title && (
              <h2 className="text-lg font-medium flex justify-center items-center w-full text-text-primary">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-500"/>
              </button>
            )}
          </div>
        )}
        <div className={cn("p-4",
          contentClassName)}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
