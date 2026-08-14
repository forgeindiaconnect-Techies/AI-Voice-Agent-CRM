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

// Custom Premium Branded Checkbox
function CustomCheckbox({
  checked,
  indeterminate,
  onChange,
  size = 22,
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
      className="relative flex items-center justify-center shrink-0 cursor-pointer select-none transition-all duration-220 group/cb"
      style={{ width: size, height: size }}
    >
      <div
        className={`w-full h-full rounded-[8px] flex items-center justify-center transition-all duration-220 border-2 ${
          checked || indeterminate
            ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] border-transparent shadow-[0_8px_22px_rgba(37,99,235,0.35)] scale-100"
            : "bg-[#1A2438] border-[rgba(59,130,246,0.30)] hover:bg-[#2563EB]/12 hover:border-[#2563EB] hover:scale-108"
        }`}
        style={
          isHeader && !(checked || indeterminate)
            ? {
                borderColor: "rgba(59, 130, 246, 0.4)",
                backgroundImage: "linear-gradient(#1A2438, #1A2438), linear-gradient(135deg, #2563EB, #FACC15)",
                backgroundClip: "content-box, border-box",
                backgroundOrigin: "border-box",
              }
            : undefined
        }
      >
        {checked && (
          <Check className="text-white h-3.5 w-3.5 stroke-[3] scale-100 transition-transform duration-200" />
        )}
        {!checked && indeterminate && (
          <span className="h-0.5 w-2.5 bg-white rounded-xs" />
        )}
      </div>

      {checked && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FACC15] border border-white dark:border-[#111827] animate-pulse" />
      )}
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
      <div className="flex flex-col gap-1 w-full text-left font-sans">
        <label className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
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
            className={`w-full h-[46px] px-4 border rounded-[10px] bg-white dark:bg-[#09111E] text-[15px] font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-600 focus:outline-none transition-colors duration-150 hover:border-[#2563EB] ${
              showError
                ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                : "border-[#D9E2EC] dark:border-slate-700/80 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
            }`}
          />
        </div>
        {showError && (
          <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
            <AlertCircle className="h-[11px] w-[11px] shrink-0" />
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
      <div className="flex flex-col gap-1 w-full text-left font-sans">
        <label className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
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
          triggerClassName={`h-[46px] rounded-[10px] text-[15px] font-medium border transition-colors duration-150 bg-white dark:bg-[#09111E] hover:border-[#2563EB] ${
            showError
              ? "border-rose-500 focus:border-rose-500 ring-2 ring-rose-500/15"
              : "border-[#D9E2EC] dark:border-slate-700/80"
          }`}
        />
        {showError && (
          <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
            <AlertCircle className="h-[11px] w-[11px] shrink-0" />
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
      <div className="flex flex-col gap-1 w-full text-left font-sans">
        <label className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        <textarea
          ref={customRef}
          placeholder={placeholder}
          value={value}
          onChange={customChange || (e => handleFieldChange(field, e.target.value))}
          onBlur={() => setManualFormTouched(prev => ({ ...prev, [field]: true }))}
          className={`w-full h-[120px] px-4 py-3 border rounded-[10px] bg-white dark:bg-[#09111E] text-[15px] font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none resize-none transition-colors duration-150 placeholder-[#94A3B8] dark:placeholder-slate-600 hover:border-[#2563EB] ${
            showError
              ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
              : "border-[#D9E2EC] dark:border-slate-700/80 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
          }`}
        />
        {showError && (
          <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
            <AlertCircle className="h-[11px] w-[11px] shrink-0" />
            {error}
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
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-500/20 dark:to-amber-500/10 text-[#1D4ED8] dark:text-[#FDE047] flex items-center justify-center font-bold shrink-0 shadow-2xs border border-amber-300/60 dark:border-amber-500/30">
                  <Users className="h-6 w-6 text-[#1D4ED8] dark:text-[#FDE047]" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex flex-col items-start">
                      <h1 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                        <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Lead</span>
                        <span className="text-[#F4B400] font-extrabold">Management</span>
                      </h1>
                    </div>
                    <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1.5 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                      AI VOICE READY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">Enterprise customer lead pipeline, intelligent scoring & agent routing</p>
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
                    className="h-10 px-4 bg-slate-100 hover:bg-[#0F4FA8] hover:text-white text-slate-700 rounded-2xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-2 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 group"
                    title="Import CSV Leads"
                  >
                    {isSelectingFile ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#0F4FA8] group-hover:text-white" />
                    ) : (
                      <UploadCloud className="h-4 w-4 text-[#0F4FA8] group-hover:text-white transition-colors" />
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
                  className="h-10 px-5 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/25 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Lead</span>
                </button>
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

        {/* FILTER TOOLBAR BAR WITH FULL WIDTH SCROLLABLE STATUS CHIPS */}
        <div className="bg-white dark:bg-[#111827] backdrop-blur-md rounded-[24px] p-5 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/10 space-y-4">
          
          {/* Top Row: Search Input & Dropdowns (Height 52px) */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Bar (Full width / flex-1) */}
            <div className="relative flex-1 w-full">
              <Search className="h-4.5 w-4.5 text-slate-400 dark:text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="AI Search leads by name, phone, email, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[52px] pl-11 pr-20 border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold bg-slate-50/80 dark:bg-[#111827] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] transition-all duration-200 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-2 py-1 border border-slate-200 dark:border-white/10 rounded-md text-[10px] text-slate-400 dark:text-[#64748B] bg-white dark:bg-[#172033] font-mono font-extrabold select-none pointer-events-none">
                  Ctrl K
                </span>
              )}
            </div>

            {/* Filter Dropdowns (Height 52px, Radius 14px, Equal width on mobile) */}
            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
              <CustomSelect
                value={poolFilter}
                onChange={setPoolFilter}
                options={poolFilterOptions}
                placeholder="All Pools"
                className="w-full sm:w-44 shrink-0"
                triggerClassName="h-[52px] rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
              />

              {isManager && (
                <CustomSelect
                  value={agentFilter}
                  onChange={setAgentFilter}
                  options={agentFilterOptions}
                  placeholder="All Agents"
                  className="w-full sm:w-44 shrink-0"
                  triggerClassName="h-[52px] rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
                />
              )}

              <CustomSelect
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={priorityFilterOptions}
                placeholder="All Priorities"
                className="w-full sm:w-44 shrink-0"
                triggerClassName="h-[52px] rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827] dark:text-[#F8FAFC] hover:border-[#2563EB] transition-all duration-200"
              />

              {(searchQuery || statusFilter || poolFilter || agentFilter || priorityFilter || quickChipFilter !== "all") && (
                <button
                  onClick={resetFilters}
                  className="h-[52px] px-4 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[14px] transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <X className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Premium Segmented Status Filter Chips (Height 46px, Radius 999px) */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 relative">
            {showScrollLeft && (
              <button
                onClick={() => handleScrollTabs("left")}
                className="h-9 w-9 rounded-full bg-white dark:bg-[#172033] hover:bg-[#2563EB] hover:text-white text-slate-700 dark:text-[#F8FAFC] transition flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 dark:border-white/10 active:scale-95 z-10"
                title="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={tabsRef}
              onWheel={handleWheelTabs}
              onScroll={checkScrollability}
              className="flex items-center gap-4 overflow-x-auto scroll-smooth w-full py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
                    className={`h-[48px] px-6 rounded-[16px] text-[13.5px] font-semibold whitespace-nowrap transition-all duration-200 ease-in-out cursor-pointer shrink-0 flex items-center gap-3 active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-slate-950 font-semibold shadow-[0_4px_16px_rgba(234,179,8,0.3)] border border-amber-300/40 scale-[1.01]"
                        : "bg-white dark:bg-[#182233] text-slate-700 dark:text-[#F8FAFC] border border-amber-200/80 dark:border-amber-500/20 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/40 hover:-translate-y-0.5 shadow-xs"
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`h-6.5 min-w-[26px] px-2 rounded-full font-bold text-[11px] flex items-center justify-center ${
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
                className="h-9 w-9 rounded-full bg-white dark:bg-[#172033] hover:bg-[#2563EB] hover:text-white text-slate-700 dark:text-[#F8FAFC] transition flex items-center justify-center shrink-0 cursor-pointer shadow-md border border-slate-200 dark:border-white/10 active:scale-95 z-10"
                title="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Enterprise Bulk Action Toolbar (Admin & TL / Supervisor only) */}
          {isManager && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-[16px] p-4 shadow-md flex flex-col lg:flex-row items-center justify-between gap-4 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CustomCheckbox
                    checked={allPaginatedSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    size={22}
                  />
                  <span className="text-slate-500 dark:text-[#94A3B8] text-xs font-bold select-none">Select Page</span>
                </div>

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />

                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition ${selectedLeadIds.length > 0 ? "bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA]" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-[#64748B]"}`}>
                    <CheckSquare className="h-4.5 w-4.5" />
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

              <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-bold">
                <CustomSelect
                  disabled={selectedLeadIds.length === 0 || isBulkAssigning}
                  value={assignAgentId}
                  onChange={setAssignAgentId}
                  options={assignAgentOptions}
                  placeholder="-- Choose Target Agent --"
                  className="w-full sm:w-56 shrink-0 text-xs"
                  triggerClassName="h-[52px] rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#111827]"
                />

                <button
                  disabled={selectedLeadIds.length === 0 || !assignAgentId || isBulkAssigning}
                  onClick={handleBulkAssignAgent}
                  className="h-[52px] px-6 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-xs rounded-[14px] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {isBulkAssigning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-current" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  <span>{isBulkAssigning ? "Assigning..." : "Bulk Assign"}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── ENTERPRISE LEADS TABLE CARD ── */}
        <div className="p-5 bg-white dark:bg-[#111827] rounded-[24px] border border-slate-200/80 dark:border-[rgba(255,255,255,0.06)] shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="overflow-x-auto rounded-[18px] border border-slate-200/60 dark:border-white/5 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#1B2942] dark:to-[#162033] text-slate-500 dark:text-[#94A3B8] font-bold uppercase tracking-[0.1em] text-[12px] border-b border-slate-200/80 dark:border-b-white/8 sticky top-0 z-10">
                <tr className="h-16">
                  {isManager && (
                    <th className="w-16 min-w-[64px] max-w-[64px] text-center sticky left-0 bg-slate-50 dark:bg-[#1B2942] z-10 border-r border-slate-200/50 dark:border-white/10">
                      <div className="flex items-center justify-center">
                        <CustomCheckbox
                          checked={allPaginatedSelected}
                          indeterminate={isIndeterminate}
                          onChange={toggleSelectAll}
                          size={24}
                          isHeader={true}
                        />
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3.5">Lead ID</th>
                  <th className="px-4 py-3.5">Customer &amp; AI Score</th>
                  <th className="px-4 py-3.5">Phone &amp; Location</th>
                  <th className="px-4 py-3.5">Pool</th>
                  <th className="px-4 py-3.5">Assigned Agent</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="h-6 bg-slate-200 dark:bg-[#172033] rounded-xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : paginatedLeads.map((l, idx) => {
                  const leadIdKey = getLeadId(l);
                  const isSelected = selectedLeadIds.includes(leadIdKey) || (l.id ? selectedLeadIds.includes(l.id) : false) || (l._id ? selectedLeadIds.includes(l._id) : false) || (l.lead_id ? selectedLeadIds.includes(l.lead_id) : false);
                  const assignedAgent = l.assigned_agent_id ? users.find(u => u.id === l.assigned_agent_id || u.employee_id === l.assigned_agent_id || (u as any)._id === l.assigned_agent_id) : undefined;
                  const poolObj = pools.find(p => p.id === l.pool_id || p.name === l.pool_id);

                  // Map Pool Badge Colors
                  const poolName = (poolObj?.name || l.pool_id || "").toLowerCase();
                  const poolBadgeClass = poolName.includes("recruitment")
                    ? "bg-blue-50 dark:bg-[#2563EB]/5 text-[#2563EB] dark:text-[#60A5FA] border-blue-200 dark:border-[#2563EB]/35"
                    : poolName.includes("credit") || poolName.includes("card") || poolName.includes("sales")
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-[#FCD34D] border-amber-200 dark:border-amber-500/20"
                    : "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-[#A78BFA] border-purple-200 dark:border-purple-500/20";

                  // Map Priority Badge Colors
                  const priorityVal = (l.priority || "medium").toLowerCase();

                  // Map Status Badge Colors
                  const statusVal = (l.status || "new").toLowerCase();

                  return (
                    <tr
                      key={leadIdKey || idx}
                      onClick={() => toggleSelectLead(leadIdKey)}
                      className={`h-[86px] transition-all duration-250 cursor-pointer border-l-4 hover:translate-y-[-2px] hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)] ${
                        idx % 2 === 0
                          ? "bg-white dark:bg-[#131C2F]"
                          : "bg-slate-50/40 dark:bg-[#162238]"
                      } ${
                        isSelected
                          ? "border-l-[#F4B400] bg-amber-50/50 dark:bg-gradient-to-r dark:from-[#F4B400]/15 dark:to-transparent shadow-[0_4px_24px_rgba(244,180,0,0.15)] select-row-active"
                          : "border-l-transparent hover:border-l-[#F4B400] hover:bg-[#F4B400]/5 dark:hover:bg-[#F4B400]/8"
                      }`}
                      style={isSelected ? { borderTop: "1px solid rgba(250, 204, 21, 0.4)" } : undefined}
                    >
                      {/* Checkbox (Admin & TL / Supervisor only) */}
                      {isManager && (
                        <td className="w-16 min-w-[64px] max-w-[64px] text-center sticky left-0 bg-inherit z-10 border-r border-slate-200/50 dark:border-white/10">
                          <div className="flex items-center justify-center">
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelectLead(leadIdKey)}
                              size={22}
                            />
                          </div>
                        </td>
                      )}

                      {/* Lead ID */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-[#2563EB] dark:text-[#38BDF8] bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200 dark:border-[#38BDF8]/30 px-3 py-1 rounded-full text-[12px] shadow-xs">
                          {l.lead_id}
                        </span>
                      </td>

                      {/* Customer & AI Score (56x56 Avatar) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative group/avatar">
                            <div className="h-[56px] w-[56px] rounded-[18px] bg-gradient-to-tr from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-[#FACC15] flex items-center justify-center font-black text-base shadow-[0_8px_20px_rgba(37,99,235,0.25)] border-t-2 border-l-2 border-r-2 border-b-2 border-l-[#2563EB] border-t-[#2563EB] border-r-[#FACC15] border-b-[#FACC15] shrink-0 hover:scale-106 hover:-translate-y-0.5 transition-all duration-200">
                              {l.name[0]?.toUpperCase() || "C"}
                            </div>
                            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#10B981] border-2 border-white dark:border-[#131C2F] shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrawerLead(l);
                              }}
                              className="font-bold text-[16px] text-slate-900 dark:text-white hover:text-[#2563EB] dark:hover:text-[#60A5FA] cursor-pointer transition truncate"
                            >
                              {l.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="h-2 w-20 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#10B981] to-[#06B6D4] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" style={{ width: `${l.ai_score || 85}%` }} />
                              </div>
                              <span className="text-[12px] font-bold text-emerald-600 dark:text-[#34D399] font-mono shadow-[0_0_8px_rgba(52,211,153,0.15)]">{l.ai_score || 85}% AI</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white text-[15px]">{l.phone}</div>
                        <div className="text-[12px] text-slate-400 dark:text-[#94A3B8]/60 font-medium flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                          <span className="truncate max-w-[150px]">{l.location || (l.extra?.state ? `${l.extra.district ? l.extra.district + ', ' : ''}${l.extra.state}` : '') || "N/A"}</span>
                        </div>
                      </td>

                      {/* Pool Badge */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-xs px-[14px] py-[6px] rounded-[12px] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:to-indigo-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200/80 dark:border-blue-500/30 shadow-2xs hover:scale-102 transition-all duration-200">
                          {poolObj?.name === "credit_card_sales" ? "Sales Team" : (poolObj?.name ? poolObj.name.replace(/_/g, " ") : "No Pool")}
                        </span>
                      </td>

                      {/* Assigned Agent */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          disabled={user?.role === "agent"}
                          value={l.assigned_agent_id || "unassigned"}
                          onChange={(newAgentId) => handleAssignAgentInline(l.id, newAgentId)}
                          options={inlineAgentOptions}
                          triggerClassName="h-[38px] min-w-[130px] rounded-full text-xs font-bold border-slate-200/80 dark:border-white/10 dark:bg-[#111827]"
                          placeholder="Unassigned"
                        />
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold uppercase px-3.5 py-1.5 rounded-full border tracking-wider ${
                          priorityVal === "high"
                            ? "bg-[#EF4444]/12 border-[#EF4444]/35 text-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                            : priorityVal === "low"
                            ? "bg-[#10B981]/12 border-[#10B981]/30 text-[#10B981]"
                            : "bg-[#F59E0B]/12 border-[#F59E0B]/30 text-[#F59E0B]"
                        }`}>
                          {l.priority || "Medium"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 w-fit ${
                          statusVal === "qualified"
                            ? "bg-[#10B981]/15 border-[#10B981]/30 text-[#34D399]"
                            : statusVal === "in_progress" || statusVal === "follow_up"
                            ? "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#FBBF24]"
                            : statusVal === "closed" || statusVal === "not_interested"
                            ? "bg-slate-800/80 border-slate-700 text-[#94A3B8]"
                            : "bg-[#2563EB]/15 border-[#2563EB]/30 text-[#60A5FA]"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            statusVal === "qualified"
                              ? "bg-[#34D399]"
                              : statusVal === "in_progress" || statusVal === "follow_up"
                              ? "bg-[#FBBF24]"
                              : statusVal === "closed" || statusVal === "not_interested"
                              ? "bg-[#94A3B8]"
                              : "bg-[#60A5FA]"
                          } animate-pulse`} />
                          <span>{(l.status || "new").replace("_", " ")}</span>
                        </span>
                      </td>

                      {/* Quick Actions (48x48 rounded-16 buttons with glow) */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerLead(l);
                            }}
                            className="h-12 w-12 flex items-center justify-center rounded-[16px] bg-slate-100/80 dark:bg-white/5 hover:bg-[#2563EB]/10 hover:border-[#2563EB]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#2563EB] border border-slate-200/80 dark:border-white/10 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] transition-all duration-200 active:scale-95 cursor-pointer"
                            title="View Profile Drawer"
                          >
                            <Eye className="h-5 w-5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCallCustomer(l);
                            }}
                            className="h-12 w-12 flex items-center justify-center rounded-[16px] bg-slate-100/80 dark:bg-white/5 hover:bg-[#10B981]/10 hover:border-[#10B981]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#10B981] border border-slate-200/80 dark:border-white/10 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(16,185,129,0.15)] transition-all duration-200 active:scale-95 cursor-pointer"
                            title="Call Customer"
                          >
                            <Phone className="h-5 w-5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Opening WhatsApp chat with ${l.phone}...`, "info");
                            }}
                            className="h-12 w-12 flex items-center justify-center rounded-[16px] bg-slate-100/80 dark:bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-slate-600 dark:text-[#94A3B8] hover:text-cyan-500 border border-slate-200/80 dark:border-white/10 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(6,182,212,0.15)] transition-all duration-200 active:scale-95 cursor-pointer"
                            title="Send WhatsApp Message"
                          >
                            <MessageSquare className="h-5 w-5" />
                          </button>

                          {isManager && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeadToDelete(l);
                              }}
                              className="h-12 w-12 flex items-center justify-center rounded-[16px] bg-slate-100/80 dark:bg-white/5 hover:bg-[#EF4444]/10 hover:border-[#EF4444]/40 text-slate-600 dark:text-[#94A3B8] hover:text-[#EF4444] border border-slate-200/80 dark:border-white/10 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)] transition-all duration-200 active:scale-95 cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-5 w-5" />
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
            className="fixed top-[68px] bottom-0 left-0 md:left-[240px] right-0 z-[9999] flex items-center justify-center p-3 md:p-6 font-sans pointer-events-auto modal-open-container overflow-hidden"
            style={{
              backgroundColor: "rgba(10, 15, 26, 0.85)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)"
            }}
          >
            <style dangerouslySetInnerHTML={{__html: `
              body.lead-modal-active {
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
              initial={{ scale: 0.97, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-[960px] max-h-[calc(100vh-120px)] bg-white dark:bg-[#0F172A] rounded-[20px] shadow-[0_25px_70px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-slate-800 relative flex flex-col overflow-hidden pointer-events-auto z-50 mx-auto my-auto box-border"
            >
              {/* ── Top Brand Bar ── */}
              <div className="h-[3.5px] bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#FACC15] shrink-0" />

              {/* ── FIXED HEADER ── */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0F172A] z-10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <span className="text-[#2563EB] dark:text-[#3B82F6] font-extrabold">Add Customer</span>
                      <span className="text-[#FACC15] font-extrabold">Lead</span>
                    </h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Create a new customer lead record for pipeline routing</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Enterprise Lead Form
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* ── SCROLLABLE FORM BODY ── */}
              <form onSubmit={handleCreateManualLead} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto lm-scroll p-6 bg-slate-50/60 dark:bg-[#0B1120]">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── CARD 1: Profile Information ── */}
                    <div className="bg-white dark:bg-[#131C2F] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Users className="h-4.5 w-4.5 text-[#2563EB]" />
                          <span>Profile Information</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Primary contact identity and enterprise details</p>
                      </div>

                      <div className="space-y-4">
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
                            inputClassName="h-[42px] rounded-lg text-sm"
                          />
                        </div>

                        {renderTextInput("email", "Email ID", "email", "name@company.com", true)}
                        {renderTextInput("company_name", "Company Name", "text", "Company or organization (optional)", false)}
                      </div>
                    </div>

                    {/* ── CARD 2: Location ── */}
                    <div className="bg-white dark:bg-[#131C2F] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <MapPin className="h-4.5 w-4.5 text-amber-500" />
                          <span>Location Details</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Operational address and geographic details</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-1 w-full text-left font-sans">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            Country <span className="text-slate-400 font-normal lowercase">(read-only)</span>
                          </label>
                          <input
                            readOnly
                            value="India"
                            className="w-full h-[42px] border border-slate-200 dark:border-slate-800 rounded-lg px-3 bg-slate-100/70 dark:bg-slate-800/40 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {renderSelectInput("state", "State", stateOptions, "Select State")}
                          {renderSelectInput("district", "District", districtOptions, manualForm.state ? "Select District" : "Select State First", !manualForm.state)}
                        </div>

                        {renderTextInput("pincode", "Pincode", "text", "6-digit pincode", true, 6)}
                        {renderTextareaInput("address", "Address", "Street address, building, local area...", true, 2, addressRef, handleAddressChange)}
                      </div>
                    </div>

                    {/* ── CARD 3: Lead Details ── */}
                    <div className="bg-white dark:bg-[#131C2F] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Target className="h-4.5 w-4.5 text-emerald-500" />
                          <span>Pipeline & Routing</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pipeline classification and agent assignment</p>
                      </div>

                      <div className="space-y-4">
                        {renderSelectInput("pool_id", "Target Pool", manualPoolOptions, "Select Target Pool", user?.role === "agent")}
                        {renderSelectInput("purpose", "Purpose", purposeOptions, "Select Purpose")}
                        {renderSelectInput("source", "Lead Source", sourceOptions, "Select Source")}
                        {renderSelectInput("priority", "Priority", priorityOptions, "Select Priority")}
                        {renderSelectInput("assigned_agent_id", "Assigned Agent", manualAgentOptions, "Select Agent (optional)", user?.role === "agent")}
                      </div>
                    </div>

                    {/* ── CARD 4: Additional Information ── */}
                    <div className="bg-white dark:bg-[#131C2F] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-indigo-500" />
                          <span>Additional Notes</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Contextual notes and call instructions</p>
                      </div>

                      <div className="space-y-4">
                        {renderTextareaInput("notes", "Notes (Optional)", "Add any extra requirements, call scripts, or notes...", false, 5)}
                      </div>
                    </div>

                  </div>{/* /grid */}
                </div>{/* /scroll */}

                {/* ── FIXED FOOTER ── */}
                <div className="h-16 flex items-center justify-end gap-3 px-6 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0F172A] z-10">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="h-10 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingManual || !isManualFormValid}
                    className={`h-10 px-6 text-white text-sm font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      isSubmittingManual || !isManualFormValid
                        ? "bg-blue-600/50 cursor-not-allowed shadow-none"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                    }`}
                  >
                    {isSubmittingManual && <Loader2 className="h-4 w-4 animate-spin" />}
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
