import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface StatsResponse {
  current_month: {
    month_name: string;
    year: number;
    month: number;
    present: number;
    half_day: number;
    absent: number;
    attendance_rate: number;
  };
  all_time: {
    present: number;
    half_day: number;
    absent: number;
    attendance_rate: number;
  };
  attendance_rate: number;
}

export interface CalendarDay {
  date: string;
  day: number;
  is_current_month: boolean;
  status:
    | "PRESENT"
    | "HALF_DAY"
    | "ABSENT"
    | "SUNDAY"
    | "HOLIDAY"
    | "NOT_CHECKED_IN"
    | "MUTED";
  holiday_name?: string;
  check_in_time?: string;
  check_out_time?: string;
  total_work_minutes?: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  month_name: string;
  days: CalendarDay[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function StatSkeleton() {
  return <div className="animate-pulse bg-slate-100 dark:bg-slate-800/60 rounded-2xl h-16 sm:h-[72px]" />;
}

function getDayStyle(status: CalendarDay["status"], isToday: boolean): string {
  const base = "h-8 w-full rounded-xl flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all duration-150 select-none";
  if (isToday) return `${base} ring-2 ring-blue-500 bg-blue-50 text-blue-700 font-extrabold z-10`;
  switch (status) {
    case "PRESENT":      return `${base} bg-emerald-100 text-emerald-800 font-extrabold`;
    case "HALF_DAY":     return `${base} bg-amber-100 text-amber-800 font-extrabold`;
    case "ABSENT":       return `${base} bg-rose-100 text-rose-800 font-extrabold`;
    case "SUNDAY":       return `${base} bg-blue-100 text-blue-800 font-extrabold`;
    case "HOLIDAY":      return `${base} bg-yellow-100 text-yellow-800 font-extrabold`;
    case "NOT_CHECKED_IN": return `${base} bg-slate-100 text-slate-500`;
    default:             return `${base} bg-slate-100 text-slate-400`;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
// IMPORTANT: This component ALWAYS renders (never returns null) so that:
//   1. React does not need to mount/unmount the component on each open/close
//   2. AnimatePresence can properly handle enter and exit animations
//   3. The portal is always registered in document.body
//   4. Body scroll lock and keyboard handlers always apply cleanly
export default function AttendanceSummaryModal({ isOpen, onClose }: AttendanceSummaryModalProps) {

  const [activeTab, setActiveTab] = useState<"statistics" | "calendar">("statistics");

  // ── Stats state ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // ── Calendar state ─────────────────────────────────────────────────────────
  const nowObj = new Date();
  const [calYear, setCalYear] = useState(nowObj.getFullYear());
  const [calMonth, setCalMonth] = useState(nowObj.getMonth() + 1);
  const [calData, setCalData] = useState<CalendarResponse | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  // ── Guards ─────────────────────────────────────────────────────────────────
  const statsLoadedForSessionRef = useRef(false);
  const prevCalKey = useRef<string>("");

  // ── Fetch stats (de-duplicated per session) ────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await api.get("/api/attendance/statistics");
      setStats(data);
      statsLoadedForSessionRef.current = true;
    } catch (err: any) {
      setStatsError(err?.message ?? "Could not load statistics");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Fetch calendar ─────────────────────────────────────────────────────────
  const fetchCal = useCallback(async (yr: number, mo: number) => {
    setCalLoading(true);
    setCalError(null);
    try {
      const data = await api.get(`/api/attendance/calendar?year=${yr}&month=${mo}`);
      setCalData(data);
    } catch (err: any) {
      setCalError(err?.message ?? "Could not load calendar");
    } finally {
      setCalLoading(false);
    }
  }, []);

  // ── On open: fetch data asynchronously (never blocks the click) ────────────
  useEffect(() => {
    if (!isOpen) return;
    // Always reset tab and stats-loaded guard when modal opens fresh
    setActiveTab("statistics");
    statsLoadedForSessionRef.current = false;
    fetchStats();
    const calKey = `${calYear}-${calMonth}`;
    prevCalKey.current = calKey;
    fetchCal(calYear, calMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Reset calendar to current month when modal closes ─────────────────────
  useEffect(() => {
    if (!isOpen) {
      const n = new Date();
      setCalYear(n.getFullYear());
      setCalMonth(n.getMonth() + 1);
    }
  }, [isOpen]);

  // ── Fetch calendar when month navigates (avoid initial double-fetch) ────────
  useEffect(() => {
    if (!isOpen) return;
    const key = `${calYear}-${calMonth}`;
    if (key === prevCalKey.current) return;
    prevCalKey.current = key;
    fetchCal(calYear, calMonth);
  }, [isOpen, calYear, calMonth, fetchCal]);

  // ── Body scroll lock + Escape key ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  // ── Realtime: refresh when WS attendance events fire ──────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => {
      fetchStats();
      fetchCal(calYear, calMonth);
    };
    const EVENTS = [
      "attendance:checked-in",
      "attendance:checked-out",
      "attendance:break-started",
      "attendance:break-ended",
      "attendance:status-changed",
    ];
    EVENTS.forEach((e) => window.addEventListener(e, refresh));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, refresh));
  }, [isOpen, calYear, calMonth, fetchStats, fetchCal]);

  // ── Month navigation ───────────────────────────────────────────────────────
  const prevMonth = () => {
    setCalMonth((m) => {
      if (m === 1) { setCalYear((y) => y - 1); return 12; }
      return m - 1;
    });
  };
  const nextMonth = () => {
    setCalMonth((m) => {
      if (m === 12) { setCalYear((y) => y + 1); return 1; }
      return m + 1;
    });
  };

  const todayStr = getTodayStr();
  const rate = stats?.attendance_rate ?? 0;
  const rateTextColor = rate >= 90 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-rose-600";
  const rateBarColor  = rate >= 90 ? "bg-emerald-500"  : rate >= 70 ? "bg-amber-500"  : "bg-rose-500";

  // ── Always render into the portal — AnimatePresence handles visibility ──────
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="attendance-summary-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="My Attendance Summary"
        >
          {/* ── Modal Panel ── */}
          <motion.div
            key="attendance-summary-panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            className="
              bg-white dark:bg-[#182233]
              border border-slate-200/80 dark:border-white/10
              rounded-3xl shadow-2xl
              w-full max-w-lg
              max-h-[90dvh] sm:max-h-[88vh]
              flex flex-col
              overflow-hidden
              font-sans
            "
          >
            {/* ── Header (fixed) ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center border border-blue-100 dark:border-blue-500/20 shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  My Attendance Summary
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Refresh"
                  onClick={() => { fetchStats(); fetchCal(calYear, calMonth); }}
                  disabled={statsLoading || calLoading}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${(statsLoading || calLoading) ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  id="attendance-summary-close"
                  title="Close"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Tabs (fixed) ── */}
            <div className="flex-shrink-0 px-4 sm:px-5 pt-3">
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl flex gap-1">
                {(["statistics", "calendar"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                      activeTab === tab
                        ? "bg-white dark:bg-[#1e2d45] text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab === "statistics" ? "Statistics" : "Calendar View"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">

              {/* ════════ STATISTICS TAB ════════ */}
              {activeTab === "statistics" && (
                <div className="space-y-4">

                  {/* Current Month */}
                  <section className="space-y-2.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
                      {stats?.current_month?.month_name || `${MONTH_NAMES[new Date().getMonth()]} (Current Month)`}
                    </h3>
                    {statsError ? (
                      <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/30 rounded-2xl p-4 text-center space-y-1">
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{statsError}</p>
                        <button type="button" onClick={fetchStats} className="text-xs font-bold text-rose-600 underline cursor-pointer">
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {statsLoading ? (
                          <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
                        ) : (
                          <>
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/30 p-3 rounded-2xl space-y-1 min-w-0">
                              <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3 shrink-0" /><span className="truncate">Present</span>
                              </div>
                              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                {stats?.current_month?.present ?? 0}
                              </p>
                            </div>
                            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/30 p-3 rounded-2xl space-y-1 min-w-0">
                              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                <Clock className="h-3 w-3 shrink-0" /><span className="truncate">Half Day</span>
                              </div>
                              <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 leading-none">
                                {stats?.current_month?.half_day ?? 0}
                              </p>
                            </div>
                            <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/30 p-3 rounded-2xl space-y-1 min-w-0">
                              <div className="flex items-center gap-1 text-rose-700 dark:text-rose-400 text-[10px] font-bold">
                                <XCircle className="h-3 w-3 shrink-0" /><span className="truncate">Absent</span>
                              </div>
                              <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 leading-none">
                                {stats?.current_month?.absent ?? 0}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </section>

                  {/* All Time */}
                  <section className="space-y-2.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">All Time</h3>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {statsLoading ? (
                        <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
                      ) : (
                        <>
                          <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-500/30 p-3 rounded-2xl space-y-1 min-w-0">
                            <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400 text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3 shrink-0" /><span className="truncate">Present</span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">
                              {stats?.all_time?.present ?? 0}
                            </p>
                          </div>
                          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/30 p-3 rounded-2xl space-y-1 min-w-0">
                            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                              <Clock className="h-3 w-3 shrink-0" /><span className="truncate">Half Day</span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 leading-none">
                              {stats?.all_time?.half_day ?? 0}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-3 rounded-2xl space-y-1 min-w-0">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                              <XCircle className="h-3 w-3 shrink-0" /><span className="truncate">Absent</span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-black text-slate-700 dark:text-slate-300 leading-none">
                              {stats?.all_time?.absent ?? 0}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  {/* Attendance Rate */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">Attendance Rate</span>
                      {statsLoading
                        ? <div className="h-7 w-14 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        : <span className={`text-xl sm:text-2xl font-black ${rateTextColor}`}>{rate}%</span>
                      }
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${rateBarColor} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: statsLoading ? "0%" : `${Math.min(100, Math.max(0, rate))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ════════ CALENDAR TAB ════════ */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    {[
                      { label: "Present",  color: "bg-emerald-500" },
                      { label: "Half Day", color: "bg-amber-500"   },
                      { label: "Absent",   color: "bg-rose-500"    },
                      { label: "Sunday",   color: "bg-blue-500"    },
                      { label: "Holiday",  color: "bg-yellow-500"  },
                    ].map(({ label, color }) => (
                      <span key={label} className="inline-flex items-center gap-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${color} shrink-0`} />
                        <span>{label}</span>
                      </span>
                    ))}
                  </div>

                  {/* Calendar card */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-3 sm:p-4 space-y-3">
                    {/* Month nav */}
                    <div className="flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={prevMonth}
                        aria-label="Previous month"
                        className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182233] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        {MONTH_NAMES[calMonth - 1]} {calYear}
                      </h4>
                      <button
                        type="button"
                        onClick={nextMonth}
                        aria-label="Next month"
                        className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182233] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 text-center text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <div key={d}>{d}</div>)}
                    </div>

                    {/* Day grid */}
                    {calLoading ? (
                      <div className="py-10 flex justify-center">
                        <Loader2 className="h-7 w-7 text-blue-600 dark:text-blue-400 animate-spin" />
                      </div>
                    ) : calError ? (
                      <div className="py-6 text-center space-y-1">
                        <p className="text-xs text-rose-500 font-semibold">{calError}</p>
                        <button type="button" onClick={() => fetchCal(calYear, calMonth)} className="text-xs font-bold text-rose-500 underline cursor-pointer">Retry</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
                        {(calData?.days ?? []).map((day, idx) => {
                          if (!day.is_current_month) {
                            return (
                              <div key={`muted-${idx}`} className="h-8 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600 font-medium">
                                {day.day}
                              </div>
                            );
                          }
                          const isToday = day.date === todayStr;
                          return (
                            <div
                              key={day.date}
                              title={
                                day.holiday_name
                                  ? `Holiday: ${day.holiday_name}`
                                  : isToday
                                  ? `Today · ${day.status}`
                                  : day.status
                              }
                              className={getDayStyle(day.status, isToday)}
                            >
                              {day.day}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Today is highlighted with a blue ring
                  </p>
                </div>
              )}
            </div>
            {/* ── end scrollable ── */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
