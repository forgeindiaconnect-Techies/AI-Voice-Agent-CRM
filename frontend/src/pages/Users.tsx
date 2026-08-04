import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { PhoneInput } from "../components/PhoneInput";
import PortalHeader from "../components/PortalHeader";
import RegisterUserModal from "../components/RegisterUserModal";
import ConfirmModal from "../components/ConfirmModal";
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
        {/* Portal Header */}
        <PortalHeader
          icon={<User className="h-5 w-5 text-[#0F4FA8]" />}
          title="Team Agent Directory"
          subtitle="Monitor active workloads, agent status, and submit transfer requests"
          badgeText={`${myAgents.length} MAPPED AGENTS`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Team Members Table (2 columns) */}
          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UsersIcon className="h-4.5 w-4.5 text-[#0F4FA8]" />
                <span>Assigned Team Personnel</span>
              </h2>
              <span className="text-xs font-mono font-extrabold bg-blue-50 text-[#0F4FA8] px-2.5 py-0.5 rounded-full border border-blue-200">
                {myAgents.length} Agents
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Employee ID</th>
                    <th className="px-4 py-3.5">Personnel Name</th>
                    <th className="px-4 py-3.5">Pool / Shift</th>
                    <th className="px-4 py-3.5">Live Status</th>
                    <th className="px-4 py-3.5">Workload</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myAgents.map((a, idx) => (
                    <tr
                      key={a.id}
                      className={`transition-all duration-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      } hover:bg-blue-50/40`}
                    >
                      <td className="px-4 py-4 font-mono font-bold text-xs text-slate-700">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {a.employee_id}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-xs shadow-2xs shrink-0 border border-blue-400/30">
                            {a.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{a.name}</div>
                            <div className="text-[11px] text-slate-400 font-medium">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0F4FA8] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                          <Layers className="h-3 w-3" />
                          <span>{pools.find(p => p.id === a.pool_id)?.name.replace("_", " ").toUpperCase() || "GENERAL"}</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1 font-mono">{a.shift || "Day Shift"}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                            a.status === "online"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                              : a.status === "busy"
                              ? "bg-rose-50 border border-rose-200 text-rose-700 animate-pulse"
                              : a.status === "break"
                              ? "bg-amber-50 border border-amber-200 text-amber-700"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${a.status === "online" ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                          <span>{a.status || "offline"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono font-black text-slate-800 text-xs">
                          {getAgentLeadsCount(a.id)} leads
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            setTransferAgentId(a.id);
                            setIsTransferModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#0F4FA8] text-slate-700 hover:text-white border border-slate-200 hover:border-[#0F4FA8] text-xs rounded-xl font-extrabold transition shadow-2xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Request Transfer</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {myAgents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
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
            <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0F4FA8]" />
                <span>Live Team Telemetry</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                  <div className="text-xl font-black text-[#0F4FA8] font-mono">{myAgents.length}</div>
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">Assigned</div>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl">
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {myAgents.filter(a => ["online", "busy", "break"].includes(a.status || "")).length}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-extrabold uppercase mt-0.5">Active Online</div>
                </div>
              </div>
            </div>

            {/* Transfer requests history list */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#0F4FA8]" />
                <span>Transfer Requests Tracker</span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                {transferRequests.map(r => (
                  <div key={r.id} className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs">{r.agent_name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Target: {r.target_pool_name}</div>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          r.status === "approved"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : r.status === "rejected"
                            ? "bg-rose-50 border border-rose-200 text-rose-700"
                            : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-[11px] text-slate-600 font-medium italic bg-white p-2 rounded-lg border border-slate-200/60">
                        "{r.reason}"
                      </p>
                    )}
                    {r.remarks && (
                      <p className="text-[10px] text-rose-700 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                        Admin Note: {r.remarks}
                      </p>
                    )}
                  </div>
                ))}
                {transferRequests.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 font-medium">No transfer requests submitted yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Request Pool Transfer Modal Form */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 font-sans">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Send className="h-5 w-5 text-[#0F4FA8]" />
                  <span>Agent Pool Transfer Request</span>
                </h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateTransferRequest} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Target Pool</label>
                  <select
                    value={transferTargetPoolId}
                    onChange={e => setTransferTargetPoolId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-bold text-slate-800"
                    required
                  >
                    <option value="">-- Choose Target Pool --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Justification Reason</label>
                  <textarea
                    placeholder="Provide details on why this pool reassignment is required..."
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-28 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] text-slate-800"
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-xs font-extrabold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0F4FA8] hover:bg-blue-800 text-white rounded-xl transition text-xs font-extrabold shadow-md cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
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

      {/* Modern KPI Chips Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">TOTAL PERSONNEL</span>
            <span className="text-2xl font-black text-slate-900 font-mono leading-none mt-1 block">{users.length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center border border-blue-100">
            <UsersIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">ACTIVE ACCOUNTS</span>
            <span className="text-2xl font-black text-emerald-700 font-mono leading-none mt-1 block">{users.filter(u => u.is_active).length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider block">TEAM LEADERS</span>
            <span className="text-2xl font-black text-purple-700 font-mono leading-none mt-1 block">{users.filter(u => u.role === "team_leader").length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Crown className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">ACTIVE AGENTS</span>
            <span className="text-2xl font-black text-amber-700 font-mono leading-none mt-1 block">{users.filter(u => u.role === "agent").length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tab Contents: User Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* User List Table (Full Width) */}
          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 space-y-5">
            
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center border border-blue-100 shadow-2xs">
                  <UsersIcon className="h-5 w-5 text-[#0F4FA8]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Registered Personnel</h2>
                    <span className="text-[11px] font-extrabold bg-[#0F4FA8]/10 text-[#0F4FA8] border border-[#0F4FA8]/20 px-3 py-0.5 rounded-full">
                      {users.filter(u => u.is_active).length} Active Personnel
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Manage team directory, roles, pool assignments, and security accounts</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="h-10 px-5 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-md hover:shadow-blue-500/25 cursor-pointer shrink-0 active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Add User</span>
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              {/* Search input */}
              <div className="relative w-full sm:w-80">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, ID..."
                  className="w-full h-10 pl-10 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] transition"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Role & Pool Filters */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="team_leader">Team Leaders</option>
                  <option value="agent">Agents</option>
                </select>

                <select
                  value={userPoolFilter}
                  onChange={e => setUserPoolFilter(e.target.value)}
                  className="h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
                >
                  <option value="all">All Pools</option>
                  <option value="none">No Pool</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace("_", " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Employee ID</th>
                    <th className="px-4 py-3.5">Personnel Name</th>
                    <th className="px-4 py-3.5">System Role</th>
                    <th className="px-4 py-3.5">Assigned Pool</th>
                    <th className="px-4 py-3.5">Account Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                          className={`transition-all duration-200 ${
                            isNewlyCreated
                              ? "bg-emerald-50/90 font-semibold shadow-2xs"
                              : idx % 2 === 0
                              ? "bg-white"
                              : "bg-slate-50/40"
                          } hover:bg-blue-50/40`}
                        >
                          {/* Employee ID */}
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                              {u.employee_id || "N/A"}
                            </span>
                          </td>

                          {/* Name & Email with Avatar */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-xs shadow-2xs shrink-0 border border-blue-400/30">
                                {initials}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">{u.name}</div>
                                <div className="text-[11px] text-slate-400 font-medium">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                                u.role === "admin"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : u.role === "team_leader"
                                  ? "bg-blue-50 text-[#0F4FA8] border border-blue-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {u.role === "team_leader" ? <Crown className="h-3 w-3 text-[#0F4FA8]" /> : <Shield className="h-3 w-3" />}
                              <span>{u.role === "team_leader" ? "TL" : (u.role || "agent").replace(/_/g, " ")}</span>
                            </span>
                          </td>

                          {/* Pool Pill */}
                          <td className="px-4 py-4">
                            {poolObj ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                <Layers className="h-3 w-3" />
                                <span>{poolObj.name === "credit_card_sales" ? "SALES" : poolObj.name.replace(/_/g, " ")}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400 italic">No Pool Assigned</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                u.is_active
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                  : "bg-slate-100 border border-slate-200 text-slate-500"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                              <span>{u.is_active ? "Active" : "Suspended"}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={() => openEditModal(u)}
                                className="px-3 py-1 bg-white hover:bg-blue-50 text-[#0F4FA8] border border-slate-200 hover:border-blue-200 text-xs rounded-xl font-extrabold transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                                title="Edit User Account"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Deactivate Button */}
                              {u.is_active && (
                                <button
                                  onClick={() => handleDeactivateUser(u.id || (u as any)._id || "", u.name)}
                                  className="px-3 py-1 bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-slate-200 hover:border-amber-200 text-xs rounded-xl font-extrabold transition shadow-2xs cursor-pointer active:scale-95"
                                  title="Deactivate Account"
                                >
                                  Deactivate
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteUser(u.id || (u as any)._id || "", u.name)}
                                className="p-1.5 bg-white hover:bg-rose-50 text-rose-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs rounded-xl font-extrabold transition shadow-2xs cursor-pointer active:scale-95"
                                title="Delete User Account"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
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
          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 h-fit lg:col-span-1 space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Folder className="h-4.5 w-4.5 text-[#0F4FA8]" />
              <span>Create Call Pool</span>
            </h2>
            <form onSubmit={handleCreatePool} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Permitted Pool Name</label>
                <select
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-bold text-slate-800 cursor-pointer"
                >
                  <option value="recruitment">Recruitment Pool (HR Hiring)</option>
                  <option value="credit_card_sales">Credit Card Sales Pool (Banking)</option>
                  <option value="customer_support">Customer Support Pool (Service)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  placeholder="Pool description details..."
                  value={poolDesc}
                  onChange={e => setPoolDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 h-24 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#0F4FA8] text-white text-xs py-2.5 rounded-xl font-extrabold hover:bg-blue-900 transition shadow-md cursor-pointer active:scale-95"
              >
                Create Pool
              </button>
            </form>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-6 shadow-sm border border-slate-200/80 lg:col-span-2 space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-[#0F4FA8]" />
              <span>Active System Pools</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pools.map(p => (
                <div key={p.id} className="p-5 border border-slate-200/80 rounded-[16px] bg-slate-50/60 flex justify-between items-start shadow-2xs hover:shadow-md transition">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm capitalize">{p.name.replace("_", " ")}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">{p.description}</p>
                    <span className="mt-3 block text-[10px] text-[#0F4FA8] font-black tracking-wide font-mono uppercase bg-blue-50 w-fit px-2.5 py-0.5 rounded border border-blue-100">
                      ID: {p.id}
                    </span>
                  </div>
                  <button onClick={() => handleDeletePool(p.id, p.name)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer">
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))}
              {pools.length === 0 && (
                <p className="text-slate-400 text-center py-8 font-medium col-span-2">No active pools registered.</p>
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
          {/* 1. COMPACT PAGE HEADER & LIVE KPI GRID (REPLACING BULKY DARK BANNER) */}
          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black shadow-md shrink-0 border border-blue-400/30">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">Supervisor Mapping Console</h2>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      LIVE TELEMETRY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Hierarchy mapping, agent workload allocation, and team leader monitoring</p>
                </div>
              </div>

              <button
                onClick={loadData}
                className="h-9 px-4 bg-slate-100 hover:bg-[#0F4FA8] text-slate-700 hover:text-white border border-slate-200 hover:border-[#0F4FA8] rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Sync Workload</span>
              </button>
            </div>

            {/* Compact Live KPI Statistic Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs hover:shadow-md transition">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">ACTIVE SUPERVISORS</span>
                  <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{supervisorsList.length} TLs</span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Crown className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs hover:shadow-md transition">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">TOTAL AGENTS</span>
                  <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{users.filter(u => u.role === "agent").length} Personnel</span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center border border-blue-100">
                  <Layers className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs hover:shadow-md transition">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">MAPPED AGENTS</span>
                  <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                    {users.filter(u => u.role === "agent" && u.supervisor_id).length} Mapped
                  </span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs hover:shadow-md transition">
                <div>
                  <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">UNASSIGNED AGENTS</span>
                  <span className="text-xl font-black text-amber-700 font-mono mt-0.5 block">
                    {unassignedAgents.length} Available
                  </span>
                </div>
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. SUPERVISOR SELECTOR & GLASSMORPHISM KPI CARDS */}
          <div className="bg-white/95 backdrop-blur-xl rounded-[16px] p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 border-b border-slate-100 pb-4">
              
              {/* Supervisor Dropdown with Profile Preview */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-[#0F4FA8]" />
                  <span>Select Active Supervisor / Team Leader</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedSupervisorId}
                    onChange={e => setSelectedSupervisorId(e.target.value)}
                    className="w-full h-[46px] pl-4 pr-10 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/70 hover:bg-slate-100/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] transition cursor-pointer"
                  >
                    <option value="">-- Choose Supervisor / Team Lead --</option>
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>
                        {tl.name} ({tl.employee_id}) · {tl.department || "Operations"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Supervisor Profile Badge */}
              {selectedSupervisorId && (() => {
                const curSup = supervisorsList.find(s => s.id === selectedSupervisorId);
                if (!curSup) return null;
                return (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center gap-3.5 min-w-[280px]">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] font-black text-sm flex items-center justify-center shadow-xs shrink-0 border border-blue-400/30">
                      {curSup.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-xs truncate">{curSup.name}</span>
                        <span className="bg-blue-50 text-[#0F4FA8] border border-blue-200 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                          {curSup.employee_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold truncate mt-0.5">
                        {curSup.department || "General Operations"} · Shift Team Lead
                      </p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs animate-pulse" title="Online Supervisor" />
                  </div>
                );
              })()}
            </div>

            {/* Glassmorphism KPI Metrics Grid */}
            {selectedSupervisorId && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                
                {/* Total Agents KPI */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL AGENTS</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#0F4FA8] flex items-center justify-center">
                      <UsersIcon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-slate-900 leading-none">{supervisorMetrics.total}</span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">100%</span>
                  </div>
                </div>

                {/* Online KPI */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">ONLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-emerald-700 leading-none">{supervisorMetrics.online}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.online / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Offline KPI */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">OFFLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                      <PowerOff className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-slate-700 leading-none">{supervisorMetrics.offline}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.offline / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Busy KPI */}
                <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">ON CALL / BUSY</span>
                    <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <PhoneCall className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-rose-700 leading-none">{supervisorMetrics.busy}</span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                </div>

                {/* Break KPI */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">ON BREAK</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Coffee className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-2xl font-black text-amber-700 leading-none">{supervisorMetrics.break}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Paused</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 3. DUAL COLUMN ENTERPRISE DATA TABLES / CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* COLUMN 1: SUPERVISED AGENTS */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[20px] p-5 shadow-sm border border-slate-200/80 space-y-4 flex flex-col">
              
              {/* Header Title & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center font-bold">
                    <UsersIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Supervised Agents</h3>
                    <p className="text-[11px] text-slate-400 font-semibold">Agents currently assigned to selected TL</p>
                  </div>
                </div>

                {selectedSupervisorId && (
                  <span className="bg-blue-50 text-[#0F4FA8] border border-blue-200 text-xs font-mono font-extrabold px-3 py-1 rounded-full shrink-0">
                    {selectedSupervisorAgents.length} Mapped
                  </span>
                )}
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search supervised agents..."
                    value={supervisedSearch}
                    onChange={e => setSupervisedSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                  {supervisedSearch && (
                    <button onClick={() => setSupervisedSearch("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={supervisedPoolFilter}
                  onChange={e => setSupervisedPoolFilter(e.target.value)}
                  className="h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Pools</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* Agents List */}
              <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1 flex-1">
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
                        whileHover={{ y: -2, scale: 1.005 }}
                        transition={{ duration: 0.15 }}
                        className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-300 shadow-xs"
                            : "bg-slate-50/60 hover:bg-white border-slate-200/80 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#0F4FA8] focus:ring-[#0F4FA8] border-slate-300 rounded cursor-pointer shrink-0"
                          />

                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] font-black text-xs flex items-center justify-center shadow-2xs">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-rose-500" : "bg-slate-400"
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs truncate">{agent.name}</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded">
                                {agent.employee_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-[#0F4FA8] bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                {poolObj?.name.replace("_", " ").toUpperCase() || "NO POOL"}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {agent.shift || "Day Shift"} · {agent.language || "English"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={isLoading}
                          onClick={() => handleTransferAgent(agent.id, null)}
                          className="h-8 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold transition flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Remove TL mapping"
                        >
                          {isLoading ? (
                            <Clock className="h-3.5 w-3.5 animate-spin text-rose-600" />
                          ) : (
                            <UserX className="h-3.5 w-3.5 text-rose-600" />
                          )}
                          <span>Unmap</span>
                        </button>
                      </motion.div>
                    );
                  })}

                {(!selectedSupervisorId || selectedSupervisorAgents.length === 0) && (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <UsersIcon className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">No Supervised Agents Mapped</p>
                    <p className="text-[11px] text-slate-400 font-medium">Select a supervisor from above or map available agents from the right panel.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: OTHER AGENTS (AVAILABLE FOR ASSIGNMENT) */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[20px] p-5 shadow-sm border border-slate-200/80 space-y-4 flex flex-col">
              
              {/* Header Title & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Available Personnel</h3>
                    <p className="text-[11px] text-slate-400 font-semibold">Agents available for mapping or pool allocation</p>
                  </div>
                </div>

                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-mono font-extrabold px-3 py-1 rounded-full shrink-0">
                  {unassignedAgents.length} Available
                </span>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search available agents..."
                    value={availableSearch}
                    onChange={e => setAvailableSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                  {availableSearch && (
                    <button onClick={() => setAvailableSearch("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={availablePoolFilter}
                  onChange={e => setAvailablePoolFilter(e.target.value)}
                  className="h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Pools</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* Available Agents List */}
              <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1 flex-1">
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
                        whileHover={{ y: -2, scale: 1.005 }}
                        transition={{ duration: 0.15 }}
                        className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-300 shadow-xs"
                            : "bg-slate-50/60 hover:bg-white border-slate-200/80 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#0F4FA8] focus:ring-[#0F4FA8] border-slate-300 rounded cursor-pointer shrink-0"
                          />

                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-rose-500" : "bg-slate-400"
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs truncate">{agent.name}</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded">
                                {agent.employee_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-[#0F4FA8] bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                {poolObj?.name.replace("_", " ").toUpperCase() || "NO POOL"}
                              </span>
                              {agent.supervisor_id && (
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
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
                            className="h-8 px-3 bg-[#0F4FA8] hover:bg-blue-900 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
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
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <UserPlus className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">No Available Personnel</p>
                    <p className="text-[11px] text-slate-400 font-medium">All active agents are currently assigned to supervisors.</p>
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
              className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#0F4FA8] text-[#FFC107] font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                  {selectedAgentIds.length}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white tracking-tight">{selectedAgentIds.length} Agent(s) Selected</h4>
                  <p className="text-xs text-slate-400 font-medium">Perform bulk pool mapping or supervisor re-assignment</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Bulk Pool Select */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    value={bulkTargetPoolId}
                    onChange={e => setBulkTargetPoolId(e.target.value)}
                    className="h-10 border border-slate-700 rounded-xl px-3 text-xs text-slate-900 font-bold bg-white focus:outline-none w-full sm:w-44"
                  >
                    <option value="">-- Target Pool --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ").toUpperCase()}</option>
                    ))}
                  </select>
                  <button
                    disabled={!bulkTargetPoolId || isActionLoading === "bulk-pool"}
                    onClick={handleBulkAssignPool}
                    className="h-10 px-4 bg-[#0F4FA8] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isActionLoading === "bulk-pool" ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-[#FFC107]" />}
                    <span>Assign Pool</span>
                  </button>
                </div>

                {/* Bulk Supervisor Select */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    value={bulkTargetSupervisorId}
                    onChange={e => setBulkTargetSupervisorId(e.target.value)}
                    className="h-10 border border-slate-700 rounded-xl px-3 text-xs text-slate-900 font-bold bg-white focus:outline-none w-full sm:w-44"
                  >
                    <option value="">-- Target Supervisor --</option>
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                  <button
                    disabled={!bulkTargetSupervisorId || isActionLoading === "bulk-sup"}
                    onClick={handleBulkAssignSupervisor}
                    className="h-10 px-4 bg-[#FFC107] hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isActionLoading === "bulk-sup" ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 text-slate-950" />}
                    <span>Map Supervisor</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedAgentIds([])}
                  className="h-10 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Clear
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
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center font-bold border border-blue-100">
                  <Edit className="h-5 w-5 text-[#0F4FA8]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Edit Personnel Account</h2>
                  <p className="text-xs text-slate-500 font-medium">Update account details for {editingUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleUpdateUserSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 focus:border-[#0F4FA8] transition"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 focus:border-[#0F4FA8] transition"
                  />
                </div>

                {/* System Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">System Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 cursor-pointer"
                  >
                    <option value="agent">Agent (Telecaller)</option>
                    <option value="team_leader">Supervisor (Team Leader)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
                  <select
                    value={editForm.department}
                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 cursor-pointer"
                  >
                    <option value="Sales">Sales & Outreach</option>
                    <option value="Service">Customer Support</option>
                    <option value="HR">HR & Recruitment</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                {/* Pool Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pool Mapping</label>
                  <select
                    value={editForm.pool_id}
                    onChange={e => setEditForm({ ...editForm, pool_id: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 cursor-pointer"
                  >
                    <option value="">No Pool Assigned</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Employee ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Employee ID</label>
                  <input
                    type="text"
                    value={editForm.employee_id}
                    onChange={e => setEditForm({ ...editForm, employee_id: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 transition"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Shift Schedule</label>
                  <select
                    value={editForm.shift}
                    onChange={e => setEditForm({ ...editForm, shift: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/20 cursor-pointer"
                  >
                    <option value="Day">Day Shift (9 AM - 6 PM)</option>
                    <option value="Night">Night Shift (9 PM - 6 AM)</option>
                    <option value="Flexible">Flexible Shift</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F4FA8] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Save Changes
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
