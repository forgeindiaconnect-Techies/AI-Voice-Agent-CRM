import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
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
  Phone
} from "lucide-react";

type Lead = {
  id: string;
  lead_id: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  language?: string;
  status: string;
  pool_id: string;
  campaign_id?: string;
  assigned_agent_id?: string;
  last_note?: string;
  follow_up_at?: string;
};

type Pool = { id: string; name: string };
type Campaign = { id: string; name: string; pool_id: string };
type UserRow = { id: string; name: string; role: string; employee_id: string; pool_id?: string; supervisor_id?: string; is_active?: boolean };

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 border border-blue-200 text-blue-700",
  in_progress: "bg-yellow-50 border border-yellow-200 text-yellow-700",
  follow_up: "bg-orange-50 border border-orange-200 text-orange-700",
  qualified: "bg-green-50 border border-green-200 text-green-700",
  not_interested: "bg-red-50 border border-red-200 text-red-700",
  closed: "bg-gray-150 border text-gray-600",
};

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
    language: "English"
  });

  // Bulk actions and selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  // Detail Modal States
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [detailNotes, setDetailNotes] = useState("");
  const [detailFollowUp, setDetailFollowUp] = useState("");

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
      showToast(err.message || "Lead import failed.", "error");
    }
  }

  // Create Manual single Lead
  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.pool_id) {
      showToast("A Pool is required to create a manual lead.", "error");
      return;
    }
    try {
      const payload = {
        name: manualForm.name,
        phone: manualForm.phone,
        email: manualForm.email || undefined,
        pool_id: manualForm.pool_id,
        campaign_id: manualForm.campaign_id || undefined,
        extra: {
          location: manualForm.location || undefined,
          language: manualForm.language
        }
      };

      await api.post("/api/leads", payload);
      showToast("Lead created successfully.", "success");
      setShowManualModal(false);
      setManualForm({
        name: "",
        phone: "",
        email: "",
        pool_id: "",
        campaign_id: "",
        location: "",
        language: "English"
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create lead.", "error");
    }
  }

  // Bulk assignment execution
  async function handleBulkAssign() {
    if (!assignAgentId) return;
    try {
      await api.post("/api/leads/assign", {
        lead_ids: selectedLeadIds,
        agent_id: assignAgentId
      });
      showToast(`Assigned ${selectedLeadIds.length} lead(s) successfully.`, "success");
      setSelectedLeadIds([]);
      setAssignAgentId("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Assignment failed.", "error");
    }
  }

  // Bulk status update execution
  async function handleBulkStatusChange() {
    if (!bulkStatus) return;
    try {
      for (const leadId of selectedLeadIds) {
        await api.patch(`/api/leads/${leadId}/disposition`, { status: bulkStatus });
      }
      showToast(`Updated status for ${selectedLeadIds.length} lead(s).`, "success");
      setSelectedLeadIds([]);
      setBulkStatus("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Bulk status change failed.", "error");
    }
  }

  // Single Lead disposition submission
  async function handleSaveDisposition(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      await api.patch(`/api/leads/${selectedLead.id}/disposition`, {
        status: detailStatus,
        notes: detailNotes || undefined,
        follow_up_at: detailFollowUp ? new Date(detailFollowUp).toISOString() : undefined
      });
      showToast("Lead status/disposition updated successfully.", "success");
      setSelectedLead(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update disposition.", "error");
    }
  }

  // Toggle checklist selection
  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  // Export current list to CSV client side
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headersCSV = ["Lead ID", "Name", "Phone", "Email", "Location", "Language", "Status", "Pool ID", "Assigned Agent"];
    const rowsCSV = filteredLeads.map(l => [
      l.lead_id,
      l.name,
      l.phone,
      l.email || "",
      l.location || "",
      l.language || "",
      l.status,
      l.pool_id,
      l.assigned_agent_id || "Unassigned"
    ]);

    const csvContent = [headersCSV.join(","), ...rowsCSV.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crm_leads_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cancel wizard and reset
  function resetImportWizard() {
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setAllRows([]);
    setMapping({});
    setTargetPoolId("");
    setTargetCampaignId("");
    setTargetSupervisorId("");
    setTargetAgentId("");
    setSuccessReport(null);
    setImportStep("upload");
  }

  const supervisorsList = users.filter(u => u.role === "team_leader" && u.is_active);
  // Team leaders can only assign to agents in their supervised pool/team
  const agentsList = user?.role === "team_leader"
    ? users.filter(u => u.role === "agent" && u.is_active && u.supervisor_id === (user.id || (user as any)._id))
    : users.filter(u => u.role === "agent" && u.is_active);

  // Client-side search query logic
  const filteredLeads = leads.filter(l => {
    const term = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(term) ||
      l.phone.includes(term) ||
      (l.email && l.email.toLowerCase().includes(term)) ||
      (l.location && l.location.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Wrapper */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-forgeBlue" />
              <span>Leads Management Workspace</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Search, filter, bulk assign, or launch the lead file mapping wizard</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportSection(!showImportSection)}
              className="bg-white border text-gray-700 hover:bg-slate-50 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <UploadCloud className="h-4 w-4 text-forgeBlue" />
              <span>{showImportSection ? "Hide Import Wizard" : "Import Leads File"}</span>
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="bg-forgeGold hover:bg-amber-500 text-forgeBlue font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4 animate-pulse" />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leads Importer Section */}
      {showImportSection && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-slide-in">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
            <UploadCloud className="h-5 w-5 text-forgeBlue" />
            <span>Excel / CSV Lead Import Wizard</span>
          </h2>

          {/* Step 1: Upload */}
          {importStep === "upload" && (
            <form onSubmit={handleFileUpload} className="max-w-md mx-auto py-6 space-y-4">
              <div className="border-2 border-dashed border-gray-200 hover:border-forgeBlue rounded-2xl p-8 text-center cursor-pointer transition relative bg-gray-50/50">
                <input
                  type="file"
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".csv, .xlsx, .xls"
                />
                <UploadCloud className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <span className="block text-sm font-bold text-gray-700">
                  {file ? file.name : "Drag & drop files here, or browse"}
                </span>
                <span className="block text-xs text-gray-400 mt-1">Supports CSV, Excel (XLSX, XLS) sheets</span>
              </div>
              <button
                type="submit"
                className="w-full bg-forgeBlue text-white text-xs py-2.5 rounded-xl font-bold hover:bg-blue-800 transition shadow-sm"
              >
                Upload & Parse Columns
              </button>
            </form>
          )}

          {/* Step 2: Mapping */}
          {importStep === "mapping" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
                <p className="font-semibold">Review and adjust header mapping columns to link your sheet headers to the CRM leads database:</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["name", "phone", "email", "location", "language"].map(field => (
                  <div key={field}>
                    <label className="block text-xs font-bold text-gray-600 mb-1 capitalize">
                      {field} Mapping <span className={["name", "phone"].includes(field) ? "text-red-500" : ""}>*</span>
                    </label>
                    <select
                      value={mapping[field] || ""}
                      onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
                      className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 font-semibold text-gray-700"
                    >
                      <option value="">-- Ignored --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="border rounded-2xl overflow-hidden mt-4">
                <div className="px-4 py-3 bg-gray-50 border-b font-extrabold text-xs text-gray-600">Sheet Data Preview (First 10 Rows)</div>
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                      <tr>
                        {headers.map(h => <th key={h} className="px-3 py-2">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50/50">
                          {headers.map(h => <td key={h} className="px-3 py-2 text-gray-600 truncate max-w-xs">{r[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between mt-4">
                <button onClick={resetImportWizard} className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-gray-50 text-gray-600">Cancel</button>
                <button onClick={handleConfirmMapping} className="px-5 py-2 bg-forgeBlue text-white text-xs font-bold rounded-xl hover:bg-blue-800">Confirm Columns</button>
              </div>
            </div>
          )}

          {/* Step 3: Assignment Targets */}
          {importStep === "assign" && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
                <p className="font-semibold">Assigning parsed {totalRecords} records to pools, campaigns, or agents. Select targets below:</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Target Pool</label>
                  <select
                    value={targetPoolId}
                    onChange={e => setTargetPoolId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 font-bold"
                    required
                  >
                    <option value="">-- Select Pool --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Target Campaign (Optional)</label>
                  <select
                    value={targetCampaignId}
                    onChange={e => setTargetCampaignId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 font-bold"
                  >
                    <option value="">-- Select Campaign --</option>
                    {campaigns.filter(c => c.pool_id === targetPoolId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Assign to Supervisor (Optional)</label>
                  <select
                    value={targetSupervisorId}
                    onChange={e => setTargetSupervisorId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 font-bold"
                  >
                    <option value="">-- Choose Supervisor --</option>
                    {supervisorsList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Assign to Agent (Optional)</label>
                  <select
                    value={targetAgentId}
                    onChange={e => setTargetAgentId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 font-bold"
                  >
                    <option value="">-- Choose Agent --</option>
                    {agentsList.filter(a => !targetSupervisorId || a.supervisor_id === targetSupervisorId).map(agt => (
                      <option key={agt.id} value={agt.id}>{agt.name} ({agt.employee_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setImportStep("mapping")} className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50">Back</button>
                <button onClick={handleImportExecute} className="px-5 py-2 bg-[#22c55e] text-white text-xs font-bold rounded-xl hover:bg-green-600 flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Commit Import</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success Report */}
          {importStep === "report" && successReport && (
            <div className="max-w-md mx-auto bg-gray-50 border rounded-2xl p-6 space-y-4 animate-slide-in">
              <div className="text-center flex flex-col items-center">
                <BarChart3 className="h-10 w-10 text-forgeBlue mb-2" />
                <h3 className="font-black text-gray-800 text-lg mt-2">Leads Import Success Report</h3>
                <p className="text-xs text-gray-400 font-medium">Import ID: {successReport.import_id}</p>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-xs font-semibold text-gray-600">Total Rows Processed</span>
                  <span className="text-xs font-bold text-gray-800">{successReport.total_processed}</span>
                </div>
                <div className="flex justify-between border-b pb-2 text-green-700">
                  <span className="text-xs font-semibold">Leads Stored in CRM</span>
                  <span className="text-xs font-black">+{successReport.inserted}</span>
                </div>
                <div className="flex justify-between border-b pb-2 text-orange-700">
                  <span className="text-xs font-semibold">Duplicates Skipped</span>
                  <span className="text-xs font-bold">{successReport.skipped_duplicates}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span className="text-xs font-semibold">Invalid Entries Ignored</span>
                  <span className="text-xs font-bold">{successReport.skipped_invalid}</span>
                </div>
              </div>

              <div className="flex justify-center pt-3">
                <button
                  onClick={resetImportWizard}
                  className="px-5 py-2 bg-forgeBlue text-white text-xs font-bold rounded-xl hover:bg-blue-800"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search, Filter, Export Panel */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            placeholder="Search leads by name, phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-forgeBlue"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border rounded-xl px-2.5 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="follow_up">Follow Up</option>
              <option value="qualified">Qualified</option>
              <option value="not_interested">Not Interested</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <select
            value={poolFilter}
            onChange={e => setPoolFilter(e.target.value)}
            className="border rounded-xl px-2.5 py-1.5 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
          >
            <option value="">All Pools</option>
            {pools.map(p => (
              <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="bg-white border text-gray-700 hover:bg-slate-50 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4 text-forgeBlue" />
            <span>Export View</span>
          </button>
        </div>
      </div>

      {/* Leads Listing Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black text-gray-800">Leads CRM Database</h2>
          <span className="text-xs text-gray-400 font-bold uppercase">{filteredLeads.length} Lead(s) Matching</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                    onChange={handleSelectAllLeads}
                    className="h-4 w-4 text-forgeBlue focus:ring-forgeBlue border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3">Lead ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone / Location</th>
                <th className="px-4 py-3">Pool</th>
                <th className="px-4 py-3">Agent Allocation</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => {
                    setSelectedLead(lead);
                    setDetailStatus(lead.status);
                    setDetailNotes(lead.last_note || "");
                    setDetailFollowUp(lead.follow_up_at ? new Date(lead.follow_up_at).toISOString().slice(0, 16) : "");
                  }}
                >
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                      className="h-4 w-4 text-forgeBlue focus:ring-forgeBlue border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-forgeBlue">{lead.lead_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-800">{lead.name}</div>
                    <div className="text-xs text-gray-400">{lead.email || "No Email"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 font-semibold">{lead.phone}</div>
                    <div className="text-xs text-gray-400">{lead.location || "N/A"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 border text-slate-700 px-2 py-0.5 rounded capitalize font-medium">
                      {pools.find(p => p.id === lead.pool_id)?.name.replace("_", " ") || lead.pool_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-xs text-gray-600">
                    {users.find(u => u.id === lead.assigned_agent_id)?.name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[lead.status] || ""}`}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-medium">
                    No leads match the selection query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Actions Tool Panel */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 md:left-80 bg-forgeBlue text-white p-5 rounded-2xl shadow-xl z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-in border border-white/10">
          <div>
            <p className="font-extrabold text-base">{selectedLeadIds.length} Lead(s) Selected</p>
            <p className="text-xs text-blue-200 mt-0.5">Bulk assign to team agents or transition state</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Agent Assign */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={assignAgentId}
                onChange={e => setAssignAgentId(e.target.value)}
                className="border rounded-xl px-3 py-2 text-xs text-gray-800 bg-white font-bold focus:outline-none w-full sm:w-44"
              >
                <option value="">-- Assign Agent --</option>
                {agentsList.map(agt => (
                  <option key={agt.id} value={agt.id}>{agt.name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!assignAgentId}
                className="bg-forgeGold hover:bg-amber-500 text-forgeBlue disabled:opacity-50 font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Assign</span>
              </button>
            </div>

            {/* Status Change */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
                className="border rounded-xl px-3 py-2 text-xs text-gray-800 bg-white font-bold focus:outline-none w-full sm:w-44"
              >
                <option value="">-- Change Status --</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="follow_up">Follow Up</option>
                <option value="qualified">Qualified</option>
                <option value="not_interested">Not Interested</option>
                <option value="closed">Closed</option>
              </select>
              <button
                onClick={handleBulkStatusChange}
                disabled={!bulkStatus}
                className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Update</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="text-xs hover:underline text-blue-200 font-bold ml-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry Modal Form */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-md border animate-scale-in space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-800 text-lg">Single Lead Entry Form</h3>
              <button onClick={() => setShowManualModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateManual} className="space-y-4">
              <input
                placeholder="Full Name"
                value={manualForm.name}
                onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                required
              />
              <input
                placeholder="Phone Number"
                value={manualForm.phone}
                onChange={e => setManualForm({ ...manualForm, phone: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                required
              />
              <input
                placeholder="Email Address (Optional)"
                type="email"
                value={manualForm.email}
                onChange={e => setManualForm({ ...manualForm, email: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
              />
              <input
                placeholder="Location (Optional)"
                value={manualForm.location}
                onChange={e => setManualForm({ ...manualForm, location: e.target.value })}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Target Pool</label>
                  <select
                    value={manualForm.pool_id}
                    onChange={e => setManualForm({ ...manualForm, pool_id: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold"
                    required
                  >
                    <option value="">-- Choose --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Campaign (Optional)</label>
                  <select
                    value={manualForm.campaign_id}
                    onChange={e => setManualForm({ ...manualForm, campaign_id: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold"
                  >
                    <option value="">-- Choose --</option>
                    {campaigns.filter(c => c.pool_id === manualForm.pool_id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-forgeBlue text-white text-sm py-2.5 rounded-xl font-bold hover:bg-blue-800 transition shadow-sm"
              >
                Create Lead
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lead Details & Disposition Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-md border animate-scale-in space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-gray-800 text-lg">Lead Profile Details</h3>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {selectedLead.lead_id}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600 font-medium">
              <div>Name: <strong className="text-gray-800">{selectedLead.name}</strong></div>
              <div>Phone: <strong className="text-gray-800">{selectedLead.phone}</strong></div>
              <div>Email: <strong className="text-gray-800">{selectedLead.email || "No Email"}</strong></div>
              <div>Location: <strong className="text-gray-800">{selectedLead.location || "N/A"}</strong></div>
              <div>Language: <strong className="text-gray-800">{selectedLead.language || "N/A"}</strong></div>
              {selectedLead.last_note && (
                <div className="bg-slate-50 border p-2.5 rounded-xl text-xs text-gray-500 mt-2">
                  <span className="block font-bold text-gray-700 mb-1">Last Interaction Note:</span>
                  "{selectedLead.last_note}"
                </div>
              )}
            </div>

            <form onSubmit={handleSaveDisposition} className="space-y-4 border-t pt-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Update Lead Disposition</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">State</label>
                  <select
                    value={detailStatus}
                    onChange={e => setDetailStatus(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="qualified">Qualified</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Follow Up Date</label>
                  <input
                    type="datetime-local"
                    value={detailFollowUp}
                    onChange={e => setDetailFollowUp(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 text-gray-700 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Disposition Notes</label>
                <textarea
                  placeholder="Record summary of outcome..."
                  value={detailNotes}
                  onChange={e => setDetailNotes(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 h-20 text-gray-700 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-forgeBlue text-white text-xs py-2.5 rounded-xl font-bold hover:bg-blue-800 transition"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
