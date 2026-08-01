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
      {/* Top Header Wrapper */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <Calendar className="h-6 w-6 text-forgeBlue" />
              <span>Leave Approval Console</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Review and decide on agent shift leave requests</p>
          </div>
          <span className="bg-blue-50 text-forgeBlue text-xs font-bold border border-blue-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{requests.length} Pending</span>
          </span>
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
