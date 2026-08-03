import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
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
  Check
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

export default function Users() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"accounts" | "pools" | "assignments">("accounts");
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newlyCreatedUserId, setNewlyCreatedUserId] = useState<string | null>(null);
  
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
    }
  }, [showToast, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create User (Admin only)
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone || undefined,
        pool_id: form.pool_id || undefined,
        supervisor_id: form.role === "agent" && form.supervisor_id ? form.supervisor_id : undefined,
        department: form.role === "team_leader" ? form.department : undefined,
        language: form.language,
        shift: form.shift,
        skills: form.skillsString ? form.skillsString.split(",").map(s => s.trim()) : [],
        voice_model: form.voice_model,
        ai_configuration: form.ai_config_prompt ? { system_prompt: form.ai_config_prompt } : {},
      };

      await api.post("/api/users", payload);
      showToast("User account registered successfully.", "success");
      setForm({
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
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to register user.", "error");
    }
  }

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

  // --- TEAM LEADER VIEW ---
  if (user?.role === "team_leader") {
    const myAgents = users.filter(u => u.role === "agent");

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Portal Header */}
        <PortalHeader
          icon={<User className="h-5 w-5 text-[#0F4C9A]" />}
          title="Team Agent Directory"
          subtitle="Monitor active workloads, agent status, and submit transfer requests"
          badgeText={`${myAgents.length} MAPPED AGENTS`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Team Members Table (2 columns) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
            <h2 className="text-lg font-black text-gray-800 mb-4">Assigned Agents</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Pool / Shift</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Workload (Leads)</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myAgents.map(a => (
                    <tr key={a.id} className="border-t hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-500">{a.employee_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-800">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-600">
                        <span className="block text-xs font-bold text-forgeBlue">
                          {pools.find(p => p.id === a.pool_id)?.name.replace("_", " ").toUpperCase() || "General"}
                        </span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{a.shift || "Day Shift"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                            a.status === "online"
                              ? "bg-green-50 border border-green-200 text-green-700"
                              : a.status === "busy"
                              ? "bg-red-50 border border-red-200 text-red-700 animate-pulse"
                              : a.status === "break"
                              ? "bg-orange-50 border border-orange-200 text-orange-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {a.status || "offline"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-gray-700 text-sm">
                          {getAgentLeadsCount(a.id)} leads
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setTransferAgentId(a.id);
                            setIsTransferModalOpen(true);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 border text-gray-700 text-xs px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
                        >
                          <Send className="h-3 w-3 text-forgeBlue" />
                          <span>Request Transfer</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {myAgents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-medium">
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-black text-gray-800 mb-3">Live Team Status</h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 border p-3 rounded-xl">
                  <div className="text-lg font-black text-forgeBlue">{myAgents.length}</div>
                  <div className="text-[9px] text-gray-400 font-extrabold uppercase mt-0.5">Total Assigned</div>
                </div>
                <div className="bg-green-50 border border-green-200 p-3 rounded-xl">
                  <div className="text-lg font-black text-green-700">
                    {myAgents.filter(a => ["online", "busy", "break"].includes(a.status || "")).length}
                  </div>
                  <div className="text-[9px] text-green-600 font-extrabold uppercase mt-0.5">Active Online</div>
                </div>
              </div>
            </div>

            {/* Transfer requests history list */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-forgeBlue" />
                <span>My Transfer Requests</span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                {transferRequests.map(r => (
                  <div key={r.id} className="p-3 bg-gray-50 border rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 text-xs">{r.agent_name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">To: {r.target_pool_name}</div>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          r.status === "approved"
                            ? "bg-green-50 border border-green-200 text-green-700"
                            : r.status === "rejected"
                            ? "bg-red-50 border border-red-200 text-red-700"
                            : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-[11px] text-gray-500 font-medium italic bg-white p-2 rounded-lg border border-gray-100">
                        "{r.reason}"
                      </p>
                    )}
                    {r.remarks && (
                      <p className="text-[10px] text-red-700 font-bold bg-red-50 p-2 rounded-lg border border-red-100">
                        Admin Note: {r.remarks}
                      </p>
                    )}
                  </div>
                ))}
                {transferRequests.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8 font-medium">No transfer requests submitted yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Request Pool Transfer Modal Form */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-800 text-lg">Agent Transfer Request</h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleCreateTransferRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Target Pool</label>
                  <select
                    value={transferTargetPoolId}
                    onChange={e => setTransferTargetPoolId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                    required
                  >
                    <option value="">-- Choose Target Pool --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Justification Reason</label>
                  <textarea
                    placeholder="Provide details on why this pool reassignment is required for the agent..."
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 h-28 focus:ring-2 focus:ring-forgeBlue"
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-slate-50 transition text-sm font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-forgeBlue hover:bg-blue-800 text-white rounded-xl transition text-sm font-bold"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ADMIN VIEW (Standard Organization Workspace) ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Portal Header */}
      <PortalHeader
        icon={<User className="h-5 w-5 text-[#0F4C9A]" />}
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

      {/* Tab Contents: User Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* User List Table (Full Width) */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 space-y-4">
            
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Registered Personnel</h2>
                  <span className="text-[11px] font-extrabold bg-[#0F4C9A]/10 text-[#0F4C9A] border border-[#0F4C9A]/20 px-2.5 py-0.5 rounded-full">
                    {users.filter(u => u.is_active).length} Active Personnel
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Manage team directory, roles, pool assignments, and security accounts</p>
              </div>

              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="px-4.5 py-2.5 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Add User</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, ID..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Role & Pool Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="team_leader">Team Leaders</option>
                  <option value="agent">Agents</option>
                </select>

                <select
                  value={userPoolFilter}
                  onChange={e => setUserPoolFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
                >
                  <option value="all">All Pools</option>
                  <option value="none">No Pool</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace("_", " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
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
                    .map(u => {
                      const isNewlyCreated = newlyCreatedUserId === u.id || newlyCreatedUserId === (u as any)._id;
                      const poolObj = pools.find(p => p.id === u.pool_id);
                      const initials = u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

                      return (
                        <tr
                          key={u.id}
                          className={`transition-all duration-300 ${
                            isNewlyCreated
                              ? "bg-emerald-50/90 font-semibold shadow-2xs"
                              : "hover:bg-slate-50/70"
                          }`}
                        >
                          {/* Employee ID */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                              {u.employee_id || "N/A"}
                            </span>
                          </td>

                          {/* Name & Email with Avatar */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4C9A] to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-2xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">{u.name}</div>
                                <div className="text-[11px] text-slate-400 font-medium">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                                u.role === "admin"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : u.role === "team_leader"
                                  ? "bg-blue-50 text-[#0F4C9A] border border-blue-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              <span>{u.role === "team_leader" ? "TL" : (u.role || "agent").replace(/_/g, " ")}</span>
                            </span>
                          </td>

                          {/* Pool Pill */}
                          <td className="px-4 py-3.5">
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
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                u.is_active
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                  : "bg-slate-100 border border-slate-200 text-slate-500"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                              <span>{u.is_active ? "Active" : "Suspended"}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={() => openEditModal(u)}
                                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#0F4C9A] border border-slate-200 hover:border-blue-200 text-xs rounded-lg font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="Edit User"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Deactivate Button */}
                              {u.is_active && (
                                <button
                                  onClick={() => handleDeactivateUser(u.id || (u as any)._id || "", u.name)}
                                  className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-slate-200 hover:border-amber-200 text-xs rounded-lg font-bold transition shadow-2xs cursor-pointer"
                                  title="Deactivate Account"
                                >
                                  Deactivate
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteUser(u.id || (u as any)._id || "", u.name)}
                                className="p-1.5 bg-white hover:bg-rose-50 text-rose-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs rounded-lg font-bold transition shadow-2xs cursor-pointer"
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
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit lg:col-span-1">
            <h2 className="text-lg font-black text-gray-800 mb-4">Create Call Pool</h2>
            <form onSubmit={handleCreatePool} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Permitted pool name</label>
                <select
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                >
                  <option value="recruitment">Recruitment Pool (HR Hiring)</option>
                  <option value="credit_card_sales">Credit Card Sales Pool (Banking)</option>
                  <option value="customer_support">Customer Support Pool (Service)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Description</label>
                <textarea
                  placeholder="Pool description details..."
                  value={poolDesc}
                  onChange={e => setPoolDesc(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 h-24"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-forgeBlue text-white text-sm py-2.5 rounded-xl font-bold hover:bg-blue-800 transition"
              >
                Create Pool
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
            <h2 className="text-lg font-black text-gray-800 mb-4">Active System Pools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pools.map(p => (
                <div key={p.id} className="p-5 border rounded-2xl bg-white flex justify-between items-start shadow-xs">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-sm capitalize">{p.name.replace("_", " ")}</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">{p.description}</p>
                    <span className="mt-3 block text-[10px] text-forgeBlue font-bold tracking-wide font-mono uppercase bg-blue-50 w-fit px-2 py-0.5 rounded border border-blue-100">
                      ID: {p.id}
                    </span>
                  </div>
                  <button onClick={() => handleDeletePool(p.id, p.name)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))}
              {pools.length === 0 && (
                <p className="text-gray-400 text-center py-8 font-medium col-span-2">No active pools registered.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: Supervisor mapping */}
      {activeTab === "assignments" && (
        <div className="space-y-5 font-sans">
          
          {/* 1. BLUE-TO-GOLD GRADIENT HERO HEADER WITH LIVE STATISTICS */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1E5EFF] to-[#0F172A] p-6 rounded-[20px] shadow-lg border border-slate-800/80 text-white space-y-4">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#F5B301]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-[#F5B301]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Supervisor Management Dashboard</h2>
                    <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE TELEMETRY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                    Enterprise hierarchy mapping, status tracking, and agent allocation engine
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={loadData}
                  className="h-9 px-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 border border-white/20 cursor-pointer active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#F5B301]" />
                  <span>Sync Workload</span>
                </button>
              </div>
            </div>

            {/* Live Stats Pills */}
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 text-[10px] uppercase font-bold block">Active Supervisors</span>
                  <span className="text-lg font-black text-white leading-tight">{supervisorsList.length} TLs</span>
                </div>
                <UsersIcon className="h-5 w-5 text-[#F5B301]/90" />
              </div>

              <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 text-[10px] uppercase font-bold block">Total Agents</span>
                  <span className="text-lg font-black text-white leading-tight">{users.filter(u => u.role === "agent").length} Personnel</span>
                </div>
                <Layers className="h-5 w-5 text-blue-300" />
              </div>

              <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 text-[10px] uppercase font-bold block">Mapped Agents</span>
                  <span className="text-lg font-black text-emerald-300 leading-tight">
                    {users.filter(u => u.role === "agent" && u.supervisor_id).length} Mapped
                  </span>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 text-[10px] uppercase font-bold block">Unassigned Agents</span>
                  <span className="text-lg font-black text-amber-300 leading-tight">
                    {users.filter(u => u.role === "agent" && !u.supervisor_id).length} Available
                  </span>
                </div>
                <ShieldCheck className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </div>

          {/* 2. SUPERVISOR SELECTOR & GLASSMORPHISM KPI CARDS */}
          <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 border-b border-slate-100 pb-4">
              
              {/* Supervisor Dropdown with Profile Preview */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-[#1E5EFF]" />
                  <span>Select Active Supervisor / Team Leader</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedSupervisorId}
                    onChange={e => setSelectedSupervisorId(e.target.value)}
                    className="w-full h-[46px] pl-4 pr-10 border border-slate-200 rounded-[16px] text-xs font-bold text-slate-800 bg-slate-50/70 hover:bg-slate-100/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5EFF] transition cursor-pointer"
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
                  <div className="bg-slate-50 p-3 rounded-[16px] border border-slate-200/80 flex items-center gap-3.5 min-w-[280px]">
                    <div className="h-10 w-10 rounded-xl bg-[#0F172A] text-[#F5B301] font-black text-sm flex items-center justify-center shadow-xs shrink-0 border border-slate-800">
                      {curSup.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-xs truncate">{curSup.name}</span>
                        <span className="bg-blue-50 text-[#1E5EFF] border border-blue-200 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
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
                <div className="bg-white p-3.5 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL AGENTS</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#1E5EFF] flex items-center justify-center">
                      <UsersIcon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-900 leading-none">{supervisorMetrics.total}</span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">100%</span>
                  </div>
                </div>

                {/* Online KPI */}
                <div className="bg-white p-3.5 rounded-[16px] border border-emerald-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">ONLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-700 leading-none">{supervisorMetrics.online}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.online / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Offline KPI */}
                <div className="bg-white p-3.5 rounded-[16px] border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">OFFLINE</span>
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                      <PowerOff className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-700 leading-none">{supervisorMetrics.offline}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {supervisorMetrics.total ? Math.round((supervisorMetrics.offline / supervisorMetrics.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Busy KPI */}
                <div className="bg-white p-3.5 rounded-[16px] border border-rose-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">ON CALL / BUSY</span>
                    <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <PhoneCall className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-rose-700 leading-none">{supervisorMetrics.busy}</span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                </div>

                {/* Break KPI */}
                <div className="bg-white p-3.5 rounded-[16px] border border-amber-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between h-[92px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">ON BREAK</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Coffee className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
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
            <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-5 shadow-sm border border-slate-200/80 space-y-4 flex flex-col">
              
              {/* Header Title & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#1E5EFF] flex items-center justify-center font-bold">
                    <UsersIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Supervised Agents</h3>
                    <p className="text-[11px] text-slate-400 font-semibold">Agents currently assigned to selected TL</p>
                  </div>
                </div>

                {selectedSupervisorId && (
                  <span className="bg-blue-50 text-[#1E5EFF] border border-blue-200 text-xs font-extrabold px-3 py-1 rounded-full shrink-0">
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
                    className="w-full h-9 pl-9 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E5EFF]"
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
                      <div
                        key={agent.id}
                        className={`p-3 rounded-[16px] border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-300 shadow-xs"
                            : "bg-slate-50/50 hover:bg-white border-slate-200/80 hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#1E5EFF] focus:ring-[#1E5EFF] border-slate-300 rounded cursor-pointer shrink-0"
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
                              <span className="text-[10px] font-semibold text-[#1E5EFF] bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
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
                      </div>
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
            <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-5 shadow-sm border border-slate-200/80 space-y-4 flex flex-col">
              
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

                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-extrabold px-3 py-1 rounded-full shrink-0">
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
                    className="w-full h-9 pl-9 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E5EFF]"
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
                      <div
                        key={agent.id}
                        className={`p-3 rounded-[16px] border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-300 shadow-xs"
                            : "bg-slate-50/50 hover:bg-white border-slate-200/80 hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAgent(agent.id)}
                            className="h-4 w-4 text-[#1E5EFF] focus:ring-[#1E5EFF] border-slate-300 rounded cursor-pointer shrink-0"
                          />

                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-xl bg-slate-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
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
                              <span className="text-[10px] font-semibold text-[#1E5EFF] bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
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
                            className="h-8 px-3 bg-[#1E5EFF] hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                          >
                            {isLoading ? (
                              <Clock className="h-3.5 w-3.5 animate-spin text-white" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5 text-white" />
                            )}
                            <span>Assign TL</span>
                          </button>
                        )}
                      </div>
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
            <div className="bg-[#0F172A] text-white p-4 rounded-[20px] shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-scale-in">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#1E5EFF] text-[#F5B301] font-black text-sm flex items-center justify-center shrink-0 shadow-md">
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
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                    ))}
                  </select>
                  <button
                    disabled={!bulkTargetPoolId || isActionLoading === "bulk-pool"}
                    onClick={handleBulkAssignPool}
                    className="h-10 px-4 bg-[#1E5EFF] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isActionLoading === "bulk-pool" ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-[#F5B301]" />}
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
                    className="h-10 px-4 bg-[#F5B301] hover:bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
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
            </div>
          )}

        </div>
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
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold border border-blue-100">
                  <Edit className="h-5 w-5 text-[#0F4C9A]" />
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
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition"
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
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition"
                  />
                </div>

                {/* System Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">System Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
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
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
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
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
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
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 transition"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 transition"
                  />
                </div>

                {/* Shift Schedule */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Shift Schedule</label>
                  <select
                    value={editForm.shift}
                    onChange={e => setEditForm({ ...editForm, shift: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 cursor-pointer"
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
                  className="px-5 py-2 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
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
    </div>
  );
}


