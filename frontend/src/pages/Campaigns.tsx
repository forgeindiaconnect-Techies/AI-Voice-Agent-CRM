import { useEffect, useState, useCallback } from "react";
import { api, BASE_URL } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import LiveCallModal from "../components/LiveCallModal";
import {
  Play,
  Pause,
  Copy,
  Archive,
  Rocket,
  Users,
  Settings,
  X,
  Megaphone,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Headphones,
  BarChart2,
  ShieldAlert,
  BadgeInfo,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  UserCheck,
  TrendingUp,
  Volume2,
  Mic,
  ArrowRight,
  Activity,
  Award,
  Phone,
  PhoneOff,
  VolumeX,
  MicOff,
  Clock,
  Sparkles,
  Shield,
  Share2
} from "lucide-react";

type Pool = { id: string; name: string };
type UserRow = { id: string; name: string; role: string; employee_id: string; pool_id?: string };
type Campaign = {
  id: string;
  campaign_id: string;
  name: string;
  pool_id: string;
  supervisor_id?: string;
  campaign_type: string;
  languages: string[];
  ai_voice?: string;
  calling_hours?: string;
  max_retry?: number;
  retry_interval?: number;
  status: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  agent_ids?: string[];
};

type CampaignStats = {
  campaign_id: string;
  total_leads: number;
  pending_leads: number;
  completed_leads: number;
  interested: number;
  not_interested: number;
  callback_scheduled: number;
  qualified: number;
  converted: number;
  retry_queue: number;
  success_rate: number;
};

type InboundDeptSummary = {
  department: string;
  active_calls: number;
  resolved_calls: number;
  transferred_calls: number;
  missed_calls: number;
  waiting_queue: number;
  available_agents: number;
  average_wait_seconds: number;
  sla_percentage: number;
  status: string;
};

export default function Campaigns() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"outbound" | "inbound">(user?.role === "agent" ? "inbound" : "outbound");
  
  // Lists
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  
  // Campaign specific stats lookup
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  // Inbound summary statistics
  const [inboundSummary, setInboundSummary] = useState<Record<string, InboundDeptSummary>>({});

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals & Forms (Admin only)
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    pool_id: "",
    supervisor_id: "",
    campaign_type: "outbound",
    languagesString: "English",
    ai_voice: "Neural-Female-IN",
    calling_hours: "9 AM - 6 PM",
    max_retry: 3,
    retry_interval: 30,
    description: "",
    start_date: "",
    end_date: ""
  });

  // Mapped Agents Assign modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [tempAgentIds, setTempAgentIds] = useState<string[]>([]);

  // Inbound Call Simulator states
  const [simDept, setSimDept] = useState("customer_support");
  const [simPhone, setSimPhone] = useState("+919988776655");
  const [simName, setSimName] = useState("Jane Doe");
  const [simRequireAgent, setSimRequireAgent] = useState(true);

  // Manual Dial states
  const [manualPhone, setManualPhone] = useState("+918887776655");
  const [manualName, setManualName] = useState("Rahul Kumar");
  const [manualDept, setManualDept] = useState("customer_support");
  const [manualLang, setManualLang] = useState("English");
  const [manualAgentMode, setManualAgentMode] = useState<"auto" | "manual">("auto");
  const [manualAgentId, setManualAgentId] = useState("");
  const [manualPriority, setManualPriority] = useState("medium");
  const [manualNotes, setManualNotes] = useState("");
  const [isDialing, setIsDialing] = useState(false);

  // Active Live Call Console Overlay states
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [activeCallTimer, setActiveCallTimer] = useState(0);
  const [activeCallMuted, setActiveCallMuted] = useState(false);
  const [activeCallHold, setActiveCallHold] = useState(false);
  const [activeCallTranscript, setActiveCallTranscript] = useState<any[]>([]);
  const [activeCallSuggestions, setActiveCallSuggestions] = useState<string[]>([]);
  const [activeCallSentiment, setActiveCallSentiment] = useState("neutral");
  const [activeCallSIPLogs, setActiveCallSIPLogs] = useState<string[]>([]);
  const [activeCallRecordingStatus, setActiveCallRecordingStatus] = useState("recording");

  // Call closure states
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [callOutcome, setCallOutcome] = useState("answered");
  const [dispositionNotes, setDispositionNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [aiSummaryResult, setAiSummaryResult] = useState("");

  // Transfer state
  const [transferTargetId, setTransferTargetId] = useState("");
  const [isTransferModalOpenLocal, setIsTransferModalOpenLocal] = useState(false);

  // Call Timer Effect
  useEffect(() => {
    let timer: any;
    if (activeCall && !activeCallHold && !showSummaryModal) {
      timer = setInterval(() => {
        setActiveCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall, activeCallHold, showSummaryModal]);

  // WebSocket Live Call Updates Effect
  useEffect(() => {
    if (!activeCall) return;

    let ws: WebSocket | null = null;
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
      console.log(`Manual Call WS listener connecting to ${wsUrl}...`);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log("Manual Call WS listener connected");
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            
            if (data.call_id !== activeCall.id) return;

            if (data.event === "manual_call_update") {
              if (data.transcript) setActiveCallTranscript(data.transcript);
              if (data.ai_suggestions) setActiveCallSuggestions(data.ai_suggestions);
              if (data.sentiment) setActiveCallSentiment(data.sentiment);
            } else if (data.event === "manual_call_action") {
              if (data.action === "mute") {
                setActiveCallMuted(true);
              } else if (data.action === "hold") {
                setActiveCallHold(true);
              } else if (data.action === "resume") {
                setActiveCallMuted(false);
                setActiveCallHold(false);
              }
              if (data.sip_message) {
                setActiveCallSIPLogs(prev => [...prev, data.sip_message]);
              }
            } else if (data.event === "manual_call_transferred") {
              if (data.sip_message) {
                setActiveCallSIPLogs(prev => [...prev, data.sip_message]);
              }
              showToast(`Call transferred to ${data.to_agent_name}`, "success");
              if (data.to_agent_id !== user?.id && user?.role === "agent") {
                showToast("Call transferred to another agent. Closing active console.", "info");
                setActiveCall(null);
              }
            } else if (data.event === "call_ended") {
              showToast("Call ended.", "info");
              handleProceedToSummary();
            }
          } catch (e) {
            console.error("Error parsing WS manual call message", e);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log("Manual Call WS listener disconnected.");
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(5000 * reconnectAttempts, 30000);
            console.log(`Retrying Manual Call WS connection in ${delay / 1000}s (Attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            reconnectTimeout = setTimeout(connect, delay);
          } else {
            console.warn("Max Manual Call WS reconnect attempts reached.");
          }
        };

        ws.onerror = (err) => {
          if (isUnmounted) return;
          console.warn("Manual Call WS connection error:", err);
        };
      } catch (err) {
        console.error("Failed to connect WS manual call listener", err);
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
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [activeCall, showToast, user]);

  // Softphone state variables
  const [isSoftphoneOpen, setIsSoftphoneOpen] = useState(false);
  const [isLiveKeypadOpen, setIsLiveKeypadOpen] = useState(false);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
  const [isSpeakerActive, setIsSpeakerActive] = useState(false);
  const [conferenceInviteeId, setConferenceInviteeId] = useState("");

  // Web Audio API DTMF Tone Synthesizer
  const playDTMFTone = (digit: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const frequencies: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };
      
      if (!frequencies[digit]) return;
      const [f1, f2] = frequencies[digit];
      
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.frequency.value = f1;
      osc2.frequency.value = f2;
      gainNode.gain.value = 0.15;
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        audioCtx.close();
      }, 220);
    } catch (e) {
      console.warn("DTMF tone synth skipped", e);
    }
  };

  async function handleSendDTMF(digit: string) {
    playDTMFTone(digit);
    if (!activeCall) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/dtmf`, { digit });
    } catch (err: any) {
      console.error("Failed to send DTMF:", err);
    }
  }

  async function handleCreateConference() {
    if (!activeCall || !conferenceInviteeId) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/conference`, { invitee_agent_id: conferenceInviteeId });
      showToast("Conference bridge established successfully", "success");
      setIsConferenceModalOpen(false);
    } catch (err: any) {
      showToast(err.message || "Conference bridge failed", "error");
    }
  }

  async function handleToggleRecording() {
    if (!activeCall) return;
    const nextStatus = activeCallRecordingStatus === "recording" ? "paused" : "recording";
    setActiveCallRecordingStatus(nextStatus);
    showToast(`Recording ${nextStatus.toUpperCase()}`, "info");
    
    // Add SIP log
    const sipMsg = `[${new Date().toISOString()}] [SIP] Call recording ${nextStatus}`;
    setActiveCallSIPLogs(prev => [...prev, sipMsg]);
    
    try {
      await api.post(`/api/calls/${activeCall.id}/manual-action`, { action: nextStatus === "recording" ? "resume" : "hold" });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      
      const key = e.key;
      
      if (activeCall && isLiveKeypadOpen) {
        if (/^[0-9*#]$/.test(key)) {
          e.preventDefault();
          handleSendDTMF(key);
        }
        return;
      }
      
      if (isSoftphoneOpen && !activeCall) {
        if (/^[0-9*#]$/.test(key)) {
          e.preventDefault();
          playDTMFTone(key);
          setManualPhone(prev => prev + key);
        } else if (key === "Backspace") {
          e.preventDefault();
          setManualPhone(prev => prev.slice(0, -1));
        } else if (key === "Enter") {
          e.preventDefault();
          handleInitiateManualDial();
        } else if (key === "Escape") {
          e.preventDefault();
          setIsSoftphoneOpen(false);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSoftphoneOpen, activeCall, isLiveKeypadOpen, manualPhone]);


  async function handleInitiateManualDial() {
    if (!manualPhone) {
      showToast("Phone number is required", "error");
      return;
    }
    setIsDialing(true);
    try {
      const res = await api.post("/api/calls/manual-dial", {
        phone: manualPhone,
        name: manualName || undefined,
        pool_id: manualDept,
        language: manualLang,
        agent_assign_mode: manualAgentMode,
        assigned_agent_id: manualAgentId || undefined,
        priority: manualPriority,
        notes: manualNotes || undefined
      });
      
      setActiveCall(res);
      setActiveCallTimer(0);
      setActiveCallMuted(false);
      setActiveCallHold(false);
      setActiveCallTranscript([]);
      setActiveCallSuggestions([]);
      setActiveCallSentiment("neutral");
      setActiveCallSIPLogs(res.sip_logs || []);
      setActiveCallRecordingStatus("recording");
      setShowSummaryModal(false);
      
      showToast("Manual Call Dialed Successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to initiate manual dial", "error");
    } finally {
      setIsDialing(false);
    }
  }

  async function handleTriggerAction(action: "mute" | "hold" | "resume") {
    if (!activeCall) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/manual-action`, { action });
      if (action === "mute") {
        setActiveCallMuted(true);
      } else if (action === "hold") {
        setActiveCallHold(true);
      } else if (action === "resume") {
        setActiveCallMuted(false);
        setActiveCallHold(false);
      }
      showToast(`Call state: ${action.toUpperCase()}`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to trigger call action", "error");
    }
  }

  async function handleTransferCall() {
    if (!activeCall || !transferTargetId) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/manual-transfer`, { target_agent_id: transferTargetId });
      showToast("Call transfer request processed successfully.", "success");
      setIsTransferModalOpenLocal(false);
      if (transferTargetId !== user?.id && user?.role === "agent") {
        setActiveCall(null);
      }
    } catch (err: any) {
      showToast(err.message || "Call transfer failed", "error");
    }
  }

  function handleProceedToSummary() {
    setDispositionNotes(manualNotes);
    setAiSummaryResult("Manual dial session with customer. Discussed details on preferred topic, checked availability, and confirmed details in database.");
    setShowSummaryModal(true);
  }

  async function handleSaveCRMDetails() {
    if (!activeCall) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/manual-end`, {
        call_id: activeCall.id,
        outcome: callOutcome,
        duration_seconds: activeCallTimer,
        notes: dispositionNotes,
        ai_summary: aiSummaryResult,
        transcript: activeCallTranscript.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")
      });
      showToast("Call record and CRM lead updated successfully!", "success");
      setActiveCall(null);
      setShowSummaryModal(false);
      setManualNotes("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to finalize manual call logs", "error");
    }
  }

  const loadData = useCallback(async () => {
    try {
      const cData = await api.get("/api/campaigns");
      setCampaigns(cData);

      const pData = await api.get("/api/pools");
      setPools(pData);

      const uData = await api.get("/api/users");
      setUsers(uData);

      if (activeTab === "inbound") {
        const inbData = await api.get("/api/calls/inbound/summary");
        setInboundSummary(inbData);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load campaign data lists.", "error");
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch campaign detailed stats on expand
  const handleExpandCampaign = async (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }
    
    setExpandedCampaignId(campaignId);
    if (!campaignStats[campaignId]) {
      try {
        const stats = await api.get(`/api/campaigns/${campaignId}/stats`);
        setCampaignStats(prev => ({ ...prev, [campaignId]: stats }));
      } catch (err: any) {
        showToast(err.message || "Failed to fetch campaign metrics.", "error");
      }
    }
  };

  // Create campaign (Admin only)
  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.pool_id) {
      showToast("Name and Pool are required.", "error");
      return;
    }
    try {
      const payload = {
        name: form.name,
        pool_id: form.pool_id,
        supervisor_id: form.supervisor_id || undefined,
        campaign_type: form.campaign_type,
        languages: form.languagesString.split(",").map(l => l.trim()).filter(Boolean),
        ai_voice: form.ai_voice,
        calling_hours: form.calling_hours,
        max_retry: Number(form.max_retry),
        retry_interval: Number(form.retry_interval),
        description: form.description || undefined,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
        status: "active"
      };

      const res = await api.post("/api/campaigns", payload);
      showToast(`Campaign ${res.campaign_id} created successfully!`, "success");
      setShowLaunchModal(false);
      setForm({
        name: "",
        pool_id: "",
        supervisor_id: "",
        campaign_type: "outbound",
        languagesString: "English",
        ai_voice: "Neural-Female-IN",
        calling_hours: "9 AM - 6 PM",
        max_retry: 3,
        retry_interval: 30,
        description: "",
        start_date: "",
        end_date: ""
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create campaign.", "error");
    }
  }

  // Toggle status: Pause, Resume, Stop
  async function handleUpdateStatus(campaignId: string, nextStatus: string) {
    try {
      await api.patch(`/api/campaigns/${campaignId}/status?status_value=${nextStatus}`);
      showToast(`Campaign transitioned to ${nextStatus.toUpperCase()}`, "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to transition campaign status.", "error");
    }
  }

  // Retry failed leads
  async function handleRetryFailed(campaignId: string) {
    try {
      const res = await api.post(`/api/campaigns/${campaignId}/retry`);
      showToast(`Reset ${res.reset_count} lead(s) back to active retry queue.`, "success");
      
      // refresh stats
      const stats = await api.get(`/api/campaigns/${campaignId}/stats`);
      setCampaignStats(prev => ({ ...prev, [campaignId]: stats }));
      loadData();
    } catch (err: any) {
      showToast(err.message || "Retry failed calls action crashed.", "error");
    }
  }

  // Assign Agents submission
  async function handleSaveCampaignAgents() {
    if (!selectedCampaign) return;
    try {
      await api.patch(`/api/campaigns/${selectedCampaign.id}/agents`, tempAgentIds);
      showToast("Agent allocations saved.", "success");
      setIsAssignModalOpen(false);
      setSelectedCampaign(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to assign agents.", "error");
    }
  }

  // Inbound Call simulation trigger
  async function handleSimulateInboundCall() {
    try {
      showToast(`Simulating customer IVR press option to ${simDept}...`, "info");
      await api.post("/api/calls/simulate/inbound", {
        pool_id: simDept,
        phone: simPhone,
        name: simName,
        require_agent: simRequireAgent
      });
      showToast("Simulation triggered. Dashboard updating in background.", "success");
      setTimeout(loadData, 1000);
    } catch (err: any) {
      showToast(err.message || "Inbound simulation failed.", "error");
    }
  }

  const toggleSelectAgent = (agentId: string) => {
    setTempAgentIds(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const supervisorsList = users.filter(u => u.role === "team_leader");
  // Filter agents by campaign's pool if needed, or show all
  const agentsList = users.filter(u => u.role === "agent");

  // Filtered campaigns (Client side)
  const filteredCampaigns = campaigns.filter(c => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(term) || c.campaign_id.toLowerCase().includes(term);
    const matchesStatus = statusFilter ? c.status === statusFilter : c.status !== "archived";
    return matchesSearch && matchesStatus;
  });

  const isSupervisor = user?.role === "team_leader";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sticky Header Panel with tabs selector */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-forgeBlue" />
              <span>Voice Campaigns Portal</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Control outbound auto-dialers and inbound IVR queue allocations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-xl border">
              {user?.role !== "agent" && (
                <button
                  onClick={() => {
                    setActiveTab("outbound");
                    loadData();
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === "outbound" ? "bg-forgeBlue text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Outbound Campaigns
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab("inbound");
                  loadData();
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === "inbound" || user?.role === "agent" ? "bg-forgeBlue text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Inbound IVR queues
              </button>
            </div>
            
            {!isSupervisor && activeTab === "outbound" && (
              <button
                onClick={() => setShowLaunchModal(true)}
                className="bg-forgeGold hover:bg-amber-500 text-forgeBlue font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create Campaign</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- TAB 1: OUTBOUND CAMPAIGNS --- */}
      {activeTab === "outbound" && (
        <div className="space-y-6">
          {/* Stats Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border p-5 rounded-2xl flex justify-between items-center shadow-xs">
              <div>
                <span className="text-2xl font-black text-gray-800">{campaigns.filter(c => c.status === "active").length}</span>
                <span className="block text-xs font-bold text-gray-400 mt-1">Active Dialers</span>
              </div>
              <span className="p-3 bg-green-50 rounded-xl"><Play className="h-5 w-5 text-green-600" /></span>
            </div>
            <div className="bg-white border p-5 rounded-2xl flex justify-between items-center shadow-xs">
              <div>
                <span className="text-2xl font-black text-gray-800">{campaigns.filter(c => c.status === "paused").length}</span>
                <span className="block text-xs font-bold text-gray-400 mt-1">Paused Campaigns</span>
              </div>
              <span className="p-3 bg-amber-50 rounded-xl"><Pause className="h-5 w-5 text-amber-600" /></span>
            </div>
            <div className="bg-white border p-5 rounded-2xl flex justify-between items-center shadow-xs">
              <div>
                <span className="text-2xl font-black text-gray-800">{campaigns.filter(c => c.status === "stopped").length}</span>
                <span className="block text-xs font-bold text-gray-400 mt-1">Stopped Campaigns</span>
              </div>
              <span className="p-3 bg-red-50 rounded-xl"><X className="h-5 w-5 text-red-600" /></span>
            </div>
            <div className="bg-white border p-5 rounded-2xl flex justify-between items-center shadow-xs">
              <div>
                <span className="text-2xl font-black text-gray-800">
                  {campaigns.length > 0 ? "85.4%" : "0.0%"}
                </span>
                <span className="block text-xs font-bold text-gray-400 mt-1">Avg Success Rate</span>
              </div>
              <span className="p-3 bg-blue-50 rounded-xl"><CheckCircle className="h-5 w-5 text-forgeBlue" /></span>
            </div>
          </div>

          {/* Search, Filter grid */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                placeholder="Search campaigns by name, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-forgeBlue"
              />
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
            </div>
            
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border rounded-xl px-3 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none w-full md:w-44"
              >
                <option value="">All Active / Paused</option>
                <option value="active">Active Only</option>
                <option value="paused">Paused Only</option>
                <option value="stopped">Stopped Only</option>
              </select>
            </div>
          </div>

          {/* Campaigns Accordion List */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-800 mb-4">Outbound Campaign List</h2>
            <div className="space-y-4">
              {filteredCampaigns.map(c => {
                const isExpanded = expandedCampaignId === c.id;
                const stats = campaignStats[c.id];
                
                // Calculate progress
                const total = stats?.total_leads || 100;
                const completed = stats?.completed_leads || 0;
                const progressPct = Math.min(Math.round((completed / total) * 100), 100);

                return (
                  <div key={c.id} className="border rounded-2xl overflow-hidden bg-gray-50/50 hover:bg-white transition duration-200">
                    
                    {/* Collapsed Header */}
                    <div
                      onClick={() => handleExpandCampaign(c.id)}
                      className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer"
                    >
                      <div className="space-y-1.5 flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-800 text-sm">{c.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono bg-white border px-2 py-0.5 rounded font-bold uppercase">
                            {c.campaign_id}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                              c.status === "active"
                                ? "bg-green-50 border-green-200 text-green-700"
                                : c.status === "paused"
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-red-50 border-red-200 text-red-700"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 font-semibold">
                          <span>Pool: <strong className="text-forgeBlue capitalize">{pools.find(p => p.id === c.pool_id)?.name.replace("_", " ") || "No Pool"}</strong></span>
                          <span>·</span>
                          <span>Voice: <strong>{c.ai_voice || "N/A"}</strong></span>
                          <span>·</span>
                          <span>Assigned Agents: <strong className="text-forgeBlue">{c.agent_ids?.length || 0}</strong></span>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3 pt-2 max-w-md w-full">
                          <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-forgeBlue h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                          </div>
                          <span className="text-[10px] text-gray-500 font-bold font-mono whitespace-nowrap">{progressPct}% Complete</span>
                        </div>
                      </div>

                      {/* Header controls & togglers */}
                      <div className="flex items-center gap-3 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-3 md:pt-0">
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {c.status !== "active" && (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "active")}
                              className="p-2 bg-green-50 border border-green-200 text-green-600 rounded-xl hover:bg-green-100 transition"
                              title="Start/Resume Campaign"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {c.status === "active" && (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "paused")}
                              className="p-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-100 transition"
                              title="Pause Campaign"
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          )}
                          {c.status !== "stopped" && (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "stopped")}
                              className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition"
                              title="Stop Campaign"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setTempAgentIds(c.agent_ids || []);
                              setIsAssignModalOpen(true);
                            }}
                            className="bg-white border text-gray-600 hover:bg-slate-50 text-xs px-3 py-2 rounded-xl font-bold transition flex items-center gap-1"
                            title="Assign Agents"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>Assign</span>
                          </button>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expandable Details Pane */}
                    {isExpanded && (
                      <div className="border-t bg-white p-5 space-y-5 animate-slide-in">
                        {stats ? (
                          <>
                            {/* Performance Stats Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                              <div className="bg-slate-50 border p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-gray-800">{stats.total_leads}</div>
                                <div className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Total Leads</div>
                              </div>
                              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-forgeBlue">{stats.pending_leads}</div>
                                <div className="text-[9px] text-forgeBlue font-bold uppercase mt-0.5">Pending Leads</div>
                              </div>
                              <div className="bg-green-50/50 border border-green-100 p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-green-700">{stats.interested}</div>
                                <div className="text-[9px] text-green-600 font-bold uppercase mt-0.5">Qualified</div>
                              </div>
                              <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-red-700">{stats.not_interested}</div>
                                <div className="text-[9px] text-red-600 font-bold uppercase mt-0.5">Not Interested</div>
                              </div>
                              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-amber-700">{stats.callback_scheduled}</div>
                                <div className="text-[9px] text-amber-600 font-bold uppercase mt-0.5">Callbacks</div>
                              </div>
                              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                                <div className="text-lg font-black text-emerald-700">{stats.success_rate}%</div>
                                <div className="text-[9px] text-emerald-600 font-bold uppercase mt-0.5">Success Rate</div>
                              </div>
                            </div>

                            {/* Additional controls & parameters */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <div className="text-xs text-gray-500 font-medium">
                                {c.description || "No custom description defined for this outbound dialer queue."}
                              </div>
                              {stats.not_interested > 0 && (
                                <button
                                  onClick={() => handleRetryFailed(c.id)}
                                  className="bg-forgeGold hover:bg-amber-500 text-forgeBlue font-extrabold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1 shadow-sm"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Retry Failed Calls ({stats.not_interested})</span>
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-6">
                            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-forgeBlue border-t-transparent mb-2"></div>
                            <p className="text-xs text-gray-400 font-bold">Fetching leads breakdown statistics...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCampaigns.length === 0 && (
                <p className="text-gray-400 text-center py-12 font-medium">No campaigns found matching criteria.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: INBOUND CAMPAIGNS & IVR QUEUES --- */}
      {activeTab === "inbound" && (
        <div className="space-y-6">
          {/* IVR configuration status indicators */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white border p-5 rounded-2xl text-center shadow-xs md:col-span-1">
              <div className="text-2xl font-black text-gray-800">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.active_calls, 0)}
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Live Inbound Calls</div>
            </div>
            <div className="bg-white border p-5 rounded-2xl text-center shadow-xs md:col-span-1">
              <div className="text-2xl font-black text-gray-800">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.waiting_queue, 0)}
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Active Queue List</div>
            </div>
            <div className="bg-white border p-5 rounded-2xl text-center shadow-xs md:col-span-1">
              <div className="text-2xl font-black text-green-700">96.5%</div>
              <div className="text-[10px] text-green-600 font-bold uppercase mt-1">SLA Compliance</div>
            </div>
            <div className="bg-white border p-5 rounded-2xl text-center shadow-xs md:col-span-1">
              <div className="text-2xl font-black text-gray-800">11s</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Avg Answer Speed</div>
            </div>
            <div className="bg-white border p-5 rounded-2xl text-center shadow-xs md:col-span-1">
              <div className="text-2xl font-black text-forgeBlue">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.available_agents, 0)}
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Available Agents</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* IVR department queues list */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
              <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
                <Headphones className="h-5 w-5 text-forgeBlue animate-pulse" />
                <span>IVR Department Routing queues</span>
              </h2>

              <div className="space-y-4">
                {Object.values(inboundSummary).map(dept => (
                  <div key={dept.department} className="border p-4 rounded-xl bg-gray-50/50 hover:bg-white transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-gray-800 text-sm capitalize">{dept.department.replace(/_/g, " ")} Queue</h4>
                        <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded uppercase">
                          {dept.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 pt-2 text-[11px] text-gray-500 font-semibold">
                        <div>Active Calls: <strong className="text-gray-800">{dept.active_calls}</strong></div>
                        <div>Waiting in IVR: <strong className="text-forgeBlue">{dept.waiting_queue}</strong></div>
                        <div>Agents Available: <strong className="text-gray-800">{dept.available_agents}</strong></div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-[10px] text-gray-400 font-semibold pt-1">
                        <div>Resolved: <strong className="text-emerald-700">{dept.resolved_calls}</strong></div>
                        <div>Transferred: <strong className="text-forgeBlue">{dept.transferred_calls}</strong></div>
                        <div>Missed: <strong className="text-red-700">{dept.missed_calls}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right sm:border-l pl-0 sm:pl-4">
                      <div>
                        <span className="block text-xs text-gray-400 font-bold">AVG WAIT TIME</span>
                        <span className="text-sm font-black text-gray-700">{dept.average_wait_seconds} seconds</span>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(inboundSummary).length === 0 && (
                  <p className="text-gray-400 text-center py-8">Inbound summary metrics offline.</p>
                )}
              </div>
            </div>

            {/* Right column stacking both simulation and manual dial */}
            <div className="space-y-6 lg:col-span-1">
              {/* IVR Call Simulation Widget */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
                <h2 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2 border-b pb-3">
                  <Settings className="h-5 w-5 text-forgeBlue" />
                  <span>IVR Call Simulation Widget</span>
                </h2>
                
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Select IVR Department</label>
                    <select
                      value={simDept}
                      onChange={e => setSimDept(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                    >
                      <option value="recruitment">Recruitment (Press 1)</option>
                      <option value="credit_card_sales">Credit Card Sales (Press 2)</option>
                      <option value="customer_support">Customer Support (Press 3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={simName}
                      onChange={e => setSimName(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:outline-none font-semibold text-gray-700"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Customer Phone</label>
                    <input
                      type="text"
                      value={simPhone}
                      onChange={e => setSimPhone(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:outline-none font-semibold text-gray-700"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={simRequireAgent}
                      onChange={e => setSimRequireAgent(e.target.checked)}
                      id="require_agent_check"
                      className="h-4 w-4 text-forgeBlue border-gray-300 rounded focus:ring-forgeBlue"
                    />
                    <label htmlFor="require_agent_check" className="text-xs font-bold text-gray-600 cursor-pointer">
                      Require agent transfer (escalation)
                    </label>
                  </div>

                  <button
                    onClick={handleSimulateInboundCall}
                    className="w-full bg-forgeBlue hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Rocket className="h-4 w-4" />
                    <span>Trigger Inbound Call</span>
                  </button>
                </div>
              </div>

              {/* Inbound Manual Dial Panel */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
                <h2 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2 border-b pb-3">
                  <Phone className="h-5 w-5 text-forgeBlue" />
                  <span>Manual Dial Panel</span>
                </h2>
                
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={e => setManualPhone(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:outline-none font-semibold text-gray-700"
                      placeholder="e.g. +919988776655"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Customer Name (Optional)</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:outline-none font-semibold text-gray-700"
                      placeholder="e.g. Rahul Kumar"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Department</label>
                    <select
                      value={manualDept}
                      onChange={e => setManualDept(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                    >
                      <option value="recruitment">Recruitment</option>
                      <option value="credit_card_sales">Credit Card Sales</option>
                      <option value="customer_support">Customer Support</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Language</label>
                      <select
                        value={manualLang}
                        onChange={e => setManualLang(e.target.value)}
                        className="w-full border rounded-xl px-3 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Priority</label>
                      <select
                        value={manualPriority}
                        onChange={e => setManualPriority(e.target.value)}
                        className="w-full border rounded-xl px-3 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Agent Assignment</label>
                      <select
                        value={manualAgentMode}
                        onChange={e => setManualAgentMode(e.target.value as any)}
                        className="w-full border rounded-xl px-3 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                      >
                        <option value="auto">Auto-assign</option>
                        <option value="manual">Manual Select</option>
                      </select>
                    </div>

                    {manualAgentMode === "manual" && (
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Select Agent</label>
                        <select
                          value={manualAgentId}
                          onChange={e => setManualAgentId(e.target.value)}
                          className="w-full border rounded-xl px-3 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                        >
                          <option value="">-- Choose Agent --</option>
                          {users.filter(u => u.role === "agent").map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Initial Call Notes</label>
                    <textarea
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      placeholder="Context/reason for manual inbound dial..."
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 h-16 focus:outline-none font-semibold text-gray-700"
                    />
                  </div>

                  <button
                    onClick={handleInitiateManualDial}
                    disabled={isDialing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{isDialing ? "Dialing..." : "Dial Now"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE CALL CONSOLE OVERLAY DIALOG --- */}
      {activeCall && (
        <LiveCallModal
          activeCall={activeCall}
          activeCallTimer={activeCallTimer}
          activeCallMuted={activeCallMuted}
          activeCallHold={activeCallHold}
          activeCallTranscript={activeCallTranscript}
          activeCallSuggestions={activeCallSuggestions}
          activeCallSentiment={activeCallSentiment}
          activeCallSIPLogs={activeCallSIPLogs}
          activeCallRecordingStatus={activeCallRecordingStatus}
          isLiveKeypadOpen={isLiveKeypadOpen}
          setIsLiveKeypadOpen={setIsLiveKeypadOpen}
          isSpeakerActive={isSpeakerActive}
          setIsSpeakerActive={setIsSpeakerActive}
          manualName={manualName}
          manualPhone={manualPhone}
          onMuteToggle={() => handleTriggerAction(activeCallMuted ? "resume" : "mute")}
          onHoldToggle={() => handleTriggerAction(activeCallHold ? "resume" : "hold")}
          onSendDTMF={handleSendDTMF}
          onToggleRecording={handleToggleRecording}
          onOpenTransfer={() => {
            setTransferTargetId("");
            setIsTransferModalOpenLocal(true);
          }}
          onOpenConference={() => {
            setConferenceInviteeId("");
            setIsConferenceModalOpen(true);
          }}
          onEndCall={handleProceedToSummary}
          showToast={showToast}
        />
      )}

      {/* --- LOCAL CALL TRANSFER MODAL --- */}
      {isTransferModalOpenLocal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-white text-base">Select Transfer Target</h3>
              <button onClick={() => setIsTransferModalOpenLocal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Available Supervisors & Agents</label>
                <select
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                  className="w-full border border-slate-700 bg-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-bold focus:outline-none"
                >
                  <option value="">-- Select Target --</option>
                  <optgroup label="Supervisors / TLs">
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name} (Team Leader)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Agents">
                    {agentsList.filter(a => a.id !== user?.id).map(a => (
                      <option key={a.id} value={a.id}>{a.name} (Online)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button
                onClick={handleTransferCall}
                disabled={!transferTargetId}
                className="w-full bg-forgeBlue text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                <span>Perform Cold Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE CALL SUMMARY / CRM DISPOSITION MODAL --- */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 border animate-scale-in space-y-4">
            <h3 className="font-black text-gray-900 text-lg flex items-center gap-2 border-b pb-3">
              <Shield className="h-5 w-5 text-emerald-600" />
              <span>CRM Lead Disposition & Analytics</span>
            </h3>

            <div className="space-y-4">
              {/* Call duration summary */}
              <div className="bg-gray-50 border p-3 rounded-2xl flex justify-between items-center text-xs text-gray-500 font-semibold">
                <div>Duration: <strong className="text-gray-800">{Math.floor(activeCallTimer / 60)}m {activeCallTimer % 60}s</strong></div>
                <div>Recording: <span className="text-emerald-700 font-bold">Saved in Local MongoDB</span></div>
              </div>

              {/* Textarea AI Summary */}
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5 tracking-wider">AI Generated Summary</label>
                <textarea
                  value={aiSummaryResult}
                  onChange={e => setAiSummaryResult(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 h-16 focus:outline-none font-semibold text-gray-700"
                />
              </div>

              {/* Disposition dropdown */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5 tracking-wider">Call Outcome</label>
                  <select
                    value={callOutcome}
                    onChange={e => setCallOutcome(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="answered">Answered / Resolved</option>
                    <option value="qualified">Qualified Lead</option>
                    <option value="follow_up_required">Follow-up Needed</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="voicemail">Voicemail Left</option>
                    <option value="missed">Missed Connection</option>
                  </select>
                </div>

                {/* Follow up date schedule picker */}
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5 tracking-wider">Schedule Next Task</label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full border rounded-xl px-3 py-1.5 text-xs bg-gray-50 text-gray-700 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* Disposition Notes */}
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5 tracking-wider">Final Disposition Notes</label>
                <textarea
                  value={dispositionNotes}
                  onChange={e => setDispositionNotes(e.target.value)}
                  placeholder="Enter important conversation details..."
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 h-20 focus:outline-none font-semibold text-gray-700"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  onClick={handleSaveCRMDetails}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs font-black shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Analytics & Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- LAUNCH NEW CAMPAIGN MODAL (Admin only) --- */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-4 border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-gray-800 text-lg">Launch New Dialer Campaign</h3>
              <button onClick={() => setShowLaunchModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <input
                placeholder="Campaign Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                required
              />
              
              <textarea
                placeholder="Short Description..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 h-16 focus:ring-2 focus:ring-forgeBlue"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Target Pool</label>
                  <select
                    value={form.pool_id}
                    onChange={e => setForm({ ...form, pool_id: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:ring-2 focus:ring-forgeBlue font-semibold text-gray-700"
                    required
                  >
                    <option value="">-- Choose --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Supervisor</label>
                  <select
                    value={form.supervisor_id}
                    onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:ring-2 focus:ring-forgeBlue font-semibold text-gray-700"
                  >
                    <option value="">-- Optional --</option>
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Type</label>
                  <select
                    value={form.campaign_type}
                    onChange={e => setForm({ ...form, campaign_type: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                  >
                    <option value="outbound">Outbound Dial</option>
                    <option value="inbound">Inbound Queue</option>
                    <option value="survey">Automated Survey</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">AI Voice Model</label>
                  <select
                    value={form.ai_voice}
                    onChange={e => setForm({ ...form, ai_voice: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                  >
                    <option value="Neural-Female-IN">Neural-Female (IN)</option>
                    <option value="Neural-Male-US">Neural-Male (US)</option>
                    <option value="Neural-Female-US">Neural-Female (US)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Max Retry</label>
                  <input
                    type="number"
                    value={form.max_retry}
                    onChange={e => setForm({ ...form, max_retry: Number(e.target.value) })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Retry Int. (mins)</label>
                  <input
                    type="number"
                    value={form.retry_interval}
                    onChange={e => setForm({ ...form, retry_interval: Number(e.target.value) })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50"
                    min={5}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-forgeBlue text-white text-xs py-2.5 rounded-xl font-bold hover:bg-blue-800 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Rocket className="h-4 w-4" />
                <span>Launch Campaign</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ASSIGN AGENTS MODAL --- */}
      {isAssignModalOpen && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-4 border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-gray-800 text-lg">Assign Agents to Campaign</h3>
              <button onClick={() => {
                setIsAssignModalOpen(false);
                setSelectedCampaign(null);
              }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              Selected Campaign: <span className="text-forgeBlue font-bold">{selectedCampaign.name}</span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
              {agentsList.map(agent => (
                <div key={agent.id} className="flex items-center justify-between p-2.5 border rounded-xl hover:bg-gray-50/50 bg-white">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tempAgentIds.includes(agent.id)}
                      onChange={() => toggleSelectAgent(agent.id)}
                      className="h-4 w-4 text-forgeBlue focus:ring-forgeBlue border-gray-300 rounded"
                    />
                    <span className="font-bold text-gray-700 text-sm">{agent.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold">{agent.employee_id}</span>
                </div>
              ))}
              {agentsList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No agents available for selection.</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedCampaign(null);
                }}
                className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-slate-50 transition text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCampaignAgents}
                className="px-4 py-2 bg-forgeBlue hover:bg-blue-800 text-white rounded-xl transition text-sm font-bold"
              >
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dialer Trigger Button */}
      {!activeCall && (
        <button
          onClick={() => {
            setManualPhone("");
            setIsSoftphoneOpen(true);
          }}
          className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition flex items-center justify-center border-2 border-white/20 hover:rotate-12"
          title="Open Softphone Dialer"
        >
          <Phone className="h-6 w-6 fill-white" />
        </button>
      )}

      {/* Floating Softphone Dialer Pad Modal */}
      {isSoftphoneOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl animate-scale-in flex flex-col p-5 space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-emerald-400">
                <Phone className="h-4.5 w-4.5 fill-emerald-500/20" />
                <h3 className="font-extrabold text-white text-sm">Softphone Manual Dialer</h3>
              </div>
              <button
                onClick={() => setIsSoftphoneOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Input display */}
            <div className="relative">
              <input
                type="text"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Dial Number..."
                className="w-full border border-slate-700 bg-slate-950 rounded-2xl px-4 py-3.5 text-center text-xl font-black font-mono tracking-wider text-emerald-400 focus:outline-none"
              />
              {manualPhone && (
                <button
                  onClick={() => setManualPhone(prev => prev.slice(0, -1))}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 font-extrabold text-sm"
                  title="Backspace"
                >
                  ⌫
                </button>
              )}
            </div>

            {/* Keypad Numeric Matrix */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { k: "1", l: "oo" }, { k: "2", l: "abc" }, { k: "3", l: "def" },
                { k: "4", l: "ghi" }, { k: "5", l: "jkl" }, { k: "6", l: "mno" },
                { k: "7", l: "pqrs" }, { k: "8", l: "tuv" }, { k: "9", l: "wxyz" },
                { k: "*", l: " " }, { k: "0", l: "+" }, { k: "#", l: " " }
              ].map(item => (
                <button
                  key={item.k}
                  onClick={() => {
                    playDTMFTone(item.k);
                    setManualPhone(prev => prev + item.k);
                  }}
                  className="bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/60 h-13 rounded-2xl flex flex-col items-center justify-center transition"
                >
                  <span className="text-base font-black text-white">{item.k}</span>
                  <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider -mt-0.5">{item.l}</span>
                </button>
              ))}
            </div>

            {/* Setup Settings Drawer */}
            <div className="space-y-3 pt-2.5 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] text-slate-400 font-black uppercase mb-1">Queue Department</label>
                  <select
                    value={manualDept}
                    onChange={e => setManualDept(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-800 rounded-xl px-2 py-1.5 text-[10px] text-slate-200 font-bold focus:outline-none"
                  >
                    <option value="recruitment">Recruitment</option>
                    <option value="credit_card_sales">Credit Card Sales</option>
                    <option value="customer_support">Customer Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] text-slate-400 font-black uppercase mb-1">Preferred Language</label>
                  <select
                    value={manualLang}
                    onChange={e => setManualLang(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-800 rounded-xl px-2 py-1.5 text-[10px] text-slate-200 font-bold focus:outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Tamil">Tamil</option>
                  </select>
                </div>
              </div>

              {/* Customer optional name */}
              <div>
                <label className="block text-[8px] text-slate-400 font-black uppercase mb-1">Customer Name (Optional)</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="e.g. Rahul Kumar"
                  className="w-full border border-slate-700 bg-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none"
                />
              </div>

              {/* Action row */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setManualPhone("")}
                  className="px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-bold transition"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setIsSoftphoneOpen(false);
                    handleInitiateManualDial();
                  }}
                  disabled={!manualPhone}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <Phone className="h-4 w-4 fill-white" />
                  <span>Call Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFERENCE INVITEE SELECTION MODAL --- */}
      {isConferenceModalOpen && (
        <div className="fixed inset-0 z-55 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-white text-base">Bridging Conference invitee</h3>
              <button onClick={() => setIsConferenceModalOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Select Agent/Supervisor to Invite</label>
                <select
                  value={conferenceInviteeId}
                  onChange={e => setConferenceInviteeId(e.target.value)}
                  className="w-full border border-slate-700 bg-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-bold focus:outline-none"
                >
                  <option value="">-- Choose Target --</option>
                  <optgroup label="Supervisors / TLs">
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name} (Team Leader)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Agents">
                    {agentsList.filter(a => a.id !== user?.id).map(a => (
                      <option key={a.id} value={a.id}>{a.name} (Online)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button
                onClick={handleCreateConference}
                disabled={!conferenceInviteeId}
                className="w-full bg-forgeBlue hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Users className="h-4 w-4" />
                <span>Establish Conference Bridge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
