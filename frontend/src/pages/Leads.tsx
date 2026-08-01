import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Plus,
  X,
  FolderOpen,
  AlertTriangle,
  ArrowRight,
  Zap,
  BarChart3,
  UploadCloud,
  Check,
  Search,
  Filter,
  Download,
  Users,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Trash2,
  Eye,
  UserCheck,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Globe,
  Activity,
  Award,
  Layers,
  PhoneCall,
  UserPlus
} from "lucide-react";

type Lead = {
  id: string;
  lead_id: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  language?: string;
  source?: string;
  priority?: string;
  status: string;
  pool_id: string;
  campaign_id?: string;
  assigned_agent_id?: string;
  last_note?: string;
  follow_up_at?: string;
  created_at?: string;
};

type Pool = { id: string; name: string };
type Campaign = { id: string; name: string; pool_id: string };
type UserRow = { id: string; name: string; role: string; employee_id: string; pool_id?: string; supervisor_id?: string; is_active?: boolean };

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 border border-blue-200 text-[#1E5EFF]",
  in_progress: "bg-amber-50 border border-amber-200 text-amber-700",
  follow_up: "bg-orange-50 border border-orange-200 text-orange-700",
  qualified: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  not_interested: "bg-rose-50 border border-rose-200 text-rose-700",
  closed: "bg-slate-100 border border-slate-200 text-slate-600",
};

// Mini SVG Sparkline Component
function Sparkline({ color = "#1E5EFF" }: { color?: string }) {
  return (
    <svg className="w-14 h-5 overflow-visible" viewBox="0 0 70 20">
      <path
        d="M0,15 Q15,18 30,7 T50,11 T70,3"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Lists
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  
  // Filtering and Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [poolFilter, setPoolFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Right Drawer State
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState<"timeline" | "notes" | "calls" | "messages">("timeline");
  const [newNoteText, setNewNoteText] = useState("");

  // Stepper flow states for file upload
  const [file, setFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "assign" | "report">("upload");
  const [showImportSection, setShowImportSection] = useState(false);
  
  // Preview states from backend
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [totalRecords, setTotalRecords] = useState(0);

  // Targets assignments
  const [targetPoolId, setTargetPoolId] = useState("");
  const [targetCampaignId, setTargetCampaignId] = useState("");
  const [targetSupervisorId, setTargetSupervisorId] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("");

  // Final success report
  const [successReport, setSuccessReport] = useState<{
    import_id: string;
    total_processed: number;
    inserted: number;
    skipped_duplicates: number;
    skipped_invalid: number;
  } | null>(null);

  // Single Manual Lead entry form
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    phone: "",
    email: "",
    pool_id: "",
    campaign_id: "",
    location: "",
    language: "English",
    priority: "medium",
    source: "Manual"
  });

  // Bulk actions and selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  const loadData = useCallback(async () => {
    try {
      const queryParams = [];
      if (poolFilter) queryParams.push(`pool_id=${poolFilter}`);
      if (statusFilter) queryParams.push(`status_filter=${statusFilter}`);
      const queryString = queryParams.length ? `?${queryParams.join("&")}` : "";

      const leadsData = await api.get(`/api/leads${queryString}`);
      setLeads(leadsData);

      const poolsData = await api.get("/api/pools");
      setPools(poolsData);

      const campaignsData = await api.get("/api/campaigns");
      setCampaigns(campaignsData);

      const usersData = await api.get("/api/users");
      setUsers(usersData);
    } catch (err: any) {
      showToast(err.message || "Failed to load CRM leads.", "error");
    }
  }, [showToast, poolFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload to parse preview
  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      showToast("Select a CSV or Excel file first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.upload("/api/leads/upload-preview", formData);
      setHeaders(res.headers);
      setPreviewRows(res.rows);
      setAllRows(res.all_rows);
      setMapping(res.suggested_mapping);
      setTotalRecords(res.total_records);
      setImportStep("mapping");
      showToast("File parsed. Please review column mappings.", "success");
    } catch (err: any) {
      showToast(err.message || "File parse error.", "error");
    }
  }

  // Confirm mapping and navigate to assignment targets
  function handleConfirmMapping() {
    if (!mapping.name || !mapping.phone) {
      showToast("Mapping must link Name and Phone headers.", "error");
      return;
    }
    setImportStep("assign");
  }

  // Execute actual import process
  async function handleImportExecute() {
    if (!targetPoolId) {
      showToast("Please choose a target pool mapping.", "error");
      return;
    }

    try {
      const payload = {
        pool_id: targetPoolId,
        campaign_id: targetCampaignId || undefined,
        supervisor_id: targetSupervisorId || undefined,
        agent_id: targetAgentId || undefined,
        mapping,
        rows: allRows
      };

      const res = await api.post("/api/leads/import-process", payload);
      setSuccessReport(res);
      setImportStep("report");
      showToast("Leads imported successfully.", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk import failed.", "error");
    }
  }

  // Submit manual lead creation
  async function handleCreateManualLead(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.name || !manualForm.phone || !manualForm.pool_id) {
      showToast("Name, Phone, and Pool are required.", "error");
      return;
    }

    try {
      await api.post("/api/leads/manual", manualForm);
      showToast("New customer lead added successfully!", "success");
      setShowManualModal(false);
      setManualForm({
        name: "",
        phone: "",
        email: "",
        pool_id: "",
        campaign_id: "",
        location: "",
        language: "English",
        priority: "medium",
        source: "Manual"
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create manual lead.", "error");
    }
  }

  // Delete lead
  async function handleDeleteLead(leadId: string) {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await api.delete(`/api/leads/${leadId}`);
      showToast("Lead deleted successfully.", "success");
      if (drawerLead?.id === leadId) setDrawerLead(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete lead.", "error");
    }
  }

  // Bulk Assign Selected Leads
  async function handleBulkAssignAgent() {
    if (selectedLeadIds.length === 0 || !assignAgentId) return;
    try {
      await api.patch("/api/leads/bulk-assign", {
        lead_ids: selectedLeadIds,
        agent_id: assignAgentId
      });
      showToast(`Assigned ${selectedLeadIds.length} lead(s) to agent.`, "success");
      setSelectedLeadIds([]);
      setAssignAgentId("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk assignment failed.", "error");
    }
  }

  // Bulk Status Update
  async function handleBulkStatusUpdate() {
    if (selectedLeadIds.length === 0 || !bulkStatus) return;
    try {
      await api.patch("/api/leads/bulk-status", {
        lead_ids: selectedLeadIds,
        status: bulkStatus
      });
      showToast(`Updated status for ${selectedLeadIds.length} lead(s).`, "success");
      setSelectedLeadIds([]);
      setBulkStatus("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk status update failed.", "error");
    }
  }

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        l.name.toLowerCase().includes(term) ||
        l.phone.toLowerCase().includes(term) ||
        l.lead_id.toLowerCase().includes(term) ||
        (l.email && l.email.toLowerCase().includes(term));
      const matchesStatus = statusFilter ? l.status === statusFilter : true;
      const matchesPool = poolFilter ? l.pool_id === poolFilter : true;
      const matchesAgent = agentFilter ? l.assigned_agent_id === agentFilter : true;
      const matchesPriority = priorityFilter ? (l.priority || "medium") === priorityFilter : true;
      return matchesSearch && matchesStatus && matchesPool && matchesAgent && matchesPriority;
    });
  }, [leads, searchQuery, statusFilter, poolFilter, agentFilter, priorityFilter]);

  const agentsList = users.filter(u => u.role === "agent");

  // Reset Filters
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPoolFilter("");
    setAgentFilter("");
    setSourceFilter("");
    setPriorityFilter("");
    setDateFilter("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      
      {/* 1. BREADCRUMB & ENTERPRISE HEADER ROW */}
      <div className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-[18px] shadow-xs border border-slate-200/80 space-y-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          <span>CRM</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span>Leads</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-[#1E5EFF] font-black">Lead Management</span>
        </div>

        {/* Single Row: Title + Badge + Subtitle + Action Buttons */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 pt-0.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#1E5EFF] flex items-center justify-center font-bold shadow-2xs shrink-0 border border-blue-100/80">
              <Users className="h-5 w-5 text-[#1E5EFF]" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">Lead Management</h1>
              <span className="text-[11px] font-extrabold bg-blue-50 text-[#1E5EFF] border border-blue-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                {leads.length} TOTAL LEADS
              </span>
              <span className="hidden xl:inline text-xs text-slate-400 font-medium truncate max-w-xs">
                · Manage, assign, qualify and monitor customer leads
              </span>
            </div>
          </div>

          {/* Right Action Bar (Single Row) */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto shrink-0 justify-end">
            <span className="text-[11px] font-mono font-bold text-slate-400 hidden sm:inline mr-1">
              Updated 1m ago
            </span>

            <button
              onClick={loadData}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
              title="Refresh Data"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowImportSection(!showImportSection)}
              className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            >
              <UploadCloud className="h-4 w-4 text-[#1E5EFF]" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={() => showToast("Exporting leads database CSV...", "info")}
              className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="h-9 px-4 bg-[#1E5EFF] hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SIX ENTERPRISE KPI CARDS GRID */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* KPI 1: Total Leads */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#1E5EFF]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">{leads.length}</span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Leads</span>
            </div>
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-[#1E5EFF]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +12.4%
            </span>
            <Sparkline color="#1E5EFF" />
          </div>
        </motion.div>

        {/* KPI 2: New Leads Today */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#16C47F]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {leads.filter(l => l.status === "new").length}
              </span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">New Today</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
              <UserPlus className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +5 today
            </span>
            <Sparkline color="#16C47F" />
          </div>
        </motion.div>

        {/* KPI 3: Qualified Leads */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#16C47F]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {leads.filter(l => l.status === "qualified").length}
              </span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Qualified</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-emerald-600 font-bold">High Intent</span>
            <Sparkline color="#16C47F" />
          </div>
        </motion.div>

        {/* KPI 4: Assigned Leads */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#1E5EFF]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {leads.filter(l => l.assigned_agent_id).length}
              </span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Assigned</span>
            </div>
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-[#1E5EFF]">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-[#1E5EFF] font-bold">To Agents</span>
            <Sparkline color="#1E5EFF" />
          </div>
        </motion.div>

        {/* KPI 5: Conversion Rate */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#F5A623]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">38.4%</span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Conversion</span>
            </div>
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +4.2%
            </span>
            <Sparkline color="#F5A623" />
          </div>
        </motion.div>

        {/* KPI 6: Pending Follow-ups */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white border border-slate-200/80 p-4 rounded-[18px] shadow-xs relative overflow-hidden group hover:shadow-md transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#EF4444]" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {leads.filter(l => l.status === "in_progress" || l.status === "follow_up").length}
              </span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Follow-ups</span>
            </div>
            <div className="p-2 bg-rose-50 rounded-xl border border-rose-100 text-rose-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-rose-600 font-bold">Action Needed</span>
            <Sparkline color="#EF4444" />
          </div>
        </motion.div>

      </div>

      {/* 3. STICKY FILTER TOOLBAR BAR */}
      <div className="bg-white rounded-[20px] p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          
          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search leads by name, phone, email, ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] font-semibold text-slate-700 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="new">New Lead</option>
              <option value="in_progress">In Progress</option>
              <option value="follow_up">Follow Up</option>
              <option value="qualified">Qualified</option>
              <option value="not_interested">Not Interested</option>
              <option value="closed">Closed</option>
            </select>

            {/* Pool Filter */}
            <select
              value={poolFilter}
              onChange={e => setPoolFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] cursor-pointer"
            >
              <option value="">All Pools</option>
              {pools.map(p => (
                <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
              ))}
            </select>

            {/* Agent Filter */}
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] cursor-pointer"
            >
              <option value="">All Agents</option>
              {agentsList.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] cursor-pointer"
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            {/* Reset Button */}
            {(searchQuery || statusFilter || poolFilter || agentFilter || priorityFilter) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* BULK ACTIONS BAR (When rows selected) */}
        {selectedLeadIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-[#1E5EFF] text-white rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-md"
          >
            <span className="text-xs font-black">
              {selectedLeadIds.length} Lead(s) Selected
            </span>

            <div className="flex items-center gap-3">
              <select
                value={assignAgentId}
                onChange={e => setAssignAgentId(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 focus:outline-none"
              >
                <option value="">-- Assign Agent --</option>
                {agentsList.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <button
                onClick={handleBulkAssignAgent}
                className="px-3 py-1.5 bg-[#F5A623] hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-lg transition"
              >
                Bulk Assign
              </button>

              <button
                onClick={() => setSelectedLeadIds([])}
                className="text-xs font-extrabold hover:underline"
              >
                Deselect All
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* 4. ENTERPRISE LEADS TABLE */}
      <div className="bg-white rounded-[20px] shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-[#1E5EFF] rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Lead ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Phone & Location</th>
                <th className="px-4 py-3.5">Pool</th>
                <th className="px-4 py-3.5">Assigned Agent</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(l => {
                const isSelected = selectedLeadIds.includes(l.id);
                const assignedAgent = users.find(u => u.id === l.assigned_agent_id);
                const poolObj = pools.find(p => p.id === l.pool_id);

                return (
                  <tr
                    key={l.id}
                    className={`transition-all duration-200 ${
                      isSelected ? "bg-blue-50/80 font-medium" : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectLead(l.id)}
                        className="h-4 w-4 text-[#1E5EFF] rounded cursor-pointer"
                      />
                    </td>

                    {/* Lead ID */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
                        {l.lead_id}
                      </span>
                    </td>

                    {/* Customer Avatar & Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#1E5EFF] to-blue-500 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                          {l.name[0]?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <div 
                            onClick={() => setDrawerLead(l)}
                            className="font-extrabold text-slate-900 hover:text-[#1E5EFF] cursor-pointer transition"
                          >
                            {l.name}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">{l.email || "No Email"}</div>
                        </div>
                      </div>
                    </td>

                    {/* Phone & Location */}
                    <td className="px-4 py-3.5">
                      <div className="font-extrabold text-slate-800 text-xs">{l.phone}</div>
                      <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-300" />
                        <span>{l.location || "N/A"}</span>
                      </div>
                    </td>

                    {/* Pool */}
                    <td className="px-4 py-3.5">
                      <span className="bg-slate-100 text-slate-700 font-extrabold text-[11px] px-2.5 py-1 rounded-lg uppercase tracking-wider border border-slate-200">
                        {poolObj?.name.replace(/_/g, " ") || "No Pool"}
                      </span>
                    </td>

                    {/* Assigned Agent */}
                    <td className="px-4 py-3.5">
                      {assignedAgent ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-slate-800 text-xs">{assignedAgent.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold italic">Unassigned</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        l.priority === "high"
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : l.priority === "low"
                          ? "bg-slate-100 border-slate-200 text-slate-600"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        {l.priority || "Medium"}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="px-4 py-3.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                        STATUS_COLORS[l.status] || "bg-slate-100 text-slate-600"
                      }`}>
                        {l.status.replace("_", " ")}
                      </span>
                    </td>

                    {/* Compact Quick Actions Toolbar (No Text Buttons) */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDrawerLead(l)}
                          className="p-1.5 text-slate-500 hover:text-[#1E5EFF] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Profile Drawer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => showToast(`Initiating manual SIP call to ${l.phone}...`, "info")}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Call Customer"
                        >
                          <Phone className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => showToast(`Opening WhatsApp chat with ${l.phone}...`, "info")}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Send WhatsApp Message"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => showToast(`Sending email to ${l.email || l.name}...`, "info")}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Send Email"
                        >
                          <Mail className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteLead(l.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Lead"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No leads found matching your active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. RIGHT-SIDE SLIDE-OVER DRAWER (CUSTOMER PROFILE & TIMELINE) */}
      <AnimatePresence>
        {drawerLead && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerLead(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            {/* Slide-over Container */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 250 }}
                className="w-screen max-w-md md:max-w-lg bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200/80 overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 bg-slate-50/90 border-b border-slate-200/80 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#1E5EFF] to-blue-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                        {drawerLead.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900">{drawerLead.name}</h2>
                        <span className="text-xs font-mono font-bold text-slate-400">{drawerLead.lead_id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDrawerLead(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Quick Action Contact Row */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      onClick={() => showToast(`Dialing ${drawerLead.phone}...`, "info")}
                      className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call</span>
                    </button>

                    <button
                      onClick={() => showToast(`WhatsApp to ${drawerLead.phone}...`, "info")}
                      className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => showToast(`Email to ${drawerLead.email}...`, "info")}
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 text-[#1E5EFF] border border-blue-200 rounded-xl text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </button>

                    <button
                      onClick={() => showToast("Scheduling follow-up event...", "info")}
                      className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule</span>
                    </button>
                  </div>

                  {/* Lead Score Gauge & Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                    <div>
                      <span className="block text-[10px] font-extrabold text-slate-400 uppercase">LEAD SCORE</span>
                      <span className="text-base font-black text-emerald-600">84 / 100 (High Probability)</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                      STATUS_COLORS[drawerLead.status] || "bg-slate-100"
                    }`}>
                      {drawerLead.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 text-xs font-extrabold">
                  <button
                    onClick={() => setDrawerTab("timeline")}
                    className={`flex-1 py-2 rounded-lg transition ${
                      drawerTab === "timeline" ? "bg-white text-[#1E5EFF] shadow-2xs" : "text-slate-500"
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setDrawerTab("notes")}
                    className={`flex-1 py-2 rounded-lg transition ${
                      drawerTab === "notes" ? "bg-white text-[#1E5EFF] shadow-2xs" : "text-slate-500"
                    }`}
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => setDrawerTab("calls")}
                    className={`flex-1 py-2 rounded-lg transition ${
                      drawerTab === "calls" ? "bg-white text-[#1E5EFF] shadow-2xs" : "text-slate-500"
                    }`}
                  >
                    Call Logs
                  </button>
                </div>

                {/* Drawer Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                  {drawerTab === "timeline" && (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                        <div className="font-extrabold text-[#1E5EFF] flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4" />
                          <span>AI Call Summary & Insights</span>
                        </div>
                        <p className="text-slate-600 font-medium">
                          Customer expressed strong interest in credit card rewards program. Requested callback during afternoon shift.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="border-l-2 border-[#1E5EFF] pl-3 py-1 space-y-0.5">
                          <span className="font-bold text-slate-800 block">Outbound Dial Attempted</span>
                          <span className="text-[10px] text-slate-400 font-mono">Today at 10:42 AM · Agent Ramesh</span>
                        </div>

                        <div className="border-l-2 border-slate-200 pl-3 py-1 space-y-0.5">
                          <span className="font-bold text-slate-800 block">Lead Imported from CSV</span>
                          <span className="text-[10px] text-slate-400 font-mono">Yesterday at 04:15 PM</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {drawerTab === "notes" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <textarea
                          placeholder="Add agent notes..."
                          value={newNoteText}
                          onChange={e => setNewNoteText(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5EFF]"
                          rows={3}
                        />
                        <button
                          onClick={() => {
                            if (newNoteText.trim()) {
                              showToast("Note saved to lead profile", "success");
                              setNewNoteText("");
                            }
                          }}
                          className="px-4 py-2 bg-[#1E5EFF] text-white font-extrabold rounded-xl"
                        >
                          Save Note
                        </button>
                      </div>

                      <div className="p-3 bg-slate-50 border rounded-xl font-medium text-slate-700">
                        {drawerLead.last_note || "No agent notes recorded yet."}
                      </div>
                    </div>
                  )}

                  {drawerTab === "calls" && (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">Call #84920 (Duration: 2m 14s)</div>
                          <div className="text-[10px] text-slate-400">Answered · Qualified Lead</div>
                        </div>
                        <button 
                          onClick={() => showToast("Playing audio recording...", "info")}
                          className="p-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold"
                        >
                          Play Recording
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-500">Assigned: {users.find(u => u.id === drawerLead.assigned_agent_id)?.name || "Unassigned"}</span>
                  <button
                    onClick={() => setDrawerLead(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL LEAD MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#1E5EFF]" />
                <span>Add Customer Lead</span>
              </h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateManualLead} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Customer Name</label>
                <input
                  required
                  placeholder="e.g. John Doe"
                  value={manualForm.name}
                  onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Phone Number</label>
                <input
                  required
                  placeholder="+91 98765 43210"
                  value={manualForm.phone}
                  onChange={e => setManualForm({ ...manualForm, phone: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={manualForm.email}
                  onChange={e => setManualForm({ ...manualForm, email: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Pool Mapping</label>
                  <select
                    required
                    value={manualForm.pool_id}
                    onChange={e => setManualForm({ ...manualForm, pool_id: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="">Choose Pool</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Priority</label>
                  <select
                    value={manualForm.priority}
                    onChange={e => setManualForm({ ...manualForm, priority: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#1E5EFF] text-white font-extrabold text-xs py-3 rounded-xl hover:bg-blue-700 transition"
              >
                Create Lead Record
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
