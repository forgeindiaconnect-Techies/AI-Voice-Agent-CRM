import React from "react";
import { CreditCard, Check } from "lucide-react";

interface MenuBadgeProps {
  title?: string;
  subtitle?: string;
  isActive?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  showCheck?: boolean;
}

export default function MenuBadge({
  title = "Sales Team",
  subtitle,
  isActive = false,
  onClick,
  icon,
  className = "",
  showCheck = false,
}: MenuBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative inline-flex items-center gap-3.5 px-[20px] py-[12px] rounded-[12px] transition-all duration-200 ease-in-out cursor-pointer select-none font-sans ${
        isActive
          ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.35)] border border-blue-400/30"
          : "bg-slate-100/90 dark:bg-[#182233] text-slate-800 dark:text-[#F9FAFB] border border-slate-200/80 dark:border-white/10 hover:bg-slate-200/70 dark:hover:bg-[#1F2937] hover:border-blue-300 dark:hover:border-blue-500/40 hover:-translate-y-0.5 hover:scale-[1.02] shadow-xs"
      } ${className}`}
    >
      {/* Icon Badge */}
      <div
        className={`h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors duration-200 ${
          isActive
            ? "bg-white/20 text-white"
            : "bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6]"
        }`}
      >
        {icon || <CreditCard className="h-4 w-4" />}
      </div>

      {/* Label Group */}
      <div className="flex flex-col items-start justify-center min-w-0 text-left">
        <span className="text-[13.5px] font-semibold tracking-tight leading-tight whitespace-nowrap">
          {title}
        </span>
        {subtitle && (
          <span
            className={`text-[11px] font-medium tracking-wide uppercase mt-0.5 whitespace-nowrap ${
              isActive
                ? "text-blue-100"
                : "text-slate-500 dark:text-[#9CA3AF]"
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Active Check Indicator */}
      {showCheck && isActive && (
        <span className="ml-1 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Check className="h-3 w-3 text-white" />
        </span>
      )}
    </button>
  );
}
