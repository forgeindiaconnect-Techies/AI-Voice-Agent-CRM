import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Clock, Play, PhoneOff, X, ShieldAlert } from "lucide-react";

type EarlyLogoutWarningModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmEarlyLogout: () => void;
  netWorkingSeconds: number;
  targetSeconds?: number;
};

export default function EarlyLogoutWarningModal({
  isOpen,
  onClose,
  onConfirmEarlyLogout,
  netWorkingSeconds,
  targetSeconds = 28800, // 8 hours
}: EarlyLogoutWarningModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const remainingSeconds = Math.max(0, targetSeconds - netWorkingSeconds);

  const formatSecsToHM = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} mins`;
  };

  const completedFormatted = formatSecsToHM(netWorkingSeconds);
  const remainingFormatted = formatSecsToHM(remainingSeconds);
  const completionPercentage = Math.min(100, Math.round((netWorkingSeconds / targetSeconds) * 100));

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-2xl shadow-slate-950/40 border border-slate-200 dark:border-white/10 w-full max-w-md p-6 sm:p-7 space-y-6 transition-all duration-200 animate-in fade-in zoom-in-95">
        
        {/* Header Icon & Close */}
        <div className="flex items-start justify-between">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30 shadow-2xs">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition cursor-pointer"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Shift Incomplete
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
              {completionPercentage}% Done
            </span>
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-300 font-extrabold p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 leading-relaxed">
            ⚠️ Complete your 8-hour working period before going offline.
          </p>
        </div>

        {/* TIME TELEMETRY PROGRESS BOX */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Completed Work</span>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{completedFormatted}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Time Remaining</span>
              <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">{remainingFormatted}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 mb-1">
              <span>0h</span>
              <span>Target: 8h 00m</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Resume Shift &amp; Stay Ready</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirmEarlyLogout();
            }}
            className="w-full h-10 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>Proceed to Shift Summary &amp; Offline</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
