import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Award, Clock, Coffee, Utensils, User, PhoneCall, CheckCircle2, X, Download, ShieldCheck, Activity } from "lucide-react";
import { AgentPresence, BreakStats } from "../context/PresenceContext";
import { api } from "../api/client";

type ShiftSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmOffline: () => void;
  presenceData: AgentPresence | null;
  agentName?: string;
};

export default function ShiftSummaryModal({
  isOpen,
  onClose,
  onConfirmOffline,
  presenceData,
  agentName = "Agent",
}: ShiftSummaryModalProps) {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/presence/shift-summary");
        setSummaryData(res);
      } catch (err) {
        console.warn("Failed to fetch shift summary:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const formatSecsToHMS = (secs?: number) => {
    if (!secs || isNaN(secs)) return "00:00:00";
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatSecsToHM = (secs?: number) => {
    if (!secs || isNaN(secs)) return "0m";
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const readySec = summaryData?.ready_seconds ?? (presenceData?.ready_seconds || 0);
  const pausedSec = summaryData?.paused_seconds ?? (presenceData?.paused_seconds || 0);
  const talkSec = summaryData?.talk_seconds ?? (presenceData?.talk_seconds || 0);
  const netSec = summaryData?.net_working_seconds ?? (readySec + talkSec);
  const grossSec = summaryData?.gross_seconds ?? (netSec + pausedSec);
  const callsCount = summaryData?.total_calls_handled ?? (presenceData?.total_calls_handled || 0);
  const avgHandling = summaryData?.avg_handling_seconds ?? (callsCount > 0 ? Math.round(talkSec / callsCount) : 0);

  const rawBreakStats: BreakStats = summaryData?.break_stats || presenceData?.break_stats || {
    tea_break: { count: 0, total_seconds: 0 },
    lunch_break: { count: 0, total_seconds: 0 },
    personal_reason: { count: 0, total_seconds: 0 },
  };

  const targetSec = 28800; // 8 hours
  const targetCompleted = netSec >= targetSec;
  const completionPercentage = summaryData?.completion_percentage ?? Math.min(150, Math.round((netSec / targetSec) * 100));

  const loginTimeStr = (summaryData?.login_at || presenceData?.login_at)
    ? new Date(summaryData?.login_at || presenceData?.login_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "09:00 AM";

  const logoutTimeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-2xl shadow-slate-950/50 border border-slate-200 dark:border-white/10 w-full max-w-2xl p-6 sm:p-8 space-y-6 transition-all duration-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Award className="h-6.5 w-6.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Final Shift Summary
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  targetCompleted
                    ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                    : "bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                }`}>
                  {targetCompleted ? "100% Target Reached 🎉" : `${completionPercentage}% Shift Completed`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {agentName} • Shift Date: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition cursor-pointer"
            title="Close summary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TOP SHIFT TELEMETRY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Shift Window</span>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
              {loginTimeStr} - {logoutTimeStr}
            </div>
            <span className="block text-[10px] font-bold text-slate-500">Gross: {formatSecsToHM(grossSec)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Net Work Hours</span>
            <div className="text-xs sm:text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
              {formatSecsToHM(netSec)} ({formatSecsToHMS(netSec)})
            </div>
            <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{completionPercentage}% of 8h target</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Break Time</span>
            <div className="text-xs sm:text-sm font-black font-mono text-amber-700 dark:text-amber-300">
              {formatSecsToHM(pausedSec)} ({formatSecsToHMS(pausedSec)})
            </div>
            <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400">Categorized pauses</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">Calls Handled</span>
            <div className="text-xs sm:text-sm font-black font-mono text-blue-700 dark:text-blue-300">
              {callsCount} calls
            </div>
            <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400">AHT: {formatSecsToHMS(avgHandling)}</span>
          </div>
        </div>

        {/* BREAK CATEGORY BREAKDOWN TABLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Categorized Break Breakdown
            </h3>
            <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
              Total Pause: {formatSecsToHMS(pausedSec)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
            <table className="w-full text-left text-xs font-medium">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-2.5">Break Category</th>
                  <th className="px-4 py-2.5 text-center">Frequency</th>
                  <th className="px-4 py-2.5 text-right">Total Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-semibold text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Coffee className="h-4 w-4" />
                    </div>
                    <span>Tea Break</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{rawBreakStats.tea_break?.count || 0} times</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                    {formatSecsToHMS(rawBreakStats.tea_break?.total_seconds)}
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Utensils className="h-4 w-4" />
                    </div>
                    <span>Lunch Break</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{rawBreakStats.lunch_break?.count || 0} times</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {formatSecsToHMS(rawBreakStats.lunch_break?.total_seconds)}
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span>Personal Reason</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{rawBreakStats.personal_reason?.count || 0} times</td>
                  <td className="px-4 py-3 text-right font-mono text-sky-600 dark:text-sky-400">
                    {formatSecsToHMS(rawBreakStats.personal_reason?.total_seconds)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* DETAILED BREAK HISTORY ENTRIES */}
          {summaryData?.break_logs && summaryData.break_logs.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Detailed Break Timeline</span>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {summaryData.break_logs.map((b: any, idx: number) => {
                  const sTime = b.start_time ? new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A";
                  const eTime = b.end_time ? new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Ongoing";
                  return (
                    <div key={idx} className="flex justify-between items-center px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl text-xs">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-amber-500" />
                        {b.type}
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        {sTime} - {eTime} ({formatSecsToHMS(b.duration_seconds || 0)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CALL TELEMETRY DETAILS */}
        <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">Call Telemetry Summary</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Total Talk Time: <strong className="font-mono text-blue-600 dark:text-blue-400">{formatSecsToHMS(talkSec)}</strong> across {callsCount} completed calls.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Avg Handling Time</span>
            <span className="text-sm font-black font-mono text-blue-700 dark:text-blue-300">{formatSecsToHMS(avgHandling)}</span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Summary
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirmOffline();
              onClose();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Confirm &amp; Go Offline</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
