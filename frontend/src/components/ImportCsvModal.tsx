import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
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
  ArrowLeft,
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
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "new">("skip");

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
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
    return pools.map(p => ({ value: p.id, label: p.name.replace(/_/g, " ").toUpperCase() }));
  }, [pools]);

  // Filtered campaigns by selected pool
  const campaignOptions = useMemo(() => {
    const filtered = targetPoolId ? campaigns.filter(c => c.pool_id === targetPoolId) : campaigns;
    return [{ value: "", label: "All / Unassigned Campaign" }, ...filtered.map(c => ({ value: c.id, label: c.name }))];
  }, [campaigns, targetPoolId]);

  // Agents
  const agentOptions = useMemo(() => {
    const ags = users.filter(u => u.role === "agent");
    return [{ value: "", label: "Auto assign (Unassigned Agent)" }, ...ags.map(u => ({ value: u.id, label: u.name }))];
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
      showToast("Please link Lead Name and Phone Number headers to proceed.", "error");
      return;
    }
    if (!targetPoolId) {
      showToast("Target Pool selection is required.", "error");
      return;
    }

    setIsImporting(true);
    setImportProgress(20);

    const progressInterval = setInterval(() => {
      setImportProgress(prev => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const payload = {
        pool_id: targetPoolId,
        campaign_id: targetCampaignId || undefined,
        supervisor_id: targetSupervisorId || undefined,
        agent_id: targetAgentId || undefined,
        mapping,
        rows: previewData.all_rows,
        duplicate_strategy: duplicateStrategy === "new" ? "skip" : duplicateStrategy
      };

      const res = await api.post("/api/leads/import-process", payload);
      setImportProgress(100);
      clearInterval(progressInterval);

      setImportReport({
        total: res.total || 0,
        imported: res.imported || 0,
        updated: res.updated || 0,
        duplicates: res.duplicates || res.skipped_duplicates || 0,
        failed: res.failed || res.skipped_invalid || 0
      });

      showToast(`Successfully processed ${res.imported || 0} leads!`, "success");
      onImportSuccess();
    } catch (err: any) {
      clearInterval(progressInterval);
      showToast(err.message || "Failed to process CSV import.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 font-sans overflow-hidden box-border"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)"
        }}
      >
        {/* Centered Desktop Modal Container */}
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-[min(1180px,calc(100vw-48px))] max-h-[calc(100vh-48px)] flex flex-col bg-white dark:bg-[#0F172A] rounded-[20px] shadow-[0_25px_70px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white box-border"
        >
          {/* Brand Accent Bar */}
          <div className="h-1 bg-gradient-to-r from-[#0F4FA8] via-[#2563EB] to-[#FACC15] shrink-0" />

          {/* Fixed Header */}
          <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#0F172A]">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white truncate">
                <span>Import CSV Leads</span>
                {previewData.filename && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium truncate max-w-[200px]">
                    {previewData.filename}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Step 2 of 3 — Map CSV columns and validate records before database import
              </p>
            </div>

            {/* Compact 3-Step Stepper */}
            <div className="flex items-center gap-2 text-xs font-semibold bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 shrink-0">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="font-mono text-[10px]">01</span> Upload CSV
              </span>
              <span className="text-slate-300 dark:text-slate-700">→</span>
              <span className="text-[#0F4FA8] dark:text-blue-400 font-extrabold flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0F4FA8] dark:bg-blue-400 animate-pulse" />
                <span className="font-mono text-[10px]">02</span> Map &amp; Validate
              </span>
              <span className="text-slate-300 dark:text-slate-700">→</span>
              <span className="text-slate-400 flex items-center gap-1">
                <span className="font-mono text-[10px]">03</span> Review &amp; Import
              </span>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Close"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Scrollable Modal Body */}
          {importReport ? (
            /* Report Screen */
            <div className="p-8 space-y-6 flex-1 min-h-0 overflow-y-auto text-center flex flex-col items-center justify-center box-border">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Import Completed Successfully</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  All valid CSV records have been saved into your CRM database pipeline.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl w-full">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="block text-2xl font-black font-mono text-slate-800 dark:text-slate-100">{importReport.total}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Processed</span>
                </div>
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                  <span className="block text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{importReport.imported}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Imported</span>
                </div>
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                  <span className="block text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{importReport.duplicates}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Duplicates</span>
                </div>
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl">
                  <span className="block text-2xl font-black font-mono text-rose-600 dark:text-rose-400">{importReport.failed}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Invalid</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="h-10 px-8 bg-[#0F4FA8] hover:bg-[#0B3C80] text-white font-extrabold text-xs rounded-xl transition shadow-md cursor-pointer"
                >
                  View Updated Leads
                </button>
              </div>
            </div>
          ) : (
            /* Main Content Body */
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-5 space-y-4 bg-slate-50/60 dark:bg-[#0B1120] box-border custom-scrollbar">

              {/* 1. Summary Cards Responsive Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full min-w-0">
                {/* Detected */}
                <div className="h-[84px] min-w-0 w-full bg-white dark:bg-[#131C2F] px-4 py-3 rounded-[14px] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs box-border">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Detected</span>
                    <span className="text-2xl font-black font-mono text-slate-900 dark:text-white leading-none mt-1 block truncate">
                      {previewData.total_records}
                    </span>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-[#0F4FA8] dark:text-blue-400 rounded-lg shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                </div>

                {/* Valid */}
                <div className="h-[84px] min-w-0 w-full bg-white dark:bg-[#131C2F] px-4 py-3 rounded-[14px] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs box-border">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Valid</span>
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none mt-1 block truncate">
                      {evaluatedRows.valid}
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>

                {/* Duplicates */}
                <div className="h-[84px] min-w-0 w-full bg-white dark:bg-[#131C2F] px-4 py-3 rounded-[14px] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs box-border">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Duplicates</span>
                    <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 leading-none mt-1 block truncate">
                      {evaluatedRows.dupes}
                    </span>
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                </div>

                {/* Invalid */}
                <div className="h-[84px] min-w-0 w-full bg-white dark:bg-[#131C2F] px-4 py-3 rounded-[14px] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs box-border">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Invalid</span>
                    <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 leading-none mt-1 block truncate">
                      {evaluatedRows.invalid}
                    </span>
                  </div>
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Validation Warning Alert if Required Fields Unmapped */}
              {!isValidMapping && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-xs w-full min-w-0 box-border">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="truncate">
                    <strong>Action Required:</strong> Please map both <strong>Lead Name</strong> and <strong>Phone Number</strong> columns to enable import.
                  </span>
                </div>
              )}

              {/* 2. Column Mapping Card (Responsive 2-Column Grid) */}
              <div className="w-full max-w-full min-w-0 bg-white dark:bg-[#131C2F] border border-slate-200/80 dark:border-slate-800 rounded-[16px] p-4 shadow-2xs space-y-3 box-border overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 min-w-0">
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <Layers className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400 shrink-0" />
                      <span>Column Mapping</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      Map CSV columns to Forge CRM fields
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0">
                    {previewData.headers.length} columns detected
                  </span>
                </div>

                {/* 2-Column Responsive Mapping Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 pt-1 w-full min-w-0">
                  {/* Required: Lead Name */}
                  <div className="min-w-0 w-full">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 truncate">
                      Lead Name <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <CustomSelect
                      value={mapping.name}
                      onChange={(val) => setMapping(prev => ({ ...prev, name: val }))}
                      options={headerOptions}
                      placeholder="Select Lead Name Column"
                      triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                    />
                  </div>

                  {/* Required: Phone Number */}
                  <div className="min-w-0 w-full">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 truncate">
                      Phone Number <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <CustomSelect
                      value={mapping.phone}
                      onChange={(val) => setMapping(prev => ({ ...prev, phone: val }))}
                      options={headerOptions}
                      placeholder="Select Phone Number Column"
                      triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                    />
                  </div>

                  {/* Optional: Email */}
                  <div className="min-w-0 w-full">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center justify-between">
                      <span className="truncate">Email</span>
                      <span className="text-[10px] font-normal text-slate-400 shrink-0">optional</span>
                    </label>
                    <CustomSelect
                      value={mapping.email}
                      onChange={(val) => setMapping(prev => ({ ...prev, email: val }))}
                      options={headerOptions}
                      placeholder="Select Email Column"
                      triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                    />
                  </div>

                  {/* Optional: City */}
                  <div className="min-w-0 w-full">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center justify-between">
                      <span className="truncate">City / Location</span>
                      <span className="text-[10px] font-normal text-slate-400 shrink-0">optional</span>
                    </label>
                    <CustomSelect
                      value={mapping.location}
                      onChange={(val) => setMapping(prev => ({ ...prev, location: val }))}
                      options={headerOptions}
                      placeholder="Select City Column"
                      triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                    />
                  </div>

                  {/* Optional: Preferred Language */}
                  <div className="min-w-0 w-full">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center justify-between">
                      <span className="truncate">Preferred Language</span>
                      <span className="text-[10px] font-normal text-slate-400 shrink-0">optional</span>
                    </label>
                    <CustomSelect
                      value={mapping.language}
                      onChange={(val) => setMapping(prev => ({ ...prev, language: val }))}
                      options={headerOptions}
                      placeholder="Select Language Column"
                      triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                    />
                  </div>

                  {/* Inline Phone Normalization Info */}
                  <div className="flex items-end min-w-0 w-full">
                    <div className="w-full px-3 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 rounded-lg flex items-center gap-2 text-[11px] text-[#0F4FA8] dark:text-blue-300 min-w-0 truncate">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Indian phone numbers auto-normalized to +91XXXXXXXXXX</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Target Lead Pool & Duplicate Strategy */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full min-w-0">
                {/* Lead Pool Assignment Card */}
                <div className="w-full max-w-full min-w-0 bg-white dark:bg-[#131C2F] border border-slate-200/80 dark:border-slate-800 rounded-[16px] p-4 shadow-2xs space-y-3 flex flex-col justify-between box-border overflow-hidden">
                  <div className="pb-1 border-b border-slate-100 dark:border-slate-800 min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Lead Pool &amp; Assignment</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      Assign imported leads to department pool and optional agent
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
                    <div className="min-w-0 w-full">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 truncate">
                        Lead Pool <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <CustomSelect
                        value={targetPoolId}
                        onChange={setTargetPoolId}
                        options={poolOptions}
                        placeholder="Select Lead Pool"
                        triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                      />
                    </div>

                    <div className="min-w-0 w-full">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center justify-between">
                        <span className="truncate">Agent</span>
                        <span className="text-[10px] font-normal text-slate-400 shrink-0">optional</span>
                      </label>
                      <CustomSelect
                        value={targetAgentId}
                        onChange={setTargetAgentId}
                        options={agentOptions}
                        placeholder="Auto assign"
                        triggerClassName="h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 dark:bg-[#0B1120] w-full max-w-full min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Duplicate Strategy Radio Cards */}
                <div className="w-full max-w-full min-w-0 bg-white dark:bg-[#131C2F] border border-slate-200/80 dark:border-slate-800 rounded-[16px] p-4 shadow-2xs space-y-2 box-border overflow-hidden">
                  <div className="pb-1 border-b border-slate-100 dark:border-slate-800 min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <RotateCcw className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Duplicate Strategy</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      How to handle leads that match existing database records
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 w-full min-w-0">
                    {/* Skip */}
                    <div
                      onClick={() => setDuplicateStrategy("skip")}
                      className={`h-[64px] p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none min-w-0 w-full box-border ${
                        duplicateStrategy === "skip"
                          ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#0F4FA8] dark:border-blue-600 text-[#0F4FA8] dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="radio"
                          name="dup_strat"
                          checked={duplicateStrategy === "skip"}
                          onChange={() => setDuplicateStrategy("skip")}
                          className="accent-[#0F4FA8] shrink-0"
                        />
                        <span className="text-[11px] font-bold tracking-tight truncate">Skip duplicates</span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight block truncate pl-4">
                        Keep existing records
                      </span>
                    </div>

                    {/* Update */}
                    <div
                      onClick={() => setDuplicateStrategy("update")}
                      className={`h-[64px] p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none min-w-0 w-full box-border ${
                        duplicateStrategy === "update"
                          ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#0F4FA8] dark:border-blue-600 text-[#0F4FA8] dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="radio"
                          name="dup_strat"
                          checked={duplicateStrategy === "update"}
                          onChange={() => setDuplicateStrategy("update")}
                          className="accent-[#0F4FA8] shrink-0"
                        />
                        <span className="text-[11px] font-bold tracking-tight truncate">Update existing</span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight block truncate pl-4">
                        Overwrite lead info
                      </span>
                    </div>

                    {/* Import as new */}
                    <div
                      onClick={() => setDuplicateStrategy("new")}
                      className={`h-[64px] p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none min-w-0 w-full box-border ${
                        duplicateStrategy === "new"
                          ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#0F4FA8] dark:border-blue-600 text-[#0F4FA8] dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="radio"
                          name="dup_strat"
                          checked={duplicateStrategy === "new"}
                          onChange={() => setDuplicateStrategy("new")}
                          className="accent-[#0F4FA8] shrink-0"
                        />
                        <span className="text-[11px] font-bold tracking-tight truncate">Import as new</span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight block truncate pl-4">
                        Create separate lead
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CSV Preview Table */}
              <div className="w-full max-w-full min-w-0 bg-white dark:bg-[#131C2F] border border-slate-200/80 dark:border-slate-800 rounded-[16px] p-4 space-y-2 shadow-2xs box-border overflow-hidden">
                <div className="flex items-center justify-between min-w-0">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
                    CSV Preview
                  </h4>
                  <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                    {evaluatedRows.valid} valid / {evaluatedRows.rows.length} total records
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-lg max-h-[160px] w-full">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Lead Name</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">City</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {evaluatedRows.rows.slice(0, 10).map((r) => (
                        <tr key={r.index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-1.5 text-slate-400 font-mono text-[11px]">{r.index}</td>
                          <td className="px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100">{r.name}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {r.phone}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 text-[11px]">{r.email || "—"}</td>
                          <td className="px-3 py-1.5 text-slate-500 text-[11px]">{r.location || "—"}</td>
                          <td className="px-3 py-1.5 text-right">
                            {r.status === "valid" && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                ✓ Valid
                              </span>
                            )}
                            {r.status === "duplicate" && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                Duplicate
                              </span>
                            )}
                            {r.status === "invalid" && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title={r.errors.join(", ")}>
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

          {/* 5. Fixed Compact Action Footer (Height 64px, Padding 10px 24px) */}
          {!importReport && (
            <div className="h-[64px] px-6 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#0F172A] z-20 shadow-md box-border">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="h-[42px] px-4 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              {/* Dynamic Progress indicator during import */}
              {isImporting ? (
                <div className="flex-1 max-w-xs mx-4 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>Importing leads...</span>
                    <span className="font-mono">{importProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0F4FA8] to-[#2563EB] transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2.5">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="h-[42px] px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-[10px] transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting || !isValidMapping || evaluatedRows.valid === 0}
                  className={`h-[42px] px-5 text-white font-extrabold text-xs rounded-[10px] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isImporting || !isValidMapping || evaluatedRows.valid === 0
                      ? "bg-blue-600/50 cursor-not-allowed shadow-none"
                      : "bg-[#0F4FA8] hover:bg-[#0B3C80] shadow-blue-500/25 active:scale-95"
                  }`}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Import {evaluatedRows.valid} Leads</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
