import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ChevronRight, ChevronDown } from "lucide-react";
import { usePresence, AgentPresence } from "../context/PresenceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

interface RequirementPool {
  id: string;
  name: string;
  display_name?: string;
}

interface LiveAgentPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDurationHHMMSS = (statusSince?: string | null, nowMs: number = Date.now()): string => {
  if (!statusSince) return "00:00:00";
  try {
    const startMs = new Date(statusSince).getTime();
    if (isNaN(startMs)) return "00:00:00";
    const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const h = Math.floor(diffSec / 3600).toString().padStart(2, "0");
    const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(diffSec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    return "00:00:00";
  }
};

const formatLoginTimeStr = (loginAt?: string | null): string => {
  if (!loginAt) return "Not logged in";
  try {
    const dt = new Date(loginAt);
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return loginAt;
  }
};

// Requirement 11: Avoid unrealistic values (773 hr ago, 123 hr ago).
// Use realistic formatting: Just now, 12 sec ago, 2 min ago, 21 min ago, Today, 11:37 AM, or —.
const formatLastActivity = (timestamp?: string | null, nowMs: number = Date.now()): string => {
  if (!timestamp) return "—";
  try {
    const t = new Date(timestamp).getTime();
    if (isNaN(t)) return "—";
    const diffSec = Math.max(0, Math.floor((nowMs - t) / 1000));
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec} sec ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    
    // Check if timestamp is today
    const isToday = new Date(timestamp).toDateString() === new Date(nowMs).toDateString();
    if (isToday) {
      return `Today, ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return "—";
  } catch {
    return "—";
  }
};

const resolvePoolDisplayName = (
  poolIdOrName?: string | null,
  requirementPoolName?: string | null,
  poolsList: RequirementPool[] = []
): string => {
  if (requirementPoolName && !requirementPoolName.match(/^[0-9a-fA-F]{24}$/)) {
    return requirementPoolName;
  }

  const target = (poolIdOrName || "").toLowerCase().trim();
  if (!target) return "General Pool";

  const match = poolsList.find(
    (p) =>
      p.id.toLowerCase() === target ||
      p.name.toLowerCase() === target ||
      (p as any)._id?.toString().toLowerCase() === target
  );
  if (match) return match.display_name || match.name;

  if (target.includes("recruitment") || target === "6a6b40b7841e208e1cb69469") return "Recruitment";
  if (target.includes("credit") || target.includes("card") || target === "6a6b40b7841e208e1cb6946a") return "Credit Card Sales";
  if (target.includes("support") || target.includes("customer")) return "Customer Support";

  return "General Pool";
};

export default function LiveAgentPoolModal({ isOpen, onClose }: LiveAgentPoolModalProps) {
  const { user } = useAuth();
  const { agents, wsConnected, nowTicker } = usePresence();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedPoolFilter, setSelectedPoolFilter] = useState<string>("all");
  const [assignedPools, setAssignedPools] = useState<RequirementPool[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [selectedAgent, setSelectedAgent] = useState<AgentPresence | null>(null);

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isPoolDropdownOpen, setIsPoolDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const poolDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLastSyncTime(Date.now());
  }, [agents]);

  useEffect(() => {
    if (!isOpen) return;
    api.get("/api/pools/assigned")
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAssignedPools(res.data);
        }
      })
      .catch(() => setAssignedPools([]));
  }, [isOpen]);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (poolDropdownRef.current && !poolDropdownRef.current.contains(e.target as Node)) {
        setIsPoolDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const role = user?.role || "admin";
  const isSupervisor = role === "team_leader";

  const lastSyncSecAgo = Math.max(0, Math.floor((nowTicker - lastSyncTime) / 1000));

  // Custom status dropdown options metadata
  const statusDropdownOptions = useMemo(() => [
    { id: "all", label: "All Statuses", dotColor: "bg-slate-400", activeBg: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600" },
    { id: "ready", label: "Ready", dotColor: "bg-emerald-500", activeBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
    { id: "break", label: "Break", dotColor: "bg-amber-500", activeBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
    { id: "ringing", label: "Ringing", dotColor: "bg-blue-500 animate-pulse", activeBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
    { id: "talking", label: "Talking", dotColor: "bg-purple-500 animate-pulse", activeBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
    { id: "wrap_up", label: "Wrap-Up", dotColor: "bg-orange-500", activeBg: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
    { id: "offline", label: "Offline", dotColor: "bg-rose-500", activeBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800" },
  ], []);

  // Requirement 7: Small status dot + text badge (No large decorative icons)
  const getStatusBadge = (status: string, pauseReason?: string | null) => {
    const st = (status || "").toLowerCase().trim();
    switch (st) {
      case "ready":
      case "available":
        return {
          code: "ready",
          label: "Ready",
          dotColor: "bg-emerald-500",
          badgeBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80",
        };
      case "paused":
      case "break":
      case "on_break":
        return {
          code: "break",
          label: pauseReason ? `Break (${pauseReason})` : "Break",
          dotColor: "bg-amber-500",
          badgeBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/80",
        };
      case "ringing":
        return {
          code: "ringing",
          label: "Ringing",
          dotColor: "bg-blue-500 animate-pulse",
          badgeBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/80",
        };
      case "in_call":
      case "talking":
      case "on_call":
      case "busy":
        return {
          code: "talking",
          label: "Talking",
          dotColor: "bg-purple-500 animate-pulse",
          badgeBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/80",
        };
      case "wrap_up":
      case "wrapup":
      case "disposition":
        return {
          code: "wrap_up",
          label: "Wrap-Up",
          dotColor: "bg-orange-500",
          badgeBg: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/80",
        };
      case "offline":
      default:
        return {
          code: "offline",
          label: "Offline",
          dotColor: "bg-rose-500",
          badgeBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/80",
        };
    }
  };

  // Requirement 3: Dynamic status counts calculated from realtime agent pool state
  const statusCounts = useMemo(() => {
    let ready = 0;
    let breakCount = 0;
    let ringing = 0;
    let talking = 0;
    let wrapUp = 0;
    let offline = 0;

    agents.forEach((agent) => {
      const st = (agent.status || "").toLowerCase().trim();
      if (st === "ready" || st === "available") ready++;
      else if (st === "paused" || st === "break" || st === "on_break") breakCount++;
      else if (st === "ringing") ringing++;
      else if (st === "in_call" || st === "talking" || st === "on_call" || st === "busy") talking++;
      else if (st === "wrap_up" || st === "wrapup") wrapUp++;
      else offline++;
    });

    return {
      all: agents.length,
      ready,
      break: breakCount,
      ringing,
      talking,
      wrapUp,
      offline,
    };
  }, [agents]);

  // Requirement 4: Unique requirement pools represented in current dataset
  const poolOptions = useMemo(() => {
    const poolsMap = new Map<string, string>();
    assignedPools.forEach((p) => {
      poolsMap.set(p.id, p.display_name || p.name);
      poolsMap.set(p.name, p.display_name || p.name);
    });

    agents.forEach((a) => {
      const pId = a.requirementPoolId || a.pool_id;
      const pName = a.requirementPoolName;
      const resolved = resolvePoolDisplayName(pId, pName, assignedPools);
      if (pId) poolsMap.set(pId, resolved);
    });

    return Array.from(poolsMap.entries()).map(([value, label]) => ({ value, label }));
  }, [assignedPools, agents]);

  // Requirement 5 & 13: Filter agents by status, requirement pool, and search query
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const st = (agent.status || "").toLowerCase().trim();
      let code = "offline";
      if (st === "ready" || st === "available") code = "ready";
      else if (st === "paused" || st === "break" || st === "on_break") code = "break";
      else if (st === "ringing") code = "ringing";
      else if (st === "in_call" || st === "talking" || st === "on_call" || st === "busy") code = "talking";
      else if (st === "wrap_up" || st === "wrapup") code = "wrap_up";

      if (selectedStatusFilter !== "all" && code !== selectedStatusFilter) {
        return false;
      }

      if (selectedPoolFilter !== "all") {
        const poolDisplayName = resolvePoolDisplayName(agent.requirementPoolId || agent.pool_id, agent.requirementPoolName, assignedPools);
        const pId = String(agent.requirementPoolId || agent.pool_id || "").toLowerCase();
        const target = selectedPoolFilter.toLowerCase();
        if (pId !== target && poolDisplayName.toLowerCase() !== target) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poolDisplayName = resolvePoolDisplayName(agent.requirementPoolId || agent.pool_id, agent.requirementPoolName, assignedPools);
        const nameMatch = (agent.agentName || agent.name || "").toLowerCase().includes(q);
        const emailMatch = (agent.email || "").toLowerCase().includes(q);
        const empIdMatch = (agent.employee_id || "").toLowerCase().includes(q);
        const poolMatch = poolDisplayName.toLowerCase().includes(q);

        if (!nameMatch && !emailMatch && !empIdMatch && !poolMatch) {
          return false;
        }
      }

      return true;
    });
  }, [agents, selectedStatusFilter, selectedPoolFilter, searchQuery, assignedPools]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* 
        CRITICAL FIX FOR POSITIONING (Requirement 1 & 17): 
        `lg:left-64` offsets the overlay right after the 256px left navigation sidebar on desktop.
        This guarantees `flex justify-center` centers the modal precisely within the main content viewport!
      */}
      <div className="fixed inset-0 lg:left-64 z-[9999] bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative z-[10000] bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-[92%] sm:w-[90%] max-w-5xl h-[84vh] max-h-[760px] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200"
        >
          {/* ── 2. HEADER (Requirement 2 & 18) ── */}
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/60 dark:bg-slate-900/60 shrink-0 sticky top-0 z-10">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                Live Agent Monitoring
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {agents.length} agent{agents.length === 1 ? "" : "s"} • {poolOptions.length || 1} requirement pool{poolOptions.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection Indicator (Requirement 14) */}
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                {wsConnected ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">Live</span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Last sync: {lastSyncSecAgo} sec ago
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="font-bold text-amber-600 dark:text-amber-400">Reconnecting...</span>
                  </>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── 3. HORIZONTAL SEGMENTED STATUS NAVIGATION TABS (Requirement 1 & 2) ── */}
          <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/80 dark:border-slate-800 shrink-0 overflow-x-auto no-scrollbar">
            <div className="inline-flex items-center p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap shadow-inner">
              {[
                { id: "all", label: "ALL", count: statusCounts.all, dot: "bg-slate-500" },
                { id: "ready", label: "READY", count: statusCounts.ready, dot: "bg-emerald-500" },
                { id: "break", label: "BREAK", count: statusCounts.break, dot: "bg-amber-500" },
                { id: "ringing", label: "RINGING", count: statusCounts.ringing, dot: "bg-blue-500 animate-pulse" },
                { id: "talking", label: "TALKING", count: statusCounts.talking, dot: "bg-purple-500 animate-pulse" },
                { id: "wrap_up", label: "WRAP-UP", count: statusCounts.wrapUp, dot: "bg-orange-500" },
                { id: "offline", label: "OFFLINE", count: statusCounts.offline, dot: "bg-rose-500" },
              ].map((item) => {
                const isSelected = selectedStatusFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedStatusFilter(item.id)}
                    className={`h-7 px-3 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95 ${
                      isSelected
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    <span className="tracking-wide text-[11px] uppercase font-extrabold">{item.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[11px] font-black ${
                        isSelected
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-700/60"
                          : "bg-slate-300/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 4. FILTER BAR (Requirement 4 & 18) ── */}
          <div className="px-5 py-2.5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0 sticky top-[57px] z-10">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* CUSTOM REQUIREMENT POOL DROPDOWN */}
              <div className="relative" ref={poolDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsPoolDropdownOpen((prev) => !prev);
                    setIsStatusDropdownOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsPoolDropdownOpen(false);
                    else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsPoolDropdownOpen((prev) => !prev);
                    }
                  }}
                  aria-expanded={isPoolDropdownOpen}
                  aria-haspopup="listbox"
                  className="h-9 px-3 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center gap-2 cursor-pointer shadow-2xs transition"
                >
                  <span>
                    Requirement Pool: {selectedPoolFilter === "all" ? (isSupervisor ? "All Assigned Pools" : "All Pools") : poolOptions.find(p => p.value === selectedPoolFilter)?.label || selectedPoolFilter}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isPoolDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isPoolDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      role="listbox"
                      className="absolute right-0 top-full mt-1.5 z-[10050] w-60 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl space-y-0.5"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedPoolFilter === "all"}
                        onClick={() => {
                          setSelectedPoolFilter("all");
                          setIsPoolDropdownOpen(false);
                        }}
                        className={`w-full h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          selectedPoolFilter === "all"
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <span>{isSupervisor ? "All Assigned Pools" : "All Pools"}</span>
                      </button>
                      {poolOptions.map((p) => {
                        const isSelected = selectedPoolFilter === p.value;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedPoolFilter(p.value);
                              setIsPoolDropdownOpen(false);
                            }}
                            className={`w-full h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CUSTOM STATUS DROPDOWN (Requirements 1 - 12) */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusDropdownOpen((prev) => !prev);
                    setIsPoolDropdownOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsStatusDropdownOpen(false);
                    else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsStatusDropdownOpen((prev) => !prev);
                    }
                  }}
                  aria-expanded={isStatusDropdownOpen}
                  aria-haspopup="listbox"
                  aria-label="Filter by Status"
                  className="h-9 px-3 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center gap-2 cursor-pointer shadow-2xs transition"
                >
                  <span className={`h-2 w-2 rounded-full ${statusDropdownOptions.find(o => o.id === selectedStatusFilter)?.dotColor || "bg-slate-400"}`} />
                  <span>Status: {statusDropdownOptions.find(o => o.id === selectedStatusFilter)?.label || "All Statuses"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isStatusDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      role="listbox"
                      className="absolute right-0 top-full mt-1.5 z-[10050] w-56 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl space-y-0.5"
                    >
                      {statusDropdownOptions.map((opt) => {
                        const isSelected = selectedStatusFilter === opt.id;
                        const countVal = opt.id === "all" ? statusCounts.all : (statusCounts as any)[opt.id] ?? 0;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedStatusFilter(opt.id);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`w-full h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? `border ${opt.activeBg}`
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${opt.dotColor}`} />
                              <span>{opt.label}</span>
                            </div>
                            <span className={`font-mono text-[11px] font-bold ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                              {countVal}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── 5. AGENT TABLE (Requirements 5, 6, 7, 8, 9, 10, 11, 12, 18) ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto min-w-full">
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3.5">AGENT</th>
                    <th className="py-2.5 px-3.5">EMPLOYEE ID</th>
                    <th className="py-2.5 px-3.5">REQUIREMENT POOL</th>
                    <th className="py-2.5 px-3.5">STATUS</th>
                    <th className="py-2.5 px-3.5">DURATION</th>
                    <th className="py-2.5 px-3.5">CURRENT CALL</th>
                    <th className="py-2.5 px-3.5">LOGIN</th>
                    <th className="py-2.5 px-3.5">LAST ACTIVITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#0F172A]">
                  {filteredAgents.map((agent) => {
                    const statusInfo = getStatusBadge(agent.status, agent.pause_reason);
                    const durationFormatted = formatDurationHHMMSS(agent.statusSince || agent.last_status_change, nowTicker);
                    const loginFormatted = formatLoginTimeStr(agent.loginAt || agent.login_at);
                    const lastActivityStr = formatLastActivity(agent.last_activity || agent.last_status_change, nowTicker);

                    const poolNameStr = resolvePoolDisplayName(
                      agent.requirementPoolId || agent.pool_id,
                      agent.requirementPoolName,
                      assignedPools
                    );
                    const agentNameStr = agent.agentName || agent.name || "Unknown Agent";
                    const empIdStr = agent.employee_id || "—";

                    return (
                      <tr
                        key={agent.agentId || agent.id || agent.user_id}
                        onClick={() => setSelectedAgent(agent)}
                        className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition duration-150 cursor-pointer group"
                      >
                        {/* Requirement 6: Strong Agent Name Visual Hierarchy (No large avatars!) */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{agentNameStr}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 font-normal">
                            {agent.email || empIdStr}
                          </div>
                        </td>

                        {/* Employee ID Column */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300 font-semibold">
                          {empIdStr}
                        </td>

                        {/* Requirement Pool Column */}
                        <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                            {poolNameStr}
                          </span>
                        </td>

                        {/* Requirement 7: Status Dot + Badge */}
                        <td className="py-2.5 px-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11.5px] font-bold border ${statusInfo.badgeBg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotColor}`} />
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>

                        {/* Requirement 8: Monospace Technical Font Duration Ticking Live */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {durationFormatted}
                        </td>

                        {/* Requirement 9: Meaningful Realtime Call Info */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {agent.currentCallId ? (
                            <span className="text-purple-600 dark:text-purple-400 font-bold text-[11.5px]">
                              Outbound • #{String(agent.currentCallId).slice(-6)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-normal">—</span>
                          )}
                        </td>

                        {/* Requirement 10: Clean Login Time */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {loginFormatted}
                        </td>

                        {/* Requirement 11: Realistic Last Activity (No 773 hr ago!) */}
                        <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 font-medium">
                          {lastActivityStr}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Requirement 12: Clean Empty State */}
                  {filteredAgents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium text-xs">
                        No agents in this status
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 6. AGENT ROW INTERACTION COMPACT DETAIL DRAWER (Requirement 15) ── */}
          <AnimatePresence>
            {selectedAgent && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-0 bottom-0 z-[10010] w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-5 overflow-y-auto"
              >
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedAgent.agentName || selectedAgent.name || "Agent Details"}
                    </h3>
                    <p className="text-xs text-slate-400 font-normal">
                      {selectedAgent.email || "No email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgent(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs font-sans">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Employee ID</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedAgent.employee_id || "—"}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Requirement Pool</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {resolvePoolDisplayName(selectedAgent.requirementPoolId || selectedAgent.pool_id, selectedAgent.requirementPoolName, assignedPools)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Current Status</span>
                    <span>
                      {(() => {
                        const st = getStatusBadge(selectedAgent.status, selectedAgent.pause_reason);
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${st.badgeBg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dotColor}`} />
                            {st.label}
                          </span>
                        );
                      })()}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Status Duration</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatDurationHHMMSS(selectedAgent.statusSince || selectedAgent.last_status_change, nowTicker)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Login Time</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {formatLoginTimeStr(selectedAgent.loginAt || selectedAgent.login_at)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Current Call</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {selectedAgent.currentCallId ? `#${String(selectedAgent.currentCallId).slice(-6)}` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Calls Handled</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedAgent.total_calls_handled ?? 0}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Today's Break Time</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {Math.floor((selectedAgent.total_break_seconds || 0) / 60)} mins
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 font-medium">Last Activity</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {formatLastActivity(selectedAgent.last_activity || selectedAgent.last_status_change, nowTicker)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
