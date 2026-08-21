import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

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
}

interface CallEventTimelineProps {
  events: CallEventItem[];
  isLive?: boolean;
  activeDuration?: string;
  className?: string;
}

export default function CallEventTimeline({
  events = [],
  isLive = false,
  activeDuration,
  className = ""
}: CallEventTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest event when events update
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length]);

  const getDotStyle = (type?: CallEventType, customDotColor?: string) => {
    if (customDotColor) return customDotColor;
    switch (type) {
      case "initializing":
        return "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/30";
      case "ringing":
        return "bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-900/30";
      case "connected":
      case "in_call":
        return "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30";
      case "hold":
      case "mute":
        return "bg-orange-500 ring-4 ring-orange-100 dark:ring-orange-900/30";
      case "transfer":
        return "bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/30";
      case "ended":
        return "bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-900/30";
      case "disposition":
        return "bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900/30";
      default:
        return "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/30";
    }
  };

  return (
    <div className={`space-y-3 font-sans ${className}`}>
      {/* HEADER WITH LIVE SYNC BADGE */}
      <div className="flex items-center justify-between pb-1">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span>Call Event Timeline</span>
          {events.length > 0 && (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
              ({events.length})
            </span>
          )}
        </h5>

        {isLive ? (
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>LIVE SYNC</span>
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-slate-400" />
            <span>Persisted Log</span>
          </span>
        )}
      </div>

      {/* TIMELINE FEED */}
      {events.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200/60 dark:border-white/10 text-center space-y-1">
          <Clock className="h-4 w-4 mx-auto text-slate-400" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            No Events Logged Yet
          </p>
          <p className="text-[10px] text-slate-400">
            Events will stream live when a call is initiated.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="space-y-3 relative border-l-2 border-slate-200 dark:border-white/10 ml-2 pl-3.5 max-h-[320px] overflow-y-auto softphone-scrollbar pr-1 pt-1"
        >
          <AnimatePresence initial={false}>
            {events.map((evt, idx) => {
              const isLast = idx === events.length - 1;
              const dotStyle = getDotStyle(evt.type, evt.dotColor);

              return (
                <motion.div
                  key={evt.id || idx}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative group"
                >
                  {/* Status Dot */}
                  <div
                    className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full transition-all duration-200 ${dotStyle} ${
                      isLast && isLive ? "scale-110 shadow-xs" : ""
                    }`}
                  />

                  {/* Timestamp & Active Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                      {evt.timestamp}
                    </span>
                    {isLast && isLive && activeDuration && (
                      <span className="text-[9.5px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/30">
                        {activeDuration}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-snug">
                    {evt.title}
                  </p>

                  {/* Description */}
                  {evt.description && (
                    <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 leading-normal">
                      {evt.description}
                    </p>
                  )}
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
