import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  loading?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  triggerClassName = "",
  disabled = false,
  required = false,
  searchable = false,
  loading = false
}: CustomSelectProps) {
  const selectId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");

  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine open direction and coordinates based on viewport positions
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width
      });

      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < 260 && spaceAbove > spaceBelow) {
        setOpenDirection("up");
      } else {
        setOpenDirection("down");
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  // Reset highlight index when dropdown opens or filters change
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = filteredOptions.findIndex(opt => opt.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setHighlightedIndex(-1);
      setSearchQuery("");
    }
  }, [isOpen, filteredOptions, value]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const highlightedEl = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className={`relative w-full font-sans ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full h-[46px] flex items-center justify-between border border-slate-200/80 dark:border-white/10 rounded-[12px] px-4 bg-white dark:bg-[#1E293B] text-xs font-semibold text-slate-900 dark:text-[#F9FAFC] hover:border-blue-400 dark:hover:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all duration-200 select-none text-left cursor-pointer shadow-xs ${triggerClassName} ${
          disabled ? "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed" : ""
        }`}
      >
        <span className={selectedOption ? "text-slate-900 dark:text-[#F9FAFC] font-semibold" : "text-slate-400 dark:text-slate-500 font-medium"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.96, y: openDirection === "down" ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: openDirection === "down" ? 4 : -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                zIndex: 99999,
                ...(openDirection === "down"
                  ? { top: coords.bottom + 6 }
                  : { bottom: (window.innerHeight - coords.top) + 6 })
              }}
              className="min-w-[200px] bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-white/10 rounded-[16px] shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_44px_rgba(0,0,0,0.55)] p-3 space-y-1 focus:outline-none overflow-hidden"
            >
              {/* Search Input */}
              {searchable && (
                <div className="relative px-1 pt-1 pb-2">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 h-[38px] border border-slate-200 dark:border-white/10 rounded-[10px] text-xs bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-[#F9FAFC] placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#2563EB] dark:focus:border-amber-400 transition font-sans"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}

              {/* Options List */}
              <div
                ref={optionsRef}
                className="max-h-[240px] overflow-y-auto space-y-1 pr-1 select-none font-sans no-scrollbar"
              >
                {filteredOptions.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-500 text-center py-4 text-xs font-medium">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <div
                        key={opt.value}
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`relative min-h-[42px] h-[42px] px-4 rounded-[12px] cursor-pointer flex items-center justify-between text-xs font-semibold transition-all duration-200 select-none ${
                          isSelected 
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-amber-500/15 dark:to-amber-500/10 text-[#2563EB] dark:text-[#FDE047] font-black border border-blue-200/80 dark:border-amber-500/30 shadow-2xs" 
                            : isHighlighted
                            ? "bg-slate-100/80 dark:bg-white/10 text-slate-900 dark:text-white"
                            : "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate z-10">{opt.label}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-[#2563EB] dark:text-[#FDE047] shrink-0 z-10 stroke-[2.5]" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
