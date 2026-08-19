import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api, getWsUrl } from "../api/client";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { Device } from "@twilio/voice-sdk";
import { CustomPauseIcon } from "../components/CustomPauseIcon";
import { CustomSelect } from "../components/CustomSelect";
import LeadFilterModal from "../components/LeadFilterModal";
import LeadActionSlideOver, { ActiveSlideOverTab } from "../components/LeadActionSlideOver";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  User,
  History,
  CheckCircle2,
  XCircle,
  Hash,
  MessageSquare,
  ListOrdered,
  Save,
  Loader2,
  Headphones,
  Ear,
  Sparkles,
  Bot,
  Search,
  Filter,
  RefreshCw,
  Star,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Calendar,
  Clock,
  ChevronRight,
  Coffee,
  Check,
  Share2,
  Send,
  Zap,
  TrendingUp,
  Sliders,
  PhoneMissed,
  X,
  FileText
} from "lucide-react";

type CallStatus =
  | "ready"
  | "dialing"
  | "ringing"
  | "connected"
  | "hold"
  | "wrapup"
  | "completed"
  | "busy"
  | "no-answer"
  | "failed";

type AgentStatus = "ready" | "on_call" | "wrap_up" | "break";
type Tab = "outbound" | "inbound" | "supervisor" | "history";

const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "new", label: "New Leads" },
  { value: "pending", label: "Pending" },
  { value: "follow_up_required", label: "Follow Up Required" },
  { value: "closed", label: "Closed / Converted" }
];

const DISPOSITION_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "call_back", label: "Call Back" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy / Line Busy" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "converted", label: "Converted / Won" },
  { value: "follow_up_required", label: "Follow-up Required" },
  { value: "dnc", label: "Do Not Call (DNC)" }
];

type ActiveCall = {
  _id: string;
  lead_name?: string;
  phone?: string;
  agent_id: string;
  status: string;
  call_state: string;
  started_at: string;
};

type Lead = {
  _id: string;
  name: string;
  phone: string;
  source: string;
  campaign_id?: string;
  priority?: string;
  status: string;
  updated_at?: string;
  created_at: string;
  assigned_agent_id?: string;
  supervisor_id?: string;
  pool_id?: string;
  notes?: string;
};

type CallHistoryItem = {
  id?: string;
  _id?: string;
  lead_id?: string;
  phone?: string;
  phone_number?: string;
  lead_name?: string;
  agent_name?: string;
  direction?: string;
  duration_seconds?: number;
  duration?: number;
  outcome?: string;
  status?: string;
  disposition?: string;
  started_at?: string;
  ended_at?: string;
  created_at?: string;
  notes?: string;
  recording_url?: string;
};

export default function Dialer() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("outbound");

  // AGENT STATE
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");

  // OUTBOUND DIALER STATE
  const [outboundPhone, setOutboundPhone] = useState("");
  const [callMode, setCallMode] = useState<"human" | "ai">("human");
  const [callStatus, setCallStatus] = useState<CallStatus>("ready");
  const [isDialing, setIsDialing] = useState(false);
  const isDialingRef = useRef(false);
  const callEndReasonRef = useRef<string>("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [quickCallingLeadId, setQuickCallingLeadId] = useState<string | null>(null);

  // ACTIVE CALL STATE
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // WRAPUP / AFTER-CALL WORK STATE
  const [disposition, setDisposition] = useState("interested");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);
  const [isMuteLoading, setIsMuteLoading] = useState(false);
  const [isHoldLoading, setIsHoldLoading] = useState(false);
  const [isHoldProcessing, setIsHoldProcessing] = useState(false);

  // INCOMING CALL STATE
  const [incomingCall, setIncomingCall] = useState<{ id: string; phone: string; name: string } | null>(null);

  // SUPERVISOR STATE
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const isSupervisor = user?.role === "admin" || user?.role === "team_leader";

  // ASSIGNED LEADS STATE
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDirection, setLeadDirection] = useState<"outbound" | "inbound">("outbound");

  // ADVANCED LEAD FILTER STATE
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterUserId, setFilterUserId] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterSource, setFilterSource] = useState("All");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterAgent, setFilterAgent] = useState("");

  // FLOATING RAIL & SLIDE-OVER STATE
  const [activeSlideOver, setActiveSlideOver] = useState<ActiveSlideOverTab>(null);
  const [isSavingSlideOverDisp, setIsSavingSlideOverDisp] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterUserId.trim()) count++;
    if (filterPhone.trim()) count++;
    if (statusFilter !== "All") count++;
    if (filterSource !== "All") count++;
    if (filterStartDate) count++;
    if (filterEndDate) count++;
    if (filterAgent.trim()) count++;
    return count;
  }, [filterUserId, filterPhone, statusFilter, filterSource, filterStartDate, filterEndDate, filterAgent]);

  const resetAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterUserId("");
    setFilterPhone("");
    setStatusFilter("All");
    setFilterSource("All");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterAgent("");
  }, []);

  // CALL HISTORY STATE
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Clean / sanitize mobile number helper
  const sanitizeMobileNumber = useCallback((val: string): string => {
    if (!val) return "";
    let cleaned = val.trim();
    while (cleaned.startsWith("+91") || cleaned.startsWith("91 ") || cleaned.startsWith("+ 91")) {
      if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith("91 ")) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith("+ 91")) cleaned = cleaned.slice(4);
      cleaned = cleaned.trim();
    }
    cleaned = cleaned.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    }
    return cleaned.slice(0, 10);
  }, []);

  const isValidMobile = useMemo(() => {
    return /^[6-9]\d{9}$/.test(outboundPhone);
  }, [outboundPhone]);

  const validationMessage = useMemo(() => {
    if (outboundPhone.length === 0) return "";
    if (!/^[6-9]/.test(outboundPhone)) {
      return "Indian mobile numbers must start with 6-9";
    }
    if (outboundPhone.length < 10) {
      return `${outboundPhone.length}/10 digits entered`;
    }
    if (!isValidMobile) {
      return "Enter valid 10-digit Indian mobile number";
    }
    return "";
  }, [outboundPhone, isValidMobile]);

  // Mask phone numbers for BPO privacy
  const maskPhoneNumber = (phoneStr?: string) => {
    if (!phoneStr) return "N/A";
    const clean = phoneStr.replace(/\D/g, "");
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      return `+91 ${last10.slice(0, 3)}****${last10.slice(7)}`;
    }
    return phoneStr;
  };

  // FETCH DATA
  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    try {
      const res = await api.get("/api/leads?paginate=false");
      const list = Array.isArray(res) ? res : (res?.items || res?.leads || []);
      setLeads(list);
    } catch (err: any) {
      console.error("[Dialer] fetchLeads error:", err);
    } finally {
      setIsLoadingLeads(false);
    }
  }, []);

  const fetchCallHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await api.get("/api/calls");
      const list = Array.isArray(res) ? res : (res?.calls || res?.items || []);
      setCallHistory(list);
    } catch (err: any) {
      console.error("[Dialer] fetchCallHistory error:", err);
      setHistoryError(err.message || "Failed to load recent call history.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchCallHistory();

    const checkActiveSession = async () => {
      try {
        const active = await api.get("/api/calls/active");
        if (active && (active.id || active._id)) {
          setCurrentCallId(active.id || active._id);
          if (active.phone) {
            setOutboundPhone(sanitizeMobileNumber(active.phone));
          }
          setCallStatus(active.call_state === "hold" ? "hold" : "connected");
          setAgentStatus("on_call");
        }
      } catch (err) {
        console.warn("[Dialer] Active session check notice:", err);
      }
    };
    checkActiveSession();

    let ws: WebSocket | null = null;
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(getWsUrl("/global"));
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "leads_updated") {
              fetchLeads();
              fetchCallHistory();
            }
            if (data.event === "vapi_call_status") {
              const st = (data.call_status || "").toLowerCase();
              if (st === "ringing") {
                setCallStatus("ringing");
              } else if (st === "connected" || st === "in-progress") {
                setCallStatus("connected");
                setAgentStatus("on_call");
              } else if (st === "ended" || st === "completed") {
                setCallStatus("wrapup");
                setAgentStatus("wrap_up");
                fetchCallHistory();
              }
            }
            if (data.event === "call_ended") {
              setCallStatus("wrapup");
              setAgentStatus("wrap_up");
              fetchCallHistory();
            }
            if (data.event === "incoming_call" || data.event === "inbound_call") {
              setIncomingCall({
                id: data.call_id || `inc_${Date.now()}`,
                phone: data.phone || "9876543210",
                name: data.name || "Customer Lead"
              });
              setCallStatus("ringing");
              showToast(`Incoming Call from ${data.phone || 'Customer'}`, "info");
            }
            if (data.event === "manual_call_action") {
              if (data.action === "hold") {
                setCallStatus("hold");
                if (callRef.current) {
                  try { callRef.current.mute(true); } catch {}
                }
              } else if (data.action === "resume") {
                setCallStatus("connected");
                if (callRef.current) {
                  try { callRef.current.mute(false); } catch {}
                }
              }
            }
            if (data.event === "call_status_update" && data.call_sid) {
              const status: string = (data.call_status || "").toLowerCase();
              if (status === "busy") {
                callEndReasonRef.current = "busy";
                if (callRef.current) callRef.current.disconnect();
              } else if (status === "no-answer" || status === "no_answer") {
                callEndReasonRef.current = "no-answer";
                if (callRef.current) callRef.current.disconnect();
              } else if (status === "failed") {
                callEndReasonRef.current = "failed";
                if (callRef.current) callRef.current.disconnect();
              } else if (status === "in-progress") {
                setCallStatus("connected");
                setAgentStatus("on_call");
              }
            }
          } catch (err) {
            console.error("Failed to parse websocket message", err);
          }
        };
        ws.onclose = () => {
          wsReconnectTimer = setTimeout(connectWs, 3000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.error("Failed to connect WebSocket", err);
        wsReconnectTimer = setTimeout(connectWs, 5000);
      }
    };

    connectWs();

    return () => {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      if (ws) ws.close();
    };
  }, [fetchLeads, fetchCallHistory]);

  // TWILIO DEVICE STATE
  const [deviceReady, setDeviceReady] = useState(false);
  const [isInitializingDevice, setIsInitializingDevice] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<any>(null);

  const setupDevice = useCallback(async () => {
    if (deviceRef.current && deviceReady) return;
    setIsInitializingDevice(true);
    try {
      const { token } = await api.get("/api/calls/token");
      if (!token) throw new Error("No token returned");

      const device = new Device(token, {
        codecPreferences: ["opus" as any, "pcmu" as any],
      });

      deviceRef.current = device;

      device.on("registered", () => {
        setDeviceReady(true);
        setIsInitializingDevice(false);
      });

      device.on("error", (error: any) => {
        console.warn("[Twilio Device Error]", error);
        setIsInitializingDevice(false);
      });

      await device.register();
    } catch (err: any) {
      console.warn("Softphone registration notice:", err);
      setIsInitializingDevice(false);
    }
  }, [deviceReady]);

  useEffect(() => {
    setupDevice();

    return () => {
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {}
      }
    };
  }, []);

  // Timer effect during connected/hold states
  useEffect(() => {
    if (callStatus === "connected" || callStatus === "hold") {
      const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // Today's Stats Calculation
  const todayStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    const todayCalls = callHistory.filter((c) => {
      const dt = c.started_at || c.created_at;
      if (!dt) return false;
      return new Date(dt).toDateString() === todayStr;
    });

    const total = todayCalls.length;
    const connected = todayCalls.filter(c => ["answered", "connected", "qualified", "completed"].includes((c.outcome || c.status || "").toLowerCase())).length;
    const noAnswer = todayCalls.filter(c => ["no_answer", "no-answer"].includes((c.outcome || c.status || "").toLowerCase())).length;
    const busy = todayCalls.filter(c => ["busy"].includes((c.outcome || c.status || "").toLowerCase())).length;
    const followUps = todayCalls.filter(c => ["follow_up_required", "call_back", "follow_up"].includes((c.outcome || c.status || "").toLowerCase())).length;
    const converted = todayCalls.filter(c => ["converted", "qualified"].includes((c.outcome || c.status || "").toLowerCase())).length;

    return { total, connected, noAnswer, busy, followUps, converted };
  }, [callHistory]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // 1. Search Query (Name, Phone or User ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (l.name || "").toLowerCase().includes(q);
        const phoneMatch = (l.phone || "").toLowerCase().includes(q);
        const idMatch = (l._id || (l as any).id || "").toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !idMatch) return false;
      }

      // 2. User ID / Lead ID
      if (filterUserId.trim()) {
        const targetId = filterUserId.toLowerCase().trim();
        const leadId = (l._id || (l as any).id || "").toLowerCase();
        if (!leadId.includes(targetId)) return false;
      }

      // 3. Phone Number Filter
      if (filterPhone.trim()) {
        const cleanTarget = filterPhone.replace(/\D/g, "");
        const cleanLeadPhone = (l.phone || "").replace(/\D/g, "");
        if (!cleanLeadPhone.includes(cleanTarget)) return false;
      }

      // 4. Status Filter
      if (statusFilter !== "All" && statusFilter.toLowerCase() !== "all") {
        const s = (l.status || "").toLowerCase();
        const sf = statusFilter.toLowerCase();
        const matchStatus = s === sf || (sf === "pending" && (s === "new" || s === "pending" || s === "follow_up_required"));
        if (!matchStatus) return false;
      }

      // 5. Source Filter
      if (filterSource !== "All" && filterSource.toLowerCase() !== "all") {
        if ((l.source || "Manual").toLowerCase() !== filterSource.toLowerCase()) return false;
      }

      // 6. Agent Filter
      if (filterAgent.trim()) {
        const qAgent = filterAgent.toLowerCase().trim();
        const agentId = (l.assigned_agent_id || "").toLowerCase();
        if (!agentId.includes(qAgent)) return false;
      }

      // 7. Date Range Filter
      if (filterStartDate) {
        const start = new Date(filterStartDate).getTime();
        const created = new Date(l.created_at || Date.now()).getTime();
        if (created < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate).getTime() + 86400000;
        const created = new Date(l.created_at || Date.now()).getTime();
        if (created > end) return false;
      }

      return true;
    });
  }, [
    leads, searchQuery, filterUserId, filterPhone, statusFilter,
    filterSource, filterStartDate, filterEndDate, filterAgent
  ]);

  const outboundLeadsCount = useMemo(() => {
    return filteredLeads.filter((l: any) => !(l.direction === "inbound" || (l.source && l.source.toLowerCase().includes("inbound")) || l.type === "inbound")).length;
  }, [filteredLeads]);

  const inboundLeadsCount = useMemo(() => {
    return filteredLeads.filter((l: any) => (l.direction === "inbound" || (l.source && l.source.toLowerCase().includes("inbound")) || l.type === "inbound")).length;
  }, [filteredLeads]);

  const displayedLeads = useMemo(() => {
    return filteredLeads.filter((l: any) => {
      const isInbound = (l.direction === "inbound" || (l.source && l.source.toLowerCase().includes("inbound")) || l.type === "inbound");
      return leadDirection === "inbound" ? isInbound : !isInbound;
    });
  }, [filteredLeads, leadDirection]);

  const handleSaveSlideOverDisposition = async (status: string, notes: string, followUpDate?: string) => {
    if (!selectedLead?._id) return;
    setIsSavingSlideOverDisp(true);
    try {
      await api.patch(`/api/leads/${selectedLead._id}`, {
        status,
        notes,
        follow_up_date: followUpDate
      });

      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-end`, {
          call_id: currentCallId,
          outcome: status,
          notes,
          follow_up_date: followUpDate
        });
      }

      showToast(`Disposition saved: ${status.replace(/_/g, " ").toUpperCase()}`, "success");
      fetchLeads();
      fetchCallHistory();
    } catch (err: any) {
      showToast(err.message || "Failed to save disposition", "error");
    } finally {
      setIsSavingSlideOverDisp(false);
    }
  };

  // Select Lead Handler
  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    const cleanPhone = sanitizeMobileNumber(lead.phone);
    setOutboundPhone(cleanPhone);
    setActiveSlideOver("profile");
  };

  const handleUpdateLeadDisposition = async (leadId: string, status: string, notes: string, followUpDate?: string) => {
    try {
      await api.patch(`/api/leads/${leadId}`, { status, notes, follow_up_date: followUpDate });
      showToast("Lead disposition updated successfully", "success");
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || "Failed to update lead disposition", "error");
    }
  };

  // Keypad Press Handler
  const handleKeypadPress = async (digit: string) => {
    if (callStatus === "ready") {
      if (/^[0-9]$/.test(digit) && outboundPhone.length < 10) {
        setOutboundPhone(prev => prev + digit);
      }
    } else if (callStatus === "connected" && currentCallId) {
      try {
        await api.post(`/api/calls/${currentCallId}/dtmf`, { digit });
      } catch (err: any) {
        showToast(err.message || "Failed to send DTMF", "error");
      }
    }
  };

  // Call Initiation
  const handleDial = async () => {
    if (!isValidMobile) return;
    if (isDialingRef.current || isDialing) return;
    if (callStatus === "dialing" || callStatus === "ringing" || callStatus === "connected" || callStatus === "hold") return;

    if (callStatus !== "ready") {
      setCallStatus("ready");
      setCurrentCallId(null);
    }

    isDialingRef.current = true;
    setIsDialing(true);
    callEndReasonRef.current = "";

    const idempotencyKey = `${user?.id || 'agent'}_${outboundPhone}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!deviceReady && !isInitializingDevice) {
      await setupDevice();
    }

    setIsCreatingLead(true);
    setCallStatus("dialing");
    setAgentStatus("on_call");
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);

    const fullPhoneNumber = `+91${outboundPhone}`;
    let matchedLead = selectedLead || leads.find(l => {
      const cleanL = l.phone.replace(/\D/g, "");
      const cleanTarget = fullPhoneNumber.replace(/\D/g, "");
      return cleanL === cleanTarget;
    });

    if (!matchedLead) {
      try {
        const res = await api.post("/api/leads", {
          name: `Manual Lead - ${outboundPhone}`,
          phone: fullPhoneNumber,
          pool_id: user?.pool_id || leads[0]?.pool_id || "6a6b40b7841e208e1cb69469",
          source: "Manual Dialer"
        });
        matchedLead = res;
        fetchLeads();
      } catch (err: any) {
        console.warn("[Dialer] Lead lookup/creation notice:", err);
      }
    }
    if (matchedLead) {
      setSelectedLead(matchedLead);
    }

    setIsCreatingLead(false);

    // AI Call Mode
    if (callMode === "ai") {
      try {
        const res = await api.post("/api/calls/vapi-dial", {
          phone: fullPhoneNumber,
          name: matchedLead?.name || `Manual Lead - ${outboundPhone}`,
          pool_id: matchedLead?.pool_id || user?.pool_id || "general",
          idempotency_key: idempotencyKey
        });
        setCurrentCallId(res.id || res._id || res.call_id || null);
        setCallStatus("connected");
        setAgentStatus("on_call");
        setCallDuration(0);
        isDialingRef.current = false;
        setIsDialing(false);
        fetchLeads();
        fetchCallHistory();
        showToast("Vapi AI Voice Agent call initiated", "success");
        return;
      } catch (err: any) {
        const msg = typeof err.message === "string" ? err.message : JSON.stringify(err.message || "");
        showToast(msg || "Vapi AI Call Failed", "error");
        setCallStatus("ready");
        setAgentStatus("ready");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    }

    // Human Agent WebRTC Softphone Call
    try {
      const res = await api.post("/api/calls/manual-dial", {
        phone: fullPhoneNumber,
        pool_id: matchedLead?.pool_id || user?.pool_id || "general",
        language: "english",
        agent_assign_mode: "manual",
        assigned_agent_id: user?.id,
        priority: "high",
        notes: "",
        initiate_pstn: false,
        idempotency_key: idempotencyKey,
        call_mode: callMode
      });
      setCurrentCallId(res.id || res._id || res.call_id || null);
    } catch (err: any) {
      const msg = typeof err.message === "string" ? err.message : JSON.stringify(err.message || "");
      if (err.status === 409 || msg.includes("already in progress") || msg.includes("active call")) {
        try {
          if (currentCallId) {
            await api.post(`/api/calls/${currentCallId}/force-end`).catch(() => {});
          }
          const retryRes = await api.post("/api/calls/manual-dial", {
            phone: fullPhoneNumber,
            pool_id: matchedLead?.pool_id || user?.pool_id || "general",
            language: "english",
            agent_assign_mode: "manual",
            assigned_agent_id: user?.id,
            priority: "high",
            notes: "",
            initiate_pstn: false,
            idempotency_key: `retry_${idempotencyKey}`,
            call_mode: callMode
          });
          setCurrentCallId(retryRes.id || retryRes._id || retryRes.call_id || null);
        } catch (retryErr: any) {
          showToast("Previous session conflict resolved. Ready to dial.", "info");
          setCallStatus("ready");
          setAgentStatus("ready");
          isDialingRef.current = false;
          setIsDialing(false);
          return;
        }
      } else {
        showToast(msg || "Failed to start call", "error");
        setCallStatus("ready");
        setAgentStatus("ready");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    }

    // Request Mic access
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast("Microphone denied! Enable mic access to make calls.", "error");
      setCallStatus("ready");
      setAgentStatus("ready");
      isDialingRef.current = false;
      setIsDialing(false);
      return;
    }

    // Twilio WebRTC Connect
    if (deviceRef.current && deviceReady) {
      try {
        const twilioCall = await deviceRef.current.connect({
          params: { To: fullPhoneNumber }
        });
        callRef.current = twilioCall;

        twilioCall.on("ringing", () => {
          setCallStatus("ringing");
        });

        twilioCall.on("accept", () => {
          setCallStatus("connected");
          setAgentStatus("on_call");
          setCallDuration(0);
          isDialingRef.current = false;
          setIsDialing(false);
        });

        twilioCall.on("disconnect", () => {
          callRef.current = null;
          setIsMuted(false);
          isDialingRef.current = false;
          setIsDialing(false);
          const reason = callEndReasonRef.current;
          if (reason === "busy") {
            setCallStatus("busy");
          } else if (reason === "no-answer") {
            setCallStatus("no-answer");
          } else {
            setCallStatus("wrapup");
            setAgentStatus("wrap_up");
          }
        });

        twilioCall.on("reject", () => {
          callRef.current = null;
          setIsMuted(false);
          setCallStatus("busy");
          isDialingRef.current = false;
          setIsDialing(false);
        });

        twilioCall.on("error", (err: any) => {
          console.error("[Twilio] Call error:", err);
          callRef.current = null;
          setIsMuted(false);
          isDialingRef.current = false;
          setIsDialing(false);
          const code = err?.code || err?.twilioError?.code || 0;
          const msg: string = (err?.message || "").toLowerCase();
          if (code === 31480 || msg.includes("busy") || msg.includes("486")) {
            setCallStatus("busy");
          } else if (code === 31486 || msg.includes("no answer") || msg.includes("408")) {
            setCallStatus("no-answer");
          } else {
            setCallStatus("failed");
            showToast(err?.message || "Call failed", "error");
          }
        });

      } catch (e: any) {
        setCallStatus("failed");
        showToast(e?.message || "Failed to initiate call", "error");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    } else {
      showToast("Softphone not ready yet. Please wait and try again.", "warning");
      setCallStatus("ready");
      setAgentStatus("ready");
      isDialingRef.current = false;
      setIsDialing(false);
      return;
    }
  };

  const handleHangup = useCallback(() => {
    if (callStatus === "ready") return;

    if (callRef.current) {
      try {
        callRef.current.disconnect();
      } catch {}
      callRef.current = null;
    }

    setIsMuted(false);
    setIsSpeaker(false);
    isDialingRef.current = false;
    setIsDialing(false);

    if (callStatus === "dialing" || callStatus === "ringing") {
      setCallStatus("ready");
      setAgentStatus("ready");
      setCallDuration(0);
    } else {
      setCallStatus("wrapup");
      setAgentStatus("wrap_up");
    }

    if (currentCallId) {
      api.post(`/api/calls/${currentCallId}/manual-end`, {
        call_id: currentCallId,
        outcome: "answered",
        duration_seconds: callDuration,
        notes: notes || "Call ended by agent"
      }).catch((err) => console.warn("Backend end-call notice:", err));
    }
  }, [callStatus, currentCallId, callDuration, notes]);

  const handleMuteToggle = useCallback(async () => {
    if (callStatus !== "connected" && callStatus !== "hold") {
      showToast("Mute is only available during an active call", "warning");
      return;
    }
    if (isMuteLoading) return;

    const nextMuted = !isMuted;
    setIsMuteLoading(true);
    setIsMuted(nextMuted);

    if (callRef.current) {
      try {
        callRef.current.mute(nextMuted);
      } catch (err) {
        console.warn("Local mic mute error:", err);
      }
    }

    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-action`, {
          action: nextMuted ? "mute" : "unmute"
        });
      }
      showToast(nextMuted ? "Microphone Muted" : "Microphone Active", "info");
    } catch (err: any) {
      console.warn("Backend mute sync notice:", err);
    } finally {
      setIsMuteLoading(false);
    }
  }, [isMuted, callStatus, currentCallId, isMuteLoading]);

  const handleHoldToggle = useCallback(async () => {
    if (callStatus !== "connected" && callStatus !== "hold") {
      showToast("Hold is only available during an active call", "warning");
      return;
    }
    if (isHoldLoading || isHoldProcessing) return;

    const isCurrentlyHold = callStatus === "hold";
    const targetAction = isCurrentlyHold ? "resume" : "hold";
    const prevStatus = callStatus;

    setIsHoldLoading(true);
    setIsHoldProcessing(true);

    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-action`, {
          action: targetAction
        });
      }
      const finalStatus = isCurrentlyHold ? "connected" : "hold";
      setCallStatus(finalStatus);
      showToast(isCurrentlyHold ? "Call Resumed" : "Call Placed on Hold", "success");
    } catch (err: any) {
      setCallStatus(prevStatus);
      showToast(err.message || `Failed to ${targetAction} call session`, "error");
    } finally {
      setIsHoldLoading(false);
      setIsHoldProcessing(false);
    }
  }, [callStatus, currentCallId, isHoldLoading, isHoldProcessing]);

  const handleToggleSpeaker = useCallback(() => {
    const nextSpeaker = !isSpeaker;
    setIsSpeaker(nextSpeaker);
    showToast(nextSpeaker ? "Speaker Output Enabled" : "Default Earpiece Enabled", "info");
  }, [isSpeaker]);

  const handleTransferCall = async () => {
    if (!transferTarget.trim()) return;
    setIsTransferring(true);
    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/transfer`, { target: transferTarget });
        showToast(`Call transfer initiated to ${transferTarget}`, "success");
        setShowTransferModal(false);
        setTransferTarget("");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to transfer call", "error");
    } finally {
      setIsTransferring(false);
    }
  };

  // SAVE DISPOSITION & NEXT LEAD AUTO-SELECTION
  const handleSaveAndNext = async () => {
    setIsSavingOutcome(true);
    try {
      // Step 1: Save call outcome in backend
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-end`, {
          call_id: currentCallId,
          outcome: disposition,
          duration_seconds: callDuration,
          notes,
          follow_up_date: followUpDate,
          follow_up_time: followUpTime
        });
      }

      // Step 2: Update lead status in real time if selected
      if (selectedLead?._id) {
        let newLeadStatus = "new";
        if (disposition === "interested" || disposition === "converted") newLeadStatus = "closed";
        else if (disposition === "not_interested") newLeadStatus = "closed";
        else if (disposition === "follow_up_required" || disposition === "call_back") newLeadStatus = "follow_up_required";
        else if (disposition === "dnc") newLeadStatus = "closed";

        try {
          await api.patch(`/api/leads/${selectedLead._id}`, {
            status: newLeadStatus,
            notes,
            follow_up_date: followUpDate
          });
        } catch (err) {
          console.warn("Lead patch warning:", err);
        }
      }

      showToast("Call details & disposition saved", "success");

      // Step 3: Find next assigned lead automatically
      const currentIdx = leads.findIndex(l => l._id === selectedLead?._id);
      let nextLead: Lead | null = null;
      if (currentIdx !== -1 && currentIdx < leads.length - 1) {
        nextLead = leads[currentIdx + 1];
      } else {
        // Find first pending/new lead
        nextLead = leads.find(l => l._id !== selectedLead?._id && (l.status === "new" || l.status === "pending")) || leads[0] || null;
      }

      // Reset state for next call
      setCallStatus("ready");
      setAgentStatus("ready");
      setCurrentCallId(null);
      setNotes("");
      setFollowUpDate("");
      setFollowUpTime("");
      setCallDuration(0);

      if (nextLead) {
        handleSelectLead(nextLead);
        showToast(`Next Lead Selected: ${nextLead.name}`, "info");
      } else {
        setSelectedLead(null);
        setOutboundPhone("");
      }

      fetchLeads();
      fetchCallHistory();
    } catch (err: any) {
      showToast(err.message || "Failed to save call disposition", "error");
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const handleQuickCall = async (leadOrPhone: Lead | string) => {
    if (callStatus !== "ready" || isDialing || isDialingRef.current) return;

    let targetPhone = "";
    let targetName = "";
    let targetPoolId = "";
    let targetLeadId = "";

    if (typeof leadOrPhone === "string") {
      targetPhone = leadOrPhone;
    } else if (leadOrPhone && typeof leadOrPhone === "object") {
      targetPhone = leadOrPhone.phone;
      targetName = leadOrPhone.name;
      targetPoolId = leadOrPhone.pool_id || "";
      targetLeadId = leadOrPhone._id;
      setSelectedLead(leadOrPhone);
    }

    const sanitized = sanitizeMobileNumber(targetPhone);
    if (!sanitized || sanitized.length < 10) {
      showToast("Enter a valid 10-digit Indian mobile number before placing Quick Call", "error");
      return;
    }

    setOutboundPhone(sanitized);
    setCallMode("ai");
    setQuickCallingLeadId(targetLeadId || "active");
    setActiveSlideOver("dialer");
    isDialingRef.current = true;
    setIsDialing(true);
    setCallStatus("dialing");
    setAgentStatus("on_call");
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);

    const fullPhoneNumber = `+91${sanitized}`;
    const idempotencyKey = `quick_${user?.id || 'agent'}_${sanitized}_${Date.now()}`;

    try {
      const res = await api.post("/api/calls/vapi-dial", {
        phone: fullPhoneNumber,
        name: targetName || `Quick Lead - ${sanitized}`,
        pool_id: targetPoolId || user?.pool_id || "general",
        idempotency_key: idempotencyKey
      });

      if (res && res.success !== false) {
        const vapiCallId = res.callId || res.vapi_call_id || res.id || res._id || "vapi-call";
        setCurrentCallId(res.id || res._id || res.call_id || vapiCallId);
        setCallStatus("connected");
        setAgentStatus("on_call");
        setCallDuration(0);
        showToast(res.message || `Vapi AI Call connected (ID: ${vapiCallId})`, "success");
      } else {
        const errMsg = res?.details || res?.error || "Vapi Call creation failed";
        showToast(errMsg, "error");
        setCallStatus("ready");
        setAgentStatus("ready");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to initiate Vapi Quick Call", "error");
      setCallStatus("ready");
      setAgentStatus("ready");
    } finally {
      setQuickCallingLeadId(null);
      isDialingRef.current = false;
      setIsDialing(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (ds: string) => {
    if (!ds) return "N/A";
    return new Date(ds).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatCallTime = (dateStr?: string) => {
    if (!dateStr) return "Just now";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today, ${timeFormatted}`;
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  const filteredCallHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return callHistory;
    const q = historySearchQuery.toLowerCase();
    return callHistory.filter((item) => {
      const phoneMatch = (item.phone || item.phone_number || "").toLowerCase().includes(q);
      const nameMatch = (item.lead_name || "").toLowerCase().includes(q);
      const outcomeMatch = (item.outcome || item.status || "").toLowerCase().includes(q);
      return phoneMatch || nameMatch || outcomeMatch;
    });
  }, [callHistory, historySearchQuery]);

  const renderOutcomeBadge = (outcomeStr?: string) => {
    const norm = (outcomeStr || "completed").toLowerCase();
    if (norm === "qualified" || norm === "answered" || norm === "connected" || norm === "converted" || norm === "interested") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {norm.replace("_", " ")}
        </span>
      );
    }
    if (norm === "no_answer" || norm === "no-answer" || norm === "busy" || norm === "failed" || norm === "wrong_number") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 inline-flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {norm.replace("_", " ")}
        </span>
      );
    }
    if (norm === "not_interested" || norm === "dnc") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 inline-flex items-center gap-1">
          {norm.replace("_", " ")}
        </span>
      );
    }
    if (norm === "follow_up_required" || norm === "call_back" || norm === "follow_up") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {norm.replace("_", " ")}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 inline-flex items-center gap-1">
        {norm.replace("_", " ")}
      </span>
    );
  };

  // Render 3x4 Numeric Keypad
  const renderKeypad = () => (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mx-auto my-2">
      {[
        { d: "1", l: "" }, { d: "2", l: "ABC" }, { d: "3", l: "DEF" },
        { d: "4", l: "GHI" }, { d: "5", l: "JKL" }, { d: "6", l: "MNO" },
        { d: "7", l: "PQRS" }, { d: "8", l: "TUV" }, { d: "9", l: "WXYZ" },
        { d: "*", l: "" }, { d: "0", l: "+" }, { d: "#", l: "" }
      ].map((key) => (
        <button
          key={key.d}
          type="button"
          onClick={() => handleKeypadPress(key.d)}
          disabled={callStatus !== "ready" && callStatus !== "connected"}
          className="h-[64px] w-[64px] sm:h-[68px] sm:w-[68px] mx-auto flex flex-col items-center justify-center rounded-[14px] bg-white dark:bg-[#1A2438] border border-slate-200/90 dark:border-white/10 hover:border-[#F4B400] hover:shadow-2xs hover:scale-[1.02] active:scale-95 active:bg-amber-50 dark:active:bg-amber-500/20 transition-all duration-150 cursor-pointer group disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed select-none shadow-2xs"
        >
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
            {key.d}
          </span>
          {key.l && (
            <span className="text-[10px] font-black text-[#F4B400] tracking-widest leading-none mt-0.5 uppercase">
              {key.l}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // Helper to render softphone dialer inside slide-over drawer
  const renderDialerPanel = () => (
    <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 p-4 flex flex-col justify-between shadow-xs">
      {/* Dialer Header */}
      <div className="w-full">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4.5 w-4.5 text-amber-500" />
            <h2 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              MANUAL DIALER
            </h2>
          </div>

          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
            agentStatus === "ready" ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400" :
            agentStatus === "on_call" ? "bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 animate-pulse" :
            agentStatus === "wrap_up" ? "bg-purple-50 text-purple-600 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400" :
            "bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-500/15 dark:text-rose-400"
          }`}>
            {agentStatus === "ready" ? "READY" : agentStatus.replace("_", " ")}
          </span>
        </div>

        {/* Selected Customer Info */}
        {selectedLead && (
          <div className="mb-2.5 p-2.5 bg-blue-50/70 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Selected Customer</p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">{selectedLead.name}</p>
                <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{maskPhoneNumber(selectedLead.phone)}</p>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {selectedLead.source || "Manual"}
              </span>
            </div>
          </div>
        )}

        {/* Mobile Number Input Box */}
        <div className="mb-2.5">
          <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            TARGET MOBILE NUMBER
          </label>
          <div className="relative h-[46px] flex items-center bg-slate-50/90 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={outboundPhone}
              onChange={(e) => {
                if (callStatus !== "ready") return;
                setOutboundPhone(sanitizeMobileNumber(e.target.value));
              }}
              readOnly={callStatus !== "ready"}
              placeholder="Enter 10-digit number"
              className="w-full bg-transparent text-center font-mono font-extrabold text-base text-slate-900 dark:text-white outline-none tracking-widest placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:font-medium placeholder:tracking-normal"
            />
            {callStatus === "ready" && outboundPhone.length > 0 && (
              <button
                type="button"
                onClick={() => setOutboundPhone("")}
                className="h-6 w-6 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 flex items-center justify-center cursor-pointer transition shrink-0 ml-1"
                title="Clear number"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-1 text-center">
            {outboundPhone.length > 0 && !isValidMobile ? (
              <p className="text-[10px] font-bold text-rose-500 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>Must be 10 digits starting with 6-9</span>
              </p>
            ) : (
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Enter 10-digit mobile number
              </p>
            )}
          </div>
        </div>

        {/* Call Mode Switcher */}
        {callStatus === "ready" && (
          <div className="mb-2.5 h-[44px] p-1 bg-slate-100/90 dark:bg-slate-800 rounded-xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setCallMode("human")}
              className={`flex-1 h-[34px] text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                callMode === "human"
                  ? "bg-[#F4B400] text-[#123E8A] shadow-2xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Agent Call
            </button>
            <button
              type="button"
              onClick={() => setCallMode("ai")}
              className={`flex-1 h-[34px] text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                callMode === "ai"
                  ? "bg-purple-600 text-white shadow-2xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bot className="h-3.5 w-3.5" /> Vapi AI Call
            </button>
          </div>
        )}

        {/* Keypad */}
        {callStatus === "ready" && renderKeypad()}

        {/* Calling / Ringing */}
        {(callStatus === "dialing" || callStatus === "ringing") && (
          <div className="my-5 text-center">
            <div className="relative h-16 w-16 mx-auto mb-2">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              <div className="relative h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                {callStatus === "dialing" ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Phone className="h-8 w-8 text-white animate-bounce" />
                )}
              </div>
            </div>
            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {callStatus === "dialing" ? "Initiating Call..." : "Ringing Customer..."}
            </p>
            <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">{maskPhoneNumber(outboundPhone)}</p>
          </div>
        )}

        {/* Connected / Hold */}
        {(callStatus === "connected" || callStatus === "hold") && (
          <div className="my-3 text-center">
            <div className={`h-14 w-14 rounded-full mx-auto flex items-center justify-center mb-1.5 border-2 ${
              callStatus === "hold"
                ? "bg-amber-500/10 border-amber-500 text-amber-500"
                : "bg-emerald-500/10 border-emerald-500 text-emerald-500"
            }`}>
              {callStatus === "hold" ? <Pause className="h-7 w-7 animate-pulse" /> : <User className="h-7 w-7" />}
            </div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">
              {callStatus === "hold" ? "Call On Hold" : "Connected Live"}
            </p>
            <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatTime(callDuration)}
            </p>

            {showInCallKeypad && renderKeypad()}
          </div>
        )}

        {/* Wrap-up Disposition */}
        {callStatus === "wrapup" && (
          <div className="my-2 p-3 bg-slate-50 dark:bg-[#172033] rounded-xl border border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200 dark:border-white/10">
              <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                After-Call Work (Wrap-up)
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                Call Disposition *
              </label>
              <CustomSelect
                value={disposition}
                onChange={setDisposition}
                options={DISPOSITION_OPTIONS}
                placeholder="Select Disposition"
                triggerClassName="h-8 rounded-lg text-xs dark:bg-slate-800 dark:text-white dark:border-white/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                  Follow-up Time
                </label>
                <input
                  type="time"
                  value={followUpTime}
                  onChange={e => setFollowUpTime(e.target.value)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                Customer Notes
              </label>
              <textarea
                placeholder="Log customer response..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-900 dark:text-white resize-none outline-none"
              />
            </div>

            <button
              onClick={handleSaveAndNext}
              disabled={isSavingOutcome}
              className="w-full h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSavingOutcome ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save &amp; Next Lead →</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="w-full mt-2 pt-2 border-t border-slate-100 dark:border-white/10">
        {callStatus === "ready" && (
          <button
            type="button"
            onClick={handleDial}
            disabled={!isValidMobile || isCreatingLead || isDialing}
            className="w-full h-[46px] bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-extrabold text-sm shadow-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {isDialing || isCreatingLead ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting Call...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 fill-current" /> Call Customer
              </>
            )}
          </button>
        )}

        {(callStatus === "dialing" || callStatus === "ringing") && (
          <button
            onClick={handleHangup}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-extrabold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PhoneOff className="h-4 w-4 fill-current" /> Cancel Dialing
          </button>
        )}

        {(callStatus === "connected" || callStatus === "hold") && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={handleMuteToggle}
                disabled={isMuteLoading}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                  isMuted
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                }`}
                title="Mute/Unmute Mic"
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span className="text-[8px] font-black uppercase">{isMuted ? "Muted" : "Mute"}</span>
              </button>

              <button
                onClick={handleHoldToggle}
                disabled={isHoldLoading || isHoldProcessing}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                  callStatus === "hold"
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                }`}
                title="Hold/Resume Call"
              >
                {callStatus === "hold" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                <span className="text-[8px] font-black uppercase">{callStatus === "hold" ? "Resume" : "Hold"}</span>
              </button>

              <button
                onClick={() => setShowInCallKeypad(!showInCallKeypad)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                  showInCallKeypad
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                }`}
                title="Keypad DTMF"
              >
                <Hash className="h-3.5 w-3.5" />
                <span className="text-[8px] font-black uppercase">Keypad</span>
              </button>

              <button
                onClick={() => setShowTransferModal(true)}
                className="p-2 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                title="Transfer Call"
              >
                <PhoneForwarded className="h-3.5 w-3.5" />
                <span className="text-[8px] font-black uppercase">Transfer</span>
              </button>
            </div>

            <button
              onClick={handleHangup}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <PhoneOff className="h-4 w-4 fill-current" /> End Call
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto h-[calc(100vh-85px)] flex flex-col font-sans pb-4">

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">

          {/* ---------------- OUTBOUND BPO WORKSPACE TAB ---------------- */}
          {activeTab === "outbound" && (
            <motion.div
              key="outbound"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-3"
            >
              {/* ── FULL-WIDTH SOFTPHONE DIALER WORKSPACE ── */}
              <div className="w-full flex-1 flex flex-col gap-3 overflow-hidden h-full min-w-0">

                {/* Primary Softphone Dialer Workstation Box */}
                <div className="bg-white dark:bg-[#111827] rounded-[20px] border border-slate-200 dark:border-white/10 p-5 flex-1 flex flex-col items-center overflow-y-auto no-scrollbar shadow-2xs relative w-full">

                  {/* Top Header & Agent Status Bar */}
                  <div className="w-full flex justify-between items-center mb-4 shrink-0 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-2xs">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                            Softphone Dialer Workstation
                          </h2>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Live Station
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Manual Outbound Dialing · Agent &amp; AI Call Modes · Real-time Call Console
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Agent Status Selector Dropdown */}
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#182233] p-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-2xs">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
                        <select
                          value={agentStatus}
                          onChange={(e) => setAgentStatus(e.target.value as AgentStatus)}
                          className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                          <option value="ready" className="text-slate-900 bg-white">🟢 Ready</option>
                          <option value="on_call" className="text-slate-900 bg-white">🟡 On Call</option>
                          <option value="wrap_up" className="text-slate-900 bg-white">🟠 Wrap-up</option>
                          <option value="break" className="text-slate-900 bg-white">🔴 On Break</option>
                        </select>
                      </div>

                      <button
                        onClick={fetchLeads}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 transition cursor-pointer border border-slate-200/80 dark:border-white/10"
                        title="Refresh Workstation"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoadingLeads ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Relative Container for Centered Dialer + Right Floating Action Rail */}
                  <div className="relative flex-1 w-full flex items-center justify-center min-h-0 py-2">

                    {/* Centered Softphone Dialer Core Card */}
                    <div className="w-full max-w-[420px] bg-slate-50/60 dark:bg-[#172033]/60 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs flex flex-col justify-between my-auto">
                      
                      {/* Selected Customer Info Badge */}
                      {selectedLead && (
                        <div className="mb-3 p-3 bg-blue-50/80 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Target Customer</p>
                              <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">{selectedLead.name}</p>
                              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{maskPhoneNumber(selectedLead.phone)}</p>
                            </div>
                            <button
                              onClick={() => setSelectedLead(null)}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Target Mobile Input */}
                      <div className="mb-3">
                        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          TARGET MOBILE NUMBER
                        </label>
                        <div className="relative h-[48px] flex items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-xl px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xs">
                          <span className="text-xs font-bold text-slate-400 mr-2 border-r pr-2 border-slate-200 dark:border-white/10">+91</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            value={outboundPhone}
                            onChange={(e) => {
                              if (callStatus !== "ready") return;
                              setOutboundPhone(sanitizeMobileNumber(e.target.value));
                            }}
                            readOnly={callStatus !== "ready"}
                            placeholder="Enter 10-digit number"
                            className="w-full bg-transparent font-mono font-extrabold text-base text-slate-900 dark:text-white outline-none tracking-widest placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:font-medium placeholder:tracking-normal"
                          />
                          {callStatus === "ready" && outboundPhone.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOutboundPhone("")}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 flex items-center justify-center cursor-pointer transition shrink-0 ml-1"
                              title="Clear number"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="mt-1 text-center">
                          {outboundPhone.length > 0 && !isValidMobile ? (
                            <p className="text-[10px] font-bold text-rose-500 flex items-center justify-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>Must be 10 digits starting with 6-9</span>
                            </p>
                          ) : (
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              Enter 10-digit mobile number
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Call Mode Switcher */}
                      {callStatus === "ready" && (
                        <div className="mb-3 h-[46px] p-1 bg-white dark:bg-[#111827] rounded-xl flex items-center gap-1 border border-slate-200/80 dark:border-white/10 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setCallMode("human")}
                            className={`flex-1 h-[36px] text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                              callMode === "human"
                                ? "bg-[#F4B400] text-[#123E8A] shadow-2xs font-black"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <User className="h-4 w-4" /> Agent Call
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallMode("ai")}
                            className={`flex-1 h-[36px] text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                              callMode === "ai"
                                ? "bg-purple-600 text-white shadow-2xs font-black"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <Bot className="h-4 w-4" /> Vapi AI Call
                          </button>
                        </div>
                      )}

                      {/* Keypad Grid */}
                      {callStatus === "ready" && renderKeypad()}

                      {/* Calling / Ringing */}
                      {(callStatus === "dialing" || callStatus === "ringing") && (
                        <div className="my-5 text-center">
                          <div className="relative h-16 w-16 mx-auto mb-2">
                            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                            <div className="relative h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                              {callStatus === "dialing" ? (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                              ) : (
                                <Phone className="h-8 w-8 text-white animate-bounce" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            {callStatus === "dialing" ? "Initiating Call..." : "Ringing Customer..."}
                          </p>
                          <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">{maskPhoneNumber(outboundPhone)}</p>
                        </div>
                      )}

                      {/* Connected / Hold */}
                      {(callStatus === "connected" || callStatus === "hold") && (
                        <div className="my-3 text-center">
                          <div className={`h-14 w-14 rounded-full mx-auto flex items-center justify-center mb-1.5 border-2 ${
                            callStatus === "hold"
                              ? "bg-amber-500/10 border-amber-500 text-amber-500"
                              : "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                          }`}>
                            {callStatus === "hold" ? <Pause className="h-7 w-7 animate-pulse" /> : <User className="h-7 w-7" />}
                          </div>
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {callStatus === "hold" ? "Call On Hold" : "Connected Live"}
                          </p>
                          <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatTime(callDuration)}
                          </p>

                          {showInCallKeypad && renderKeypad()}
                        </div>
                      )}

                      {/* Wrap-up Disposition */}
                      {callStatus === "wrapup" && (
                        <div className="my-2 p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/10 space-y-2.5">
                          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200 dark:border-white/10">
                            <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                              After-Call Work (Wrap-up)
                            </p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                              Call Disposition *
                            </label>
                            <CustomSelect
                              value={disposition}
                              onChange={setDisposition}
                              options={DISPOSITION_OPTIONS}
                              placeholder="Select Disposition"
                              triggerClassName="h-8 rounded-lg text-xs dark:bg-slate-800 dark:text-white dark:border-white/10"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                                Follow-up Date
                              </label>
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={e => setFollowUpDate(e.target.value)}
                                className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                                Follow-up Time
                              </label>
                              <input
                                type="time"
                                value={followUpTime}
                                onChange={e => setFollowUpTime(e.target.value)}
                                className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                              Customer Notes
                            </label>
                            <textarea
                              placeholder="Log customer response..."
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              rows={2}
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-900 dark:text-white resize-none outline-none"
                            />
                          </div>

                          <button
                            onClick={handleSaveAndNext}
                            disabled={isSavingOutcome}
                            className="w-full h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {isSavingOutcome ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            <span>Save Disposition</span>
                          </button>
                        </div>
                      )}

                      {/* Main Dial Action Button Bar */}
                      <div className="w-full mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                        {callStatus === "ready" && (
                          <button
                            type="button"
                            onClick={handleDial}
                            disabled={!isValidMobile || isCreatingLead || isDialing}
                            className="w-full h-[48px] bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-extrabold text-sm shadow-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                          >
                            {isDialing || isCreatingLead ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Starting Call...
                              </>
                            ) : (
                              <>
                                <Phone className="h-4 w-4 fill-current" /> Call Customer
                              </>
                            )}
                          </button>
                        )}

                        {(callStatus === "dialing" || callStatus === "ringing") && (
                          <button
                            onClick={handleHangup}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-extrabold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <PhoneOff className="h-4 w-4 fill-current" /> Cancel Dialing
                          </button>
                        )}

                        {(callStatus === "connected" || callStatus === "hold") && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-1.5">
                              <button
                                onClick={handleMuteToggle}
                                disabled={isMuteLoading}
                                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                                  isMuted
                                    ? "bg-amber-500 text-white border-amber-600"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                                }`}
                                title="Mute/Unmute Mic"
                              >
                                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                                <span className="text-[8px] font-black uppercase">{isMuted ? "Muted" : "Mute"}</span>
                              </button>

                              <button
                                onClick={handleHoldToggle}
                                disabled={isHoldLoading || isHoldProcessing}
                                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                                  callStatus === "hold"
                                    ? "bg-amber-500 text-white border-amber-600"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                                }`}
                                title="Hold/Resume Call"
                              >
                                {callStatus === "hold" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                <span className="text-[8px] font-black uppercase">{callStatus === "hold" ? "Resume" : "Hold"}</span>
                              </button>

                              <button
                                onClick={() => setShowInCallKeypad(!showInCallKeypad)}
                                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                                  showInCallKeypad
                                    ? "bg-blue-600 text-white border-blue-700"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                                }`}
                                title="Keypad DTMF"
                              >
                                <Hash className="h-3.5 w-3.5" />
                                <span className="text-[8px] font-black uppercase">Keypad</span>
                              </button>

                              <button
                                onClick={() => setShowTransferModal(true)}
                                className="p-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                                title="Transfer Call"
                              >
                                <PhoneForwarded className="h-3.5 w-3.5" />
                                <span className="text-[8px] font-black uppercase">Transfer</span>
                              </button>
                            </div>

                            <button
                              onClick={handleHangup}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <PhoneOff className="h-4 w-4 fill-current" /> End Call
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Floating Action Rail on Right Edge */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5 py-3 px-1.5 bg-white/95 dark:bg-[#172033]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-full shadow-md">
                      {/* 👤 User Profile Icon */}
                      <div className="relative group">
                        <button
                          onClick={() => setActiveSlideOver(activeSlideOver === "profile" ? null : "profile")}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            activeSlideOver === "profile"
                              ? "bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-400/50 scale-105"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          <User className="h-4.5 w-4.5" />
                        </button>
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                          User Profile
                        </div>
                      </div>

                      {/* 📞 Call History Icon */}
                      <div className="relative group">
                        <button
                          onClick={() => setActiveSlideOver(activeSlideOver === "history" ? null : "history")}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            activeSlideOver === "history"
                              ? "bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-400/50 scale-105"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          <PhoneCall className="h-4.5 w-4.5" />
                        </button>
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                          Call History
                        </div>
                      </div>

                      {/* 📝 Disposition Icon */}
                      <div className="relative group">
                        <button
                          onClick={() => setActiveSlideOver(activeSlideOver === "disposition" ? null : "disposition")}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            activeSlideOver === "disposition"
                              ? "bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-400/50 scale-105"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          <FileText className="h-4.5 w-4.5" />
                        </button>
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                          Disposition
                        </div>
                      </div>

                      {/* 📋 Call Logs Icon */}
                      <div className="relative group">
                        <button
                          onClick={() => setActiveSlideOver(activeSlideOver === "logs" ? null : "logs")}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            activeSlideOver === "logs"
                              ? "bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-400/50 scale-105"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          <ListOrdered className="h-4.5 w-4.5" />
                        </button>
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                          Call Logs
                        </div>
                      </div>
                    </div>

                    {/* RIGHT SLIDE-OVER PANEL */}
                    <LeadActionSlideOver
                      activeTab={activeSlideOver}
                      onClose={() => setActiveSlideOver(null)}
                      onSelectTab={setActiveSlideOver}
                      selectedLead={selectedLead || (filteredLeads.length > 0 ? filteredLeads[0] : null)}
                      callHistory={callHistory}
                      onQuickCall={handleQuickCall}
                      onSaveDisposition={handleSaveSlideOverDisposition}
                      isSavingDisposition={isSavingSlideOverDisp}
                      showToast={showToast}
                      user={user}
                      dialerComponent={renderDialerPanel()}
                    />
                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* ---------------- INBOUND QUEUE TAB ---------------- */}
          {activeTab === "inbound" && (
            <motion.div
              key="inbound"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex items-center justify-center p-6 bg-white dark:bg-[#111827] rounded-[20px] border border-slate-200 dark:border-white/10 shadow-2xs"
            >
              <div className="text-center max-w-sm">
                <div className="h-20 w-20 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4 relative shadow-md">
                  <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
                  <Ear className="h-9 w-9 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-black mb-1">
                  <span className="text-blue-600 dark:text-blue-400">Inbound Queue </span>
                  <span className="text-amber-500">Active</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                  Available to receive incoming calls from customers &amp; transfers.
                </p>
              </div>
            </motion.div>
          )}

          {/* ---------------- SUPERVISOR MONITORING TAB ---------------- */}
          {activeTab === "supervisor" && isSupervisor && (
            <motion.div
              key="supervisor"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Active Calls</p>
                  <p className="text-2xl font-black text-emerald-500">0</p>
                </div>
                <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Agents Online</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">12</p>
                </div>
                <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Today Calls</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{todayStats.total}</p>
                </div>
                <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Avg Handle Time</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">2m 14s</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------------- FULL CALL LOGS HISTORY TAB ---------------- */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full bg-white dark:bg-[#111827] rounded-[20px] border border-slate-200 dark:border-white/10 shadow-2xs p-5 flex flex-col overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      Recent Call Logs History
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Real-time call records and disposition logs ({callHistory.length} total)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search phone or status..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="h-8 pl-3 pr-3 text-xs rounded-lg bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none w-48"
                  />
                  <button
                    onClick={fetchCallHistory}
                    className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 overflow-y-auto softphone-scrollbar">
                <table className="w-full text-left text-xs border-separate border-spacing-y-1">
                  <thead className="bg-slate-50 dark:bg-[#172033] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 rounded-l-lg">Masked Phone</th>
                      <th className="px-3 py-2.5">Lead / Customer</th>
                      <th className="px-3 py-2.5">Outcome</th>
                      <th className="px-3 py-2.5">Duration</th>
                      <th className="px-3 py-2.5 rounded-r-lg">Call Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCallHistory.map((item) => (
                      <tr
                        key={item.id || item._id}
                        className="bg-slate-50/60 dark:bg-[#172033]/60 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-[#1A2438] transition rounded-lg"
                      >
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                          {maskPhoneNumber(item.phone || item.phone_number)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                          {item.lead_name || "Manual Lead"}
                        </td>
                        <td className="px-3 py-2">
                          {renderOutcomeBadge(item.outcome || item.status)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {formatDuration(item.duration_seconds || item.duration)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {formatCallTime(item.started_at || item.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Transfer Modal Dialog */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-blue-600" /> Transfer Live Call
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Enter target agent ID or phone number to transfer the active call session.
            </p>

            <input
              type="text"
              placeholder="Enter Agent ID or +91 Phone"
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferCall}
                disabled={isTransferring || !transferTarget.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTransferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Advanced Lead Filter Modal */}
      <LeadFilterModal
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filterUserId={filterUserId}
        setFilterUserId={setFilterUserId}
        filterPhone={filterPhone}
        setFilterPhone={setFilterPhone}
        filterStatus={statusFilter}
        setFilterStatus={setStatusFilter}
        filterSource={filterSource}
        setFilterSource={setFilterSource}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        filterAgent={filterAgent}
        setFilterAgent={setFilterAgent}
        onApply={() => setIsFilterPanelOpen(false)}
        onClearAll={resetAllFilters}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}
