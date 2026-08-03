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
  return (
    <div className="relative mb-6 font-sans max-w-full">
      {/* 2-Column Flex Header: Height <= 130px, 16px Border Radius, 20px Padding, 24px Gap */}
      <div className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-[16px] shadow-xs border border-slate-200/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 transition-all duration-200 overflow-hidden max-w-full min-h-[92px] max-h-[130px]">
        
        {/* Left Section: Icon + Title + Total Campaigns Badge + Subtitle */}
        <div className="flex items-center gap-4 min-w-0 max-w-full">
          <div className="h-11 w-11 rounded-2xl bg-blue-50/90 text-[#1E5EFF] flex items-center justify-center font-bold shadow-2xs shrink-0 border border-blue-100/80">
            {icon}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none truncate">
                {title}
              </h1>
              {badgeText && (
                <span className="text-[11px] font-extrabold bg-blue-50 text-[#1E5EFF] border border-blue-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  {badgeText}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-tight truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Aligned Row with 48px Tabs & 48px Primary Action Button */}
        <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap w-full lg:w-auto max-w-full min-w-0 justify-end">
          {tabs && tabs.length > 0 && (
            <div className="h-12 flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto max-w-full min-w-0 no-scrollbar whitespace-nowrap">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`h-10 px-4 text-xs font-extrabold rounded-xl transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center ${
                    activeTab === tab.id
                      ? "bg-[#1E5EFF] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {secondaryButtons?.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.onClick}
              title={btn.title || btn.label}
              className="h-12 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {btn.icon}
              {btn.label && <span>{btn.label}</span>}
            </button>
          ))}

          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="h-12 px-5 bg-[#1E5EFF] hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {primaryButton.icon || <Plus className="h-4 w-4" />}
              <span>{primaryButton.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
