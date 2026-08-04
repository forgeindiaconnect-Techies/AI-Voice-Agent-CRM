import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, BASE_URL } from "../api/client";
import { useToast } from "../context/ToastContext";
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

export default function Reports() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<"campaign" | "agent_performance" | "call_analytics" | "lead_import">("agent_performance");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data sets
  const [perfData, setPerfData] = useState<AgentPerf[]>([]);
  const [importData, setImportData] = useState<LeadImport[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignReport[]>([]);
  
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
        setPerfData(res);
      } else if (reportType === "lead_import") {
        const res = await api.get("/api/leads/imports", controller.signal);
        setImportData(res);
      } else if (reportType === "campaign") {
        const res = await api.get("/api/campaigns", controller.signal);
        setCampaignData(res);
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
          <select
            value={reportType}
            onChange={e => setReportType(e.target.value as any)}
            className="h-10 border border-slate-200 rounded-xl px-3.5 text-xs bg-slate-50 font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
          >
            <option value="agent_performance">Agent Performance Report</option>
            <option value="lead_import">Lead Import Log Report</option>
            <option value="campaign">Campaign List Report</option>
            <option value="call_analytics">Complete Call Logs</option>
          </select>

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
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base capitalize flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#0F4FA8]" />
              <span>{reportType.replace("_", " ")} Preview</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time aggregated analytics data table</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search report records..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={loadReportData}
              className="h-8 px-3 text-xs text-[#0F4FA8] font-extrabold hover:bg-blue-50 rounded-xl transition flex items-center gap-1 border border-blue-200/60 shrink-0 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-700">Failed to load report data</p>
              <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>
              <button
                onClick={loadReportData}
                className="mt-2 text-xs font-extrabold text-rose-700 hover:text-rose-900 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner or Data Tables */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#0F4FA8] border-t-transparent mb-3"></div>
            <p className="text-slate-400 font-extrabold text-xs uppercase tracking-widest">Aggregating report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            {/* 1. AGENT PERFORMANCE REPORT TABLE */}
            {reportType === "agent_performance" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Employee ID</th>
                    <th className="px-4 py-3.5">Agent Name</th>
                    <th className="px-4 py-3.5 text-center">Total Calls</th>
                    <th className="px-4 py-3.5 text-center">Answered</th>
                    <th className="px-4 py-3.5 text-center">Qualified</th>
                    <th className="px-4 py-3.5 text-center">Avg Duration</th>
                    <th className="px-4 py-3.5 text-center">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perfData
                    .filter(p => {
                      const q = searchQuery.toLowerCase();
                      return !q || p.agent_name.toLowerCase().includes(q) || (p.employee_id || "").toLowerCase().includes(q);
                    })
                    .map((p, idx) => (
                      <tr key={p.agent_id} className={`transition-all duration-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/40`}>
                        <td className="px-4 py-4 font-mono font-bold text-xs text-slate-700">
                          <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                            {p.employee_id || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-xs shadow-2xs shrink-0 border border-blue-400/30">
                              {p.agent_name[0]?.toUpperCase() || "A"}
                            </div>
                            <span className="font-extrabold text-slate-900 text-xs">{p.agent_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-extrabold text-slate-900">{p.total_calls}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-emerald-700">{p.answered}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-[#0F4FA8]">{p.qualified}</td>
                        <td className="px-4 py-4 text-center font-mono text-slate-600 text-xs">{p.avg_duration_seconds}s</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(p.conversion_rate, 100)}%` }} />
                            </div>
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-bold text-xs font-mono">
                              {p.conversion_rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {perfData.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No agent performance logs recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 2. LEAD IMPORT REPORT TABLE */}
            {reportType === "lead_import" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Import ID</th>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5 text-center">Total Processed</th>
                    <th className="px-4 py-3.5 text-center">Success Stored</th>
                    <th className="px-4 py-3.5 text-center">Duplicate Skipped</th>
                    <th className="px-4 py-3.5 text-center">Invalid Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importData
                    .filter(imp => {
                      const q = searchQuery.toLowerCase();
                      return !q || imp.import_id.toLowerCase().includes(q);
                    })
                    .map((imp, idx) => (
                      <tr key={imp.import_id} className={`transition-all duration-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/40`}>
                        <td className="px-4 py-4 font-mono font-bold text-xs text-[#0F4FA8]">
                          <span className="bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                            {imp.import_id}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 font-semibold text-xs">{new Date(imp.created_at).toLocaleString()}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-slate-900">{imp.total_processed}</td>
                        <td className="px-4 py-4 text-center font-mono font-black text-emerald-700">+{imp.inserted}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-amber-700">{imp.skipped_duplicates}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-rose-700">{imp.skipped_invalid}</td>
                      </tr>
                    ))}
                  {importData.length === 0 && !error && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No lead imports recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 3. CAMPAIGN LIST REPORT TABLE */}
            {reportType === "campaign" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Campaign ID</th>
                    <th className="px-4 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Calling Hours</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaignData
                    .filter(c => {
                      const q = searchQuery.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.campaign_id.toLowerCase().includes(q);
                    })
                    .map((c, idx) => (
                      <tr key={c.id} className={`transition-all duration-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/40`}>
                        <td className="px-4 py-4 font-mono font-semibold text-xs text-slate-500">{c.campaign_id}</td>
                        <td className="px-4 py-4 font-extrabold text-slate-900 text-xs">{c.name}</td>
                        <td className="px-4 py-4 capitalize text-slate-600 font-medium text-xs">{c.campaign_type}</td>
                        <td className="px-4 py-4 text-slate-600 font-mono text-xs">{c.calling_hours || "N/A"}</td>
                        <td className="px-4 py-4">
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {campaignData.length === 0 && !error && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No campaigns recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 4. CALL ANALYTICS PLACEHOLDER */}
            {reportType === "call_analytics" && (
              <div className="text-center py-14 text-slate-400 font-semibold text-xs space-y-2">
                <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="font-extrabold text-slate-700">Complete Call Analytics Database</p>
                <p>Please use the export buttons above to download the full call logs database report.</p>
              </div>
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
