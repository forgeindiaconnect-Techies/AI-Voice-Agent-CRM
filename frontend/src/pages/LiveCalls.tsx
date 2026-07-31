import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  Radio,
  Headphones,
  Volume2,
  Mic,
  PhoneForwarded,
  HelpCircle,
  Clock
} from "lucide-react";

type Call = { id: string; lead_id: string; agent_id: string; pool_id: string; status: string; started_at: string };

const ICON_MAP: Record<string, React.ReactNode> = {
  listen: <Headphones className="h-3 w-3" />,
  whisper: <Volume2 className="h-3 w-3" />,
  barge: <Mic className="h-3 w-3" />,
  transfer: <PhoneForwarded className="h-3 w-3" />,
};

export default function LiveCalls() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [signal, setSignal] = useState<Record<string, string>>({});

  async function load() {
    try {
      const data = await api.get("/api/calls/live");
      setCalls(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function sendAction(callId: string, action: string) {
    try {
      await api.post(`/api/calls/${callId}/monitor?action=${action}`);
      setSignal((s) => ({ ...s, [callId]: `${action} signal sent` }));
      showToast(`Active signal ${action.toUpperCase()} sent to agent channel.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to trigger monitor signal.", "error");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Wrapper */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <Radio className="h-6 w-6 text-red-500 animate-pulse" />
              <span>Real-Time Voice Console</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Monitor active voice connections, whisper instructions, or barge into calls</p>
          </div>
          <span className="bg-red-50 text-red-700 text-xs font-bold border border-red-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>{calls.length} Active Call(s)</span>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b">
              <tr>
                <th className="px-5 py-3.5">Call ID</th>
                <th className="px-5 py-3.5">Agent</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50/50">
                  <td className="px-5 py-4 font-bold text-forgeBlue">{c.id.slice(-8).toUpperCase()}</td>
                  <td className="px-5 py-4 font-semibold text-gray-700">{c.agent_id}</td>
                  <td className="px-5 py-4 text-xs text-gray-400 font-bold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Active</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-700 uppercase tracking-wide">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 space-x-2">
                    {["listen", "whisper", "barge", "transfer"].map((a) => (
                      <button
                        key={a}
                        onClick={() => sendAction(c.id, a)}
                        className="text-xs bg-slate-50 border border-gray-200 text-gray-700 hover:bg-slate-100 font-bold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1 capitalize"
                      >
                        {ICON_MAP[a] || <HelpCircle className="h-3 w-3" />}
                        <span>{a}</span>
                      </button>
                    ))}
                    {signal[c.id] && (
                      <span className="text-xs text-forgeBlue font-bold bg-blue-50 border border-blue-200 px-2 py-1 rounded-md ml-2">
                        {signal[c.id]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium">
                    No active voice channels detected on dialer nodes.
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
