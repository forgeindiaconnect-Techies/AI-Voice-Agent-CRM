import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  LogOut,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Coffee,
  MapPin,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { usePresence } from "../context/PresenceContext";
import PauseBreakSelectModal from "./PauseBreakSelectModal";
import AttendanceConfirmModal from "./AttendanceConfirmModal";
import AttendanceSummaryModal from "./AttendanceSummaryModal";

export interface BreakItem {
  id?: string;
  break_type: "REFRESHMENT" | "LUNCH" | "PERSONAL";
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number;
  status: "ACTIVE" | "COMPLETED";
}

export interface TodayAttendanceRecord {
  id?: string;
  agent_id?: string;
  date: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "SUNDAY" | "HOLIDAY" | "NOT_CHECKED_IN" | "CHECKED_OUT" | "COMPLETED";
  operational_status: "WORKING" | "BREAK" | "OFFLINE" | "CHECKED_OUT" | "NOT_CHECKED_IN" | "SUNDAY" | "HOLIDAY";
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_work_minutes?: number;
  total_break_minutes?: number;
  location?: string;
  holiday_name?: string;
  current_break?: BreakItem | null;
  completed_breaks?: BreakItem[];
}

interface TodayAttendanceCardProps {
  onOpenSummary?: () => void;  // optional – card manages its own summary modal
  onAttendanceUpdated?: () => void;
}

export default function TodayAttendanceCard({
  onOpenSummary,
  onAttendanceUpdated,
}: TodayAttendanceCardProps) {
  const { showToast } = useToast();
  const { refreshPresence } = usePresence();
  const [attendance, setAttendance] = useState<TodayAttendanceRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [nowTicker, setNowTicker] = useState<number>(Date.now());

  // Modal controls
  const [isSummaryOpen, setIsSummaryOpen] = useState<boolean>(false);
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [confirmModalType, setConfirmModalType] = useState<"offline" | "checkout" | null>(null);

  // Ticker for live working & break duration calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTicker(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodayAttendance = useCallback(async () => {
    try {
      const data = await api.get("/api/attendance/today");
      setAttendance(data);
    } catch (err: any) {
      console.warn("Could not fetch today's attendance:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  // Operational State Helpers
  const opStatus = attendance?.operational_status || "NOT_CHECKED_IN";
  const isCheckedIn = !!attendance?.check_in_time && opStatus !== "NOT_CHECKED_IN" && opStatus !== "SUNDAY" && opStatus !== "HOLIDAY";
  const isWorking = opStatus === "WORKING";
  const isOnBreak = opStatus === "BREAK";
  const isOffline = opStatus === "OFFLINE";
  const isCheckedOut = opStatus === "CHECKED_OUT" || attendance?.status === "CHECKED_OUT" || attendance?.status === "COMPLETED";
  const isSunday = opStatus === "SUNDAY" || attendance?.status === "SUNDAY";
  const isHoliday = opStatus === "HOLIDAY" || attendance?.status === "HOLIDAY";

  // Format Check-In time (e.g. 09:30 AM)
  const formattedCheckInTime = useMemo(() => {
    if (!attendance?.check_in_time) return null;
    try {
      return new Date(attendance.check_in_time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return null;
    }
  }, [attendance?.check_in_time]);

  // Total Completed Break Minutes
  const completedBreakMins = useMemo(() => {
    return (attendance?.completed_breaks || []).reduce(
      (sum, b) => sum + (b.duration_minutes || 0),
      0
    );
  }, [attendance?.completed_breaks]);

  // Active Break Duration Minutes (live)
  const activeBreakMins = useMemo(() => {
    if (isOnBreak && attendance?.current_break?.start_time) {
      try {
        const start = new Date(attendance.current_break.start_time).getTime();
        return Math.max(0, Math.floor((nowTicker - start) / (1000 * 60)));
      } catch {
        return 0;
      }
    }
    return 0;
  }, [isOnBreak, attendance?.current_break?.start_time, nowTicker]);

  // Total Break Time formatted string (e.g. 00h 35m)
  const breakDurationStr = useMemo(() => {
    const totalMins = completedBreakMins + activeBreakMins;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
  }, [completedBreakMins, activeBreakMins]);

  // Net Working Time formatted string (e.g. 06h 42m)
  // Net Working Time = Gross Duration - Total Break Duration
  const workingDurationStr = useMemo(() => {
    if (!attendance?.check_in_time) return "00h 00m";
    if (isCheckedOut) {
      const mins = attendance.total_work_minutes || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
    }
    try {
      const startTime = new Date(attendance.check_in_time).getTime();
      const grossMins = Math.max(0, Math.floor((nowTicker - startTime) / (1000 * 60)));
      const totalBreakMins = completedBreakMins + activeBreakMins;
      const netMins = Math.max(0, grossMins - totalBreakMins);
      const h = Math.floor(netMins / 60);
      const m = netMins % 60;
      return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
    } catch {
      return "00h 00m";
    }
  }, [attendance?.check_in_time, attendance?.total_work_minutes, isCheckedOut, completedBreakMins, activeBreakMins, nowTicker]);

  // Action Handlers
  const handleCheckIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/check-in", { location: "Krishnagiri Office" });
      await fetchTodayAttendance();
      await refreshPresence();
      showToast("Checked in successfully! Shift started.", "success");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to check in";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectBreakType = async (breakType: "REFRESHMENT" | "LUNCH" | "PERSONAL") => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/break/start", { break_type: breakType });
      setShowBreakModal(false);
      await fetchTodayAttendance();
      await refreshPresence();
      const labelMap = { REFRESHMENT: "Refreshment", LUNCH: "Lunch", PERSONAL: "Personal" };
      showToast(`Your ${labelMap[breakType]} break has started.`, "info");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to start break";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeWork = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/break/end");
      await fetchTodayAttendance();
      await refreshPresence();
      showToast("Your break has ended. Resumed active work.", "success");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to resume work";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmGoOffline = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/offline");
      setConfirmModalType(null);
      await fetchTodayAttendance();
      await refreshPresence();
      showToast("Agent status set to Offline.", "info");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to set offline";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGoOnline = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/online");
      await fetchTodayAttendance();
      await refreshPresence();
      showToast("Agent status set to Online (Working).", "success");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to set online";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api.post("/api/attendance/check-out");
      setConfirmModalType(null);
      await fetchTodayAttendance();
      await refreshPresence();
      showToast("Checked out successfully! Shift completed.", "success");
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err: any) {
      const msg = err.details || err.message || "Failed to check out";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Break Type Label Formatting
  const activeBreakLabel = useMemo(() => {
    const bt = attendance?.current_break?.break_type;
    if (bt === "LUNCH") return "Lunch Break";
    if (bt === "REFRESHMENT") return "Refreshment Break";
    if (bt === "PERSONAL") return "Personal Break";
    return "Break";
  }, [attendance?.current_break?.break_type]);

  if (loading) {
    return (
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex items-center justify-center h-[140px]">
        <Loader2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 relative overflow-hidden"
      >
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Today's Attendance
            </h2>
          </div>

          <button
            type="button"
            id="attendance-summary-btn"
            onClick={() => {
              setIsSummaryOpen(true);
              if (onOpenSummary) onOpenSummary();
            }}
            className="px-3 py-1 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-extrabold hover:bg-emerald-200/80 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 text-xs transition cursor-pointer shadow-2xs border border-emerald-200/60 dark:border-emerald-700/50 active:scale-95"
          >
            <span>Summary</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>

        {/* Main Status & Details Row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            {/* Status & Attendance Badges */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {isCheckedIn ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Present
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Not Checked In
                </span>
              )}

              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isWorking
                      ? "bg-emerald-500 animate-pulse"
                      : isOnBreak
                      ? "bg-amber-500 animate-pulse"
                      : isOffline
                      ? "bg-slate-400"
                      : isCheckedOut
                      ? "bg-blue-500"
                      : isSunday
                      ? "bg-blue-400"
                      : isHoliday
                      ? "bg-yellow-500"
                      : "bg-slate-400"
                  }`}
                />
                {isWorking
                  ? "Working"
                  : isOnBreak
                  ? `On Break (${activeBreakLabel})`
                  : isOffline
                  ? "Offline"
                  : isCheckedOut
                  ? "Checked Out"
                  : isSunday
                  ? "Sunday"
                  : isHoliday
                  ? attendance?.holiday_name || "Holiday"
                  : "Not Checked In"}
              </h3>
            </div>

            {/* Subtitle Details */}
            {formattedCheckInTime && (
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap font-semibold">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Checked in: {formattedCheckInTime}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {attendance?.location || "Krishnagiri Office"}
                </span>
              </div>
            )}
          </div>
        </div>



        {/* Action Control Buttons Scoped to Current State */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {/* NOT_CHECKED_IN State */}
          {opStatus === "NOT_CHECKED_IN" && !isSunday && !isHoliday && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              <span>Check In</span>
            </button>
          )}

          {/* WORKING State */}
          {isWorking && (
            <>
              <button
                type="button"
                onClick={() => setShowBreakModal(true)}
                disabled={actionLoading}
                className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
              >
                <Pause className="h-4 w-4 fill-current" />
                <span>Pause / Break</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmModalType("offline")}
                disabled={actionLoading}
                className="h-9 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 font-extrabold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <LogOut className="h-4 w-4" />
                <span>Go Offline</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmModalType("checkout")}
                disabled={actionLoading}
                className="h-9 px-4 rounded-xl border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-extrabold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 ml-auto"
              >
                <LogOut className="h-4 w-4" />
                <span>Check Out</span>
              </button>
            </>
          )}

          {/* BREAK State */}
          {isOnBreak && (
            <button
              type="button"
              onClick={handleResumeWork}
              disabled={actionLoading}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              <span>Resume Work</span>
            </button>
          )}

          {/* OFFLINE State */}
          {isOffline && (
            <>
              <button
                type="button"
                onClick={handleGoOnline}
                disabled={actionLoading}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-95"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                <span>Go Online</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmModalType("checkout")}
                disabled={actionLoading}
                className="h-9 px-4 rounded-xl border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-extrabold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 ml-auto"
              >
                <LogOut className="h-4 w-4" />
                <span>Check Out</span>
              </button>
            </>
          )}

          {/* CHECKED_OUT State */}
          {isCheckedOut && (
            <button
              type="button"
              disabled
              className="h-9 px-4 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold text-xs flex items-center gap-2 opacity-80 cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Checked Out</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Break Selection Modal */}
      <PauseBreakSelectModal
        isOpen={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        onSelectBreak={handleSelectBreakType}
        loading={actionLoading}
      />

      {/* Confirmation Modal (Offline / Checkout) */}
      <AttendanceConfirmModal
        isOpen={confirmModalType !== null}
        type={confirmModalType || "offline"}
        onClose={() => setConfirmModalType(null)}
        onConfirm={confirmModalType === "offline" ? handleConfirmGoOffline : handleConfirmCheckOut}
        loading={actionLoading}
        checkInTimeStr={formattedCheckInTime}
        workingTimeStr={workingDurationStr}
        breakTimeStr={breakDurationStr}
      />

      {/* Attendance Summary Modal — self-contained, no prop chain */}
      <AttendanceSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />
    </>
  );
}
