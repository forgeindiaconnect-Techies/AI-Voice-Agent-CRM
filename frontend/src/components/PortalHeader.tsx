import React from "react";
import { Plus } from "lucide-react";

export type PortalTab = {
  id: string;
  label: string;
};

export type PortalSecondaryButton = {
  label?: string;
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
};

export type PortalPrimaryButton = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

export type PortalHeaderProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badgeText?: string;
  tabs?: PortalTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  primaryButton?: PortalPrimaryButton;
  secondaryButtons?: PortalSecondaryButton[];
};

export default function PortalHeader({
  icon,
  title,
  subtitle,
  badgeText,
  tabs,
  activeTab,
  onTabChange,
  primaryButton,
  secondaryButtons,
}: PortalHeaderProps) {
  const words = (title || "").trim().split(" ");
  const halfIndex = words.length > 1 ? Math.ceil(words.length / 2) : 1;
  const firstHalf = words.slice(0, halfIndex).join(" ");
  const secondHalf = words.slice(halfIndex).join(" ");

  return (
    <div className="relative mb-4 font-sans max-w-full">
      {/* 2-Column Flex Header: 12px Border Radius, Compact Padding */}
      <div className="bg-white dark:bg-[#1E293B] backdrop-blur-md p-3.5 sm:p-4 rounded-[12px] shadow-2xs border border-slate-200/80 dark:border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 transition-all duration-200 overflow-hidden max-w-full">
        
        {/* Left Section: Icon + Title + Total Campaigns Badge + Subtitle */}
        <div className="flex items-center gap-3 min-w-0 max-w-full">
          <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-500/20 dark:to-amber-500/10 text-[#1D4ED8] dark:text-[#FDE047] flex items-center justify-center font-bold shadow-2xs shrink-0 border border-amber-300/60 dark:border-amber-500/30">
            {icon}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="flex flex-col items-start">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-1.5">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">{firstHalf}</span>
                  {secondHalf && (
                    <span className="text-[#F4B400] font-extrabold">
                      {secondHalf}
                    </span>
                  )}
                </h1>
              </div>
              
              <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                {badgeText || "ENTERPRISE V1.0"}
              </span>
            </div>

            {subtitle && (
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium tracking-tight truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Aligned Row with 42px Tabs & 40px Primary Action Button */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap w-full lg:w-auto max-w-full min-w-0 justify-end">
          {tabs && tabs.length > 0 && (
            <div className="h-[42px] flex items-center bg-slate-100/90 dark:bg-[#182233] p-1 rounded-[10px] border border-slate-200/80 dark:border-white/10 overflow-x-auto max-w-full min-w-0 no-scrollbar whitespace-nowrap shadow-inner">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className={`h-[34px] px-3.5 rounded-[8px] text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FFD54A] to-[#F4B400] text-[#123E8A] shadow-2xs border border-amber-300/50"
                        : "text-slate-700 dark:text-[#F8FAFC] hover:text-[#123E8A] hover:bg-gradient-to-r hover:from-amber-100/90 hover:to-amber-200/90 dark:hover:from-amber-500/20 dark:hover:to-amber-500/30"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {secondaryButtons?.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.onClick}
              title={btn.title || btn.label}
              className="h-[40px] px-3.5 bg-slate-100 dark:bg-[#172033] hover:bg-amber-50 dark:hover:bg-[#1F2B45] hover:border-amber-300 text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {btn.icon}
              {btn.label && <span>{btn.label}</span>}
            </button>
          ))}

          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="h-[40px] px-4 bg-gradient-to-r from-[#FFD54A] to-[#F4B400] hover:from-[#F4B400] hover:to-[#E0A100] text-[#123E8A] font-semibold text-xs rounded-[10px] transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap border border-amber-300/40"
            >
              {primaryButton.icon || <Plus className="h-3.5 w-3.5 text-[#123E8A]" />}
              <span>{primaryButton.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
