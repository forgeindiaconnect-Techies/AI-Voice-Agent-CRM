import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Utensils, User, X } from "lucide-react";

interface PauseBreakSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBreak: (breakType: "REFRESHMENT" | "LUNCH" | "PERSONAL") => void;
  loading?: boolean;
}

export default function PauseBreakSelectModal({
  isOpen,
  onClose,
  onSelectBreak,
  loading = false,
}: PauseBreakSelectModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-[#182233] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Select Break Type
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Break Options */}
          <div className="p-4 sm:p-5 space-y-2.5">
            {/* Refreshment Break */}
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelectBreak("REFRESHMENT")}
              className="w-full p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-amber-500/30 flex items-center gap-3 transition cursor-pointer text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Coffee className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-amber-900 dark:text-amber-300 leading-snug">
                  ☕ Refreshment Break
                </p>
                <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400/80">
                  Short tea/coffee break
                </p>
              </div>
            </button>

            {/* Lunch Break */}
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelectBreak("LUNCH")}
              className="w-full p-3.5 rounded-2xl bg-orange-50/70 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-900/40 border border-orange-200/80 dark:border-orange-500/30 flex items-center gap-3 transition cursor-pointer text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Utensils className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-orange-900 dark:text-orange-300 leading-snug">
                  🍱 Lunch Break
                </p>
                <p className="text-[11px] font-medium text-orange-700/80 dark:text-orange-400/80">
                  Meal &amp; rest break
                </p>
              </div>
            </button>

            {/* Personal Break */}
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelectBreak("PERSONAL")}
              className="w-full p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/80 dark:border-purple-500/30 flex items-center gap-3 transition cursor-pointer text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-purple-900 dark:text-purple-300 leading-snug">
                  👤 Personal Break
                </p>
                <p className="text-[11px] font-medium text-purple-700/80 dark:text-purple-400/80">
                  Personal work or emergency
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
