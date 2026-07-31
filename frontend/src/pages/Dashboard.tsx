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
        className="bg-white rounded-xl shadow-sm border-t-4 p-5 hover:shadow-md transition duration-200"
        style={{ borderTopColor: accent }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-3xl font-black text-gray-800 tracking-tight">{value}</div>
            <div className="text-sm font-semibold text-gray-600 mt-1">{label}</div>
          </div>
          <span className="p-2 bg-gray-50 rounded-xl">{icon}</span>
        </div>
        {subtext && <div className="text-[11px] text-gray-400 mt-2 font-medium">{subtext}</div>}
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Agent Header Banner */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Welcome, {user.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400 mt-1">
              <span>Agent ID: <strong className="text-gray-700">{user.employee_id}</strong></span>
              <span>·</span>
              <span>Pool: <strong className="text-forgeBlue capitalize">{user.pool_id?.replace("_", " ") || "General"}</strong></span>
              <span>·</span>
              <span>Shift: <strong className="text-gray-700">{user.shift || "Day Shift"}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500">Status:</label>
              <select
                value={agentStatus}
                onChange={e => handleStatusChange(e.target.value)}
                className="border rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 focus:outline-none"
              >
                <option value="online">Online (Available)</option>
                <option value="busy">Busy (In call)</option>
                <option value="break">Shift Break</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <button
              onClick={fetchDashboardData}
              className="bg-forgeBlue hover:bg-blue-800 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync Data</span>
            </button>
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
            accent="#22c55e"
            icon={<CheckCircle className="h-6 w-6 text-green-500" />}
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
                  className={`p-3 border rounded-xl transition cursor-pointer text-left space-y-1.5 ${
                    selectedHistoryCall?.id === c.id
                      ? "border-forgeBlue bg-blue-50/20"
                      : "bg-gray-50/50 hover:bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-gray-700 text-xs">{c.lead_id}</span>
                    <span className="text-[9px] text-gray-400 font-bold">{new Date(c.started_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold">
                    <span className="capitalize">{c.direction} · {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</span>
                    <span className="bg-blue-50 border border-blue-200 text-forgeBlue px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">
                      {c.outcome}
                    </span>
                  </div>
                </div>
              ))}
              {agentCallHistory.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-12 font-medium">No calls logged today.</p>
              )}
            </div>
          </div>

        </div>

        {/* Audit Call Details Modal */}
        {selectedHistoryCall && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl animate-scale-in border border-gray-100 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <div>
                  <h3 className="font-black text-gray-800 text-lg">Call Log Profile</h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">Call ID: {selectedHistoryCall.id}</p>
                </div>
                <button onClick={() => setSelectedHistoryCall(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-sm text-gray-600">
                {/* Simulated Audio Player */}
                <div className="bg-slate-50 border p-4 rounded-2xl flex items-center gap-3">
                  <button
                    onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                    className="p-2 bg-forgeBlue text-white hover:bg-blue-800 rounded-full transition"
                  >
                    {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden relative">
                    <div
                      className="bg-forgeBlue h-full rounded-full transition-all duration-300"
                      style={{ width: `${audioProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono font-bold">RECORDING</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b pb-4 text-xs font-semibold">
                  <div>Direction: <strong className="text-gray-800 capitalize">{selectedHistoryCall.direction}</strong></div>
                  <div>Duration: <strong className="text-gray-800">{Math.floor(selectedHistoryCall.duration_seconds / 60)}m {selectedHistoryCall.duration_seconds % 60}s</strong></div>
                  <div>Outcome: <strong className="text-forgeBlue capitalize">{selectedHistoryCall.outcome}</strong></div>
                  <div>Started At: <strong className="text-gray-800">{new Date(selectedHistoryCall.started_at).toLocaleString()}</strong></div>
                </div>

                {/* AI Evaluation info if exists */}
                {selectedHistoryCall.quality_evaluation && (
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center border-b pb-1 text-xs">
                      <span className="font-extrabold text-emerald-800">Supervisor Evaluation</span>
                      <span className="font-extrabold text-forgeBlue">Quality: {selectedHistoryCall.quality_evaluation.ai_quality_score}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold italic">"{selectedHistoryCall.quality_evaluation.coaching_notes}"</p>
                  </div>
                )}

                {/* AI summary */}
                <div>
                  <h4 className="font-bold text-gray-800 text-xs mb-1 uppercase tracking-wider">AI Summary</h4>
                  <div className="bg-slate-50 border p-3 rounded-xl text-xs font-semibold text-gray-500 leading-relaxed">
                    {selectedHistoryCall.ai_summary || "No AI Summary recorded."}
                  </div>
                </div>

                {/* Transcript */}
                <div>
                  <h4 className="font-bold text-gray-800 text-xs mb-1 uppercase tracking-wider">Transcription</h4>
                  <div className="bg-slate-50 border p-3 rounded-xl text-xs font-mono text-gray-500 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {selectedHistoryCall.transcript || "No speech transcript recorded."}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t mt-4">
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Card & Live updates alert */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            Welcome, {user?.name || "User"}
          </h1>
          <p className="text-sm text-gray-500 font-medium capitalize mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
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
                <span>Status: <span className="font-bold text-green-600">Active</span></span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-green-500 animate-pulse" />
            <span>Live updates enabled</span>
          </span>
          <button
            onClick={fetchDashboardData}
            className="ml-2 bg-forgeBlue hover:bg-blue-800 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {summary ? (
        <>
          {/* Main Counters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {user?.role === "team_leader" ? (
              <>
                <StatCard
                  label="Assigned Agents"
                  value={summary.total_agents}
                  accent="#0B4EA2"
                  icon={<Users className="h-6 w-6 text-forgeBlue" />}
                  subtext="Total members in team"
                />
                <StatCard
                  label="Active Agents"
                  value={summary.active_agents || 0}
                  accent="#22c55e"
                  icon={<UserCheck className="h-6 w-6 text-green-500" />}
                  subtext="Online / busy / break"
                />
                <StatCard
                  label="Total Leads"
                  value={summary.total_leads}
                  accent="#ec4899"
                  icon={<Target className="h-6 w-6 text-pink-500" />}
                  subtext="Assigned leads inventory"
                />
                <StatCard
                  label="Active Campaigns"
                  value={summary.total_campaigns}
                  accent="#a855f7"
                  icon={<Megaphone className="h-6 w-6 text-purple-500" />}
                  subtext="Campaigns running"
                />
                <StatCard
                  label="Live Calls"
                  value={summary.active_calls}
                  accent="#06b6d4"
                  icon={<Zap className="h-6 w-6 text-cyan-500" />}
                  subtext="Live audio channels"
                />
                <StatCard
                  label="Today's Calls"
                  value={summary.today_calls}
                  accent="#3b82f6"
                  icon={<TrendingUp className="h-6 w-6 text-blue-500" />}
                  subtext="Calls dialed today"
                />
                <StatCard
                  label="Today's Follow-ups"
                  value={summary.today_followups || 0}
                  accent="#FFC72C"
                  icon={<Calendar className="h-6 w-6 text-amber-500" />}
                  subtext="Callbacks today"
                />
                <StatCard
                  label="Today's Conversions"
                  value={summary.today_conversions || 0}
                  accent="#10b981"
                  icon={<Download className="h-6 w-6 text-emerald-500" />}
                  subtext="Qualified leads count"
                />
                <StatCard
                  label="Call Success Rate"
                  value={`${summary.success_rate}%`}
                  accent="#22c55e"
                  icon={<CheckCircle className="h-6 w-6 text-green-600" />}
                  subtext="Answered calls ratio"
                />
                <StatCard
                  label="Team Performance"
                  value={`${summary.team_performance || 0}%`}
                  accent="#FFC72C"
                  icon={<Star className="h-6 w-6 text-amber-500" />}
                  subtext="Overall team efficiency"
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Total Pools"
                  value={summary.total_pools}
                  accent="#0B4EA2"
                  icon={<Folder className="h-6 w-6 text-forgeBlue" />}
                  subtext="Hiring & Sales divisions"
                />
                <StatCard
                  label="Supervisors"
                  value={summary.total_supervisors}
                  accent="#FFC72C"
                  icon={<UserCheck className="h-6 w-6 text-amber-500" />}
                  subtext="Managing agents & leads"
                />
                <StatCard
                  label="Agents"
                  value={summary.total_agents}
                  accent="#22c55e"
                  icon={<Users className="h-6 w-6 text-green-500" />}
                  subtext="Active call team members"
                />
                <StatCard
                  label="Campaigns"
                  value={summary.total_campaigns}
                  accent="#a855f7"
                  icon={<Megaphone className="h-6 w-6 text-purple-500" />}
                  subtext="Dialer campaigns setup"
                />
                <StatCard
                  label="Total Leads"
                  value={summary.total_leads}
                  accent="#ec4899"
                  icon={<Target className="h-6 w-6 text-pink-500" />}
                  subtext="All imported target leads"
                />
                <StatCard
                  label="Active Calls"
                  value={summary.active_calls}
                  accent="#06b6d4"
                  icon={<Zap className="h-6 w-6 text-cyan-500" />}
                  subtext="Current ongoing connections"
                />
                <StatCard
                  label="Today's Calls"
                  value={summary.today_calls}
                  accent="#3b82f6"
                  icon={<TrendingUp className="h-6 w-6 text-blue-500" />}
                  subtext="Calls made since midnight"
                />
                <StatCard
                  label="Today's Imports"
                  value={summary.today_imports}
                  accent="#10b981"
                  icon={<Download className="h-6 w-6 text-emerald-500" />}
                  subtext="New leads stored today"
                />
                <StatCard
                  label="Call Success Rate"
                  value={`${summary.success_rate}%`}
                  accent="#22c55e"
                  icon={<CheckCircle className="h-6 w-6 text-green-600" />}
                  subtext="Answered calls ratio"
                />
                <StatCard
                  label="Conversion Rate"
                  value={`${summary.conversion_rate}%`}
                  accent="#FFC72C"
                  icon={<Star className="h-6 w-6 text-amber-500" />}
                  subtext="Leads qualified ratio"
                />
              </>
            )}
          </div>

          {/* System Health, Live Monitoring, and Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: System Health & Statuses */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="font-black text-gray-800 text-lg mb-4 flex items-center gap-2">
                  <Server className="h-5 w-5 text-forgeBlue" />
                  <span>System Status & Health</span>
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Database className="h-4 w-4 text-gray-400" />
                      <span>Local MongoDB Status</span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        summary.system_health.mongodb === "connected"
                          ? "bg-green-50 border border-green-200 text-green-700"
                          : "bg-red-50 border border-red-200 text-red-700"
                      }`}
                    >
                      {summary.system_health.mongodb.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-400" />
                      <span>CRM API Connection</span>
                    </span>
                    <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-[10px] font-bold">
                      {summary.system_health.api.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span>Queue Status</span>
                    </span>
                    <div className="text-right">
                      <span className="block text-sm font-bold text-gray-800">
                        {summary.queue_status.waiting_leads} waiting
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">
                        {summary.queue_status.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-gray-400" />
                      <span>AI Agent Calling Engine</span>
                    </span>
                    <div className="text-right">
                      <span className="block text-sm font-bold text-gray-800">
                        {summary.ai_agent_status.active_channels} channels
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">
                        {summary.ai_agent_status.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-gray-100 text-xs text-gray-500 font-semibold flex items-start gap-2">
                <Lock className="h-4 w-4 text-forgeBlue flex-shrink-0 mt-0.5" />
                <span>All API routes are protected by JWT, inputs are sanitized against SQL/NoSQL injections, and passwords hashed with bcrypt context.</span>
              </div>
            </div>

            {/* Column 2: Live Call Monitoring */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="font-bold text-gray-800 text-lg mb-4 flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-forgeBlue" />
                  <span>Active Live Call Monitoring</span>
                </span>
                <span className="bg-cyan-100 text-cyan-800 text-xs font-black px-2.5 py-1 rounded-full uppercase">
                  {liveCallsList.length} Call(s) Live
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Lead ID</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveCallsList.map((call) => (
                      <tr key={call.id} className="border-t hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-forgeBlue">{call.lead_id}</td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{call.agent_id}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 border text-slate-700 capitalize font-medium">
                            {call.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            onClick={() => handleMonitor(call.id, "listen")}
                            className="bg-forgeBlue text-white text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-800 transition flex items-center gap-1 inline-flex"
                          >
                            <Headphones className="h-3.5 w-3.5" />
                            <span>Listen</span>
                          </button>
                          <button
                            onClick={() => handleMonitor(call.id, "whisper")}
                            className="bg-[#22c55e] text-white text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-green-600 transition flex items-center gap-1 inline-flex"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Whisper</span>
                          </button>
                          <button
                            onClick={() => handleMonitor(call.id, "barge")}
                            className="bg-[#ef4444] text-white text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-red-600 transition flex items-center gap-1 inline-flex"
                          >
                            <Mic className="h-3.5 w-3.5" />
                            <span>Barge</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {liveCallsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 font-medium">
                          No active voice calls currently in progress.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Row 2: Recent Security & Configuration Activities */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-3">
              <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-forgeBlue" />
                <span>Recent Audit Trails & Activity Logs</span>
              </h3>
              <div className="overflow-y-auto max-h-80 space-y-3">
                {activities.map((log) => (
                  <div key={log.id} className="flex justify-between items-start p-3 bg-gray-50 hover:bg-gray-100/50 rounded-xl transition border border-gray-100">
                    <div>
                      <span className="font-bold text-gray-700 text-sm">
                        {log.actor_name}
                      </span>{" "}
                      <span className="text-[9px] text-gray-500 font-extrabold bg-gray-200/60 px-2 py-0.5 rounded-md uppercase font-mono tracking-wider ml-1 border">
                        {log.action.replace("_", " ")}
                      </span>
                      {log.target_employee_id && (
                        <p className="text-[11px] text-gray-400 font-semibold mt-1">
                          Target Employee ID: {log.target_employee_id}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-gray-400 text-center py-6 text-sm font-semibold">No recent operations logged.</p>
                )}
              </div>
            </div>

          </div>
        </>
      ) : null}
    </div>
  );
}
