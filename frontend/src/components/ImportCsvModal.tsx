import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  UserCheck,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Info,
  Check,
  RotateCcw
} from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { api } from "../api/client";

export interface ImportPreviewData {
  headers: string[];
  suggested_mapping: Record<string, string>;
  total_records: number;
  valid_count: number;
  invalid_count: number;
  duplicate_in_file: number;
  preview_rows: Array<{
    index: number;
    raw: Record<string, any>;
    parsed_name: string;
    parsed_phone: string;
    status: "valid" | "invalid" | "duplicate";
    errors: string[];
  }>;
  all_rows: Record<string, any>[];
  filename?: string;
}

interface Pool {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
  pool_id: string;
}

interface UserRow {
  id: string;
  name: string;
  role: string;
  pool_id?: string;
  supervisor_id?: string;
}

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: ImportPreviewData | null;
  pools: Pool[];
  campaigns: Campaign[];
  users: UserRow[];
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  onImportSuccess: () => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  previewData,
  pools,
  campaigns,
  users,
  showToast,
  onImportSuccess
}) => {
  if (!isOpen || !previewData) return null;

  const [mapping, setMapping] = useState<Record<string, string>>({
    name: previewData.suggested_mapping.name || "",
    phone: previewData.suggested_mapping.phone || "",
    email: previewData.suggested_mapping.email || "",
    location: previewData.suggested_mapping.location || "",
    language: previewData.suggested_mapping.language || ""
  });

  const [targetPoolId, setTargetPoolId] = useState<string>(pools.length > 0 ? pools[0].id : "");
  const [targetCampaignId, setTargetCampaignId] = useState<string>("");
  const [targetSupervisorId, setTargetSupervisorId] = useState<string>("");
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<{
    total: number;
    imported: number;
    updated: number;
    duplicates: number;
    failed: number;
  } | null>(null);

  // Available Header Options for Mapping
  const headerOptions = useMemo(() => {
    const opts = previewData.headers.map(h => ({ value: h, label: h }));
    return [{ value: "", label: "-- Do not map --" }, ...opts];
  }, [previewData.headers]);

  // Pool options
  const poolOptions = useMemo(() => {
    return pools.map(p => ({ value: p.id, label: p.name }));
  }, [pools]);

  // Filtered campaigns by selected pool
  const campaignOptions = useMemo(() => {
    const filtered = targetPoolId ? campaigns.filter(c => c.pool_id === targetPoolId) : campaigns;
    return [{ value: "", label: "All / Unassigned Campaign" }, ...filtered.map(c => ({ value: c.id, label: c.name }))];
  }, [campaigns, targetPoolId]);

  // Agents
  const agentOptions = useMemo(() => {
    const ags = users.filter(u => u.role === "agent");
    return [{ value: "", label: "Unassigned Agent (Pool Only)" }, ...ags.map(u => ({ value: u.id, label: u.name }))];
  }, [users]);

  const isValidMapping = Boolean(mapping.name && mapping.phone);

  // Re-evaluating row preview stats based on current mapping
  const evaluatedRows = useMemo(() => {
    const nameCol = mapping.name;
    const phoneCol = mapping.phone;
    const emailCol = mapping.email;
    const locationCol = mapping.location;

    let valid = 0;
    let invalid = 0;
    let dupes = 0;
    const seen = new Set<string>();

    const rows = previewData.all_rows.map((row, i) => {
      const rawName = nameCol ? String(row[nameCol] || "").trim() : "";
      const rawPhone = phoneCol ? String(row[phoneCol] || "").trim() : "";

      const digits = rawPhone.replace(/\D/g, "");
      let normPhone = rawPhone;
      if (digits.length === 10 && "6789".includes(digits[0])) {
        normPhone = `+91${digits}`;
      } else if (digits.length === 12 && digits.startsWith("91") && "6789".includes(digits[2])) {
        normPhone = `+${digits}`;
      }

      const isPhoneValid = /^\+91[6-9]\d{9}$/.test(normPhone);
      const isNameValid = rawName.length > 0;

      const errs: string[] = [];
      if (!isNameValid) errs.push("Missing Name");
      if (!rawPhone) errs.push("Missing Phone");
      else if (!isPhoneValid) errs.push("Invalid Phone");

      let st: "valid" | "invalid" | "duplicate" = "valid";
      if (errs.length > 0) {
        st = "invalid";
        invalid++;
      } else if (seen.has(normPhone)) {
        st = "duplicate";
        dupes++;
      } else {
        seen.add(normPhone);
        valid++;
      }

      return {
        index: i + 1,
        name: rawName || "—",
        phone: normPhone || rawPhone || "—",
        email: emailCol ? String(row[emailCol] || "").trim() : "",
        location: locationCol ? String(row[locationCol] || "").trim() : "",
        status: st,
        errors: errs
      };
    });

    return { rows, valid, invalid, dupes };
  }, [previewData, mapping]);

  const handleConfirmImport = async () => {
    if (!isValidMapping) {
      showToast("Please link Name and Phone headers to proceed.", "error");
      return;
    }
    if (!targetPoolId) {
      showToast("Target Pool selection is required.", "error");
      return;
    }

    setIsImporting(true);
    try {
      const payload = {
        pool_id: targetPoolId,
        campaign_id: targetCampaignId || undefined,
        supervisor_id: targetSupervisorId || undefined,
        agent_id: targetAgentId || undefined,
        mapping,
        rows: previewData.all_rows,
        duplicate_strategy: duplicateStrategy
      };

      const res = await api.post("/api/leads/import-process", payload);
      setImportReport({
        total: res.total || 0,
        imported: res.imported || 0,
        updated: res.updated || 0,
        duplicates: res.duplicates || res.skipped_duplicates || 0,
        failed: res.failed || res.skipped_invalid || 0
      });

      showToast(`Successfully imported ${res.imported || 0} leads!`, "success");
      onImportSuccess();
    } catch (err: any) {
      showToast(err.message || "Failed to process CSV import.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 font-sans overflow-hidden"
      style={{
        backgroundColor: "rgba(10, 15, 26, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)"
      }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-[1000px] max-h-[92vh] bg-white dark:bg-[#0F172A] rounded-[24px] shadow-[0_25px_70px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-900 dark:text-white"
      >
        {/* Brand Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#FACC15] shrink-0" />

        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#0F4FA8] dark:text-blue-400 flex items-center justify-center font-bold">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span>Import CSV Leads</span>
                {previewData.filename && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                    {previewData.filename}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Validate headers, preview records, and import leads directly into database
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        {importReport ? (
          /* Report Step */
          <div className="p-8 space-y-6 flex-1 overflow-y-auto text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Import Processed Successfully</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your CSV data has been processed and saved to the CRM database.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="block text-2xl font-black font-mono text-slate-800 dark:text-slate-100">{importReport.total}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Processed</span>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
                <span className="block text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{importReport.imported}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">New Leads</span>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                <span className="block text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{importReport.duplicates}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Duplicates</span>
              </div>
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl">
                <span className="block text-2xl font-black font-mono text-rose-600 dark:text-rose-400">{importReport.failed}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Invalid</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onClose}
                className="h-11 px-8 bg-[#0F4FA8] hover:bg-[#0B3C80] text-white font-extrabold text-sm rounded-xl transition shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                Done &amp; View Leads
              </button>
            </div>
          </div>
        ) : (
          /* Mapping & Preview Content */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-[#0B1120]">

            {/* Top Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-[#131C2F] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-[#0F4FA8] dark:text-blue-400 rounded-xl">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-lg font-mono font-black text-slate-900 dark:text-white leading-none">
                    {previewData.total_records}
                  </span>
                  <span className="text-[11px] font-bold uppercase text-slate-400">Detected Records</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131C2F] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-lg font-mono font-black text-emerald-600 dark:text-emerald-400 leading-none">
                    {evaluatedRows.valid}
                  </span>
                  <span className="text-[11px] font-bold uppercase text-slate-400">Valid Leads</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131C2F] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-lg font-mono font-black text-amber-600 dark:text-amber-400 leading-none">
                    {evaluatedRows.dupes}
                  </span>
                  <span className="text-[11px] font-bold uppercase text-slate-400">In-File Duplicates</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131C2F] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-lg font-mono font-black text-rose-600 dark:text-rose-400 leading-none">
                    {evaluatedRows.invalid}
                  </span>
                  <span className="text-[11px] font-bold uppercase text-slate-400">Invalid Records</span>
                </div>
              </div>
            </div>

            {/* Validation Warning Alert if required columns missing */}
            {!isValidMapping && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs">
                  <span className="font-extrabold block">Missing Required Column Mapping</span>
                  Please select which CSV headers link to <strong>Customer Name</strong> and <strong>Phone Number</strong>.
                </div>
              </div>
            )}

            {/* Section 1: Header Mapping Grid */}
            <div className="bg-white dark:bg-[#131C2F] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400" />
                    <span>Header Mapping</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Match CSV columns to CRM database fields
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Detected {previewData.headers.length} Columns
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={mapping.name}
                    onChange={(val) => setMapping(prev => ({ ...prev, name: val }))}
                    options={headerOptions}
                    placeholder="Select Name Column"
                    triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={mapping.phone}
                    onChange={(val) => setMapping(prev => ({ ...prev, phone: val }))}
                    options={headerOptions}
                    placeholder="Select Phone Column"
                    triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                    Email Address <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <CustomSelect
                    value={mapping.email}
                    onChange={(val) => setMapping(prev => ({ ...prev, email: val }))}
                    options={headerOptions}
                    placeholder="Select Email Column"
                    triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                    Location / City <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <CustomSelect
                    value={mapping.location}
                    onChange={(val) => setMapping(prev => ({ ...prev, location: val }))}
                    options={headerOptions}
                    placeholder="Select Location Column"
                    triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                    Preferred Language <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <CustomSelect
                    value={mapping.language}
                    onChange={(val) => setMapping(prev => ({ ...prev, language: val }))}
                    options={headerOptions}
                    placeholder="Select Language Column"
                    triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl text-[11px] text-blue-700 dark:text-blue-300">
                    Indian phone numbers (`9444667411`, `919444...`) will be automatically normalized to `+91XXXXXXXXXX`.
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pipeline Target & Duplicate Handling */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Target Assignment */}
              <div className="bg-white dark:bg-[#131C2F] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    <span>Target Pool &amp; Assignment</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign imported leads to department pool and optional agent
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                      Target Lead Pool <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={targetPoolId}
                      onChange={setTargetPoolId}
                      options={poolOptions}
                      placeholder="Select Lead Pool"
                      triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                        Campaign (optional)
                      </label>
                      <CustomSelect
                        value={targetCampaignId}
                        onChange={setTargetCampaignId}
                        options={campaignOptions}
                        placeholder="Select Campaign"
                        triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 block mb-1">
                        Assigned Agent (optional)
                      </label>
                      <CustomSelect
                        value={targetAgentId}
                        onChange={setTargetAgentId}
                        options={agentOptions}
                        placeholder="Select Agent"
                        triggerClassName="h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700 dark:bg-[#0B1120]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Duplicate Handling Strategy */}
              <div className="bg-white dark:bg-[#131C2F] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-500" />
                    <span>Duplicate Strategy</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    How to handle leads that match existing database records
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <label
                    onClick={() => setDuplicateStrategy("skip")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      duplicateStrategy === "skip"
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#0F4FA8] dark:border-blue-600 text-slate-900 dark:text-white"
                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="dup_strat"
                      checked={duplicateStrategy === "skip"}
                      onChange={() => setDuplicateStrategy("skip")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold block">Skip duplicates (Recommended)</span>
                      <span className="text-[11px] opacity-80 block">
                        Keep existing database lead records intact and ignore duplicate entries.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setDuplicateStrategy("update")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      duplicateStrategy === "update"
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#0F4FA8] dark:border-blue-600 text-slate-900 dark:text-white"
                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="dup_strat"
                      checked={duplicateStrategy === "update"}
                      onChange={() => setDuplicateStrategy("update")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold block">Update existing leads</span>
                      <span className="text-[11px] opacity-80 block">
                        Overwrite location, campaign, and assignment for existing lead matches.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 3: Interactive Records Preview Table */}
            <div className="bg-white dark:bg-[#131C2F] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Preview Imported Records (Showing first {Math.min(evaluatedRows.rows.length, 50)})
                </h4>
                <span className="text-xs font-mono text-slate-400 font-bold">
                  {evaluatedRows.valid} Valid / {evaluatedRows.rows.length} Total
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[220px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {evaluatedRows.rows.slice(0, 50).map((r) => (
                      <tr key={r.index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-400 font-mono">{r.index}</td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">{r.name}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {r.phone}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.location || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {r.status === "valid" && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Valid
                            </span>
                          )}
                          {r.status === "duplicate" && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Duplicate
                            </span>
                          )}
                          {r.status === "invalid" && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title={r.errors.join(", ")}>
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Footer Controls */}
        {!importReport && (
          <div className="h-18 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#0F172A]">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="h-10 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={isImporting || !isValidMapping || evaluatedRows.valid === 0}
              className={`h-11 px-7 text-white font-extrabold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                isImporting || !isValidMapping || evaluatedRows.valid === 0
                  ? "bg-blue-600/50 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] shadow-blue-500/25 active:scale-95"
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing {evaluatedRows.valid} Records...</span>
                </>
              ) : (
                <>
                  <span>Import {evaluatedRows.valid} Leads</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
