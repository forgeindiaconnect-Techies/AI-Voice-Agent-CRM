import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Clock, ShieldCheck, CheckCircle2, Radio, Bell, PhoneCall,
  UserCheck, PhoneOff, Pause, Wifi, Check
} from "lucide-react";

export type CallEventType =
  | "initializing"
  | "ringing"
  | "connected"
  | "in_call"
  | "hold"
  | "mute"
  | "transfer"
  | "ended"
  | "disposition";

export interface CallEventItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  dotColor?: string;
  type?: CallEventType;
  duration?: string;
  status?: "active" | "completed";
  badgeText?: string;
}

interface CallEventTimelineProps {
  events: CallEventItem[];
  isLive?: boolean;
  activeDuration?: string;
  className?: string;
}

interface EventConfig {
  label: string;
  dotBg: string;
  dotRing: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorderHover: string;
  icon: React.ReactNode;
}

const getEventConfig = (type?: CallEventType, customDotColor?: string): EventConfig => {
  switch (type) {
    case "initializing":
      return {
        label: "SIP / WebRTC",
        dotBg: customDotColor || "bg-sky-500",
        dotRing: "ring-sky-100 dark:ring-sky-900/40",
        badgeBg: "bg-sky-50 dark:bg-sky-950/60",
        badgeText: "text-sky-700 dark:text-sky-300",
        badgeBorder: "border-sky-200/80 dark:border-sky-800/60",
        cardBorderHover: "hover:border-sky-300 dark:hover:border-sky-500/50",
        icon: <Radio className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
      };
    case "ringing":
      return {
        label: "Ringing State",
        dotBg: customDotColor || "bg-amber-500",
        dotRing: "ring-amber-100 dark:ring-amber-900/40",
        badgeBg: "bg-amber-50 dark:bg-amber-950/60",
        badgeText: "text-amber-700 dark:text-amber-300",
        badgeBorder: "border-amber-200/80 dark:border-amber-800/60",
        cardBorderHover: "hover:border-amber-300 dark:hover:border-amber-500/50",
        icon: <Bell className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
      };
    case "connected":
    case "in_call":
      return {
        label: "Call Connected",
        dotBg: customDotColor || "bg-emerald-500",
        dotRing: "ring-emerald-100 dark:ring-emerald-900/40",
        badgeBg: "bg-emerald-50 dark:bg-emerald-950/60",
        badgeText: "text-emerald-700 dark:text-emerald-300",
        badgeBorder: "border-emerald-200/80 dark:border-emerald-800/60",
        cardBorderHover: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
        icon: <PhoneCall className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
      };
    case "hold":
    case "mute":
      return {
        label: "On Hold",
        dotBg: customDotColor || "bg-orange-500",
        dotRing: "ring-orange-100 dark:ring-orange-900/40",
        badgeBg: "bg-orange-50 dark:bg-orange-950/60",
        badgeText: "text-orange-700 dark:text-orange-300",
        badgeBorder: "border-orange-200/80 dark:border-orange-800/60",
        cardBorderHover: "hover:border-orange-300 dark:hover:border-orange-500/50",
        icon: <Pause className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />
      };
    case "transfer":
      return {
        label: "Transferred",
        dotBg: customDotColor || "bg-indigo-500",
        dotRing: "ring-indigo-100 dark:ring-indigo-900/40",
        badgeBg: "bg-indigo-50 dark:bg-indigo-950/60",
        badgeText: "text-indigo-700 dark:text-indigo-300",
        badgeBorder: "border-indigo-200/80 dark:border-indigo-800/60",
        cardBorderHover: "hover:border-indigo-300 dark:hover:border-indigo-500/50",
        icon: <Activity className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
      };
    case "ended":
      return {
        label: "Call Ended",
        dotBg: customDotColor || "bg-rose-500",
        dotRing: "ring-rose-100 dark:ring-rose-900/40",
        badgeBg: "bg-rose-50 dark:bg-rose-950/60",
        badgeText: "text-rose-700 dark:text-rose-300",
        badgeBorder: "border-rose-200/80 dark:border-rose-800/60",
        cardBorderHover: "hover:border-rose-300 dark:hover:border-rose-500/50",
        icon: <PhoneOff className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
      };
    case "disposition":
      return {
        label: "Agent Disposition",
        dotBg: customDotColor || "bg-purple-500",
        dotRing: "ring-purple-100 dark:ring-purple-900/40",
        badgeBg: "bg-purple-50 dark:bg-purple-950/60",
        badgeText: "text-purple-700 dark:text-purple-300",
        badgeBorder: "border-purple-200/80 dark:border-purple-800/60",
        cardBorderHover: "hover:border-purple-300 dark:hover:border-purple-500/50",
        icon: <UserCheck className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
      };
    default:
      return {
        label: "Call Event",
        dotBg: customDotColor || "bg-blue-500",
        dotRing: "ring-blue-100 dark:ring-blue-900/40",
        badgeBg: "bg-blue-50 dark:bg-blue-950/60",
        badgeText: "text-blue-700 dark:text-blue-300",
        badgeBorder: "border-blue-200/80 dark:border-blue-800/60",
        cardBorderHover: "hover:border-blue-300 dark:hover:border-blue-500/50",
        icon: <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
      };
  }
};

export default function CallEventTimeline({
  events = [],
  isLive = false,
  activeDuration,
  className = ""
}: CallEventTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom only when live events are streaming
  useEffect(() => {
    if (isLive && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, isLive]);

  return (
    <div className={`space-y-3.5 font-sans ${className}`}>
      {/* HEADER WITH EVENT COUNT BADGE & STATUS INDICATOR */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>Call Event Timeline</span>
          </h5>
          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60">
            {events.length}
          </span>
        </div>

        {isLive ? (
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>LIVE SYNC</span>
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
            <span>Persisted Log</span>
          </span>
        )}
      </div>

      {/* TIMELINE FEED */}
      {events.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#151F32] border border-dashed border-slate-200 dark:border-white/10 text-center space-y-1.5">
          <Clock className="h-5 w-5 mx-auto text-slate-400 opacity-75" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            No Events Logged Yet
          </p>
          <p className="text-[11px] text-slate-400">
            Events will stream live when a call is initiated.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative pl-6 space-y-3.5 max-h-[380px] overflow-y-auto softphone-scrollbar pr-1 pt-1 pb-2"
        >
          {/* PERFECT VERTICAL CONNECTING LINE */}
          <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-slate-200 dark:bg-slate-700/60 rounded-full pointer-events-none" />

          <AnimatePresence initial={false}>
            {events.map((evt, idx) => {
              const isLast = idx === events.length - 1;
              const config = getEventConfig(evt.type, evt.dotColor);

              return (
                <motion.div
                  key={evt.id || idx}
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative group"
                >
                  {/* STATUS DOT - PERFECTLY ALIGNED ON CONNECTING LINE */}
                  <div
                    className={`absolute -left-[23px] top-3 w-3 h-3 rounded-full transition-all duration-200 ${config.dotBg} ring-4 ${config.dotRing} shadow-sm group-hover:scale-125 z-10 ${
                      isLast && isLive ? "animate-pulse" : ""
                    }`}
                  />

                  {/* EVENT CARD */}
                  <div className={`p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#172033]/80 border border-slate-200/80 dark:border-white/10 ${config.cardBorderHover} hover:bg-white dark:hover:bg-[#1C283F] hover:shadow-xs transition-all duration-200 space-y-1.5`}>
                    {/* Header row: Badge & Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                        {config.icon}
                        <span>{evt.type ? config.label : (evt.badgeText || "Call Event")}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-mono font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 opacity-70" />
                          {evt.timestamp}
                        </span>
                        {isLast && isLive && activeDuration && (
                          <span className="text-[9.5px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/30">
                            {activeDuration}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Event Title */}
                    <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                      {evt.title}
                    </h6>

                    {/* Event Description */}
                    {evt.description && (
                      <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed break-words whitespace-pre-wrap">
                        {evt.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
