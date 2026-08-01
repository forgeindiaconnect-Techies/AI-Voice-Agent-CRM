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
      <div className="bg-white/95 backdrop-blur-md px-4 sm:px-5 py-3.5 rounded-[18px] shadow-xs border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 transition-all duration-200 overflow-hidden max-w-full">
        
        {/* Left: Compact Icon + Title + Count Badge */}
        <div className="flex items-center gap-3 min-w-0 max-w-full">
          <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold shadow-2xs shrink-0 border border-blue-100/80">
            {icon}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">{title}</h1>
            {badgeText && (
              <span className="text-[11px] font-extrabold bg-blue-50/90 text-[#0F4C9A] border border-blue-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                {badgeText}
              </span>
            )}
            <span className="hidden xl:inline text-xs text-slate-400 font-medium truncate max-w-xs">
              · {subtitle}
            </span>
          </div>
        </div>

        {/* Right: Scrollable Inline Tabs & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap w-full md:w-auto max-w-full min-w-0">
          {tabs && tabs.length > 0 && (
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full min-w-0 no-scrollbar whitespace-nowrap">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[#0F4C9A] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
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
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {btn.icon}
              {btn.label && <span>{btn.label}</span>}
            </button>
          ))}

          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="h-9 px-4 bg-[#F4B400] hover:bg-amber-400 text-[#0F4C9A] font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
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
