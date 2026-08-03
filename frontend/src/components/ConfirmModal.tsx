import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X, RefreshCw, AlertCircle } from "lucide-react";

type ConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Delete User",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onClose
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !isLoading) {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose, onConfirm]);

  if (!isOpen || typeof document === "undefined") return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/30 border border-slate-200/90 w-full max-w-md p-6 space-y-5 transition-all duration-200 animate-in fade-in zoom-in-95">
        
        {/* Modal Header Icon & Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold shrink-0 border ${
            isDanger
              ? "bg-rose-50 text-rose-600 border-rose-100 shadow-2xs"
              : "bg-amber-50 text-amber-600 border-amber-100 shadow-2xs"
          }`}>
            {isDanger ? <AlertTriangle className="h-6 w-6 text-rose-600" /> : <AlertCircle className="h-6 w-6 text-amber-600" />}
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Title & Message */}
        <div className="space-y-1.5">
          <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60 ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                : "bg-[#0F4C9A] hover:bg-[#0D3F80] shadow-[#0F4C9A]/20"
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isDanger && <Trash2 className="h-4 w-4 text-white" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
