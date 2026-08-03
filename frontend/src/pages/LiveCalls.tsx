import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  Radio,
  Headphones,
  Volume2,
  Mic,
  PhoneForwarded,
  Clock,
  Search,
  PhoneOff,
  User,
  Phone,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Megaphone,
  Globe,
  Pause,
  MapPin,
  RotateCcw,
  CheckCircle2,
  Users,
  MicOff,
  ChevronLeft,
  ChevronRight,
  X,
  Bot,
  Brain,
  FileText,
  Award,
  BarChart2,
  BookOpen,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  AlertCircle
} from "lucide-react";

export type LiveCall = {
  id: string;
  lead_id: string;
  formatted_lead_id: string;
  customer_name: string;
  phone_number: string;
  location?: string;
  language: string;
  priority?: "urgent" | "high" | "medium" | "low";
  is_vip?: boolean;
  agent_id: string;
  agent_name: string;
  agent_role?: string;
  supervisor_name?: string;
  agent_status?: "speaking" | "listening" | "on_hold";
  speaker_active?: "customer" | "agent" | "ai";
  pool_id: string;
  pool_name: string;
  queue_name: string;
  campaign_name: string;
  direction: "inbound" | "outbound" | "transferred";
  timer_seconds: number;
  sentiment: "Positive" | "Neutral" | "Negative" | "High Intent";
  sentiment_score: number;
  emotion?: string;
  mos_score?: string;
  latency_ms?: string;
  queue_position?: string;
  wait_time?: string;
  ai_confidence?: string;
  win_probability?: string;
  compliance_score?: number;
  intent?: string;
  risk_level?: "Low" | "Medium" | "High";
  ai_suggestions?: string[];
  knowledge_base?: string[];
  transcript?: { speaker: string; text: string; time: string }[];
};

// Rich Mock Dataset matching Enterprise Contact Center Standards
const MOCK_LIVE_CALLS: LiveCall[] = [
  {
    id: "call-101",
    lead_id: "lead-8472",
    formatted_lead_id: "LEAD-8472",
    customer_name: "Rajesh Kumar",
    phone_number: "+91 98765 43210",
    location: "Mumbai, MH",
    language: "English (US)",
    priority: "urgent",
    is_vip: true,
    agent_id: "agent-84785",
    agent_name: "Agent Ramesh",
    agent_role: "Senior AI Voice Specialist",
    supervisor_name: "Supervisor Vikram",
    agent_status: "speaking",
    speaker_active: "customer",
    pool_id: "pool-sales",
    pool_name: "Outbound Sales Pool",
    queue_name: "High Priority Sales Queue",
    campaign_name: "Credit Card Q3",
    direction: "outbound",
    timer_seconds: 142,
    sentiment: "Positive",
    sentiment_score: 94,
    emotion: "Receptive & Interested",
    mos_score: "MOS 4.6 (HD)",
    latency_ms: "18ms",
    queue_position: "#1",
    wait_time: "03s",
    ai_confidence: "98.5%",
    win_probability: "92%",
    compliance_score: 98,
    intent: "Inquiring about pre-approved premium card limits & APR rates",
    risk_level: "Low",
    ai_suggestions: [
      "Highlight zero joining fee for first 12 months",
      "Mention instant airport lounge access benefit",
      "Propose immediate digital e-KYC verification link"
    ],
    knowledge_base: [
      "KB-841: Premium Credit Card Terms & APR Waiver Matrix",
      "KB-204: Instant Airport Lounge Access Verification Guidelines"
    ],
    transcript: [
      { speaker: "AI Voice Bot", text: "Welcome to Forge Financials, Rajesh. How may I assist you with your premium card application today?", time: "00:05" },
      { speaker: "Rajesh Kumar", text: "Hi, I received an SMS about a pre-approved credit limit of ₹5,00,000. Is there any annual fee waived?", time: "00:18" },
      { speaker: "Agent Ramesh", text: "Yes Mr. Kumar, under our Q3 promotion, the annual fee is 100% waived for the first year.", time: "00:35" }
    ]
  },
  {
    id: "call-102",
    lead_id: "lead-8789",
    formatted_lead_id: "LEAD-8789",
    customer_name: "Ananya Sharma",
    phone_number: "+91 98123 56789",
    location: "Delhi NCR",
    language: "Hindi / Eng",
    priority: "high",
    is_vip: false,
    agent_id: "agent-84927",
    agent_name: "Agent Priya",
    agent_role: "Shift Retention Lead",
    supervisor_name: "Supervisor Anita",
    agent_status: "listening",
    speaker_active: "agent",
    pool_id: "pool-support",
    pool_name: "Inbound Support Pool",
    queue_name: "Customer Retention",
    campaign_name: "Priority Support",
    direction: "inbound",
    timer_seconds: 85,
    sentiment: "Neutral",
    sentiment_score: 82,
    emotion: "Inquiring & Calm",
    mos_score: "MOS 4.4 (HD)",
    latency_ms: "24ms",
    queue_position: "#2",
    wait_time: "08s",
    ai_confidence: "96.4%",
    win_probability: "78%",
    compliance_score: 96,
    intent: "Subscription renewal modification and auto-debit setup",
    risk_level: "Low",
    ai_suggestions: [
      "Confirm Mandate ID before modifying payment method",
      "Send UPI auto-debit authorization link on SMS"
    ],
    knowledge_base: [
      "KB-109: NACH Mandate Modification SOP",
      "KB-302: UPI Auto-Debit Link Generation Steps"
    ],
    transcript: [
      { speaker: "Ananya Sharma", text: "I want to change my mandate payment method from debit card to UPI.", time: "00:10" },
      { speaker: "Agent Priya", text: "Certainly Ananya! I am initiating the mandate update right now on your screen.", time: "00:25" }
    ]
  },
  {
    id: "call-103",
    lead_id: "lead-9106",
    formatted_lead_id: "LEAD-9106",
    customer_name: "Vikram Patel",
    phone_number: "+91 97456 12345",
    location: "Bengaluru, KA",
    language: "English (US)",
    priority: "high",
    is_vip: true,
    agent_id: "agent-85069",
    agent_name: "Agent Suresh",
    agent_role: "Wealth Advisory Specialist",
    supervisor_name: "Supervisor Vikram",
    agent_status: "speaking",
    speaker_active: "ai",
    pool_id: "pool-wealth",
    pool_name: "Wealth Advisory Pool",
    queue_name: "Executive Advisory",
    campaign_name: "Mutual Fund Q3",
    direction: "outbound",
    timer_seconds: 215,
    sentiment: "Positive",
    sentiment_score: 96,
    emotion: "High Intent & Confident",
    mos_score: "MOS 4.7 (HD)",
    latency_ms: "14ms",
    queue_position: "Direct",
    wait_time: "02s",
    ai_confidence: "99.1%",
    win_probability: "95%",
    compliance_score: 99,
    intent: "High-value portfolio allocation for tax-saving ELSS schemes",
    risk_level: "Low",
    ai_suggestions: [
      "Recommend Top 3 Star ELSS Tax Saver Funds",
      "Highlight 3-year minimum lock-in period advantage"
    ],
    knowledge_base: [
      "KB-501: Section 80C Tax-Saving Allocation Guide",
      "KB-712: High Net Worth Portfolio Prospectus"
    ],
    transcript: [
      { speaker: "Vikram Patel", text: "Looking for tax-saving investments under Section 80C with good long-term returns.", time: "00:12" },
      { speaker: "Agent Suresh", text: "ELSS funds offer maximum returns with shortest 3-year lock in. Let me share portfolio PDF.", time: "00:40" }
    ]
  },
  {
    id: "call-104",
    lead_id: "lead-9420",
    formatted_lead_id: "LEAD-9420",
    customer_name: "Priya Nair",
    phone_number: "+91 96321 87654",
    location: "Kochi, KL",
    language: "Malayalam / Eng",
    priority: "medium",
    is_vip: false,
    agent_id: "agent-85112",
    agent_name: "Agent Rahul",
    agent_role: "AI Inbound Desk",
    supervisor_name: "Supervisor Anita",
    agent_status: "listening",
    speaker_active: "customer",
    pool_id: "pool-support",
    pool_name: "Customer Care Pool",
    queue_name: "General Enquiries",
    campaign_name: "Rewards Hotline",
    direction: "inbound",
    timer_seconds: 52,
    sentiment: "Positive",
    sentiment_score: 88,
    emotion: "Friendly",
    mos_score: "MOS 4.5 (HD)",
    latency_ms: "20ms",
    queue_position: "#1",
    wait_time: "05s",
    ai_confidence: "97.8%",
    win_probability: "84%",
    compliance_score: 95,
    intent: "Reward points redemption inquiry",
    risk_level: "Low",
    ai_suggestions: [
      "Check current balance: 14,250 Reward Points",
      "Offer Amazon gift voucher redemption options"
    ],
    knowledge_base: [
      "KB-904: Rewards Catalogue Conversion Rates"
    ],
    transcript: [
      { speaker: "Priya Nair", text: "How can I redeem my 14,000 credit card reward points for shopping vouchers?", time: "00:15" },
      { speaker: "Agent Rahul", text: "You can convert them instantly to ₹3,500 Amazon Vouchers right inside our portal.", time: "00:30" }
    ]
  }
];

// Circular Call Duration Timer
function CircularTimer({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  const formattedMins = String(mins).padStart(2, "0");

  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const progress = (seconds % 60) / 60;
  const dashoffset = circumference - progress * circumference;

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-xl shadow-2xs">
      <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
        <svg className="w-6 h-6 -rotate-90 transform" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={radius} className="text-slate-200" strokeWidth="3" stroke="currentColor" fill="none" />
          <circle
            cx="18"
            cy="18"
            r={radius}
            className="text-[#1E5EFF] transition-all duration-500 ease-linear"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
          />
        </svg>
        <Clock className="h-2.5 w-2.5 text-[#1E5EFF] absolute" />
      </div>
      <span className="font-mono font-black text-slate-900 text-xs tracking-tight">
        {formattedMins}:{secs}
      </span>
    </div>
  );
}

// AI Sentiment Gauge Ring
function SentimentGauge({ score }: { score: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let strokeColor = "text-[#10B981]";
  if (score < 60) strokeColor = "text-[#EF4444]";
  else if (score < 80) strokeColor = "text-[#F59E0B]";

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          className={`${strokeColor} transition-all duration-700 ease-out`}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="none"
        />
      </svg>
      <span className="absolute font-black text-xs text-slate-900 font-mono">{score}%</span>
    </div>
  );
}

// Sound Equalizer Waveform Animation
function VoiceWaveform({ speaker = "customer" }: { speaker?: string }) {
  const color = speaker === "agent" ? "bg-[#1E5EFF]" : speaker === "ai" ? "bg-[#0D9488]" : "bg-[#10B981]";
  return (
    <div className="flex items-center gap-0.5 h-5 px-2 py-1 bg-slate-100/90 border border-slate-200/80 rounded-lg">
      <span className={`w-0.5 ${color} rounded-full h-2 animate-[equalizer_0.8s_ease-in-out_infinite]`} />
      <span className={`w-0.5 ${color} rounded-full h-4 animate-[equalizer_1.1s_ease-in-out_infinite_0.2s]`} />
      <span className={`w-0.5 ${color} rounded-full h-2.5 animate-[equalizer_0.9s_ease-in-out_infinite_0.4s]`} />
      <span className={`w-0.5 ${color} rounded-full h-3.5 animate-[equalizer_1.3s_ease-in-out_infinite_0.1s]`} />
      <span className={`w-0.5 ${color} rounded-full h-2 animate-[equalizer_1.0s_ease-in-out_infinite_0.3s]`} />
    </div>
  );
}

export default function LiveCalls() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [chipFilter, setChipFilter] = useState("all");

  // Tabs scroll state
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  // AI Insights slide-out drawer
  const [selectedDrawerCall, setSelectedDrawerCall] = useState<LiveCall | null>(null);

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

  const fetchLiveCalls = async () => {
    try {
      const data = await api.get("/api/calls/live");
      if (Array.isArray(data) && data.length > 0) {
        const enriched = data.map((c: any, idx: number) => {
          const fallback = MOCK_LIVE_CALLS[idx % MOCK_LIVE_CALLS.length];
          return {
            ...fallback,
            ...c,
            id: c.id || fallback.id,
            timer_seconds: c.timer_seconds || fallback.timer_seconds
          };
        });
        setCalls(enriched);
      } else {
        setCalls(MOCK_LIVE_CALLS);
      }
    } catch (err) {
      setCalls(MOCK_LIVE_CALLS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveCalls();
    const interval = setInterval(fetchLiveCalls, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleControlAction = async (
    callId: string,
    action: "listen" | "whisper" | "barge" | "transfer" | "hold" | "mute" | "end" | "crm"
  ) => {
    const targetCall = calls.find(c => c.id === callId);
    const customer = targetCall?.customer_name || "Customer";
    const leadCode = targetCall?.formatted_lead_id || callId;

    try {
      await api.post(`/api/calls/${callId}/monitor`, { action });
    } catch (err) {}

    switch (action) {
      case "listen":
        showToast(`🎧 Silent monitoring mode active for channel #${leadCode}`, "info");
        break;
      case "whisper":
        showToast(`🗣️ Whisper coaching line connected for ${targetCall?.agent_name || "Agent"}`, "success");
        break;
      case "barge":
        showToast(`🎙️ Barged into live call with ${customer}`, "info");
        break;
      case "transfer":
        showToast(`↗️ Initiated call transfer protocol for channel #${leadCode}`, "info");
        break;
      case "hold":
        showToast(`⏸️ Channel placed on hold for ${customer}`, "info");
        break;
      case "mute":
        showToast(`🔇 Muted agent line for channel #${leadCode}`, "info");
        break;
      case "crm":
        setSelectedDrawerCall(targetCall || null);
        showToast(`📋 Opening AI Telemetry & CRM Drawer for ${customer}`, "info");
        break;
      case "end":
        showToast(`🔴 Terminated live call session for ${customer}`, "error");
        setCalls(prev => prev.filter(c => c.id !== callId));
        if (selectedDrawerCall?.id === callId) setSelectedDrawerCall(null);
        break;
    }
  };

  // Filtered live calls
  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (call.customer_name || "").toLowerCase().includes(query) ||
        (call.phone_number || "").includes(query) ||
        (call.formatted_lead_id || "").toLowerCase().includes(query) ||
        (call.agent_name || "").toLowerCase().includes(query) ||
        (call.pool_name || "").toLowerCase().includes(query);

      let matchesChip = true;
      if (chipFilter === "inbound") matchesChip = call.direction === "inbound";
      if (chipFilter === "outbound") matchesChip = call.direction === "outbound";
      if (chipFilter === "high") matchesChip = call.priority === "high";
      if (chipFilter === "urgent") matchesChip = call.priority === "urgent";
      if (chipFilter === "active") matchesChip = (call as any).status === "active" || (call as any).agent_status !== "on_hold";

      return matchesSearch && matchesChip;
    });
  }, [calls, searchQuery, chipFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full font-sans pb-16">
      
      {/* 1. COMPACT ENTERPRISE HEADER (REDUCED HEIGHT BY 20%) */}
      <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1E5EFF]/10 text-[#1E5EFF] rounded-xl border border-[#1E5EFF]/20">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight leading-none">Live Call Console</h1>
              <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
                ONLINE (300ms)
              </span>
            </div>
            <p className="text-[13px] font-semibold text-slate-400 mt-1">Real-time contact center channels & AI telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <span className="text-[13px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Showing <strong className="text-slate-900">{filteredCalls.length}</strong> of {calls.length} Active Calls
          </span>
          <button
            onClick={fetchLiveCalls}
            className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#1E5EFF]" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR PANEL (NORMAL PAGE FLOW) */}
      <div className="w-full">
        <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-3.5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* LEFT: FIXED WIDTH SEARCH INPUT (NEVER EXCEEDS 420px) */}
          <div className="relative w-full sm:w-[320px] lg:w-[380px] max-w-[420px] shrink-0">
            <Search className="h-4 w-4 text-[#1E5EFF] absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads, calls, phone, agent..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-[44px] pl-10 pr-9 border border-slate-200 rounded-[16px] text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] font-semibold text-slate-800 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* RIGHT: HORIZONTALLY SCROLLABLE FILTER CHIPS CONTAINER */}
          <div className="relative flex-1 min-w-0 flex items-center gap-2 w-full sm:w-auto">
            
            {/* Left Scroll Arrow */}
            {showScrollLeft && (
              <button
                onClick={() => handleScrollTabs("left")}
                className="h-[38px] w-[38px] rounded-xl bg-white hover:bg-[#1E5EFF] hover:text-white text-slate-700 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 active:scale-95 z-20"
                title="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Scrollable Chips */}
            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-2.5 overflow-x-auto scroll-smooth w-full py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-nowrap"
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
                  className={`h-[42px] px-4 rounded-[16px] text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center justify-center ${
                    chipFilter === chip.id
                      ? "bg-[#1E5EFF] text-white shadow-md shadow-blue-900/15"
                      : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Right Scroll Arrow */}
            {showScrollRight && (
              <button
                onClick={() => handleScrollTabs("right")}
                className="h-[38px] w-[38px] rounded-xl bg-white hover:bg-[#1E5EFF] hover:text-white text-slate-700 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 active:scale-95 z-20"
                title="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Clear Button */}
            {(searchQuery || chipFilter !== "all") && (
              <button
                onClick={() => { setSearchQuery(""); setChipFilter("all"); }}
                className="h-[42px] px-3.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-[16px] text-xs font-bold transition hover:bg-rose-100 shrink-0 cursor-pointer flex items-center justify-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}

          </div>

        </div>
      </div>

      {/* 3. MAIN CONTENT: 3-COLUMN LIVE CALL CARDS & SLIDE-OUT AI INSIGHTS DRAWER */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* CARDS LIST CONTAINER (8/12 OR 12/12) */}
        <div className={`col-span-12 ${selectedDrawerCall ? "lg:col-span-7" : "lg:col-span-12"} space-y-4 transition-all duration-300`}>
          {filteredCalls.map((call) => {
            const isUrgent = call.priority === "urgent";
            const isHigh = call.priority === "high";

            const priorityBadge = isUrgent
              ? "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40"
              : isHigh
              ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
              : "bg-slate-100 text-slate-600 border-slate-200";

            const directionBadge = call.direction === "inbound"
              ? "bg-[#1E5EFF] text-white"
              : "bg-[#7C3AED] text-white";

            const borderAccent = call.direction === "inbound"
              ? "border-l-[#1E5EFF]"
              : "border-l-[#7C3AED]";

            const customerInitial = call.customer_name[0]?.toUpperCase() || "C";
            const agentInitial = call.agent_name ? call.agent_name.split(" ")[1]?.[0] || "A" : "A";

            return (
              <motion.div
                key={call.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                whileHover={{ scale: 1.01 }}
                className={`bg-white rounded-[18px] border border-slate-200/80 shadow-md hover:shadow-xl transition-all duration-250 p-5 space-y-4 border-l-[6px] ${borderAccent}`}
              >
                {/* 3-COLUMN LAYOUT */}
                <div className="grid grid-cols-12 gap-4 items-center">
                  
                  {/* LEFT COLUMN (4 COLS): CUSTOMER PROFILE */}
                  <div className="col-span-12 lg:col-span-4 space-y-2 border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#1E5EFF] to-blue-500 text-white flex items-center justify-center font-black text-sm shadow-md">
                          {customerInitial}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#10B981] border-2 border-white" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-black text-[#0F172A] text-[20px] tracking-tight truncate leading-tight">
                          {call.customer_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                            {call.formatted_lead_id}
                          </span>
                          {call.is_vip && (
                            <span className="text-[10px] font-black bg-[#F5B301]/20 text-[#D4AF37] border border-[#F5B301]/40 px-2 py-0.5 rounded-md uppercase">
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[13px] pt-1">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Phone className="h-3.5 w-3.5 text-[#1E5EFF]" />
                        <span>{call.phone_number}</span>
                      </div>
                      {call.location && (
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{call.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${directionBadge}`}>
                          {call.direction}
                        </span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {call.language}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${priorityBadge}`}>
                          {call.priority || "Medium"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CENTER COLUMN (5 COLS): AGENT, POOL, TIMER & WAVEFORM */}
                  <div className="col-span-12 lg:col-span-5 space-y-3 border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:px-2">
                    
                    {/* Agent Card */}
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-[#0F172A] text-[#F5B301] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {agentInitial}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-[13px] truncate">{call.agent_name}</div>
                          <div className="text-[11px] text-slate-400 font-semibold truncate">{call.agent_role || "Voice Specialist"}</div>
                        </div>
                      </div>
                      <VoiceWaveform speaker={call.speaker_active} />
                    </div>

                    {/* Department Pool, Queue & Timer */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[13px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-purple-50 text-[#7C3AED] border border-purple-200 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Megaphone className="h-3 w-3" /> {call.pool_name}
                        </span>
                        <span className="bg-blue-50 text-[#1E5EFF] border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Layers className="h-3 w-3" /> {call.queue_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CircularTimer seconds={call.timer_seconds} />
                        <span className="px-2 py-1 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-extrabold rounded-lg flex items-center gap-1 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" /> REC
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN (3 COLS): AI SENTIMENT, MOS & LATENCY */}
                  <div className="col-span-12 lg:col-span-3 space-y-2 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-3">
                      <SentimentGauge score={call.sentiment_score} />
                      <div className="text-left">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">AI Sentiment</span>
                        <span className="text-[15px] font-black text-slate-900">{call.sentiment}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 w-full pt-1">
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">AI Conf</span>
                        <span className="text-[13px] font-black text-[#10B981]">{call.ai_confidence || "98.5%"}</span>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Win Prob</span>
                        <span className="text-[13px] font-black text-[#1E5EFF]">{call.win_probability || "92%"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[11px] font-bold font-mono pt-1">
                      <span className="text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {call.mos_score || "MOS 4.6"}
                      </span>
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {call.latency_ms || "18ms"}
                      </span>
                    </div>
                  </div>

                </div>

                {/* BOTTOM ACTION BAR (EQUAL BUTTON SIZES WITH ENTERPRISE COLORS) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 w-full">
                    
                    <button
                      onClick={() => handleControlAction(call.id, "listen")}
                      className="py-2 px-2 bg-blue-50 hover:bg-[#1E5EFF] text-[#1E5EFF] hover:text-white rounded-xl text-[13px] font-extrabold transition border border-blue-200/80 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      <span>Listen</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "whisper")}
                      className="py-2 px-2 bg-emerald-50 hover:bg-[#10B981] text-[#10B981] hover:text-white rounded-xl text-[13px] font-extrabold transition border border-emerald-200/80 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Whisper</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "barge")}
                      className="py-2 px-2 bg-amber-50 hover:bg-[#F59E0B] text-[#F59E0B] hover:text-white rounded-xl text-[13px] font-extrabold transition border border-amber-200/80 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Barge</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "transfer")}
                      className="py-2 px-2 bg-purple-50 hover:bg-[#7C3AED] text-[#7C3AED] hover:text-white rounded-xl text-[13px] font-extrabold transition border border-purple-200/80 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <PhoneForwarded className="h-3.5 w-3.5" />
                      <span>Transfer</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "hold")}
                      className="py-2 px-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl text-[13px] font-extrabold transition border border-slate-200 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Hold</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "mute")}
                      className="py-2 px-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl text-[13px] font-extrabold transition border border-slate-200 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <MicOff className="h-3.5 w-3.5" />
                      <span>Mute</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "crm")}
                      className="py-2 px-2 bg-[#0F172A] hover:bg-slate-800 text-[#F5B301] rounded-xl text-[13px] font-extrabold transition border border-slate-800 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Brain className="h-3.5 w-3.5 text-[#F5B301]" />
                      <span>AI Insights</span>
                    </button>

                    <button
                      onClick={() => handleControlAction(call.id, "end")}
                      className="py-2 px-2 bg-[#EF4444]/10 hover:bg-[#EF4444] text-[#EF4444] hover:text-white rounded-xl text-[13px] font-extrabold transition border border-[#EF4444]/30 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      <span>End Call</span>
                    </button>

                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* SLIDE-OUT AI INSIGHTS RIGHT DRAWER (5/12) */}
        {selectedDrawerCall && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="col-span-12 lg:col-span-5 bg-white rounded-[20px] p-5 shadow-xl border border-slate-200 space-y-4 font-sans self-start"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0F172A] text-[#F5B301] rounded-xl border border-slate-800">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-[#0F172A] text-lg">{selectedDrawerCall.customer_name}</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">{selectedDrawerCall.formatted_lead_id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDrawerCall(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer Intent & Risk Level */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
              <div className="text-[11px] font-extrabold text-[#1E5EFF] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Customer Intent Detected
              </div>
              <p className="text-[13px] font-bold text-slate-800">{selectedDrawerCall.intent || "Product limit inquiry & rate negotiation"}</p>
            </div>

            {/* AI Suggested Prompts */}
            <div className="space-y-2">
              <div className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-[#10B981]" />
                <span>Next Best Action Prompts</span>
              </div>
              <div className="space-y-1.5">
                {(selectedDrawerCall.ai_suggestions || [
                  "Offer first-year annual fee waiver",
                  "Mention 100% digital e-KYC approval link"
                ]).map((sug, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Base Recommendations */}
            {selectedDrawerCall.knowledge_base && (
              <div className="space-y-2">
                <div className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[#7C3AED]" />
                  <span>Knowledge Base Solutions</span>
                </div>
                <div className="space-y-1">
                  {selectedDrawerCall.knowledge_base.map((kb, idx) => (
                    <div key={idx} className="p-2 bg-purple-50/60 border border-purple-200/80 rounded-lg text-[12px] font-bold text-[#7C3AED]">
                      {kb}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Transcript Stream */}
            <div className="space-y-2">
              <div className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#1E5EFF]" />
                  <span>Live Transcript Stream</span>
                </span>
                <span className="text-[10px] font-bold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Real-time
                </span>
              </div>

              <div className="bg-[#0F172A] text-slate-200 p-3 rounded-xl max-h-56 overflow-y-auto space-y-2.5 text-xs font-mono">
                {(selectedDrawerCall.transcript || []).map((t, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span className={t.speaker.includes("AI") ? "text-[#F5B301]" : t.speaker.includes("Agent") ? "text-blue-400" : "text-[#10B981]"}>
                        [{t.speaker}]
                      </span>
                      <span>{t.time}</span>
                    </div>
                    <p className="text-slate-100 font-sans text-[13px]">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

      </div>

    </div>
  );
}
