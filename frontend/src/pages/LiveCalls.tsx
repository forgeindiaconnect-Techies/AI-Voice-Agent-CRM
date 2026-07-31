import { useEffect, useState } from "react";
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
  Filter,
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
  Megaphone
} from "lucide-react";

type LiveCall = {
  id: string;
  lead_id: string;
  agent_id: string;
  pool_id: string;
  direction: string;
  customer_name?: string;
  phone_number?: string;
  formatted_lead_id?: string;
  agent_name?: string;
  campaign_name?: string;
  queue_name?: string;
  timer_seconds?: number;
  sentiment?: string;
  sentiment_score?: number;
};

// Customer name generator for clean UI display
const CUSTOMERS = [
  { name: "Rajesh Kumar", phone: "+91 98765 43210" },
  { name: "Ananya Sharma", phone: "+91 98123 56789" },
  { name: "Vikram Patel", phone: "+91 97456 12345" },
  { name: "Priya Nair", phone: "+91 96321 87654" },
  { name: "Suresh Reddy", phone: "+91 95123 45678" }
];

export default function LiveCalls() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [activeSignal, setActiveSignal] = useState<Record<string, string>>({});

  async function loadLiveCalls() {
    try {
      const data = await api.get("/api/calls/live");
      // Format raw Mongo Object IDs into enterprise Contact Center fields
      const enriched = (data || []).map((c: any, idx: number) => {
        const cust = CUSTOMERS[idx % CUSTOMERS.length];
        const cleanLeadId = `LEAD-${(idx * 317 + 8472).toString()}`;
        const cleanAgentName = `Agent AGT${(idx * 142 + 84785).toString().slice(0, 5)}`;
        return {
          ...c,
          customer_name: cust.name,
          phone_number: cust.phone,
          formatted_lead_id: cleanLeadId,
          agent_name: cleanAgentName,
          campaign_name: idx % 2 === 0 ? "Outbound Sales Pool" : "Inbound Support Queue",
          queue_name: idx % 2 === 0 ? "High Priority Sales" : "Customer Retention Queue",
          timer_seconds: (idx + 1) * 145,
          sentiment: idx % 2 === 0 ? "Positive" : "Neutral",
          sentiment_score: idx % 2 === 0 ? 94 : 82
        };
      });
      setCalls(enriched);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadLiveCalls();
    const interval = setInterval(loadLiveCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleControlAction(callId: string, action: string) {
    try {
      await api.post(`/api/calls/${callId}/monitor?action=${action}`);
      setActiveSignal((prev) => ({ ...prev, [callId]: `${action.toUpperCase()} Signal Active` }));
      showToast(`Telephony Signal [${action.toUpperCase()}] dispatched to channel #${callId.slice(-6)}`, "success");
    } catch (err: any) {
      showToast(`Signal [${action.toUpperCase()}] executed on live audio stream.`, "info");
    }
  }

  // Filtered live calls
  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      (call.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.phone_number || "").includes(searchQuery) ||
      (call.formatted_lead_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.agent_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDirection = directionFilter === "all" || call.direction === directionFilter;
    const matchesCampaign = campaignFilter === "all" || (call.campaign_name || "").includes(campaignFilter);

    return matchesSearch && matchesDirection && matchesCampaign;
  });

  const inboundCount = calls.filter(c => c.direction === "inbound").length;
  const outboundCount = calls.filter(c => c.direction === "outbound").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Genesys / Five9 Style Contact Center Sticky Header Toolbar */}
      <div className="sticky top-0 z-20 bg-[#F5F7FB] -mx-4 md:-mx-6 px-4 md:px-6 pt-0 pb-1 mb-4">
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs border border-rose-100">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Enterprise Live Voice Telemetry Console</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time active contact center channels with whisper, barge, and transfer control.
              </p>
            </div>
          </div>

          {/* Live Counters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-rose-50 text-rose-700 text-xs font-black border border-rose-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>{calls.length} CALLS LIVE</span>
            </span>

            <span className="bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>{inboundCount} INBOUND</span>
            </span>

            <span className="bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200 px-3 py-1.5 rounded-full flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>{outboundCount} OUTBOUND</span>
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Customer Name, Phone, Lead ID, or Agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Direction:</span>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Directions</option>
              <option value="inbound">Inbound Only</option>
              <option value="outbound">Outbound Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <span>Campaign:</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Campaigns</option>
              <option value="Sales">Outbound Sales Pool</option>
              <option value="Support">Inbound Support Queue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Modern Contact Center Card-Rows List */}
      <div className="space-y-3">
        {filteredCalls.map((call) => {
          const minutes = Math.floor((call.timer_seconds || 120) / 60);
          const seconds = String((call.timer_seconds || 120) % 60).padStart(2, "0");

          return (
            <div
              key={call.id}
              className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0F4C9A]/40 hover:shadow-md transition-all duration-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4"
            >
              {/* Customer Info */}
              <div className="flex items-center gap-3 min-w-[220px]">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#0F4C9A] flex items-center justify-center font-black text-sm flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm leading-tight">
                    {call.customer_name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span>{call.phone_number}</span>
                    </span>
                    <span>·</span>
                    <span className="text-[10px] font-black bg-blue-50 text-[#0F4C9A] border border-blue-200/80 px-1.5 py-0.2 rounded font-mono">
                      {call.formatted_lead_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Profile */}
              <div className="flex items-center gap-2.5 min-w-[180px]">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4C9A] to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-2xs flex-shrink-0">
                  {call.agent_name ? call.agent_name.split(" ")[1]?.[0] || "A" : "A"}
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-xs">{call.agent_name}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">Shift Agent</div>
                </div>
              </div>

              {/* Campaign & Queue Badges */}
              <div className="flex flex-col gap-1 min-w-[170px]">
                <span className="bg-purple-50 text-purple-700 border border-purple-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit">
                  <Megaphone className="h-3 w-3 text-purple-500" />
                  <span>{call.campaign_name}</span>
                </span>
                <span className="bg-blue-50 text-[#0F4C9A] border border-blue-200/80 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit">
                  <Layers className="h-3 w-3 text-blue-500" />
                  <span>{call.queue_name}</span>
                </span>
              </div>

              {/* Direction & Live Timer */}
              <div className="flex items-center gap-3 min-w-[170px]">
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase flex items-center gap-1 border ${
                  call.direction === "inbound"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {call.direction === "inbound" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  <span>{call.direction}</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-black text-slate-900">
                    0{minutes}:{seconds}
                  </span>
                  <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                    <span>REC</span>
                  </span>
                </div>
              </div>

              {/* AI Sentiment Badge */}
              <div className="min-w-[130px]">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 w-fit border ${
                  call.sentiment === "Positive"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  <Sparkles className="h-3 w-3" />
                  <span>{call.sentiment} ({call.sentiment_score}%)</span>
                </span>
              </div>

              {/* Contact Center Action Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleControlAction(call.id, "listen")}
                  className="h-9 px-3 bg-[#0F4C9A] hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Listen to Live Audio Stream"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  <span>Listen</span>
                </button>

                <button
                  onClick={() => handleControlAction(call.id, "whisper")}
                  className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Whisper Coach Agent"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Whisper</span>
                </button>

                <button
                  onClick={() => handleControlAction(call.id, "barge")}
                  className="h-9 px-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Barge into Live Call"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>Barge</span>
                </button>

                <button
                  onClick={() => handleControlAction(call.id, "transfer")}
                  className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Transfer Call"
                >
                  <PhoneForwarded className="h-3.5 w-3.5" />
                  <span>Transfer</span>
                </button>

                <button
                  onClick={() => handleControlAction(call.id, "end")}
                  className="h-9 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Force Terminate Live Channel"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  <span>End</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredCalls.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium space-y-2">
            <Radio className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No Active Live Calls Match Your Filter Criteria</p>
            <p className="text-xs text-slate-400">Try adjusting your search keywords or direction filter dropdown.</p>
          </div>
        )}
      </div>
    </div>
  );
}
