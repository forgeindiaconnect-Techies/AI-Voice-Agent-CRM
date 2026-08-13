import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

  // Today check
  const today = new Date();
  const isToday = (d: number, isCurr: boolean) => {
    return (
      isCurr &&
      d === today.getDate() &&
      navMonth === today.getMonth() &&
      navYear === today.getFullYear()
    );
  };

  // Month navigation
  const handlePrevMonth = () => {
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
        className={`w-full h-11 px-3.5 bg-slate-50 dark:bg-[#0D1526] border ${
          isOpen
            ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 dark:border-[#3B82F6]"
            : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
        } rounded-[12px] flex items-center justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer select-none transition-all duration-200 ${
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CalendarIcon className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
          {formattedDisplay ? (
            <span className="truncate font-bold text-slate-900 dark:text-white text-xs">
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
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
            title="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
        )}
      </div>

      {/* POPUP OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: 6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            className="mt-2 z-[99999] bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-[20px] shadow-2xl p-5 w-full max-w-full outline-none text-sans overflow-hidden"
          >
            {/* POPUP HEADER */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                    Select Date & Time
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    Choose a date and time
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* MAIN GRID BODY: CALENDAR (60%) + TIME (40%) */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)] gap-5 items-stretch w-full max-w-full overflow-hidden">
              
              {/* LEFT: CALENDAR */}
              <div className="flex-1 min-w-0">
                {/* Month/Year Nav Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-wide">
                    {MONTH_NAMES[navMonth]} {navYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day Names Row */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {DAY_NAMES.map(dayName => (
                    <span
                      key={dayName}
                      className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1"
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

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (item.isPrevMonth) handlePrevMonth();
                          if (item.isNextMonth) handleNextMonth();
                          setSelectedDay(item.day);
                        }}
                        className={`h-9 w-full rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer select-none relative ${
                          isSelected
                            ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/30 font-black scale-105"
                            : item.isCurrentMonth
                            ? "text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA]"
                            : "text-slate-300 dark:text-slate-600 opacity-60 hover:text-slate-500"
                        } ${
                          todayFlag && !isSelected
                            ? "border-2 border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#60A5FA]"
                            : ""
                        }`}
                      >
                        {item.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VERTICAL DIVIDER */}
              {showTime && (
                <div className="hidden sm:block w-[1px] bg-slate-200 dark:bg-white/10 mx-1 shrink-0" />
              )}

              {/* RIGHT: TIME SELECTOR */}
              {showTime && (
                <div className="w-full sm:w-[220px] flex flex-col shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-1.5 mb-3 px-1 text-slate-900 dark:text-white">
                    <Clock className="h-4 w-4 text-[#F4B400]" />
                    <span className="font-extrabold text-sm tracking-wide">Time</span>
                  </div>

                  {/* 3 Columns: Hours | Minutes | AM/PM */}
                  <div className="flex gap-2 flex-1 h-[210px] bg-slate-50 dark:bg-[#0D1526] p-2 rounded-2xl border border-slate-100 dark:border-white/5">
                    
                    {/* Hours Column */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 softphone-scrollbar">
                      <span className="text-[9px] font-black text-slate-400 uppercase text-center pb-1 sticky top-0 bg-slate-50 dark:bg-[#0D1526]">
                        Hour
                      </span>
                      {HOURS.map(h => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setSelectedHour(h)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                            selectedHour === h
                              ? "bg-[#2563EB] text-white shadow-sm font-black"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          {String(h).padStart(2, "0")}
                        </button>
                      ))}
                    </div>

                    {/* Minutes Column */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 softphone-scrollbar border-l border-r border-slate-200/60 dark:border-white/10 px-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase text-center pb-1 sticky top-0 bg-slate-50 dark:bg-[#0D1526]">
                        Min
                      </span>
                      {MINUTES.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMinute(parseInt(m, 10))}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                            selectedMinute === parseInt(m, 10)
                              ? "bg-[#2563EB] text-white shadow-sm font-black"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* AM / PM Column */}
                    <div className="w-14 flex flex-col gap-2 justify-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase text-center pb-1">
                        Format
                      </span>
                      {(["AM", "PM"] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedPeriod(p)}
                          className={`py-2 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                            selectedPeriod === p
                              ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                              : "bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-amber-400"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* POPUP FOOTER */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition cursor-pointer px-2 py-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-md shadow-blue-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
