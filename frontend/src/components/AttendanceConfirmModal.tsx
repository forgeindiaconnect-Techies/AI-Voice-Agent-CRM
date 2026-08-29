import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, LogOut, Loader2, X, Clock, Coffee } from "lucide-react";

interface AttendanceConfirmModalProps {
  isOpen: boolean;
  type: "offline" | "checkout";
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  checkInTimeStr?: string | null;
  workingTimeStr?: string;
  breakTimeStr?: string;
}

export default function AttendanceConfirmModal({
  isOpen,
  type,
  onClose,
  onConfirm,
  loading = false,
  checkInTimeStr,
  workingTimeStr = "00h 00m",
  breakTimeStr = "00h 00m",
}: AttendanceConfirmModalProps) {
  if (!isOpen) return null;

  const isOffline = type === "offline";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-[#182233] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden font-sans p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  isOffline
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                }`}
              >
                {isOffline ? <AlertTriangle className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isOffline ? "Go Offline Confirmation" : "Check Out Confirmation"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isOffline && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-3.5 space-y-2">
              {checkInTimeStr && (
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Check-in Time:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{checkInTimeStr}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" /> Working Time:
                </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{workingTimeStr}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Coffee className="h-3.5 w-3.5 text-amber-500" /> Break Time:
                </span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400">{breakTimeStr}</span>
              </div>
            </div>
          )}

          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
            {isOffline
              ? "Are you sure you want to go offline? You will not receive active incoming call queues while offline."
              : "Are you sure you want to check out? This will finalize today's attendance record."}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs text-white flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-95 ${
                isOffline
                  ? "bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isOffline ? (
                <span>Go Offline</span>
              ) : (
                <span>Check Out</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
