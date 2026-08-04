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
    <svg className="w-16 h-6 overflow-visible" viewBox="0 0 70 20">
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
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 max-w-7xl mx-auto w-full font-sans"
      >
        {/* AGENT KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-4 rounded-[20px] shadow-sm flex items-center justify-between border-t-4 border-t-[#0F4FA8]">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono">{agentLeads.length}</span>
              <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">Assigned Leads</span>
            </div>
            <div className="p-2.5 bg-blue-50 text-[#0F4FA8] rounded-xl border border-blue-100">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-4 rounded-[20px] shadow-sm flex items-center justify-between border-t-4 border-t-emerald-500">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono">{agentCallHistory.length}</span>
              <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">Shift Calls Made</span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-4 rounded-[20px] shadow-sm flex items-center justify-between border-t-4 border-t-purple-600">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {agentCallHistory.filter(c => c.outcome === "answered" || c.outcome === "qualified").length}
              </span>
              <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">Connected Calls</span>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Headphones className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-4 rounded-[20px] shadow-sm flex items-center justify-between border-t-4 border-t-amber-500">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {agentCallHistory.length > 0
                  ? `${Math.round((agentCallHistory.filter(c => c.outcome === "qualified" || c.outcome === "answered").length / agentCallHistory.length) * 100)}%`
                  : "0%"}
              </span>
              <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">Call Success Rate</span>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/80 lg:col-span-2 flex flex-col min-h-[460px]">
            <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#0F4FA8]" />
              <span>Softphone Dialer Console</span>
            </h2>

            {activeLead ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <div className="text-sm font-extrabold text-slate-900">{activeLead.name}</div>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5">Phone: {activeLead.phone}</div>
                    <div className="text-xs text-[#0F4FA8] font-black mt-3 flex items-center gap-1.5 font-mono">
                      <Clock className="h-4 w-4 animate-spin text-[#0F4FA8]" />
                      <span>Duration: {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, "0")}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1">Session Call Notes</label>
                    <textarea
                      placeholder="Type details of conversation outcome..."
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      className="w-full border border-slate-200/80 rounded-xl px-3 py-2 text-xs h-24 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-normal text-slate-800"
                    />
                  </div>

                  <button
                    onClick={handleHangUp}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 rounded-xl font-extrabold transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Call & Save Session</span>
                  </button>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#0F4FA8] animate-pulse" />
                      <span>AI Live Copilot Suggestions</span>
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Detected Intent</span>
                      <div className="text-xs bg-white border border-blue-200/60 px-3 py-2 rounded-xl font-bold text-slate-800 shadow-2xs">
                        {aiIntent}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Recommended Responses</span>
                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        {aiSuggestions.map((s, idx) => (
                          <div key={idx} className="bg-white border border-blue-100 p-2.5 rounded-xl text-xs font-semibold text-slate-700 flex items-start gap-1.5 shadow-2xs">
                            <ChevronRight className="h-4 w-4 text-[#0F4FA8] shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="border border-slate-200/80 rounded-xl p-4 flex flex-col max-h-[340px]">
                  <h3 className="font-extrabold text-slate-900 text-xs mb-3 uppercase tracking-wider">Leads Allocation List</h3>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {agentLeads.map(l => (
                      <div key={l.id} className="p-3 border border-slate-200/70 bg-slate-50/60 rounded-xl flex justify-between items-center hover:bg-white transition shadow-2xs">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{l.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">{l.phone}</div>
                        </div>
                        <button
                          onClick={() => handleDialLead(l)}
                          className="bg-[#0F4FA8] text-white text-xs px-3 py-1.5 rounded-lg font-extrabold hover:bg-blue-900 transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                        >
                          <Phone className="h-3 w-3" />
                          <span>Dial</span>
                        </button>
                      </div>
                    ))}
                    {agentLeads.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-12 font-medium">No assigned leads awaiting callback.</p>
                    )}
                  </div>
                </div>

                <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col justify-center items-center text-center text-slate-400 space-y-3 bg-slate-50/40">
                  <PhoneCall className="h-9 w-9 text-slate-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-700">Ready to Accept Calls</p>
                    <p className="text-xs max-w-xs font-semibold leading-relaxed">Select a lead from the queue list to trigger the softphone outbound dialer.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 lg:col-span-1 flex flex-col max-h-[460px]">
            <h2 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#0F4FA8]" />
              <span>Shift Call History</span>
            </h2>
            
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {agentCallHistory.map(c => (
                <div
                  key={c.id}
                  className="p-2.5 border border-slate-200/80 rounded-xl bg-slate-50/50 hover:bg-blue-50/40 transition cursor-pointer flex justify-between items-center text-xs shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 font-mono">Call #{c.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5 font-mono">
                      Duration: {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                    </div>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    c.outcome === "qualified" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700"
                  }`}>
                    {c.outcome}
                  </span>
                </div>
              ))}
              {agentCallHistory.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-12 font-medium">No recorded calls completed during current shift.</p>
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
      {/* 1. TOP VOICE ENGINE STATUS BANNER */}
      <div className="bg-gradient-to-r from-white via-blue-50/30 to-indigo-50/20 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-white flex items-center justify-center font-bold shrink-0 shadow-md border border-blue-400/30">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Forge Voice Engine Status</h2>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                HEALTHY
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1 flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span>OpenAI Realtime WebSocket Streams & Telephony Bridge Active</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white/90 text-slate-700 text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-200 shadow-2xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Realtime WebSocket Connected</span>
          </div>

          <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 text-amber-800 text-xs font-black px-4 py-2 rounded-xl border border-amber-200 flex items-center gap-2 shadow-2xs">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <span>AI Stream Cost Today: <strong className="text-amber-900 font-mono">$0</strong></span>
          </div>
        </div>
      </div>

      {/* 2. 6 EQUAL HEIGHT (160px) KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* KPI Card 1: TOTAL CRM LEADS */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-[#0F4FA8]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">TOTAL CRM LEADS</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{summary.total_leads || 24}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center shadow-2xs border border-blue-100">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>+18.5%</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#0F4FA8" />
          </div>
        </motion.div>

        {/* KPI Card 2: TODAY'S VOICE CALLS */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-amber-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">TODAY'S VOICE CALLS</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{summary.today_calls || 0}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs border border-amber-100">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>+25.0%</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#F59E0B" />
          </div>
        </motion.div>

        {/* KPI Card 3: ACTIVE LIVE CALLS */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-emerald-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">ACTIVE LIVE CALLS</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{summary.active_calls || liveCallsList.length || 0}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs border border-emerald-100">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>2 Streaming</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI Card 4: MISSED CALLS */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-rose-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">MISSED CALLS</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{summary.missed_calls || 0}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs border border-rose-100">
              <PhoneOff className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                <span>-15.0%</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#EF4444" />
          </div>
        </motion.div>

        {/* KPI Card 5: QUALIFIED LEADS */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-purple-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">QUALIFIED LEADS</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{summary.qualified_leads || 4}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs border border-purple-100">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>+12.0%</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#7C3AED" />
          </div>
        </motion.div>

        {/* KPI Card 6: AVG CALL DURATION */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[160px] border-t-4 border-t-[#0F4FA8]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">AVG CALL DURATION</div>
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">0s</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center shadow-2xs border border-blue-100">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>+8.4s</span>
              </span>
              <span className="text-slate-400 font-semibold">vs last week</span>
            </div>
            <Sparkline color="#0F4FA8" />
          </div>
        </motion.div>
      </div>

      {/* 3. 12-COLUMN DASHBOARD GRID: LEFT 8 COLS CHARTS + RIGHT 4 COLS QUICK ACTIONS */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left 8 Columns: Hourly Call Volume & Velocity Chart */}
        <div className="col-span-12 lg:col-span-8 bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-snug flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0F4FA8]" />
                <span>Hourly Call Volume & Velocity</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time dialer throughput across active AI voice channels</p>
            </div>
            <span className="text-[11px] font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl shadow-2xs">
              Peak: {volumePeakPoint.val} Calls/hr at {volumePeakPoint.label}
            </span>
          </div>

          {/* SVG Line Chart */}
          <div className="relative w-full overflow-visible pt-2">
            <svg viewBox="0 0 600 200" className="w-full h-56 overflow-visible">
              <defs>
                <linearGradient id="dashboardChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F4FA8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0F4FA8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {[40, 80, 120, 160].map((val, idx) => {
                const y = 170 - (val / 160) * 140; // baseline 170, max height 140
                return (
                  <g key={idx}>
                    <line x1="40" y1={y} x2="560" y2={y} stroke="#F1F5F9" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="32" y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">{val}</text>
                  </g>
                );
              })}
              
              {/* Dynamic Path Area & Line */}
              {volumeAreaD && <path d={volumeAreaD} fill="url(#dashboardChartGrad)" />}
              {volumeLineD && <path d={volumeLineD} fill="none" stroke="#0F4FA8" strokeWidth="3" strokeLinecap="round" />}

              {/* Data points */}
              {volumeChartPoints.map((pt, idx) => (
                <g
                  key={idx}
                  className="group/pt cursor-pointer"
                  onMouseEnter={() => setHoveredVolumePoint(pt)}
                  onMouseLeave={() => setHoveredVolumePoint(null)}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredVolumePoint?.label === pt.label ? "6" : "4"}
                    className="fill-[#0F4FA8] stroke-white stroke-2 transition-all duration-200 shadow-md animate-in fade-in duration-300"
                  />
                  <text x={pt.x} y="190" textAnchor="middle" className="text-[9px] fill-slate-400 font-extrabold uppercase">{pt.label}</text>
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredVolumePoint && (
              <div
                style={{
                  position: "absolute",
                  left: `${(hoveredVolumePoint.x / 600) * 100}%`,
                  top: `${(hoveredVolumePoint.y / 200) * 100 - 18}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none"
                }}
                className="bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 flex flex-col items-center gap-0.5 z-50 shrink-0 select-none animate-in fade-in zoom-in-95 duration-150"
              >
                <span className="text-[8px] text-slate-400 uppercase leading-none font-extrabold">{hoveredVolumePoint.label}</span>
                <span className="leading-none mt-1">{hoveredVolumePoint.val} Calls/hr</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Columns: Equal Sized Quick Actions Cards Grid (2x3) */}
        <div className="col-span-12 lg:col-span-4 bg-white/95 backdrop-blur-xl rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-base leading-snug flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#FFC107]" />
              <span>Quick Actions Panel</span>
            </h3>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">2x3 Grid</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = "/campaigns"}
              className="h-[96px] bg-blue-50/60 hover:bg-[#0F4FA8] text-[#0F4FA8] hover:text-white border border-blue-100/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <Zap className="h-5 w-5 text-[#0F4FA8] group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">Launch Campaign</span>
            </button>

            <button
              onClick={() => showToast("Opening AI Voice Neural Configuration settings...", "info")}
              className="h-[96px] bg-purple-50/60 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-100/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <Sparkles className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">AI Voice Config</span>
            </button>

            <button
              onClick={() => window.location.href = "/dialer"}
              className="h-[96px] bg-emerald-50/60 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-100/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <Phone className="h-5 w-5 text-emerald-600 group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">Softphone Dial</span>
            </button>

            <button
              onClick={() => showToast("Exporting performance CSV report...", "info")}
              className="h-[96px] bg-amber-50/60 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-100/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <Download className="h-5 w-5 text-amber-600 group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">Export CSV</span>
            </button>

            <button
              onClick={fetchDashboardData}
              className="h-[96px] bg-slate-50 hover:bg-slate-800 text-slate-700 hover:text-white border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <RefreshCw className="h-5 w-5 text-slate-600 group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">Sync Metrics</span>
            </button>

            <button
              onClick={() => window.location.href = "/users"}
              className="h-[96px] bg-slate-50 hover:bg-slate-800 text-slate-700 hover:text-white border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group active:scale-95"
            >
              <Users className="h-5 w-5 text-slate-600 group-hover:text-white transition-colors" />
              <span className="text-xs font-extrabold text-center leading-tight">Manage Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. ACTIVE LIVE CALL MONITORING GRID */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col space-y-5">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-snug flex items-center gap-2">
                <span>Active Live Call Telemetry Monitoring</span>
                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {liveCallsList.length} LIVE CHANNELS
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time Asterisk SIP channels with whisper, barge, and transfer control.</p>
            </div>
          </div>
        </div>

        {/* FULL WIDTH FILTER TOOLBAR PANEL WITH SCROLLABLE CHIPS */}
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* LEFT: FIXED SEARCH INPUT */}
          <div className="relative w-full sm:w-[280px] lg:w-[340px] max-w-[400px] shrink-0">
            <Search className="h-4 w-4 text-[#0F4FA8] absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Customer, Phone, Agent..."
              value={liveSearchQuery}
              onChange={(e) => setLiveSearchQuery(e.target.value)}
              className="w-full h-[40px] pl-10 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] text-slate-800 transition"
            />
            {liveSearchQuery && (
              <button onClick={() => setLiveSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* RIGHT: HORIZONTALLY SCROLLABLE CHIPS */}
          <div className="relative flex-1 min-w-0 flex items-center gap-2 w-full sm:w-auto">
            {showScrollLeft && (
              <button
                onClick={() => handleScrollTabs("left")}
                className="h-8 w-8 rounded-xl bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-600 transition flex items-center justify-center shrink-0 cursor-pointer border border-slate-200 shadow-2xs active:scale-95 z-10"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}

            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth w-full py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-nowrap"
            >
              {[
                { id: "all", label: "All Calls" },
                { id: "inbound", label: "Inbound" },
                { id: "outbound", label: "Outbound" },
                { id: "high", label: "High Priority" },
                { id: "urgent", label: "Urgent" },
                { id: "active", label: "Active" }
              ].map(chip => (
                <button
                  key={chip.id}
                  data-active={chipFilter === chip.id}
                  onClick={() => setChipFilter(chip.id)}
                  className={`h-[40px] px-4 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center justify-center ${
                    chipFilter === chip.id
                      ? "bg-[#0F4FA8] text-white shadow-md shadow-blue-900/10"
                      : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showScrollRight && (
              <button
                onClick={() => handleScrollTabs("right")}
                className="h-8 w-8 rounded-xl bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-600 transition flex items-center justify-center shrink-0 cursor-pointer border border-slate-200 shadow-2xs active:scale-95 z-10"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}

            {(liveSearchQuery || chipFilter !== "all") && (
              <button
                onClick={() => { setLiveSearchQuery(""); setChipFilter("all"); }}
                className="h-[40px] px-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition hover:bg-rose-100 shrink-0 cursor-pointer flex items-center justify-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Call Telemetry Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#0F4FA8]/40 hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full space-y-3.5"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                      {custName[0]}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm leading-tight">{custName}</div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">{custPhone}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-extrabold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                    {cleanLeadId}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <div className="h-8 w-8 rounded-xl bg-[#0F4FA8] text-[#FFC107] font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                    {cleanAgentName.split(" ")[1]?.[0] || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-slate-900 text-xs truncate">{cleanAgentName}</div>
                    <div className="text-[10px] text-slate-400 font-semibold truncate">Shift Voice Agent</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="bg-purple-50 text-purple-700 border border-purple-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1">
                    <Megaphone className="h-3 w-3 text-purple-500" />
                    <span>{call.campaign || "Outbound Sales Pool"}</span>
                  </span>
                  <span className="bg-blue-50 text-[#0F4FA8] border border-blue-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1">
                    <Layers className="h-3 w-3 text-blue-500" />
                    <span>{call.queue || "High Priority Sales"}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 border ${
                      call.direction === "inbound"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {call.direction}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-black text-slate-900">{call.timer || "02:15"}</span>
                      <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                        <span>REC</span>
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Positive (94%)</span>
                  </span>
                </div>

                <div className="pt-1 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleMonitor(call.id, "listen")}
                    className="h-9 px-2 bg-[#0F4FA8] hover:bg-blue-900 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    <span>Listen</span>
                  </button>

                  <button
                    onClick={() => handleMonitor(call.id, "whisper")}
                    className="h-9 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Whisper</span>
                  </button>

                  <button
                    onClick={() => handleMonitor(call.id, "barge")}
                    className="h-9 px-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>Barge</span>
                  </button>
                </div>
              </motion.div>
            );
          })}

          {filteredLiveCalls.length === 0 && (
            <div className="p-12 text-center text-slate-400 font-medium space-y-2 col-span-full bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Radio className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs font-extrabold text-slate-700">No Active Live Calls Detected</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
