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
    <div ref={containerRef} className={`relative w-full text-xs font-semibold ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 bg-white dark:bg-[#172033] text-slate-700 dark:text-[#E5E7EB] shadow-2xs hover:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition duration-200 select-none text-left cursor-pointer ${triggerClassName} ${
          disabled ? "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed" : ""
        }`}
      >
        <span className={selectedOption ? "text-slate-800 dark:text-[#F8FAFC] font-bold" : "text-slate-400 dark:text-[#64748B] font-medium"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </motion.div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.95, y: openDirection === "down" ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: openDirection === "down" ? 4 : -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                zIndex: 99999,
                ...(openDirection === "down"
                  ? { top: coords.bottom + 6 }
                  : { bottom: (window.innerHeight - coords.top) + 6 })
              }}
              className="min-w-[200px] bg-white/95 dark:bg-[#162033] backdrop-blur-xl border border-slate-200/90 dark:border-[rgba(59,130,246,0.20)] rounded-[24px] shadow-2xl shadow-slate-950/60 p-3 space-y-1.5 focus:outline-none overflow-hidden"
            >
              {/* Search Input */}
              {searchable && (
                <div className="relative px-1 pt-1 pb-1.5">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#172033] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] outline-none focus:border-[#2563EB] transition font-sans"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}

              {/* Options List */}
              <div
                ref={optionsRef}
                className="max-h-[250px] overflow-y-auto space-y-1.5 pr-1 select-none font-sans"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#2563EB transparent"
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div className="text-slate-400 dark:text-[#64748B] text-center py-5 text-xs font-semibold">
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
                        className={`relative min-h-[50px] h-[50px] px-[18px] rounded-[16px] cursor-pointer flex items-center justify-between text-[15px] font-semibold transition-all duration-250 select-none ${
                          isSelected 
                            ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-bold shadow-[0_10px_25px_rgba(37,99,235,0.25)]" 
                            : isHighlighted
                            ? "bg-[#2563EB]/12 dark:bg-[#2563EB]/15 border-l-4 border-l-[#FACC15] text-slate-900 dark:text-white font-bold translate-x-1"
                            : "bg-transparent text-slate-700 dark:text-[#E5E7EB] hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="truncate z-10">{opt.label}</span>
                        {isSelected && (
                          <Check className="h-4.5 w-4.5 text-[#FACC15] shrink-0 z-10 stroke-[3] drop-shadow-xs" />
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
