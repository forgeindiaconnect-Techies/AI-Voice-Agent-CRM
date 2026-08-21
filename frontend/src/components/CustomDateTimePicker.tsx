import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw
} from "lucide-react";

export interface CustomDateTimePickerProps {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  showTime?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export default function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Select Date & Time",
  label,
  className = "",
  disabled = false,
  showTime = true
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse initial date & time
  const parseValue = useCallback((valStr?: string) => {
    if (!valStr) {
      const now = new Date();
      return {
        date: now,
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hour12: now.getHours() % 12 || 12,
        minute: Math.floor(now.getMinutes() / 5) * 5,
        period: now.getHours() >= 12 ? "PM" : "AM"
      };
    }

    try {
      const d = new Date(valStr);
      if (isNaN(d.getTime())) throw new Error("Invalid Date");

      const h24 = d.getHours();
      return {
        date: d,
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        hour12: h24 % 12 || 12,
        minute: Math.floor(d.getMinutes() / 5) * 5,
        period: h24 >= 12 ? "PM" : "AM"
      };
    } catch {
      const now = new Date();
      return {
        date: now,
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hour12: now.getHours() % 12 || 12,
        minute: 0,
        period: "AM"
      };
    }
  }, []);

  const parsed = useMemo(() => parseValue(value), [value, parseValue]);

  // Picker State
  const [navYear, setNavYear] = useState(parsed.year);
  const [navMonth, setNavMonth] = useState(parsed.month);
  const [selectedDay, setSelectedDay] = useState(parsed.day);
  const [selectedHour, setSelectedHour] = useState(parsed.hour12);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsed.period as any);

  // Sync internal state when popup opens or value changes
  useEffect(() => {
    if (isOpen) {
      const current = parseValue(value);
      setNavYear(current.year);
      setNavMonth(current.month);
      setSelectedDay(current.day);
      setSelectedHour(current.hour12);
      setSelectedMinute(current.minute);
      setSelectedPeriod(current.period as any);
    }
  }, [isOpen, value, parseValue]);

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Calendar Days Grid Construction
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(navYear, navMonth, 1).getDay();
    const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(navYear, navMonth, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrevMonth: true,
        isNextMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        isPrevMonth: false,
        isNextMonth: false
      });
    }

    // Next month padding to reach 35 or 42 grid cells
    const remainingSlots = (days.length > 35 ? 42 : 35) - days.length;
    for (let d = 1; d <= remainingSlots; d++) {
      days.push({
        day: d,
        isCurrentMonth: false,
        isPrevMonth: false,
        isNextMonth: true
      });
    }

    return days;
  }, [navYear, navMonth]);

  // Today & Date Calculations
  const today = useMemo(() => new Date(), []);
  const todayDateOnly = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

  const canGoPrevMonth = useMemo(() => {
    const prevMonthDate = new Date(navYear, navMonth - 1, 1);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return prevMonthDate >= currentMonthStart;
  }, [navYear, navMonth, today]);

  // Past date helper
  const isDatePast = useCallback((day: number, isCurrentMonth: boolean, isPrevMonth: boolean, isNextMonth: boolean) => {
    let y = navYear;
    let m = navMonth;
    if (isPrevMonth) {
      m = navMonth === 0 ? 11 : navMonth - 1;
      if (navMonth === 0) y = navYear - 1;
    } else if (isNextMonth) {
      m = navMonth === 11 ? 0 : navMonth + 1;
      if (navMonth === 11) y = navYear + 1;
    }
    const itemDate = new Date(y, m, day);
    return itemDate < todayDateOnly;
  }, [navYear, navMonth, todayDateOnly]);

  const isToday = (d: number, isCurr: boolean) => {
    return (
      isCurr &&
      d === today.getDate() &&
      navMonth === today.getMonth() &&
      navYear === today.getFullYear()
    );
  };

  const isSelectedDateToday = useMemo(() => {
    return (
      navYear === today.getFullYear() &&
      navMonth === today.getMonth() &&
      selectedDay === today.getDate()
    );
  }, [navYear, navMonth, selectedDay, today]);

  // Current Time Values
  const currentH24 = today.getHours();
  const currentMin = today.getMinutes();
  const currentH12 = currentH24 % 12 || 12;
  const currentPeriod: "AM" | "PM" = currentH24 >= 12 ? "PM" : "AM";

  // Time Disabling Helpers
  const isPeriodDisabled = useCallback((p: "AM" | "PM") => {
    if (!isSelectedDateToday) return false;
    if (p === "AM" && currentPeriod === "PM") return true;
    return false;
  }, [isSelectedDateToday, currentPeriod]);

  const isHourDisabled = useCallback((h12: number) => {
    if (!isSelectedDateToday) return false;
    if (selectedPeriod === "AM" && currentPeriod === "PM") return true;
    const targetH24 = (h12 % 12) + (selectedPeriod === "PM" ? 12 : 0);
    return targetH24 < currentH24;
  }, [isSelectedDateToday, selectedPeriod, currentPeriod, currentH24]);

  const isMinuteDisabled = useCallback((minVal: number) => {
    if (!isSelectedDateToday) return false;
    const targetH24 = (selectedHour % 12) + (selectedPeriod === "PM" ? 12 : 0);
    if (targetH24 < currentH24) return true;
    if (targetH24 === currentH24 && minVal < currentMin) return true;
    return false;
  }, [isSelectedDateToday, selectedHour, selectedPeriod, currentH24, currentMin]);

  // Auto-adjust selected time when switching to today or when selections become invalid
  useEffect(() => {
    if (!isOpen) return;
    if (isSelectedDateToday) {
      // 1. Period check
      let p = selectedPeriod;
      if (p === "AM" && currentPeriod === "PM") {
        p = "PM";
        setSelectedPeriod("PM");
      }

      // 2. Hour check
      let targetH24 = (selectedHour % 12) + (p === "PM" ? 12 : 0);
      if (targetH24 < currentH24) {
        const nextH12 = currentH24 % 12 || 12;
        setSelectedHour(nextH12);
        targetH24 = currentH24;
      }

      // 3. Minute check
      if (targetH24 === currentH24 && selectedMinute < currentMin) {
        const nextMinStep = Math.ceil(currentMin / 5) * 5;
        if (nextMinStep <= 55) {
          setSelectedMinute(nextMinStep);
        } else {
          // Advance to next hour if possible
          if (currentH24 + 1 < 24) {
            const nextH24 = currentH24 + 1;
            setSelectedHour(nextH24 % 12 || 12);
            setSelectedPeriod(nextH24 >= 12 ? "PM" : "AM");
            setSelectedMinute(0);
          }
        }
      }
    }
  }, [isOpen, isSelectedDateToday, selectedPeriod, selectedHour, selectedMinute, currentPeriod, currentH24, currentMin]);

  // Month navigation
  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear(y => y - 1);
    } else {
      setNavMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear(y => y + 1);
    } else {
      setNavMonth(m => m + 1);
    }
  };

  // Apply Selection
  const handleApply = () => {
    let h24 = selectedHour % 12;
    if (selectedPeriod === "PM") h24 += 12;

    const yStr = String(navYear).padStart(4, "0");
    const mStr = String(navMonth + 1).padStart(2, "0");
    const dStr = String(selectedDay).padStart(2, "0");
    const hStr = String(h24).padStart(2, "0");
    const minStr = String(selectedMinute).padStart(2, "0");

    const formatted = showTime
      ? `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}`
      : `${yStr}-${mStr}-${dStr}`;

    onChange(formatted);
    setIsOpen(false);
  };

  // Clear Selection
  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Keyboard navigation inside popup
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  // Display text in input
  const formattedDisplay = useMemo(() => {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      const mName = MONTH_NAMES[d.getMonth()].slice(0, 3);
      const day = d.getDate();
      const yr = d.getFullYear();
      let h12 = d.getHours() % 12 || 12;
      const mins = String(d.getMinutes()).padStart(2, "0");
      const period = d.getHours() >= 12 ? "PM" : "AM";
      return showTime
        ? `${mName} ${day}, ${yr} ${h12}:${mins} ${period}`
        : `${mName} ${day}, ${yr}`;
    } catch {
      return value;
    }
  }, [value, showTime]);

  return (
    <div ref={containerRef} className={`relative inline-block w-full font-sans ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* TRIGGER BUTTON / INPUT */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full h-10 px-3 bg-slate-50/80 dark:bg-[#0D1526]/80 border ${
          isOpen
            ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 dark:border-[#3B82F6]"
            : "border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
        } rounded-[12px] flex items-center justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-white backdrop-blur-md cursor-pointer select-none transition-all duration-200 ${
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
          {formattedDisplay ? (
            <span className="truncate font-semibold text-slate-900 dark:text-white text-xs">
              {formattedDisplay}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs font-medium truncate">
              {placeholder}
            </span>
          )}
        </div>

        {value && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="p-1 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
            title="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        )}
      </div>

      {/* PORTAL OVERLAY MODAL (POLISHED ENTERPRISE GLASSMORPHISM) */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 dark:bg-black/70 backdrop-blur-xs font-sans">
              <motion.div
                ref={popupRef}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                className="bg-white/85 dark:bg-[#111827]/90 backdrop-blur-xl border border-white/70 dark:border-white/10 rounded-[20px] shadow-2xl p-4 sm:p-5 w-full max-w-[480px] sm:max-w-[500px] outline-none text-sans overflow-hidden space-y-3.5"
              >
                {/* POPUP HEADER */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8.5 w-8.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] shadow-xs">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                        Select Date &amp; Time
                      </h3>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        Choose a date and time
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* MAIN GRID BODY: BALANCED 50/50 CALENDAR + TIME */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3.5 items-stretch w-full max-w-full">
                  
                  {/* LEFT: CALENDAR (50% WIDTH) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {/* Month/Year Nav Header */}
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white tracking-wide">
                          {MONTH_NAMES[navMonth]} {navYear}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            disabled={!canGoPrevMonth}
                            className={`h-7.5 w-7.5 rounded-lg bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 transition flex items-center justify-center shadow-2xs ${
                              canGoPrevMonth
                                ? "hover:bg-slate-200/80 dark:hover:bg-white/15 cursor-pointer"
                                : "opacity-35 cursor-not-allowed pointer-events-none"
                            }`}
                            title="Previous Month"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="h-7.5 w-7.5 rounded-lg bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/15 transition flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Next Month"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Day Names Row */}
                      <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {DAY_NAMES.map(dayName => (
                          <span
                            key={dayName}
                            className="text-[10px] sm:text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-0.5"
                          >
                            {dayName}
                          </span>
                        ))}
                      </div>

                      {/* Calendar Days 7-Column Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((item, idx) => {
                          const isSelected = item.isCurrentMonth && item.day === selectedDay;
                          const todayFlag = isToday(item.day, item.isCurrentMonth);
                          const isPast = isDatePast(item.day, item.isCurrentMonth, item.isPrevMonth, item.isNextMonth);

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={isPast}
                              onClick={() => {
                                if (isPast) return;
                                if (item.isPrevMonth) handlePrevMonth();
                                if (item.isNextMonth) handleNextMonth();
                                setSelectedDay(item.day);
                              }}
                              className={`h-8 w-8 sm:h-8.5 sm:w-8.5 mx-auto rounded-full text-xs font-semibold transition-all duration-150 flex items-center justify-center select-none relative ${
                                isPast
                                  ? "opacity-35 cursor-not-allowed pointer-events-none text-slate-300 dark:text-slate-700 hover:bg-transparent"
                                  : isSelected
                                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/25 rounded-full font-black scale-105 cursor-pointer"
                                  : item.isCurrentMonth
                                  ? "text-slate-800 dark:text-slate-200 hover:bg-blue-50/80 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA] cursor-pointer"
                                  : "text-slate-300 dark:text-slate-600 opacity-50 hover:text-slate-500 cursor-pointer"
                              } ${
                                todayFlag && !isSelected && !isPast
                                  ? "border-2 border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#60A5FA] font-extrabold rounded-full"
                                  : ""
                              }`}
                            >
                              {item.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* VERTICAL DIVIDER */}
                  {showTime && (
                    <div className="hidden sm:block w-[1px] bg-slate-200/60 dark:bg-white/10 shrink-0 mx-0.5" />
                  )}

                  {/* RIGHT: TIME SELECTOR (50% WIDTH, MATCHES CALENDAR HEIGHT EXACTLY) */}
                  {showTime && (
                    <div className="w-full flex flex-col shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-white/10 h-full">
                      <div className="flex items-center gap-1.5 mb-1.5 px-0.5 text-slate-900 dark:text-white">
                        <Clock className="h-3.5 w-3.5 text-[#F4B400]" />
                        <span className="font-extrabold text-xs tracking-wide">Time</span>
                      </div>

                      {/* 3 EQUAL-WIDTH COLUMNS: HOUR | MIN | FORMAT */}
                      <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-[14px] bg-slate-100/60 dark:bg-[#0D1526]/80 border border-slate-200/60 dark:border-white/10 flex-1 h-[210px] min-h-[210px]">
                        
                        {/* Hours Column */}
                        <div className="flex flex-col gap-0.5 overflow-y-auto pr-0.5 softphone-scrollbar border-r border-slate-200/60 dark:border-white/10">
                          <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase text-center pb-1 pt-0.5 sticky top-0 bg-slate-100/95 dark:bg-[#0D1526]/95 backdrop-blur-xs z-10">
                            Hour
                          </span>
                          {HOURS.map(h => {
                            const disabledHour = isHourDisabled(h);
                            return (
                              <button
                                key={h}
                                type="button"
                                disabled={disabledHour}
                                onClick={() => !disabledHour && setSelectedHour(h)}
                                className={`h-8 rounded-[8px] text-xs font-bold transition-all text-center flex items-center justify-center shrink-0 ${
                                  disabledHour
                                    ? "opacity-35 cursor-not-allowed pointer-events-none text-slate-300 dark:text-slate-700 bg-transparent"
                                    : selectedHour === h
                                    ? "bg-[#2563EB] text-white shadow-xs rounded-[8px] font-extrabold cursor-pointer"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/10 cursor-pointer"
                                }`}
                              >
                                {String(h).padStart(2, "0")}
                              </button>
                            );
                          })}
                        </div>

                        {/* Minutes Column */}
                        <div className="flex flex-col gap-0.5 overflow-y-auto pr-0.5 softphone-scrollbar border-r border-slate-200/60 dark:border-white/10 px-0.5">
                          <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase text-center pb-1 pt-0.5 sticky top-0 bg-slate-100/95 dark:bg-[#0D1526]/95 backdrop-blur-xs z-10">
                            Min
                          </span>
                          {MINUTES.map(m => {
                            const minVal = parseInt(m, 10);
                            const disabledMin = isMinuteDisabled(minVal);
                            return (
                              <button
                                key={m}
                                type="button"
                                disabled={disabledMin}
                                onClick={() => !disabledMin && setSelectedMinute(minVal)}
                                className={`h-8 rounded-[8px] text-xs font-bold transition-all text-center flex items-center justify-center shrink-0 ${
                                  disabledMin
                                    ? "opacity-35 cursor-not-allowed pointer-events-none text-slate-300 dark:text-slate-700 bg-transparent"
                                    : selectedMinute === minVal
                                    ? "bg-[#2563EB] text-white shadow-xs rounded-[8px] font-extrabold cursor-pointer"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/10 cursor-pointer"
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>

                        {/* AM / PM Format Column */}
                        <div className="flex flex-col gap-1.5 justify-center px-0.5 shrink-0">
                          <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase text-center pb-1">
                            Format
                          </span>
                          {(["AM", "PM"] as const).map(p => {
                            const disabledPeriod = isPeriodDisabled(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                disabled={disabledPeriod}
                                onClick={() => !disabledPeriod && setSelectedPeriod(p)}
                                className={`h-8.5 w-full rounded-[9px] text-xs font-extrabold transition-all text-center flex items-center justify-center ${
                                  disabledPeriod
                                    ? "opacity-35 cursor-not-allowed pointer-events-none text-slate-300 dark:text-slate-700 bg-transparent border border-slate-200/40 dark:border-white/5"
                                    : selectedPeriod === p
                                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/25 rounded-[9px] font-black border border-amber-300/80 scale-[1.02] cursor-pointer"
                                    : "bg-white/80 dark:bg-[#111827]/80 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-white/10 hover:border-amber-400 cursor-pointer"
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    </div>
                  )}
                </div>

                {/* POPUP FOOTER */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer px-1 py-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Clear</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="h-10 px-4 rounded-[12px] text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100/80 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="h-10 px-5 rounded-[12px] text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-md shadow-blue-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Check className="h-4 w-4" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
