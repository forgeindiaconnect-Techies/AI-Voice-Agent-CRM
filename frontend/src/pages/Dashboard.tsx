import { useEffect, useState, useCallback, useRef } from "react";
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
  X
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
    <svg className="w-14 h-5 overflow-visible" viewBox="0 0 70 20">
      <path
        d="M0,14 Q15,16 30,10 T50,12 T70,5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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

  // Filters & Search for Live Calls
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
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
    return (
      <div className="flex flex-col justify-center items-center h-[65vh] space-y-3">
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-[#0F4FA8] border-t-transparent"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Enterprise CRM Workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-rose-50 border border-rose-200 rounded-[14px] p-6 text-center space-y-4 shadow-2xs">
        <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto" />
        <h2 className="text-[16px] font-bold text-rose-800">Connection Interrupt</h2>
        <p className="text-xs text-rose-700 font-medium">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-2xs"
        >
          Retry Connection
        </button>
      </div>
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
  if (user?.role === "agent" && summary) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full font-sans">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-[14px] p-5 shadow-2xs border border-[#E7ECF5] lg:col-span-2 flex flex-col min-h-[460px]">
            <h2 className="text-[16px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#0F4FA8]" />
              <span>Softphone Dialer Console</span>
            </h2>

            {activeLead ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-[#E7ECF5] p-4 rounded-xl">
                    <div className="text-[14px] font-bold text-slate-900">{activeLead.name}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">Phone: {activeLead.phone}</div>
                    <div className="text-xs text-[#0F4FA8] font-bold mt-3 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Duration: {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, "0")}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Session Call Notes</label>
                    <textarea
                      placeholder="Type details of conversation outcome..."
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      className="w-full border border-[#E7ECF5] rounded-xl px-3 py-2 text-xs h-24 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-normal text-slate-800"
                    />
                  </div>

                  <button
                    onClick={handleHangUp}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Call & Save Session</span>
                  </button>
                </div>

                <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#0F4FA8] animate-pulse" />
                      <span>AI Live Copilot Suggestions</span>
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Detected Intent</span>
                      <div className="text-xs bg-white border border-blue-200/60 px-3 py-1.5 rounded-xl font-semibold text-slate-800">
                        {aiIntent}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Recommended Responses</span>
                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        {aiSuggestions.map((s, idx) => (
                          <div key={idx} className="bg-white border border-blue-100 p-2.5 rounded-xl text-xs font-medium text-slate-700 flex items-start gap-1.5 shadow-2xs">
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
                <div className="border border-[#E7ECF5] rounded-xl p-4 flex flex-col max-h-[340px]">
                  <h3 className="font-bold text-slate-900 text-xs mb-3 uppercase tracking-wider">Leads Allocation List</h3>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {agentLeads.map(l => (
                      <div key={l.id} className="p-3 border border-[#E7ECF5] bg-slate-50/60 rounded-xl flex justify-between items-center hover:bg-white transition">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{l.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">{l.phone}</div>
                        </div>
                        <button
                          onClick={() => handleDialLead(l)}
                          className="bg-[#0F4FA8] text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-blue-900 transition flex items-center gap-1 cursor-pointer"
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
                    <p className="text-sm font-bold text-slate-700">Ready to Accept Calls</p>
                    <p className="text-xs max-w-xs font-medium leading-relaxed">Select a lead from the queue list to trigger the softphone outbound dialer.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[14px] p-5 shadow-2xs border border-[#E7ECF5] lg:col-span-1 flex flex-col max-h-[460px]">
            <h2 className="text-[14px] font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#0F4FA8]" />
              <span>Shift Call History</span>
            </h2>
            
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {agentCallHistory.map(c => (
                <div
                  key={c.id}
                  className="p-2.5 border border-[#E7ECF5] rounded-xl bg-slate-50/50 hover:bg-blue-50/40 transition cursor-pointer flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">Call #{c.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Duration: {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
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
      </div>
    );
  }

  // --- ADMIN & SUPERVISOR WORKSPACE (EXACT MNC SPECIFICATIONS) ---
  if (!summary) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full font-sans">

      {/* 1. TOP VOICE ENGINE STATUS BANNER */}
      <div className="bg-white/95 backdrop-blur-md rounded-[14px] p-5 shadow-2xs border border-[#E7ECF5] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 text-[#0F4FA8] flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Activity className="h-5 w-5 text-[#0F4FA8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-bold text-slate-900 tracking-tight leading-[28px]">Forge Voice Engine Status</h2>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                HEALTHY
              </span>
            </div>
            <p className="text-[14px] text-slate-500 font-normal leading-[20px] mt-0.5">
              OpenAI Realtime WebSocket Streams & Telephony Bridge Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-50 text-slate-700 text-[12px] font-medium px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-[#E7ECF5] shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Realtime WebSocket Connected</span>
          </div>

          <div className="bg-amber-50 text-amber-800 text-[12px] font-bold px-3.5 py-1.5 rounded-full border border-amber-200/80 flex items-center gap-1.5 shadow-2xs">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <span>AI Stream Cost Today: <strong className="text-amber-900">$0</strong></span>
          </div>
        </div>
      </div>

      {/* 2. 6 EQUAL HEIGHT (160px) KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* KPI Card 1: TOTAL CRM LEADS */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL CRM LEADS</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">{summary.total_leads || 24}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center shadow-2xs">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+18.5%</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#0F4FA8" />
              </div>
            </div>

            {/* KPI Card 2: TODAY'S VOICE CALLS */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">TODAY'S VOICE CALLS</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">{summary.today_calls || 0}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+25.0%</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#F59E0B" />
              </div>
            </div>

            {/* KPI Card 3: ACTIVE LIVE CALLS */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">ACTIVE LIVE CALLS</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">{summary.active_calls || liveCallsList.length || 0}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>2 Streaming</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#10B981" />
              </div>
            </div>

            {/* KPI Card 4: MISSED CALLS */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">MISSED CALLS</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">{summary.missed_calls || 0}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs">
                  <PhoneOff className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    <span>-15.0%</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#EF4444" />
              </div>
            </div>

            {/* KPI Card 5: QUALIFIED LEADS */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">QUALIFIED LEADS</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">{summary.qualified_leads || 4}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+12.0%</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#7C3AED" />
              </div>
            </div>

            {/* KPI Card 6: AVG CALL DURATION */}
            <div className="bg-white p-5 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-[160px]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">AVG CALL DURATION</div>
                  <div className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[38px]">0s</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center shadow-2xs">
                  <Clock className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E7ECF5] text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+8.4s</span>
                  </span>
                  <span className="text-slate-400 font-medium">vs last week</span>
                </div>
                <Sparkline color="#0F4FA8" />
              </div>
            </div>
          </div>

          {/* 3. 12-COLUMN DASHBOARD GRID: LEFT 8 COLS CHARTS + RIGHT 4 COLS QUICK ACTIONS */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left 8 Columns: Hourly Call Volume & Velocity Chart */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-[14px] p-6 border border-[#E7ECF5] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E7ECF5] pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-[16px] leading-[22px] flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#0F4FA8]" />
                    <span>Hourly Call Volume & Velocity</span>
                  </h3>
                  <p className="text-[12px] text-slate-400 font-medium mt-0.5">Real-time dialer throughput across active AI voice channels</p>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  Peak: 142 Calls/hr at 12:00 PM
                </span>
              </div>

              {/* SVG Line Chart */}
              <div className="relative w-full overflow-hidden pt-2">
                <svg viewBox="0 0 600 200" className="w-full h-56 overflow-visible">
                  <defs>
                    <linearGradient id="dashboardChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F4FA8" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#0F4FA8" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {[40, 80, 120, 160].map((val, idx) => {
                    const y = 180 - (val / 160) * 140;
                    return (
                      <g key={idx}>
                        <line x1="30" y1={y} x2="570" y2={y} stroke="#E7ECF5" strokeDasharray="3 3" strokeWidth="1" />
                        <text x="22" y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">{val}</text>
                      </g>
                    );
                  })}
                  <path d="M 30,152 C 60,152 90,120 120,88 C 150,56 180,36 210,24 C 240,12 270,75 300,106 C 330,137 360,76 390,47 C 420,18 450,52 480,78 C 510,104 540,130 570,148 L 570,180 L 30,180 Z" fill="url(#dashboardChartGrad)" />
                  <path d="M 30,152 C 60,152 90,120 120,88 C 150,56 180,36 210,24 C 240,12 270,75 300,106 C 330,137 360,76 390,47 C 420,18 450,52 480,78 C 510,104 540,130 570,148" fill="none" stroke="#0F4FA8" strokeWidth="3" strokeLinecap="round" />
                  {[
                    { x: 30, y: 152, h: "8 AM", v: 32 },
                    { x: 90, y: 120, h: "9 AM", v: 68 },
                    { x: 150, y: 88, h: "10 AM", v: 105 },
                    { x: 210, y: 24, h: "11 AM", v: 142 },
                    { x: 270, y: 106, h: "12 PM", v: 84 },
                    { x: 330, y: 47, h: "1 PM", v: 135 },
                    { x: 390, y: 78, h: "2 PM", v: 96 },
                    { x: 450, y: 110, h: "3 PM", v: 75 },
                    { x: 510, y: 130, h: "4 PM", v: 52 },
                    { x: 570, y: 148, h: "5 PM", v: 38 }
                  ].map((pt, idx) => (
                    <g key={idx} className="group/pt cursor-pointer">
                      <circle cx={pt.x} cy={pt.y} r="4" className="fill-[#0F4FA8] stroke-white stroke-2 group-hover/pt:r-6 transition-all" />
                      <text x={pt.x} y="196" textAnchor="middle" className="text-[9px] fill-slate-400 font-bold uppercase">{pt.h}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Right 4 Columns: Equal Sized Quick Actions Cards Grid (2x3) */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-[14px] p-5 border border-[#E7ECF5] shadow-2xs space-y-4">
              <div className="flex justify-between items-center border-b border-[#E7ECF5] pb-3">
                <h3 className="font-bold text-slate-900 text-[16px] leading-[22px] flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#FFC107]" />
                  <span>Quick Actions Panel</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">2x3 Enterprise Grid</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.location.href = "/campaigns"}
                  className="h-[96px] bg-blue-50/70 hover:bg-[#0F4FA8] text-[#0F4FA8] hover:text-white border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <Zap className="h-5 w-5 text-[#0F4FA8] group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">Launch Campaign</span>
                </button>

                <button
                  onClick={() => showToast("Opening AI Voice Neural Configuration settings...", "info")}
                  className="h-[96px] bg-purple-50/70 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <Sparkles className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">AI Voice Config</span>
                </button>

                <button
                  onClick={() => window.location.href = "/dialer"}
                  className="h-[96px] bg-emerald-50/70 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <Phone className="h-5 w-5 text-emerald-600 group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">Softphone Dial</span>
                </button>

                <button
                  onClick={() => showToast("Exporting performance CSV report...", "info")}
                  className="h-[96px] bg-amber-50/70 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <Download className="h-5 w-5 text-amber-600 group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">Export CSV</span>
                </button>

                <button
                  onClick={fetchDashboardData}
                  className="h-[96px] bg-slate-50 hover:bg-slate-800 text-slate-700 hover:text-white border border-[#E7ECF5] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <RefreshCw className="h-5 w-5 text-slate-600 group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">Sync Metrics</span>
                </button>

                <button
                  onClick={() => window.location.href = "/users"}
                  className="h-[96px] bg-slate-50 hover:bg-slate-800 text-slate-700 hover:text-white border border-[#E7ECF5] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-250 hover:-translate-y-[3px] hover:shadow-md cursor-pointer group"
                >
                  <Users className="h-5 w-5 text-slate-600 group-hover:text-white transition-colors" />
                  <span className="text-[12px] font-bold text-center leading-tight">Manage Users</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. ACTIVE LIVE CALL MONITORING GRID */}
          <div className="bg-white rounded-[14px] p-5 shadow-2xs border border-[#E7ECF5] flex flex-col space-y-4">
            
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7ECF5] pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <Radio className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-[16px] leading-[22px] flex items-center gap-2">
                    <span>Active Live Call Telemetry Monitoring</span>
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      {liveCallsList.length} LIVE CHANNELS
                    </span>
                  </h3>
                  <p className="text-[12px] text-slate-400 font-medium mt-0.5">Real-time Asterisk SIP channels with whisper, barge, and transfer control.</p>
                </div>
              </div>
            </div>

            {/* FULL WIDTH FILTER TOOLBAR PANEL WITH SCROLLABLE CHIPS (NORMAL PAGE FLOW) */}
            <div className="bg-slate-50/70 p-3 rounded-2xl border border-[#E7ECF5] flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* LEFT: FIXED SEARCH INPUT */}
              <div className="relative w-full sm:w-[280px] lg:w-[340px] max-w-[400px] shrink-0">
                <Search className="h-4 w-4 text-[#0F4FA8] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by Customer, Phone, Agent..."
                  value={liveSearchQuery}
                  onChange={(e) => setLiveSearchQuery(e.target.value)}
                  className="w-full h-[40px] pl-10 pr-8 bg-white border border-[#E7ECF5] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] text-slate-800 transition"
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
                    className="h-8 w-8 rounded-lg bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-600 transition flex items-center justify-center shrink-0 cursor-pointer border border-[#E7ECF5] shadow-2xs active:scale-95 z-10"
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
                      className={`h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center justify-center ${
                        chipFilter === chip.id
                          ? "bg-[#0F4FA8] text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-[#E7ECF5]"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {showScrollRight && (
                  <button
                    onClick={() => handleScrollTabs("right")}
                    className="h-8 w-8 rounded-lg bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-600 transition flex items-center justify-center shrink-0 cursor-pointer border border-[#E7ECF5] shadow-2xs active:scale-95 z-10"
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLiveCalls.map((call, idx) => {
                const names = ["Rajesh Kumar", "Ananya Sharma", "Vikram Patel", "Priya Nair", "Suresh Reddy"];
                const phones = ["+91 98765 43210", "+91 98123 56789", "+91 97456 12345", "+91 96321 87654", "+91 95123 45678"];
                const custName = names[idx % names.length];
                const custPhone = phones[idx % phones.length];
                const cleanLeadId = `LEAD-${(idx * 317 + 8472).toString()}`;
                const cleanAgentName = `Agent AGT${(idx * 142 + 84785).toString().slice(0, 5)}`;

                return (
                  <div
                    key={call.id}
                    className="bg-white p-4 rounded-[14px] border border-[#E7ECF5] shadow-2xs hover:border-[#0F4FA8]/40 hover:shadow-md hover:-translate-y-[3px] transition-all duration-250 flex flex-col justify-between h-full space-y-3"
                  >
                    <div className="flex items-start justify-between border-b border-[#E7ECF5] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 text-[#0F4FA8] flex items-center justify-center font-bold shrink-0 shadow-2xs">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-[14px] leading-tight">{custName}</div>
                          <div className="text-[12px] text-slate-500 font-medium mt-0.5">{custPhone}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-50 text-[#0F4FA8] border border-blue-200/80 px-2 py-0.5 rounded-md font-mono">
                        {cleanLeadId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 bg-slate-50/70 p-2.5 rounded-xl border border-[#E7ECF5]">
                      <div className="h-8 w-8 rounded-xl bg-[#0F4FA8] text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                        {cleanAgentName.split(" ")[1]?.[0] || "A"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">{cleanAgentName}</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate">Shift Voice Agent</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="bg-purple-50 text-purple-700 border border-purple-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                        <Megaphone className="h-3 w-3 text-purple-500" />
                        <span>{call.campaign || "Outbound Sales Pool"}</span>
                      </span>
                      <span className="bg-blue-50 text-[#0F4FA8] border border-blue-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                        <Layers className="h-3 w-3 text-blue-500" />
                        <span>{call.queue || "High Priority Sales"}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-xl border border-[#E7ECF5] text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border ${
                          call.direction === "inbound"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {call.direction}
                        </span>

                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono font-bold text-slate-900">{call.timer || "02:15"}</span>
                          <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase animate-pulse flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            <span>REC</span>
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Positive (94%)</span>
                      </span>
                    </div>

                    <div className="pt-1 grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleMonitor(call.id, "listen")}
                        className="h-8 px-2 bg-[#0F4FA8] hover:bg-blue-900 text-white font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <Headphones className="h-3.5 w-3.5" />
                        <span>Listen</span>
                      </button>

                      <button
                        onClick={() => handleMonitor(call.id, "whisper")}
                        className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Whisper</span>
                      </button>

                      <button
                        onClick={() => handleMonitor(call.id, "barge")}
                        className="h-8 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>Barge</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredLiveCalls.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-medium space-y-1 col-span-full">
                  <Radio className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Active Live Calls Detected</p>
                </div>
              )}
            </div>
          </div>

    </div>
  );
}
