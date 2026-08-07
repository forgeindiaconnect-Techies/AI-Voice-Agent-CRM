import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  Calendar,
  Check,
  X,
  FileText,
  Clock,
  MessageSquare
} from "lucide-react";

type LeaveReq = {
  id: string;
  agent_id: string;
  agent_name?: string;
  reason: string;
  status: string;
  start_date: string;
  end_date: string;
};

export default function Leave() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  async function load() {
    try {
      const data = await api.get("/api/leave?status_filter=pending");
      setRequests(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, approve: boolean) {
    try {
      const decisionRemarks = remarks[id] || "";
      await api.patch(`/api/leave/${id}/decision`, { approve, remarks: decisionRemarks });
      showToast(approve ? "Leave request approved." : "Leave request rejected.", "success");
      
      setRemarks(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      load();
    } catch (err: any) {
      showToast(err.message || "Failed to make decision.", "error");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Wrapper (Normal Flow) */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-[16px] shadow-sm border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-500/20 dark:to-amber-500/10 text-[#1D4ED8] dark:text-[#FDE047] flex items-center justify-center font-bold shrink-0 shadow-2xs border border-amber-300/60 dark:border-amber-500/30">
            <Calendar className="h-6 w-6 text-[#1D4ED8] dark:text-[#FDE047]" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <div className="flex flex-col items-start">
                <h1 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Leave Approval</span>
                  <span className="text-[#F4B400] font-extrabold">Console</span>
                </h1>
              </div>
              <span className="bg-white dark:bg-[#0F172A] border border-[#2563EB]/40 dark:border-blue-400/40 text-[#1D4ED8] dark:text-[#60A5FA] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs inline-flex items-center gap-1.5 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400] animate-pulse"></span>
                {requests.length} PENDING
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">Review and decide on agent shift leave requests</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b">
              <tr>
                <th className="px-5 py-3.5">Agent</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Requested Dates</th>
                <th className="px-5 py-3.5">Decision Remarks</th>
                <th className="px-5 py-3.5">Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-800">{r.agent_name || "Unknown Agent"}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {r.agent_id.slice(-6).toUpperCase()}</div>
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-600 flex items-start gap-1.5 max-w-md">
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{r.reason}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500 font-semibold">
                    {new Date(r.start_date).toLocaleDateString()} – {new Date(r.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative w-full max-w-xs">
                      <input
                        type="text"
                        placeholder="Add feedback/justification..."
                        value={remarks[r.id] || ""}
                        onChange={(e) => setRemarks(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-full pl-8 pr-3 py-1.5 border rounded-xl text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-forgeBlue font-semibold text-gray-700"
                      />
                      <MessageSquare className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    </div>
                  </td>
                  <td className="px-5 py-4 space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => decide(r.id, true)}
                      className="text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 font-bold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => decide(r.id, false)}
                      className="text-xs bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium">
                    No pending shift leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
