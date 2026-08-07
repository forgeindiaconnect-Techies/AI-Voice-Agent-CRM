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
  Search,
  Filter,
  RefreshCw,
  Star,
  ArrowRight,
  UserCheck,
  AlertCircle
} from "lucide-react";

type CallStatus = "idle" | "ringing" | "connected" | "hold" | "ended";
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
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isCreatingLead, setIsCreatingLead] = useState(false);

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

  // TWILIO DEVICE STATE
  const [deviceReady, setDeviceReady] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<any>(null);

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
      // By default /api/leads respects RBAC (Agent sees own, TL sees pool/team, Admin sees all)
      const res = await api.get("/api/leads");
      setLeads(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error("[Dialer] fetchLeads error:", err);
      // Don't toast on initial load failures to avoid blank page
    } finally {
      setIsLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();

    // Listen to real-time lead assignments via native WebSocket
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(getWsUrl("/global"));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "leads_updated") {
            fetchLeads();
          }
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };
    } catch (err) {
      console.error("Failed to connect WebSocket", err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    // Initialize Twilio Device
    const setupDevice = async () => {
      try {
        const { token } = await api.get("/api/calls/token");
        const device = new Device(token);

        device.on("registered", () => setDeviceReady(true));
        device.on("error", (error) => showToast(`Twilio Error: ${error.message}`, "error"));

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        showToast("Failed to initialize softphone. Check microphone permissions.", "error");
      }
    };
    setupDevice();

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (callStatus === "connected") {
      const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = (l.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.phone || "").includes(searchQuery);
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
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
    if (!deviceRef.current || !deviceReady) {
      showToast("Softphone is not ready yet.", "error");
      return;
    }

    setIsCreatingLead(true);
    const fullPhoneNumber = `+91${outboundPhone}`;
    let matchedLead = leads.find(l => {
      const cleanL = l.phone.replace(/\D/g, "");
      const cleanTarget = fullPhoneNumber.replace(/\D/g, "");
      return cleanL === cleanTarget;
    });

    if (matchedLead) {
      showToast("Existing lead loaded", "success");
    } else {
      try {
        const res = await api.post("/api/leads", {
          name: `Manual Lead - ${outboundPhone}`,
          phone: fullPhoneNumber,
          pool_id: user?.pool_id || leads[0]?.pool_id || "6a6b40b7841e208e1cb69469",
          source: "Manual Dialer"
        });
        showToast("Lead created successfully", "success");
        await fetchLeads();
        matchedLead = res;
      } catch (err: any) {
        if (err.message?.includes("Duplicate") || err.message?.includes("already exists")) {
          await fetchLeads();
          matchedLead = leads.find(l => {
            const cleanL = l.phone.replace(/\D/g, "");
            const cleanTarget = fullPhoneNumber.replace(/\D/g, "");
            return cleanL === cleanTarget;
          });
          if (matchedLead) {
            showToast("Existing lead loaded", "success");
          } else {
            showToast("Existing lead loaded", "success");
            matchedLead = {
              _id: "temp_" + Date.now(),
              phone: fullPhoneNumber,
              name: `Manual Lead - ${outboundPhone}`,
              source: "Manual Dialer",
              status: "new",
              created_at: new Date().toISOString()
            } as any;
          }
        } else {
          showToast(err.message || "Failed to create lead", "error");
          setIsCreatingLead(false);
          return;
        }
      }
    }

    setCallStatus("ringing");
    setCallDuration(0);
    try {
      // 1. Try WebRTC connection if device is registered
      if (deviceRef.current && deviceReady) {
        try {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (micErr) {
            showToast("Microphone permission denied! Please allow microphone access to make calls.", "error");
            setCallStatus("ended");
            setIsCreatingLead(false);
            return;
          }

          const twilioCall = await deviceRef.current.connect({
            params: { To: fullPhoneNumber }
          });
          callRef.current = twilioCall;
          twilioCall.on("accept", () => {
            setCallStatus("connected");
            showToast("Call connected via WebRTC", "success");
          });
          twilioCall.on("disconnect", () => {
            setCallStatus("ended");
            handleHangup();
          });
        } catch (e) {
          console.warn("WebRTC connect error, using CRM manual dial:", e);
        }
      }

      // 2. Call CRM Backend Manual Dial API
      const res = await api.post("/api/calls/manual-dial", {
        phone: fullPhoneNumber,
        pool_id: matchedLead?.pool_id || user?.pool_id || "general",
        language: "english",
        agent_assign_mode: "manual",
        assigned_agent_id: user?.id,
        priority: "high",
        notes: ""
      });

      setCurrentCallId(res.id || res._id || res.call_id || "call_" + Date.now());

    } catch (err: any) {
      setCallStatus("idle");
      showToast(err.message || "Dialing failed", "error");
    } finally {
      setIsCreatingLead(false);
    }
  };

  const handleHangup = async () => {
    if (callStatus === "idle") return;

    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }

    setCallStatus("ended");
    try {
      if (currentCallId) {
        await api.post(`/api/calls/${currentCallId}/manual-end`, {
          call_id: currentCallId,
          outcome: "answered",
          duration_seconds: callDuration,
          notes: "Manual call ended"
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (action: "mute" | "hold" | "resume") => {
    if (!currentCallId) return;
    try {
      await api.post(`/api/calls/${currentCallId}/manual-action`, { action });
      if (action === "mute") setIsMuted(true);
      if (action === "resume" && isMuted) setIsMuted(false);
      if (action === "hold") setCallStatus("hold");
      if (action === "resume" && callStatus === "hold") setCallStatus("connected");
    } catch (err: any) {
      showToast(err.message || `Failed to ${action}`, "error");
    }
  };

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
    } catch (err: any) {
      showToast(err.message || "Failed to save outcome", "error");
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const handleQuickCall = (phone: string) => {
    const sanitized = sanitizeMobileNumber(phone);
    setOutboundPhone(sanitized);
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
                  <div className="h-6 flex items-center justify-center gap-2 mb-4">
                    {callStatus === "idle" && <span className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#172033] border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full">Ready to Dial</span>}
                    {callStatus === "ringing" && <span className="text-xs font-bold text-amber-600 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-3 py-1 rounded-full animate-pulse flex items-center gap-1"><PhoneForwarded className="h-3 w-3" /> Ringing...</span>}
                    {callStatus === "connected" && <span className="text-xs font-bold text-[#10B981] dark:text-[#34D399] bg-[#10B981]/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected {formatTime(callDuration)}</span>}
                    {callStatus === "hold" && <span className="text-xs font-bold text-amber-600 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1"><Pause className="h-3 w-3" /> On Hold {formatTime(callDuration)}</span>}
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

                {callStatus === "idle" && renderKeypad()}

                {(callStatus === "connected" || callStatus === "hold") && showInCallKeypad && renderKeypad(true)}

                {(callStatus === "connected" || callStatus === "hold") && !showInCallKeypad && (
                  <div className="my-8 w-full">
                    <div className="h-24 w-24 rounded-full bg-[#2563EB]/10 border-4 border-[#2563EB]/20 mx-auto flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] mb-6">
                      <User className="h-10 w-10" />
                    </div>
                    <p className="text-center text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">Unknown Customer</p>
                    <p className="text-center text-xs text-slate-400 font-mono mt-0.5">+91 {outboundPhone}</p>
                  </div>
                )}

                {/* Call Action Buttons */}
                <div className="w-full mt-4">
                  {callStatus === "idle" ? (
                    <button
                      onClick={handleDial}
                      disabled={!isValidMobile || isCreatingLead}
                      className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-full py-4 font-extrabold text-base shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isCreatingLead ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" /> Checking Lead...
                        </>
                      ) : (
                        <>
                          <Phone className="h-5 w-5 fill-current" /> Call
                        </>
                      )}
                    </button>
                  ) : callStatus === "ended" ? (
                    <div className="text-center p-4 bg-slate-50 dark:bg-[#172033] rounded-2xl border border-slate-200 dark:border-white/10">
                      <p className="font-bold text-slate-700 dark:text-[#F8FAFC] text-xs">Please save outcome on the right</p>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-4 gap-2.5">
                        <button
                          onClick={() => handleAction(isMuted ? "resume" : "mute")}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            isMuted
                              ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-amber-400 shadow-md shadow-amber-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                          <span className="text-[10px] font-black uppercase tracking-wider">Mute</span>
                        </button>
                        <button
                          onClick={() => handleAction(callStatus === "hold" ? "resume" : "hold")}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                            callStatus === "hold"
                              ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-amber-400 shadow-md shadow-amber-500/25"
                              : "bg-blue-50/90 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#1D4ED8] hover:text-white dark:hover:bg-[#2563EB] hover:border-transparent"
                          }`}
                        >
                          {callStatus === "hold" ? <Play className="h-5 w-5" /> : <CustomPauseIcon size={22} />}
                          <span className="text-[10px] font-black uppercase tracking-wider">Hold</span>
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
                          onClick={() => setIsSpeaker(!isSpeaker)}
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
                                onClick={() => handleQuickCall(lead.phone)}
                                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                                  outboundPhone && sanitizeMobileNumber(lead.phone) === outboundPhone
                                    ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-md'
                                    : 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#2563EB]/20 border border-[#2563EB]/20'
                                }`}
                              >
                                <Phone className="h-4 w-4" /> Quick Call
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
                  // -------------- CALL NOTES & DISPOSITION --------------
                  <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-200 dark:border-white/10 p-6 flex-1 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-[#2563EB] to-emerald-400"></div>
                    
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
                  <button className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-md">
                    Test Inbound Call
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
              <h2 className="text-sm font-black text-slate-800 dark:text-[#F8FAFC] uppercase tracking-widest mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" /> My Recent Manual Calls
              </h2>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-[#172033] text-slate-500 dark:text-[#94A3B8] font-bold text-xs uppercase tracking-wider sticky top-0 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">Phone</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3 rounded-r-xl">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-[#64748B] font-medium">
                        No recent manual calls found.
                      </td>
                    </tr>
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

        </AnimatePresence>
      </div>
    </div>
  );
}
