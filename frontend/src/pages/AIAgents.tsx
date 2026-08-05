import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, getWsUrl } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { CustomSelect } from "../components/CustomSelect";
import {
  Bot,
  Plus,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Edit,
  Trash2,
  Power,
  X,
  Sparkles,
  Volume2,
  ShieldAlert,
  Copy,
  BarChart3,
  Globe,
  Sliders,
  Clock,
  Cpu,
  Radio,
  CheckCircle2
} from "lucide-react";

type AIAgent = {
  id: string;
  agent_id: string;
  name: string;
  voice_model: string;
  language: string;
  status: "online" | "offline" | "busy" | "in_call";
  is_active: boolean;
  system_prompt?: string;
  concurrency_limit: number;
  temperature: number;
  max_call_duration_seconds: number;
  description?: string;
  created_at?: string;
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "online", label: "Online Only" },
  { value: "in_call", label: "In Call Only" },
  { value: "busy", label: "Busy Only" },
  { value: "offline", label: "Offline Only" }
];

const VOICE_FILTER_OPTIONS = [
  { value: "", label: "All Voice Models" },
  { value: "Neural-Female-IN", label: "Neural-Female (English IN)" },
  { value: "Neural-Male-IN", label: "Neural-Male (English IN)" },
  { value: "Neural-Hindi-Female", label: "Neural-Female (Hindi)" }
];

const SORT_BY_OPTIONS = [
  { value: "name", label: "Sort by Name" },
  { value: "status", label: "Sort by Status" }
];

const VOICE_MODEL_OPTIONS = [
  { value: "Neural-Female-IN", label: "Neural-Female (Indian English)" },
  { value: "Neural-Male-IN", label: "Neural-Male (Indian English)" },
  { value: "Neural-Hindi-Female", label: "Neural-Female (Hindi)" }
];

export default function AIAgents() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [voiceFilter, setVoiceFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "status" | "created_at">("name");

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (voiceFilter) count++;
    if (sortBy !== "name") count++;
    return count;
  }, [statusFilter, voiceFilter, sortBy]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setVoiceFilter("");
    setSortBy("name");
  };

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AIAgent | null>(null);
  const [previewPromptAgent, setPreviewPromptAgent] = useState<AIAgent | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    voice_model: "Neural-Female-IN",
    language: "English",
    system_prompt: "You are a professional customer care AI assistant for Forge India Connect.",
    concurrency_limit: 5,
    temperature: 0.7,
    max_call_duration_seconds: 300,
    description: "",
    is_active: true
  });

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = "/api/ai-agents?";
      if (searchQuery) url += `query=${encodeURIComponent(searchQuery)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (voiceFilter) url += `voice_model=${encodeURIComponent(voiceFilter)}&`;
      if (activeFilter !== "") url += `is_active=${activeFilter === "true"}&`;

      const data = await api.get(url);
      setAgents(data);
    } catch (err: any) {
      const msg = err.message || "Failed to load AI Agents data";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, voiceFilter, activeFilter, showToast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Real-time WebSocket updates
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(getWsUrl("/global"));
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "ai_agents_updated") {
            fetchAgents();
          }
        } catch (e) {
          // fallback
        }
      };
    } catch (e) {
      // WS fallback
    }

    return () => {
      if (socket) {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket?.close();
        } else {
          socket.close();
        }
      }
    };
  }, [fetchAgents]);

  const handleOpenCreateModal = () => {
    setEditingAgent(null);
    setForm({
      name: "",
      voice_model: "Neural-Female-IN",
      language: "English",
      system_prompt: "You are a professional customer care AI assistant for Forge India Connect.",
      concurrency_limit: 5,
      temperature: 0.7,
      max_call_duration_seconds: 300,
      description: "",
      is_active: true
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (agent: AIAgent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      voice_model: agent.voice_model || "Neural-Female-IN",
      language: agent.language || "English",
      system_prompt: agent.system_prompt || "",
      concurrency_limit: agent.concurrency_limit || 5,
      temperature: agent.temperature || 0.7,
      max_call_duration_seconds: agent.max_call_duration_seconds || 300,
      description: agent.description || "",
      is_active: agent.is_active
    });
    setShowCreateModal(true);
  };

  const handleDuplicateAgent = async (agent: AIAgent) => {
    const duplicatedForm = {
      name: `${agent.name} (Copy)`,
      voice_model: agent.voice_model || "Neural-Female-IN",
      language: agent.language || "English",
      system_prompt: agent.system_prompt || "",
      concurrency_limit: agent.concurrency_limit || 5,
      temperature: agent.temperature || 0.7,
      max_call_duration_seconds: agent.max_call_duration_seconds || 300,
      description: agent.description || "",
      is_active: false
    };
    try {
      await api.post("/api/ai-agents", duplicatedForm);
      showToast(`Duplicated ${agent.name} successfully!`, "success");
      fetchAgents();
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate agent", "error");
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      showToast("Agent Name is required.", "error");
      return;
    }

    try {
      if (editingAgent) {
        setAgents(prev => prev.map(a => a.id === editingAgent.id ? { ...a, ...form } : a));
        await api.put(`/api/ai-agents/${editingAgent.id}`, form);
        showToast(`AI Agent ${editingAgent.agent_id} updated successfully!`, "success");
      } else {
        await api.post("/api/ai-agents", form);
        showToast("New AI Agent created successfully!", "success");
      }

      setShowCreateModal(false);
      setEditingAgent(null);
      fetchAgents();
    } catch (err: any) {
      showToast(err.message || "Failed to save AI Agent", "error");
      fetchAgents();
    }
  };

  const handleToggleActive = async (agent: AIAgent) => {
    const nextState = !agent.is_active;
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: nextState } : a));

    try {
      await api.patch(`/api/ai-agents/${agent.id}/toggle-status?is_active=${nextState}`);
      showToast(`AI Agent ${agent.agent_id} is now ${nextState ? "Active" : "Inactive"}`, "success");
      fetchAgents();
    } catch (err: any) {
      showToast(err.message || "Failed to toggle status", "error");
      fetchAgents();
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgent) return;
    try {
      setAgents(prev => prev.filter(a => a.id !== deletingAgent.id));
      await api.delete(`/api/ai-agents/${deletingAgent.id}`);
      showToast(`AI Agent ${deletingAgent.agent_id} deleted successfully.`, "success");
      setDeletingAgent(null);
      fetchAgents();
    } catch (err: any) {
      showToast(err.message || "Failed to delete AI Agent", "error");
      fetchAgents();
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "status") return (a.status || "offline").localeCompare(b.status || "offline");
    return 0;
  });

  const isAdmin = user?.role === "admin";
  const onlineCount = agents.filter(a => a.status === "online" && a.is_active).length;
  const busyCount = agents.filter(a => a.status === "busy" || a.status === "in_call").length;
  const offlineCount = agents.filter(a => a.status === "offline" || !a.is_active).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans pb-16">
      
      {/* ── 1. HEADER SECTION (Clean Pure White Card in Light Mode | Navy Gradient in Dark Mode) ── */}
      <div className="rounded-[24px] bg-white dark:bg-gradient-to-r dark:from-[#111827] dark:via-[#152238] dark:to-[#1E293B] border border-slate-200/90 dark:border-white/10 p-7 shadow-md shadow-slate-200/50 dark:shadow-lg relative overflow-hidden transition-all duration-300">
        {/* Top Subtle Blue Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#60A5FA]" />

        {/* Dark Mode Soft Ambient Blue Glow behind Icon */}
        <div className="hidden dark:block absolute top-1/2 left-8 -translate-y-1/2 w-32 h-32 bg-blue-500/20 blur-2xl pointer-events-none rounded-full" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {/* 64x64 AI Robot Icon Container with Dual Gradient Border */}
              <div className="h-[64px] w-[64px] rounded-[22px] p-[3px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-[0_8px_20px_-4px_rgba(37,99,235,0.35),0_8px_20px_-4px_rgba(250,204,21,0.25)] shrink-0 transition-transform duration-300 hover:scale-105">
                <div className="w-full h-full rounded-[19px] bg-gradient-to-br from-[#2563EB] to-[#1E5EFF] dark:from-[#1E3A8A] dark:to-[#172554] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-[19px]" />
                  <Bot className="h-8 w-8 text-white relative z-10 drop-shadow-xs" />
                </div>
              </div>
              <div>
                <h1 className="text-[34px] font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-none">
                  AI Voice Agents Directory
                </h1>
                <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]/75 font-medium mt-1.5">
                  Manage neural speech bots, personas, speech parameters, and live telemetry
                </p>
              </div>
            </div>

            {/* 36px Premium Status Chips / Pills */}
            <div className="flex items-center gap-2.5 pt-1 flex-wrap text-xs font-bold">
              <span className="h-9 px-3.5 rounded-full bg-slate-100 dark:bg-[#1B2740] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/10 font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition">
                <span>🤖</span>
                <span className="font-mono">{agents.length} Total Bots</span>
              </span>
              <span className="h-9 px-3.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-500/15 text-[#047857] dark:text-[#34D399] border border-[#A7F3D0] dark:border-emerald-500/30 font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono">{onlineCount} Online &amp; Active</span>
              </span>
              <span className="h-9 px-3.5 rounded-full bg-[#FEF3C7] dark:bg-amber-500/15 text-[#B45309] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-amber-500/30 font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-mono">{busyCount} Busy / In Call</span>
              </span>
              <span className="h-9 px-3.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-[#64748B] border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition">
                <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span className="font-mono">{offlineCount} Offline / Inactive</span>
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
            {/* Circular Refresh Button */}
            <button
              onClick={fetchAgents}
              className="h-11 w-11 rounded-full bg-white hover:bg-slate-50 dark:bg-[#1B2740] dark:hover:bg-[#253655] text-[#2563EB] dark:text-[#F8FAFC] transition-all duration-300 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer active:scale-95 hover:rotate-180"
              title="Refresh Agents Data"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>

            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="h-[46px] px-6 rounded-[14px] bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>Create AI Agent</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── 2. SEARCH & FILTER BAR (48px / Glass blur) ── */}
      <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-[16px] p-3 shadow-md border border-slate-200/80 dark:border-white/10 flex flex-col lg:flex-row gap-3 items-center justify-between transition-all duration-200">
        
        {/* Search Input (60% Width) */}
        <div className="relative w-full lg:w-[60%]">
          <Search className="h-4 w-4 text-slate-400 dark:text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search AI agents by name, ID, voice model..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-10 border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold bg-slate-50/80 dark:bg-[#151F32] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] transition-all duration-200 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
          
          {/* Active Filter Count Badge */}
          <div className="flex items-center gap-2 px-3 bg-slate-100 dark:bg-[#1B2740] rounded-[14px] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-white/10 shrink-0 h-12">
            <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-[#60A5FA]" />
            <span className="text-xs font-black">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center bg-[#F59E0B] text-slate-950 text-[10px] font-black h-5 w-5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Status Select */}
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="All Statuses"
            className="w-full sm:w-36 shrink-0"
            triggerClassName="h-12 rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#151F32]"
          />

          {/* Voice Model Select */}
          <CustomSelect
            value={voiceFilter}
            onChange={setVoiceFilter}
            options={VOICE_FILTER_OPTIONS}
            placeholder="All Voice Models"
            className="w-full sm:w-44 shrink-0"
            triggerClassName="h-12 rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#151F32]"
          />

          {/* Sort By Select */}
          <CustomSelect
            value={sortBy}
            onChange={val => setSortBy(val as any)}
            options={SORT_BY_OPTIONS}
            placeholder="Sort by"
            className="w-full sm:w-36 shrink-0"
            triggerClassName="h-12 rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#151F32]"
          />

          {/* Reset Filters button */}
          {(searchQuery || activeFilterCount > 0) && (
            <button
              onClick={resetFilters}
              className="h-12 px-3 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[14px] transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95"
            >
              <X className="h-4 w-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. AGENT GRID (4-col on xl, 3-col on lg, 2-col on md, 1-col on sm) ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="dk-card rounded-[20px] p-5 space-y-4 animate-pulse bg-white dark:bg-[#151F32] border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-[56px] w-[56px] rounded-2xl bg-slate-200 dark:bg-[#1B2740]" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-[#1B2740] rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-[#1B2740] rounded w-1/2" />
                </div>
              </div>
              <div className="h-14 bg-slate-100 dark:bg-[#1B2740] rounded-xl" />
              <div className="h-8 bg-slate-200 dark:bg-[#1B2740] rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 rounded-[20px] p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base">Backend Service Error</h3>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchAgents}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : sortedAgents.length === 0 ? (
        <div className="bg-white dark:bg-[#151F32] border border-slate-200 dark:border-white/10 rounded-[20px] p-12 text-center space-y-4 shadow-sm">
          <Bot className="h-12 w-12 text-slate-300 dark:text-[#64748B] mx-auto" />
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base">No AI Agents Found</h3>
            <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">Try clearing filters or create a new AI Voice Bot.</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-[#2563EB] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              Create New Agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedAgents.map(agent => (
            <motion.div
              key={agent.id || agent.agent_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.25 }}
              className={`group bg-white dark:bg-[#151F32] border border-slate-200/90 dark:border-white/10 rounded-[20px] p-5 shadow-sm hover:shadow-xl dark:hover:shadow-blue-500/10 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-250 flex flex-col justify-between space-y-3.5 relative overflow-hidden ${
                agent.is_active ? "" : "opacity-75 bg-slate-50/60 dark:bg-[#111827]"
              }`}
            >
              {/* Top Status Accent Bar */}
              <div className={`absolute top-0 left-0 w-full h-1 ${
                agent.status === "online"
                  ? "bg-emerald-500"
                  : agent.status === "in_call" || agent.status === "busy"
                  ? "bg-amber-500"
                  : "bg-slate-400 dark:bg-slate-700"
              }`} />

              <div className="space-y-3">
                {/* ── CARD HEADER (72px Avatar + Name + Pulse Dot Badge) ── */}
                <div className="flex justify-between items-start gap-3 pt-1">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="relative shrink-0">
                      {/* 72x72 Enterprise Avatar with 135° Blue -> Yellow Gradient Border */}
                      <div className="h-[72px] w-[72px] rounded-[24px] p-[3px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-[0_8px_20px_-4px_rgba(37,99,235,0.35),0_8px_20px_-4px_rgba(250,204,21,0.25)] group-hover:shadow-[0_12px_28px_-2px_rgba(37,99,235,0.5),0_12px_28px_-2px_rgba(250,204,21,0.4)] group-hover:scale-[1.05] group-hover:-translate-y-1 transition-all duration-250 shrink-0 cursor-pointer relative">
                        {/* Inner Glass Container */}
                        <div className="w-full h-full rounded-[21px] bg-gradient-to-br from-[#2563EB] to-[#1E5EFF] dark:from-[#1E3A8A] dark:to-[#172554] flex items-center justify-center relative overflow-hidden">
                          {/* Top-left glass reflection highlight */}
                          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-[21px]" />
                          <Bot className="h-[30px] w-[30px] text-white relative z-10 drop-shadow-xs" />
                        </div>
                      </div>
                      
                      {/* Status indicator dot at bottom-right of avatar with white outline */}
                      <span
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-[#151F32] shadow-sm z-20 ${
                          agent.status === "online" && agent.is_active
                            ? "bg-emerald-500 animate-pulse"
                            : agent.status === "in_call" || agent.status === "busy"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-slate-400 dark:bg-slate-600"
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base truncate leading-tight group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">
                        {agent.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="font-mono font-extrabold text-[10px] bg-slate-100 dark:bg-[#1B2740] text-slate-700 dark:text-[#94A3B8] px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                          {agent.agent_id}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-semibold flex items-center gap-1">
                          <Globe className="h-3 w-3 text-[#2563EB] dark:text-[#60A5FA]" />
                          <span>{agent.language}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge with Dot Pulse */}
                  {agent.status === "online" && agent.is_active ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-[#34D399] dark:border-emerald-500/30 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Online</span>
                    </span>
                  ) : agent.status === "in_call" || agent.status === "busy" ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-[#FCD34D] dark:border-amber-500/30 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Busy</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-[#64748B] dark:border-slate-700 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                      <span>Offline</span>
                    </span>
                  )}
                </div>

                {/* ── VOICE MODEL COMPACT CONTAINER ── */}
                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-[#1B2740]/70 border border-slate-100 dark:border-white/5 p-2.5 rounded-xl">
                  <span className="text-slate-500 dark:text-[#94A3B8] font-semibold flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" />
                    <span>Voice Model:</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC] font-mono text-[11px] truncate max-w-[140px]" title={agent.voice_model}>
                    {agent.voice_model}
                  </span>
                </div>

                {/* ── SYSTEM PERSONA (72px max height + fade + View Prompt) ── */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-[#64748B] font-extrabold uppercase tracking-wider">
                    <span>System Persona</span>
                    <button
                      onClick={() => setPreviewPromptAgent(agent)}
                      className="text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer font-bold"
                    >
                      View Prompt
                    </button>
                  </div>
                  <div className="max-h-[72px] overflow-hidden relative bg-slate-50/80 dark:bg-[#1B2740]/40 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-medium line-clamp-3 italic">
                      "{agent.system_prompt || "No prompt configured"}"
                    </p>
                  </div>
                </div>

                {/* ── TELEMETRY KPI CARDS (3-col compact glass containers) ── */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-0.5">
                  <div className="p-2 bg-slate-50 dark:bg-[#1B2740]/80 rounded-xl border border-slate-100 dark:border-white/5 transition hover:border-blue-500/30">
                    <span className="block text-[9px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">Channels</span>
                    <span className="font-black text-slate-900 dark:text-[#F8FAFC] font-mono text-sm">{agent.concurrency_limit}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-[#1B2740]/80 rounded-xl border border-slate-100 dark:border-white/5 transition hover:border-blue-500/30">
                    <span className="block text-[9px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">Temp</span>
                    <span className="font-black text-slate-900 dark:text-[#F8FAFC] font-mono text-sm">{agent.temperature}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-[#1B2740]/80 rounded-xl border border-slate-100 dark:border-white/5 transition hover:border-blue-500/30">
                    <span className="block text-[9px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">Max Time</span>
                    <span className="font-black text-slate-900 dark:text-[#F8FAFC] font-mono text-sm">{agent.max_call_duration_seconds}s</span>
                  </div>
                </div>
              </div>

              {/* ── BOTTOM ACTIONS TOOLBAR (5 Icon Buttons) ── */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-1.5">
                {/* 1. Toggle Active Icon Button */}
                <button
                  onClick={() => handleToggleActive(agent)}
                  className={`h-9 px-3 rounded-[12px] text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                    agent.is_active
                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-[#34D399] dark:border-emerald-500/30"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-[#64748B] dark:border-slate-700"
                  }`}
                  title={agent.is_active ? "Deactivate Bot" : "Activate Bot"}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{agent.is_active ? "Active" : "Inactive"}</span>
                </button>

                <div className="flex items-center gap-1">
                  {/* 2. Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(agent)}
                    className="h-9 w-9 flex items-center justify-center rounded-[12px] bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] dark:bg-[#1B2740] dark:hover:bg-blue-500/20 dark:text-[#94A3B8] dark:hover:text-[#60A5FA] border border-slate-200 dark:border-white/10 transition cursor-pointer active:scale-95"
                    title="Edit Agent Parameters"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>

                  {/* 3. Duplicate Button */}
                  <button
                    onClick={() => handleDuplicateAgent(agent)}
                    className="h-9 w-9 flex items-center justify-center rounded-[12px] bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600 dark:bg-[#1B2740] dark:hover:bg-purple-500/20 dark:text-[#94A3B8] dark:hover:text-[#A78BFA] border border-slate-200 dark:border-white/10 transition cursor-pointer active:scale-95"
                    title="Duplicate Agent"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>

                  {/* 4. Analytics Button */}
                  <button
                    onClick={() => showToast(`Opening telemetric analytics for ${agent.name}...`, "info")}
                    className="h-9 w-9 flex items-center justify-center rounded-[12px] bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 dark:bg-[#1B2740] dark:hover:bg-amber-500/20 dark:text-[#94A3B8] dark:hover:text-[#FCD34D] border border-slate-200 dark:border-white/10 transition cursor-pointer active:scale-95"
                    title="Agent Telemetry Analytics"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </button>

                  {/* 5. Delete Button */}
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingAgent(agent)}
                      className="h-9 w-9 flex items-center justify-center rounded-[12px] bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-[#1B2740] dark:hover:bg-rose-500/20 dark:text-[#94A3B8] dark:hover:text-[#F87171] border border-slate-200 dark:border-white/10 transition cursor-pointer active:scale-95"
                      title="Delete Agent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151F32] rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-[#F8FAFC]">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>{editingAgent ? `Edit AI Agent (${editingAgent.agent_id})` : "Create New AI Agent"}</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-[#1B2740] rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Agent Name</label>
                <input
                  required
                  placeholder="e.g. Aria — Credit Card Sales Bot"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Voice Model</label>
                  <CustomSelect
                    value={form.voice_model}
                    onChange={val => setForm({ ...form, voice_model: val })}
                    options={VOICE_MODEL_OPTIONS}
                    placeholder="Select Voice Model"
                    triggerClassName="border-slate-200 dark:border-white/10 dark:bg-[#1B2740]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Primary Language</label>
                  <input
                    value={form.language}
                    onChange={e => setForm({ ...form, language: e.target.value })}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">System Prompt / Persona Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Define persona, prompt instructions, conversational goals..."
                  value={form.system_prompt}
                  onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                  className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.concurrency_limit}
                    onChange={e => setForm({ ...form, concurrency_limit: Number(e.target.value) })}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Temperature</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={1.0}
                    value={form.temperature}
                    onChange={e => setForm({ ...form, temperature: Number(e.target.value) })}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Max Call (sec)</label>
                  <input
                    type="number"
                    value={form.max_call_duration_seconds}
                    onChange={e => setForm({ ...form, max_call_duration_seconds: Number(e.target.value) })}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#1B2740] text-slate-900 dark:text-[#F8FAFC] font-bold text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl transition mt-2 cursor-pointer shadow-md"
              >
                {editingAgent ? "Update AI Agent" : "Create &amp; Initialize Bot"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SYSTEM PROMPT PREVIEW MODAL ── */}
      {previewPromptAgent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151F32] rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-[#F8FAFC]">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="font-black text-base">System Persona Instructions</h3>
              <button onClick={() => setPreviewPromptAgent(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-[#1B2740] rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-xs leading-relaxed overflow-y-auto max-h-64 border border-slate-800">
              {previewPromptAgent.system_prompt || "No system prompt specified."}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151F32] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/10 text-center">
            <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base">Delete AI Agent?</h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
                Are you sure you want to delete <strong>{deletingAgent.name}</strong> ({deletingAgent.agent_id})? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeletingAgent(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-[#1B2740] hover:bg-slate-200 text-slate-700 dark:text-[#F8FAFC] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAgent}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


