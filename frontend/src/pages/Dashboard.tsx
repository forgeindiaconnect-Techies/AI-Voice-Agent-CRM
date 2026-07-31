import { useEffect, useState, useCallback } from "react";
import { api, BASE_URL } from "../api/client";
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
  MessageSquare,
  Award,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  X,
  Pause,
  Play
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
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [liveCallsList, setLiveCallsList] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Agent-specific states ---
  const [agentStatus, setAgentStatus] = useState(user?.shift ? "online" : "online");
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [agentCallHistory, setAgentCallHistory] = useState<CallHistoryRow[]>([]);
  
  // Softphone Session state
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("answered");
  const [scheduleFollowUpDate, setScheduleFollowUpDate] = useState("");

  // Simulated AI suggestions during a live call
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiIntent, setAiIntent] = useState("Determining intent...");

  // History Recording Player state
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
        // Fetch agent specific lists
        const leadsData = await api.get("/api/leads?status_filter=new");
        setAgentLeads(leadsData);

        const historyData = await api.get("/api/calls");
        setAgentCallHistory(historyData);
      }
      
      setError(null);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to sync dashboard.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const [wsConnected, setWsConnected] = useState(false);

  // Set up WebSocket with fallback REST polling
  useEffect(() => {
    fetchDashboardData();

    let ws: WebSocket | null = null;
    let pollInterval: any = null;
    let reconnectTimeout: any = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      if (ws) {
        try {
          ws.close();
        } catch (e) {}
      }

      const token = localStorage.getItem("access_token") || "";
      const wsUrl = `${BASE_URL.replace("http://", "ws://").replace("https://", "wss://")}/ws/pool/global?token=${token}`;
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log("WebSocket connected to global events channel");
          setWsConnected(true);
          reconnectAttempts = 0;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket message received:", data);
            
            // Auto refresh dashboard
            fetchDashboardData();

            // Toast notifications
            if (data.event === "pools_updated") {
              showToast("Pool configurations updated.", "info");
            } else if (data.event === "campaigns_updated") {
              showToast("Campaign status or details modified.", "info");
            } else if (data.event === "leads_updated") {
              showToast("Leads updated or new leads imported.", "success");
            } else if (data.event === "users_updated") {
              showToast("User accounts or supervisor assignments modified.", "info");
            }
          } catch (e) {
            console.error("Error handling WebSocket event", e);
          }
        };

        ws.onerror = (err) => {
          if (isUnmounted) return;
          console.warn("WebSocket connection error occurred:", err);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          console.log("WebSocket connection closed.");
          
          // Setup REST polling fallback if not already running
          if (!pollInterval) {
            console.log("Starting REST fallback polling (10s intervals)...");
            pollInterval = setInterval(fetchDashboardData, 10000);
          }

          // Reconnect logic with max attempts to avoid endless loop spam
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(5000 * reconnectAttempts, 30000);
            console.log(`Retrying WebSocket connection in ${delay / 1000}s (Attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            reconnectTimeout = setTimeout(connect, delay);
          } else {
            console.warn("Max WebSocket reconnect attempts reached. Keeping REST polling active.");
          }
        };
      } catch (err) {
        console.error("WebSocket setup failed:", err);
        setWsConnected(false);
        if (!pollInterval) {
          pollInterval = setInterval(fetchDashboardData, 10000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [fetchDashboardData, showToast]);

  // softphone timers
  useEffect(() => {
    let t: any;
    if (activeCallId) {
      t = setInterval(() => {
        setCallDurationSeconds(s => s + 1);
        
        // Simulating progressive AI tips
        setCallDurationSeconds(current => {
          if (current === 5) {
            setAiIntent("Interested (Exploring credit lines)");
            setAiSuggestions(["Introduce seasonal cashback offers", "Verify preferred language options"]);
          } else if (current === 15) {
            setAiSuggestions(["Propose standard 30-day billing cycle", "Request current supervisor approval if needed"]);
          }
          return current;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [activeCallId]);

  // Audio player simulation timer
  useEffect(() => {
    let timer: any;
    if (isAudioPlaying) {
      timer = setInterval(() => {
        setAudioProgress(p => {
          if (p >= 100) {
            setIsAudioPlaying(false);
            return 0;
          }
          return p + 5;
        });
      }, 300);
    }
    return () => clearInterval(timer);
  }, [isAudioPlaying]);

  // Handle agent status update
  async function handleStatusChange(statusVal: string) {
    try {
      await api.patch(`/api/users/status?status_val=${statusVal}`);
      setAgentStatus(statusVal);
      showToast(`Your status updated to ${statusVal.toUpperCase()}`, "success");
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    }
  }

  // Softphone action handlers
  async function handleDialLead(lead: Lead) {
    try {
      const call = await api.post("/api/calls/start", { lead_id: lead.id, direction: "outbound" });
      setActiveLead(lead);
      setActiveCallId(call.id);
      setCallDurationSeconds(0);
      setCallNotes("");
      setAiIntent("Analyzing intent...");
      setAiSuggestions(["Greet customer warmly using local language", "Explain purpose: campaign updates"]);
      showToast(`Connecting call to ${lead.name}...`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to dial lead", "error");
    }
  }

  async function handleHangUp() {
    if (!activeCallId) return;
    try {
      // If follow-up date specified, post follow-up scheduler API
      if (scheduleFollowUpDate && activeLead) {
        await api.patch(`/api/leads/${activeLead.id}/disposition`, {
          status: "follow_up",
          notes: callNotes || "Follow-up scheduled during call session",
          follow_up_at: new Date(scheduleFollowUpDate).toISOString()
        });
      }

      await api.post("/api/calls/end", {
        call_id: activeCallId,
        outcome: callOutcome,
        duration_seconds: callDurationSeconds,
        notes: callNotes,
        ai_summary: `Customer discussed requirements. Disposition set to ${callOutcome}.`,
        transcript: `[00:01] Agent: Hello, is this ${activeLead?.name}?\n[00:04] Customer: Yes, speaking.\n[00:08] Agent: Discussing connected pool parameters.\n[00:12] Customer: Verified.`
      });

      showToast(`Call ended. Outcome: ${callOutcome.toUpperCase()}`, "success");
      setActiveCallId(null);
      setActiveLead(null);
      setCallNotes("");
      setScheduleFollowUpDate("");
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to end call session", "error");
    }
  }

  async function handleMonitor(callId: string, action: "listen" | "whisper" | "barge") {
    try {
      await api.post(`/api/calls/${callId}/monitor?action=${action}`);
      showToast(`Signal sent: ${action.toUpperCase()} activated on call.`, "success");
    } catch (err: any) {
      showToast(err.message || "Monitor command failed", "error");
    }
  }

  function StatCard({
    label,
    value,
    accent,
    icon,
    subtext,
  }: {
    label: string;
    value: string | number;
    accent: string;
    icon: React.ReactNode;
    subtext?: string;
  }) {
    return (
      <div
        className="bg-white rounded-2xl shadow-xs border border-gray-100 border-t-4 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        style={{ borderTopColor: accent }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-3xl font-black text-gray-900 tracking-tight leading-none">{value}</div>
            <div className="text-xs font-extrabold text-gray-800 tracking-tight mt-2">{label}</div>
          </div>
          <span className="p-2.5 bg-slate-50 rounded-2xl border border-gray-100/80 shadow-2xs flex-shrink-0">{icon}</span>
        </div>
        {subtext && (
          <div className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-100/80 font-medium truncate">
            {subtext}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-forgeBlue border-t-transparent"></div>
        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Syncing CRM Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-red-50 border border-red-200 rounded-3xl p-6 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-600 mx-auto" />
        <h2 className="text-lg font-black text-red-800">Sync Interrupted</h2>
        <p className="text-xs text-red-700 font-semibold">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
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
        {/* Agent Compact Enterprise Header */}
        <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 pt-0 pb-1 mb-4">
          <div className="bg-white/95 backdrop-blur-md px-6 md:px-8 py-3 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-4 min-h-[80px]">
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-gray-900 tracking-tight leading-none">Welcome, {user.name}</h1>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 font-semibold mt-1">
                <span>Role: <strong className="text-forgeBlue capitalize">Agent</strong></span>
                <span>·</span>
                <span>ID: <strong className="text-gray-700">{user.employee_id}</strong></span>
                <span>·</span>
                <span>Pool: <strong className="text-forgeBlue capitalize">{user.pool_id?.replace("_", " ") || "General"}</strong></span>
                <span>·</span>
                <span>Shift: <strong className="text-gray-700">{user.shift || "Day Shift"}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status:</label>
                <select
                  value={agentStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-gray-800 focus:outline-none cursor-pointer"
                >
                  <option value="online">Online (Available)</option>
                  <option value="busy">Busy (In call)</option>
                  <option value="break">Shift Break</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              
              <button
                onClick={fetchDashboardData}
                className="h-10 px-4 bg-forgeBlue hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard
            label="Assigned Leads"
            value={summary.total_leads}
            accent="#0B4EA2"
            icon={<Target className="h-6 w-6 text-forgeBlue" />}
            subtext="Assigned leads queue"
          />
          <StatCard
            label="Active Campaigns"
            value={summary.total_campaigns}
            accent="#a855f7"
            icon={<Megaphone className="h-6 w-6 text-purple-500" />}
            subtext="Target dialers"
          />
          <StatCard
            label="Today's Calls"
            value={summary.today_calls}
            accent="#3b82f6"
            icon={<TrendingUp className="h-6 w-6 text-blue-500" />}
            subtext="Calls completed today"
          />
          <StatCard
            label="Call Success Rate"
            value={`${summary.success_rate}%`}
            accent="#10b981"
            icon={<CheckCircle className="h-6 w-6 text-emerald-500" />}
            subtext="Answered calls ratio"
          />
          <StatCard
            label="Today's Follow-ups"
            value={summary.today_followups}
            accent="#FFC72C"
            icon={<Calendar className="h-6 w-6 text-amber-500" />}
            subtext="Callbacks pending"
          />
          <StatCard
            label="Today's Conversions"
            value={summary.today_conversions}
            accent="#10b981"
            icon={<Download className="h-6 w-6 text-emerald-500" />}
            subtext="Qualified leads count"
          />
        </div>

        {/* Main Panel Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Dialer Console Workspace */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 lg:col-span-2 flex flex-col min-h-[500px]">
            <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-forgeBlue" />
              <span>Agent Softphone dialer</span>
            </h2>

            {activeLead ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {/* Active Session details */}
                <div className="space-y-4">
                  <div className="bg-slate-50 border p-4 rounded-2xl">
                    <div className="text-lg font-black text-gray-800">{activeLead.name}</div>
                    <div className="text-xs text-gray-400 font-bold mt-1">Number: {activeLead.phone}</div>
                    <div className="text-xs text-forgeBlue font-bold mt-4 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Live Duration: {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, "0")}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Session Call Notes</label>
                    <textarea
                      placeholder="Type details of conversation outcome..."
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs h-24 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-forgeBlue font-medium text-gray-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Outcome</label>
                      <select
                        value={callOutcome}
                        onChange={e => setCallOutcome(e.target.value)}
                        className="w-full border rounded-xl px-2 py-2 text-xs font-bold bg-gray-50 text-gray-700"
                      >
                        <option value="answered">Answered / General</option>
                        <option value="qualified">Qualified / Converted</option>
                        <option value="follow_up_required">Follow-up Required</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="voicemail">Voicemail / No Answer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Schedule Callback</label>
                      <input
                        type="datetime-local"
                        value={scheduleFollowUpDate}
                        onChange={e => setScheduleFollowUpDate(e.target.value)}
                        className="w-full border rounded-xl px-2 py-1.5 text-xs font-bold bg-gray-50 text-gray-700"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleHangUp}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>Hang Up & Save Session</span>
                  </button>
                </div>

                {/* AI Assistant script box */}
                <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                      <Sparkles className="h-4.5 w-4.5 text-forgeBlue animate-pulse" />
                      <span>AI Script Companion</span>
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Customer Intent</span>
                      <div className="text-xs bg-white border px-3 py-1.5 rounded-lg font-bold text-gray-700">
                        {aiIntent}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Live Script Suggestions</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {aiSuggestions.map((s, idx) => (
                          <div key={idx} className="bg-white border border-blue-200/50 p-2.5 rounded-xl text-xs font-semibold text-gray-600 flex items-start gap-1.5 leading-relaxed">
                            <ChevronRight className="h-4 w-4 text-forgeBlue flex-shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-[10px] text-blue-800 leading-relaxed font-semibold">
                    Multi-language intent detection actively processing Tamil & English audio streams.
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {/* Leads lists queue */}
                <div className="border rounded-2xl p-4 flex flex-col max-h-[350px]">
                  <h3 className="font-bold text-gray-800 text-sm mb-3">Leads Allocation List</h3>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {agentLeads.map(l => (
                      <div key={l.id} className="p-3 border bg-gray-50/50 rounded-xl flex justify-between items-center hover:bg-white transition">
                        <div>
                          <div className="font-bold text-gray-700 text-xs">{l.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">{l.phone}</div>
                        </div>
                        <button
                          onClick={() => handleDialLead(l)}
                          className="bg-forgeBlue text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-blue-800 transition flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          <span>Dial</span>
                        </button>
                      </div>
                    ))}
                    {agentLeads.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-12 font-medium">No assigned leads awaiting callback.</p>
                    )}
                  </div>
                </div>

                {/* Softphone instructions */}
                <div className="border border-dashed border-gray-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center text-gray-400 space-y-3 bg-gray-50/50">
                  <PhoneCall className="h-10 w-10 text-gray-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-700">Ready to Accept Calls</p>
                    <p className="text-xs max-w-xs font-semibold leading-relaxed">Select a lead from the queue list to trigger the SIP softphone outbound dialer.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Call History list & details */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 lg:col-span-1 flex flex-col max-h-[500px]">
            <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-1.5">
              <Clock className="h-4.5 w-4.5 text-forgeBlue" />
              <span>Shift Call History</span>
            </h2>
            
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {agentCallHistory.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedHistoryCall(c);
                    setIsAudioPlaying(false);
                    setAudioProgress(0);
                  }}
                  className="p-3 border rounded-2xl bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-200 transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-gray-800 text-xs">Call #{c.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                      Duration: {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    c.outcome === "qualified" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    {c.outcome}
                  </span>
                </div>
              ))}
              {agentCallHistory.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-12 font-medium">No recorded calls completed during current shift.</p>
              )}
            </div>
          </div>

        </div>

        {/* History Recording Player Modal */}
        {selectedHistoryCall && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-scale-in">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-black text-gray-800 text-base">Call Details #{selectedHistoryCall.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-xs text-gray-400 font-medium">Lead ID: {selectedHistoryCall.lead_id}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryCall(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Audio Waveform Player Simulation */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Headphones className="h-4 w-4 text-emerald-400" />
                    <span>Call Recording Audio</span>
                  </span>
                  <span className="font-mono text-emerald-400">
                    {Math.floor(selectedHistoryCall.duration_seconds / 60)}:{String(selectedHistoryCall.duration_seconds % 60).padStart(2, "0")}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${isAudioPlaying ? audioProgress : 0}%` }}
                  />
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    onClick={() => {
                      setIsAudioPlaying(!isAudioPlaying);
                      if (!isAudioPlaying) {
                        setAudioProgress(10);
                        const interval = setInterval(() => {
                          setAudioProgress(p => {
                            if (p >= 100) {
                              clearInterval(interval);
                              setIsAudioPlaying(false);
                              return 0;
                            }
                            return p + 15;
                          });
                        }, 500);
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5"
                  >
                    {isAudioPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{isAudioPlaying ? "Pause Audio" : "Play Recording"}</span>
                  </button>

                  <span className="text-[10px] text-slate-400 font-mono">24kHz / Opus Stereo</span>
                </div>
              </div>

              {/* AI Coaching & Sentiment details */}
              {selectedHistoryCall.quality_evaluation && (
                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-bold text-gray-800">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-forgeBlue" />
                      <span>AI Quality & Sentiment Evaluation</span>
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black text-[10px]">
                      {selectedHistoryCall.quality_evaluation.ai_quality_score}/100 SCORE
                    </span>
                  </div>
                  <p className="text-gray-600 font-medium leading-relaxed">
                    {selectedHistoryCall.quality_evaluation.coaching_notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedHistoryCall(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 border text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ADMIN & SUPERVISOR WORKSPACE ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Admin / TL Compact Enterprise Header */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 pt-0 pb-1 mb-4">
        <div className="bg-white/95 backdrop-blur-md px-6 md:px-8 py-3 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-4 min-h-[80px]">
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-gray-900 tracking-tight leading-none">
              Welcome, {user?.name || "User"}
            </h1>
            <p className="text-xs text-gray-500 font-semibold capitalize mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Role: <span className="text-forgeBlue font-bold">{user?.role.replace("_", " ")}</span></span>
              <span>·</span>
              <span>ID: <span className="font-bold text-gray-700">{user?.employee_id}</span></span>
              {user?.role === "team_leader" && (
                <>
                  <span>·</span>
                  <span>Team: <span className="font-bold text-gray-700">{user?.pool_id?.replace("_", " ").toUpperCase() || "General"}</span></span>
                  <span>·</span>
                  <span>Shift: <span className="font-bold text-gray-700">{user?.shift || "Day Shift (9 AM - 6 PM)"}</span></span>
                  <span>·</span>
                  <span>Status: <span className="font-bold text-emerald-600">Active</span></span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Compact Green Live Pill */}
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Activity className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>LIVE UPDATES</span>
            </span>

            {/* Sync Data Button */}
            <button
              onClick={fetchDashboardData}
              className="h-10 px-4 bg-forgeBlue hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync Data</span>
            </button>
          </div>
        </div>
      </div>

      {summary ? (
        <>
          {/* Main Counters Row - 2 rows of 5 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {user?.role === "team_leader" ? (
              <>
                <StatCard
                  label="Assigned Agents"
                  value={summary.total_agents}
                  accent="#0B4EA2"
                  icon={<Users className="h-5 w-5 text-forgeBlue" />}
                  subtext="Total members in team"
                />
                <StatCard
                  label="Active Agents"
                  value={summary.active_agents || 0}
                  accent="#FFC72C"
                  icon={<UserCheck className="h-5 w-5 text-amber-500" />}
                  subtext="Online / busy / break"
                />
                <StatCard
                  label="Total Leads"
                  value={summary.total_leads}
                  accent="#10b981"
                  icon={<Target className="h-5 w-5 text-emerald-500" />}
                  subtext="Assigned leads inventory"
                />
                <StatCard
                  label="Active Campaigns"
                  value={summary.total_campaigns}
                  accent="#a855f7"
                  icon={<Megaphone className="h-5 w-5 text-purple-500" />}
                  subtext="Campaigns running"
                />
                <StatCard
                  label="Live Calls"
                  value={summary.active_calls}
                  accent="#f43f5e"
                  icon={<Zap className="h-5 w-5 text-rose-500" />}
                  subtext="Live audio channels"
                />
                <StatCard
                  label="Today's Calls"
                  value={summary.today_calls}
                  accent="#06b6d4"
                  icon={<TrendingUp className="h-5 w-5 text-cyan-500" />}
                  subtext="Calls dialed today"
                />
                <StatCard
                  label="Today's Follow-ups"
                  value={summary.today_followups || 0}
                  accent="#3b82f6"
                  icon={<Calendar className="h-5 w-5 text-blue-500" />}
                  subtext="Callbacks today"
                />
                <StatCard
                  label="Today's Conversions"
                  value={summary.today_conversions || 0}
                  accent="#10b981"
                  icon={<Download className="h-5 w-5 text-emerald-500" />}
                  subtext="Qualified leads count"
                />
                <StatCard
                  label="Call Success Rate"
                  value={`${summary.success_rate}%`}
                  accent="#10b981"
                  icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                  subtext="Answered calls ratio"
                />
                <StatCard
                  label="Team Performance"
                  value={`${summary.team_performance || 0}%`}
                  accent="#FFC72C"
                  icon={<Star className="h-5 w-5 text-amber-500" />}
                  subtext="Overall team efficiency"
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Total Pools"
                  value={summary.total_pools}
                  accent="#0B4EA2"
                  icon={<Folder className="h-5 w-5 text-forgeBlue" />}
                  subtext="Hiring & Sales divisions"
                />
                <StatCard
                  label="Supervisors"
                  value={summary.total_supervisors}
                  accent="#FFC72C"
                  icon={<UserCheck className="h-5 w-5 text-amber-500" />}
                  subtext="Managing agents & leads"
                />
                <StatCard
                  label="Agents"
                  value={summary.total_agents}
                  accent="#10b981"
                  icon={<Users className="h-5 w-5 text-emerald-500" />}
                  subtext="Active call team members"
                />
                <StatCard
                  label="Campaigns"
                  value={summary.total_campaigns}
                  accent="#a855f7"
                  icon={<Megaphone className="h-5 w-5 text-purple-500" />}
                  subtext="Dialer campaigns setup"
                />
                <StatCard
                  label="Total Leads"
                  value={summary.total_leads}
                  accent="#f43f5e"
                  icon={<Target className="h-5 w-5 text-rose-500" />}
                  subtext="All imported target leads"
                />
                <StatCard
                  label="Active Calls"
                  value={summary.active_calls}
                  accent="#06b6d4"
                  icon={<Zap className="h-5 w-5 text-cyan-500" />}
                  subtext="Current ongoing connections"
                />
                <StatCard
                  label="Today's Calls"
                  value={summary.today_calls}
                  accent="#3b82f6"
                  icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
                  subtext="Calls made since midnight"
                />
                <StatCard
                  label="Today's Imports"
                  value={summary.today_imports}
                  accent="#10b981"
                  icon={<Download className="h-5 w-5 text-emerald-500" />}
                  subtext="New leads stored today"
                />
                <StatCard
                  label="Call Success Rate"
                  value={`${summary.success_rate}%`}
                  accent="#10b981"
                  icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                  subtext="Answered calls ratio"
                />
                <StatCard
                  label="Conversion Rate"
                  value={`${summary.conversion_rate}%`}
                  accent="#FFC72C"
                  icon={<Star className="h-5 w-5 text-amber-500" />}
                  subtext="Leads qualified ratio"
                />
              </>
            )}
          </div>

          {/* System Health & Live Call Monitoring Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: System Status & Health */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2">
                  <Server className="h-4.5 w-4.5 text-forgeBlue" />
                  <span>System Status & Health</span>
                </h3>
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                      <Database className="h-4 w-4 text-gray-400" />
                      <span>Local MongoDB Status</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                        summary.system_health.mongodb === "connected"
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase"
                          : "bg-rose-50 border border-rose-200 text-rose-700 uppercase"
                      }`}
                    >
                      {summary.system_health.mongodb.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-400" />
                      <span>CRM API Connection</span>
                    </span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                      {summary.system_health.api.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span>Queue Status</span>
                    </span>
                    <div className="text-right">
                      <span className="block text-xs font-bold text-gray-800">
                        {summary.queue_status.waiting_leads} waiting
                      </span>
                      <span className="text-[9px] text-gray-400 font-extrabold uppercase">
                        {summary.queue_status.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-gray-400" />
                      <span>AI Agent Calling Engine</span>
                    </span>
                    <div className="text-right">
                      <span className="block text-xs font-bold text-gray-800">
                        {summary.ai_agent_status.active_channels} channels
                      </span>
                      <span className="text-[9px] text-gray-400 font-extrabold uppercase">
                        {summary.ai_agent_status.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 bg-slate-50 p-3.5 rounded-xl border border-gray-100 text-[11px] text-gray-500 font-medium flex items-start gap-2">
                <Lock className="h-4 w-4 text-forgeBlue flex-shrink-0 mt-0.5" />
                <span>All endpoints protected with JWT & RBAC context. Data is encrypted in transit and local MongoDB storage.</span>
              </div>
            </div>

            {/* Column 2 & 3: Active Live Call Monitoring */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100 lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                  <Headphones className="h-4.5 w-4.5 text-forgeBlue" />
                  <span>Active Live Call Monitoring</span>
                </h3>
                <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {liveCallsList.length} CALL(S) LIVE
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5">Lead ID</th>
                      <th className="px-4 py-2.5">Agent</th>
                      <th className="px-4 py-2.5">Direction</th>
                      <th className="px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {liveCallsList.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-bold text-forgeBlue">{call.lead_id}</td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{call.agent_id}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 border text-slate-700 capitalize font-bold">
                            {call.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 space-x-1.5">
                          <button
                            onClick={() => handleMonitor(call.id, "listen")}
                            className="bg-forgeBlue text-white text-[11px] px-2.5 py-1 rounded-lg font-bold hover:bg-blue-800 transition inline-flex items-center gap-1"
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
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400 font-medium">
                          No active voice channels currently detected on dialer nodes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Campaign Performance & AI Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Campaign Performance Overview */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2">
                <Megaphone className="h-4.5 w-4.5 text-purple-500" />
                <span>Campaign Performance</span>
              </h3>
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold text-gray-700 mb-1">
                    <span>Inbound Support Pool</span>
                    <span className="text-purple-600">84% Dials Completed</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: "84%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-700 mb-1">
                    <span>Outbound Sales Campaign</span>
                    <span className="text-forgeBlue">62% Dials Completed</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-forgeBlue h-full rounded-full" style={{ width: "62%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-700 mb-1">
                    <span>High-Value Callbacks</span>
                    <span className="text-emerald-600">91% Conversion</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: "91%" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights & Sentiment Analysis */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-amber-500" />
                <span>AI Insights & Sentiment</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1">
                  <span className="font-black text-amber-800 text-[10px] uppercase tracking-wider block">Customer Emotion Engine</span>
                  <p className="font-semibold text-amber-950 leading-relaxed">
                    85% of live calls analyzed recorded positive or neutral sentiment. 
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

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-forgeBlue" />
                  <span>Quick System Actions</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => window.location.href = "/leads"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl font-extrabold text-gray-800 transition text-left flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-forgeBlue" />
                    <span>Import Leads</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/campaigns"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl font-extrabold text-gray-800 transition text-left flex items-center gap-2"
                  >
                    <Megaphone className="h-4 w-4 text-purple-600" />
                    <span>New Campaign</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/live-calls"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl font-extrabold text-gray-800 transition text-left flex items-center gap-2"
                  >
                    <Radio className="h-4 w-4 text-rose-500" />
                    <span>Live Console</span>
                  </button>

                  <button
                    onClick={() => window.location.href = "/reports"}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl font-extrabold text-gray-800 transition text-left flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    <span>Export Audit</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Audit Logs Row */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100">
            <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-forgeBlue" />
              <span>Recent Audit Trails & Activity Logs</span>
            </h3>
            <div className="overflow-y-auto max-h-64 space-y-2">
              {activities.map((log) => (
                <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/60 rounded-xl transition border border-gray-100 text-xs">
                  <div>
                    <span className="font-bold text-gray-800">
                      {log.actor_name}
                    </span>{" "}
                    <span className="text-[9px] text-gray-500 font-black bg-gray-200/80 px-2 py-0.5 rounded-md uppercase font-mono tracking-wider ml-1 border border-gray-300/50">
                      {log.action.replace("_", " ")}
                    </span>
                    {log.target_employee_id && (
                      <span className="text-gray-500 font-medium ml-2">
                        (Target: {log.target_employee_id})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono font-semibold">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6 font-medium">No recent system activities recorded.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
