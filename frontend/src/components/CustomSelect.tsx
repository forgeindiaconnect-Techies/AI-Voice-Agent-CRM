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
        className={`w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white text-slate-700 shadow-2xs hover:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition duration-200 select-none text-left cursor-pointer ${triggerClassName} ${
          disabled ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed" : ""
        }`}
      >
        <span className={selectedOption ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}>
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
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                zIndex: 99999,
                ...(openDirection === "down"
                  ? { top: coords.bottom + 4 }
                  : { bottom: (window.innerHeight - coords.top) + 4 })
              }}
              className="min-w-[200px] bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 p-2 space-y-1.5 focus:outline-none overflow-hidden"
            >
              {/* Search Input */}
              {searchable && (
                <div className="relative px-1 pt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}

              {/* Options List */}
              <div
                ref={optionsRef}
                className="max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1 select-none"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#CBD5E1 transparent"
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div className="text-slate-400 text-center py-4 text-[11px] font-medium">
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
                        className={`relative px-4 py-3 rounded-[12px] cursor-pointer flex items-center justify-between text-xs transition-all duration-[250ms] select-none ${
                          isSelected 
                            ? "bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] text-white font-extrabold shadow-md shadow-blue-900/10" 
                            : "text-slate-600 font-medium"
                        }`}
                      >
                        {/* Sliding Stripe-style background accent on hover */}
                        {isHighlighted && !isSelected && (
                          <motion.div
                            layoutId={`highlightBg-${selectId}`}
                            className="absolute inset-0 bg-gradient-to-r from-blue-50/80 to-blue-100/30 rounded-[12px] border-l-4 border-[#FFC107] shadow-[0_0_8px_rgba(30,106,215,0.08)] z-0"
                            initial={false}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        
                        <span className="truncate z-10">{opt.label}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-[#FFC107] shrink-0 z-10 stroke-[3]" />
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
