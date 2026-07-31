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
    <div className="relative mb-6">
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-[22px] shadow-xs border border-slate-200/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Left: Icon + Title + Badge + Subtitle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-black shadow-2xs flex-shrink-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
              {badgeText && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right: Tabs & Buttons */}
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          {tabs && tabs.length > 0 && (
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition duration-200 ${
                    activeTab === tab.id
                      ? "bg-[#0F4C9A] text-white shadow-md"
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
              className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            >
              {btn.icon}
              {btn.label && <span>{btn.label}</span>}
            </button>
          ))}

          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="h-10 px-5 bg-[#F4B400] hover:bg-amber-400 text-[#0F4C9A] font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
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
