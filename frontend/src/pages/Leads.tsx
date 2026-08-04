import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api, BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Plus,
  X,
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
  ChevronLeft,
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
  UserPlus,
  Sliders,
  MoreVertical,
  CheckSquare,
  ChevronDown,
  Target,
  Bell,
  PieChart,
  Bot,
  Loader2
} from "lucide-react";

type Lead = {
  _id?: string;
  id: string;
  lead_id?: string;
  name: string;
  customer_name?: string;
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
  ai_score?: number;
  last_contact_at?: string;
};

type Pool = { id: string; name: string };
type Campaign = { id: string; name: string; pool_id: string };
type UserRow = { id: string; name: string; role: string; employee_id: string; pool_id?: string; supervisor_id?: string; is_active?: boolean };

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 border border-blue-200 text-[#0F4FA8]",
  in_progress: "bg-amber-50 border border-amber-200 text-amber-700",
  follow_up: "bg-orange-50 border border-orange-200 text-orange-700",
  qualified: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  not_interested: "bg-rose-50 border border-rose-200 text-rose-700",
  closed: "bg-slate-100 border border-slate-200 text-slate-600",
};

// Mini SVG Sparkline Component
function Sparkline({ color = "#0F4FA8" }: { color?: string }) {
  return (
    <svg className="w-14 h-6 overflow-visible" viewBox="0 0 70 20">
      <defs>
        <linearGradient id={`leadSparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M0,15 Q15,18 30,7 T50,11 T70,3"
        fill={`url(#leadSparkGrad-${color.replace("#", "")})`}
      />
      <path
        d="M0,15 Q15,18 30,7 T50,11 T70,3"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "team_leader";
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowScrollLeft(scrollLeft > 5);
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  const handleScrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      const scrollAmount = direction === "left" ? -260 : 260;
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

  // Data lists
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [poolFilter, setPoolFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [quickChipFilter, setQuickChipFilter] = useState<string>("all");
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Drawer & Modals
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Stepper file upload states
  const [file, setFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "assign" | "report">("upload");
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

  const [successReport, setSuccessReport] = useState<{
    import_id: string;
    total_processed: number;
    inserted: number;
    skipped_duplicates: number;
    skipped_invalid: number;
  } | null>(null);

  const [manualForm, setManualForm] = useState({
    name: "",
    phone: "",
    pool_id: "",
    campaign_id: "",
    location: "",
    language: "English",
    priority: "medium",
    source: "Manual"
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  // Drawer Disposition State
  const [drawerStatus, setDrawerStatus] = useState("");
  const [drawerNotes, setDrawerNotes] = useState("");
  const [isUpdatingDisposition, setIsUpdatingDisposition] = useState(false);

  async function handleSaveDrawerDisposition() {
    if (!drawerLead) return;
    const targetStatus = drawerStatus || drawerLead.status;
    setIsUpdatingDisposition(true);
    try {
      await api.patch(`/api/leads/${drawerLead.id || drawerLead.lead_id}/disposition`, {
        status: targetStatus,
        notes: drawerNotes
      });
      showToast("Lead status and call notes updated.", "success");
      setDrawerNotes("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update disposition.", "error");
    } finally {
      setIsUpdatingDisposition(false);
    }
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = [];
      if (poolFilter) queryParams.push(`pool_id=${poolFilter}`);
      if (statusFilter) queryParams.push(`status_filter=${statusFilter}`);
      const queryString = queryParams.length ? `?${queryParams.join("&")}` : "";

      const leadsData = await api.get(`/api/leads${queryString}`);
      const validLeads = Array.isArray(leadsData) ? leadsData : [];
      // Attach mock AI scores & dates for demo if missing
      const enhancedLeads = validLeads.map((l: Lead, idx: number) => ({
        ...l,
        ai_score: l.ai_score || Math.floor(75 + (idx * 7) % 24),
        last_contact_at: l.last_contact_at || "Today, 11:45 AM"
      }));
      setLeads(enhancedLeads);

      try {
        const poolsData = await api.get("/api/pools");
        setPools(Array.isArray(poolsData) ? poolsData : []);
      } catch {
        setPools([]);
      }

      try {
        const campaignsData = await api.get("/api/campaigns");
        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      } catch {
        setCampaigns([]);
      }

      try {
        const usersData = await api.get("/api/users");
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch {
        setUsers([]);
      }
    } catch (err: any) {
      console.error("[Leads] Failed to load data:", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [poolFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    checkScrollability();
    if (tabsRef.current) {
      const activeEl = tabsRef.current.querySelector<HTMLElement>("[data-active='true']");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [quickChipFilter, checkScrollability]);

  // File Upload Preview
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

  function handleConfirmMapping() {
    if (!mapping.name || !mapping.phone) {
      showToast("Mapping must link Name and Phone headers.", "error");
      return;
    }
    setImportStep("assign");
  }

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

  async function handleCreateManualLead(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.name || !manualForm.phone || !manualForm.pool_id) {
      showToast("Name, Phone, and Target Pool are required.", "error");
      return;
    }
    
    if (isSubmittingManual) return;
    setIsSubmittingManual(true);

    try {
      const createdLead = await api.post("/api/leads", manualForm);
      showToast("New customer lead added successfully!", "success");
      setShowManualModal(false);
      
      // Reset search/chip filters so new lead is visible immediately
      setSearchQuery("");
      setQuickChipFilter("all");
      setStatusFilter("");

      setManualForm({
        name: "",
        phone: "",
        pool_id: "",
        campaign_id: "",
        location: "",
        language: "English",
        priority: "medium",
        source: "Manual"
      });

      if (createdLead && typeof createdLead === "object") {
        setLeads(prev => [createdLead, ...prev]);
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create lead.", "error");
    } finally {
      setIsSubmittingManual(false);
    }
  }

  async function handleConfirmDelete() {
    if (!leadToDelete || isDeletingLead) return;
    const leadId = leadToDelete.id;
    setIsDeletingLead(true);

    try {
      await api.delete(`/api/leads/${leadId}`);
      showToast("Lead deleted successfully.", "success");
      setLeads(prev => prev.filter(l => l.id !== leadId && l.lead_id !== leadToDelete.lead_id));
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
      if (drawerLead?.id === leadId) setDrawerLead(null);
      setLeadToDelete(null);
    } catch (err: any) {
      showToast(err.message || "Failed to delete lead.", "error");
    } finally {
      setIsDeletingLead(false);
    }
  }

  async function handleCallCustomer(lead: Lead) {
    try {
      showToast(`Initiating manual call to ${lead.phone}...`, "info");
      await api.post("/api/calls/manual-dial", {
        phone: lead.phone,
        name: lead.name,
        pool_id: lead.pool_id,
        language: lead.language || "English",
        agent_assign_mode: "auto",
        priority: lead.priority || "medium",
        notes: lead.last_note || ""
      });
      showToast(`Call started with ${lead.name}`, "success");
      
      if (user?.role === "agent") {
        navigate("/dialer");
      } else {
        navigate("/live-calls");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to start call", "error");
    }
  }

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
      setShowBulkMenu(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk assignment failed.", "error");
    }
  }

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
      setShowBulkMenu(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk status update failed.", "error");
    }
  }

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === paginatedLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(paginatedLeads.map(l => l.id));
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
      const nameStr = (l.name || l.customer_name || "").toLowerCase();
      const phoneStr = (l.phone || "").toLowerCase();
      const leadIdStr = (l.lead_id || l.id || l._id || "").toLowerCase();
      const emailStr = (l.email || "").toLowerCase();

      const matchesSearch =
        nameStr.includes(term) ||
        phoneStr.includes(term) ||
        leadIdStr.includes(term) ||
        emailStr.includes(term);

      let matchesQuickChip = true;
      if (quickChipFilter !== "all") {
        if (quickChipFilter === "follow_up") {
          matchesQuickChip = l.status === "follow_up" || l.status === "in_progress" || l.status === "follow_up_required";
        } else {
          matchesQuickChip = l.status === quickChipFilter;
        }
      }

      const matchesStatus = statusFilter ? l.status === statusFilter : true;
      
      const poolObj = pools.find(p => p.id === l.pool_id || p.name === l.pool_id);
      const matchesPool = poolFilter
        ? (l.pool_id === poolFilter || (poolObj && (poolObj.id === poolFilter || poolObj.name === poolFilter)))
        : true;

      const matchesCampaign = campaignFilter ? l.campaign_id === campaignFilter : true;
      const matchesAgent = agentFilter ? l.assigned_agent_id === agentFilter : true;
      const matchesPriority = priorityFilter ? (l.priority || "medium").toLowerCase() === priorityFilter.toLowerCase() : true;

      return matchesSearch && matchesQuickChip && matchesStatus && matchesPool && matchesCampaign && matchesAgent && matchesPriority;
    });
  }, [leads, pools, searchQuery, quickChipFilter, statusFilter, poolFilter, campaignFilter, agentFilter, priorityFilter]);

  // Paginated Leads
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage]);

  const agentsList = users.filter(u => u.role === "agent");

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPoolFilter("");
    setCampaignFilter("");
    setAgentFilter("");
    setPriorityFilter("");
    setQuickChipFilter("all");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      
      {/* 1. HERO SECTION WITH BLUE -> GOLD GRADIENT TOP BORDER & GLASSMORPHISM */}
      <div className="p-0.5 rounded-[24px] bg-gradient-to-r from-[#0F4FA8] via-[#1E6AD7] to-[#FFC107] shadow-lg shadow-blue-900/5">
        <div className="bg-white/95 backdrop-blur-md rounded-[23px] p-6 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            {/* Title & AI Badge */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0F4FA8]/10 text-[#0F4FA8] rounded-xl border border-[#0F4FA8]/20">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lead Management</h1>
                    <span className="text-[10px] font-extrabold bg-[#FFC107]/20 text-[#D4AF37] border border-[#FFC107]/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI VOICE READY
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold">Enterprise customer lead pipeline, intelligent scoring & agent routing</p>
                </div>
              </div>

              {/* 6 KPI Chips Replacing Single Badge */}
              <div className="flex items-center gap-2 pt-2 flex-wrap text-xs font-bold">
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                  {leads.length} Total
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {leads.filter(l => l.status === "new").length} New Today
                </span>
                <span className="bg-blue-50 text-[#0F4FA8] px-3 py-1 rounded-full border border-blue-200">
                  {leads.filter(l => l.status === "qualified").length} Qualified
                </span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
                  {leads.filter(l => l.assigned_agent_id).length} Assigned
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                  38.4% Conv
                </span>
                <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-200">
                  {leads.filter(l => l.status === "follow_up" || l.status === "in_progress").length} Follow-ups
                </span>
              </div>
            </div>

            {/* Right Action Bar (Equal Height & Equal Width Style Buttons) */}
            <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-between lg:justify-end flex-wrap">
              <span className="text-[11px] font-mono font-bold text-slate-400 hidden sm:inline mr-1">
                Updated 1m ago
              </span>

              <button
                onClick={loadData}
                className="h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition flex items-center justify-center shadow-2xs active:scale-95 cursor-pointer"
                title="Refresh Data"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {isManager && (
                <>
                  <button
                    onClick={() => setShowImportSection(!showImportSection)}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <UploadCloud className="h-4 w-4 text-[#0F4FA8]" />
                    <span>Import CSV</span>
                  </button>

                  <button
                    onClick={() => setShowManualModal(true)}
                    className="h-10 px-5 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/25 active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Lead</span>
                  </button>
                </>
              )}

              <button
                onClick={() => showToast("Exporting leads database CSV...", "info")}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-2xs active:scale-95 cursor-pointer"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 2. SIX ENTERPRISE KPI CARDS GRID (Equal height/width, 20px radius, clickable filters) */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* KPI 1: Total Leads */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { setQuickChipFilter("all"); setStatusFilter(""); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-[#0F4FA8]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">{leads.length}</span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Leads</span>
            </div>
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-[#0F4FA8]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +12.4%
            </span>
            <Sparkline color="#0F4FA8" />
          </div>
        </motion.div>

        {/* KPI 2: New Today */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { setQuickChipFilter("new"); setStatusFilter("new"); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-emerald-500"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
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
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 3: Qualified */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { setQuickChipFilter("qualified"); setStatusFilter("qualified"); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-emerald-500"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
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
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 4: Assigned */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { resetFilters(); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-purple-600"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {leads.filter(l => l.assigned_agent_id).length}
              </span>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Assigned</span>
            </div>
            <div className="p-2 bg-purple-50 rounded-xl border border-purple-100 text-purple-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-purple-600 font-bold">To Agents</span>
            <Sparkline color="#9333EA" />
          </div>
        </motion.div>

        {/* KPI 5: Conversion Rate */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { setQuickChipFilter("closed"); setStatusFilter("closed"); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-amber-500"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">38.4%</span>
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
            <Sparkline color="#F59E0B" />
          </div>
        </motion.div>

        {/* KPI 6: Follow-ups */}
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => { setQuickChipFilter("follow_up"); setStatusFilter("follow_up"); }}
          className="col-span-12 sm:col-span-6 lg:col-span-2 bg-white/95 border border-slate-200/80 p-4 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-rose-500"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
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

      {/* 4. MAIN LEADS MANAGEMENT CONTENT (FULL WIDTH TOOLBAR & TABLE) */}
      <div className="space-y-4">

        {/* FILTER TOOLBAR BAR WITH FULL WIDTH SCROLLABLE STATUS CHIPS (NORMAL PAGE FLOW) */}
        <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-4 shadow-sm border border-slate-200/80 space-y-3">
          
          {/* Top Row: Search Input & Dropdowns */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative w-full lg:w-96 shrink-0">
              <Search className="h-4 w-4 text-[#0F4FA8] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="AI Search leads by name, phone, email, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-semibold text-slate-800 transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
              <select
                value={poolFilter}
                onChange={e => setPoolFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
              >
                <option value="">All Pools</option>
                {pools.map(p => (
                  <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>

              {isManager && (
                <select
                  value={agentFilter}
                  onChange={e => setAgentFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
                >
                  <option value="">All Agents</option>
                  {agentsList.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}

              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/70 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
              >
                <option value="">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              {(searchQuery || statusFilter || poolFilter || agentFilter || priorityFilter || quickChipFilter !== "all") && (
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

          {/* Bottom Row: Full-Width Scrollable Status Chips Bar */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 relative">
            {showScrollLeft && (
              <button
                onClick={() => handleScrollTabs("left")}
                className="h-8 w-8 rounded-xl bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-700 transition flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 active:scale-95 z-10"
                title="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth w-full py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {[
                { id: "all", label: "All Leads" },
                { id: "new", label: "New Leads" },
                { id: "qualified", label: "Qualified Leads" },
                { id: "in_progress", label: "In Progress" },
                { id: "follow_up", label: "Follow-up Needed" },
                { id: "not_interested", label: "Not Interested" },
                { id: "closed", label: "Closed / Won" }
              ].map(chip => (
                <button
                  key={chip.id}
                  data-active={quickChipFilter === chip.id}
                  onClick={() => {
                    setQuickChipFilter(chip.id);
                    if (chip.id === "all") setStatusFilter("");
                    else setStatusFilter(chip.id);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                    quickChipFilter === chip.id
                      ? "bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] text-white shadow-md shadow-blue-900/10"
                      : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showScrollRight && (
              <button
                onClick={() => handleScrollTabs("right")}
                className="h-8 w-8 rounded-xl bg-white hover:bg-[#0F4FA8] hover:text-white text-slate-700 transition flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 active:scale-95 z-10"
                title="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bulk Selected Toolbar (Admin & TL / Supervisor only) */}
          {isManager && selectedLeadIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-[#0F4FA8] text-white rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-md"
            >
              <span className="text-xs font-extrabold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#FFC107]" />
                <span>{selectedLeadIds.length} Lead(s) Selected</span>
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
                  className="px-3 py-1.5 bg-[#FFC107] hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-lg transition cursor-pointer"
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

        {/* ENTERPRISE LEADS TABLE CARD */}
        <div className="bg-white/95 backdrop-blur-md rounded-[20px] shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  {isManager && (
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === paginatedLeads.length && paginatedLeads.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-[#0F4FA8] rounded cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3.5">Lead ID</th>
                  <th className="px-4 py-3.5">Customer & AI Score</th>
                  <th className="px-4 py-3.5">Phone & Location</th>
                  <th className="px-4 py-3.5">Pool</th>
                  <th className="px-4 py-3.5">Assigned Agent</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="h-4 bg-slate-200 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : paginatedLeads.map((l, idx) => {
                  const isSelected = selectedLeadIds.includes(l.id) || (l.lead_id ? selectedLeadIds.includes(l.lead_id) : false);
                  const assignedAgent = l.assigned_agent_id ? users.find(u => u.id === l.assigned_agent_id || u.employee_id === l.assigned_agent_id) : undefined;
                  const poolObj = pools.find(p => p.id === l.pool_id || p.name === l.pool_id);

                  return (
                    <tr
                      key={l.id}
                      className={`transition-all duration-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      } ${isSelected ? "bg-blue-50/80 font-medium" : "hover:bg-blue-50/40"}`}
                    >
                      {/* Checkbox (Admin & TL / Supervisor only) */}
                      {isManager && (
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectLead(l.id)}
                            className="h-4 w-4 text-[#0F4FA8] rounded cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Lead ID */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
                          {l.lead_id}
                        </span>
                      </td>

                      {/* Customer & AI Score */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-xs shadow-2xs shrink-0 border border-blue-400/30">
                            {l.name[0]?.toUpperCase() || "C"}
                          </div>
                          <div className="min-w-0">
                            <div 
                              onClick={() => setDrawerLead(l)}
                              className="font-extrabold text-slate-900 hover:text-[#0F4FA8] cursor-pointer transition text-xs truncate"
                            >
                              {l.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${l.ai_score || 85}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 font-mono">{l.ai_score || 85}% AI</span>
                            </div>
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
                        <span className="bg-slate-100 text-slate-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">
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
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
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
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                          STATUS_COLORS[l.status] || "bg-slate-100 text-slate-600"
                        }`}>
                          {(l.status || "new").replace("_", " ")}
                        </span>
                      </td>

                      {/* Quick Actions Toolbar */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDrawerLead(l)}
                            className="p-1.5 text-slate-500 hover:text-[#0F4FA8] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="View Profile Drawer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleCallCustomer(l)}
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

                          {isManager && (
                            <button
                              onClick={() => setLeadToDelete(l)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">
              Showing {paginatedLeads.length} of {filteredLeads.length} leads
            </span>

            <div className="flex items-center gap-2 font-bold">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border rounded-xl bg-white disabled:opacity-40 cursor-pointer hover:bg-slate-100"
              >
                Previous
              </button>

              <span className="px-2 font-mono">{currentPage} / {totalPages}</span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border rounded-xl bg-white disabled:opacity-40 cursor-pointer hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 5. RIGHT SLIDE-OVER PROFILE DRAWER */}
      <AnimatePresence>
        {drawerLead && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerLead(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 250 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 overflow-hidden"
              >
                <div className="p-6 bg-slate-50 border-b border-slate-200 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-lg shadow-md">
                        {drawerLead.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900">{drawerLead.name}</h2>
                        <span className="text-xs font-mono font-bold text-slate-400">{drawerLead.lead_id}</span>
                      </div>
                    </div>
                    <button onClick={() => setDrawerLead(null)} className="p-1.5 text-slate-400 hover:text-slate-700">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <button
                      onClick={() => handleCallCustomer(drawerLead)}
                      className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call</span>
                    </button>
                    <button
                      onClick={() => showToast(`Opening WhatsApp chat with ${drawerLead.phone}...`, "info")}
                      className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => showToast(`Sending email to ${drawerLead.email || drawerLead.name}...`, "info")}
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 text-[#0F4FA8] border border-blue-200 rounded-xl font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs font-semibold">
                  <div className="p-3 bg-slate-50 border rounded-xl space-y-1">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Contact Details</div>
                    <div className="text-slate-800">Phone: {drawerLead.phone}</div>
                    <div className="text-slate-800">Email: {drawerLead.email || "N/A"}</div>
                    <div className="text-slate-800">Location: {drawerLead.location || "N/A"}</div>
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-xl space-y-1">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">AI Telemetry & Intent</div>
                    <div className="text-slate-800">AI Lead Score: <strong>{drawerLead.ai_score || 88}%</strong></div>
                    <div className="text-slate-800">Last Contact: <strong>{drawerLead.last_contact_at || "Today"}</strong></div>
                  </div>

                  {/* Lead Action & Disposition Update Section */}
                  <div className="p-3.5 bg-[#F0F4FA] border border-blue-100 rounded-xl space-y-2.5">
                    <div className="text-[10px] text-[#0F4FA8] uppercase font-bold tracking-wider">
                      Update Lead Status & Notes
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Status Disposition</label>
                        <select
                          value={drawerStatus || drawerLead.status}
                          onChange={e => setDrawerStatus(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                        >
                          <option value="new">New Lead</option>
                          <option value="in_progress">In Progress</option>
                          <option value="follow_up">Follow-up Needed</option>
                          <option value="qualified">Qualified</option>
                          <option value="not_interested">Not Interested</option>
                          <option value="closed">Closed / Won</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Call Notes / Follow-up Details</label>
                        <textarea
                          rows={3}
                          placeholder="Type notes or customer follow-up response here..."
                          value={drawerNotes}
                          onChange={e => setDrawerNotes(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                        />
                      </div>

                      <button
                        onClick={handleSaveDrawerDisposition}
                        disabled={isUpdatingDisposition}
                        className="w-full py-2 bg-[#0F4FA8] hover:bg-blue-800 text-white rounded-lg font-extrabold text-xs transition cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isUpdatingDisposition ? "Saving..." : "Save Disposition Update"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL LEAD ENTRY MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#0F4FA8]" />
                <span>Add Customer Lead</span>
              </h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateManualLead} className="space-y-3 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Customer Name</label>
                  <input
                    required
                    placeholder="Full name"
                    value={manualForm.name}
                    onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Phone Number</label>
                  <input
                    required
                    placeholder="+919876543210"
                    value={manualForm.phone}
                    onChange={e => setManualForm({ ...manualForm, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                </div>
              </div>



              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Target Pool</label>
                <select
                  required
                  value={manualForm.pool_id}
                  onChange={e => setManualForm({ ...manualForm, pool_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold"
                >
                  <option value="">Select Pool</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingManual}
                className={`w-full text-white font-extrabold py-3 rounded-xl transition mt-2 cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  isSubmittingManual ? "bg-slate-400 cursor-not-allowed" : "bg-[#0F4FA8] hover:bg-blue-900"
                }`}
              >
                {isSubmittingManual && <Loader2 className="h-5 w-5 animate-spin" />}
                {isSubmittingManual ? "Saving Lead..." : "Add Customer Lead"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 text-center">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Delete Lead?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{leadToDelete.name}</strong> ({leadToDelete.lead_id})?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLeadToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeletingLead}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingLead ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
