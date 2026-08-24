import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Coffee, Utensils, User, X, CheckCircle2, Play, Clock, Sparkles } from "lucide-react";
import { BreakStats } from "../context/PresenceContext";

type PauseBreakModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectBreak: (reason: "Tea Break" | "Lunch Break" | "Personal Reason") => void;
  onEndBreak: () => void;
  currentStatus: string;
  currentPauseReason?: string | null;
  pausedSeconds?: number;
  breakStats?: BreakStats;
};

export default function PauseBreakModal({
  isOpen,
  onClose,
  onSelectBreak,
  onEndBreak,
  currentStatus,
  currentPauseReason,
  pausedSeconds = 0,
  breakStats,
}: PauseBreakModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const formatSecsToHMS = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00:00";
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isCurrentlyPaused = currentStatus === "paused";

  const teaStats = breakStats?.tea_break || { count: 0, total_seconds: 0 };
  const lunchStats = breakStats?.lunch_break || { count: 0, total_seconds: 0 };
  const personalStats = breakStats?.personal_reason || { count: 0, total_seconds: 0 };

  const breakOptions = [
    {
      id: "Tea Break" as const,
      title: "Tea Break",
      recommended: "15 Mins",
      description: "Quick refreshment, tea, coffee & rest break",
      icon: Coffee,
      color: "amber",
      bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      borderColor: "border-amber-500/30 hover:border-amber-500",
      accentBg: "bg-amber-500 text-white",
      stats: teaStats,
    },
    {
      id: "Lunch Break" as const,
      title: "Lunch Break",
      recommended: "30-45 Mins",
      description: "Meal & lunch break duration tracking",
      icon: Utensils,
      color: "emerald",
      bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      borderColor: "border-emerald-500/30 hover:border-emerald-500",
      accentBg: "bg-emerald-600 text-white",
      stats: lunchStats,
    },
    {
      id: "Personal Reason" as const,
      title: "Personal Reason",
      recommended: "Short Pause",
      description: "Personal pause, urgent administrative task or rest",
      icon: User,
      color: "sky",
      bgGradient: "from-sky-500/10 via-sky-500/5 to-transparent",
      borderColor: "border-sky-500/30 hover:border-sky-500",
      accentBg: "bg-sky-600 text-white",
      stats: personalStats,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-2xl shadow-slate-950/40 border border-slate-200 dark:border-white/10 w-full max-w-xl p-6 sm:p-7 space-y-6 transition-all duration-200 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30 shadow-2xs">
              <Clock className="h-5.5 w-5.5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isCurrentlyPaused ? "Active Pause / Break" : "Select Pause / Break Category"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isCurrentlyPaused
                  ? "Track your break duration in real time or resume work anytime."
                  : "Choose an option to log your break duration and notify the team."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ACTIVE BREAK BANNER (IF CURRENTLY PAUSED) */}
        {isCurrentlyPaused && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 dark:border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Currently On {currentPauseReason || "Break"}
                </span>
              </div>
              <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-300">
                {formatSecsToHMS(pausedSeconds)}
              </span>
            </div>

            <button
              onClick={() => {
                onEndBreak();
                onClose();
              }}
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>End Break &amp; Set Ready</span>
            </button>
          </div>
        )}

        {/* BREAK OPTIONS CARDS */}
        <div className="grid grid-cols-1 gap-3">
          {breakOptions.map((opt) => {
            const Icon = opt.icon;
            const isCurrentReason = isCurrentlyPaused && currentPauseReason === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  onSelectBreak(opt.id);
                  onClose();
                }}
                className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isCurrentReason
                    ? "bg-amber-50/80 dark:bg-amber-500/15 border-amber-500 shadow-md ring-2 ring-amber-500/20"
                    : `bg-slate-50/70 dark:bg-slate-900/50 ${opt.borderColor} hover:shadow-lg hover:scale-[1.01]`
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${opt.bgGradient} rounded-full blur-2xl pointer-events-none`} />

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${opt.accentBg} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="h-6 w-6" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {opt.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {opt.recommended}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </div>

                  {/* STATS BADGE */}
                  <div className="text-right shrink-0">
                    <span className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Today's Log
                    </span>
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                      {opt.stats.count} {opt.stats.count === 1 ? "break" : "breaks"}
                    </span>
                    <span className="block text-[11px] font-bold font-mono text-amber-600 dark:text-amber-400">
                      {formatSecsToHMS(opt.stats.total_seconds)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" /> All break durations are tracked in real time &amp; synced with backend telemetry.
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
