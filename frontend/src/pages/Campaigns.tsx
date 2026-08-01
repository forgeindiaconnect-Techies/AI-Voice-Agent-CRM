import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, BASE_URL } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import LiveCallModal from "../components/LiveCallModal";
import PortalHeader from "../components/PortalHeader";
import {
  Play,
  Pause,
  X,
  Rocket,
  Users,
  Settings,
  Megaphone,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Headphones,
  BarChart2,
  CheckCircle,
  TrendingUp,
  Volume2,
  Activity,
  Award,
  Phone,
  Clock,
  Sparkles,
  Shield,
  Share2,
  Layers,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown
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

  const [activeTab, setActiveTab] = useState<"outbound" | "inbound">(
    user?.role === "agent" ? "inbound" : "outbound"
  );

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

  // Softphone state variables
  const [isSoftphoneOpen, setIsSoftphoneOpen] = useState(false);
  const [isLiveKeypadOpen, setIsLiveKeypadOpen] = useState(false);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
  const [isSpeakerActive, setIsSpeakerActive] = useState(false);
  const [conferenceInviteeId, setConferenceInviteeId] = useState("");

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

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
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
              if (data.action === "mute") setActiveCallMuted(true);
              else if (data.action === "hold") setActiveCallHold(true);
              else if (data.action === "resume") {
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
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(5000 * reconnectAttempts, 30000);
            reconnectTimeout = setTimeout(connect, delay);
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
    <div className="space-y-8 max-w-7xl mx-auto font-sans pb-16">
      <PortalHeader
        icon={<Megaphone className="h-5 w-5 text-[#0F4C9A]" />}
        title="Campaign Management"
        subtitle="Enterprise auto-dialer orchestration & real-time IVR department routing"
        badgeText={`${campaigns.length} Total Campaigns`}
        tabs={
          user?.role !== "agent"
            ? [
                { id: "outbound", label: "Outbound Dialers" },
                { id: "inbound", label: "Inbound IVR Queues" },
              ]
            : [{ id: "inbound", label: "Inbound IVR Queues" }]
        }
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId as any);
          loadData();
        }}
        primaryButton={
          !isSupervisor && activeTab === "outbound"
            ? {
                label: "Create Campaign",
                onClick: () => setShowLaunchModal(true),
              }
            : undefined
        }
      />

      {/* --- TAB 1: OUTBOUND CAMPAIGNS --- */}
      {activeTab === "outbound" && (
        <div className="space-y-6">
          {/* Top Metric Overview Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="bg-white border border-slate-200/80 p-6 rounded-[20px] shadow-xs flex justify-between items-center relative overflow-hidden group hover:shadow-md transition-all duration-200"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <div className="pl-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {campaigns.filter(c => c.status === "active").length}
                </span>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Dialers
                </span>
              </div>
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100/80 text-emerald-600 group-hover:scale-110 transition-transform">
                <Play className="h-6 w-6 fill-emerald-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="bg-white border border-slate-200/80 p-6 rounded-[20px] shadow-xs flex justify-between items-center relative overflow-hidden group hover:shadow-md transition-all duration-200"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
              <div className="pl-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {campaigns.filter(c => c.status === "paused").length}
                </span>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Paused Campaigns
                </span>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100/80 text-amber-600 group-hover:scale-110 transition-transform">
                <Pause className="h-6 w-6 fill-amber-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="bg-white border border-slate-200/80 p-6 rounded-[20px] shadow-xs flex justify-between items-center relative overflow-hidden group hover:shadow-md transition-all duration-200"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
              <div className="pl-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {campaigns.filter(c => c.status === "stopped").length}
                </span>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Stopped Campaigns
                </span>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100/80 text-rose-600 group-hover:scale-110 transition-transform">
                <X className="h-6 w-6 text-rose-600 stroke-[2.5]" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="bg-white border border-slate-200/80 p-6 rounded-[20px] shadow-xs flex justify-between items-center relative overflow-hidden group hover:shadow-md transition-all duration-200"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0F4C9A]" />
              <div className="pl-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {campaigns.length > 0 ? "85.4%" : "0.0%"}
                </span>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Avg Success Rate
                </span>
              </div>
              <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-100/80 text-[#0F4C9A] group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-[#0F4C9A]" />
              </div>
            </motion.div>
          </div>

          {/* Search, Filter & Controls Toolbar */}
          <div className="bg-white rounded-[20px] p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search campaigns by name, ID, voice model..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] w-full md:w-48 cursor-pointer transition"
                >
                  <option value="">All Statuses (Active/Paused)</option>
                  <option value="active">Active Only</option>
                  <option value="paused">Paused Only</option>
                  <option value="stopped">Stopped Only</option>
                </select>
              </div>

              <button
                onClick={loadData}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center shadow-2xs"
                title="Refresh Campaigns Data"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 2-COLUMN RESPONSIVE GRID (Wider Cards: 600-700px, 24px Gaps, Equal Height) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredCampaigns.map((c, idx) => {
                const isExpanded = expandedCampaignId === c.id;
                const stats = campaignStats[c.id];

                // Calculate progress percentage
                const total = stats?.total_leads || 100;
                const completed = stats?.completed_leads || 0;
                const progressPct = Math.min(Math.round((completed / total) * 100), 100);

                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                    className="bg-white rounded-[20px] border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300/80 transition-all duration-300 flex flex-col justify-between overflow-hidden group min-h-[400px] h-full"
                  >
                    {/* Top Status Border Accent */}
                    <div className={`h-1.5 w-full ${
                      c.status === "active" ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" :
                      c.status === "paused" ? "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500" :
                      "bg-gradient-to-r from-rose-500 via-red-500 to-rose-400"
                    }`} />

                    <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                      {/* 1. Header: Campaign Name, ID, Status */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 
                                className="font-card-title text-slate-900 leading-snug group-hover:text-[#0F4C9A] transition-colors truncate" 
                                title={c.name}
                              >
                                {c.name}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2.5 pt-0.5">
                              <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100/90 border border-slate-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                                {c.campaign_id}
                              </span>
                              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-slate-400" />
                                <span>Outbound Dialer</span>
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border flex items-center gap-2 shrink-0 shadow-2xs ${
                            c.status === "active"
                              ? "bg-emerald-50/90 border-emerald-200 text-emerald-700"
                              : c.status === "paused"
                              ? "bg-amber-50/90 border-amber-200 text-amber-700"
                              : "bg-rose-50/90 border-rose-200 text-rose-700"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${
                              c.status === "active" ? "bg-emerald-500 animate-pulse" :
                              c.status === "paused" ? "bg-amber-500" : "bg-rose-500"
                            }`} />
                            <span>{c.status}</span>
                          </span>
                        </div>

                        {/* 2. Information Grid: 2 columns with generous horizontal space */}
                        <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Target Pool</span>
                            <span className="font-extrabold text-slate-800 capitalize flex items-center gap-2 text-xs truncate">
                              <Layers className="h-4 w-4 text-[#0F4C9A] shrink-0" />
                              <span className="truncate">{pools.find(p => p.id === c.pool_id)?.name.replace(/_/g, " ") || "No Pool"}</span>
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Voice Model</span>
                            <span className="font-extrabold text-slate-800 flex items-center gap-2 text-xs truncate">
                              <Volume2 className="h-4 w-4 text-amber-500 shrink-0" />
                              <span className="truncate">{c.ai_voice || "Neural-Female-IN"}</span>
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Assigned Agents</span>
                            <span className="font-extrabold text-slate-800 flex items-center gap-2 text-xs truncate">
                              <Users className="h-4 w-4 text-indigo-500 shrink-0" />
                              <span>{c.agent_ids?.length || 0} Agents Assigned</span>
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Calling Hours</span>
                            <span className="font-extrabold text-slate-800 flex items-center gap-2 text-xs truncate">
                              <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                              <span className="truncate">{c.calling_hours || "9 AM - 6 PM"}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Glassmorphism Status Badges Row */}
                      <div className="flex items-center gap-2.5 flex-wrap pt-1">
                        <span className="bg-emerald-50/80 text-emerald-700 border border-emerald-200/80 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs backdrop-blur-xs">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live 2 Calls</span>
                        </span>
                        <span className="bg-blue-50/80 text-[#0F4C9A] border border-blue-200/80 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs backdrop-blur-xs">
                          <Sparkles className="h-4 w-4 text-[#0F4C9A]" />
                          <span>AI Enabled</span>
                        </span>
                        <span className="bg-purple-50/80 text-purple-700 border border-purple-200/80 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs backdrop-blur-xs">
                          <Award className="h-4 w-4 text-purple-500" />
                          <span>High Priority</span>
                        </span>
                      </div>

                      {/* 4. Animated Progress Bar */}
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-[#0F4C9A]" />
                            <span>Campaign Progress</span>
                          </span>
                          <span className="text-[#0F4C9A] font-mono font-black">{progressPct}% Complete</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/70 p-0.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="bg-gradient-to-r from-[#0F4C9A] via-blue-600 to-[#F4B400] h-full rounded-full"
                          />
                        </div>
                      </div>

                      {/* 5. Equal-Width 3-Column KPI Cards */}
                      <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/90 shadow-2xs">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">TOTAL LEADS</span>
                          <span className="text-sm font-black text-slate-900">{stats?.total_leads || 100}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/90 shadow-2xs">
                          <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">SUCCESS RATE</span>
                          <span className="text-sm font-black text-emerald-700">{stats?.success_rate || 85.4}%</span>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100/90 shadow-2xs">
                          <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">PENDING</span>
                          <span className="text-sm font-black text-[#0F4C9A]">{stats?.pending_leads || 42}</span>
                        </div>
                      </div>
                    </div>

                    {/* 6. Fixed Bottom Action Toolbar with 4 Equal-Width Buttons */}
                    <div className="p-4 bg-slate-50/90 border-t border-slate-100 mt-auto">
                      <div className="grid grid-cols-4 gap-2.5">
                        {c.status !== "active" ? (
                          <button
                            onClick={() => handleUpdateStatus(c.id, "active")}
                            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer w-full"
                            title="Start Campaign"
                          >
                            <Play className="h-4 w-4 fill-white shrink-0" />
                            <span>Start</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(c.id, "paused")}
                            className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer w-full"
                            title="Pause Campaign"
                          >
                            <Pause className="h-4 w-4 fill-white shrink-0" />
                            <span>Pause</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleUpdateStatus(c.id, "stopped")}
                          disabled={c.status === "stopped"}
                          className="h-10 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer w-full"
                          title="Stop Campaign"
                        >
                          <X className="h-4 w-4 shrink-0" />
                          <span>Stop</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCampaign(c);
                            setTempAgentIds(c.agent_ids || []);
                            setIsAssignModalOpen(true);
                          }}
                          className="h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer w-full"
                        >
                          <Users className="h-4 w-4 text-slate-500 shrink-0" />
                          <span>Assign ({c.agent_ids?.length || 0})</span>
                        </button>

                        <button
                          onClick={() => handleExpandCampaign(c.id)}
                          className="h-10 bg-[#0F4C9A] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer w-full"
                        >
                          <BarChart2 className="h-4 w-4 shrink-0" />
                          <span>Analytics</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Details Pane */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-200/80 bg-gradient-to-b from-blue-50/50 to-white p-5 space-y-4"
                        >
                          {stats ? (
                            <>
                              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                                <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl shadow-2xs">
                                  <div className="font-black text-slate-900 text-sm">{stats.total_leads}</div>
                                  <div className="text-[9px] text-slate-400 font-extrabold uppercase">Total Leads</div>
                                </div>
                                <div className="bg-blue-50/80 border border-blue-100 p-2.5 rounded-xl">
                                  <div className="font-black text-[#0F4C9A] text-sm">{stats.pending_leads}</div>
                                  <div className="text-[9px] text-blue-600 font-extrabold uppercase">Pending</div>
                                </div>
                                <div className="bg-emerald-50/80 border border-emerald-100 p-2.5 rounded-xl">
                                  <div className="font-black text-emerald-700 text-sm">{stats.interested}</div>
                                  <div className="text-[9px] text-emerald-600 font-extrabold uppercase">Qualified</div>
                                </div>
                                <div className="bg-rose-50/80 border border-rose-100 p-2.5 rounded-xl">
                                  <div className="font-black text-rose-700 text-sm">{stats.not_interested}</div>
                                  <div className="text-[9px] text-rose-600 font-extrabold uppercase">Rejected</div>
                                </div>
                                <div className="bg-amber-50/80 border border-amber-100 p-2.5 rounded-xl">
                                  <div className="font-black text-amber-700 text-sm">{stats.callback_scheduled}</div>
                                  <div className="text-[9px] text-amber-600 font-extrabold uppercase">Callbacks</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                                  <div className="font-black text-emerald-700 text-sm">{stats.success_rate}%</div>
                                  <div className="text-[9px] text-emerald-600 font-extrabold uppercase">Success</div>
                                </div>
                              </div>

                              {stats.not_interested > 0 && (
                                <button
                                  onClick={() => handleRetryFailed(c.id)}
                                  className="w-full bg-[#F4B400] hover:bg-amber-400 text-[#0F4C9A] font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-xs active:scale-98 cursor-pointer"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  <span>Retry Failed Calls ({stats.not_interested} leads)</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-4">
                              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#0F4C9A] border-t-transparent mb-2"></div>
                              <p className="text-xs text-slate-500 font-bold">Fetching leads breakdown statistics...</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredCampaigns.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-[20px] p-12 text-center border border-slate-200/80 shadow-xs space-y-3"
            >
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-extrabold text-slate-700">No campaigns found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No outbound campaigns match your search query or status filter. Try clearing the filter or launch a new campaign.
              </p>
              {!isSupervisor && (
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="mt-2 px-4 py-2 bg-[#0F4C9A] text-white text-xs font-extrabold rounded-xl hover:bg-blue-800 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Campaign</span>
                </button>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* --- TAB 2: INBOUND CAMPAIGNS & IVR QUEUES --- */}
      {activeTab === "inbound" && (
        <div className="space-y-6">
          {/* IVR Configuration Status Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200/80 p-5 rounded-[20px] text-center shadow-xs">
              <div className="text-2xl font-black text-slate-900">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.active_calls, 0)}
              </div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-1">Live Inbound Calls</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-[20px] text-center shadow-xs">
              <div className="text-2xl font-black text-[#0F4C9A]">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.waiting_queue, 0)}
              </div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-1">Waiting in Queue</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-[20px] text-center shadow-xs">
              <div className="text-2xl font-black text-emerald-600">96.5%</div>
              <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider mt-1">SLA Compliance</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-[20px] text-center shadow-xs">
              <div className="text-2xl font-black text-amber-600">11s</div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-1">Avg Answer Speed</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-[20px] text-center shadow-xs">
              <div className="text-2xl font-black text-slate-900">
                {Object.values(inboundSummary).reduce((acc, curr) => acc + curr.available_agents, 0)}
              </div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-1">Available Agents</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* IVR Department Queues List */}
            <div className="bg-white rounded-[20px] p-6 shadow-xs border border-slate-200/80 lg:col-span-2 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Headphones className="h-5 w-5 text-[#0F4C9A] animate-pulse" />
                <span>IVR Department Routing Queues</span>
              </h2>

              <div className="space-y-4">
                {Object.values(inboundSummary).map(dept => (
                  <div
                    key={dept.department}
                    className="border border-slate-200/80 p-5 rounded-2xl bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-md transition duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-extrabold text-slate-900 text-sm capitalize">{dept.department.replace(/_/g, " ")} Queue</h4>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {dept.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 pt-1 text-xs text-slate-500 font-semibold">
                        <div>Active Calls: <strong className="text-slate-900 font-extrabold">{dept.active_calls}</strong></div>
                        <div>Waiting: <strong className="text-[#0F4C9A] font-extrabold">{dept.waiting_queue}</strong></div>
                        <div>Available: <strong className="text-slate-900 font-extrabold">{dept.available_agents}</strong></div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-[11px] text-slate-400 font-semibold pt-0.5">
                        <div>Resolved: <strong className="text-emerald-700 font-extrabold">{dept.resolved_calls}</strong></div>
                        <div>Transferred: <strong className="text-[#0F4C9A] font-extrabold">{dept.transferred_calls}</strong></div>
                        <div>Missed: <strong className="text-rose-700 font-extrabold">{dept.missed_calls}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right sm:border-l sm:border-slate-200 pl-0 sm:pl-5">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">AVG WAIT TIME</span>
                        <span className="text-sm font-black text-slate-900">{dept.average_wait_seconds} seconds</span>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(inboundSummary).length === 0 && (
                  <p className="text-slate-400 text-center py-8 font-medium">Inbound summary metrics offline.</p>
                )}
              </div>
            </div>

            {/* Right Column: Simulation & Manual Dial */}
            <div className="space-y-6 lg:col-span-1">
              {/* IVR Call Simulation Widget */}
              <div className="bg-white rounded-[20px] p-6 shadow-xs border border-slate-200/80">
                <h2 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Settings className="h-5 w-5 text-[#0F4C9A]" />
                  <span>IVR Call Simulation Widget</span>
                </h2>
                
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Select IVR Department</label>
                    <select
                      value={simDept}
                      onChange={e => setSimDept(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                    >
                      <option value="recruitment">Recruitment (Press 1)</option>
                      <option value="credit_card_sales">Credit Card Sales (Press 2)</option>
                      <option value="customer_support">Customer Support (Press 3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={simName}
                      onChange={e => setSimName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Customer Phone</label>
                    <input
                      type="text"
                      value={simPhone}
                      onChange={e => setSimPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={simRequireAgent}
                      onChange={e => setSimRequireAgent(e.target.checked)}
                      id="require_agent_check"
                      className="h-4 w-4 text-[#0F4C9A] border-slate-300 rounded focus:ring-[#0F4C9A] cursor-pointer"
                    />
                    <label htmlFor="require_agent_check" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Require agent transfer (escalation)
                    </label>
                  </div>

                  <button
                    onClick={handleSimulateInboundCall}
                    className="w-full bg-[#0F4C9A] hover:bg-blue-800 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-xs flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                  >
                    <Rocket className="h-4 w-4" />
                    <span>Trigger Inbound Call</span>
                  </button>
                </div>
              </div>

              {/* Inbound Manual Dial Panel */}
              <div className="bg-white rounded-[20px] p-6 shadow-xs border border-slate-200/80">
                <h2 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Phone className="h-5 w-5 text-[#0F4C9A]" />
                  <span>Manual Dial Panel</span>
                </h2>
                
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={e => setManualPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                      placeholder="e.g. +919988776655"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Customer Name (Optional)</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                      placeholder="e.g. Rahul Kumar"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Department</label>
                    <select
                      value={manualDept}
                      onChange={e => setManualDept(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                    >
                      <option value="recruitment">Recruitment</option>
                      <option value="credit_card_sales">Credit Card Sales</option>
                      <option value="customer_support">Customer Support</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Language</label>
                      <select
                        value={manualLang}
                        onChange={e => setManualLang(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Priority</label>
                      <select
                        value={manualPriority}
                        onChange={e => setManualPriority(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Agent Assignment</label>
                      <select
                        value={manualAgentMode}
                        onChange={e => setManualAgentMode(e.target.value as any)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                      >
                        <option value="auto">Auto-assign</option>
                        <option value="manual">Manual Select</option>
                      </select>
                    </div>

                    {manualAgentMode === "manual" && (
                      <div>
                        <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Select Agent</label>
                        <select
                          value={manualAgentId}
                          onChange={e => setManualAgentId(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
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
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Initial Call Notes</label>
                    <textarea
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      placeholder="Context/reason for manual inbound dial..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-16 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                    />
                  </div>

                  <button
                    onClick={handleInitiateManualDial}
                    disabled={isDialing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-[20px] p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-white text-base">Select Transfer Target</h3>
              <button onClick={() => setIsTransferModalOpenLocal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">Available Supervisors & Agents</label>
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
                className="w-full bg-[#0F4C9A] hover:bg-blue-800 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-[24px] w-full max-w-xl shadow-2xl p-6 border border-slate-200/80 space-y-4">
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-5 w-5 text-emerald-600" />
              <span>CRM Lead Disposition & Analytics</span>
            </h3>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex justify-between items-center text-xs text-slate-500 font-bold">
                <div>Duration: <strong className="text-slate-900">{Math.floor(activeCallTimer / 60)}m {activeCallTimer % 60}s</strong></div>
                <div>Recording: <span className="text-emerald-700 font-extrabold">Saved in Local MongoDB</span></div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1.5 tracking-wider">AI Generated Summary</label>
                <textarea
                  value={aiSummaryResult}
                  onChange={e => setAiSummaryResult(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-16 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1.5 tracking-wider">Call Outcome</label>
                  <select
                    value={callOutcome}
                    onChange={e => setCallOutcome(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                  >
                    <option value="answered">Answered / Resolved</option>
                    <option value="qualified">Qualified Lead</option>
                    <option value="follow_up_required">Follow-up Needed</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="voicemail">Voicemail Left</option>
                    <option value="missed">Missed Connection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1.5 tracking-wider">Schedule Next Task</label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1.5 tracking-wider">Final Disposition Notes</label>
                <textarea
                  value={dispositionNotes}
                  onChange={e => setDispositionNotes(e.target.value)}
                  placeholder="Enter important conversation details..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-20 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleSaveCRMDetails}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200/80">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#0F4C9A]" />
                <span>Launch New Dialer Campaign</span>
              </h3>
              <button onClick={() => setShowLaunchModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Campaign Name</label>
                <input
                  placeholder="e.g. Q3 Sales Outreach Campaign"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Short Description</label>
                <textarea
                  placeholder="Campaign targets, goals..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-16 focus:ring-2 focus:ring-[#0F4C9A] font-semibold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Target Pool</label>
                  <select
                    value={form.pool_id}
                    onChange={e => setForm({ ...form, pool_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-[#0F4C9A] font-extrabold text-slate-700"
                    required
                  >
                    <option value="">-- Choose --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Supervisor</label>
                  <select
                    value={form.supervisor_id}
                    onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-[#0F4C9A] font-extrabold text-slate-700"
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
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={form.campaign_type}
                    onChange={e => setForm({ ...form, campaign_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-[#0F4C9A] font-extrabold text-slate-700"
                  >
                    <option value="outbound">Outbound Dial</option>
                    <option value="inbound">Inbound Queue</option>
                    <option value="survey">Automated Survey</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">AI Voice Model</label>
                  <select
                    value={form.ai_voice}
                    onChange={e => setForm({ ...form, ai_voice: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-[#0F4C9A] font-extrabold text-slate-700"
                  >
                    <option value="Neural-Female-IN">Neural-Female (IN)</option>
                    <option value="Neural-Male-US">Neural-Male (US)</option>
                    <option value="Neural-Female-US">Neural-Female (US)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Max Retry</label>
                  <input
                    type="number"
                    value={form.max_retry}
                    onChange={e => setForm({ ...form, max_retry: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-bold text-slate-700"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Retry Int. (mins)</label>
                  <input
                    type="number"
                    value={form.retry_interval}
                    onChange={e => setForm({ ...form, retry_interval: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-bold text-slate-700"
                    min={5}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0F4C9A] hover:bg-blue-800 text-white text-xs py-3 rounded-xl font-extrabold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200/80">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0F4C9A]" />
                <span>Assign Agents</span>
              </h3>
              <button onClick={() => {
                setIsAssignModalOpen(false);
                setSelectedCampaign(null);
              }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Selected Campaign: <span className="text-[#0F4C9A] font-black">{selectedCampaign.name}</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {agentsList.map(agent => (
                <div key={agent.id} className="flex items-center justify-between p-3 border border-slate-200/80 rounded-xl hover:bg-slate-50/80 bg-white transition">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={tempAgentIds.includes(agent.id)}
                      onChange={() => toggleSelectAgent(agent.id)}
                      className="h-4 w-4 text-[#0F4C9A] focus:ring-[#0F4C9A] border-slate-300 rounded cursor-pointer"
                    />
                    <span className="font-extrabold text-slate-800 text-xs">{agent.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{agent.employee_id}</span>
                </div>
              ))}
              {agentsList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6 font-semibold">No agents available for selection.</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedCampaign(null);
                }}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-xs font-extrabold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCampaignAgents}
                className="px-4 py-2.5 bg-[#0F4C9A] hover:bg-blue-800 text-white rounded-xl transition text-xs font-extrabold shadow-xs cursor-pointer"
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
          className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition flex items-center justify-center border-2 border-white/30 cursor-pointer"
          title="Open Softphone Dialer"
        >
          <Phone className="h-6 w-6 fill-white" />
        </button>
      )}

      {/* Floating Softphone Dialer Pad Modal */}
      {isSoftphoneOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-[28px] w-full max-w-xs overflow-hidden shadow-2xl flex flex-col p-5 space-y-4">
            
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
                  className="bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/60 h-13 rounded-2xl flex flex-col items-center justify-center transition cursor-pointer"
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

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setManualPhone("")}
                  className="px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setIsSoftphoneOpen(false);
                    handleInitiateManualDial();
                  }}
                  disabled={!manualPhone}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
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
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-[20px] p-6 max-w-sm w-full shadow-2xl space-y-4">
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
                className="w-full bg-[#0F4C9A] hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
