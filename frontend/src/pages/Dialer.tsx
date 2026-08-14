import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api, getWsUrl } from "../api/client";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { Device } from "@twilio/voice-sdk";
import { CustomPauseIcon } from "../components/CustomPauseIcon";
import { CustomSelect } from "../components/CustomSelect";
import LeadDetailsDrawer from "../components/LeadDetailsDrawer";
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
  AlertCircle
} from "lucide-react";

type CallStatus = "idle" | "calling" | "ringing" | "connected" | "hold" | "ended" | "busy" | "no-answer" | "failed";
type Tab = "outbound" | "inbound" | "supervisor" | "history";

const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "pending", label: "Pending" },
  { value: "follow_up_required", label: "Follow Up Required" },
  { value: "closed", label: "Closed" }
];

const OUTCOME_OPTIONS = [
  { value: "answered", label: "Answered / Connected" },
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "busy", label: "Busy / Rejected" },
  { value: "not_interested", label: "Not Interested" },
  { value: "qualified", label: "Qualified Lead" },
  { value: "follow_up_required", label: "Follow Up Required" }
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

// Lead interface matching backend
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
};

export default function Dialer() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("outbound");

  // OUTBOUND DIALER STATE
  const [outboundPhone, setOutboundPhone] = useState("");
  const [callMode, setCallMode] = useState<"human" | "ai">("human");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isDialing, setIsDialing] = useState(false);
  const isDialingRef = useRef(false); // duplicate-click guard
  const callEndReasonRef = useRef<string>(""); // track why call ended
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [quickCallingLeadId, setQuickCallingLeadId] = useState<string | null>(null);

  // Helper to sanitize incoming value (from input, paste, or quick call)
  const sanitizeMobileNumber = useCallback((val: string): string => {
    if (!val) return "";
    let cleaned = val.trim();
    // Strip leading +91 or variations
    while (cleaned.startsWith("+91") || cleaned.startsWith("91 ") || cleaned.startsWith("+ 91")) {
      if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith("91 ")) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith("+ 91")) cleaned = cleaned.slice(4);
      cleaned = cleaned.trim();
    }
    // Remove all non-digits
    cleaned = cleaned.replace(/\D/g, "");
    // If starting with 91 and has 12 digits total, it's likely a prefixed number
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    }
    // Cap to 10 digits
    return cleaned.slice(0, 10);
  }, []);

  const isValidMobile = useMemo(() => {
    return /^[6-9]\d{9}$/.test(outboundPhone);
  }, [outboundPhone]);

  const validationMessage = useMemo(() => {
    if (outboundPhone.length === 0) return "";
    if (!/^[6-9]/.test(outboundPhone)) {
      return "Enter a valid 10-digit Indian mobile number (must start with 6-9)";
    }
    if (outboundPhone.length < 10) {
      return `Enter a valid 10-digit Indian mobile number (${outboundPhone.length}/10 digits)`;
    }
    if (!isValidMobile) {
      return "Enter a valid 10-digit Indian mobile number";
    }
    return "";
  }, [outboundPhone, isValidMobile]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  // POST-CALL OUTCOME
  const [outcome, setOutcome] = useState("answered");
  const [notes, setNotes] = useState("");
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);
  const [isMuteLoading, setIsMuteLoading] = useState(false);
  const [isHoldLoading, setIsHoldLoading] = useState(false);
  const [isHoldProcessing, setIsHoldProcessing] = useState(false);

  // INCOMING CALL STATE
  const [incomingCall, setIncomingCall] = useState<{ id: string; phone: string; name: string } | null>(null);

  const handleSimulateInboundCall = () => {
    const incId = `inc_${Date.now()}`;
    const testPhone = "9876543210";
    setIncomingCall({
      id: incId,
      phone: testPhone,
      name: "Surya Prakash (Inbound)"
    });
    setCallStatus("ringing");
    showToast("Incoming Call Received...", "info");
  };

  const handleAnswerIncomingCall = () => {
    if (!incomingCall) return;
    const phoneClean = sanitizeMobileNumber(incomingCall.phone);
    setOutboundPhone(phoneClean);
    setCurrentCallId(incomingCall.id);
    setCallStatus("connected");
    setCallDuration(0);
    setActiveTab("outbound");
    setIncomingCall(null);
    showToast(`Incoming Call Answered — Connected with ${incomingCall.name || phoneClean}`, "success");
  };

  const handleDeclineIncomingCall = () => {
    setIncomingCall(null);
    setCallStatus("idle");
    showToast("Incoming Call Declined", "info");
  };

  // SUPERVISOR STATE
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const isSupervisor = user?.role === "admin" || user?.role === "team_leader";

  // ASSIGNED LEADS STATE
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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

  // CALL HISTORY STATE
  type CallHistoryItem = {
    id?: string;
    _id?: string;
    lead_id?: string;
    phone?: string;
    phone_number?: string;
    lead_name?: string;
    direction?: string;
    duration_seconds?: number;
    duration?: number;
    outcome?: string;
    status?: string;
    started_at?: string;
    ended_at?: string;
    created_at?: string;
    notes?: string;
  };

  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");

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
              } else if (st === "ended" || st === "completed") {
                setCallStatus("ended");
                fetchCallHistory();
              }
            }
            if (data.event === "call_ended") {
              setCallStatus("ended");
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
            // Real-time call status updates from Twilio status-callback via backend
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

  useEffect(() => {
    if (activeTab === "history") {
      fetchCallHistory();
    }
  }, [activeTab, fetchCallHistory]);

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

  useEffect(() => {
    if (callStatus === "connected" || callStatus === "hold") {
      const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = (l.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.phone || "").includes(searchQuery);
      const s = (l.status || "").toLowerCase();
      const sf = statusFilter.toLowerCase();
      const matchStatus = statusFilter === "All" || sf === "all" || s === sf || (sf === "pending" && (s === "new" || s === "pending" || s === "follow_up_required"));
      return matchSearch && matchStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  // Handle Keypad Press
  const handleKeypadPress = async (digit: string) => {
    if (callStatus === "idle") {
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

  const handleDial = async () => {
    if (!isValidMobile) return;
    if (isDialingRef.current || isDialing) return;
    if (callStatus === "calling" || callStatus === "ringing" || callStatus === "connected" || callStatus === "hold") return;

    if (callStatus !== "idle") {
      setCallStatus("idle");
      setCurrentCallId(null);
    }

    isDialingRef.current = true;
    setIsDialing(true);
    callEndReasonRef.current = "";

    // Generate unique idempotency key for this call attempt
    const idempotencyKey = `${user?.id || 'agent'}_${outboundPhone}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Ensure device is ready before dialing
    if (!deviceReady && !isInitializingDevice) {
      await setupDevice();
    }

    setIsCreatingLead(true);
    setCallStatus("calling"); // Immediate UI feedback
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);

    const fullPhoneNumber = `+91${outboundPhone}`;
    let matchedLead = leads.find(l => {
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

    setIsCreatingLead(false);

    // If AI Call Mode is selected, call dedicated Vapi dial endpoint
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
        setCallStatus("idle");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    }

    // ─── STEP 1: Register call in CRM backend for Human Agent WebRTC Softphone ──
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
      if (err.status === 409 || msg.includes("already in progress") || msg.includes("active call") || msg.includes("already exists")) {
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
          setCallStatus("idle");
          isDialingRef.current = false;
          setIsDialing(false);
          return;
        }
      } else {
        showToast(msg || "Failed to start call", "error");
        setCallStatus("idle");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    }

    // ─── STEP 2: Request microphone permission ───────────────────────────────
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast("Microphone denied! Enable mic access to make calls.", "error");
      setCallStatus("idle");
      isDialingRef.current = false;
      setIsDialing(false);
      return;
    }

    // ─── STEP 3: Initiate Twilio WebRTC Call ─────────────────────────────────
    if (deviceRef.current && deviceReady) {
      try {
        const twilioCall = await deviceRef.current.connect({
          params: { To: fullPhoneNumber }
        });
        callRef.current = twilioCall;

        // Twilio fires "ringing" when the outbound call is placed and far end is alerting
        twilioCall.on("ringing", (hasEarlyMedia: boolean) => {
          setCallStatus("ringing");
          console.log("[Twilio] Ringing, earlyMedia:", hasEarlyMedia);
        });

        // "accept" fires when the far-end answers (agent WebRTC leg is connected)
        twilioCall.on("accept", () => {
          setCallStatus("connected");
          setCallDuration(0);
          isDialingRef.current = false;
          setIsDialing(false);
        });

        // "disconnect" fires on normal hang-up from either side
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
            setCallStatus("ended");
          }
        });

        // "reject" fires if call was rejected before answer
        twilioCall.on("reject", () => {
          callRef.current = null;
          setIsMuted(false);
          setCallStatus("busy");
          isDialingRef.current = false;
          setIsDialing(false);
        });

        // Twilio SDK call error — includes SIP error codes
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
          } else if (code === 31005 || msg.includes("not reachable") || msg.includes("canceled")) {
            setCallStatus("no-answer");
          } else {
            setCallStatus("failed");
            showToast(err?.message || "Call failed", "error");
          }
        });

        twilioCall.on("reconnecting", () => {
          showToast("Network reconnecting...", "warning");
        });
        twilioCall.on("reconnected", () => {
          showToast("Network reconnected", "success");
        });
        twilioCall.on("mute", (muted: boolean) => {
          setIsMuted(muted);
        });

      } catch (e: any) {
        console.warn("[Twilio] connect() error:", e);
        setCallStatus("failed");
        showToast(e?.message || "Failed to initiate call", "error");
        isDialingRef.current = false;
        setIsDialing(false);
        return;
      }
    } else {
      // Device not ready — fall back gracefully
      showToast("Softphone not ready yet. Please wait and try again.", "warning");
      setCallStatus("idle");
      isDialingRef.current = false;
      setIsDialing(false);
      return;
    }
  };

  const handleHangup = useCallback(() => {
    if (callStatus === "idle") return;

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

    // Only move to "ended" if currently in a live call; cancel from calling/ringing goes to idle
    if (callStatus === "calling" || callStatus === "ringing") {
      setCallStatus("idle");
      setCallDuration(0);
    } else {
      setCallStatus("ended");
    }

    if (currentCallId) {
      api.post(`/api/calls/${currentCallId}/manual-end`, {
        call_id: currentCallId,
        outcome: "answered",
        duration_seconds: callDuration,
        notes: "Manual call ended"
      }).catch((err) => console.warn("Backend end-call notice:", err));
    }
  }, [callStatus, currentCallId, callDuration]);

  const handleMuteToggle = useCallback(async () => {
    if (callStatus !== "connected" && callStatus !== "hold") {
      showToast("Mute is only available during an active call", "warning");
      return;
    }
    if (isMuteLoading) return;

    const nextMuted = !isMuted;
    const targetAction = nextMuted ? "mute" : "unmute";

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
          action: targetAction
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
    showToast(isCurrentlyHold ? "Resuming call session..." : "Placing call on hold...", "info");

    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-action`, {
          action: targetAction
        });
      }

      const finalStatus = isCurrentlyHold ? "connected" : "hold";
      setCallStatus(finalStatus);
      showToast(isCurrentlyHold ? "Call Resumed — Live audio restored" : "Call Placed on Hold", "success");
    } catch (err: any) {
      console.error("[Dialer] Hold/Resume error:", err);
      setCallStatus(prevStatus);
      showToast(err.message || `Failed to ${targetAction} call session`, "error");
    } finally {
      setIsHoldLoading(false);
      setIsHoldProcessing(false);
    }
  }, [callStatus, currentCallId, isHoldLoading, isHoldProcessing]);

  const handleToggleMute = handleMuteToggle;
  const handleToggleHold = handleHoldToggle;

  const handleToggleSpeaker = useCallback(() => {
    const nextSpeaker = !isSpeaker;
    setIsSpeaker(nextSpeaker);
    showToast(nextSpeaker ? "Speaker Output Enabled" : "Default Earpiece Enabled", "info");
  }, [isSpeaker]);

  const saveOutcome = async () => {
    setIsSavingOutcome(true);
    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-end`, {
          call_id: currentCallId,
          outcome,
          duration_seconds: callDuration,
          notes
        });
        showToast("Call details saved", "success");
      } else {
        showToast("Call details cleared", "success");
      }
      setCallStatus("idle");
      setCurrentCallId(null);
      setOutboundPhone("");
      setNotes("");
      setCallDuration(0);
      fetchCallHistory();
    } catch (err: any) {
      showToast(err.message || "Failed to save outcome", "error");
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const handleQuickCall = async (leadOrPhone: Lead | string) => {
    if (callStatus !== "idle" || isDialing || isDialingRef.current) return;

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
    }

    const sanitized = sanitizeMobileNumber(targetPhone);
    if (!sanitized || sanitized.length < 10) {
      showToast("Enter a valid 10-digit Indian mobile number before placing Quick Call", "error");
      return;
    }

    setOutboundPhone(sanitized);
    setCallMode("ai");
    setQuickCallingLeadId(targetLeadId || "active");
    isDialingRef.current = true;
    setIsDialing(true);
    setCallStatus("calling");
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
        setCallDuration(0);
        showToast(res.message || `Call Started — Vapi AI Call created successfully (Call ID: ${vapiCallId})`, "success");
      } else {
        const errMsg = res?.details || res?.error || "Vapi Call creation failed";
        showToast(errMsg, "error");
        setCallStatus("idle");
      }
    } catch (err: any) {
      const errMsg = err.details || err.message || "Failed to initiate Vapi Quick Call";
      showToast(errMsg, "error");
      setCallStatus("idle");
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
    return new Date(ds).toLocaleString();
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
      if (isToday) {
        return `Today, ${timeFormatted}`;
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  const renderOutcomeBadge = (outcomeStr?: string) => {
    const norm = (outcomeStr || "completed").toLowerCase();
    if (norm === "qualified" || norm === "answered" || norm === "connected") {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#22C55E] border border-emerald-200 dark:border-emerald-500/30 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {norm}
        </span>
      );
    }
    if (norm === "no_answer" || norm === "no-answer" || norm === "busy" || norm === "failed") {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 inline-flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {norm.replace("_", " ")}
        </span>
      );
    }
    if (norm === "not_interested") {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 inline-flex items-center gap-1">
          not interested
        </span>
      );
    }
    if (norm === "follow_up_required" || norm === "follow_up") {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 inline-flex items-center gap-1">
          follow up
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 inline-flex items-center gap-1">
        {norm}
      </span>
    );
  };

  // ----------------------------------------------------
  // RENDER HELPERS
  // ----------------------------------------------------

  const renderKeypad = (inCall = false) => (
    <div className="grid grid-cols-3 gap-3 sm:gap-4.5 w-full max-w-[300px] mx-auto my-5">
      {[
        { d: "1", l: "" }, { d: "2", l: "ABC" }, { d: "3", l: "DEF" },
        { d: "4", l: "GHI" }, { d: "5", l: "JKL" }, { d: "6", l: "MNO" },
        { d: "7", l: "PQRS" }, { d: "8", l: "TUV" }, { d: "9", l: "WXYZ" },
        { d: "*", l: "" }, { d: "0", l: "+" }, { d: "#", l: "" }
      ].map((key) => (
        <button
          key={key.d}
          onClick={() => handleKeypadPress(key.d)}
          className="h-[68px] w-[68px] sm:h-[72px] sm:w-[72px] mx-auto flex flex-col items-center justify-center rounded-full bg-white dark:bg-[#151F32] border-2 border-blue-200/80 dark:border-blue-500/30 hover:border-[#F4B400]/70 dark:hover:border-[#60A5FA]/80 shadow-sm hover:shadow-[0_4px_22px_rgba(244,180,0,0.35)] dark:hover:shadow-[0_0_24px_rgba(59,130,246,0.45)] hover:scale-[1.04] active:scale-95 active:bg-gradient-to-br active:from-[#1D4ED8] active:via-[#2563EB] active:to-[#F4B400] active:border-transparent active:shadow-[0_0_25px_rgba(244,180,0,0.6)] transition-all duration-200 ease-in-out cursor-pointer group relative overflow-hidden select-none"
        >
          <span className="text-2xl sm:text-3xl font-extrabold text-[#123E8A] dark:text-white group-active:text-white leading-none transition-colors duration-150">
            {key.d}
          </span>
          {key.l && (
            <span className="text-[10px] font-black text-[#F4B400] dark:text-[#FACC15] group-active:text-white/90 tracking-[0.18em] leading-none mt-1 uppercase transition-colors duration-150">
              {key.l}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col font-sans pb-16">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-[20px] shadow-sm border border-slate-200 dark:border-white/10 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] rounded-xl flex items-center justify-center border border-[#2563EB]/20 shadow-xs">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <div className="flex flex-col items-start">
                  <h1 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                    <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Manual</span>
                    <span className="text-[#F4B400] font-extrabold">Dialer</span>
                  </h1>
                </div>
                <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                  UNIFIED COMMS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">Unified Comms &amp; Supervisor Station</p>
            </div>
          </div>
          <div className="h-[52px] flex items-center bg-slate-100/90 dark:bg-[#182233] p-1.5 rounded-[18px] border border-slate-200/80 dark:border-white/10 shadow-inner">
            <button
              onClick={() => setActiveTab("outbound")}
              className={`h-[44px] px-5 rounded-[14px] text-xs font-extrabold transition-all duration-200 ease-in-out cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 ${
                activeTab === "outbound"
                  ? "bg-gradient-to-r from-[#FFD54A] to-[#F4B400] text-[#123E8A] shadow-[0_4px_16px_rgba(244,180,0,0.35)] border border-amber-300/50 scale-[1.02]"
                  : "text-slate-700 dark:text-[#F8FAFC] hover:text-[#123E8A] hover:bg-gradient-to-r hover:from-amber-100/90 hover:to-amber-200/90 dark:hover:from-amber-500/20 dark:hover:to-amber-500/30 hover:-translate-y-0.5"
              }`}
            >
              Outbound
            </button>
            <button
              onClick={() => setActiveTab("inbound")}
              className={`h-[44px] px-5 rounded-[14px] text-xs font-extrabold transition-all duration-200 ease-in-out cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 ${
                activeTab === "inbound"
                  ? "bg-gradient-to-r from-[#FFD54A] to-[#F4B400] text-[#123E8A] shadow-[0_4px_16px_rgba(244,180,0,0.35)] border border-amber-300/50 scale-[1.02]"
                  : "text-slate-700 dark:text-[#F8FAFC] hover:text-[#123E8A] hover:bg-gradient-to-r hover:from-amber-100/90 hover:to-amber-200/90 dark:hover:from-amber-500/20 dark:hover:to-amber-500/30 hover:-translate-y-0.5"
              }`}
            >
              Inbound
            </button>
            {isSupervisor && (
              <button
                onClick={() => setActiveTab("supervisor")}
                className={`h-[44px] px-5 rounded-[14px] text-xs font-extrabold transition-all duration-200 ease-in-out cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 ${
                  activeTab === "supervisor"
                    ? "bg-gradient-to-r from-[#FFD54A] to-[#F4B400] text-[#123E8A] shadow-[0_4px_16px_rgba(244,180,0,0.35)] border border-amber-300/50 scale-[1.02]"
                    : "text-slate-700 dark:text-[#F8FAFC] hover:text-[#123E8A] hover:bg-gradient-to-r hover:from-amber-100/90 hover:to-amber-200/90 dark:hover:from-amber-500/20 dark:hover:to-amber-500/30 hover:-translate-y-0.5"
                }`}
              >
                Supervisor
              </button>
            )}
            <button
              onClick={() => setActiveTab("history")}
              className={`h-[44px] px-5 rounded-[14px] text-xs font-extrabold transition-all duration-200 ease-in-out cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 ${
                activeTab === "history"
                  ? "bg-gradient-to-r from-[#FFD54A] to-[#F4B400] text-[#123E8A] shadow-[0_4px_16px_rgba(244,180,0,0.35)] border border-amber-300/50 scale-[1.02]"
                  : "text-slate-700 dark:text-[#F8FAFC] hover:text-[#123E8A] hover:bg-gradient-to-r hover:from-amber-100/90 hover:to-amber-200/90 dark:hover:from-amber-500/20 dark:hover:to-amber-500/30 hover:-translate-y-0.5"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ---------------- OUTBOUND DIALER TAB ---------------- */}
          {activeTab === "outbound" && (
            <motion.div
              key="outbound"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col lg:flex-row gap-6"
            >
              {/* Left Column: Keypad (30% Width / ~380px) */}
              <div className="w-full lg:w-[360px] xl:w-[380px] bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-200 dark:border-white/10 p-6 flex flex-col items-center justify-between overflow-y-auto shrink-0">
                
                <div className="w-full text-center">
                  <div className="h-7 flex items-center justify-center gap-2 mb-4">
                    {callStatus === "idle" && (
                      <span className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#172033] border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full">
                        Ready to Dial
                      </span>
                    )}
                    {callStatus === "calling" && (
                      <span className="text-xs font-bold text-blue-600 dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Calling...
                      </span>
                    )}
                    {callStatus === "ringing" && (
                      <span className="text-xs font-bold text-amber-600 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                        <PhoneForwarded className="h-3 w-3" /> Ringing...
                      </span>
                    )}
                    {callStatus === "connected" && (
                      <span className="text-xs font-bold text-[#10B981] dark:text-[#34D399] bg-[#10B981]/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected · {formatTime(callDuration)}
                      </span>
                    )}
                    {callStatus === "hold" && (
                      <span className="text-xs font-bold text-amber-600 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                        <Pause className="h-3 w-3" /> On Hold · {formatTime(callDuration)}
                      </span>
                    )}
                    {callStatus === "busy" && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                        <PhoneOff className="h-3 w-3" /> Customer Busy
                      </span>
                    )}
                    {callStatus === "no-answer" && (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full flex items-center gap-1">
                        <PhoneOff className="h-3 w-3" /> No Answer
                      </span>
                    )}
                    {callStatus === "failed" && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Call Failed
                      </span>
                    )}
                    {callStatus === "ended" && (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full flex items-center gap-1">
                        <PhoneOff className="h-3 w-3" /> Call Ended · {formatTime(callDuration)}
                      </span>
                    )}
                  </div>

                  <div className="relative w-full max-w-xs mx-auto mb-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={outboundPhone}
                      onChange={e => {
                        if (callStatus !== "idle") return;
                        if (isDialingRef.current) return;
                        const sanitized = sanitizeMobileNumber(e.target.value);
                        setOutboundPhone(sanitized);
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        if (callStatus !== "idle") return;
                        const pasted = e.clipboardData.getData("text");
                        const sanitized = sanitizeMobileNumber(pasted);
                        setOutboundPhone(sanitized);
                      }}
                      readOnly={callStatus !== "idle"}
                      placeholder="Enter mobile number"
                      className="w-full text-center text-3xl font-light tracking-wide text-slate-900 dark:text-[#F8FAFC] bg-transparent outline-none py-2 font-sans"
                    />
                    {callStatus === "idle" && outboundPhone.length > 0 && (
                      <button 
                        onClick={() => setOutboundPhone(prev => prev.slice(0, -1))} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172033] rounded-full transition cursor-pointer"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  {/* Inline Validation Warning Message */}
                  {validationMessage && (
                    <div className="mt-1 mb-3 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 justify-center w-full max-w-xs mx-auto animate-fadeIn">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>{validationMessage}</span>
                    </div>
                  )}
                </div>

                {callStatus === "idle" && (
                  <div className="mb-4 w-full max-w-xs mx-auto">
                    <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setCallMode("human")}
                        className={`flex-1 py-1.5 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          callMode === "human"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>Agent Call</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallMode("ai")}
                        className={`flex-1 py-1.5 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          callMode === "ai"
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span>Vapi AI Call</span>
                      </button>
                    </div>
                  </div>
                )}

                {callStatus === "idle" && renderKeypad()}

                {/* Calling/Ringing animation */}
                {(callStatus === "calling" || callStatus === "ringing") && (
                  <div className="my-6 w-full flex flex-col items-center">
                    <div className="relative h-28 w-28 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 dark:bg-blue-500/10 animate-ping" />
                      <div className="absolute inset-3 rounded-full bg-blue-500/30 dark:bg-blue-500/20 animate-ping" style={{ animationDelay: "0.3s" }} />
                      <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shadow-xl shadow-blue-500/40">
                        {callStatus === "calling"
                          ? <Loader2 className="h-12 w-12 text-white animate-spin" />
                          : <Phone className="h-12 w-12 text-white animate-bounce" />}
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-slate-700 dark:text-white">
                      {callStatus === "calling" ? "Connecting..." : "Customer's phone is ringing"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">+91 {outboundPhone}</p>
                  </div>
                )}

                {(callStatus === "connected" || callStatus === "hold") && showInCallKeypad && renderKeypad(true)}

                {(callStatus === "connected" || callStatus === "hold") && !showInCallKeypad && (
                  <div className="my-6 w-full">
                    <div className={`h-24 w-24 rounded-full border-4 mx-auto flex items-center justify-center mb-4 ${
                      callMode === "ai"
                        ? "bg-purple-500/10 border-purple-500/40 text-purple-400 animate-pulse shadow-lg shadow-purple-500/20"
                        : "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                    }`}>
                      {callMode === "ai" ? <Bot className="h-10 w-10 text-purple-400 animate-bounce" /> : <User className="h-10 w-10" />}
                    </div>
                    <p className="text-center text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                      {callMode === "ai" ? "Customer ↔ Vapi AI Agent" : "Customer"}
                    </p>
                    <p className="text-center text-xs text-slate-400 font-mono mt-0.5">+91 {outboundPhone}</p>
                    <p className="text-center text-lg font-black text-[#10B981] mt-2 font-mono">{formatTime(callDuration)}</p>
                  </div>
                )}

                {/* Terminal states: busy / no-answer / failed / ended */}
                {(callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" || callStatus === "ended") && (
                  <div className="my-6 w-full flex flex-col items-center">
                    <div className={`h-24 w-24 rounded-full border-4 mx-auto flex items-center justify-center mb-4 ${
                      callStatus === "busy" || callStatus === "failed"
                        ? "bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-500"
                        : "bg-slate-100 dark:bg-slate-700/30 border-slate-300 dark:border-slate-600 text-slate-400"
                    }`}>
                      <PhoneOff className="h-10 w-10" />
                    </div>
                    <p className="text-center text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                      {callStatus === "busy" ? "Line Busy" : callStatus === "no-answer" ? "No Answer" : callStatus === "failed" ? "Call Failed" : "Call Ended"}
                    </p>
                    <p className="text-center text-xs text-slate-400 font-mono mt-0.5">+91 {outboundPhone}</p>
                    {callStatus === "ended" && callDuration > 0 && (
                      <p className="text-center text-xs font-bold text-emerald-500 mt-1">Duration: {formatTime(callDuration)}</p>
                    )}
                  </div>
                )}

                {/* Call Action Buttons */}
                <div className="w-full mt-4">
                  {callStatus === "idle" && (
                    <button
                      onClick={handleDial}
                      disabled={!isValidMobile || isCreatingLead || isDialing}
                      className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-full py-4 font-extrabold text-base shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isDialing || isCreatingLead ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" /> Dialing...
                        </>
                      ) : (
                        <>
                          <Phone className="h-5 w-5 fill-current" /> Call
                        </>
                      )}
                    </button>
                  )}

                  {/* Calling / Ringing — show Cancel button */}
                  {(callStatus === "calling" || callStatus === "ringing") && (
                    <button
                      onClick={handleHangup}
                      className="w-full bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white rounded-full py-4 font-extrabold text-base shadow-lg shadow-rose-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <PhoneOff className="h-5 w-5 fill-current" />
                      {callStatus === "calling" ? "Cancel" : "Cancel Ringing"}
                    </button>
                  )}

                  {/* Connected / Hold — full controls */}
                  {(callStatus === "connected" || callStatus === "hold") && (
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-4 gap-2.5">
                        <button
                          onClick={handleMuteToggle}
                          disabled={isMuteLoading}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            isMuteLoading
                              ? "bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-white/10 cursor-not-allowed"
                              : isMuted
                              ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-amber-400 shadow-md shadow-amber-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          {isMuteLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-current" />
                          ) : isMuted ? (
                            <MicOff className="h-5 w-5" />
                          ) : (
                            <Mic className="h-5 w-5" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {isMuteLoading ? (isMuted ? "Unmuting..." : "Muting...") : isMuted ? "Muted" : "Mute"}
                          </span>
                        </button>
                        <button
                          onClick={handleHoldToggle}
                          disabled={isHoldLoading || isHoldProcessing}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            isHoldLoading || isHoldProcessing
                              ? "bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-white/10 cursor-not-allowed"
                              : callStatus === "hold"
                              ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-amber-400 shadow-md shadow-amber-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          {isHoldLoading || isHoldProcessing ? (
                            <Loader2 className="h-5 w-5 animate-spin text-current" />
                          ) : callStatus === "hold" ? (
                            <Play className="h-5 w-5 fill-current" />
                          ) : (
                            <CustomPauseIcon size={22} />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {isHoldLoading || isHoldProcessing
                              ? callStatus === "hold"
                                ? "Resuming..."
                                : "Holding..."
                              : callStatus === "hold"
                              ? "Resume"
                              : "Hold"}
                          </span>
                        </button>
                        <button
                          onClick={() => setShowInCallKeypad(!showInCallKeypad)}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            showInCallKeypad
                              ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white border-blue-400 shadow-md shadow-blue-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          <Hash className="h-5 w-5" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Keypad</span>
                        </button>
                        <button
                          onClick={handleToggleSpeaker}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            isSpeaker
                              ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white border-blue-400 shadow-md shadow-blue-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          {isSpeaker ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                          <span className="text-[10px] font-black uppercase tracking-wider">Speaker</span>
                        </button>
                      </div>
                      <button
                        onClick={handleHangup}
                        className="w-full bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white rounded-full py-4 font-extrabold text-base shadow-lg shadow-rose-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <PhoneOff className="h-5 w-5 fill-current" /> End Call
                      </button>
                    </div>
                  )}

                  {/* Terminal states: busy / no-answer / failed / ended — Redial + Save */}
                  {(callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" || callStatus === "ended") && (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          callEndReasonRef.current = "";
                          setCallStatus("idle");
                          setCallDuration(0);
                          setCurrentCallId(null);
                        }}
                        className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-full py-3.5 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Phone className="h-4 w-4 fill-current" /> Redial
                      </button>
                      {callStatus === "ended" && (
                        <p className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#172033] rounded-xl p-3 border border-slate-200 dark:border-white/10">
                          Save outcome using the panel on the right →
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Dynamic Workspace (70% Width) */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full min-w-0">
                {callStatus === "idle" ? (
                  // -------------- ASSIGNED LEADS WORKSPACE --------------
                  <div className="bg-slate-50/50 dark:bg-[#111827] rounded-[24px] border border-slate-200 dark:border-white/10 p-5 flex-1 flex flex-col overflow-hidden shadow-sm">
                    {/* Workspace Header / Counters */}
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <div className="flex flex-col items-start">
                          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                            <UserCheck className="h-5 w-5 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
                            <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Assigned Leads</span>
                            <span className="text-[#F4B400] font-extrabold">Workspace</span>
                          </h2>
                        </div>
                        <p className="text-xs font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest mt-1">Real-time Lead Sync Active</p>
                      </div>
                      <button onClick={fetchLeads} className="p-2 hover:bg-white dark:hover:bg-[#172033] rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 text-slate-500 dark:text-[#94A3B8] transition cursor-pointer">
                        <RefreshCw className={`h-4 w-4 ${isLoadingLeads ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {/* Equal Height KPI Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
                      <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[18px] border border-slate-200 dark:border-white/10 shadow-sm hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-center">
                        <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Total Leads</p>
                        <p className="text-xl font-black text-slate-900 dark:text-[#F8FAFC]">{leads.length}</p>
                      </div>
                      <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[18px] border border-slate-200 dark:border-white/10 shadow-sm hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-center">
                        <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">New Leads</p>
                        <p className="text-xl font-black text-[#2563EB] dark:text-[#60A5FA]">{leads.filter(l => l.status === "new").length}</p>
                      </div>
                      <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[18px] border border-slate-200 dark:border-white/10 shadow-sm hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-center">
                        <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Pending Follow-ups</p>
                        <p className="text-xl font-black text-amber-500 dark:text-[#FCD34D]">{leads.filter(l => l.status === "follow_up_required").length}</p>
                      </div>
                      <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[18px] border border-slate-200 dark:border-white/10 shadow-sm hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-center">
                        <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Completed / Closed</p>
                        <p className="text-xl font-black text-emerald-500 dark:text-[#34D399]">{leads.filter(l => l.status === "closed").length}</p>
                      </div>
                    </div>

                    {/* Search & Filters (Height 52px) */}
                    <div className="flex gap-3 mb-4 shrink-0">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#64748B]" />
                        <input
                          type="text"
                          placeholder="Search leads by name or phone..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full h-[52px] pl-11 pr-4 bg-white dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="relative w-52">
                        <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#64748B] z-10" />
                        <CustomSelect
                          value={statusFilter}
                          onChange={setStatusFilter}
                          options={STATUS_FILTER_OPTIONS}
                          placeholder="Select Status"
                          triggerClassName="h-[52px] rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#172033] dark:text-[#F8FAFC] hover:border-[#2563EB] pl-10"
                        />
                      </div>
                    </div>

                    {/* Leads List */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                      {isLoadingLeads && leads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-4" />
                          <p className="font-bold text-sm">Loading Assigned Leads...</p>
                        </div>
                      ) : filteredLeads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-[#64748B] bg-white dark:bg-[#172033] rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-8">
                          <AlertCircle className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                          <p className="font-bold text-slate-700 dark:text-[#F8FAFC]">No Assigned Leads Found</p>
                          <p className="text-xs">Adjust your filters or wait for new assignments.</p>
                        </div>
                      ) : (
                        filteredLeads.map((lead, idx) => (
                          <div 
                            key={lead._id || `lead-${idx}`}
                            className={`bg-white dark:bg-[#172033] rounded-[18px] border ${outboundPhone && sanitizeMobileNumber(lead.phone) === outboundPhone ? 'border-[#F4B400] ring-2 ring-[#F4B400]/20' : 'border-slate-200 dark:border-white/10'} p-4 shadow-sm hover:shadow-lg dark:hover:shadow-amber-500/10 hover:border-l-4 hover:border-l-[#F4B400] transition-all duration-250 group`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-sm flex items-center gap-2">
                                  {lead.name || (lead as any).customer_name || "Unknown Customer"}
                                  {lead.priority === "high" && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                                </h3>
                                <p className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] font-mono mt-0.5">{lead.phone}</p>
                              </div>
                              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${
                                lead.status === 'new' ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#2563EB] dark:text-[#60A5FA]' :
                                lead.status === 'follow_up_required' ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-[#FCD34D]' :
                                lead.status === 'closed' ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-[#047857] dark:text-[#34D399]' :
                                'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-[#94A3B8]'
                              }`}>
                                {lead.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-[#94A3B8] mb-4">
                              <span className="bg-slate-50 dark:bg-[#111827] px-2.5 py-1 rounded-lg border border-slate-100 dark:border-white/5">Src: <strong className="text-slate-700 dark:text-[#F8FAFC]">{lead.source}</strong></span>
                              <span>Added: {formatDate(lead.created_at)}</span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQuickCall(lead)}
                                disabled={callStatus !== "idle" || isDialing}
                                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer ${
                                  outboundPhone && sanitizeMobileNumber(lead.phone) === outboundPhone
                                    ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md'
                                    : 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#2563EB]/20 border border-[#2563EB]/20'
                                }`}
                              >
                                {quickCallingLeadId === lead._id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin text-current" />
                                    <span>Starting Call...</span>
                                  </>
                                ) : (
                                  <>
                                    <Phone className="h-4 w-4" />
                                    <span>Quick Call</span>
                                  </>
                                )}
                              </button>
                              <button className="px-4 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1F2B45] text-slate-700 dark:text-[#F8FAFC] rounded-xl font-bold text-xs border border-slate-200 dark:border-white/10 transition cursor-pointer"
                                onClick={() => setSelectedLead(lead)}
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  // -------------- CALL NOTES & DISPOSITION (all non-idle states) --------------
                  <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-200 dark:border-white/10 p-6 flex-1 flex flex-col relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
                      callStatus === "connected" || callStatus === "hold" ? "from-blue-400 via-[#2563EB] to-emerald-400"
                      : callStatus === "busy" || callStatus === "failed" ? "from-rose-400 via-rose-500 to-rose-600"
                      : callStatus === "no-answer" ? "from-slate-300 via-slate-400 to-slate-500"
                      : callStatus === "ended" ? "from-emerald-400 via-emerald-500 to-teal-500"
                      : "from-blue-300 via-blue-400 to-blue-500"
                    }`}></div>
                    
                    <h2 className="text-sm font-black text-slate-900 dark:text-[#F8FAFC] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" /> Live Call Notes &amp; Disposition
                    </h2>

                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex-1 bg-slate-50 dark:bg-[#172033] rounded-2xl border border-slate-100 dark:border-white/10 p-4 relative">
                        <textarea
                          placeholder="Type notes here during the call..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="w-full h-full bg-transparent resize-none outline-none text-sm font-medium text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase mb-1">Call Outcome</label>
                          <CustomSelect
                            value={outcome}
                            onChange={setOutcome}
                            options={OUTCOME_OPTIONS}
                            placeholder="Select Outcome"
                            triggerClassName="h-[46px] rounded-xl text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={saveOutcome}
                            disabled={callStatus !== "ended" || isSavingOutcome}
                            className="w-full h-[46px] bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:bg-slate-300 shadow-md cursor-pointer active:scale-95"
                          >
                            {isSavingOutcome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Call Data
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ---------------- INBOUND DIALER TAB ---------------- */}
          {activeTab === "inbound" && (
            <motion.div
              key="inbound"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex items-center justify-center p-6 bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-200 dark:border-white/10"
            >
              <div className="text-center max-w-sm">
                <div className="h-24 w-24 bg-[#2563EB]/10 dark:bg-blue-500/15 border border-[#2563EB]/20 dark:border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-6 relative shadow-lg shadow-blue-500/10">
                  <div className="absolute inset-0 bg-[#2563EB] rounded-full animate-ping opacity-20"></div>
                  <Ear className="h-10 w-10 text-[#2563EB] dark:text-[#60A5FA]" />
                </div>
                <h2 className="text-2xl font-black mb-2 tracking-tight">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6]">Inbound </span>
                  <span className="text-[#F4B400]">Queue Active</span>
                </h2>
                <p className="text-slate-500 dark:text-[#94A3B8] font-medium text-sm">You are currently available to receive incoming manual and AI transferred calls.</p>
                <div className="mt-8 p-4 bg-slate-50 dark:bg-[#172033] rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-xs font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest mb-2">Simulate Incoming Call</p>
                  <button
                    onClick={handleSimulateInboundCall}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>Test Inbound Call</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------------- SUPERVISOR TAB ---------------- */}
          {activeTab === "supervisor" && isSupervisor && (
            <motion.div
              key="supervisor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#111827] p-5 rounded-[20px] border border-slate-200 dark:border-white/10 shadow-sm">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Active Calls</p>
                  <div className="text-3xl font-black text-[#10B981] dark:text-[#34D399] flex items-center gap-2">
                    0 <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#111827] p-5 rounded-[20px] border border-slate-200 dark:border-white/10 shadow-sm">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Agents Online</p>
                  <div className="text-3xl font-black text-slate-900 dark:text-[#F8FAFC]">12</div>
                </div>
                <div className="bg-white dark:bg-[#111827] p-5 rounded-[20px] border border-slate-200 dark:border-white/10 shadow-sm">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Total Manual Calls Today</p>
                  <div className="text-3xl font-black text-slate-900 dark:text-[#F8FAFC]">145</div>
                </div>
                <div className="bg-white dark:bg-[#111827] p-5 rounded-[20px] border border-slate-200 dark:border-white/10 shadow-sm">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1">Avg Handle Time</p>
                  <div className="text-3xl font-black text-slate-900 dark:text-[#F8FAFC]">2m 14s</div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] rounded-[24px] border border-slate-200 dark:border-white/10 shadow-sm flex-1 p-6 flex flex-col overflow-hidden">
                <h2 className="text-sm font-black text-slate-800 dark:text-[#F8FAFC] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" /> Live Agent Monitoring
                </h2>
                
                <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-[#64748B] bg-slate-50 dark:bg-[#172033] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  <div className="text-center">
                    <ListOrdered className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-bold">No active manual calls right now</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}



          {/* ---------------- HISTORY TAB ---------------- */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full bg-white dark:bg-[#111827] rounded-[24px] border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col overflow-hidden"
            >
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-500/20">
                    <History className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider leading-none">
                      My Recent Manual Calls
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Real-time call logs and manual dial session history ({callHistory.length} total)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search phone or outcome..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="h-9 pl-9 pr-3 text-xs rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-full sm:w-56"
                    />
                    {historySearchQuery && (
                      <button onClick={() => setHistorySearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={fetchCallHistory}
                    disabled={isLoadingHistory}
                    className="h-9 px-3.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 overflow-y-auto softphone-scrollbar">
                {/* Error state */}
                {historyError && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-between my-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{historyError}</span>
                    </div>
                    <button onClick={fetchCallHistory} className="underline hover:text-rose-900 cursor-pointer">
                      Retry
                    </button>
                  </div>
                )}

                <table className="w-full text-left text-sm border-separate border-spacing-y-1.5">
                  <thead className="bg-slate-50 dark:bg-[#172033] text-slate-500 dark:text-[#94A3B8] font-bold text-xs uppercase tracking-wider sticky top-0 border-b border-slate-200 dark:border-white/10 z-10">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">Phone</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3 rounded-r-xl">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Loading Skeleton */}
                    {isLoadingHistory && (
                      [1, 2, 3, 4].map((i) => (
                        <tr key={i} className="animate-pulse bg-slate-50/60 dark:bg-slate-900/40 rounded-xl">
                          <td className="px-4 py-3.5"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                          <td className="px-4 py-3.5"><div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                          <td className="px-4 py-3.5"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                          <td className="px-4 py-3.5"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded-md" /></td>
                        </tr>
                      ))
                    )}

                    {/* Real Call Records */}
                    {!isLoadingHistory && filteredCallHistory.map((item) => {
                      const rawPhone = item.phone || item.phone_number || "";
                      const displayPhone = rawPhone || item.lead_name || "Unknown";
                      const callDate = item.started_at || item.created_at || item.ended_at;

                      return (
                        <tr
                          key={item.id || item._id}
                          className="bg-slate-50/70 dark:bg-[#172033]/60 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-[#1F2937] hover:border-blue-300 dark:hover:border-blue-500/40 transition-all rounded-xl shadow-2xs group"
                        >
                          <td className="px-4 py-3 rounded-l-xl font-mono font-bold text-xs text-slate-900 dark:text-[#F9FAFB]">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center shrink-0">
                                <PhoneCall className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="font-mono text-xs">{displayPhone}</div>
                                {item.lead_name && item.lead_name !== displayPhone && (
                                  <div className="text-[10px] text-slate-400 font-sans font-medium">{item.lead_name}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {renderOutcomeBadge(item.outcome || item.status)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {formatDuration(item.duration_seconds || item.duration)}
                          </td>
                          <td className="px-4 py-3 rounded-r-xl text-xs font-medium text-slate-500 dark:text-slate-400">
                            {formatCallTime(callDate)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Empty state */}
                    {!isLoadingHistory && filteredCallHistory.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 dark:text-[#64748B] font-medium">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400">
                              <History className="h-6 w-6" />
                            </div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                              {historySearchQuery ? "No matching manual calls found" : "No recent manual calls found"}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                              {historySearchQuery
                                ? `No call logs match "${historySearchQuery}". Try clearing your search query.`
                                : "Outbound manual calls placed from this dialer will automatically populate here."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        {selectedLead && (
          <LeadDetailsDrawer
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdateDisposition={async (leadId, status, notes, followUpDate) => {
              await api.patch(`/api/leads/${leadId}/disposition`, { status, notes, follow_up_at: followUpDate });
              fetchLeads();
            }}
            onCall={(lead) => handleQuickCall(lead.phone)}
            showToast={showToast}
          />
        )}

        {/* ---------------- INCOMING CALL RINGING MODAL ---------------- */}
        {incomingCall && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#111827] border border-blue-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl space-y-5 animate-scale-in">
              <div className="h-20 w-20 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25"></div>
                <PhoneCall className="h-9 w-9 text-[#2563EB] dark:text-[#60A5FA]" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/20 inline-block mb-2">
                  Incoming Call Ringing
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {incomingCall.name}
                </h3>
                <p className="text-sm font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
                  +91 {incomingCall.phone}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDeclineIncomingCall}
                  className="py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <PhoneOff className="h-4 w-4" />
                  Decline
                </button>
                <button
                  onClick={handleAnswerIncomingCall}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Phone className="h-4 w-4 fill-current" />
                  Answer Call
                </button>
              </div>
            </div>
          </div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}
