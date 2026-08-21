import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api, BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PhoneInput } from "../components/PhoneInput";
import LeadDetailsDrawer from "../components/LeadDetailsDrawer";
import { ImportCsvModal, ImportPreviewData } from "../components/ImportCsvModal";
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

// Clean BPO Enterprise Checkbox
function CustomCheckbox({
  checked,
  indeterminate,
  onChange,
  size = 18,
  isHeader = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  size?: number;
  isHeader?: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="relative flex items-center justify-center shrink-0 cursor-pointer select-none transition-all duration-150 group/cb"
      style={{ width: size, height: size }}
    >
      <div
        className={`w-full h-full rounded-[6px] flex items-center justify-center transition-all duration-150 border ${
          checked || indeterminate
            ? "bg-[#2563EB] border-[#2563EB] text-white shadow-2xs"
            : "bg-white dark:bg-[#1B2740] border-slate-300 dark:border-white/20 hover:border-[#2563EB] hover:bg-slate-50 dark:hover:bg-[#253655]"
        }`}
      >
        {checked && (
          <Check className="text-white h-3 w-3 stroke-[3]" />
        )}
        {!checked && indeterminate && (
          <span className="h-0.5 w-2 bg-white rounded-xs" />
        )}
      </div>
    </div>
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [poolFilter, setPoolFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [quickChipFilter, setQuickChipFilter] = useState<string>("all");
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input to prevent API spam on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      all: totalLeadsCount || leads.length,
      new: leads.filter(l => l.status === "new" || l.status === "New Lead").length,
      qualified: leads.filter(l => l.status === "qualified" || l.status === "Qualified").length,
      in_progress: leads.filter(l => l.status === "in_progress" || l.status === "In Progress").length,
      follow_up: leads.filter(l => l.status === "follow_up" || l.status === "Follow-up Needed").length,
      not_interested: leads.filter(l => l.status === "not_interested" || l.status === "Not Interested").length,
      closed: leads.filter(l => l.status === "closed" || l.status === "Closed / Won").length
    };
  }, [leads, totalLeadsCount]);

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
  const pageSize = 25;

  // Drawer & Modals
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Enterprise CSV Import Modal States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileForPreview = async (fileToUpload: File) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);
    try {
      showToast("Reading CSV headers & validating records...", "info");
      const res = await api.upload("/api/leads/upload-preview", formData);
      setPreviewData({
        headers: res.headers,
        suggested_mapping: res.suggested_mapping,
        total_records: res.total_records,
        valid_count: res.valid_count,
        invalid_count: res.invalid_count,
        duplicate_in_file: res.duplicate_in_file,
        preview_rows: res.preview_rows || [],
        all_rows: res.all_rows || [],
        filename: fileToUpload.name
      });
      setImportModalOpen(true);
    } catch (err: any) {
      showToast(err.message || "Failed to process CSV file.", "error");
    }
  };

  const handleTriggerFilePicker = async () => {
    if (isSelectingFile) return;
    setIsSelectingFile(true);

    try {
      if (window.electronAPI?.openCSVFile) {
        const fileResult = await window.electronAPI.openCSVFile();
        if (!fileResult) {
          setIsSelectingFile(false);
          return;
        }
        const fileBlob = new Blob([fileResult.content], { type: "text/csv" });
        const fileObj = new File([fileBlob], fileResult.fileName, { type: "text/csv" });
        await processFileForPreview(fileObj);
      } else {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to open CSV file picker.", "error");
    } finally {
      setIsSelectingFile(false);
    }
  };

  const handleWebFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".csv") && !selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      showToast("Invalid file format. Please select a .csv file.", "error");
      e.target.value = "";
      return;
    }
    await processFileForPreview(selectedFile);
    e.target.value = "";
  };


  // Prevent background scrolling and disable header/page interaction when manual lead modal is open
  useEffect(() => {
    if (showManualModal) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("lead-modal-active");
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("lead-modal-active");
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("lead-modal-active");
    };
  }, [showManualModal]);

  const maskPhoneNumber = (phoneStr?: string): string => {
    if (!phoneStr) return "N/A";
    const clean = phoneStr.replace(/\D/g, "");
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      return `+91 ${last10.slice(0, 4)}****${last10.slice(-3)}`;
    }
    return phoneStr;
  };

  const maskLeadName = (nameStr?: string): string => {
    if (!nameStr) return "Customer Lead";
    return nameStr.replace(/(\d{4})\d{3,4}(\d{3})/, "$1****$2");
  };

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
    notes: "",
    assigned_agent_id: ""
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

  const getLeadId = useCallback((l: any): string => {
    if (!l) return "";
    return String(l.id || l._id || l.lead_id || "");
  }, []);

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

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
      const queryParams = [`page=${currentPage}`, `limit=25`];
      if (poolFilter) queryParams.push(`pool_id=${encodeURIComponent(poolFilter)}`);
      if (statusFilter) queryParams.push(`status_filter=${encodeURIComponent(statusFilter)}`);
      if (campaignFilter) queryParams.push(`campaign_id=${encodeURIComponent(campaignFilter)}`);
      if (agentFilter) queryParams.push(`agent_id=${encodeURIComponent(agentFilter)}`);
      if (debouncedSearchQuery.trim()) queryParams.push(`search=${encodeURIComponent(debouncedSearchQuery.trim())}`);
      
      const queryString = `?${queryParams.join("&")}`;

      const [leadsRes, poolsData, campaignsData, usersData] = await Promise.all([
        api.get(`/api/leads${queryString}`),
        api.get("/api/pools").catch(() => []),
        api.get("/api/campaigns").catch(() => []),
        api.get("/api/users").catch(() => [])
      ]);

      if (Array.isArray(leadsRes)) {
        setLeads(leadsRes);
        setTotalLeadsCount(leadsRes.length);
        setTotalPagesCount(1);
      } else if (leadsRes && typeof leadsRes === "object") {
        setLeads(leadsRes.items || []);
        setTotalLeadsCount(leadsRes.total || 0);
        setTotalPagesCount(leadsRes.totalPages || 1);
      } else {
        setLeads([]);
      }

      setPools(Array.isArray(poolsData) ? poolsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      console.error("[Leads] Failed to load data:", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [poolFilter, statusFilter, campaignFilter, agentFilter, debouncedSearchQuery, currentPage]);

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
      
      if (manualForm.assigned_agent_id) {
        try {
          await api.patch("/api/leads/bulk-assign", {
            lead_ids: [createdLead.id || createdLead._id],
            agent_id: manualForm.assigned_agent_id
          });
        } catch (err) {
          console.error("Failed to assign agent to new lead:", err);
        }
      }

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
        notes: "",
        assigned_agent_id: ""
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

  const isCallingRef = useRef(false);

  async function handleCallCustomer(lead: Lead) {
    if (isCallingRef.current) return;
    isCallingRef.current = true;
    const idempotencyKey = `lead_${user?.id || 'agent'}_${lead.phone.replace(/\D/g, '')}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      showToast(`Initiating manual call to ${lead.phone}...`, "info");
      await api.post("/api/calls/manual-dial", {
        phone: lead.phone,
        name: lead.name,
        pool_id: lead.pool_id,
        language: lead.language || "English",
        agent_assign_mode: "auto",
        priority: lead.priority || "medium",
        notes: lead.last_note || "",
        idempotency_key: idempotencyKey
      });
      showToast(`Call started with ${lead.name}`, "success");
      
      if (user?.role === "agent") {
        navigate("/dialer");
      } else {
        navigate("/live-calls");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to start call";
      showToast(msg, err.status === 409 || msg.includes("already in progress") ? "warning" : "error");
    } finally {
      setTimeout(() => { isCallingRef.current = false; }, 1000);
    }
  }

  async function handleBulkAssignAgent() {
    if (selectedLeadIds.length === 0 || !assignAgentId) return;
    if (isBulkAssigning) return;

    const selectedAgentObj = users.find(u => u.id === assignAgentId || u.employee_id === assignAgentId || (u as any)._id === assignAgentId);
    const agentName = selectedAgentObj?.name || "Agent";
    const leadCount = selectedLeadIds.length;

    setIsBulkAssigning(true);
    showToast(`Assigning ${leadCount} lead${leadCount === 1 ? "" : "s"} to ${agentName}...`, "info");

    try {
      const res = await api.patch("/api/leads/bulk-assign", {
        lead_ids: selectedLeadIds,
        agent_id: assignAgentId
      });

      const failedCount = res?.failed_count || 0;
      const successCount = res?.success_count ?? res?.assigned_count ?? (leadCount - failedCount);

      if (failedCount === 0) {
        showToast(`${successCount} lead${successCount === 1 ? "" : "s"} assigned successfully to ${agentName}.`, "success");
        setSelectedLeadIds([]);
        setAssignAgentId("");
        setShowBulkMenu(false);
      } else {
        const failedIds = res?.failed_lead_ids || [];
        showToast(`${successCount} lead(s) assigned to ${agentName}. ${failedCount} lead(s) failed.`, "warning");
        setSelectedLeadIds(failedIds);
      }
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk assignment failed.", "error");
    } finally {
      setIsBulkAssigning(false);
    }
  }

  async function handleAssignAgentInline(leadId: string, agentId: string) {
    const targetAgentId = agentId === "unassigned" ? "" : agentId;
    const selectedAgentObj = users.find(u => u.id === targetAgentId || u.employee_id === targetAgentId || (u as any)._id === targetAgentId);
    const agentName = selectedAgentObj?.name || "Unassigned";

    try {
      await api.patch("/api/leads/bulk-assign", {
        lead_ids: [leadId],
        agent_id: targetAgentId
      });
      showToast(`Lead assigned successfully to ${agentName}.`, "success");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to assign agent.", "error");
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
    if (!leadId) return;
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
    return paginatedLeads.length > 0 && paginatedLeads.every(l => {
      const lid = getLeadId(l);
      return lid ? selectedLeadIds.includes(lid) : false;
    });
  }, [paginatedLeads, selectedLeadIds, getLeadId]);

  const isIndeterminate = useMemo(() => {
    const paginatedIds = paginatedLeads.map(getLeadId).filter(Boolean);
    const selectedCountOnPage = paginatedIds.filter(id => selectedLeadIds.includes(id)).length;
    return selectedCountOnPage > 0 && selectedCountOnPage < paginatedLeads.length;
  }, [paginatedLeads, selectedLeadIds, getLeadId]);

  const toggleSelectAll = () => {
    const paginatedIds = paginatedLeads.map(getLeadId).filter(Boolean);
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

  const inlineAgentOptions = useMemo(() => {
    const list = agentsList.map(a => ({
      value: a.id,
      label: a.name
    }));
    return [{ value: "unassigned", label: "Unassigned" }, ...list];
  }, [agentsList]);

  const manualAgentOptions = useMemo(() => {
    const list = agentsList.map(a => ({
      value: a.id,
      label: `${a.name} (${a.employee_id || "Agent"})`
    }));
    if (user?.role === "agent") {
      return list.filter(a => a.value === user.id);
    }
    return list;
  }, [agentsList, user]);

  const manualPoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace(/_/g, " ").toUpperCase()
    }));
    if (user?.role === "agent") {
      return list.filter(p => p.value === user.pool_id);
    }
    return list;
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
    const touched = (manualFormTouched as any)[field];
    const value = (manualForm as any)[field];
    const showError = error && touched;
    return (
      <div className="flex flex-col gap-0.5 w-full text-left font-sans">
        <label className="text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <input
            type={type}
            maxLength={maxLength}
            placeholder={placeholder || " "}
            value={value}
            onChange={e => handleFieldChange(field, e.target.value)}
            onBlur={() => setManualFormTouched(prev => ({ ...prev, [field]: true }))}
            className={`w-full h-[34px] sm:h-[36px] px-3 border rounded-lg bg-white dark:bg-[#09111E] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all duration-150 hover:border-[#2563EB] ${
              showError
                ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-slate-200/90 dark:border-slate-700/80 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            }`}
          />
        </div>
        {showError && (
          <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-0.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
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
    const touched = (manualFormTouched as any)[field];
    const value = (manualForm as any)[field];
    const showError = error && touched;
    return (
      <div className="flex flex-col gap-0.5 w-full text-left font-sans">
        <label className="text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}<span className="text-rose-500 ml-0.5">*</span>
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
          triggerClassName={`h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold border transition-all duration-150 bg-white dark:bg-[#09111E] hover:border-[#2563EB] ${
            showError
              ? "border-rose-500 focus:border-rose-500 ring-2 ring-rose-500/20"
              : "border-slate-200/90 dark:border-slate-700/80"
          }`}
        />
        {showError && (
          <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-0.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
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
    _rows = 1,
    customRef?: React.RefObject<HTMLTextAreaElement>,
    customChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  ) => {
    const error = getFieldError(field);
    const touched = (manualFormTouched as any)[field];
    const value = (manualForm as any)[field];
    const showError = error && touched;
    return (
      <div className="flex flex-col gap-0.5 w-full text-left font-sans">
        <label className="text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        <textarea
          ref={customRef}
          placeholder={placeholder}
          value={value}
          onChange={customChange || (e => handleFieldChange(field, e.target.value))}
          onBlur={() => setManualFormTouched(prev => ({ ...prev, [field]: true }))}
          className={`w-full h-[56px] sm:h-[60px] px-3 py-2 border rounded-lg bg-white dark:bg-[#09111E] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none resize-none transition-all duration-150 placeholder-slate-400 dark:placeholder-slate-500 hover:border-[#2563EB] ${
            showError
              ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "border-slate-200/90 dark:border-slate-700/80 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          }`}
        />
        {showError && (
          <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-0.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto font-sans pb-12">
      
      {/* 1. HERO SECTION WITH BLUE -> GOLD GRADIENT TOP BORDER & GLASSMORPHISM */}
      <div className="p-0.5 rounded-[12px] bg-gradient-to-r from-[#0F4FA8] via-[#1E6AD7] to-[#FFC107] shadow-sm">
        <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[11px] p-3.5 sm:p-4 space-y-3 border border-slate-200/80 dark:border-white/10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            
            {/* Title & AI Badge */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-500/20 dark:to-amber-500/10 text-[#1D4ED8] dark:text-[#FDE047] flex items-center justify-center font-bold shrink-0 shadow-2xs border border-amber-300/60 dark:border-amber-500/30">
                  <Users className="h-4.5 w-4.5 text-[#1D4ED8] dark:text-[#FDE047]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex flex-col items-start">
                      <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-1.5">
                        <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Lead</span>
                        <span className="text-[#F4B400] font-extrabold">Management</span>
                      </h1>
                    </div>
                    <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                      AI VOICE READY
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">Enterprise customer lead pipeline, intelligent scoring &amp; agent routing</p>
                </div>
              </div>

              {/* 6 Compact KPI Chips */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap text-[11px] font-bold">
                <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                  {leads.length} Total
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#34D399] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {leads.filter(l => l.status === "new").length} New Today
                </span>
                <span className="bg-blue-50 dark:bg-blue-500/15 text-[#0F4FA8] dark:text-[#60A5FA] px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30">
                  {leads.filter(l => l.status === "qualified").length} Qualified
                </span>
                <span className="bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-[#C084FC] px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/30">
                  {leads.filter(l => l.assigned_agent_id).length} Assigned
                </span>
                <span className="bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-[#FBBF24] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                  38.4% Conv
                </span>
                <span className="bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-[#F87171] px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">
                  {leads.filter(l => l.status === "follow_up" || l.status === "in_progress").length} Follow-ups
                </span>
              </div>
            </div>

            {/* Right Action Bar */}
            <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 justify-between lg:justify-end flex-wrap">
              <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 hidden sm:inline mr-1">
                Updated 1m ago
              </span>

              <button
                onClick={loadData}
                className="h-9 w-9 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 rounded-[12px] transition flex items-center justify-center shadow-2xs active:scale-95 cursor-pointer border border-slate-200/60 dark:border-white/10"
                title="Refresh Data"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {isManager && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleWebFileInput}
                    className="hidden"
                  />
                  <button
                    onClick={handleTriggerFilePicker}
                    disabled={isSelectingFile}
                    className="h-9 px-3.5 bg-slate-100 hover:bg-[#0F4FA8] hover:text-white dark:bg-white/10 dark:hover:bg-[#2563EB] text-slate-700 dark:text-slate-200 rounded-[12px] text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 group border border-slate-200/60 dark:border-white/10"
                    title="Import CSV Leads"
                  >
                    {isSelectingFile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F4FA8] dark:text-[#60A5FA] group-hover:text-white" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5 text-[#0F4FA8] dark:text-[#60A5FA] group-hover:text-white transition-colors" />
                    )}
                    <span>{isSelectingFile ? "Selecting file..." : "Import CSV"}</span>
                  </button>
                </>
              )}

              {(isManager || user?.role === "agent") && (
                <button
                  onClick={() => {
                    if (user?.role === "agent") {
                      setManualForm(prev => ({
                        ...prev,
                        pool_id: user.pool_id || "",
                        assigned_agent_id: user.id
                      }));
                    }
                    setShowManualModal(true);
                  }}
                  className="h-9 px-4 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-semibold text-xs rounded-[12px] transition flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Lead</span>
                </button>
              )}

              <button
                onClick={() => showToast("Exporting leads database CSV...", "info")}
                className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 rounded-[12px] text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer border border-slate-200/60 dark:border-white/10"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-[#34D399]" />
                <span>Export CSV</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 2. SIX ENTERPRISE KPI CARDS GRID (Single row on desktop, 12px radius) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        
        {/* KPI 1: Total Leads */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { setQuickChipFilter("all"); setStatusFilter(""); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-[#0F4FA8] flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{leads.length}</span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">Total Leads</span>
            </div>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-500/15 rounded-lg border border-blue-100 dark:border-blue-500/20 text-[#0F4FA8] dark:text-[#60A5FA]">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-emerald-600 dark:text-[#34D399] font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +12.4%
            </span>
            <Sparkline color="#0F4FA8" />
          </div>
        </motion.div>

        {/* KPI 2: New Today */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { setQuickChipFilter("new"); setStatusFilter("new"); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-emerald-500 flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {leads.filter(l => l.status === "new").length}
              </span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">New Today</span>
            </div>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/15 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-[#34D399]">
              <UserPlus className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-emerald-600 dark:text-[#34D399] font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +5 today
            </span>
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 3: Qualified */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { setQuickChipFilter("qualified"); setStatusFilter("qualified"); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-emerald-500 flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {leads.filter(l => l.status === "qualified").length}
              </span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">Qualified</span>
            </div>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/15 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-[#34D399]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-emerald-600 dark:text-[#34D399] font-bold">High Intent</span>
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 4: Assigned */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { resetFilters(); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-purple-600 flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {leads.filter(l => l.assigned_agent_id).length}
              </span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">Assigned</span>
            </div>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-500/15 rounded-lg border border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-[#C084FC]">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-purple-600 dark:text-[#C084FC] font-bold">To Agents</span>
            <Sparkline color="#9333EA" />
          </div>
        </motion.div>

        {/* KPI 5: Conversion Rate */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { setQuickChipFilter("closed"); setStatusFilter("closed"); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-amber-500 flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">38.4%</span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">Conversion</span>
            </div>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/15 rounded-lg border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-[#FBBF24]">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-emerald-600 dark:text-[#34D399] font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +4.2%
            </span>
            <Sparkline color="#F59E0B" />
          </div>
        </motion.div>

        {/* KPI 6: Follow-ups */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => { setQuickChipFilter("follow_up"); setStatusFilter("follow_up"); }}
          className="bg-white/95 dark:bg-[#131C2F] border border-slate-200/80 dark:border-white/10 p-3 rounded-[12px] shadow-2xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border-t-4 border-t-rose-500 flex flex-col justify-between h-[98px]"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {leads.filter(l => l.status === "in_progress" || l.status === "follow_up").length}
              </span>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mt-0.5">Follow-ups</span>
            </div>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-500/15 rounded-lg border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-[#F87171]">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/10 text-[10px]">
            <span className="text-rose-600 dark:text-[#F87171] font-bold">Action Needed</span>
            <Sparkline color="#EF4444" />
          </div>
        </motion.div>

      </div>

      {/* 4. MAIN LEADS MANAGEMENT CONTENT (FULL WIDTH TOOLBAR & TABLE) */}
      <div className="space-y-4">

        {/* FILTER TOOLBAR BAR WITH FULL WIDTH SCROLLABLE STATUS CHIPS */}
        <div className="bg-white dark:bg-[#111827] backdrop-blur-md rounded-[12px] p-3 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-2.5">
          
          {/* Top Row: Search Input & Dropdowns */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Search Bar */}
            <div className="relative flex-1 w-full">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="AI Search leads by name, phone, email, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-16 border border-slate-200 dark:border-white/10 rounded-[12px] text-xs font-semibold bg-slate-50/80 dark:bg-[#111827] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] transition-all duration-200 focus:outline-none focus:border-[#2563EB]"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 border border-slate-200 dark:border-white/10 rounded text-[9px] text-slate-400 dark:text-[#64748B] bg-white dark:bg-[#172033] font-mono font-extrabold select-none pointer-events-none">
                  Ctrl K
                </span>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
              <CustomSelect
                value={poolFilter}
                onChange={setPoolFilter}
                options={poolFilterOptions}
                placeholder="All Pools"
                className="w-full sm:w-36 shrink-0"
                triggerClassName="h-9 rounded-[12px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
              />

              {isManager && (
                <CustomSelect
                  value={agentFilter}
                  onChange={setAgentFilter}
                  options={agentFilterOptions}
                  placeholder="All Agents"
                  className="w-full sm:w-36 shrink-0"
                  triggerClassName="h-9 rounded-[12px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
                />
              )}

              <CustomSelect
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={priorityFilterOptions}
                placeholder="All Priorities"
                className="w-full sm:w-36 shrink-0"
                triggerClassName="h-9 rounded-[12px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
              />

              {(searchQuery || statusFilter || poolFilter || agentFilter || priorityFilter || quickChipFilter !== "all") && (
                <button
                  onClick={resetFilters}
                  className="h-9 px-3 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[12px] transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Status Filter Chips */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-1.5 relative">
            {showScrollLeft && (
              <button
                onClick={() => handleScrollTabs("left")}
                className="h-7 w-7 rounded-full bg-white dark:bg-[#172033] hover:bg-[#2563EB] hover:text-white text-slate-700 dark:text-[#F8FAFC] transition flex items-center justify-center shrink-0 cursor-pointer shadow-xs border border-slate-200 dark:border-white/10 active:scale-95 z-10"
                title="Scroll Left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}

            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth w-full py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
                    className={`h-9 px-3.5 rounded-[12px] text-xs font-semibold whitespace-nowrap transition-all duration-200 ease-in-out cursor-pointer shrink-0 flex items-center gap-2 active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-slate-950 font-bold shadow-xs border border-amber-300/40"
                        : "bg-white dark:bg-[#182233] text-slate-700 dark:text-[#F8FAFC] border border-amber-200/80 dark:border-amber-500/20 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/40 shadow-2xs"
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`h-5 min-w-[20px] px-1.5 rounded-full font-bold text-[10px] flex items-center justify-center ${
                        isActive
                          ? "bg-amber-700/20 text-slate-950 shadow-2xs"
                          : "bg-amber-100/90 dark:bg-amber-500/15 text-amber-900 dark:text-[#FDE047]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {showScrollRight && (
              <button
                onClick={() => handleScrollTabs("right")}
                className="h-7 w-7 rounded-full bg-white dark:bg-[#172033] hover:bg-[#2563EB] hover:text-white text-slate-700 dark:text-[#F8FAFC] transition flex items-center justify-center shrink-0 cursor-pointer shadow-xs border border-slate-200 dark:border-white/10 active:scale-95 z-10"
                title="Scroll Right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Enterprise Bulk Action Toolbar (Admin & TL / Supervisor only) */}
          {isManager && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-[12px] p-2.5 shadow-2xs flex flex-col lg:flex-row items-center justify-between gap-3 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CustomCheckbox
                    checked={allPaginatedSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    size={18}
                  />
                  <span className="text-slate-500 dark:text-[#94A3B8] text-xs font-bold select-none">Select Page</span>
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />

                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg transition ${selectedLeadIds.length > 0 ? "bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA]" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-[#64748B]"}`}>
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-800 dark:text-[#F8FAFC] tracking-tight">
                        {selectedLeadIds.length} Leads Selected
                      </span>
                      {selectedLeadIds.length > 0 && (
                        <button
                          onClick={() => setSelectedLeadIds([])}
                          className="text-[10px] font-extrabold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                        >
                          (Clear)
                        </button>
                      )}
                    </div>
                    <span className="block text-[10px] text-slate-400 dark:text-[#64748B] font-semibold">Bulk assignment console</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
                <CustomSelect
                  disabled={selectedLeadIds.length === 0 || isBulkAssigning}
                  value={assignAgentId}
                  onChange={setAssignAgentId}
                  options={assignAgentOptions}
                  placeholder="-- Choose Target Agent --"
                  className="w-full sm:w-48 shrink-0 text-xs"
                  triggerClassName="h-9 rounded-[12px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827]"
                />

                <button
                  disabled={selectedLeadIds.length === 0 || !assignAgentId || isBulkAssigning}
                  onClick={handleBulkAssignAgent}
                  className="h-9 px-4 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-xs rounded-[12px] transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {isBulkAssigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  <span>{isBulkAssigning ? "Assigning..." : "Bulk Assign"}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── ENTERPRISE LEADS TABLE CARD (Consistent 12px Radius, 56px Row Height) ── */}
        <div className="p-3 bg-white dark:bg-[#111827] rounded-[12px] border border-slate-200/80 dark:border-[rgba(255,255,255,0.06)] shadow-xs overflow-hidden">
          <div className="overflow-x-auto rounded-[10px] border border-slate-200/60 dark:border-white/5 custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#1B2942] dark:to-[#162033] text-slate-500 dark:text-[#94A3B8] font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-b-white/8 sticky top-0 z-10">
                <tr className="h-10">
                  {isManager && (
                    <th className="w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 bg-slate-50 dark:bg-[#1B2942] z-10 border-r border-slate-200/50 dark:border-white/10">
                      <div className="flex items-center justify-center">
                        <CustomCheckbox
                          checked={allPaginatedSelected}
                          indeterminate={isIndeterminate}
                          onChange={toggleSelectAll}
                          size={18}
                          isHeader={true}
                        />
                      </div>
                    </th>
                  )}
                  <th className="px-3 py-2">Lead ID</th>
                  <th className="px-3 py-2">Customer &amp; AI Score</th>
                  <th className="px-3 py-2">Phone &amp; Location</th>
                  <th className="px-3 py-2">Pool</th>
                  <th className="px-3 py-2">Assigned Agent</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="h-5 bg-slate-200 dark:bg-[#172033] rounded-lg w-full" />
                      </td>
                    </tr>
                  ))
                ) : paginatedLeads.map((l, idx) => {
                  const leadIdKey = getLeadId(l);
                  const isSelected = selectedLeadIds.includes(leadIdKey) || (l.id ? selectedLeadIds.includes(l.id) : false) || (l._id ? selectedLeadIds.includes(l._id) : false) || (l.lead_id ? selectedLeadIds.includes(l.lead_id) : false);
                  const poolObj = pools.find(p => p.id === l.pool_id || p.name === l.pool_id);

                  // Priority & Status Values
                  const priorityVal = (l.priority || "medium").toLowerCase();
                  const statusVal = (l.status || "new").toLowerCase();

                  return (
                    <tr
                      key={leadIdKey || idx}
                      onClick={() => toggleSelectLead(leadIdKey)}
                      className={`h-[56px] transition-all duration-150 cursor-pointer border-l-4 ${
                        idx % 2 === 0
                          ? "bg-white dark:bg-[#131C2F]"
                          : "bg-slate-50/40 dark:bg-[#162238]"
                      } ${
                        isSelected
                          ? "border-l-[#F4B400] bg-amber-50/50 dark:bg-amber-500/10 shadow-2xs select-row-active"
                          : "border-l-transparent hover:border-l-[#F4B400] hover:bg-slate-50 dark:hover:bg-[#19263E]"
                      }`}
                    >
                      {/* Checkbox */}
                      {isManager && (
                        <td className="w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 bg-inherit z-10 border-r border-slate-200/50 dark:border-white/10">
                          <div className="flex items-center justify-center">
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelectLead(leadIdKey)}
                              size={18}
                            />
                          </div>
                        </td>
                      )}

                      {/* Lead ID */}
                      <td className="px-3 py-2">
                        <span className="font-mono font-extrabold text-[#2563EB] dark:text-[#38BDF8] bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200 dark:border-[#38BDF8]/30 px-2 py-0.5 rounded-[8px] text-[11px]">
                          {l.lead_id}
                        </span>
                      </td>

                      {/* Customer & AI Score (40x40 Avatar) */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="relative group/avatar shrink-0">
                            <div className="h-10 w-10 rounded-[10px] bg-gradient-to-tr from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-[#FACC15] flex items-center justify-center font-extrabold text-sm shadow-xs border border-[#2563EB]">
                              {l.name[0]?.toUpperCase() || "C"}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#10B981] border-2 border-white dark:border-[#131C2F]" />
                          </div>
                          <div className="min-w-0">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrawerLead(l);
                              }}
                              className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-[#2563EB] dark:hover:text-[#60A5FA] cursor-pointer transition truncate max-w-[150px]"
                              title={l.name}
                            >
                              {maskLeadName(l.name)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#10B981] to-[#06B6D4] rounded-full" style={{ width: `${l.ai_score || 85}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-[#34D399] font-mono">{l.ai_score || 85}% AI</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">{maskPhoneNumber(l.phone)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#94A3B8]/70 font-medium flex items-center gap-0.5 mt-0.5">
                          <MapPin className="h-3 w-3 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                          <span className="truncate max-w-[120px]" title={l.location || (l.extra?.state ? `${l.extra.district ? l.extra.district + ', ' : ''}${l.extra.state}` : '') || "N/A"}>
                            {l.location || (l.extra?.state ? `${l.extra.district ? l.extra.district + ', ' : ''}${l.extra.state}` : '') || "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Pool Badge */}
                      <td className="px-3 py-2">
                        <span className="font-semibold text-[11px] px-2 py-0.5 rounded-[8px] bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200/80 dark:border-blue-500/30 whitespace-nowrap">
                          {poolObj?.name === "credit_card_sales" ? "Sales Team" : (poolObj?.name ? poolObj.name.replace(/_/g, " ") : "No Pool")}
                        </span>
                      </td>

                      {/* Assigned Agent */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          disabled={user?.role === "agent"}
                          value={l.assigned_agent_id || "unassigned"}
                          onChange={(newAgentId) => handleAssignAgentInline(l.id, newAgentId)}
                          options={inlineAgentOptions}
                          triggerClassName="h-[44px] min-w-[145px] w-[150px] rounded-[12px] px-3 text-xs font-semibold border-slate-200 dark:border-white/10 dark:bg-[#111827]"
                          placeholder="Unassigned"
                        />
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-[8px] border tracking-wider whitespace-nowrap ${
                          priorityVal === "high"
                            ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                            : priorityVal === "low"
                            ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                            : "bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]"
                        }`}>
                          {l.priority || "Medium"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        <span className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold uppercase tracking-wider border flex items-center gap-1.5 w-fit whitespace-nowrap transition-colors duration-150 ${
                          statusVal === "not_interested"
                            ? "bg-white dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-500/10"
                            : statusVal === "qualified"
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                            : statusVal === "in_progress" || statusVal === "follow_up"
                            ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400"
                            : statusVal === "closed"
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-500/30 text-[#2563EB] dark:text-blue-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            statusVal === "not_interested"
                              ? "bg-rose-500"
                              : statusVal === "qualified" || statusVal === "closed"
                              ? "bg-emerald-500"
                              : statusVal === "in_progress" || statusVal === "follow_up"
                              ? "bg-amber-500"
                              : "bg-[#2563EB]"
                          } animate-pulse`} />
                          <span>{(l.status || "new").replace("_", " ")}</span>
                        </span>
                      </td>

                      {/* Quick Actions (32x32 rounded-[8px] buttons) */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerLead(l);
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-[8px] bg-slate-100 dark:bg-white/5 hover:bg-[#2563EB]/10 hover:border-[#2563EB]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#2563EB] border border-slate-200/80 dark:border-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
                            title="View Profile Drawer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCallCustomer(l);
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-[#10B981]/10 hover:border-[#10B981]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#10B981] border border-slate-200/80 dark:border-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
                            title="Call Customer"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Opening WhatsApp chat with ${l.phone}...`, "info");
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-slate-600 dark:text-[#94A3B8] hover:text-cyan-500 border border-slate-200/80 dark:border-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
                            title="Send WhatsApp Message"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>

                          {isManager && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeadToDelete(l);
                              }}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-[#EF4444]/10 hover:border-[#EF4444]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#EF4444] border border-slate-200/80 dark:border-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
          <div className="p-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#131C2F]/80 flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
            <span>
              Showing {paginatedLeads.length} of {filteredLeads.length} leads
            </span>

            <div className="flex items-center gap-3 font-bold">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 border border-slate-200 dark:border-white/5 rounded-[12px] bg-white dark:bg-[#131C2F] text-slate-800 dark:text-[#F8FAFC] disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2563EB]/10 dark:hover:border-[#2563EB]/30 transition hover:shadow-[0_0_12px_rgba(37,99,235,0.15)]"
              >
                Previous
              </button>

              <span className="px-3 py-2 bg-slate-100 dark:bg-[#1B2740] rounded-[10px] font-mono text-slate-800 dark:text-[#F8FAFC] border border-slate-200/50 dark:border-white/5">{currentPage} / {totalPages}</span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-4 py-2 border border-slate-200 dark:border-white/5 rounded-[12px] bg-white dark:bg-[#131C2F] text-slate-800 dark:text-[#F8FAFC] disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2563EB]/10 dark:hover:border-[#2563EB]/30 transition hover:shadow-[0_0_12px_rgba(37,99,235,0.15)]"
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
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center p-3 md:p-6 font-sans pointer-events-auto modal-open-container overflow-hidden"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              zIndex: 9998
            }}
          >
            <style dangerouslySetInnerHTML={{__html: `
              body {
                overflow: hidden !important;
              }
              .lm-scroll::-webkit-scrollbar { width: 6px; }
              .lm-scroll::-webkit-scrollbar-track { background: transparent; }
              .lm-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
              .dark .lm-scroll::-webkit-scrollbar-thumb { background: #334155; }
              .lm-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
              .dark .lm-scroll { scrollbar-color: #334155 transparent; }
            `}} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-[min(880px,78vw)] h-[min(540px,72vh)] max-w-[880px] max-h-[72vh] min-h-[360px] bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/10 flex flex-col overflow-hidden relative pointer-events-auto z-[9999] mx-auto my-auto box-border"
            >
              {/* ── Top Brand Bar ── */}
              <div className="h-[3px] min-h-[3px] bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#FACC15] shrink-0" />

              {/* ── FIXED HEADER (44-46px) ── */}
              <div className="h-[44px] sm:h-[46px] min-h-[44px] flex items-center justify-between px-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0F172A] z-10">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight flex items-center gap-1 text-slate-900 dark:text-white leading-tight">
                      <span className="text-[#2563EB] dark:text-[#3B82F6] font-black">Add Customer</span>
                      <span className="text-[#FACC15] font-black">Lead</span>
                    </h3>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Create a new customer lead record for pipeline routing</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Enterprise Lead Form
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── SCROLLABLE FORM BODY ── */}
              <form onSubmit={handleCreateManualLead} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto lm-scroll p-3.5 sm:p-4 bg-slate-50/50 dark:bg-[#0B1120]/50 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    {/* ── CARD 1: Profile Information ── */}
                    <div className="bg-white/90 dark:bg-[#131C2F]/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                      <div className="pb-2 border-b border-slate-100 dark:border-white/10">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>Profile Information</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Primary contact identity and enterprise details</p>
                      </div>

                      <div className="space-y-2">
                        {renderTextInput("name", "Customer Name", "text", "Enter customer full name", true)}
                        
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
                            inputClassName="h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold"
                          />
                        </div>

                        {renderTextInput("email", "Email ID", "email", "name@company.com", true)}
                        {renderTextInput("company_name", "Company Name", "text", "Company or organization (optional)", false)}
                      </div>
                    </div>

                    {/* ── CARD 2: Location Details ── */}
                    <div className="bg-white/90 dark:bg-[#131C2F]/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                      <div className="pb-2 border-b border-slate-100 dark:border-white/10">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <MapPin className="h-3.5 w-3.5 text-amber-500" />
                          <span>Location Details</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Operational address and geographic details</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-col gap-0.5 w-full text-left font-sans">
                          <label className="text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Country <span className="text-slate-400 font-normal lowercase">(read-only)</span>
                          </label>
                          <input
                            readOnly
                            value="India"
                            className="w-full h-[34px] sm:h-[36px] border border-slate-200/80 dark:border-slate-800 rounded-lg px-3 bg-slate-100/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed select-none focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {renderSelectInput("state", "State", stateOptions, "Select State")}
                          {renderSelectInput("district", "District", districtOptions, manualForm.state ? "Select District" : "Select State First", !manualForm.state)}
                        </div>

                        {renderTextInput("pincode", "Pincode", "text", "6-digit pincode", true, 6)}
                        {renderTextareaInput("address", "Address", "Street address, building, local area...", true, 2, addressRef, handleAddressChange)}
                      </div>
                    </div>

                    {/* ── CARD 3: Pipeline & Routing ── */}
                    <div className="bg-white/90 dark:bg-[#131C2F]/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                      <div className="pb-2 border-b border-slate-100 dark:border-white/10">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <Target className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Pipeline & Routing</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Pipeline classification and agent assignment</p>
                      </div>

                      <div className="space-y-2">
                        {renderSelectInput("pool_id", "Target Pool", manualPoolOptions, "Select Target Pool", user?.role === "agent")}
                        {renderSelectInput("purpose", "Purpose", purposeOptions, "Select Purpose")}
                        {renderSelectInput("source", "Lead Source", sourceOptions, "Select Source")}
                        {renderSelectInput("priority", "Priority", priorityOptions, "Select Priority")}
                        {renderSelectInput("assigned_agent_id", "Assigned Agent", manualAgentOptions, "Select Agent (optional)", user?.role === "agent")}
                      </div>
                    </div>

                    {/* ── CARD 4: Additional Notes ── */}
                    <div className="bg-white/90 dark:bg-[#131C2F]/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs space-y-2.5 flex flex-col">
                      <div className="pb-2 border-b border-slate-100 dark:border-white/10">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <FileText className="h-3.5 w-3.5 text-indigo-500" />
                          <span>Additional Notes</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Contextual notes and call instructions</p>
                      </div>

                      <div className="space-y-2 flex-1 flex flex-col">
                        {renderTextareaInput("notes", "Notes (Optional)", "Add any extra requirements, call scripts, or notes...", false, 4)}
                      </div>
                    </div>

                  </div>{/* /grid */}
                </div>{/* /scroll */}

                {/* ── FIXED FOOTER (48-50px) ── */}
                <div className="h-[48px] min-h-[48px] flex items-center justify-end gap-2.5 px-4 sm:px-5 border-t border-slate-200/80 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0F172A] z-10">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="h-[34px] px-4 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200/80 dark:border-white/10 transition cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingManual || !isManualFormValid}
                    className={`h-[34px] px-4 text-white text-xs font-extrabold rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                      isSubmittingManual || !isManualFormValid
                        ? "bg-blue-600/50 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-blue-500/25 active:scale-98"
                    }`}
                  >
                    {isSubmittingManual && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isSubmittingManual ? "Saving Lead..." : "Add Customer Lead"}</span>
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

      {/* CSV IMPORT MODAL */}
      <ImportCsvModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        previewData={previewData}
        pools={pools}
        campaigns={campaigns}
        users={users}
        showToast={showToast}
        onImportSuccess={() => {
          loadData();
        }}
      />

    </div>
  );
}
