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
import CallEventTimeline, { CallEventItem, CallEventType } from "../components/CallEventTimeline";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOutgoing,
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
  Smartphone,
  X,
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
  ChevronDown,
  Coffee,
  Check,
  Share2,
  Send,
  Zap,
  TrendingUp,
  Sliders,
  PhoneMissed,
  FileText
} from "lucide-react"; // Verified single import of icons

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
  events?: CallEventItem[];
};

export default function Dialer() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("outbound");

  // AGENT STATE
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");

  // OUTBOUND / INBOUND DIALER MODE STATE
  const [dialerMode, setDialerMode] = useState<"outbound" | "inbound">("outbound");
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

  // INCOMING & INBOUND ACD QUEUE STATE
  type QueuedInboundCall = {
    id: string;
    phone: string;
    name: string;
    queuedAt: number;
    department?: string;
  };
  const [incomingCall, setIncomingCall] = useState<{ id: string; phone: string; name: string } | null>(null);
  const [inboundQueue, setInboundQueue] = useState<QueuedInboundCall[]>([]);
  const [queueWaitSeconds, setQueueWaitSeconds] = useState<number>(0);
  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState<boolean>(true);

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

  // CALL METHOD & SIM SELECTION MODAL STATE
  const [showCallMethodModal, setShowCallMethodModal] = useState(false);
  const [selectedCallMethod, setSelectedCallMethod] = useState<"human" | "ai">("human");
  const [selectedSim, setSelectedSim] = useState<"sim1" | "sim2">("sim1");

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

  // BPO AGENT STATUS SELECTOR STATE
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutsideStatus(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideStatus);
    return () => document.removeEventListener("mousedown", handleClickOutsideStatus);
  }, []);

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
        const activeRes = await api.get("/api/calls/active").catch(() => null);
        const active = Array.isArray(activeRes) ? activeRes[0] : activeRes;
        if (active && (active.id || active._id)) {
          setCurrentCallId(active.id || active._id);
          if (active.phone) {
            setOutboundPhone(sanitizeMobileNumber(active.phone));
          }
          setCallStatus(active.call_state === "hold" ? "hold" : "connected");
          setAgentStatus("on_call");
        }
      } catch (err) {
        // Silent catch
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
            if (data.event === "inbound_call_auto_answered") {
              const cleanPhone = (data.phone || "9876543210").replace(/\D/g, "").slice(-10);
              setCurrentCallId(data.call_id);
              setOutboundPhone(cleanPhone);
              setCallStatus("connected");
              setAgentStatus("on_call");
              setCallDuration(0);
              setIsMuted(false);
              setIsSpeaker(false);
              setIsDialing(false);
              isDialingRef.current = false;
              setInboundQueue(prev => prev.filter(c => c.id !== data.call_id && c.phone !== cleanPhone));
              showToast(`Inbound Call Connected: Call from ${data.lead_name || 'Customer'} (+91 ${cleanPhone})`, "success");
            }
            if (data.event === "inbound_call_queued") {
              const cleanPhone = (data.phone || "9876543210").replace(/\D/g, "").slice(-10);
              const newQueued: QueuedInboundCall = {
                id: data.call_id || `acd_inc_${Date.now()}`,
                phone: cleanPhone,
                name: data.lead_name || "Banking Customer",
                queuedAt: Date.now(),
                department: data.pool_id || "Banking Customer Care"
              };
              setInboundQueue(prev => [...prev.filter(c => c.id !== newQueued.id), newQueued]);
              showToast(`📥 Inbound Call Queued (Position #${data.queue_position || 1})`, "warning");
            }
            if (data.event === "agent_status_changed") {
              if (data.status) {
                setAgentStatus(data.status === "wrapup" ? "wrap_up" : data.status);
              }
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

  // INBOUND ACD ENGINE CONNECT & DISPATCH LOGIC
  const connectInboundCall = useCallback((callItem: QueuedInboundCall) => {
    const cleanPhone = sanitizeMobileNumber(callItem.phone) || "9876543210";
    const matched = leads.find(l => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);

    setCurrentCallId(callItem.id);
    setOutboundPhone(cleanPhone);
    if (matched) {
      setSelectedLead(matched);
    }
    setCallStatus("connected");
    setAgentStatus("on_call");
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);
    setIsDialing(false);
    isDialingRef.current = false;

    // Remove from queue if present
    setInboundQueue(prev => prev.filter(c => c.id !== callItem.id));
  }, [leads, sanitizeMobileNumber]);

  const handleInboundACDCall = useCallback(async (customPhone?: string, customName?: string) => {
    const targetPhone = customPhone || outboundPhone || "9876543210";
    const cleanPhone = sanitizeMobileNumber(targetPhone) || "9876543210";
    const matched = leads.find(l => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
    const callerName = customName || matched?.name || `Banking Inbound Customer (${cleanPhone})`;

    try {
      const res = await api.post("/api/calls/inbound/acd", {
        phone: cleanPhone,
        name: callerName,
        pool_id: selectedLead?.pool_id || "banking_customer_care",
        auto_answer: autoAnswerEnabled
      });

      const data = res.data;
      if (data.status === "connected") {
        if (autoAnswerEnabled && agentStatus === "ready") {
          setCurrentCallId(data.call?._id || data.call_id);
          setOutboundPhone(cleanPhone);
          if (data.lead) setSelectedLead(data.lead);
          setCallStatus("connected");
          setAgentStatus("on_call");
          setCallDuration(0);
          setIsMuted(false);
          setIsSpeaker(false);
          setIsDialing(false);
          isDialingRef.current = false;
          showToast(`Inbound Call Connected: Call from ${data.lead?.name || callerName} (+91 ${cleanPhone})`, "success");
        } else {
          setIncomingCall({ id: data.call?._id || `inc_${Date.now()}`, phone: cleanPhone, name: data.lead?.name || callerName });
          setOutboundPhone(cleanPhone);
          if (data.lead) setSelectedLead(data.lead);
          setCallStatus("ringing");
          showToast(`Incoming Line Ringing: ${callerName} (+91 ${cleanPhone})`, "info");
        }
      } else if (data.status === "queued") {
        const newCall: QueuedInboundCall = {
          id: data.call_id || `acd_inc_${Date.now()}`,
          phone: cleanPhone,
          name: data.lead?.name || callerName,
          queuedAt: Date.now(),
          department: "Banking Customer Care"
        };
        setInboundQueue(prev => [...prev.filter(c => c.id !== newCall.id), newCall]);
        showToast(`Inbound Call Queued (Position #${data.queue_position || inboundQueue.length + 1})`, "warning");
      }
    } catch (err) {
      // Local fallback
      const newCall: QueuedInboundCall = {
        id: `acd_inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        phone: cleanPhone,
        name: callerName,
        queuedAt: Date.now(),
        department: "Banking Customer Care"
      };

      setOutboundPhone(cleanPhone);
      if (matched) setSelectedLead(matched);

      if (agentStatus === "ready" && (callStatus === "ready" || callStatus === "wrapup")) {
        if (autoAnswerEnabled) {
          connectInboundCall(newCall);
          showToast(`Inbound Call Connected: Call from ${callerName} (+91 ${cleanPhone})`, "success");
        } else {
          setIncomingCall({ id: newCall.id, phone: cleanPhone, name: callerName });
          setCallStatus("ringing");
          showToast(`Incoming Line Ringing: ${callerName} (+91 ${cleanPhone})`, "info");
        }
      } else {
        setInboundQueue(prev => [...prev, newCall]);
        showToast(`Inbound Call Queued (Position #${inboundQueue.length + 1})`, "warning");
      }
    }
  }, [agentStatus, callStatus, outboundPhone, leads, inboundQueue.length, connectInboundCall, sanitizeMobileNumber, autoAnswerEnabled, selectedLead]);

  const updateAgentBPOStatus = async (newStatus: AgentStatus) => {
    setAgentStatus(newStatus);
    try {
      const res = await api.patch(`/api/users/status?status_val=${newStatus}`);
      if (res.data?.auto_connected_call) {
        showToast("Inbound Call Connected!", "success");
      } else {
        showToast(`Agent Status Updated: ${newStatus.replace("_", " ").toUpperCase()}`, "info");
      }
    } catch (err) {
      console.warn("Status patch warning:", err);
    }
  };

  const handleAnswerRingingCall = () => {
    setCallStatus("connected");
    setAgentStatus("on_call");
    setCallDuration(0);
    showToast(`Inbound Call Answered & Connected`, "success");
  };

  const handleRejectRingingCall = () => {
    setCallStatus("ready");
    setIncomingCall(null);
    showToast("Inbound Call Rejected / Missed", "warning");
  };

  // AUTO-CONNECT QUEUED CALL WHEN AGENT BECOMES READY
  useEffect(() => {
    if (agentStatus === "ready" && callStatus === "ready" && inboundQueue.length > 0) {
      const nextCall = inboundQueue[0];
      showToast(`Inbound Call Connected: ${nextCall.name} (+91 ${nextCall.phone})`, "success");
      connectInboundCall(nextCall);
    }
  }, [agentStatus, callStatus, inboundQueue, connectInboundCall]);

  // QUEUE WAIT TIME TIMER
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (inboundQueue.length > 0) {
      interval = setInterval(() => {
        setQueueWaitSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setQueueWaitSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inboundQueue.length]);

  // Manual Answer Fallback
  const handleInboundAnswer = () => {
    if (inboundQueue.length > 0) {
      connectInboundCall(inboundQueue[0]);
    } else {
      handleInboundACDCall(outboundPhone, selectedLead?.name);
    }
  };

  // Call Initiation
  const handleDial = async (overrideMode?: "human" | "ai", simSlot: "sim1" | "sim2" = "sim1") => {
    if (!isValidMobile) return;
    if (isDialingRef.current || isDialing) return;
    if (callStatus === "dialing" || callStatus === "ringing" || callStatus === "connected" || callStatus === "hold") return;

    const targetMode = overrideMode || callMode;
    setCallMode(targetMode);

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
    if (targetMode === "ai") {
      try {
        const res = await api.post("/api/calls/vapi-dial", {
          phone: fullPhoneNumber,
          name: matchedLead?.name || `Manual Lead - ${outboundPhone}`,
          pool_id: matchedLead?.pool_id || user?.pool_id || "general",
          idempotency_key: idempotencyKey,
          sim_slot: simSlot
        });
        setCurrentCallId(res.id || res._id || res.call_id || null);
        setCallStatus("connected");
        setAgentStatus("on_call");
        setCallDuration(0);
        isDialingRef.current = false;
        setIsDialing(false);
        fetchLeads();
        fetchCallHistory();
        showToast(`Vapi AI Voice Agent call initiated on ${simSlot === "sim2" ? "SIM 2" : "SIM 1"}`, "success");
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
        call_mode: targetMode,
        sim_slot: simSlot
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

  // REAL-TIME CALL LIFECYCLE EVENT TRACKER
  const pushCallTimelineEvent = useCallback((
    type: CallEventType,
    title: string,
    description: string,
    dotColor?: string
  ) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const eventItem: CallEventItem = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      title,
      description,
      type,
      dotColor
    };

    if (currentCallId) {
      api.post(`/api/calls/${currentCallId}/events`, eventItem).catch(() => {});
      setCallHistory(prev => prev.map(c => {
        if (c.id === currentCallId || c._id === currentCallId) {
          const existingEvents = Array.isArray(c.events) ? c.events : [];
          return { ...c, events: [...existingEvents, eventItem] };
        }
        return c;
      }));
    }
  }, [currentCallId]);

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

    pushCallTimelineEvent(
      "mute",
      nextMuted ? "Agent Muted Audio" : "Agent Unmuted Audio",
      nextMuted ? "Microphone input muted" : "Audio channel unmuted",
      "bg-orange-500 ring-4 ring-orange-100 dark:ring-orange-900/30"
    );

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
  }, [isMuted, callStatus, currentCallId, isMuteLoading, pushCallTimelineEvent]);

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
      pushCallTimelineEvent(
        "hold",
        isCurrentlyHold ? "Call Resumed" : "Call Placed on Hold",
        isCurrentlyHold ? "Audio channel resumed on Line 1" : "Call held on Line 1 by agent",
        isCurrentlyHold ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30" : "bg-orange-500 ring-4 ring-orange-100 dark:ring-orange-900/30"
      );
      showToast(isCurrentlyHold ? "Call Resumed" : "Call Placed on Hold", "success");
    } catch (err: any) {
      setCallStatus(prevStatus);
      showToast(err.message || `Failed to ${targetAction} call session`, "error");
    } finally {
      setIsHoldLoading(false);
      setIsHoldProcessing(false);
    }
  }, [callStatus, currentCallId, isHoldLoading, isHoldProcessing, pushCallTimelineEvent]);

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
        pushCallTimelineEvent(
          "transfer",
          "Call Transfer Initiated",
          `Transferring live call session to extension/agent ${transferTarget}`,
          "bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/30"
        );
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
            onClick={() => setShowCallMethodModal(true)}
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
                <div className="bg-white dark:bg-[#111827] rounded-[12px] border border-slate-200 dark:border-white/10 p-3.5 sm:p-4 flex-1 flex flex-col items-center overflow-y-auto no-scrollbar shadow-2xs relative w-full">

                  {/* Top Header & Agent Status Bar */}
                  <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 shrink-0 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-2xs transition-colors ${
                        dialerMode === "inbound"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}>
                        {dialerMode === "inbound" ? (
                          <PhoneIncoming className="h-5 w-5" />
                        ) : (
                          <PhoneCall className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                            Softphone Dialer Workstation
                          </h2>
                          <span className={`border text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 transition-colors ${
                            dialerMode === "inbound"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full animate-ping ${dialerMode === "inbound" ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {dialerMode === "inbound" ? "Inbound Line Active" : "Live Station"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {dialerMode === "inbound"
                            ? "Inbound Call Receiving Console · Live Queue & Incoming Call Routing"
                            : "Manual Outbound Dialing · Agent & AI Call Modes · Real-time Call Console"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Segmented Control [ Outbound ] [ Inbound ] */}
                      <div className="flex items-center p-1 bg-slate-100 dark:bg-[#182233] rounded-xl border border-slate-200 dark:border-white/10 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setDialerMode("outbound");
                            setLeadDirection("outbound");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                            dialerMode === "outbound"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <PhoneOutgoing className="h-3.5 w-3.5" />
                          <span>Outbound</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDialerMode("inbound");
                            setLeadDirection("inbound");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                            dialerMode === "inbound"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <PhoneIncoming className="h-3.5 w-3.5" />
                          <span>Inbound</span>
                        </button>
                      </div>

                      {/* Modern BPO CRM Agent Status Selector */}
                      <div className="relative inline-block text-left" ref={statusMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                          className="h-9 px-3 bg-white dark:bg-[#182233] hover:bg-slate-50 dark:hover:bg-[#1e2d44] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-[12px] shadow-2xs hover:shadow-xs flex items-center gap-2 transition cursor-pointer active:scale-95"
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            agentStatus === "ready" ? "bg-emerald-500" :
                            agentStatus === "on_call" ? "bg-amber-500" :
                            agentStatus === "wrap_up" ? "bg-orange-500" : "bg-rose-500"
                          }`} />
                          <span className="text-xs font-black tracking-tight">
                            {agentStatus === "ready" ? "Ready" :
                             agentStatus === "on_call" ? "On Call" :
                             agentStatus === "wrap_up" ? "Wrap-up" : "On Break"}
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isStatusMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {isStatusMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#151F32] border border-slate-200 dark:border-white/10 rounded-[12px] shadow-xl p-1 z-50 overflow-hidden"
                            >
                              {[
                                { value: "ready" as AgentStatus, label: "Ready", dot: "bg-emerald-500" },
                                { value: "on_call" as AgentStatus, label: "On Call", dot: "bg-amber-500" },
                                { value: "wrap_up" as AgentStatus, label: "Wrap-up", dot: "bg-orange-500" },
                                { value: "break" as AgentStatus, label: "On Break", dot: "bg-rose-500" },
                              ].map((opt) => {
                                const isSelected = agentStatus === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      updateAgentBPOStatus(opt.value);
                                      setIsStatusMenuOpen(false);
                                    }}
                                    className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-xs transition cursor-pointer ${
                                      isSelected
                                        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-extrabold"
                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2 w-2 rounded-full ${opt.dot} shrink-0`} />
                                      <span>{opt.label}</span>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
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
                        <div className={`mb-3 p-3 rounded-xl border ${
                          dialerMode === "inbound"
                            ? "bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                            : "bg-blue-50/80 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                        }`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-wider ${
                                dialerMode === "inbound" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                              }`}>
                                {dialerMode === "inbound" ? "Inbound Caller Info" : "Target Customer"}
                              </p>
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
                          {dialerMode === "inbound" ? "INBOUND CALLER / LINE NUMBER" : "TARGET MOBILE NUMBER"}
                        </label>
                        <div className="relative h-[48px] flex items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-xl px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xs">
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
                            placeholder={dialerMode === "inbound" ? "Enter caller 10-digit number" : "Enter 10-digit number"}
                            className="w-full bg-transparent font-mono font-extrabold text-base text-slate-900 dark:text-white outline-none tracking-widest text-center placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:font-medium placeholder:tracking-normal"
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
                              {dialerMode === "inbound" ? "Enter caller number or answer incoming line" : "Enter 10-digit mobile number"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Keypad Grid (Outbound Mode) */}
                      {dialerMode === "outbound" && callStatus === "ready" && renderKeypad()}

                      {/* ── INBOUND ACD CALL INTERFACE (REPLACES KEYPAD IN INBOUND MODE) ── */}
                      {dialerMode === "inbound" && (
                        <div className="my-2 space-y-3">

                          {/* CASE 1: INBOUND LINE RINGING (INCOMING CALL CARD MATCHING DESIGN) */}
                          {callStatus === "ringing" && (
                            <div className="bg-white dark:bg-[#111827] rounded-2xl border-2 border-emerald-500 p-5 text-center shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />

                              {/* Call Ring Avatar */}
                              <div className="relative h-16 w-16 mx-auto mb-3 flex items-center justify-center">
                                <div className="relative h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                                  <PhoneIncoming className="h-7 w-7" />
                                </div>
                              </div>

                              {/* Caller Info */}
                              <h3 className="text-base font-black text-slate-900 dark:text-white">
                                {incomingCall?.name || selectedLead?.name || (outboundPhone ? `Incoming Caller (${outboundPhone})` : "Incoming Caller (John Doe)")}
                              </h3>
                              <p className="text-xs font-mono font-extrabold text-slate-500 dark:text-slate-400 mt-0.5">
                                +91 {outboundPhone || incomingCall?.phone || "98765 43210"}
                              </p>

                              {/* Line Ringing Badge */}
                              <div className="mt-3 inline-flex items-center px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-300 dark:border-emerald-500/30">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                  INBOUND LINE RINGING
                                </span>
                              </div>

                              {/* Green Answer & Red Reject Buttons */}
                              <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={handleAnswerRingingCall}
                                  className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                                >
                                  <PhoneIncoming className="h-4 w-4" /> Answer
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRejectRingingCall}
                                  className="h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                                >
                                  <PhoneOff className="h-4 w-4" /> Reject
                                </button>
                              </div>

                              {/* Disabled Secondary Action Matrix: Hold, Mute, Transfer */}
                              <div className="mt-3 grid grid-cols-3 gap-2 opacity-40 pointer-events-none">
                                <div className="py-2 px-1 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                  <Pause className="h-3 w-3" /> Hold
                                </div>
                                <div className="py-2 px-1 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                  <Mic className="h-3 w-3" /> Mute
                                </div>
                                <div className="py-2 px-1 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-[9px] font-black uppercase flex items-center justify-center gap-1">
                                  <PhoneForwarded className="h-3 w-3" /> Transfer
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CASE 2: CALL CONNECTED OR ON HOLD */}
                          {(callStatus === "connected" || callStatus === "hold") && (
                            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 p-4 text-center shadow-2xs relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                              
                              {/* Call Avatar & Wave */}
                              <div className="relative h-16 w-16 mx-auto mb-2 flex items-center justify-center">
                                <div className={`relative h-14 w-14 rounded-full flex items-center justify-center border-2 transition-all shadow-md ${
                                  callStatus === "hold"
                                    ? "bg-amber-500 text-white border-amber-400"
                                    : "bg-emerald-500 text-white border-emerald-400"
                                }`}>
                                  {callStatus === "hold" ? <Pause className="h-7 w-7 animate-pulse" /> : <User className="h-7 w-7" />}
                                </div>
                              </div>

                              {/* Caller Info */}
                              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                {selectedLead?.name || (outboundPhone ? `Customer +91 ${outboundPhone}` : "Inbound Customer")}
                              </h3>
                              <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {outboundPhone ? `+91 ${outboundPhone}` : "+91 98765 43210"}
                              </p>

                              {/* Timer Pill */}
                              <div className="mt-2.5 inline-flex items-center px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-300 dark:border-emerald-500/30">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                  {callStatus === "hold" ? `On Hold: ${formatTime(callDuration)}` : `Connected: ${formatTime(callDuration)}`}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* CASE 3: INBOUND CALL QUEUED (AGENT NOT READY OR BUSY) */}
                          {callStatus === "ready" && inboundQueue.length > 0 && (
                            <div className="bg-amber-50/90 dark:bg-amber-500/10 rounded-2xl border border-amber-300 dark:border-amber-500/30 p-4 text-center shadow-2xs relative overflow-hidden">
                              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/20 pb-2 mb-3">
                                <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  Inbound Queue Position #{1}
                                </span>
                                <span className="text-xs font-mono font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> Wait Time: {formatTime(queueWaitSeconds)}
                                </span>
                              </div>

                              <div className="relative h-12 w-12 mx-auto mb-2 flex items-center justify-center bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-300 dark:border-amber-500/40">
                                <PhoneIncoming className="h-6 w-6 animate-bounce" />
                              </div>

                              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {inboundQueue[0].name}
                              </h3>
                              <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                                +91 {inboundQueue[0].phone}
                              </p>

                              <div className="mt-3 p-2 bg-white/80 dark:bg-[#111827]/80 rounded-xl border border-amber-200 dark:border-amber-500/20 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                Agent Status: <strong className="text-amber-600 dark:text-amber-400 uppercase">{agentStatus.replace(/_/g, " ")}</strong>.
                                <p className="text-[9px] text-slate-400 mt-0.5">Switch status to READY to auto-connect queued call!</p>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateAgentBPOStatus("ready")}
                                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                  Set READY &amp; Connect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInboundQueue(prev => prev.slice(1));
                                    showToast("Queued call dismissed", "info");
                                  }}
                                  className="h-9 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                                >
                                  Dismiss Queue
                                </button>
                              </div>
                            </div>
                          )}

                          {/* CASE 4: STANDBY / READY TO RECEIVE & DISPATCH INBOUND CALLS */}
                          {callStatus === "ready" && inboundQueue.length === 0 && (
                            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 p-4 text-center shadow-2xs relative">
                              <div className="relative h-14 w-14 mx-auto mb-2 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-300 dark:border-emerald-500/30">
                                <PhoneCall className="h-7 w-7" />
                              </div>

                              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Inbound ACD Engine Active
                              </h3>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                Incoming customer calls auto-route and connect to <strong className="text-emerald-600 dark:text-emerald-400">READY</strong> agents instantly without manual clicks.
                              </p>

                              {/* Test Simulation Button */}
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => handleInboundACDCall()}
                                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                  Dispatch Inbound Call
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inbound Call Controls Matrix (Hold, Mute, Transfer, Hangup) */}
                          {callStatus !== "wrapup" && (callStatus === "connected" || callStatus === "hold") && (
                            <div className="space-y-2 pt-1">
                              {/* Controls Row: Hold, Mute, Transfer */}
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={handleHoldToggle}
                                  className={`py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                                    callStatus === "hold"
                                      ? "bg-amber-500 text-white border-amber-600"
                                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  }`}
                                >
                                  {callStatus === "hold" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                  <span className="text-[10px] font-black uppercase">{callStatus === "hold" ? "Resume" : "Hold"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleMuteToggle}
                                  className={`py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                                    isMuted
                                      ? "bg-amber-500 text-white border-amber-600"
                                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  }`}
                                >
                                  {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                                  <span className="text-[10px] font-black uppercase">{isMuted ? "Muted" : "Mute"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setShowTransferModal(true)}
                                  className="py-2.5 px-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                                >
                                  <PhoneForwarded className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-black uppercase">Transfer</span>
                                </button>
                              </div>

                              {/* Reject / Hangup Call Button */}
                              <button
                                type="button"
                                onClick={handleHangup}
                                className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <PhoneOff className="h-4 w-4 fill-current" />
                                <span>End Inbound Call &amp; Open Wrap-up</span>
                              </button>
                            </div>
                          )}

                        </div>
                      )}

                      {/* Outbound Calling / Ringing */}
                      {dialerMode === "outbound" && (callStatus === "dialing" || callStatus === "ringing") && (
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

                      {/* Outbound Connected / Hold */}
                      {dialerMode === "outbound" && (callStatus === "connected" || callStatus === "hold") && (
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

                      {/* Main Dial Action Button Bar (Outbound Mode) */}
                      {dialerMode === "outbound" && (
                        <div className="w-full mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                          {callStatus === "ready" && (
                            <button
                              type="button"
                              onClick={() => setShowCallMethodModal(true)}
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
                      )}
                    </div>

                    {/* Premium Right Floating Action Rail (Auto-hides when any slide-over drawer panel or modal is open) */}
                    <AnimatePresence>
                      {!activeSlideOver && (
                        <motion.div
                          initial={{ opacity: 0, x: 24, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 24, scale: 0.95 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="fixed right-5 sm:right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 sm:gap-2.5 p-2 bg-white/85 dark:bg-[#111827]/90 backdrop-blur-xl border border-white/70 dark:border-white/10 rounded-[20px] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.4)]"
                        >
                          {/* 👤 User Profile Icon */}
                          <div className="relative group">
                            <button
                              type="button"
                              onClick={() => setActiveSlideOver(activeSlideOver === "profile" ? null : "profile")}
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                                activeSlideOver === "profile"
                                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.05]"
                                  : "bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:scale-105 active:scale-95"
                              }`}
                            >
                              <User className="h-5 w-5" />
                            </button>
                            <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-bold rounded-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl z-50 backdrop-blur-xs">
                              User Profile
                            </div>
                          </div>

                          {/* 📞 Call History Icon */}
                          <div className="relative group">
                            <button
                              type="button"
                              onClick={() => setActiveSlideOver(activeSlideOver === "history" ? null : "history")}
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                                activeSlideOver === "history"
                                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.05]"
                                  : "bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:scale-105 active:scale-95"
                              }`}
                            >
                              <PhoneCall className="h-5 w-5" />
                            </button>
                            <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-bold rounded-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl z-50 backdrop-blur-xs">
                              Call History
                            </div>
                          </div>

                          {/* 📝 Disposition Icon */}
                          <div className="relative group">
                            <button
                              type="button"
                              onClick={() => setActiveSlideOver(activeSlideOver === "disposition" ? null : "disposition")}
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                                activeSlideOver === "disposition"
                                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.05]"
                                  : "bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:scale-105 active:scale-95"
                              }`}
                            >
                              <FileText className="h-5 w-5" />
                            </button>
                            <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-bold rounded-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl z-50 backdrop-blur-xs">
                              Lead Disposition
                            </div>
                          </div>

                          {/* 📋 Call Logs Icon */}
                          <div className="relative group">
                            <button
                              type="button"
                              onClick={() => setActiveSlideOver(activeSlideOver === "logs" ? null : "logs")}
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                                activeSlideOver === "logs"
                                  ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.05]"
                                  : "bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:scale-105 active:scale-95"
                              }`}
                            >
                              <ListOrdered className="h-5 w-5" />
                            </button>
                            <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-bold rounded-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl z-50 backdrop-blur-xs">
                              Technical Call Logs
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

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


      {/* Choose Call Method & Select SIM Selection Modal Popup */}
      {showCallMethodModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 p-5 max-w-sm w-full shadow-2xl overflow-hidden relative">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <PhoneCall className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Choose Call Method
                  </h3>
                  <p className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                    Target: +91 {outboundPhone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCallMethodModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Choose Call Method */}
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Choose Call Method
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* 👤 Agent Call Option */}
                <button
                  type="button"
                  onClick={() => setSelectedCallMethod("human")}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                    selectedCallMethod === "human"
                      ? "bg-[#F4B400]/15 border-[#F4B400] ring-2 ring-[#F4B400]/40 text-[#123E8A] dark:text-amber-400 font-black shadow-2xs"
                      : "bg-slate-50 dark:bg-[#182233] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    selectedCallMethod === "human" ? "bg-[#F4B400] text-[#123E8A]" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}>
                    <User className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-extrabold">👤 Agent Call</span>
                </button>

                {/* 🤖 AI Call Option */}
                <button
                  type="button"
                  onClick={() => setSelectedCallMethod("ai")}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                    selectedCallMethod === "ai"
                      ? "bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/40 text-purple-700 dark:text-purple-300 font-black shadow-2xs"
                      : "bg-slate-50 dark:bg-[#182233] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    selectedCallMethod === "ai" ? "bg-purple-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}>
                    <Bot className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-extrabold">🤖 AI Call</span>
                </button>
              </div>
            </div>

            {/* Step 2: Select SIM */}
            <div className="mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Select SIM
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedSim("sim1")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer text-xs font-extrabold ${
                    selectedSim === "sim1"
                      ? "bg-blue-50 dark:bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30"
                      : "bg-slate-50 dark:bg-[#182233] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>SIM 1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSim("sim2")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer text-xs font-extrabold ${
                    selectedSim === "sim2"
                      ? "bg-blue-50 dark:bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30"
                      : "bg-slate-50 dark:bg-[#182233] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>SIM 2</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCallMethodModal(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-extrabold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCallMethodModal(false);
                  handleDial(selectedCallMethod, selectedSim);
                }}
                className="flex-2 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-extrabold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Phone className="h-3.5 w-3.5 fill-current" />
                <span>Start {selectedCallMethod === "ai" ? "AI Call" : "Agent Call"}</span>
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
