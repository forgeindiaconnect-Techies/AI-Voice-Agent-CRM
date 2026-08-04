import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, getWsUrl } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import PortalHeader from "../components/PortalHeader";
import {
  Bot,
  Plus,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Edit,
  Trash2,
  Power,
  Play,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Activity,
  PhoneCall,
  Volume2,
  Sliders,
  ShieldAlert
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
          // parse error fallback
        }
      };
    } catch (e) {
      // WebSocket connection error fallback
    }

    return () => {
      if (socket) socket.close();
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

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      showToast("Agent Name is required.", "error");
      return;
    }

    try {
      if (editingAgent) {
        // Optimistic Update
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
    // Optimistic state update
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
      // Optimistic delete
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      
      {/* 1. HERO HEADER SECTION */}
      <div className="p-0.5 rounded-[24px] bg-gradient-to-r from-[#0F4FA8] via-[#1E6AD7] to-[#FFC107] shadow-lg shadow-blue-900/5">
        <div className="bg-white/95 backdrop-blur-md rounded-[23px] p-6 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0F4FA8]/10 text-[#0F4FA8] rounded-xl border border-[#0F4FA8]/20">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI Voice Agents Directory</h1>
                  <p className="text-xs text-slate-500 font-semibold">Manage neural speech bots, personas, speech parameters, and live telemetry</p>
                </div>
              </div>

              {/* Status Chips */}
              <div className="flex items-center gap-2 pt-2 flex-wrap text-xs font-bold">
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                  {agents.length} Total Bots
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} Online & Active
                </span>
                <span className="bg-blue-50 text-[#0F4FA8] px-3 py-1 rounded-full border border-blue-200">
                  {busyCount} Busy / In Call
                </span>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">
                  {offlineCount} Offline / Inactive
                </span>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
              <button
                onClick={fetchAgents}
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition flex items-center justify-center shadow-2xs cursor-pointer"
                title="Refresh Agents Data"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {isAdmin && (
                <button
                  onClick={handleOpenCreateModal}
                  className="bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create AI Agent</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS BAR */}
      <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search AI agents by name, ID, voice model..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-semibold text-slate-800 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap text-xs font-bold">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="online">Online Only</option>
              <option value="in_call">In Call Only</option>
              <option value="busy">Busy Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>

          <select
            value={voiceFilter}
            onChange={e => setVoiceFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
          >
            <option value="">All Voice Models</option>
            <option value="Neural-Female-IN">Neural-Female (English IN)</option>
            <option value="Neural-Male-IN">Neural-Male (English IN)</option>
            <option value="Neural-Hindi-Female">Neural-Female (Hindi)</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
          >
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      {/* 3. MAIN AI AGENTS CARDS GRID / TABLE */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/95 border border-slate-200 rounded-[20px] p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-16 bg-slate-100 rounded-xl" />
              <div className="h-8 bg-slate-200 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-[20px] p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 text-base">Backend Service Offline or Error</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchAgents}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry Connection
          </button>
        </div>
      ) : sortedAgents.length === 0 ? (
        <div className="bg-white/95 border border-slate-200/80 rounded-[20px] p-12 text-center space-y-4 shadow-sm">
          <Bot className="h-12 w-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">No AI Agents Found</h3>
            <p className="text-xs text-slate-400 mt-1">Try clearing filters or create a new AI Voice Bot.</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-[#0F4FA8] text-white text-xs font-bold rounded-xl hover:bg-blue-900 transition"
            >
              Create New Agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAgents.map(agent => (
            <motion.div
              key={agent.id || agent.agent_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`bg-white/95 backdrop-blur-md border rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                agent.is_active ? "border-slate-200/80" : "border-slate-200 bg-slate-50/50 opacity-80"
              }`}
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 w-full h-1 ${
                agent.status === "online"
                  ? "bg-emerald-500"
                  : agent.status === "in_call"
                  ? "bg-[#0F4FA8]"
                  : agent.status === "busy"
                  ? "bg-amber-500"
                  : "bg-slate-400"
              }`} />

              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0F4FA8] flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 text-sm truncate">{agent.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {agent.agent_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{agent.language}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
                    agent.status === "online"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : agent.status === "in_call"
                      ? "bg-blue-50 text-[#0F4FA8] border border-blue-200"
                      : agent.status === "busy"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {(agent.status || "offline").replace("_", " ")}
                  </span>
                </div>

                {/* Voice Model Tag */}
                <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-[#0F4FA8]" />
                    <span>Voice Model:</span>
                  </span>
                  <span className="font-bold text-slate-900 font-mono text-[11px]">{agent.voice_model}</span>
                </div>

                {/* System Prompt Preview */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>System Persona</span>
                    <button
                      onClick={() => setPreviewPromptAgent(agent)}
                      className="text-[#0F4FA8] hover:underline cursor-pointer"
                    >
                      View Prompt
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 font-medium line-clamp-2 bg-slate-50/70 p-2 rounded-lg border border-slate-100 italic">
                    "{agent.system_prompt || "No prompt configured"}"
                  </p>
                </div>

                {/* Telemetry Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Channels</span>
                    <span className="font-black text-slate-900 font-mono">{agent.concurrency_limit}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Temp</span>
                    <span className="font-black text-slate-900 font-mono">{agent.temperature}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Max Time</span>
                    <span className="font-black text-slate-900 font-mono">{agent.max_call_duration_seconds}s</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleActive(agent)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                    agent.is_active
                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                  }`}
                  title={agent.is_active ? "Deactivate Bot" : "Activate Bot"}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{agent.is_active ? "Active" : "Inactive"}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(agent)}
                    className="p-2 hover:bg-blue-50 text-[#0F4FA8] rounded-xl transition cursor-pointer"
                    title="Edit AI Agent"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => setDeletingAgent(agent)}
                      className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition cursor-pointer"
                      title="Delete AI Agent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#0F4FA8]" />
                <span>{editingAgent ? `Edit AI Agent (${editingAgent.agent_id})` : "Create New AI Agent"}</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Voice Model</label>
                  <select
                    value={form.voice_model}
                    onChange={e => setForm({ ...form, voice_model: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold"
                  >
                    <option value="Neural-Female-IN">Neural-Female (Indian English)</option>
                    <option value="Neural-Male-IN">Neural-Male (Indian English)</option>
                    <option value="Neural-Hindi-Female">Neural-Female (Hindi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Primary Language</label>
                  <input
                    value={form.language}
                    onChange={e => setForm({ ...form, language: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold"
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
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
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold text-center"
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
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Max Call (sec)</label>
                  <input
                    type="number"
                    value={form.max_call_duration_seconds}
                    onChange={e => setForm({ ...form, max_call_duration_seconds: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0F4FA8] hover:bg-blue-900 text-white font-extrabold py-3 rounded-xl transition mt-2 cursor-pointer shadow-md"
              >
                {editingAgent ? "Update AI Agent" : "Create & Initialize Bot"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SYSTEM PROMPT PREVIEW MODAL */}
      {previewPromptAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">System Persona Instructions</h3>
              <button onClick={() => setPreviewPromptAgent(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-xs leading-relaxed overflow-y-auto max-h-60 border border-slate-800">
              {previewPromptAgent.system_prompt || "No system prompt specified."}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 text-center">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Delete AI Agent?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{deletingAgent.name}</strong> ({deletingAgent.agent_id})? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeletingAgent(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAgent}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md"
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
