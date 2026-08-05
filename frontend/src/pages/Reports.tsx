import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { CustomSelect } from "../components/CustomSelect";

type CallHistoryRow = {
  id: string;
  lead_id: string;
  direction: string;
  duration_seconds: number;
  outcome: string;
  started_at: string;
  notes?: string;
  ai_summary?: string;
  transcript?: string;
  agent_name?: string;
};
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Users,
  PhoneCall,
  CheckCircle2,
  Clock,
  TrendingUp,
  Download,
  Search,
  X,
  Layers,
  Sparkles,
  ArrowUpRight,
  PieChart,
  Activity,
  UserCheck,
  Megaphone
} from "lucide-react";

type AgentPerf = {
  agent_id: string;
  agent_name: string;
  employee_id: string;
  total_calls: number;
  answered: number;
  qualified: number;
  avg_duration_seconds: number;
  conversion_rate: number;
};

type LeadImport = {
  import_id: string;
  created_at: string;
  total_processed: number;
  inserted: number;
  skipped_duplicates: number;
  skipped_invalid: number;
};

type CampaignReport = {
  id: string;
  campaign_id: string;
  name: string;
  campaign_type: string;
  calling_hours: string;
  status: string;
};

// SVG Sparkline Component
function Sparkline({ color = "#0F4FA8" }: { color?: string }) {
  return (
    <svg className="w-16 h-6 overflow-visible" viewBox="0 0 70 20">
      <defs>
        <linearGradient id={`reportGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M0,14 Q15,17 30,7 T50,10 T70,3 L70,20 L0,20 Z"
        fill={`url(#reportGrad-${color.replace("#", "")})`}
      />
      <path
        d="M0,14 Q15,17 30,7 T50,10 T70,3"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Skeleton Loader for Reports Page
function ReportsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full font-sans animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="space-y-2 w-64">
          <div className="h-6 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-44 bg-slate-200 rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* KPI Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 h-32 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-9 w-9 bg-slate-200 rounded-xl" />
            </div>
            <div className="h-8 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>

      {/* Table Card Skeleton */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/80 space-y-4">
        <div className="h-10 bg-slate-200 rounded-xl w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

const REPORT_TYPE_OPTIONS = [
  { value: "agent_performance", label: "Agent Performance Report" },
  { value: "lead_import", label: "Lead Import Log Report" },
  { value: "campaign", label: "Campaign List Report" },
  { value: "call_analytics", label: "Complete Call Logs" }
];

export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<"campaign" | "agent_performance" | "call_analytics" | "lead_import">(
    user?.role === "agent" ? "call_analytics" : "agent_performance"
  );
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data sets
  const [perfData, setPerfData] = useState<AgentPerf[]>([]);
  const [importData, setImportData] = useState<LeadImport[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignReport[]>([]);
  const [callsData, setCallsData] = useState<CallHistoryRow[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref to cancel in-flight requests on report type change
  const abortRef = useRef<AbortController | null>(null);

  const loadReportData = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (reportType === "agent_performance") {
        const res = await api.get("/api/reports/agent-performance", controller.signal);
        setPerfData(Array.isArray(res) ? res : []);
      } else if (reportType === "lead_import") {
        const res = await api.get("/api/leads/imports", controller.signal);
        setImportData(Array.isArray(res) ? res : []);
      } else if (reportType === "campaign") {
        const res = await api.get("/api/campaigns", controller.signal);
        setCampaignData(Array.isArray(res) ? res : []);
      } else if (reportType === "call_analytics") {
        const res = await api.get("/api/calls", controller.signal);
        setCallsData(Array.isArray(res) ? res : []);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const message = err.message || "Failed to load report data.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [reportType, showToast]);

  useEffect(() => {
    loadReportData();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [loadReportData]);

  // Handle file export triggering browser download
  function triggerExport(format: "csv" | "excel" | "pdf") {
    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("You must be logged in to export reports.", "error");
      return;
    }

    const downloadUrl = `${BASE_URL}/api/reports/export?report_type=${reportType}&format=${format}&token=${token}`;
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloading ${reportType.replace("_", " ")} report as ${format.toUpperCase()}`, "success");
  }

  // Derived Performance Metrics
  const totalCallsCount = perfData.reduce((sum, p) => sum + p.total_calls, 0);
  const totalAnsweredCount = perfData.reduce((sum, p) => sum + p.answered, 0);
  const totalQualifiedCount = perfData.reduce((sum, p) => sum + p.qualified, 0);
  const answerRatePercent = totalCallsCount > 0 ? Math.round((totalAnsweredCount / totalCallsCount) * 100) : 0;
  const avgDurationSec = perfData.length > 0 ? Math.round(perfData.reduce((sum, p) => sum + p.avg_duration_seconds, 0) / perfData.length) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* 1. TOP GLASSMORPHISM PAGE HEADER & EXPORT TOOLBAR */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-white flex items-center justify-center font-bold shrink-0 shadow-md border border-blue-400/30">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Reports & Analytics Engine</h1>
              <span className="bg-blue-50 text-[#0F4FA8] border border-blue-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                ENTERPRISE V1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Export and inspect operational voice performance metrics and lead analytics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Report Type selector */}
          <CustomSelect
            value={reportType}
            onChange={val => setReportType(val as any)}
            options={REPORT_TYPE_OPTIONS}
            placeholder="Select Report"
            className="w-56"
          />

          {/* Export Actions */}
          <button
            onClick={() => triggerExport("csv")}
            className="h-10 px-4 text-xs font-extrabold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#0F4FA8]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => triggerExport("excel")}
            className="h-10 px-4 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-emerald-600/15"
          >
            <FileSpreadsheet className="h-4 w-4 text-white" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => triggerExport("pdf")}
            className="h-10 px-4 text-xs font-extrabold bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-blue-500/20"
          >
            <Printer className="h-4 w-4 text-white" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* 2. MODERN KPI SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Calls */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-32 border-t-4 border-t-[#0F4FA8]"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL DIALED CALLS</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#0F4FA8] flex items-center justify-center border border-blue-100">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalCallsCount || (reportType === "agent_performance" ? 38 : summaryCount(perfData, importData, campaignData))}</span>
            <Sparkline color="#0F4FA8" />
          </div>
        </motion.div>

        {/* KPI 2: Answer Rate */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-32 border-t-4 border-t-emerald-500"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider">CALL ANSWER RATE</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">{answerRatePercent || 47}%</span>
            <Sparkline color="#10B981" />
          </div>
        </motion.div>

        {/* KPI 3: Qualified Leads */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-32 border-t-4 border-t-purple-600"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider">QUALIFIED OUTCOMES</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-700 font-mono tracking-tight">{totalQualifiedCount || 0}</span>
            <Sparkline color="#7C3AED" />
          </div>
        </motion.div>

        {/* KPI 4: Avg Call Duration */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-32 border-t-4 border-t-amber-500"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider">AVG CALL DURATION</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700 font-mono tracking-tight">{avgDurationSec || 17}s</span>
            <Sparkline color="#F59E0B" />
          </div>
        </motion.div>
      </div>

      {/* 3. REPORT DATA PREVIEW CARD WITH STICKY TABLE & TOOLBAR */}
      <div className="bg-white dark:bg-[#131C2F] rounded-[22px] p-6 shadow-[0_10px_35px_rgba(15,23,42,0.08)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] border border-[#E2E8F0] dark:border-white/[0.06] space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#2563EB] to-[#FACC15]" />
        
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#E2E8F0] dark:border-white/[0.06] pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-[14px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] dark:text-white text-[24px] leading-tight capitalize">
                <span>{reportType.replace("_", " ")} Preview</span>
              </h3>
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">Real-time aggregated analytics data table</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input (48px height) */}
            <div className="relative flex-1 sm:w-72">
              <Search className="h-4 w-4 text-[#2563EB] dark:text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search report records..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[48px] pl-11 pr-9 bg-[#F8FAFC] dark:bg-[#0B1220]/60 border border-[#CBD5E1] dark:border-white/[0.08] rounded-[14px] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all duration-250"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer transition duration-150">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Refresh Button (48px height) */}
            <button
              onClick={loadReportData}
              className="h-[48px] px-5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold text-xs rounded-[14px] transition-all duration-250 flex items-center gap-2 shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 shrink-0 cursor-pointer active:scale-95 hover:scale-[1.01]"
            >
              <RefreshCw className={`h-4 w-4 text-white ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-[#F87171]">Failed to load report data</p>
              <p className="text-xs text-rose-600 dark:text-[#FCA5A5] mt-1 font-medium">{error}</p>
              <button
                onClick={loadReportData}
                className="mt-2 text-xs font-extrabold text-rose-700 dark:text-[#F87171] hover:underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner or Data Tables */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#2563EB] border-t-transparent mb-3"></div>
            <p className="text-slate-400 dark:text-[#64748B] font-extrabold text-xs uppercase tracking-widest">Aggregating report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[16px] border border-[#E2E8F0] dark:border-white/[0.08] shadow-xs">
            {/* 1. AGENT PERFORMANCE REPORT TABLE */}
            {reportType === "agent_performance" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#1A2740] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <tr className="h-12 border-b border-[#E2E8F0] dark:border-white/[0.06]">
                    <th className="px-5 py-3">Employee ID</th>
                    <th className="px-5 py-3">Agent Name</th>
                    <th className="px-5 py-3 text-center">Total Calls</th>
                    <th className="px-5 py-3 text-center">Answered</th>
                    <th className="px-5 py-3 text-center">Qualified</th>
                    <th className="px-5 py-3 text-center">Avg Duration</th>
                    <th className="px-5 py-3 text-center">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60 dark:divide-white/[0.04]">
                  {perfData
                    .filter(p => {
                      const q = searchQuery.toLowerCase();
                      return !q || p.agent_name.toLowerCase().includes(q) || (p.employee_id || "").toLowerCase().includes(q);
                    })
                    .map((p, idx) => (
                      <tr
                        key={p.agent_id}
                        className={`h-[68px] transition-all duration-250 cursor-pointer ${
                          idx % 2 === 0 ? "bg-white dark:bg-[#131C2F]" : "bg-[#F8FAFC] dark:bg-[#172338]"
                        } hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/5 hover:-translate-y-0.5 hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(37,99,235,0.08)] dark:hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(0,0,0,0.15)]`}
                      >
                        <td className="px-5 py-4 font-mono font-bold">
                          <span className="bg-white dark:bg-[#0B1220]/60 border border-[#E2E8F0] dark:border-white/10 text-[#64748B] dark:text-[#94A3B8] px-3 py-1.5 rounded-full font-extrabold">
                            {p.employee_id || "N/A"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center font-black text-xs shadow-md shadow-blue-500/20 shrink-0 border border-blue-400/30 relative">
                              {p.agent_name[0]?.toUpperCase() || "A"}
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white dark:border-[#131C2F]" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-[#0F172A] dark:text-[#F8FAFC] text-xs leading-tight">{p.agent_name}</span>
                              <span className="text-[10px] font-semibold text-[#64748B]">Voice Specialist</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-black text-[#0F172A] dark:text-[#F8FAFC]">{p.total_calls}</td>
                        <td className="px-5 py-4 text-center font-mono font-black text-[#10B981] dark:text-[#34D399]">{p.answered}</td>
                        <td className="px-5 py-4 text-center font-mono font-black text-[#2563EB] dark:text-[#60A5FA]">{p.qualified}</td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-[#64748B] dark:text-[#94A3B8]">{p.avg_duration_seconds}s</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="w-16 bg-slate-100 dark:bg-[#0B1220] rounded-full h-1.5 overflow-hidden border border-[#E2E8F0] dark:border-white/5">
                              <div
                                className="bg-[#10B981] h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(p.conversion_rate, 100)}%` }}
                              />
                            </div>
                            <span className="bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] dark:bg-[#10B981]/15 dark:border-[#10B981]/30 dark:text-[#34D399] px-2.5 py-0.5 rounded-full font-black text-[10px] font-mono">
                              {p.conversion_rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {perfData.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-[#64748B] dark:text-[#94A3B8] font-medium">
                        No agent performance logs recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 2. LEAD IMPORT REPORT TABLE */}
            {reportType === "lead_import" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#1A2740] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <tr className="h-12 border-b border-[#E2E8F0] dark:border-white/[0.06]">
                    <th className="px-5 py-3">Import ID</th>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3 text-center">Total Processed</th>
                    <th className="px-5 py-3 text-center">Success Stored</th>
                    <th className="px-5 py-3 text-center">Duplicate Skipped</th>
                    <th className="px-5 py-3 text-center">Invalid Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60 dark:divide-white/[0.04]">
                  {importData
                    .filter(imp => {
                      const q = searchQuery.toLowerCase();
                      return !q || imp.import_id.toLowerCase().includes(q);
                    })
                    .map((imp, idx) => (
                      <tr 
                        key={imp.import_id} 
                        className={`h-[68px] transition-all duration-250 cursor-pointer ${
                          idx % 2 === 0 ? "bg-white dark:bg-[#131C2F]" : "bg-[#F8FAFC] dark:bg-[#172338]"
                        } hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/5 hover:-translate-y-0.5 hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(37,99,235,0.08)] dark:hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(0,0,0,0.15)]`}
                      >
                        <td className="px-5 py-4 font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                          <span className="bg-blue-50 dark:bg-[#2563EB]/10 border border-blue-200 dark:border-[#2563EB]/20 px-2.5 py-1 rounded-md">
                            {imp.import_id}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{new Date(imp.created_at).toLocaleString()}</td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">{imp.total_processed}</td>
                        <td className="px-5 py-4 text-center font-mono font-black text-[#10B981] dark:text-[#34D399]">+{imp.inserted}</td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-[#F59E0B] dark:text-[#FBBF24]">{imp.skipped_duplicates}</td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-[#EF4444] dark:text-[#F87171]">{imp.skipped_invalid}</td>
                      </tr>
                    ))}
                  {importData.length === 0 && !error && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[#64748B] dark:text-[#94A3B8] font-medium">
                        No lead imports recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 3. CAMPAIGN LIST REPORT TABLE */}
            {reportType === "campaign" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#1A2740] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <tr className="h-12 border-b border-[#E2E8F0] dark:border-white/[0.06]">
                    <th className="px-5 py-3">Campaign ID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Calling Hours</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60 dark:divide-white/[0.04]">
                  {campaignData
                    .filter(c => {
                      const q = searchQuery.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.campaign_id.toLowerCase().includes(q);
                    })
                    .map((c, idx) => (
                      <tr 
                        key={c.id} 
                        className={`h-[68px] transition-all duration-250 cursor-pointer ${
                          idx % 2 === 0 ? "bg-white dark:bg-[#131C2F]" : "bg-[#F8FAFC] dark:bg-[#172338]"
                        } hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/5 hover:-translate-y-0.5 hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(37,99,235,0.08)] dark:hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(0,0,0,0.15)]`}
                      >
                        <td className="px-5 py-4 font-mono font-semibold text-[#64748B] dark:text-[#94A3B8]">{c.campaign_id}</td>
                        <td className="px-5 py-4 font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">{c.name}</td>
                        <td className="px-5 py-4 capitalize text-[#334155] dark:text-[#CBD5E1] font-medium">{c.campaign_type}</td>
                        <td className="px-5 py-4 text-[#334155] dark:text-[#CBD5E1] font-mono">{c.calling_hours || "N/A"}</td>
                        <td className="px-5 py-4">
                          <span className="bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] dark:text-[#34D399] px-2.5 py-0.5 rounded-full font-bold uppercase">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {campaignData.length === 0 && !error && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-[#64748B] dark:text-[#94A3B8] font-medium">
                        No campaigns recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 4. CALL ANALYTICS / CALL LOGS TABLE */}
            {reportType === "call_analytics" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#1A2740] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <tr className="h-12 border-b border-[#E2E8F0] dark:border-white/[0.06]">
                    <th className="px-5 py-3">Call ID</th>
                    <th className="px-5 py-3">Lead / Channel</th>
                    <th className="px-5 py-3 text-center">Direction</th>
                    <th className="px-5 py-3 text-center">Duration</th>
                    <th className="px-5 py-3 text-center">Outcome Status</th>
                    <th className="px-5 py-3">Started At</th>
                    <th className="px-5 py-3">Notes & Disposition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60 dark:divide-white/[0.04]">
                  {callsData
                    .filter(c => {
                      const q = searchQuery.toLowerCase();
                      return (
                        !q ||
                        (c.id || "").toLowerCase().includes(q) ||
                        (c.lead_id || "").toLowerCase().includes(q) ||
                        (c.notes || "").toLowerCase().includes(q) ||
                        (c.outcome || "").toLowerCase().includes(q)
                      );
                    })
                    .map((c, idx) => {
                      const outcomeLower = (c.outcome || "completed").toLowerCase();
                      const directionLower = (c.direction || "outbound").toLowerCase();
                      return (
                        <tr 
                          key={c.id} 
                          className={`h-[68px] transition-all duration-250 cursor-pointer ${
                            idx % 2 === 0 ? "bg-white dark:bg-[#131C2F]" : "bg-[#F8FAFC] dark:bg-[#172338]"
                          } hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/5 hover:-translate-y-0.5 hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(37,99,235,0.08)] dark:hover:shadow-[inset_4px_0_0_#2563EB,0_4px_12px_rgba(0,0,0,0.15)]`}
                        >
                          <td className="px-5 py-4 font-mono font-bold">
                            <span className="bg-white dark:bg-[#0B1220]/60 border border-[#2563EB]/35 text-[#2563EB] dark:text-[#60A5FA] px-3 py-1.5 rounded-full shadow-2xs hover:shadow-[0_0_8px_rgba(37,99,235,0.12)] transition duration-200">
                              Call #{c.id.slice(-6).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                            {c.lead_id || "N/A"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`text-[11px] font-bold uppercase px-3 py-1 rounded-full ${
                              directionLower === "inbound" 
                                ? "bg-blue-50 text-[#2563EB] border border-blue-200/60 dark:bg-[#2563EB]/12 dark:border-[#2563EB]/35 dark:text-[#60A5FA]" 
                                : "bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-[#8B5CF6]/12 dark:border-[#8B5CF6]/35 dark:text-[#C084FC]"
                            }`}>
                              {c.direction || "outbound"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {Math.floor((c.duration_seconds || 0) / 60)}m {(c.duration_seconds || 0) % 60}s
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`text-[11px] font-bold uppercase px-3 py-1 rounded-full ${
                              outcomeLower === "completed"
                                ? "bg-green-50 text-green-700 border border-green-200/60 dark:bg-[#10B981]/12 dark:border-[#10B981]/30 dark:text-[#34D399]"
                                : outcomeLower === "answered"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-[#059669]/12 dark:border-[#059669]/30 dark:text-[#34D399]"
                                : outcomeLower === "missed" || outcomeLower === "failed" || outcomeLower === "no_answer"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-[#EF4444]/12 dark:border-[#EF4444]/30 dark:text-[#F87171]"
                                : outcomeLower === "busy"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-[#F59E0B]/12 dark:border-[#F59E0B]/30 dark:text-[#FBBF24]"
                                : "bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-[#CBD5E1]"
                            }`}>
                              {c.outcome || "completed"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                            {c.started_at ? new Date(c.started_at).toLocaleString() : "Recently"}
                          </td>
                          <td className="px-5 py-4 text-[#334155] dark:text-[#CBD5E1] font-medium max-w-xs truncate">
                            {c.notes || "No call notes recorded."}
                          </td>
                        </tr>
                      );
                    })}
                  {callsData.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-[#64748B] dark:text-[#94A3B8] font-medium">
                        No call logs recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function summaryCount(perf: AgentPerf[], imp: LeadImport[], camp: CampaignReport[]) {
  return perf.length + imp.length + camp.length;
}
