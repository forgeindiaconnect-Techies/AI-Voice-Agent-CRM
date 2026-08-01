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
    <div className="relative mb-6 font-sans">
      <div className="bg-white/95 backdrop-blur-md p-5 rounded-[22px] shadow-xs border border-slate-200/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Left: Icon + Title + Badge + Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold shadow-2xs flex-shrink-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-portal-title text-slate-900 tracking-tight text-2xl md:text-3xl">{title}</h1>
              {badgeText && (
                <span className="font-badge bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full uppercase tracking-wider">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="font-secondary text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right: Tabs & Buttons */}
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          {tabs && tabs.length > 0 && (
            <div className="flex bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-4 py-2 font-button rounded-xl transition duration-200 cursor-pointer ${
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
              className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-button transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            >
              {btn.icon}
              {btn.label && <span>{btn.label}</span>}
            </button>
          ))}

          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="h-10 px-5 bg-[#F4B400] hover:bg-amber-400 text-[#0F4C9A] font-button rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
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
