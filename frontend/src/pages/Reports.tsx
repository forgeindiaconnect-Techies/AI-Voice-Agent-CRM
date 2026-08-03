import { useEffect, useState, useCallback, useRef } from "react";
import { api, BASE_URL } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  AlertTriangle
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

export default function Reports() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<"campaign" | "agent_performance" | "call_analytics" | "lead_import">("agent_performance");
  
  // Data sets
  const [perfData, setPerfData] = useState<AgentPerf[]>([]);
  const [importData, setImportData] = useState<LeadImport[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignReport[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref to cancel in-flight requests on report type change
  const abortRef = useRef<AbortController | null>(null);

  const loadReportData = useCallback(async () => {
    // Cancel any previous in-flight request
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
      // Ignore AbortErrors — they're expected when switching tabs
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

    // Cleanup: abort on unmount or report type change
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
    
    // Create temporary link and download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloading ${reportType.replace("_", " ")} report as ${format.toUpperCase()}`, "success");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Wrapper (Normal Flow) */}
      <div className="bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Reports & Analytics Engine</h1>
            <p className="text-sm text-gray-500 font-medium">Export and inspect operational voice performance data</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Report Type selector */}
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as any)}
              className="border rounded-xl px-3 py-2 text-sm bg-gray-50 font-bold text-gray-700 focus:ring-2 focus:ring-forgeBlue"
            >
              <option value="agent_performance">Agent Performance Report</option>
              <option value="lead_import">Lead Import Report</option>
              <option value="campaign">Campaign List Report</option>
              <option value="call_analytics">Complete Call Logs</option>
            </select>

            {/* Export Actions */}
            <button
              onClick={() => triggerExport("csv")}
              className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 border text-gray-700 rounded-xl transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => triggerExport("excel")}
              className="px-3.5 py-2 text-xs font-bold bg-[#10b981] hover:bg-emerald-600 text-white rounded-xl transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => triggerExport("pdf")}
              className="px-3.5 py-2 text-xs font-bold bg-forgeBlue hover:bg-blue-800 text-white rounded-xl transition flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Preview */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-gray-800 text-lg capitalize">
            {reportType.replace("_", " ")} Preview
          </h3>
          <button onClick={loadReportData} className="text-xs text-forgeBlue font-bold hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            <span>Refresh Preview</span>
          </button>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Failed to load report data</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <button
                onClick={loadReportData}
                className="mt-2 text-xs font-bold text-red-700 hover:text-red-900 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-forgeBlue border-t-transparent mb-3"></div>
            <p className="text-gray-400 font-bold text-sm">Aggregating report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {reportType === "agent_performance" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Agent Name</th>
                    <th className="px-4 py-3 text-center">Total Calls</th>
                    <th className="px-4 py-3 text-center">Answered</th>
                    <th className="px-4 py-3 text-center">Qualified</th>
                    <th className="px-4 py-3 text-center">Avg Duration (s)</th>
                    <th className="px-4 py-3 text-center">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {perfData.map(p => (
                    <tr key={p.agent_id} className="border-t hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-500">{p.employee_id}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{p.agent_name}</td>
                      <td className="px-4 py-3 text-center font-semibold">{p.total_calls}</td>
                      <td className="px-4 py-3 text-center text-green-700 font-medium">{p.answered}</td>
                      <td className="px-4 py-3 text-center text-forgeBlue font-medium">{p.qualified}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{p.avg_duration_seconds}s</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-bold text-xs">
                          {p.conversion_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {perfData.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-medium">
                        No agent performance logs recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {reportType === "lead_import" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Import ID</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3 text-center">Total Processed</th>
                    <th className="px-4 py-3 text-center">Success Stored</th>
                    <th className="px-4 py-3 text-center">Duplicate Skipped</th>
                    <th className="px-4 py-3 text-center">Invalid Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.map(imp => (
                    <tr key={imp.import_id} className="border-t hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-forgeBlue">{imp.import_id}</td>
                      <td className="px-4 py-3 text-gray-600 font-semibold">{new Date(imp.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold">{imp.total_processed}</td>
                      <td className="px-4 py-3 text-center text-green-700 font-black">+{imp.inserted}</td>
                      <td className="px-4 py-3 text-center text-orange-700 font-medium">{imp.skipped_duplicates}</td>
                      <td className="px-4 py-3 text-center text-red-700 font-medium">{imp.skipped_invalid}</td>
                    </tr>
                  ))}
                  {importData.length === 0 && !error && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-medium">
                        No lead imports recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {reportType === "campaign" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Campaign ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Calling Hours</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-500">{c.campaign_id}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{c.campaign_type}</td>
                      <td className="px-4 py-3 text-gray-600">{c.calling_hours || "N/A"}</td>
                      <td className="px-4 py-3">
                        <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold uppercase">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {campaignData.length === 0 && !error && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-medium">
                        No campaigns recorded in CRM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {reportType === "call_analytics" && (
              <div className="text-center py-10 text-gray-400 font-medium">
                Please use the export buttons above to download the full calls database report.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
