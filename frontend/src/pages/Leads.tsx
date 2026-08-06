import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api, BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PhoneInput } from "../components/PhoneInput";
import LeadDetailsDrawer from "../components/LeadDetailsDrawer";
import { CustomSelect } from "../components/CustomSelect";
import { STATES_AND_UTS, getDistrictsOptions } from "../utils/indiaData";
import { AlertCircle, FileText } from "lucide-react";
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
  extra?: any;
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

// Indeterminate Checkbox Component for Table Header
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  className = ""
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
    />
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const statusCounts = useMemo(() => {
    return {
      all: leads.length,
      new: leads.filter(l => l.status === "new" || l.status === "New Lead").length,
      qualified: leads.filter(l => l.status === "qualified" || l.status === "Qualified").length,
      in_progress: leads.filter(l => l.status === "in_progress" || l.status === "In Progress").length,
      follow_up: leads.filter(l => l.status === "follow_up" || l.status === "Follow-up Needed").length,
      not_interested: leads.filter(l => l.status === "not_interested" || l.status === "Not Interested").length,
      closed: leads.filter(l => l.status === "closed" || l.status === "Closed / Won").length
    };
  }, [leads]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    email: "",
    pool_id: "",
    campaign_id: "",
    source: "Manual",
    purpose: "",
    country: "India",
    state: "",
    district: "",
    address: "",
    pincode: "",
    company_name: "",
    priority: "medium",
    notes: ""
  });
  const [manualFormTouched, setManualFormTouched] = useState<Record<string, boolean>>({});
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const manualFormErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!manualForm.name.trim()) {
      errs.name = "Customer name is required";
    }

    if (!manualForm.phone.trim()) {
      errs.phone = "Phone number is required";
    } else {
      const digits = manualForm.phone.replace(/\D/g, "");
      const mob = digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits;
      if (mob.length !== 10) {
        errs.phone = "Phone number must be exactly 10 digits";
      } else if (!/^[6-9]\d{9}$/.test(mob)) {
        errs.phone = "Invalid Indian mobile number (must start with 6, 7, 8, or 9)";
      }
    }

    if (!manualForm.email.trim()) {
      errs.email = "Email ID is required";
    } else if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(manualForm.email)) {
      errs.email = "Invalid email ID format";
    }

    if (!manualForm.purpose.trim()) {
      errs.purpose = "Purpose is required";
    }

    if (!manualForm.pool_id.trim()) {
      errs.pool_id = "Target pool is required";
    }

    if (!manualForm.state.trim()) {
      errs.state = "State is required";
    }

    if (!manualForm.district.trim()) {
      errs.district = "District is required";
    }

    if (!manualForm.address.trim()) {
      errs.address = "Address is required";
    }

    if (!manualForm.pincode.trim()) {
      errs.pincode = "Pincode is required";
    } else if (!/^\d{6}$/.test(manualForm.pincode)) {
      errs.pincode = "Pincode must be exactly 6 digits";
    }

    if (!manualForm.source.trim()) {
      errs.source = "Lead source is required";
    }

    if (!manualForm.priority.trim()) {
      errs.priority = "Priority is required";
    }

    return errs;
  }, [manualForm]);

  const isManualFormValid = useMemo(() => {
    return Object.keys(manualFormErrors).length === 0;
  }, [manualFormErrors]);

  const getFieldError = (field: string) => {
    return manualFormTouched[field] ? manualFormErrors[field] : "";
  };

  const handleFieldChange = (field: string, value: any) => {
    setManualForm(prev => ({ ...prev, [field]: value }));
    setManualFormTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleStateChange = (selectedState: string) => {
    setManualForm(prev => ({
      ...prev,
      state: selectedState,
      district: ""
    }));
    setManualFormTouched(prev => ({
      ...prev,
      state: true,
      district: false
    }));
  };

  const addressRef = useRef<HTMLTextAreaElement>(null);
  
  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleFieldChange("address", e.target.value);
    if (addressRef.current) {
      addressRef.current.style.height = "auto";
      addressRef.current.style.height = `${addressRef.current.scrollHeight}px`;
    }
  };

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
    if (!isManualFormValid) {
      const allTouched: Record<string, boolean> = {};
      Object.keys(manualFormErrors).forEach(key => {
        allTouched[key] = true;
      });
      setManualFormTouched(allTouched);
      showToast("Please fill all required fields correctly.", "error");
      return;
    }
    
    if (isSubmittingManual) return;
    setIsSubmittingManual(true);
    showToast("Creating customer lead...", "info");

    try {
      const payload = {
        name: manualForm.name,
        phone: manualForm.phone,
        email: manualForm.email || undefined,
        pool_id: manualForm.pool_id,
        campaign_id: manualForm.campaign_id || undefined,
        source: manualForm.source,
        extra: {
          purpose: manualForm.purpose,
          country: manualForm.country,
          state: manualForm.state,
          district: manualForm.district,
          address: manualForm.address,
          pincode: manualForm.pincode,
          company_name: manualForm.company_name || undefined,
          priority: manualForm.priority,
          notes: manualForm.notes || undefined
        }
      };

      const createdLead = await api.post("/api/leads", payload);
      showToast("New customer lead added successfully!", "success");
      setShowManualModal(false);
      
      // Reset search/chip filters so new lead is visible immediately
      setSearchQuery("");
      setQuickChipFilter("all");
      setStatusFilter("");

      setManualForm({
        name: "",
        phone: "",
        email: "",
        pool_id: "",
        campaign_id: "",
        source: "Manual",
        purpose: "",
        country: "India",
        state: "",
        district: "",
        address: "",
        pincode: "",
        company_name: "",
        priority: "medium",
        notes: ""
      });
      setManualFormTouched({});

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
    const selectedAgentObj = users.find(u => u.id === assignAgentId || u.employee_id === assignAgentId);
    const agentName = selectedAgentObj?.name || "Agent";
    const leadCount = selectedLeadIds.length;

    try {
      await api.patch("/api/leads/bulk-assign", {
        lead_ids: selectedLeadIds,
        agent_id: assignAgentId
      });
      showToast(`${leadCount} lead${leadCount === 1 ? "" : "s"} assigned successfully to ${agentName}.`, "success");
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

  const allPaginatedSelected = useMemo(() => {
    return paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.includes(l.id));
  }, [paginatedLeads, selectedLeadIds]);

  const isIndeterminate = useMemo(() => {
    const paginatedIds = paginatedLeads.map(l => l.id);
    const selectedCountOnPage = paginatedIds.filter(id => selectedLeadIds.includes(id)).length;
    return selectedCountOnPage > 0 && selectedCountOnPage < paginatedLeads.length;
  }, [paginatedLeads, selectedLeadIds]);

  const toggleSelectAll = () => {
    const paginatedIds = paginatedLeads.map(l => l.id);
    if (allPaginatedSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedLeadIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const agentsList = users.filter(u => u.role === "agent");

  const poolFilterOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace(/_/g, " ").toUpperCase()
    }));
    return [{ value: "", label: "All Pools" }, ...list];
  }, [pools]);

  const agentFilterOptions = useMemo(() => {
    const list = agentsList.map(a => ({
      value: a.id,
      label: a.name
    }));
    return [{ value: "", label: "All Agents" }, ...list];
  }, [agentsList]);

  const priorityFilterOptions = [
    { value: "", label: "All Priorities" },
    { value: "high", label: "High Priority" },
    { value: "medium", label: "Medium Priority" },
    { value: "low", label: "Low Priority" }
  ];

  const assignAgentOptions = useMemo(() => {
    const list = agentsList.map(a => ({
      value: a.id,
      label: `${a.name} (${a.employee_id || "Agent"})`
    }));
    return [{ value: "", label: "-- Choose Target Agent --" }, ...list];
  }, [agentsList]);

  const manualPoolOptions = useMemo(() => {
    return pools.map(p => ({
      value: p.id,
      label: p.name.replace(/_/g, " ").toUpperCase()
    }));
  }, [pools]);

  const purposeOptions = [
    { value: "Product Inquiry", label: "Product Inquiry" },
    { value: "Recruitment", label: "Recruitment" },
    { value: "Credit Card Sales", label: "Credit Card Sales" },
    { value: "Customer Support", label: "Customer Support" },
    { value: "Technical Support", label: "Technical Support" },
    { value: "Complaint", label: "Complaint" },
    { value: "Follow-up", label: "Follow-up" },
    { value: "Demo Request", label: "Demo Request" },
    { value: "Business Partnership", label: "Business Partnership" },
    { value: "Other", label: "Other" }
  ];

  const sourceOptions = [
    { value: "Website", label: "Website" },
    { value: "Manual", label: "Manual" },
    { value: "Referral", label: "Referral" },
    { value: "Campaign", label: "Campaign" },
    { value: "WhatsApp", label: "WhatsApp" },
    { value: "Facebook", label: "Facebook" },
    { value: "Instagram", label: "Instagram" },
    { value: "LinkedIn", label: "LinkedIn" },
    { value: "Other", label: "Other" }
  ];

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" }
  ];

  const stateOptions = STATES_AND_UTS;

  const districtOptions = useMemo(() => {
    return getDistrictsOptions(manualForm.state);
  }, [manualForm.state]);

  const drawerLeadWithLocation = useMemo(() => {
    if (!drawerLead) return null;
    if (drawerLead.location) return drawerLead;
    const extra = drawerLead.extra || {};
    if (extra.state) {
      return {
        ...drawerLead,
        location: extra.district ? `${extra.district}, ${extra.state}` : extra.state
      };
    }
    return drawerLead;
  }, [drawerLead]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPoolFilter("");
    setCampaignFilter("");
    setAgentFilter("");
    setPriorityFilter("");
    setQuickChipFilter("all");
  };

  const renderTextInput = (
    field: string,
    label: string,
    type = "text",
    placeholder = " ",
    required = false,
    maxLength?: number
  ) => {
    const error = getFieldError(field);
    const value = (manualForm as any)[field];
    return (
      <div className="relative group w-full text-left">
        <input
          type={type}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={e => handleFieldChange(field, e.target.value)}
          onBlur={() => setManualFormTouched(prev => ({ ...prev, [field]: true }))}
          className={`peer w-full h-[48px] pt-4.5 pb-1 px-3 border rounded-xl bg-slate-50/40 text-xs font-bold text-slate-800 transition duration-200 group-hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 ${
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/5"
              : value && !manualFormErrors[field]
              ? "border-emerald-300 focus:border-[#0F4FA8]"
              : "border-slate-200/80 focus:border-[#0F4FA8]"
          }`}
        />
        <label className={`absolute left-3 transition-all duration-200 pointer-events-none select-none origin-left text-[10px] font-extrabold uppercase ${
          value ? "top-1.5 text-slate-400" : "top-3.5 text-xs text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px]"
        } peer-focus:text-[#0F4FA8] peer-focus:font-black`}>
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {error && (
          <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1 pl-1">
            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  };

  const renderSelectInput = (
    field: string,
    label: string,
    options: { value: string; label: string }[],
    placeholder: string,
    disabled = false
  ) => {
    const error = getFieldError(field);
    const value = (manualForm as any)[field];
    return (
      <div className="space-y-1 w-full text-left">
        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide pl-1">
          {label} <span className="text-rose-500">*</span>
        </label>
        <CustomSelect
          disabled={disabled}
          value={value}
          onChange={val => {
            if (field === "state") {
              handleStateChange(val);
            } else {
              handleFieldChange(field, val);
            }
          }}
          options={options}
          placeholder={placeholder}
          searchable={true}
          triggerClassName={`h-[48px] rounded-xl text-xs font-bold text-slate-800 ${
            error
              ? "border-rose-300 ring-2 ring-rose-500/5"
              : value
              ? "border-emerald-300"
              : "border-slate-200"
          }`}
        />
        {error && (
          <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1.5 pl-1">
            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  };

  const renderTextareaInput = (
    field: string,
    label: string,
    placeholder = "Enter text...",
    required = false,
    rows = 1,
    customRef?: React.RefObject<HTMLTextAreaElement>,
    customChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  ) => {
    const error = getFieldError(field);
    const value = (manualForm as any)[field];
    return (
      <div className="space-y-1 w-full text-left">
        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide pl-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <textarea
          ref={customRef}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={customChange || (e => handleFieldChange(field, e.target.value))}
          onBlur={() => setManualFormTouched(prev => ({ ...prev, [field]: true }))}
          className={`w-full border rounded-xl px-3 py-2 bg-slate-50/40 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none resize-none overflow-hidden transition ${
            error
              ? "border-rose-300 focus:ring-4 focus:ring-rose-500/5 focus:border-rose-400"
              : value && !manualFormErrors[field]
              ? "border-emerald-200 focus:ring-4 focus:ring-blue-500/5 focus:border-[#0F4FA8]"
              : "border-slate-200 focus:ring-4 focus:ring-blue-500/5 focus:border-[#0F4FA8]"
          }`}
        />
        {error && (
          <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1.5 pl-1">
            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
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
                  <button
                    onClick={() => setShowImportSection(!showImportSection)}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <UploadCloud className="h-4 w-4 text-[#0F4FA8]" />
                    <span>Import CSV</span>
                  </button>
              )}

              <button
                onClick={() => setShowManualModal(true)}
                className="h-10 px-5 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/25 active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Lead</span>
              </button>

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
        <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-4 shadow-sm border border-slate-200/80 space-y-4">
          
          {/* Top Row: Search Input & Dropdowns */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Bar (50-60% width on desktop) */}
            <div className="relative flex-1 w-full">
              <Search className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="AI Search leads by name, phone, email, ID... (Ctrl + K)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-20 border border-slate-200 rounded-[16px] text-xs bg-slate-50/50 backdrop-blur-xs font-semibold text-slate-800 transition-all duration-200 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-[#0F4FA8] focus:ring-4 focus:ring-blue-500/10 shadow-sm"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-2 py-0.5 border border-slate-200 rounded-md text-[10px] text-slate-400 bg-white font-mono shadow-2xs font-extrabold select-none pointer-events-none">
                  Ctrl K
                </span>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
              <CustomSelect
                value={poolFilter}
                onChange={setPoolFilter}
                options={poolFilterOptions}
                placeholder="All Pools"
                className="w-full sm:w-36 shrink-0"
                triggerClassName="h-12 rounded-[16px] text-xs"
              />

              {isManager && (
                <CustomSelect
                  value={agentFilter}
                  onChange={setAgentFilter}
                  options={agentFilterOptions}
                  placeholder="All Agents"
                  className="w-full sm:w-36 shrink-0"
                  triggerClassName="h-12 rounded-[16px] text-xs"
                />
              )}

              <CustomSelect
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={priorityFilterOptions}
                placeholder="All Priorities"
                className="w-full sm:w-36 shrink-0"
                triggerClassName="h-12 rounded-[16px] text-xs"
              />

              {(searchQuery || statusFilter || poolFilter || agentFilter || priorityFilter || quickChipFilter !== "all") && (
                <button
                  onClick={resetFilters}
                  className="h-12 px-4 text-xs font-black text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/50 rounded-[16px] transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 animate-fade-in"
                >
                  <X className="h-4 w-4" />
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
              ].map(chip => {
                const count = statusCounts[chip.id as keyof typeof statusCounts] || 0;
                const isActive = quickChipFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    data-active={isActive}
                    onClick={() => {
                      setQuickChipFilter(chip.id);
                      if (chip.id === "all") setStatusFilter("");
                      else setStatusFilter(chip.id);
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-2 active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] text-white shadow-md shadow-blue-900/10"
                        : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/40"
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200/85 text-slate-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
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
          {isManager && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-[16px] p-4 shadow-lg shadow-slate-900/5 flex flex-col lg:flex-row items-center justify-between gap-4 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <IndeterminateCheckbox
                    checked={allPaginatedSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    className="h-4.5 w-4.5 text-[#0F4FA8] focus:ring-[#0F4FA8] border-slate-300 rounded cursor-pointer transition"
                  />
                  <span className="text-slate-400 text-xs font-bold select-none">Select Page</span>
                </div>

                <div className="h-5 w-px bg-slate-200" />

                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition ${selectedLeadIds.length > 0 ? "bg-blue-50 text-[#0F4FA8]" : "bg-slate-100 text-slate-400"}`}>
                    <CheckSquare className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-800 tracking-tight">
                        {selectedLeadIds.length} Leads Selected
                      </span>
                      {selectedLeadIds.length > 0 && (
                        <button
                          onClick={() => setSelectedLeadIds([])}
                          className="text-[10px] font-extrabold text-red-500 hover:text-red-600 transition cursor-pointer"
                        >
                          (Clear)
                        </button>
                      )}
                    </div>
                    <span className="block text-[10px] text-slate-400 font-semibold">Bulk assignment console</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
                <CustomSelect
                  disabled={selectedLeadIds.length === 0}
                  value={assignAgentId}
                  onChange={setAssignAgentId}
                  options={assignAgentOptions}
                  placeholder="-- Choose Target Agent --"
                  className="w-full sm:w-52 shrink-0 text-xs"
                  triggerClassName="h-12 rounded-[16px] text-xs"
                />

                <button
                  disabled={selectedLeadIds.length === 0 || !assignAgentId}
                  onClick={handleBulkAssignAgent}
                  className="h-12 px-5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-100 disabled:text-slate-400 text-slate-900 font-extrabold text-xs rounded-[16px] transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Bulk Assign</span>
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
                      <IndeterminateCheckbox
                        checked={allPaginatedSelected}
                        indeterminate={isIndeterminate}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-[#0F4FA8] focus:ring-[#0F4FA8] border-slate-300 rounded cursor-pointer"
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
                          <span>{l.location || (l.extra?.state ? `${l.extra.district ? l.extra.district + ', ' : ''}${l.extra.state}` : '') || "N/A"}</span>
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
      <LeadDetailsDrawer
        lead={drawerLeadWithLocation}
        onClose={() => setDrawerLead(null)}
        onUpdateDisposition={async (leadId, status, notes, followUpDate) => {
          await api.patch(`/api/leads/${leadId}/status`, {
            status,
            notes,
            follow_up_date: followUpDate || null
          });
          loadData();
        }}
        users={users}
        pools={pools}
        onCall={(l) => handleCallCustomer(l)}
        showToast={showToast}
      />

      {/* MANUAL LEAD ENTRY MODAL */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-[24px] p-6 max-w-4xl w-full shadow-2xl space-y-4 border border-slate-100"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-[#0F4FA8]" />
                    <span>Add Customer Lead</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Enterprise customer registration & pipeline classification</p>
                </div>
                <button onClick={() => setShowManualModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors duration-200">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleCreateManualLead} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1.5 select-none custom-scrollbar">
                  
                  {/* LEFT COLUMN */}
                  <div className="space-y-4">
                    {/* Card 1: Profile Information */}
                    <div className="bg-slate-50/40 backdrop-blur-xs border border-slate-100 rounded-[20px] p-5 space-y-4 shadow-sm hover:shadow transition-shadow duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-100/50 pb-3">
                        <div className="p-1.5 bg-[#0F4FA8]/5 text-[#0F4FA8] rounded-lg">
                          <UserPlus className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider">Profile Information</h4>
                          <p className="text-[9.5px] text-slate-400 font-bold">Primary contact identity and enterprise association</p>
                        </div>
                      </div>
                      <div className="space-y-3.5">
                        {renderTextInput("name", "Customer Name", "text", " ", true)}
                        <div>
                          <PhoneInput
                            required
                            value={manualForm.phone}
                            onChange={(fullVal) => {
                              setManualForm(prev => ({ ...prev, phone: fullVal }));
                              setManualFormTouched(prev => ({ ...prev, phone: true }));
                            }}
                            error={getFieldError("phone")}
                            label="Phone Number"
                            inputClassName="h-[48px]"
                          />
                        </div>
                        {renderTextInput("email", "Email ID", "email", " ", true)}
                        {renderTextInput("company_name", "Company Name (Optional)", "text", " ", false)}
                      </div>
                    </div>

                    {/* Card 2: Lead Details */}
                    <div className="bg-slate-50/40 backdrop-blur-xs border border-slate-100 rounded-[20px] p-5 space-y-4 shadow-sm hover:shadow transition-shadow duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-100/50 pb-3">
                        <div className="p-1.5 bg-[#0F4FA8]/5 text-[#0F4FA8] rounded-lg">
                          <Target className="h-4.5 w-4.5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider">Lead Details</h4>
                          <p className="text-[9.5px] text-slate-400 font-bold">Pipeline classification and routing settings</p>
                        </div>
                      </div>
                      <div className="space-y-3.5">
                        {renderSelectInput("pool_id", "Target Pool", manualPoolOptions, "Select Target Pool")}
                        {renderSelectInput("purpose", "Purpose", purposeOptions, "Select Purpose")}
                        {renderSelectInput("source", "Lead Source", sourceOptions, "Select Source")}
                        {renderSelectInput("priority", "Priority", priorityOptions, "Select Priority")}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-4">
                    {/* Card 3: Location */}
                    <div className="bg-slate-50/40 backdrop-blur-xs border border-slate-100 rounded-[20px] p-5 space-y-4 shadow-sm hover:shadow transition-shadow duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-100/50 pb-3">
                        <div className="p-1.5 bg-[#0F4FA8]/5 text-[#0F4FA8] rounded-lg">
                          <MapPin className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider">Location</h4>
                          <p className="text-[9.5px] text-slate-400 font-bold">Operational address and locality details</p>
                        </div>
                      </div>
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide pl-1 mb-1">
                            Country <span className="text-slate-400">(Read-Only)</span>
                          </label>
                          <input
                            readOnly
                            value="India"
                            className="w-full h-[48px] border border-slate-200 rounded-xl px-3 bg-slate-100/80 text-xs font-bold text-slate-400 select-none cursor-not-allowed focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3.5">
                          {renderSelectInput("state", "State", stateOptions, "Select State")}
                          {renderSelectInput("district", "District", districtOptions, manualForm.state ? "Select District" : "Select State First", !manualForm.state)}
                        </div>
                        {renderTextInput("pincode", "Pincode", "text", " ", true, 6)}
                        {renderTextareaInput("address", "Address", "Street address, building, local area...", true, 1, addressRef, handleAddressChange)}
                      </div>
                    </div>

                    {/* Card 4: Additional Information */}
                    <div className="bg-slate-50/40 backdrop-blur-xs border border-slate-100 rounded-[20px] p-5 space-y-4 shadow-sm hover:shadow transition-shadow duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-100/50 pb-3">
                        <div className="p-1.5 bg-[#0F4FA8]/5 text-[#0F4FA8] rounded-lg">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider">Additional Information</h4>
                          <p className="text-[9.5px] text-slate-400 font-bold">Extra contextual notes and details</p>
                        </div>
                      </div>
                      <div>
                        {renderTextareaInput("notes", "Notes (Optional)", "Add any extra notes or requirements...", false, 2)}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Sticky Footer Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-6 h-[44px] bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-extrabold transition cursor-pointer active:scale-95 text-center shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingManual || !isManualFormValid}
                    className={`flex-1 h-[44px] text-white font-extrabold rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                      isSubmittingManual
                        ? "bg-slate-400 cursor-not-allowed"
                        : !isManualFormValid
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] shadow-blue-500/20 hover:shadow-blue-900/30 active:scale-95"
                    }`}
                  >
                    {isSubmittingManual && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmittingManual ? "Saving Lead..." : "Add Customer Lead"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
