import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import PortalHeader from "../components/PortalHeader";
import RegisterUserModal from "../components/RegisterUserModal";
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
  ShieldAlert,
  ArrowRight,
  X
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
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

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

  // Deactivate User (Admin only)
  async function handleDeactivateUser(userId: string) {
    if (!confirm("Are you sure you want to deactivate this account?")) return;
    try {
      await api.patch(`/api/users/${userId}/deactivate`);
      showToast("Account deactivated successfully.", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Deactivation failed.", "error");
    }
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
  async function handleDeletePool(poolId: string) {
    if (!confirm("Are you sure you want to delete this pool?")) return;
    try {
      await api.delete(`/api/pools/${poolId}`);
      showToast("Pool deleted.", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete pool.", "error");
    }
  }

  // Map agent to supervisor (Admin only)
  async function handleTransferAgent(agentId: string, supervisorId: string | null) {
    try {
      await api.patch("/api/users/assign-supervisor", {
        supervisor_id: supervisorId || undefined,
        agent_ids: [agentId],
      });
      showToast("Supervisor mapping updated.", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update supervisor mapping.", "error");
    }
  }

  // Bulk assign pool (Admin only)
  async function handleBulkAssignPool() {
    if (!bulkTargetPoolId) return;
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
        primaryButton={
          activeTab === "accounts"
            ? {
                label: "Add User",
                icon: <UserPlus className="h-4 w-4" />,
                onClick: () => setIsCreateUserModalOpen(true),
              }
            : undefined
        }
      />

      {/* Tab Contents: User Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* User List Table (Full Width) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Registered Personnel</h2>
                <p className="text-xs text-slate-500 font-semibold">Active team members, roles, pools, and security status</p>
              </div>
              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="px-4 py-2 bg-[#0F4C9A] hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Add User</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role / Pool</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isNewlyCreated = newlyCreatedUserId === u.id || newlyCreatedUserId === (u as any)._id;
                    return (
                      <tr
                        key={u.id}
                        className={`border-t border-slate-100 transition-all duration-500 ${
                          isNewlyCreated
                            ? "bg-emerald-50/90 border-l-4 border-l-emerald-500 font-semibold shadow-2xs"
                            : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{u.employee_id}</td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-400 font-medium">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block text-xs font-bold text-slate-800 capitalize">
                            {u.role.replace("_", " ")}
                          </span>
                          <span className="block text-[11px] text-[#0F4C9A] font-semibold">
                            {pools.find(p => p.id === u.pool_id)?.name.replace("_", " ").toUpperCase() || "No Pool"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.is_active
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                : "bg-slate-100 border text-slate-500"
                            }`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active && (
                            <button
                              onClick={() => handleDeactivateUser(u.id)}
                              className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-xl font-bold hover:bg-rose-100 transition cursor-pointer"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                        No team accounts found. Click "+ Add User" to register personnel.
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
                  <button onClick={() => handleDeletePool(p.id)} className="text-gray-400 hover:text-red-500 p-1">
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
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-800 text-lg mb-4">Supervisor Management Dashboard</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-full md:w-80">
                <label className="block text-xs font-bold text-gray-500 mb-1">Select Supervisor</label>
                <select
                  value={selectedSupervisorId}
                  onChange={e => setSelectedSupervisorId(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                >
                  <option value="">-- Choose Supervisor --</option>
                  {supervisorsList.map(tl => (
                    <option key={tl.id} value={tl.id}>{tl.name} ({tl.employee_id})</option>
                  ))}
                </select>
              </div>

              {selectedSupervisorId && (
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-4 w-full">
                  <div className="bg-gray-50 border p-3 rounded-xl text-center">
                    <div className="text-xl font-bold text-gray-800">{supervisorMetrics.total}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Total Agents</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-center">
                    <div className="text-xl font-bold text-green-700">{supervisorMetrics.online}</div>
                    <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">Online</div>
                  </div>
                  <div className="bg-gray-100 border p-3 rounded-xl text-center">
                    <div className="text-xl font-bold text-gray-600">{supervisorMetrics.offline}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Offline</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-center">
                    <div className="text-xl font-bold text-red-700">{supervisorMetrics.busy}</div>
                    <div className="text-[10px] text-red-600 font-bold uppercase mt-0.5">Busy</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl text-center">
                    <div className="text-xl font-bold text-orange-700">{supervisorMetrics.break}</div>
                    <div className="text-[10px] text-orange-600 font-bold uppercase mt-0.5">Break</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-base mb-4 flex justify-between items-center">
                <span>Supervised Agents</span>
                {selectedSupervisorId && (
                  <span className="bg-forgeBlue/10 text-forgeBlue text-xs font-bold px-2 py-0.5 rounded-full">
                    {selectedSupervisorAgents.length} Agents
                  </span>
                )}
              </h3>
              
              <div className="space-y-3 overflow-y-auto max-h-[400px]">
                {selectedSupervisorAgents.map(agent => (
                  <div key={agent.id} className="flex justify-between items-center p-3 border rounded-xl bg-gray-50/50 hover:bg-white transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={() => toggleSelectAgent(agent.id)}
                          className="h-4 w-4 text-forgeBlue focus:ring-forgeBlue border-gray-300 rounded"
                        />
                        <span className="font-bold text-gray-800 text-sm">{agent.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium pl-6">
                        ID: {agent.employee_id} · Pool: {pools.find(p => p.id === agent.pool_id)?.name.replace("_", " ") || "None"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTransferAgent(agent.id, null)}
                      className="bg-slate-100 hover:bg-slate-200 border text-gray-600 text-xs px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1"
                    >
                      <UserX className="h-3 w-3 text-red-500" />
                      <span>Remove TL</span>
                    </button>
                  </div>
                ))}
                {(!selectedSupervisorId || selectedSupervisorAgents.length === 0) && (
                  <p className="text-gray-400 text-center py-12 font-medium">Select a supervisor to view mapped agents.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-base mb-4">Other Agents (Available for Assignment)</h3>
              <div className="space-y-3 overflow-y-auto max-h-[400px]">
                {unassignedAgents.map(agent => (
                  <div key={agent.id} className="flex justify-between items-center p-3 border rounded-xl bg-gray-50/50 hover:bg-white transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={() => toggleSelectAgent(agent.id)}
                          className="h-4 w-4 text-forgeBlue focus:ring-forgeBlue border-gray-300 rounded"
                        />
                        <span className="font-bold text-gray-800 text-sm">{agent.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium pl-6">
                        ID: {agent.employee_id} · Pool: {pools.find(p => p.id === agent.pool_id)?.name.replace("_", " ") || "None"}
                        {agent.supervisor_id && ` · TL ID: ${agent.supervisor_id}`}
                      </p>
                    </div>
                    {selectedSupervisorId && (
                      <button
                        onClick={() => handleTransferAgent(agent.id, selectedSupervisorId)}
                        className="bg-forgeBlue text-white text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-blue-800 transition flex items-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        <span>Map to Supervisor</span>
                      </button>
                    )}
                  </div>
                ))}
                {unassignedAgents.length === 0 && (
                  <p className="text-gray-400 text-center py-12 font-medium">No other agents available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Pool Assignment Footer */}
          {selectedAgentIds.length > 0 && (
            <div className="bg-forgeBlue text-white p-5 rounded-2xl shadow-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-in">
              <div>
                <p className="font-bold text-base">{selectedAgentIds.length} Agent(s) Selected</p>
                <p className="text-xs text-blue-200 mt-0.5">Perform bulk operations on selected agents</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <select
                  value={bulkTargetPoolId}
                  onChange={e => setBulkTargetPoolId(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none bg-white w-full sm:w-48 font-semibold"
                >
                  <option value="">-- Select Target Pool --</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssignPool}
                  className="bg-forgeGold hover:bg-amber-500 text-forgeBlue font-extrabold text-xs px-5 py-2.5 rounded-xl transition w-full sm:w-auto flex items-center justify-center gap-1"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Bulk Assign Pool</span>
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
    </div>
  );
}


