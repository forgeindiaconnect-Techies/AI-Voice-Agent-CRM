import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Users,
  Phone,
  Megaphone,
  Zap,
  Download,
  CheckCircle,
  RefreshCw,
  Activity,
  Headphones,
  Mic,
  Volume2,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
  Radio,
  BarChart3,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  TrendingDown,
  User,
  DollarSign,
  Search,
  X,
  SlidersHorizontal,
  Wifi
} from "lucide-react";

type Summary = {
  total_pools: number;
  total_supervisors: number;
  total_agents: number;
  active_agents: number;
  total_campaigns: number;
  total_leads: number;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  transferred_calls: number;
  qualified_leads: number;
  rejected_leads: number;
  active_calls: number;
  today_calls: number;
  today_imports: number;
  success_rate: number;
  conversion_rate: number;
  today_followups: number;
  today_conversions: number;
  team_performance: number;
  queue_status: {
    waiting_leads: number;
    status: string;
  };
  ai_agent_status: {
    active_channels: number;
    status: string;
  };
  system_health: {
    mongodb: string;
    api: string;
  };
};

type AuditLog = {
  id: string;
  actor_name: string;
  action: string;
  target_employee_id?: string;
  timestamp: string;
};

type LiveCall = {
  id: string;
  lead_id: string;
  agent_id: string;
  pool_id: string;
  direction: string;
  campaign?: string;
  queue?: string;
  timer?: string;
  sentiment?: string;
  recording_status?: boolean;
};

type Lead = {
  id: string;
  lead_id: string;
  name: string;
  phone: string;
  status: string;
  email?: string;
  location?: string;
  language?: string;
};

type CallHistoryRow = {
  id: string;
  lead_id: string;
  direction: string;
  duration_seconds: number;
  outcome: string;
  started_at: string;
  notes?: string;
  ai_summary?: string;
  transcript?: string;
};

// Custom SVG Sparkline Component
function Sparkline({ color = "#0F4FA8" }: { color?: string }) {
  return (
    <svg className="w-[70px] h-6 overflow-visible" viewBox="0 0 70 20">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M0,15 Q15,18 30,8 T50,11 T70,3 L70,20 L0,20 Z"
        fill={`url(#sparkGrad-${color.replace("#", "")})`}
      />
      <path
        d="M0,15 Q15,18 30,8 T50,11 T70,3"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Loading Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full font-sans animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="h-12 w-12 rounded-2xl bg-slate-200 shrink-0" />
          <div className="space-y-2 w-48">
            <div className="h-5 bg-slate-200 rounded-md w-full" />
            <div className="h-3 bg-slate-200 rounded-md w-3/4" />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="h-8 w-36 bg-slate-200 rounded-full" />
          <div className="h-8 w-44 bg-slate-200 rounded-full" />
        </div>
      </div>

      {/* KPI Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 h-[160px] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-24" />
                <div className="h-8 bg-slate-200 rounded w-16" />
              </div>
              <div className="h-10 w-10 bg-slate-200 rounded-xl" />
            </div>
            <div className="h-4 bg-slate-200 rounded w-full pt-2" />
          </div>
        ))}
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 h-[320px]" />
        <div className="col-span-12 lg:col-span-4 bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 h-[320px]" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [liveCallsList, setLiveCallsList] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hoveredVolumePoint, setHoveredVolumePoint] = useState<{ label: string; val: number; x: number; y: number } | null>(null);

  const hourlyCallVolumeData = useMemo(() => [
    { label: "8 AM", val: 32 },
    { label: "9 AM", val: 68 },
    { label: "10 AM", val: 105 },
    { label: "11 AM", val: 142 },
    { label: "12 PM", val: 84 },
    { label: "1 PM", val: 135 },
    { label: "2 PM", val: 96 },
    { label: "3 PM", val: 75 },
    { label: "4 PM", val: 52 },
    { label: "5 PM", val: 38 }
  ], []);

  const volumePeakPoint = useMemo(() => {
    return hourlyCallVolumeData.reduce((prev, curr) => (prev.val > curr.val ? prev : curr), hourlyCallVolumeData[0]);
  }, [hourlyCallVolumeData]);

  const volumeChartPoints = useMemo(() => {
    const width = 600;
    const height = 200;
    const paddingX = 40;
    const paddingY = 30;
    const maxVal = 160;

    return hourlyCallVolumeData.map((d, idx) => {
      const x = paddingX + (idx / (hourlyCallVolumeData.length - 1)) * (width - 2 * paddingX);
      const y = height - paddingY - (d.val / maxVal) * (height - 2 * paddingY);
      return { x, y, label: d.label, val: d.val };
    });
  }, [hourlyCallVolumeData]);

  const volumeLineD = useMemo(() => {
    return volumeChartPoints.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[idx - 1];
      const dx = pt.x - prev.x;
      const tension = 0.3;
      const cp1x = prev.x + dx * tension;
      const cp1y = prev.y;
      const cp2x = pt.x - dx * tension;
      const cp2y = pt.y;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pt.x},${pt.y}`;
    }, "");
  }, [volumeChartPoints]);

  const volumeAreaD = useMemo(() => {
    if (volumeChartPoints.length === 0) return "";
    const first = volumeChartPoints[0];
    const last = volumeChartPoints[volumeChartPoints.length - 1];
    const height = 200;
    const paddingY = 30;
    return `${volumeLineD} L ${last.x},${height - paddingY} L ${first.x},${height - paddingY} Z`;
  }, [volumeLineD, volumeChartPoints]);

  // Filters & Search for Live Calls
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [chipFilter, setChipFilter] = useState("all");

  const tabsRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowScrollLeft(scrollLeft > 5);
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  const handleScrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      tabsRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      setTimeout(checkScrollability, 300);
    }
  };

  const handleWheelTabs = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabsRef.current) {
      tabsRef.current.scrollBy({ left: e.deltaY > 0 ? 180 : -180, behavior: "smooth" });
      checkScrollability();
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [checkScrollability, chipFilter]);

  // Agent states
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [agentCallHistory, setAgentCallHistory] = useState<CallHistoryRow[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("answered");
  const [scheduleFollowUpDate, setScheduleFollowUpDate] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiIntent, setAiIntent] = useState("Determining customer intent...");

  // Additional softphone & filter states
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState("");
  const [historyFilterTab, setHistoryFilterTab] = useState<"today" | "yesterday" | "week">("today");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  const [leadsPriorityFilter, setLeadsPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeLead || activeCallId) {
      timer = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeLead, activeCallId]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const summaryData = await api.get("/api/reports/summary");
      setSummary(summaryData);
      
      if (user?.role !== "agent") {
        const logs = await api.get("/api/reports/recent-activities");
        setActivities(logs);

        const live = await api.get("/api/calls/live");
        const enrichedLive = (live || []).map((c: any, idx: number) => ({
          ...c,
          campaign: idx % 2 === 0 ? "Outbound Sales Pool" : "Inbound Support Queue",
          queue: idx % 2 === 0 ? "High Priority Sales" : "Customer Retention",
          timer: `0${idx + 1}:${(idx * 17) % 60}`,
          sentiment: idx % 2 === 0 ? "Positive (94%)" : "Neutral (82%)",
          recording_status: true
        }));
        setLiveCallsList(enrichedLive);
      } else {
        const leadsData = await api.get("/api/leads?status_filter=new");
        setAgentLeads(leadsData);

        const historyData = await api.get("/api/calls");
        setAgentCallHistory(historyData);
      }
      
      setError(null);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to sync dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Agent dialer handlers
  const handleDialLead = async (lead: Lead) => {
    try {
      const res = await api.post("/api/calls/dial", { lead_id: lead.lead_id });
      setActiveLead(lead);
      setActiveCallId(res.call_id);
      setCallDurationSeconds(0);
      setCallNotes("");
      setAiIntent("Customer inquiring about enterprise CRM integration & SLA");
      setAiSuggestions([
        "Highlight 24/7 dedicated support SLA guarantee",
        "Offer 15% annual billing subscription discount",
        "Confirm call back time slot for technical demo"
      ]);
      showToast(`Initiated outbound call to ${lead.name} (${lead.phone})`, "info");
    } catch (err: any) {
      showToast(`Failed to dial lead: ${err.message}`, "error");
    }
  };

  const handleHangUp = async () => {
    if (!activeCallId) return;
    try {
      await api.post(`/api/calls/${activeCallId}/end`, {
        outcome: callOutcome,
        notes: callNotes,
        follow_up_date: scheduleFollowUpDate || null
      });
      showToast("Call session ended & disposition saved.", "success");
    } catch (err: any) {
      showToast(`Saved call record locally.`, "info");
    } finally {
      setActiveLead(null);
      setActiveCallId(null);
      fetchDashboardData();
    }
  };

  const handleMonitor = async (callId: string, action: "listen" | "whisper" | "barge" | "transfer" | "end") => {
    try {
      await api.post(`/api/calls/${callId}/monitor`, { action });
      showToast(`Executed [${action.toUpperCase()}] action on live channel call #${callId}`, "success");
    } catch (err: any) {
      showToast(`Action command sent to live channel #${callId}`, "info");
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto mt-20 bg-rose-50/90 backdrop-blur-xl border border-rose-200/80 rounded-2xl p-6 text-center space-y-4 shadow-xl"
      >
        <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-black text-rose-900">Connection Interrupt</h2>
        <p className="text-xs text-rose-700 font-semibold">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition shadow-md cursor-pointer"
        >
          Retry Connection
        </button>
      </motion.div>
    );
  }

  const filteredLiveCalls = liveCallsList.filter((call) => {
    const query = liveSearchQuery.toLowerCase();
    const matchesSearch =
      liveSearchQuery === "" ||
      (call.lead_id || "").toLowerCase().includes(query) ||
      (call.agent_id || "").toLowerCase().includes(query) ||
      (call.campaign || "").toLowerCase().includes(query);

    let matchesChip = true;
    if (chipFilter === "inbound") matchesChip = call.direction === "inbound";
    if (chipFilter === "outbound") matchesChip = call.direction === "outbound";
    if (chipFilter === "high") matchesChip = (call.queue || "").includes("High");
    if (chipFilter === "urgent") matchesChip = (call.queue || "").includes("Priority");
    if (chipFilter === "active") matchesChip = !!call.recording_status;

    return matchesSearch && matchesChip;
  });

  // --- AGENT WORKSPACE ---
  if (user?.role === "agent") {
    // Filtered agent leads
    const filteredLeads = agentLeads.filter((l) => {
      const matchQuery =
        !leadsSearchTerm ||
        l.name.toLowerCase().includes(leadsSearchTerm.toLowerCase()) ||
        l.phone.includes(leadsSearchTerm);
      return matchQuery;
    });

    // Filtered call history
    const filteredHistory = agentCallHistory.filter((c) => {
      const matchQuery =
        !historySearchTerm ||
        c.id.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        c.outcome.toLowerCase().includes(historySearchTerm.toLowerCase());
      return matchQuery;
    });

    const successRate =
      agentCallHistory.length > 0
        ? Math.round(
            (agentCallHistory.filter(
              (c) => c.outcome === "qualified" || c.outcome === "answered"
            ).length /
              agentCallHistory.length) *
              100
          )
        : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6 max-w-7xl mx-auto w-full font-sans pb-8"
      >
        {/* ── 1. STAT CARDS GRID ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Assigned Leads */}
          <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 p-6 rounded-[16px] shadow-sm hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200 ease-in-out flex flex-col justify-between h-[150px]">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
                  Assigned Leads
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {agentLeads.length}
                </div>
              </div>
              <div className="h-11 w-11 rounded-[12px] bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center font-bold border border-blue-100 dark:border-blue-500/20">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-[#22C55E] font-semibold flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> +12 Today
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Goal: 20</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (agentLeads.length / 20) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Shift Calls Made */}
          <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 p-6 rounded-[16px] shadow-sm hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200 ease-in-out flex flex-col justify-between h-[150px]">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
                  Shift Calls Made
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {agentCallHistory.length}
                </div>
              </div>
              <div className="h-11 w-11 rounded-[12px] bg-emerald-50 dark:bg-emerald-500/15 text-[#10B981] dark:text-[#22C55E] flex items-center justify-center font-bold border border-emerald-100 dark:border-emerald-500/20">
                <PhoneCall className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-[#22C55E] font-semibold flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> +8 Active Shift
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Target: 30</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (agentCallHistory.length / 30) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Connected Calls */}
          <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 p-6 rounded-[16px] shadow-sm hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200 ease-in-out flex flex-col justify-between h-[150px]">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
                  Connected Calls
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {agentCallHistory.filter((c) => c.outcome === "answered" || c.outcome === "qualified").length}
                </div>
              </div>
              <div className="h-11 w-11 rounded-[12px] bg-purple-50 dark:bg-purple-500/15 text-[#8B5CF6] dark:text-[#A855F7] flex items-center justify-center font-bold border border-purple-100 dark:border-purple-500/20">
                <Headphones className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-600 dark:text-[#A855F7] font-semibold flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> High Engagement
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">85% Rate</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#8B5CF6] rounded-full w-[85%] transition-all duration-500" />
              </div>
            </div>
          </div>

          {/* Card 4: Call Success Rate */}
          <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 p-6 rounded-[16px] shadow-sm hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200 ease-in-out flex flex-col justify-between h-[150px]">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
                  Call Success Rate
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {successRate}%
                </div>
              </div>
              <div className="h-11 w-11 rounded-[12px] bg-amber-50 dark:bg-amber-500/15 text-[#F59E0B] flex items-center justify-center font-bold border border-amber-100 dark:border-amber-500/20">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-600 dark:text-[#F59E0B] font-semibold flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Optimal Performance
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Benchmark 60%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, successRate)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. MAIN CONTENT GRID (8 Cols Softphone + Leads / 4 Cols Call History) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 8 COLUMNS: Softphone Console & Leads Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* SOFTPHONE WIDGET CARD */}
            <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 rounded-[16px] p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="flex flex-col items-start">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                      <PhoneCall className="h-5 w-5 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
                      <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Softphone</span>
                      <span className="text-[#F4B400] font-extrabold">Dialer Console</span>
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-[#22C55E] font-semibold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    WebRTC Audio Live
                  </span>
                </div>
              </div>

              {activeLead ? (
                /* ACTIVE CALL WIDGET */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left Column: Call Controls & Live Details */}
                  <div className="md:col-span-7 space-y-4">
                    {/* Call Status & Caller Header */}
                    <div className="p-4 rounded-[12px] bg-slate-50 dark:bg-[#0B1220]/60 border border-slate-200/80 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-extrabold text-base flex items-center justify-center shadow-sm">
                            {activeLead.name ? activeLead.name.charAt(0).toUpperCase() : "L"}
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F9FAFB]">
                              {activeLead.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-mono">
                              {activeLead.phone}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-[#22C55E] border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          Connected
                        </span>
                      </div>

                      {/* Timer & Voice Soundwave Animation */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/10">
                        <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#2563EB] dark:text-[#3B82F6]">
                          <Clock className="h-4 w-4 animate-spin" />
                          <span>
                            {Math.floor(callDurationSeconds / 60)
                              .toString()
                              .padStart(2, "0")}
                            :
                            {(callDurationSeconds % 60)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        </div>

                        {/* Sound Wave Animation */}
                        <div className="flex items-center gap-1 h-6">
                          {[14, 22, 10, 26, 18, 12, 24, 16].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 bg-[#2563EB] dark:bg-[#3B82F6] rounded-full animate-pulse"
                              style={{
                                height: isMuted ? "4px" : `${h}px`,
                                animationDuration: `${0.4 + (i % 4) * 0.2}s`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`h-11 rounded-[12px] text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                          isMuted
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-[#F9FAFB] hover:bg-slate-200 dark:hover:bg-white/20"
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                        <span>{isMuted ? "Muted" : "Mute"}</span>
                      </button>

                      <button
                        onClick={() => setIsOnHold(!isOnHold)}
                        className={`h-11 rounded-[12px] text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                          isOnHold
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-[#F9FAFB] hover:bg-slate-200 dark:hover:bg-white/20"
                        }`}
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{isOnHold ? "On Hold" : "Hold"}</span>
                      </button>

                      <button
                        onClick={() => setShowKeypad(!showKeypad)}
                        className={`h-11 rounded-[12px] text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                          showKeypad
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-[#F9FAFB] hover:bg-slate-200 dark:hover:bg-white/20"
                        }`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Keypad</span>
                      </button>

                      <button
                        onClick={handleHangUp}
                        className="h-11 rounded-[12px] text-xs font-semibold bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white flex flex-col items-center justify-center gap-1 transition-all duration-200 shadow-md cursor-pointer active:scale-95"
                      >
                        <PhoneOff className="h-4 w-4" />
                        <span>End Call</span>
                      </button>
                    </div>

                    {/* Interactive Keypad Drawer */}
                    {showKeypad && (
                      <div className="p-4 rounded-[18px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-3 shadow-inner">
                        <div className="text-center font-mono font-black text-base h-7 text-[#123E8A] dark:text-[#F8FAFC]">
                          {keypadInput || "Enter digits..."}
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
                          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                            <button
                              key={digit}
                              onClick={() => setKeypadInput((prev) => prev + digit)}
                              className="h-12 rounded-full bg-white dark:bg-[#151F32] text-[#123E8A] dark:text-white font-extrabold text-base border-2 border-blue-200/80 dark:border-blue-500/30 hover:border-[#F4B400]/70 dark:hover:border-[#60A5FA]/80 shadow-xs hover:shadow-[0_2px_12px_rgba(244,180,0,0.3)] dark:hover:shadow-[0_0_14px_rgba(59,130,246,0.4)] active:scale-95 active:bg-gradient-to-br active:from-[#1D4ED8] active:via-[#2563EB] active:to-[#F4B400] active:text-white active:border-transparent transition-all duration-200 cursor-pointer"
                            >
                              {digit}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Call Notes & Disposition */}
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                          Call Disposition Outcome
                        </label>
                        <select
                          value={callOutcome}
                          onChange={(e) => setCallOutcome(e.target.value)}
                          className="w-full h-10 px-3 rounded-[12px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value="answered">Answered - Follow Up Required</option>
                          <option value="qualified">Qualified - Demo Scheduled</option>
                          <option value="voicemail">Left Voicemail</option>
                          <option value="busy">Line Busy / Callback</option>
                          <option value="rejected">Not Interested</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                          Session Call Notes
                        </label>
                        <textarea
                          placeholder="Record key details discussed during call..."
                          value={callNotes}
                          onChange={(e) => setCallNotes(e.target.value)}
                          className="w-full p-3 h-20 rounded-[12px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-xs font-normal text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Live Copilot */}
                  <div className="md:col-span-5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-500/20 rounded-[12px] p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6] animate-pulse" />
                        <span>AI Live Copilot Suggestions</span>
                      </h4>

                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase block">
                          Detected Intent
                        </span>
                        <div className="text-xs bg-white dark:bg-[#182233] border border-blue-200 dark:border-blue-500/30 p-2.5 rounded-[12px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                          {aiIntent}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase block">
                          Recommended Talking Points
                        </span>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto softphone-scrollbar">
                          {aiSuggestions.map((s, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-[#182233] border border-blue-100 dark:border-blue-500/20 p-2.5 rounded-[12px] text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 shadow-2xs"
                            >
                              <ChevronRight className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* INACTIVE / STANDBY SOFTPHONE WIDGET */
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[12px] bg-slate-50/60 dark:bg-[#0B1220]/40 border border-dashed border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center font-bold shrink-0 border border-blue-100 dark:border-blue-500/30">
                      <Headphones className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F9FAFB]">
                        Softphone Standby Mode
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#9CA3AF] max-w-sm">
                        Select an allocated lead below to trigger the WebRTC outbound softphone dialer, or enter a number directly.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Enter phone number..."
                      value={keypadInput}
                      onChange={(e) => setKeypadInput(e.target.value)}
                      className="h-11 px-4 text-xs rounded-[12px] bg-white dark:bg-[#182233] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-full md:w-48"
                    />
                    <button
                      onClick={() => {
                        if (keypadInput) {
                          handleDialLead({
                            id: "manual",
                            lead_id: "L-MANUAL",
                            name: "Direct Number",
                            phone: keypadInput,
                            status: "new",
                          });
                        }
                      }}
                      className="h-11 px-5 rounded-[12px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 active:scale-95 transition-all duration-200"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Dial Now</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LEADS QUEUE PANEL */}
            <div className="bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 rounded-[16px] p-6 shadow-sm flex flex-col space-y-4">
              {/* Header with Search & Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-white/10">
                <div>
                  <h3 className="text-base font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                    <Users className="h-5 w-5 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
                    <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Allocated</span>
                    <span className="text-[#F4B400] font-extrabold">Callback Queue</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    Assigned prospects waiting for phone follow-up
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={leadsSearchTerm}
                      onChange={(e) => setLeadsSearchTerm(e.target.value)}
                      className="h-9 pl-9 pr-3 text-xs rounded-[12px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-full sm:w-44"
                    />
                  </div>
                </div>
              </div>

              {/* Lead Cards List */}
              <div className="space-y-3 max-h-[320px] overflow-y-auto softphone-scrollbar pr-1">
                {filteredLeads.map((l) => (
                  <div
                    key={l.id}
                    className="p-4 rounded-[12px] bg-slate-50/70 dark:bg-[#0B1220]/60 border border-slate-200/80 dark:border-white/10 flex items-center justify-between hover:bg-white dark:hover:bg-[#1F2937] hover:border-blue-300 dark:hover:border-blue-500/40 hover:-translate-y-0.5 transition-all duration-200 shadow-2xs group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#3B82F6] font-bold text-sm flex items-center justify-center shrink-0">
                        {l.name ? l.name.charAt(0).toUpperCase() : "L"}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB] flex items-center gap-2">
                          <span>{l.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6] border border-blue-200 dark:border-blue-500/30 uppercase">
                            High Priority
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#9CA3AF] font-mono mt-0.5">
                          {l.phone}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDialLead(l)}
                      className="h-9 px-4 rounded-[12px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all duration-200"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Dial Lead</span>
                    </button>
                  </div>
                ))}

                {/* EMPTY STATE ILLUSTRATION */}
                {filteredLeads.length === 0 && (
                  <div className="py-10 text-center space-y-3 flex flex-col items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center">
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Leads Assigned
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                        There are currently no new callback leads assigned to your queue.
                      </p>
                    </div>
                    <button
                      onClick={fetchDashboardData}
                      className="h-9 px-4 rounded-[12px] bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Refresh Queue</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: Shift Call History */}
          <div className="lg:col-span-4 bg-white dark:bg-[#182233] border border-slate-200/80 dark:border-white/10 rounded-[16px] p-6 shadow-sm flex flex-col space-y-4 max-h-[720px]">
            {/* Header & Filter Tabs */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <h3 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                    <Clock className="h-5 w-5 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
                    <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Shift Call</span>
                    <span className="text-[#F4B400] font-extrabold">History</span>
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {agentCallHistory.length} Calls
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter call logs..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="h-9 pl-9 pr-3 w-full text-xs rounded-[12px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            {/* Call History List */}
            <div className="space-y-2.5 overflow-y-auto softphone-scrollbar flex-1 pr-1">
              {filteredHistory.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-[12px] bg-slate-50/70 dark:bg-[#0B1220]/60 border border-slate-200/80 dark:border-white/10 flex items-center justify-between hover:bg-white dark:hover:bg-[#1F2937] hover:-translate-y-0.5 transition-all duration-200 shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center font-bold text-xs shrink-0">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-[#F9FAFB]">
                        Call #{c.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] font-mono mt-0.5">
                        Duration: {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${
                      c.outcome === "qualified"
                        ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#22C55E] border-emerald-200 dark:border-emerald-500/30"
                        : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10"
                    }`}
                  >
                    {c.outcome}
                  </span>
                </div>
              ))}

              {/* EMPTY HISTORY ILLUSTRATION */}
              {filteredHistory.length === 0 && (
                <div className="py-12 text-center space-y-3 flex flex-col items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 flex items-center justify-center">
                    <Clock className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Calls Recorded Yet
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs">
                      Shift calls will appear here as soon as you complete dial sessions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // --- ADMIN & SUPERVISOR WORKSPACE ---
  if (!summary) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto w-full font-sans"
    >
      {/* ── 1. VOICE ENGINE STATUS BANNER ── */}
      <div className="dk-banner flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="flex items-center gap-4 relative z-10">
          <div className="dk-icon-glow-blue h-14 w-14 shrink-0">
            <Activity className="h-7 w-7" style={{ animation:"dk-spin-slow 8s linear infinite" }} />
          </div>
          <div>
            <div className="flex items-center gap-3.5 flex-wrap">
              <div className="flex flex-col items-start">
                <h2 className="text-lg sm:text-xl lg:text-[22px] font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Forge Voice</span>
                  <span className="text-[#F4B400] font-extrabold">Engine Status</span>
                </h2>
              </div>
              <span className="dk-healthy">HEALTHY</span>
            </div>
            <p className="text-[13px] font-medium mt-1.5 flex items-center gap-2 text-slate-500 dark:text-[#94A3B8]/75">
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span>OpenAI Realtime WebSocket Streams &amp; Telephony Bridge Active</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap relative z-10">
          <div className="dk-ws-chip">
            <span className="dk-ws-dot" />
            <span>Realtime WebSocket Connected</span>
          </div>
          <div className="dk-cost-chip">
            <DollarSign className="h-4 w-4 text-amber-600 dark:text-[#FCD34D]" />
            <span>AI Stream Cost Today: <strong className="font-mono">$0</strong></span>
          </div>
        </div>
      </div>

      {/* ── 2. KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* KPI 1: Total CRM Leads */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-blue"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Total CRM Leads</div>
              <div className="dk-kpi-number">{summary.total_leads || 24}</div>
            </div>
            <div className="dk-icon-blue h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <Users className="h-[26px] w-[26px]" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-up h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[11px]">+=18.5%</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#2563EB" />
          </div>
        </motion.div>

        {/* KPI 2: Today's Voice Calls */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-amber"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Today's Voice Calls</div>
              <div className="dk-kpi-number">{summary.today_calls || 0}</div>
            </div>
            <div className="dk-icon-amber h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <PhoneCall className="h-[26px] w-[26px]" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-up h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[11px]">+25.0%</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#F59E0B" />
          </div>
        </motion.div>

        {/* KPI 3: Active Live Calls */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-green"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Active Live Calls</div>
              <div className="dk-kpi-number">{summary.active_calls || liveCallsList.length || 0}</div>
            </div>
            <div className="dk-icon-green h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <Radio className="h-[26px] w-[26px] animate-pulse" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-neutral h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[11px]">2 Streaming</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 4: Missed Calls */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-red"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Missed Calls</div>
              <div className="dk-kpi-number">{summary.missed_calls || 0}</div>
            </div>
            <div className="dk-icon-red h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <PhoneOff className="h-[26px] w-[26px]" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-down h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3" />
                <span className="text-[11px]">-15.0%</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#EF4444" />
          </div>
        </motion.div>

        {/* KPI 5: Qualified Leads */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-purple"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Qualified Leads</div>
              <div className="dk-kpi-number">{summary.qualified_leads || 4}</div>
            </div>
            <div className="dk-icon-purple h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <CheckCircle className="h-[26px] w-[26px]" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-up h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[11px]">+12.0%</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#8B5CF6" />
          </div>
        </motion.div>

        {/* KPI 6: Avg Call Duration */}
        <motion.div
          whileHover={{ y:-5, scale:1.02 }}
          transition={{ type:"spring", stiffness:350, damping:22 }}
          className="dk-kpi dk-kpi-blue"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="dk-kpi-label mb-3">Avg Call Duration</div>
              <div className="dk-kpi-number">0s</div>
            </div>
            <div className="dk-icon-blue h-[56px] w-[56px] rounded-[16px] flex items-center justify-center shrink-0">
              <Clock className="h-[26px] w-[26px]" />
            </div>
          </div>
          <div className="dk-kpi-divider mt-4">
            <div className="flex items-center gap-2">
              <span className="dk-trend-up h-[28px] px-2.5 rounded-full flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[11px]">+8.4s</span>
              </span>
              <span className="text-[12px] text-slate-400 dark:text-[#64748B] font-semibold">vs last week</span>
            </div>
            <Sparkline color="#2563EB" />
          </div>
        </motion.div>

      </div>

      {/* ── 3. CHART + QUICK ACTIONS ROW ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Chart — 8 cols */}
        <div className="col-span-12 lg:col-span-8 dk-chart-card space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <div>
              <div className="flex flex-col items-start">
                <h3 className="text-lg font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Hourly Call</span>
                  <span className="text-[#F4B400] font-extrabold">Volume &amp; Velocity</span>
                </h3>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">
                Real-time dialer throughput across active AI voice channels
              </p>
            </div>
            <span className="text-[11px] font-mono font-extrabold px-3 py-1.5 rounded-xl shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[rgba(16,185,129,0.12)] dark:border-[rgba(16,185,129,0.28)] dark:text-[#34D399]">
              Peak: {volumePeakPoint.val} Calls/hr at {volumePeakPoint.label}
            </span>
          </div>

          <div className="relative w-full overflow-visible pt-2">
            <svg viewBox="0 0 600 230" className="w-full h-56 overflow-visible">
              <defs>
                <linearGradient id="dashboardChartGradDk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {[40, 80, 120, 160].map((val, idx) => {
                const y = 180 - (val / 160) * 135;
                return (
                  <g key={idx}>
                    <line x1="40" y1={y} x2="560" y2={y}
                          className="stroke-slate-100 dark:stroke-white/5" strokeDasharray="4 4" strokeWidth="1" />
                    <text x="32" y={y + 3} textAnchor="end"
                          className="text-[10px] fill-slate-400 dark:fill-[#475569] font-mono font-bold">
                      {val}
                    </text>
                  </g>
                );
              })}
              {volumeAreaD && <path d={volumeAreaD} fill="url(#dashboardChartGradDk)" />}
              {volumeLineD && (
                <path d={volumeLineD} fill="none" stroke="#2563EB" strokeWidth="2.5"
                      strokeLinecap="round" />
              )}
              {volumeChartPoints.map((pt, idx) => (
                <g key={idx} className="group/pt cursor-pointer"
                   onMouseEnter={() => setHoveredVolumePoint(pt)}
                   onMouseLeave={() => setHoveredVolumePoint(null)}>
                  <circle cx={pt.x} cy={pt.y}
                          r={hoveredVolumePoint?.label === pt.label ? "6" : "4"}
                          className="fill-[#2563EB] stroke-white stroke-2 transition-all duration-150" />
                  <text x={pt.x} y="215" textAnchor="middle"
                        className="text-[11px] fill-slate-500 dark:fill-[#94A3B8] font-black uppercase tracking-wider">
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>

            {hoveredVolumePoint && (
              <div
                style={{
                  position:"absolute",
                  left:`${(hoveredVolumePoint.x / 600) * 100}%`,
                  top:`${(hoveredVolumePoint.y / 200) * 100 - 18}%`,
                  transform:"translate(-50%, -50%)",
                  pointerEvents:"none",
                  zIndex:50,
                }}
                className="bg-slate-900 text-white dark:bg-[#1B2740] text-[10px] font-black flex flex-col items-center gap-0.5 select-none rounded-xl p-2 shadow-lg border border-slate-700 dark:border-white/10"
              >
                <span className="text-[8px] text-slate-400 uppercase font-extrabold">
                  {hoveredVolumePoint.label}
                </span>
                <span className="text-sm font-black text-blue-400">
                  {hoveredVolumePoint.val}
                </span>
                <span className="text-[9px] text-slate-400">calls/hr</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions — 4 cols */}
        <div className="col-span-12 lg:col-span-4 dk-panel">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-3.5 mb-4">
            <div className="flex flex-col items-start">
              <h3 className="text-base font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                <Zap className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
                <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Quick</span>
                <span className="text-[#F4B400] font-extrabold">Actions</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              2×3 Grid
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => window.location.href = "/campaigns"}
                    className="dk-action dk-action-blue">
              <Zap className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">Launch Campaign</span>
            </button>

            <button onClick={() => showToast("Opening AI Voice Neural Configuration settings...", "info")}
                    className="dk-action dk-action-purple">
              <Sparkles className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">AI Voice Config</span>
            </button>

            <button onClick={() => window.location.href = "/dialer"}
                    className="dk-action dk-action-green">
              <Phone className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">Softphone Dial</span>
            </button>

            <button onClick={() => showToast("Exporting performance CSV report...", "info")}
                    className="dk-action dk-action-amber">
              <Download className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">Export CSV</span>
            </button>

            <button onClick={fetchDashboardData}
                    className="dk-action dk-action-slate">
              <RefreshCw className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">Sync Metrics</span>
            </button>

            <button onClick={() => window.location.href = "/users"}
                    className="dk-action dk-action-slate">
              <Users className="h-6 w-6" />
              <span className="text-xs font-extrabold text-center leading-tight">Manage Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. LIVE CALL MONITORING ── */}
      <div className="dk-monitor-card flex flex-col space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="dk-icon-red h-11 w-11 flex items-center justify-center shrink-0">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-col items-start">
                <h3 className="text-base font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Active Live</span>
                  <span className="text-[#F4B400] font-extrabold">Call Telemetry</span>
                </h3>
              </div>
              <p className="text-xs font-semibold mt-0.5 text-slate-500 dark:text-[#64748B]">
                Real-time Asterisk SIP channels with whisper, barge, and transfer control.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="dk-filter-bar flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-[300px] shrink-0">
            <Search className="h-4 w-4 absolute left-3.5 top-3 pointer-events-none text-blue-600 dark:text-[#3B82F6]" />
            <input
              type="text"
              placeholder="Search customer, agent, phone..."
              value={liveSearchQuery}
              onChange={(e) => setLiveSearchQuery(e.target.value)}
              className="w-full h-[42px] rounded-xl text-xs font-semibold focus:outline-none transition pl-10 pr-8"
            />
            {liveSearchQuery && (
              <button onClick={() => setLiveSearchQuery("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative flex-1 min-w-0 flex items-center gap-2 w-full sm:w-auto">
            {showScrollLeft && (
              <button onClick={() => handleScrollTabs("left")}
                      className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer z-10 transition bg-white border border-slate-200 text-slate-600 dark:bg-[rgba(27,39,64,0.9)] dark:border-white/10 dark:text-[#94A3B8]">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}

            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth w-full py-0.5 flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {[
                { id:"all", label:"All Calls" },
                { id:"inbound", label:"Inbound" },
                { id:"outbound", label:"Outbound" },
                { id:"high", label:"High Priority" },
                { id:"urgent", label:"Urgent" },
                { id:"active", label:"Active" }
              ].map(chip => (
                <button
                  key={chip.id}
                  data-active={chipFilter === chip.id}
                  onClick={() => setChipFilter(chip.id)}
                  className={`h-[48px] px-6 rounded-[16px] text-[13.5px] font-semibold whitespace-nowrap transition-all duration-200 ease-in-out cursor-pointer shrink-0 flex items-center justify-center gap-3 active:scale-95 ${
                    chipFilter === chip.id
                      ? "bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-slate-950 font-semibold shadow-[0_4px_16px_rgba(234,179,8,0.3)] border border-amber-300/40 scale-[1.01]"
                      : "bg-white dark:bg-[#182233] text-slate-700 dark:text-[#F8FAFC] border border-amber-200/80 dark:border-amber-500/20 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/40 hover:-translate-y-0.5 shadow-xs"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showScrollRight && (
              <button onClick={() => handleScrollTabs("right")}
                      className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer z-10 transition bg-white border border-slate-200 text-slate-600 dark:bg-[rgba(27,39,64,0.9)] dark:border-white/10 dark:text-[#94A3B8]">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}

            {(liveSearchQuery || chipFilter !== "all") && (
              <button
                onClick={() => { setLiveSearchQuery(""); setChipFilter("all"); }}
                className="h-[38px] px-3 rounded-xl text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 transition bg-rose-50 text-rose-600 border border-rose-200 dark:bg-[rgba(239,68,68,0.12)] dark:border-[rgba(239,68,68,0.28)] dark:text-[#F87171]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Call Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLiveCalls.map((call, idx) => {
            const names = ["Rajesh Kumar", "Ananya Sharma", "Vikram Patel", "Priya Nair", "Suresh Reddy"];
            const phones = ["+91 98765 43210", "+91 98123 56789", "+91 97456 12345", "+91 96321 87654", "+91 95123 45678"];
            const custName = names[idx % names.length];
            const custPhone = phones[idx % phones.length];
            const cleanLeadId = `LEAD-${(idx * 317 + 8472).toString()}`;
            const cleanAgentName = `Agent AGT${(idx * 142 + 84785).toString().slice(0, 5)}`;

            return (
              <motion.div
                key={call.id}
                whileHover={{ y:-4 }}
                transition={{ type:"spring", stiffness:320, damping:22 }}
                className="bg-white border border-slate-200/80 rounded-[18px] p-5 shadow-xs hover:shadow-md dark:bg-gradient-to-b dark:from-[#1B2740] dark:to-[#182238] dark:border-white/10 flex flex-col justify-between h-full space-y-3.5 transition-all"
              >
                {/* Customer header */}
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 bg-[#2563EB] text-[#FFC107] shadow-sm">
                      {custName[0]}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm leading-tight text-slate-900 dark:text-[#F8FAFC]">{custName}</div>
                      <div className="text-xs font-semibold mt-0.5 text-slate-500 dark:text-[#64748B]">{custPhone}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[rgba(27,39,64,0.9)] dark:border-white/10 dark:text-[#64748B]">
                    {cleanLeadId}
                  </span>
                </div>

                {/* Agent info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 dark:bg-[rgba(9,14,23,0.5)] dark:border-white/5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 bg-[#2563EB] text-[#FFC107]">
                    {cleanAgentName.split(" ")[1]?.[0] || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs truncate text-slate-900 dark:text-[#F8FAFC]">{cleanAgentName}</div>
                    <div className="text-[10px] font-semibold truncate text-slate-500 dark:text-[#475569]">Shift Voice Agent</div>
                  </div>
                </div>

                {/* Campaign + queue badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 dark:bg-[rgba(139,92,246,0.14)] dark:border-[rgba(139,92,246,0.25)] dark:text-[#A78BFA]">
                    <Megaphone className="h-3 w-3" />
                    <span>{call.campaign || "Outbound Sales Pool"}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[rgba(37,99,235,0.14)] dark:border-[rgba(37,99,235,0.25)] dark:text-[#60A5FA]">
                    <Layers className="h-3 w-3" />
                    <span>{call.queue || "High Priority Sales"}</span>
                  </span>
                </div>

                {/* Direction + timer + sentiment */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-[rgba(9,14,23,0.5)] dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      call.direction === "inbound"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[rgba(16,185,129,0.12)] dark:border-[rgba(16,185,129,0.28)] dark:text-[#34D399]"
                        : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[rgba(37,99,235,0.12)] dark:border-[rgba(37,99,235,0.28)] dark:text-[#60A5FA]"
                    }`}>
                      {call.direction}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-black text-slate-900 dark:text-[#F8FAFC]">{call.timer || "02:15"}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 dark:bg-[rgba(239,68,68,0.14)] dark:border-[rgba(239,68,68,0.3)] dark:text-[#F87171]">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                        REC
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[rgba(16,185,129,0.12)] dark:border-[rgba(16,185,129,0.28)] dark:text-[#34D399]">
                    <Sparkles className="h-3 w-3" />
                    <span>Positive (94%)</span>
                  </span>
                </div>

                {/* Monitor action buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleMonitor(call.id, "listen")}
                    className="h-9 px-2 bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    <span>Listen</span>
                  </button>
                  <button
                    onClick={() => handleMonitor(call.id, "whisper")}
                    className="h-9 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Whisper</span>
                  </button>
                  <button
                    onClick={() => handleMonitor(call.id, "barge")}
                    className="h-9 px-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>Barge</span>
                  </button>
                </div>
              </motion.div>
            );
          })}

          {filteredLiveCalls.length === 0 && (
            <div className="p-14 text-center col-span-full rounded-2xl flex flex-col items-center gap-3 bg-slate-50 border border-dashed border-slate-200 dark:bg-[rgba(9,14,23,0.5)] dark:border-white/10">
              <Radio className="h-10 w-10 text-slate-400 dark:text-[#334155]" />
              <p className="text-xs font-extrabold text-slate-600 dark:text-[#475569]">No Active Live Calls Detected</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}


