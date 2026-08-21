import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { usePresence } from "../context/PresenceContext";
import { PhoneInput } from "../components/PhoneInput";
import PortalHeader from "../components/PortalHeader";
import RegisterUserModal from "../components/RegisterUserModal";
import ConfirmModal from "../components/ConfirmModal";
import { CustomSelect } from "../components/CustomSelect";
import {
  User,
  Folder,
  Link2,
  Trash2,
  UserPlus,
  UserMinus,
  Zap,
  UserX,
  Send,
  Clock,
  Shield,
  ShieldAlert,
  ArrowRight,
  X,
  Edit,
  Search,
  CheckCircle2,
  PowerOff,
  PhoneCall,
  Coffee,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  Layers,
  Filter,
  RotateCcw,
  Users as UsersIcon,
  Crown,
  Activity,
  Check,
  UserCheck,
  Building2,
  Briefcase
} from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  employee_id: string;
  is_active: boolean;
  phone?: string;
  pool_id?: string;
  supervisor_id?: string;
  department?: string;
  status?: string; // online, offline, busy, break
  language?: string;
  shift?: string;
  skills?: string[];
  voice_model?: string;
  ai_configuration?: Record<string, any>;
};

type PoolRow = {
  id: string;
  name: string;
  description: string;
  is_deleted?: boolean;
};

type TransferRequest = {
  id: string;
  agent_name: string;
  agent_employee_id: string;
  source_pool_id: string;
  target_pool_name: string;
  reason: string;
  status: string;
  remarks?: string;
  created_at: string;
};

// Skeleton Loader Component for Users Page
function UsersSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full font-sans animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[16px] p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="h-12 w-12 rounded-[16px] bg-slate-200 shrink-0" />
          <div className="space-y-2 w-48">
            <div className="h-5 bg-slate-200 rounded-md w-full" />
            <div className="h-3 bg-slate-200 rounded-md w-3/4" />
          </div>
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* KPI Chips Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/80 backdrop-blur-xl p-4 rounded-[16px] border border-slate-200/80 h-24 flex items-center justify-between">
            <div className="space-y-2 w-2/3">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-6 bg-slate-200 rounded w-12" />
            </div>
            <div className="h-9 w-9 bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Table Card Skeleton */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[16px] p-6 border border-slate-200/80 space-y-4">
        <div className="h-10 bg-slate-200 rounded-xl w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Admins" },
  { value: "team_leader", label: "Team Leaders" },
  { value: "agent", label: "Agents" }
];

const POOL_NAME_OPTIONS = [
  { value: "recruitment", label: "Recruitment Pool (HR Hiring)" },
  { value: "credit_card_sales", label: "Credit Card Sales Pool (Banking)" },
  { value: "customer_support", label: "Customer Support Pool (Service)" }
];

const SYSTEM_ROLE_OPTIONS = [
  { value: "agent", label: "Agent (Telecaller)" },
  { value: "team_leader", label: "Supervisor (Team Leader)" },
  { value: "admin", label: "Admin (Full Control)" }
];

const EDIT_DEPARTMENT_OPTIONS = [
  { value: "Sales", label: "Sales & Outreach" },
  { value: "Service", label: "Customer Support" },
  { value: "HR", label: "HR & Recruitment" },
  { value: "Operations", label: "Operations" }
];

const EDIT_SHIFT_OPTIONS = [
  { value: "Day", label: "Day Shift (9 AM - 6 PM)" },
  { value: "Night", label: "Night Shift (9 PM - 6 AM)" },
  { value: "Flexible", label: "Flexible Shift" }
];

export default function Users() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"accounts" | "pools" | "assignments">("accounts");
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newlyCreatedUserId, setNewlyCreatedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State lists
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  
  // User Creation Form State (Admin only)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent",
    phone: "",
    pool_id: "",
    supervisor_id: "",
    department: "",
    language: "English",
    shift: "Day",
    skillsString: "",
    voice_model: "Neural-Male-US",
    ai_config_prompt: "You are a customer assistant...",
  });

  // Pool Creation State (Admin only)
  const [poolName, setPoolName] = useState("recruitment");
  const [poolDesc, setPoolDesc] = useState("");

  // Assignment states (Admin only)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [bulkTargetPoolId, setBulkTargetPoolId] = useState("");
  const [bulkTargetSupervisorId, setBulkTargetSupervisorId] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [supervisedSearch, setSupervisedSearch] = useState("");
  const [availableSearch, setAvailableSearch] = useState("");
  const [supervisedPoolFilter, setSupervisedPoolFilter] = useState("all");
  const [availablePoolFilter, setAvailablePoolFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userPoolFilter, setUserPoolFilter] = useState("all");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "agent",
    department: "",
    pool_id: "",
    phone: "",
    employee_id: "",
    shift: "Day",
  });

  // Transfer Modal State (Supervisor only)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferTargetPoolId, setTransferTargetPoolId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const loadData = useCallback(async () => {
    try {
      const uData = await api.get("/api/users");
      setUsers(uData);
      
      const pData = await api.get("/api/pools");
      setPools(pData);

      if (user?.role === "team_leader") {
        const lData = await api.get("/api/leads");
        setLeads(lData);
        
        const trs = await api.get("/api/users/transfer-requests");
        setTransferRequests(trs);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load management lists.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Custom Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: "danger" | "warning";
    isLoading: boolean;
    onConfirmAction: () => Promise<void>;
  } | null>(null);

  // Deactivate User (Admin only)
  function handleDeactivateUser(userId: string, name: string) {
    const cleanId = (userId || "").trim();
    if (!cleanId) {
      showToast("Cannot deactivate user: Invalid user ID.", "error");
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: "Deactivate User Account",
      message: `Are you sure you want to deactivate ${name}'s account? The user will lose access to the portal until reactivated.`,
      confirmText: "Deactivate Account",
      variant: "warning",
      isLoading: false,
      onConfirmAction: async () => {
        setConfirmModalConfig(prev => prev ? { ...prev, isLoading: true } : null);
        try {
          await api.patch(`/api/users/${cleanId}/deactivate`);
          showToast(`Account for ${name} deactivated.`, "success");
          await loadData();
        } catch (err: any) {
          showToast(err.message || "Deactivation failed.", "error");
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  }

  // Open Edit User Modal
  const openEditModal = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      role: u.role || "agent",
      department: (u as any).department || "Sales",
      pool_id: u.pool_id || "",
      phone: (u as any).phone || "",
      employee_id: u.employee_id || "",
      shift: (u as any).shift || "Day",
    });
  };

  // Submit Edit User Update
  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const targetId = editingUser.id || (editingUser as any)._id || "";
    try {
      await api.put(`/api/users/${targetId}`, editForm);
      showToast(`User ${editForm.name} updated successfully!`, "success");
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update user account.", "error");
    }
  };

  // Delete User Account (Admin only)
  function handleDeleteUser(userId: string, name: string) {
    const cleanId = (userId || "").trim();
    if (!cleanId) {
      showToast("Cannot delete user: Invalid or missing user ID.", "error");
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: "Delete User Account",
      message: `Are you sure you want to permanently DELETE ${name}? This action cannot be undone and will erase all permissions.`,
      confirmText: "Delete User",
      variant: "danger",
      isLoading: false,
      onConfirmAction: async () => {
        setConfirmModalConfig(prev => prev ? { ...prev, isLoading: true } : null);
        try {
          const res = await api.delete(`/api/users/${cleanId}`);
          showToast(res?.message || `User account ${name} deleted successfully!`, "success");
          await loadData();
        } catch (err: any) {
          showToast(err.message || "Failed to delete user account.", "error");
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  }

  // Create Pool (Admin only)
  async function handleCreatePool(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/pools", { name: poolName, description: poolDesc });
      showToast("Call pool created successfully.", "success");
      setPoolDesc("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create pool.", "error");
    }
  }

  // Delete Pool (Admin only)
  function handleDeletePool(poolId: string, poolName: string) {
    setConfirmModalConfig({
      isOpen: true,
      title: "Delete Campaign Pool",
      message: `Are you sure you want to delete the ${poolName.replace(/_/g, " ").toUpperCase()} pool? Mapped agents will be unassigned.`,
      confirmText: "Delete Pool",
      variant: "danger",
      isLoading: false,
      onConfirmAction: async () => {
        setConfirmModalConfig(prev => prev ? { ...prev, isLoading: true } : null);
        try {
          await api.delete(`/api/pools/${poolId}`);
          showToast("Pool deleted successfully.", "success");
          loadData();
        } catch (err: any) {
          showToast(err.message || "Failed to delete pool.", "error");
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  }

  // Map agent to supervisor (Admin only)
  async function handleTransferAgent(agentId: string, supervisorId: string | null) {
    setIsActionLoading(agentId);
    try {
      await api.patch("/api/users/assign-supervisor", {
        supervisor_id: supervisorId || undefined,
        agent_ids: [agentId],
      });
      showToast("Supervisor mapping updated successfully.", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update supervisor mapping.", "error");
    } finally {
      setIsActionLoading(null);
    }
  }

  // Bulk assign pool (Admin only)
  async function handleBulkAssignPool() {
    if (!bulkTargetPoolId) return;
    setIsActionLoading("bulk-pool");
    try {
      await api.patch("/api/users/bulk-assign-pool", {
        pool_id: bulkTargetPoolId,
        user_ids: selectedAgentIds,
      });
      showToast(`Bulk assigned ${selectedAgentIds.length} agents to pool.`, "success");
      setSelectedAgentIds([]);
      setBulkTargetPoolId("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk pool assignment failed.", "error");
    } finally {
      setIsActionLoading(null);
    }
  }

  // Bulk assign supervisor (Admin only)
  async function handleBulkAssignSupervisor() {
    if (!bulkTargetSupervisorId) return;
    setIsActionLoading("bulk-sup");
    try {
      await api.patch("/api/users/assign-supervisor", {
        supervisor_id: bulkTargetSupervisorId,
        agent_ids: selectedAgentIds,
      });
      showToast(`Bulk assigned ${selectedAgentIds.length} agents to supervisor.`, "success");
      setSelectedAgentIds([]);
      setBulkTargetSupervisorId("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk supervisor assignment failed.", "error");
    } finally {
      setIsActionLoading(null);
    }
  }

  // Submit Pool Transfer Request (Supervisor only)
  async function handleCreateTransferRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!transferAgentId || !transferTargetPoolId) return;
    try {
      await api.post("/api/users/transfer-request", {
        agent_id: transferAgentId,
        target_pool_id: transferTargetPoolId,
        reason: transferReason,
      });
      showToast("Submitted agent pool transfer request for Admin approval.", "success");
      setIsTransferModalOpen(false);
      setTransferAgentId("");
      setTransferTargetPoolId("");
      setTransferReason("");
      
      const trs = await api.get("/api/users/transfer-requests");
      setTransferRequests(trs);
    } catch (err: any) {
      showToast(err.message || "Failed to submit request.", "error");
    }
  }

  const toggleSelectAgent = (agentId: string) => {
    setSelectedAgentIds(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const getAgentLeadsCount = (agentId: string) => {
    return leads.filter(l => l.assigned_agent_id === agentId).length;
  };

  const supervisorsList = users.filter(u => u.role === "team_leader" && u.is_active);

  const userPoolFilterOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace("_", " ").toUpperCase()
    }));
    return [
      { value: "all", label: "All Pools" },
      { value: "none", label: "No Pool" },
      ...list
    ];
  }, [pools]);

  const transferTargetPoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace("_", " ").toUpperCase()
    }));
    return [
      { value: "", label: "-- Choose Target Pool --" },
      ...list
    ];
  }, [pools]);

  const supervisedPoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace("_", " ")
    }));
    return [
      { value: "all", label: "All Pools" },
      ...list
    ];
  }, [pools]);

  const availablePoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace("_", " ")
    }));
    return [
      { value: "all", label: "All Pools" },
      ...list
    ];
  }, [pools]);

  const bulkTargetPoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace("_", " ").toUpperCase()
    }));
    return [
      { value: "", label: "-- Target Pool --" },
      ...list
    ];
  }, [pools]);

  const supervisorSelectOptions = useMemo(() => {
    const list = supervisorsList.map(tl => ({
      value: tl.id,
      label: `${tl.name} (${tl.employee_id}) · ${tl.department || "Operations"}`
    }));
    return [
      { value: "", label: "-- Choose Supervisor / Team Lead --" },
      ...list
    ];
  }, [supervisorsList]);

  const bulkSupervisorOptions = useMemo(() => {
    const list = supervisorsList.map(tl => ({
      value: tl.id,
      label: tl.name
    }));
    return [
      { value: "", label: "-- Target Supervisor --" },
      ...list
    ];
  }, [supervisorsList]);

  const editPoolOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace(/_/g, " ").toUpperCase()
    }));
    return [
      { value: "", label: "No Pool Assigned" },
      ...list
    ];
  }, [pools]);
  const selectedSupervisorAgents = users.filter(u => u.role === "agent" && u.supervisor_id === selectedSupervisorId);
  const unassignedAgents = users.filter(u => u.role === "agent" && u.is_active && u.supervisor_id !== selectedSupervisorId);

  const supervisorMetrics = {
    total: selectedSupervisorAgents.length,
    online: selectedSupervisorAgents.filter(a => a.status === "online").length,
    offline: selectedSupervisorAgents.filter(a => !a.status || a.status === "offline").length,
    busy: selectedSupervisorAgents.filter(a => a.status === "busy").length,
    break: selectedSupervisorAgents.filter(a => a.status === "break").length,
  };

  if (loading) {
    return <UsersSkeleton />;
  }

  // --- TEAM LEADER VIEW ---
  if (user?.role === "team_leader") {
    const myAgents = users.filter(u => u.role === "agent");

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 max-w-7xl mx-auto font-sans"
      >
        {/* Hero Section Container (12px Radius, Gradient Fill, Compact Padding) */}
        <div className="bg-gradient-to-r from-white via-slate-50 to-blue-50/20 dark:from-[#111827] dark:via-[#172033] dark:to-[#1B2740] rounded-[12px] p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 relative overflow-hidden transition-all duration-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 relative z-10">
            <div className="flex items-center gap-3">
              {/* Avatar Container */}
              <div className="relative shrink-0 group/avatar">
                <div className="h-10 w-10 rounded-[10px] p-[2px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-2xs shrink-0 cursor-pointer relative">
                  <div className="w-full h-full rounded-[8px] bg-gradient-to-br from-[#2563EB] to-[#1E5EFF] dark:from-[#1E3A8A] dark:to-[#172554] flex items-center justify-center relative overflow-hidden">
                    <User className="h-4 w-4 text-white relative z-10" />
                  </div>
                </div>
                {/* Status Indicator Dot */}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#10B981] border border-white dark:border-[#111827] z-20 animate-pulse" />
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="flex flex-col items-start">
                    <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-1.5">
                      <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Team Agent</span>
                      <span className="text-[#F4B400] font-extrabold">Directory</span>
                    </h1>
                  </div>
                  <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                    {myAgents.length} MAPPED AGENTS
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Monitor active workloads, agent status, and submit transfer requests
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* My Team Members Table (2 columns) */}
          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[12px] p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 lg:col-span-2 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h2 className="text-sm font-black text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Assigned Team Personnel</span>
              </h2>
              <span className="text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30">
                {myAgents.length} Agents
              </span>
            </div>

            <div className="overflow-x-auto rounded-[10px] border border-slate-200/80 dark:border-white/10 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#172033] text-slate-500 dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-white/10 sticky top-0 z-10">
                  <tr className="h-10">
                    <th className="px-3.5 py-2">Employee ID</th>
                    <th className="px-3.5 py-2">Personnel Name</th>
                    <th className="px-3.5 py-2">Pool / Shift</th>
                    <th className="px-3.5 py-2">Live Status</th>
                    <th className="px-3.5 py-2">Workload</th>
                    <th className="px-3.5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {myAgents.map((a, idx) => {
                    const initials = a.name[0]?.toUpperCase() || "A";
                    const poolObj = pools.find(p => p.id === a.pool_id);

                    return (
                      <tr
                        key={a.id}
                        className={`h-[52px] ${
                          idx % 2 === 0
                            ? "bg-white dark:bg-[#111827]"
                            : "bg-slate-50/50 dark:bg-[#151F32]"
                        } hover:bg-amber-50/40 dark:hover:bg-[#1C2740] transition-all duration-150 group`}
                      >
                        <td className="px-3.5 py-2 font-mono font-bold text-[11px]">
                          <span className="bg-slate-100 dark:bg-[#172033] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#94A3B8] px-2 py-0.5 rounded-[6px] font-bold">
                            {a.employee_id}
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="relative shrink-0 group/avatar">
                              <div className="h-8 w-8 rounded-[8px] p-[1.5px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-2xs shrink-0 cursor-pointer relative">
                                <div className="w-full h-full rounded-[6px] bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] flex items-center justify-center relative overflow-hidden">
                                  <span className="text-xs font-bold text-white relative z-10 leading-none">
                                    {initials}
                                  </span>
                                </div>
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#10B981] border border-white dark:border-[#111827] z-20 animate-pulse" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-xs leading-tight group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">{a.name}</span>
                              <span className="text-[10px] font-medium text-slate-400 dark:text-[#64748B]">{a.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-[#818CF8] border border-indigo-200 dark:border-indigo-500/30 uppercase w-fit">
                              <Layers className="h-3 w-3 text-[#2563EB] dark:text-[#60A5FA]" />
                              <span>{poolObj?.name.replace("_", " ").toUpperCase() || "GENERAL"}</span>
                            </span>
                            <span className="text-[9.5px] text-slate-400 dark:text-[#64748B] font-mono font-semibold">{a.shift || "Day Shift"}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-bold border uppercase ${
                              a.status === "online"
                                ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-[#047857] dark:text-[#34D399]"
                                : a.status === "busy"
                                ? "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-[#F87171] animate-pulse"
                                : a.status === "break"
                                ? "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-[#FCD34D]"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-[#94A3B8]"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${a.status === "online" ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                            <span>{a.status || "offline"}</span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="p-[1px] bg-gradient-to-r from-[#2563EB] to-[#FACC15] rounded-full inline-block group/chip shadow-2xs cursor-pointer">
                            <div className="h-7 px-3 rounded-full bg-blue-50/80 dark:bg-[#1E3A8A]/40 backdrop-blur-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono leading-none">{getAgentLeadsCount(a.id)}</span>
                              <span className="text-[10.5px] font-semibold text-slate-600 dark:text-[#94A3B8]/90 leading-none">Leads</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            onClick={() => {
                              setTransferAgentId(a.id);
                              setIsTransferModalOpen(true);
                            }}
                            className="h-[36px] px-3.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs rounded-[8px] font-semibold transition-all duration-150 shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Send className="h-3 w-3" />
                            <span>Request Transfer</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {myAgents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-8 text-center text-slate-400 dark:text-[#64748B] font-medium">
                        No agents assigned to your team portfolio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transfer Requests Tracker & Team summary */}
          <div className="space-y-6 lg:col-span-1">
            {/* Team quick summary */}
            <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-6 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Live Team Telemetry</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-[#172033] border border-slate-200/80 dark:border-white/10 p-5 rounded-[18px] space-y-1 shadow-2xs">
                  <div className="text-3xl font-black text-[#2563EB] dark:text-[#60A5FA] font-mono">{myAgents.length}</div>
                  <div className="text-[10px] text-slate-400 dark:text-[#64748B] font-black uppercase tracking-wider">Assigned</div>
                </div>
                <div className="bg-emerald-50/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 p-5 rounded-[18px] space-y-1 shadow-2xs">
                  <div className="text-3xl font-black text-[#047857] dark:text-[#34D399] font-mono">
                    {myAgents.filter(a => ["online", "busy", "break"].includes(a.status || "")).length}
                  </div>
                  <div className="text-[10px] text-[#047857] dark:text-[#34D399] font-black uppercase tracking-wider">Active Online</div>
                </div>
              </div>
            </div>

            {/* Transfer requests history list */}
            <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-6 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Transfer Requests Tracker</span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                {transferRequests.map(r => (
                  <div key={r.id} className="p-4 bg-slate-50 dark:bg-[#172033] border border-slate-200/80 dark:border-white/10 rounded-[16px] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-xs">{r.agent_name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-[#64748B] font-semibold mt-0.5">Target: {r.target_pool_name}</div>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                          r.status === "approved"
                            ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-[#047857] dark:text-[#34D399]"
                            : r.status === "rejected"
                            ? "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-[#F87171]"
                            : "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-[#FCD34D]"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-[11px] text-slate-600 dark:text-[#94A3B8] font-medium italic bg-white dark:bg-[#111827] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10">
                        "{r.reason}"
                      </p>
                    )}
                    {r.remarks && (
                      <p className="text-[10px] text-rose-700 dark:text-[#F87171] font-bold bg-rose-50 dark:bg-rose-500/15 p-2.5 rounded-xl border border-rose-100 dark:border-rose-500/30">
                        Admin Note: {r.remarks}
                      </p>
                    )}
                  </div>
                ))}
                {transferRequests.length === 0 && (
                  <div className="p-8 text-center text-slate-400 dark:text-[#64748B] space-y-2 border border-dashed border-slate-200 dark:border-white/10 rounded-[18px] bg-slate-50/50 dark:bg-[#172033]/50">
                    <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm font-extrabold text-slate-700 dark:text-[#F8FAFC]">No Transfer Requests</p>
                    <p className="text-xs text-slate-400 dark:text-[#64748B]">No transfer requests available at this time.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Request Pool Transfer Modal Form */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
            <div className="bg-white dark:bg-[#111827] rounded-[20px] max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10">
              {/* Top Brand Accent Bar (Blue & Yellow) */}
              <div className="h-1.5 bg-gradient-to-r from-[#0F4FA8] via-[#2563EB] to-[#FACC15] shrink-0" />

              <div className="p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl p-[2px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-xs shrink-0">
                      <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-[#2563EB] to-[#1E5EFF] dark:from-[#1E3A8A] dark:to-[#172554] flex items-center justify-center">
                        <Send className="h-4.5 w-4.5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-extrabold tracking-tight text-base flex items-center gap-1.5">
                        <span className="text-[#1D4ED8] dark:text-[#3B82F6]">Agent Pool</span>
                        <span className="text-[#F4B400]">Transfer Request</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-medium mt-0.5">Submit request for pool reassignment</p>
                    </div>
                  </div>
                  <button onClick={() => setIsTransferModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 dark:text-[#64748B] hover:text-slate-600 dark:hover:text-white transition cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateTransferRequest} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase mb-1.5">Target Pool</label>
                    <CustomSelect
                      value={transferTargetPoolId}
                      onChange={setTransferTargetPoolId}
                      options={transferTargetPoolOptions}
                      placeholder="-- Choose Target Pool --"
                      triggerClassName="h-[52px] rounded-[14px] text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase mb-1.5">Justification Reason</label>
                    <textarea
                      placeholder="Provide details on why this pool reassignment is required..."
                      value={transferReason}
                      onChange={e => setTransferReason(e.target.value)}
                      className="w-full border border-slate-200 dark:border-white/10 rounded-[14px] p-3 text-xs bg-slate-50 dark:bg-[#172033] h-28 text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                      required
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(false)}
                      className="h-11 px-5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-white/10 transition text-xs font-extrabold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-11 px-6 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white rounded-xl transition text-xs font-extrabold shadow-md shadow-blue-500/25 cursor-pointer active:scale-95"
                    >
                      Submit Request
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // --- ADMIN VIEW (Standard Organization Workspace) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* Portal Header */}
      <PortalHeader
        icon={<User className="h-5 w-5 text-[#0F4FA8]" />}
        title="Organization Workspace"
        subtitle="Manage Pools, Supervisors, and Agents"
        badgeText={`${users.length} PERSONNEL`}
        tabs={[
          { id: "accounts", label: "User Accounts" },
          { id: "pools", label: "Pools (Max 3)" },
          { id: "assignments", label: "Supervisor Mapping" },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as any)}
      />

      {/* Modern KPI Chips Banner (Single row on desktop, 12px radius, 98px height) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-[#111827] backdrop-blur-xl p-3 rounded-[12px] border border-slate-200/80 dark:border-white/10 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between h-[98px]">
          <div>
            <span className="text-[10.5px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-wider block">TOTAL PERSONNEL</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#F8FAFC] font-mono leading-none mt-1.5 block">{users.length}</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center border border-blue-100 dark:border-blue-500/30 shadow-2xs">
            <UsersIcon className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] backdrop-blur-xl p-3 rounded-[12px] border border-slate-200/80 dark:border-white/10 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between h-[98px]">
          <div>
            <span className="text-[10.5px] font-bold text-emerald-600 dark:text-[#34D399] uppercase tracking-wider block">ACTIVE ACCOUNTS</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-[#34D399] font-mono leading-none mt-1.5 block">{users.filter(u => u.is_active).length}</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[#047857] dark:text-[#34D399] flex items-center justify-center border border-emerald-100 dark:border-emerald-500/30 shadow-2xs">
            <UserCheck className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] backdrop-blur-xl p-3 rounded-[12px] border border-slate-200/80 dark:border-white/10 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between h-[98px]">
          <div>
            <span className="text-[10.5px] font-bold text-purple-600 dark:text-[#A78BFA] uppercase tracking-wider block">TEAM LEADERS</span>
            <span className="text-xl sm:text-2xl font-black text-purple-700 dark:text-[#A78BFA] font-mono leading-none mt-1.5 block">{users.filter(u => u.role === "team_leader").length}</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-[#A78BFA] flex items-center justify-center border border-purple-100 dark:border-purple-500/30 shadow-2xs">
            <Crown className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] backdrop-blur-xl p-3 rounded-[12px] border border-slate-200/80 dark:border-white/10 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between h-[98px]">
          <div>
            <span className="text-[10.5px] font-bold text-amber-600 dark:text-[#FCD34D] uppercase tracking-wider block">ACTIVE AGENTS</span>
            <span className="text-xl sm:text-2xl font-black text-amber-700 dark:text-[#FCD34D] font-mono leading-none mt-1.5 block">{users.filter(u => u.role === "agent").length}</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-[#FCD34D] flex items-center justify-center border border-amber-100 dark:border-amber-500/30 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* Tab Contents: User Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          {/* User List Table (Full Width) */}
          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[12px] p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5">
            
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[10px] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center border border-[#2563EB]/20 shadow-2xs">
                  <UsersIcon className="h-4.5 w-4.5 text-[#2563EB] dark:text-[#60A5FA]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-col items-start">
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight flex items-center gap-1.5">
                        <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Registered</span>
                        <span className="text-[#F4B400] font-extrabold">Personnel</span>
                      </h2>
                    </div>
                    <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                      {users.filter(u => u.is_active).length} ACTIVE PERSONNEL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-medium mt-0.5">Manage team directory, roles, pool assignments, and security accounts</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="h-[40px] px-4 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white rounded-[10px] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 active:scale-95"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ Add User</span>
              </button>
            </div>

            {/* Filter & Search Toolbar (40px Height Controls) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search input (40px height) */}
              <div className="relative flex-1 w-full">
                <Search className="h-3.5 w-3.5 text-slate-400 dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, ID..."
                  className="w-full h-[40px] pl-9 pr-8 border border-slate-200 dark:border-white/10 rounded-[10px] text-xs bg-slate-50/80 dark:bg-[#172033] font-semibold text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] transition-all duration-200 focus:outline-none focus:border-[#2563EB] shadow-2xs"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Role & Pool Filters (40px height) */}
              <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap justify-end text-xs font-semibold">
                <CustomSelect
                  value={userRoleFilter}
                  onChange={setUserRoleFilter}
                  options={ROLE_FILTER_OPTIONS}
                  placeholder="All Roles"
                  className="w-full sm:w-36 shrink-0"
                  triggerClassName="h-[40px] rounded-[10px] text-xs font-semibold dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                />

                <CustomSelect
                  value={userPoolFilter}
                  onChange={setUserPoolFilter}
                  options={userPoolFilterOptions}
                  placeholder="All Pools"
                  className="w-full sm:w-36 shrink-0"
                  triggerClassName="h-[40px] rounded-[10px] text-xs font-semibold dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-[10px] border border-slate-200/80 dark:border-white/10 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#172033] text-slate-500 dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-10">
                  <tr className="h-10">
                    <th className="px-3.5 py-2">Employee ID</th>
                    <th className="px-3.5 py-2">Personnel Name</th>
                    <th className="px-3.5 py-2">System Role</th>
                    <th className="px-3.5 py-2">Assigned Pool</th>
                    <th className="px-3.5 py-2">Account Status</th>
                    <th className="px-3.5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {users
                    .filter(u => {
                      const q = userSearch.toLowerCase().trim();
                      const matchesSearch =
                        !q ||
                        u.name.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.employee_id || "").toLowerCase().includes(q);
                      const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
                      const matchesPool =
                        userPoolFilter === "all" ||
                        (userPoolFilter === "none" ? !u.pool_id : u.pool_id === userPoolFilter);
                      return matchesSearch && matchesRole && matchesPool;
                    })
                    .map((u, idx) => {
                      const isNewlyCreated = newlyCreatedUserId === u.id || newlyCreatedUserId === (u as any)._id;
                      const poolObj = pools.find(p => p.id === u.pool_id);
                      const initials = u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

                      return (
                        <tr
                          key={u.id}
                          className={`h-[52px] transition-all duration-150 cursor-pointer ${
                            isNewlyCreated
                              ? "bg-emerald-50/90 dark:bg-emerald-500/20 font-semibold"
                              : idx % 2 === 0 ? "bg-white dark:bg-[#111827]" : "bg-slate-50/50 dark:bg-[#151F32]"
                          } hover:bg-blue-50/60 dark:hover:bg-[#1C2740] group`}
                        >
                          {/* Employee ID */}
                          <td className="px-3.5 py-2">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] bg-slate-100 dark:bg-[#172033] text-slate-600 dark:text-[#94A3B8] px-2 py-0.5 rounded-[6px] border border-slate-200/80 dark:border-white/10">
                              {u.employee_id || "N/A"}
                            </span>
                          </td>

                          {/* Name & Email with Avatar */}
                          <td className="px-3.5 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-[8px] bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 border border-blue-400/30 relative">
                                {initials}
                                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-white dark:border-[#111827]" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs leading-tight flex items-center gap-1">
                                  <span className="text-[#1D4ED8] dark:text-[#3B82F6]">
                                    {u.role === "team_leader" ? "Supervisor" : u.role === "admin" ? "Admin" : "Agent"}
                                  </span>
                                  <span className="text-[#F4B400]">
                                    {u.name}
                                  </span>
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-[#64748B]">{u.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-3.5 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-semibold uppercase border ${
                                u.role === "admin"
                                  ? "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-[#A78BFA] border-purple-200 dark:border-purple-500/30"
                                  : u.role === "team_leader"
                                  ? "bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border-blue-200 dark:border-blue-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#94A3B8] border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {u.role === "team_leader" ? <Crown className="h-3 w-3 text-[#2563EB] dark:text-[#60A5FA]" /> : <Shield className="h-3 w-3" />}
                              <span>{u.role === "team_leader" ? "TL" : (u.role || "agent").replace(/_/g, " ")}</span>
                            </span>
                          </td>

                          {/* Pool Pill */}
                          <td className="px-3.5 py-2">
                            {poolObj ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200/80 dark:border-blue-500/30">
                                <Layers className="h-3 w-3 shrink-0 text-[#2563EB] dark:text-[#60A5FA]" />
                                <span>{poolObj.name === "credit_card_sales" ? "Sales Team" : poolObj.name.replace(/_/g, " ")}</span>
                              </span>
                            ) : (
                              <span className="text-[10.5px] font-medium text-slate-400 dark:text-[#64748B] italic">No Pool Assigned</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3.5 py-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[10.5px] font-semibold border ${
                                u.is_active
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-[#047857] dark:text-[#34D399]"
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-[#94A3B8]"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                              <span>{u.is_active ? "Active" : "Suspended"}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3.5 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={() => openEditModal(u)}
                                className="h-8 px-3 bg-slate-100 dark:bg-[#172033] hover:bg-blue-50 dark:hover:bg-blue-500/20 text-slate-700 dark:text-[#F8FAFC] hover:text-[#2563EB] dark:hover:text-[#60A5FA] border border-slate-200 dark:border-white/10 text-xs rounded-[8px] font-semibold transition cursor-pointer active:scale-95 flex items-center gap-1"
                                title="Edit User Account"
                              >
                                <Edit className="h-3 w-3" />
                                <span>Edit</span>
                              </button>

                              {/* Deactivate Button */}
                              {u.is_active && (
                                <button
                                  onClick={() => handleDeactivateUser(u.id || (u as any)._id || "", u.name)}
                                  className="h-8 px-3 bg-slate-100 dark:bg-[#172033] hover:bg-amber-50 dark:hover:bg-amber-500/20 text-slate-700 dark:text-[#F8FAFC] hover:text-amber-600 dark:hover:text-[#FCD34D] border border-slate-200 dark:border-white/10 text-xs rounded-[8px] font-semibold transition cursor-pointer active:scale-95"
                                  title="Deactivate Account"
                                >
                                  Deactivate
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteUser(u.id || (u as any)._id || "", u.name)}
                                className="h-8 w-8 bg-slate-100 dark:bg-[#172033] hover:bg-rose-50 dark:hover:bg-rose-500/20 text-rose-500 hover:text-rose-700 dark:hover:text-[#F87171] border border-slate-200 dark:border-white/10 text-xs rounded-[8px] font-semibold transition cursor-pointer active:scale-95 flex items-center justify-center"
                                title="Delete User Account"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-8 text-center text-slate-400 font-medium">
                        No registered personnel accounts found. Click "+ Add User" to register team members.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: Pool Management */}
      {activeTab === "pools" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-6 shadow-md border border-slate-200/80 dark:border-white/10 h-fit lg:col-span-1 space-y-4">
            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
              <Folder className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
              <span className="text-[#1D4ED8] dark:text-[#3B82F6]">Create </span>
              <span className="text-[#F4B400]">Call Pool</span>
            </h2>
            <form onSubmit={handleCreatePool} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase mb-1">Permitted Pool Name</label>
                <CustomSelect
                  value={poolName}
                  onChange={setPoolName}
                  options={POOL_NAME_OPTIONS}
                  placeholder="Select Pool Type"
                  triggerClassName="h-[48px] rounded-xl text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase mb-1">Description</label>
                <textarea
                  placeholder="Pool description details..."
                  value={poolDesc}
                  onChange={e => setPoolDesc(e.target.value)}
                  className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#172033] h-24 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs py-3 rounded-xl font-extrabold transition shadow-md shadow-blue-500/25 cursor-pointer active:scale-95"
              >
                Create Pool
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-6 shadow-md border border-slate-200/80 dark:border-white/10 lg:col-span-2 space-y-4">
            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
              <span className="text-[#1D4ED8] dark:text-[#3B82F6]">Active </span>
              <span className="text-[#F4B400]">System Pools</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pools.map(p => (
                <div key={p.id} className="p-5 border border-slate-200/80 dark:border-white/10 rounded-[18px] bg-slate-50 dark:bg-[#172033] flex justify-between items-start shadow-xs hover:-translate-y-0.5 hover:border-blue-500/40 transition duration-200">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-[#F8FAFC] text-base capitalize">{p.name.replace("_", " ")}</h4>
                    <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1.5 leading-relaxed font-medium">{p.description}</p>
                    <span className="mt-3 inline-block text-[10px] text-[#2563EB] dark:text-[#60A5FA] font-black tracking-wide font-mono uppercase bg-blue-50 dark:bg-blue-500/15 px-3 py-1 rounded-md border border-blue-100 dark:border-blue-500/30">
                      ID: {p.id}
                    </span>
                  </div>
                  <button onClick={() => handleDeletePool(p.id, p.name)} className="text-slate-400 dark:text-[#64748B] hover:text-rose-600 dark:hover:text-[#F87171] p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 transition cursor-pointer">
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))}
              {pools.length === 0 && (
                <p className="text-slate-400 dark:text-[#64748B] text-center py-8 font-medium col-span-2">No active pools registered.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: Supervisor mapping */}
      {activeTab === "assignments" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 font-sans"
        >
          {/* 1. COMPACT PAGE HEADER & LIVE KPI GRID */}
          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-5 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center font-black shadow-md shrink-0 border border-blue-400/30">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight">Supervisor Mapping Console</h2>
                    <span className="text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-500/15 text-[#047857] dark:text-[#34D399] border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      LIVE TELEMETRY
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-semibold mt-0.5">Hierarchy mapping, agent workload allocation, and team leader monitoring</p>
                </div>
              </div>

              <button
                onClick={loadData}
                className="h-10 px-4 bg-slate-100 dark:bg-[#172033] hover:bg-[#2563EB] hover:text-white text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Sync Workload</span>
              </button>
            </div>

            {/* Compact Live KPI Statistic Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="bg-slate-50 dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-xs hover:-translate-y-0.5 transition-all duration-200">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider block">ACTIVE SUPERVISORS</span>
                  <span className="text-xl font-black text-slate-900 dark:text-[#F8FAFC] font-mono mt-0.5 block">{supervisorsList.length} TLs</span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-[#A78BFA] flex items-center justify-center border border-purple-100 dark:border-purple-500/30">
                  <Crown className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-xs hover:-translate-y-0.5 transition-all duration-200">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider block">TOTAL AGENTS</span>
                  <span className="text-xl font-black text-slate-900 dark:text-[#F8FAFC] font-mono mt-0.5 block">{users.filter(u => u.role === "agent").length} Personnel</span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center border border-blue-100 dark:border-blue-500/30">
                  <Layers className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-xs hover:-translate-y-0.5 transition-all duration-200">
                <div>
                  <span className="text-[10px] font-extrabold text-[#047857] dark:text-[#34D399] uppercase tracking-wider block">MAPPED AGENTS</span>
                  <span className="text-xl font-black text-[#047857] dark:text-[#34D399] font-mono mt-0.5 block">
                    {users.filter(u => u.role === "agent" && u.supervisor_id).length} Mapped
                  </span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-[#047857] dark:text-[#34D399] flex items-center justify-center border border-emerald-100 dark:border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-xs hover:-translate-y-0.5 transition-all duration-200">
                <div>
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-[#FCD34D] uppercase tracking-wider block">UNASSIGNED AGENTS</span>
                  <span className="text-xl font-black text-amber-700 dark:text-[#FCD34D] font-mono mt-0.5 block">
                    {unassignedAgents.length} Available
                  </span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-[#FCD34D] flex items-center justify-center border border-amber-100 dark:border-amber-500/30">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. SUPERVISOR SELECTOR & KPI CARDS */}
          <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-5 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 border-b border-slate-100 dark:border-white/10 pb-4">
              
              {/* Supervisor Dropdown */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-extrabold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                  <span>Select Active Supervisor / Team Leader</span>
                </label>

                <div className="relative">
                  <CustomSelect
                    value={selectedSupervisorId}
                    onChange={setSelectedSupervisorId}
                    options={supervisorSelectOptions}
                    placeholder="-- Choose Supervisor / Team Lead --"
                    triggerClassName="h-[52px] rounded-[14px] text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Selected Supervisor Profile Badge */}
              {selectedSupervisorId && (() => {
                const curSup = supervisorsList.find(s => s.id === selectedSupervisorId);
                if (!curSup) return null;
                return (
                  <div className="bg-slate-50 dark:bg-[#172033] p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center gap-3.5 min-w-[280px]">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 border border-blue-400/30">
                      {curSup.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-xs truncate">{curSup.name}</span>
                        <span className="bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200 dark:border-blue-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                          {curSup.employee_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-semibold truncate mt-0.5">
                        {curSup.department || "General Operations"} · Shift Team Lead
                      </p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs animate-pulse" title="Online Supervisor" />
                  </div>
                );
              })()}
            </div>

            {/* KPI Metrics Grid */}
            {selectedSupervisorId && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                
                {/* Total Agents KPI */}
                <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 shadow-xs hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">TOTAL AGENTS</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center">
                      <UsersIcon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-slate-900 dark:text-[#F8FAFC] leading-none">{supervisorMetrics.total}</span>
                    <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-500/15 px-2 py-0.5 rounded-full">100%</span>
                  </div>
                </div>

                {/* Online KPI */}
                <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[16px] border border-emerald-200/80 dark:border-emerald-500/30 shadow-xs hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-[#047857] dark:text-[#34D399] uppercase tracking-wider">ONLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[#047857] dark:text-[#34D399] flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-[#047857] dark:text-[#34D399] leading-none">{supervisorMetrics.online}</span>
                    <span className="text-[10px] font-bold text-[#047857] dark:text-[#34D399] bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.online / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Offline KPI */}
                <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[16px] border border-slate-200/80 dark:border-white/10 shadow-xs hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">OFFLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#94A3B8] flex items-center justify-center">
                      <PowerOff className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-slate-700 dark:text-[#94A3B8] leading-none">{supervisorMetrics.offline}</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.offline / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Busy KPI */}
                <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[16px] border border-rose-200/80 dark:border-rose-500/30 shadow-xs hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-rose-600 dark:text-[#F87171] uppercase tracking-wider">ON CALL / BUSY</span>
                    <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-[#F87171] flex items-center justify-center">
                      <PhoneCall className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-rose-700 dark:text-[#F87171] leading-none">{supervisorMetrics.busy}</span>
                    <span className="text-[10px] font-bold text-rose-700 dark:text-[#F87171] bg-rose-50 dark:bg-rose-500/15 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                </div>

                {/* Break KPI */}
                <div className="bg-white dark:bg-[#172033] p-3.5 rounded-[16px] border border-amber-200/80 dark:border-amber-500/30 shadow-xs hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-[#FCD34D] uppercase tracking-wider">ON BREAK</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-[#FCD34D] flex items-center justify-center">
                      <Coffee className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-amber-700 dark:text-[#FCD34D] leading-none">{supervisorMetrics.break}</span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">Paused</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 3. DUAL COLUMN ENTERPRISE DATA TABLES / CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* COLUMN 1: SUPERVISED AGENTS */}
            <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-5 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4 flex flex-col">
              
              {/* Header Title & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center font-bold border border-blue-200 dark:border-blue-500/30">
                    <UsersIcon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-sm tracking-tight">Supervised Agents</h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-semibold">Agents currently assigned to selected TL</p>
                  </div>
                </div>

                {selectedSupervisorId && (
                  <span className="bg-blue-50 dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200 dark:border-blue-500/30 text-xs font-mono font-extrabold px-3 py-1 rounded-full shrink-0">
                    {selectedSupervisorAgents.length} Mapped
                  </span>
                )}
              </div>

              {/* Search & Filter Bar (52px height) */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 dark:text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search supervised agents..."
                    value={supervisedSearch}
                    onChange={e => setSupervisedSearch(e.target.value)}
                    className="w-full h-[52px] pl-10 pr-8 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                  {supervisedSearch && (
                    <button onClick={() => setSupervisedSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <CustomSelect
                  value={supervisedPoolFilter}
                  onChange={setSupervisedPoolFilter}
                  options={supervisedPoolOptions}
                  placeholder="All Pools"
                  className="w-36"
                  triggerClassName="h-[52px] rounded-[14px] text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                />
              </div>

              {/* Agents List */}
              <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1 flex-1">
                {selectedSupervisorAgents
                  .filter(agent => {
                    const q = supervisedSearch.toLowerCase();
                    const matchesQuery = agent.name.toLowerCase().includes(q) || agent.employee_id.toLowerCase().includes(q);
                    const matchesPool = supervisedPoolFilter === "all" || agent.pool_id === supervisedPoolFilter;
                    return matchesQuery && matchesPool;
                  })
                  .map(agent => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    const poolObj = pools.find(p => p.id === agent.pool_id);
                    const isLoading = isActionLoading === agent.id;

                    return (
                      <motion.div
                        key={agent.id}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.15 }}
                        className={`p-3.5 rounded-[16px] border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 shadow-xs"
                            : "bg-slate-50 dark:bg-[#172033] hover:bg-white dark:hover:bg-[#1C2740] border-slate-200/80 dark:border-white/10 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] border-slate-300 dark:border-slate-700 rounded cursor-pointer shrink-0"
                          />

                          <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white font-black text-xs flex items-center justify-center shadow-xs border border-blue-400/30">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#111827] ${
                                agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-rose-500" : "bg-slate-400"
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-xs truncate">{agent.name}</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-200/70 dark:bg-[#111827] text-slate-700 dark:text-[#94A3B8] px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                                {agent.employee_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 px-2 py-0.5 rounded-full">
                                {poolObj?.name.replace("_", " ").toUpperCase() || "NO POOL"}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400 dark:text-[#64748B]">
                                {agent.shift || "Day Shift"} · {agent.language || "English"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={isLoading}
                          onClick={() => handleTransferAgent(agent.id, null)}
                          className="h-9 px-3.5 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-[#F87171] border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Remove TL mapping"
                        >
                          {isLoading ? (
                            <Clock className="h-3.5 w-3.5 animate-spin text-rose-600" />
                          ) : (
                            <UserX className="h-3.5 w-3.5 text-rose-600 dark:text-[#F87171]" />
                          )}
                          <span>Unmap</span>
                        </button>
                      </motion.div>
                    );
                  })}

                {(!selectedSupervisorId || selectedSupervisorAgents.length === 0) && (
                  <div className="p-8 text-center text-slate-400 dark:text-[#64748B] space-y-2">
                    <UsersIcon className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-[#F8FAFC]">No Supervised Agents Mapped</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#64748B] font-medium">Select a supervisor from above or map available agents from the right panel.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: OTHER AGENTS (AVAILABLE FOR ASSIGNMENT) */}
            <div className="bg-white dark:bg-[#111827] backdrop-blur-xl rounded-[20px] p-5 shadow-md border border-slate-200/80 dark:border-white/10 space-y-4 flex flex-col">
              
              {/* Header Title & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-[#FCD34D] flex items-center justify-center font-bold border border-amber-200 dark:border-amber-500/30">
                    <UserPlus className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-sm tracking-tight">Available Personnel</h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-semibold">Agents available for mapping or pool allocation</p>
                  </div>
                </div>

                <span className="bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-[#FCD34D] border border-amber-200 dark:border-amber-500/30 text-xs font-mono font-extrabold px-3 py-1 rounded-full shrink-0">
                  {unassignedAgents.length} Available
                </span>
              </div>

              {/* Search & Filter Bar (52px height) */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 dark:text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search available agents..."
                    value={availableSearch}
                    onChange={e => setAvailableSearch(e.target.value)}
                    className="w-full h-[52px] pl-10 pr-8 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                  {availableSearch && (
                    <button onClick={() => setAvailableSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <CustomSelect
                  value={availablePoolFilter}
                  onChange={setAvailablePoolFilter}
                  options={availablePoolOptions}
                  placeholder="All Pools"
                  className="w-36"
                  triggerClassName="h-[52px] rounded-[14px] text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                />
              </div>

              {/* Available Agents List */}
              <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1 flex-1">
                {unassignedAgents
                  .filter(agent => {
                    const q = availableSearch.toLowerCase();
                    const matchesQuery = agent.name.toLowerCase().includes(q) || agent.employee_id.toLowerCase().includes(q);
                    const matchesPool = availablePoolFilter === "all" || agent.pool_id === availablePoolFilter;
                    return matchesQuery && matchesPool;
                  })
                  .map(agent => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    const poolObj = pools.find(p => p.id === agent.pool_id);
                    const isLoading = isActionLoading === agent.id;

                    return (
                      <motion.div
                        key={agent.id}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.15 }}
                        className={`p-3.5 rounded-[16px] border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 shadow-xs"
                            : "bg-slate-50 dark:bg-[#172033] hover:bg-white dark:hover:bg-[#1C2740] border-slate-200/80 dark:border-white/10 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] border-slate-300 dark:border-slate-700 rounded cursor-pointer shrink-0"
                          />

                          <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-xs border border-white/10">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#111827] ${
                                agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-rose-500" : "bg-slate-400"
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-xs truncate">{agent.name}</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-200/70 dark:bg-[#111827] text-slate-700 dark:text-[#94A3B8] px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                                {agent.employee_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 px-2 py-0.5 rounded-full">
                                {poolObj?.name.replace("_", " ").toUpperCase() || "NO POOL"}
                              </span>
                              {agent.supervisor_id && (
                                <span className="text-[10px] font-medium text-amber-700 dark:text-[#FCD34D] bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-full">
                                  Mapped TL: {supervisorsList.find(s => s.id === agent.supervisor_id)?.name || agent.supervisor_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {selectedSupervisorId && (
                          <button
                            disabled={isLoading}
                            onClick={() => handleTransferAgent(agent.id, selectedSupervisorId)}
                            className="h-9 px-3.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                          >
                            {isLoading ? (
                              <Clock className="h-3.5 w-3.5 animate-spin text-white" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5 text-white" />
                            )}
                            <span>Assign TL</span>
                          </button>
                        )}
                      </motion.div>
                    );
                  })}

                {unassignedAgents.length === 0 && (
                  <div className="p-8 text-center text-slate-400 dark:text-[#64748B] space-y-2">
                    <UserPlus className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-[#F8FAFC]">No Available Personnel</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#64748B] font-medium">All active agents are currently assigned to supervisors.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* 4. BULK SELECTION ACTION CONTROL BAR */}
          {selectedAgentIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111827] text-white p-4 rounded-[20px] shadow-2xl border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                  {selectedAgentIds.length}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white tracking-tight">{selectedAgentIds.length} Agent(s) Selected</h4>
                  <p className="text-xs text-slate-400 font-medium">Perform bulk pool mapping or supervisor re-assignment</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Bulk Pool Select */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <CustomSelect
                    value={bulkTargetPoolId}
                    onChange={setBulkTargetPoolId}
                    options={bulkTargetPoolOptions}
                    placeholder="-- Target Pool --"
                    className="w-full sm:w-44"
                    triggerClassName="h-[46px] rounded-xl text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                  />
                  <button
                    disabled={!bulkTargetPoolId || isActionLoading === "bulk-pool"}
                    onClick={handleBulkAssignPool}
                    className="h-[46px] px-4 bg-[#2563EB] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isActionLoading === "bulk-pool" ? <Clock className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-300" />}
                    <span>Assign Pool</span>
                  </button>
                </div>

                {/* Bulk Supervisor Select */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <CustomSelect
                    value={bulkTargetSupervisorId}
                    onChange={setBulkTargetSupervisorId}
                    options={bulkSupervisorOptions}
                    placeholder="-- Target Supervisor --"
                    className="w-full sm:w-44"
                    triggerClassName="h-[46px] rounded-xl text-xs dark:bg-[#172033] dark:text-[#F8FAFC] dark:border-white/10 hover:border-[#2563EB]"
                  />
                  <button
                    disabled={!bulkTargetSupervisorId || isActionLoading === "bulk-sup"}
                    onClick={handleBulkAssignSupervisor}
                    className="h-[46px] px-4 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isActionLoading === "bulk-sup" ? <Clock className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-white" />}
                    <span>Map Supervisor</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedAgentIds([])}
                  className="h-[46px] px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </motion.div>
          )}

        </motion.div>
      )}

      {/* Register User Modal */}
      <RegisterUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onSuccess={(newUser) => {
          setNewlyCreatedUserId(newUser?.id || newUser?._id || null);
          loadData();
          setTimeout(() => setNewlyCreatedUserId(null), 4000);
        }}
        pools={pools}
        supervisors={supervisorsList}
      />

      {/* Edit User Modal (Portal) */}
      {editingUser && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300">
            {/* Top Brand Gradient Bar (Blue & Yellow) */}
            <div className="h-1.5 bg-gradient-to-r from-[#0F4FA8] via-[#2563EB] to-[#FACC15] shrink-0" />

            {/* Header */}
            <div className="px-7 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0F172A] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                {/* Dual Blue to Yellow Gradient Avatar Icon Container */}
                <div className="h-12 w-12 rounded-[16px] p-[2.5px] bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#FACC15] shadow-[0_4px_14px_rgba(37,99,235,0.35)] shrink-0">
                  <div className="w-full h-full rounded-[13px] bg-gradient-to-br from-[#2563EB] to-[#1E5EFF] dark:from-[#1E3A8A] dark:to-[#172554] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-[13px]" />
                    <Edit className="h-5 w-5 text-white relative z-10 drop-shadow-xs" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-extrabold tracking-tight leading-tight flex items-center gap-1.5 -tracking-[0.5px]">
                      <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Edit Personnel</span>
                      <span className="text-[#F4B400] font-extrabold">Account</span>
                    </h2>
                    <span className="text-[10px] font-black bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-400 border border-[#2563EB]/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      Forge CRM
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1 truncate">
                    Update account details and permissions for <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">{editingUser.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleUpdateUserSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:bg-white dark:focus:bg-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:bg-white dark:focus:bg-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
                  />
                </div>

                {/* System Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">System Role</label>
                  <CustomSelect
                    value={editForm.role}
                    onChange={val => setEditForm({ ...editForm, role: val })}
                    options={SYSTEM_ROLE_OPTIONS}
                    placeholder="Select Role"
                    triggerClassName="h-10 text-xs rounded-xl dark:bg-[#172033] dark:text-white dark:border-slate-700"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Department</label>
                  <CustomSelect
                    value={editForm.department}
                    onChange={val => setEditForm({ ...editForm, department: val })}
                    options={EDIT_DEPARTMENT_OPTIONS}
                    placeholder="Select Department"
                    triggerClassName="h-10 text-xs rounded-xl dark:bg-[#172033] dark:text-white dark:border-slate-700"
                  />
                </div>

                {/* Pool Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Pool Mapping</label>
                  <CustomSelect
                    value={editForm.pool_id}
                    onChange={val => setEditForm({ ...editForm, pool_id: val })}
                    options={editPoolOptions}
                    placeholder="Select Pool"
                    triggerClassName="h-10 text-xs rounded-xl dark:bg-[#172033] dark:text-white dark:border-slate-700"
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Employee ID</label>
                  <input
                    type="text"
                    value={editForm.employee_id}
                    onChange={e => setEditForm({ ...editForm, employee_id: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:bg-white dark:focus:bg-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                </div>

                {/* Phone Number */}
                <PhoneInput
                  value={editForm.phone}
                  onChange={(fullVal) => setEditForm({ ...editForm, phone: fullVal })}
                  label="Phone Number"
                />

                {/* Shift Schedule */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Shift Schedule</label>
                  <CustomSelect
                    value={editForm.shift}
                    onChange={val => setEditForm({ ...editForm, shift: val })}
                    options={EDIT_SHIFT_OPTIONS}
                    placeholder="Select Shift"
                    triggerClassName="h-10 text-xs rounded-xl dark:bg-[#172033] dark:text-white dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/25 transition cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Enterprise Confirmation Modal */}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          variant={confirmModalConfig.variant}
          isLoading={confirmModalConfig.isLoading}
          onConfirm={confirmModalConfig.onConfirmAction}
          onClose={() => setConfirmModalConfig(null)}
        />
      )}
    </motion.div>
  );
}
