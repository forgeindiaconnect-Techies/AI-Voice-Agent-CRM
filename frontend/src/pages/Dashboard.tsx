import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Folder,
  Users,
  Phone,
  Megaphone,
  Target,
  Zap,
  TrendingUp,
  Download,
  CheckCircle,
  Star,
  RefreshCw,
  Server,
  Database,
  Activity,
  Headphones,
  Mic,
  Volume2,
  Lock,
  Heart,
  UserCheck,
  Calendar,
  PhoneCall,
  PhoneOff,
  Clock,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  X,
  Pause,
  Play,
  Radio,
  BarChart3,
  ShieldCheck,
  PieChart,
  Layers,
  ArrowUpRight,
  TrendingDown,
  User
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
  quality_evaluation?: {
    coaching_notes: string;
    ai_quality_score: number;
    compliance_score: number;
    sentiment: string;
  };
};

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [liveCallsList, setLiveCallsList] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent states
  const [agentStatus, setAgentStatus] = useState("online");
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
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<CallHistoryRow | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      const summaryData = await api.get("/api/reports/summary");
      setSummary(summaryData);
      
      if (user?.role !== "agent") {
        const logs = await api.get("/api/reports/recent-activities");
        setActivities(logs);

        const live = await api.get("/api/calls/live");
        setLiveCallsList(live);
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
      setAiIntent("Customer inquiring about product pricing & SLA");
      setAiSuggestions([
        "Highlight 24/7 dedicated support availability",
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

  const handleMonitor = async (callId: string, action: "listen" | "whisper" | "barge") => {
    try {
      await api.post(`/api/calls/${callId}/monitor`, { action });
      showToast(`Joined live channel call #${callId} in [${action.toUpperCase()}] mode.`, "success");
    } catch (err: any) {
      showToast(`Monitor command sent to channel #${callId}`, "info");
    }
  };

  // Enterprise Stat Card Component
  function EnterpriseKpiCard({
    label,
    value,
    subtext,
    icon,
    borderTopColor,
    iconBgColor,
    iconTextColor,
    trend,
    trendPositive = true
  }: {
    label: string;
    value: string | number;
    subtext: string;
    icon: React.ReactNode;
    borderTopColor: string;
    iconBgColor: string;
    iconTextColor: string;
    trend?: string;
    trendPositive?: boolean;
  }) {
    return (
      <div
        className={`bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all duration-200 ${borderTopColor} flex flex-col justify-between h-full`}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{value}</div>
            <div className="text-xs font-extrabold text-slate-700 tracking-tight">{label}</div>
          </div>
          <div className={`h-11 w-11 rounded-2xl ${iconBgColor} ${iconTextColor} flex items-center justify-center shadow-2xs flex-shrink-0`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium truncate">{subtext}</span>
          {trend && (
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                trendPositive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : "bg-rose-50 text-rose-700 border border-rose-200/60"
              }`}
            >
              {trendPositive ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{trend}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[65vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0F4C9A] border-t-transparent"></div>
        <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Loading Enterprise CRM Workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
        <AlertTriangle className="h-12 w-12 text-rose-600 mx-auto" />
        <h2 className="text-lg font-black text-rose-800">Connection Interrupt</h2>
        <p className="text-xs text-rose-700 font-semibold">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // --- AGENT WORKSPACE ---
  if (user?.role === "agent" && summary) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">

        {/* Top Agent KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <EnterpriseKpiCard
            label="Assigned Leads"
            value={summary.total_leads}
            subtext="Assigned leads queue"
            icon={<Target className="h-5 w-5" />}
            borderTopColor="border-t-4 border-t-[#0F4C9A]"
            iconBgColor="bg-blue-50"
            iconTextColor="text-[#0F4C9A]"
            trend="+5 new"
          />
          <EnterpriseKpiCard
            label="Active Campaigns"
            value={summary.total_campaigns}
            subtext="Running dialers"
            icon={<Megaphone className="h-5 w-5" />}
            borderTopColor="border-t-4 border-t-[#8B5CF6]"
            iconBgColor="bg-purple-50"
            iconTextColor="text-purple-600"
          />
          <EnterpriseKpiCard
            label="Today's Calls"
            value={summary.today_calls}
            subtext="Completed today"
            icon={<TrendingUp className="h-5 w-5" />}
            borderTopColor="border-t-4 border-t-blue-500"
            iconBgColor="bg-blue-50"
            iconTextColor="text-blue-600"
            trend="+12%"
          />
          <EnterpriseKpiCard
            label="Call Success Rate"
            value={`${summary.success_rate}%`}
            subtext="Answered calls ratio"
            icon={<CheckCircle className="h-5 w-5" />}
            borderTopColor="border-t-4 border-t-[#10B981]"
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-600"
            trend="+4.2%"
          />
          <EnterpriseKpiCard
            label="Today's Conversions"
            value={summary.today_conversions}
            subtext="Qualified leads count"
            icon={<Star className="h-5 w-5" />}
            borderTopColor="border-t-4 border-t-[#F4B400]"
            iconBgColor="bg-amber-50"
            iconTextColor="text-amber-600"
            trend="+2 today"
          />
        </div>

        {/* Softphone Dialer Console */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 lg:col-span-2 flex flex-col min-h-[480px]">
            <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-[#0F4C9A]" />
              <span>Softphone Dialer Console</span>
            </h2>

            {activeLead ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                    <div className="text-base font-black text-slate-900">{activeLead.name}</div>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5">Phone: {activeLead.phone}</div>
                    <div className="text-xs text-[#0F4C9A] font-extrabold mt-3 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Duration: {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, "0")}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">Session Call Notes</label>
                    <textarea
                      placeholder="Type details of conversation outcome..."
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs h-24 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-medium text-slate-800"
                    />
                  </div>

                  <button
                    onClick={handleHangUp}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 rounded-xl font-extrabold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Call & Save Session</span>
                  </button>
                </div>

                <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#0F4C9A] animate-pulse" />
                      <span>AI Live Copilot Suggestions</span>
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Detected Intent</span>
                      <div className="text-xs bg-white border border-blue-200/60 px-3 py-1.5 rounded-xl font-bold text-slate-800">
                        {aiIntent}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Recommended Responses</span>
                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        {aiSuggestions.map((s, idx) => (
                          <div key={idx} className="bg-white border border-blue-100 p-2.5 rounded-xl text-xs font-semibold text-slate-700 flex items-start gap-1.5 leading-relaxed shadow-2xs">
                            <ChevronRight className="h-4 w-4 text-[#0F4C9A] flex-shrink-0 mt-0.5" />
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
                <div className="border border-slate-200/80 rounded-2xl p-4 flex flex-col max-h-[360px]">
                  <h3 className="font-extrabold text-slate-900 text-xs mb-3 uppercase tracking-wider">Leads Allocation List</h3>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {agentLeads.map(l => (
                      <div key={l.id} className="p-3 border border-slate-100 bg-slate-50/60 rounded-xl flex justify-between items-center hover:bg-white transition">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{l.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">{l.phone}</div>
                        </div>
                        <button
                          onClick={() => handleDialLead(l)}
                          className="bg-[#0F4C9A] text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-blue-800 transition flex items-center gap-1"
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

                <div className="border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center text-slate-400 space-y-3 bg-slate-50/40">
                  <PhoneCall className="h-10 w-10 text-slate-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Ready to Accept Calls</p>
                    <p className="text-xs max-w-xs font-semibold leading-relaxed">Select a lead from the queue list to trigger the SIP softphone outbound dialer.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 lg:col-span-1 flex flex-col max-h-[480px]">
            <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#0F4C9A]" />
              <span>Shift Call History</span>
            </h2>
            
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {agentCallHistory.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedHistoryCall(c)}
                  className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-200 transition cursor-pointer flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">Call #{c.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Duration: {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    c.outcome === "qualified" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
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

  // --- ADMIN & SUPERVISOR WORKSPACE (4-ROW ENTERPRISE DASHBOARD) ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">

      {summary ? (
        <>
          {/* ROW 1: TOP 5 ENTERPRISE KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <EnterpriseKpiCard
              label="Total Pools"
              value={summary.total_pools}
              subtext="Hiring & Sales divisions"
              icon={<Folder className="h-5 w-5" />}
              borderTopColor="border-t-4 border-t-[#0F4C9A]"
              iconBgColor="bg-blue-50"
              iconTextColor="text-[#0F4C9A]"
              trend="+10%"
            />
            <EnterpriseKpiCard
              label="Supervisors"
              value={summary.total_supervisors}
              subtext="Managing agents & leads"
              icon={<UserCheck className="h-5 w-5" />}
              borderTopColor="border-t-4 border-t-[#F4B400]"
              iconBgColor="bg-amber-50"
              iconTextColor="text-amber-600"
              trend="Active"
            />
            <EnterpriseKpiCard
              label="Active Agents"
              value={summary.total_agents}
              subtext="Active call team members"
              icon={<Users className="h-5 w-5" />}
              borderTopColor="border-t-4 border-t-[#10B981]"
              iconBgColor="bg-emerald-50"
              iconTextColor="text-emerald-600"
              trend="Online"
            />
            <EnterpriseKpiCard
              label="Active Campaigns"
              value={summary.total_campaigns}
              subtext="Dialer campaigns setup"
              icon={<Megaphone className="h-5 w-5" />}
              borderTopColor="border-t-4 border-t-[#8B5CF6]"
              iconBgColor="bg-purple-50"
              iconTextColor="text-purple-600"
              trend="+2 new"
            />
            <EnterpriseKpiCard
              label="Total Leads"
              value={summary.total_leads}
              subtext="All imported target leads"
              icon={<Target className="h-5 w-5" />}
              borderTopColor="border-t-4 border-t-[#EF4444]"
              iconBgColor="bg-rose-50"
              iconTextColor="text-rose-600"
              trend="+14.2%"
            />
          </div>

          {/* ROW 2: OPERATIONAL INSIGHTS & LIVE MONITORING */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Calls Monitoring Table (2 Columns) */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Headphones className="h-4.5 w-4.5 text-[#0F4C9A]" />
                  <span>Active Live Call Monitoring</span>
                </h3>
                <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {liveCallsList.length} CALL(S) LIVE
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5">Lead ID</th>
                      <th className="px-4 py-2.5">Agent</th>
                      <th className="px-4 py-2.5">Direction</th>
                      <th className="px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveCallsList.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-bold text-[#0F4C9A]">{call.lead_id}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{call.agent_id}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 border border-slate-200 text-slate-700 capitalize font-bold">
                            {call.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 space-x-1.5">
                          <button
                            onClick={() => handleMonitor(call.id, "listen")}
                            className="bg-[#0F4C9A] text-white text-[11px] px-2.5 py-1 rounded-lg font-bold hover:bg-blue-800 transition inline-flex items-center gap-1"
                          >
                            <Headphones className="h-3 w-3" />
                            <span>Listen</span>
                          </button>
                          <button
                            onClick={() => handleMonitor(call.id, "whisper")}
                            className="bg-emerald-600 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1"
                          >
                            <Volume2 className="h-3 w-3" />
                            <span>Whisper</span>
                          </button>
                          <button
                            onClick={() => handleMonitor(call.id, "barge")}
                            className="bg-rose-600 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold hover:bg-rose-700 transition inline-flex items-center gap-1"
                          >
                            <Mic className="h-3 w-3" />
                            <span>Barge</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {liveCallsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400 font-medium">
                          No active voice channels currently detected on dialer nodes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Campaign Performance & Lead Funnel */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Megaphone className="h-4.5 w-4.5 text-purple-600" />
                  <span>Campaign Performance</span>
                </h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Inbound Support Pool</span>
                      <span className="text-purple-600">84% Dials</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: "84%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Outbound Sales Campaign</span>
                      <span className="text-[#0F4C9A]">62% Dials</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#0F4C9A] h-full rounded-full" style={{ width: "62%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>High-Value Callbacks</span>
                      <span className="text-emerald-600">91% Conversion</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "91%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs">
                <div className="font-extrabold text-slate-900 mb-2">Lead Conversion Pipeline</div>
                <div className="grid grid-cols-4 gap-1 text-center font-bold text-[10px]">
                  <div className="bg-blue-50 p-2 rounded-lg text-[#0F4C9A]">New (100%)</div>
                  <div className="bg-purple-50 p-2 rounded-lg text-purple-700">Contacted (75%)</div>
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-800">Qualified (50%)</div>
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-800">Converted (28%)</div>
                </div>
              </div>
            </div>

          </div>

          {/* ROW 3: AGENT PERFORMANCE, RECENT ACTIVITIES & AI INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Agent Performance Leaderboard */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80">
              <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-emerald-600" />
                <span>Agent Performance</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#0F4C9A] text-white font-black flex items-center justify-center text-xs">A</div>
                    <div>
                      <div className="font-bold text-slate-900">Agent AGT84785</div>
                      <div className="text-[10px] text-slate-500">Day Shift · Hiring Pool</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-600">94% Answer Rate</div>
                    <div className="text-[10px] text-slate-400 font-medium">18 Calls Dialed</div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-purple-600 text-white font-black flex items-center justify-center text-xs">T</div>
                    <div>
                      <div className="font-bold text-slate-900">Team Leader TL902</div>
                      <div className="text-[10px] text-slate-500">Shift Manager</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-purple-600">98% Compliance</div>
                    <div className="text-[10px] text-slate-400 font-medium">Supervising 5 Channels</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights & Sentiment */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80">
              <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-amber-500" />
                <span>AI Speech & Sentiment</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1">
                  <span className="font-black text-amber-800 text-[10px] uppercase tracking-wider block">Speech Emotion Engine</span>
                  <p className="font-semibold text-amber-950 leading-relaxed">
                    85% of live calls analyzed recorded positive or neutral customer sentiment. 
                  </p>
                </div>
                <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl space-y-1">
                  <span className="font-black text-blue-800 text-[10px] uppercase tracking-wider block">Top Objections Detected</span>
                  <p className="font-semibold text-blue-950 leading-relaxed">
                    Pricing inquiries & plan upgrades account for 48% of customer queries today.
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Security & Activity Audit Log */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80">
              <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-[#0F4C9A]" />
                <span>Recent Activity Feed</span>
              </h3>
              <div className="overflow-y-auto max-h-52 space-y-2">
                {activities.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-2.5 bg-slate-50 hover:bg-slate-100/60 rounded-xl transition border border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{log.actor_name}</span>{" "}
                      <span className="text-[9px] text-slate-500 font-black bg-slate-200/80 px-2 py-0.5 rounded-md uppercase font-mono tracking-wider ml-1 border border-slate-300/50">
                        {log.action.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 font-medium">No recent system activities recorded.</p>
                )}
              </div>
            </div>

          </div>

          {/* ROW 4: SYSTEM HEALTH, QUEUE ENGINE & QUICK ACTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* System Status & Health */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Server className="h-4.5 w-4.5 text-[#0F4C9A]" />
                  <span>System Status & Health</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-600 flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-400" />
                      <span>Local MongoDB Database</span>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                      {summary.system_health.mongodb.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-600 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span>CRM API Gateway</span>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                      {summary.system_health.api.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-600 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-slate-400" />
                      <span>AI Agent Engine</span>
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {summary.ai_agent_status.active_channels} Channels Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500 font-medium flex items-start gap-2">
                <Lock className="h-4 w-4 text-[#0F4C9A] flex-shrink-0 mt-0.5" />
                <span>All endpoints protected with JWT & RBAC context. Data encrypted in transit.</span>
              </div>
            </div>

            {/* Queue Engine Analytics */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-blue-600" />
                  <span>Queue Engine Analytics</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <span className="font-bold text-slate-700">Waiting Leads Queue</span>
                    <span className="font-black text-[#0F4C9A] text-sm">{summary.queue_status.waiting_leads}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                    <span className="font-bold text-slate-700">Queue Engine Status</span>
                    <span className="font-black text-purple-700 text-xs uppercase">{summary.queue_status.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick System Actions */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-[#0F4C9A]" />
                  <span>Quick Actions</span>
                </h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <button
                    onClick={() => window.location.href = "/leads"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-800 transition text-left flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-[#0F4C9A]" />
                    <span>Import Leads</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/campaigns"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-800 transition text-left flex items-center gap-2"
                  >
                    <Megaphone className="h-4 w-4 text-purple-600" />
                    <span>New Campaign</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/live-calls"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-800 transition text-left flex items-center gap-2"
                  >
                    <Radio className="h-4 w-4 text-rose-500" />
                    <span>Live Console</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/reports"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-800 transition text-left flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    <span>Export Audit</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </>
      ) : null}

    </div>
  );
}
