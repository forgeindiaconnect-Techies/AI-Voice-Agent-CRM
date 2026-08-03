import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  FileText,
  Clock,
  ListOrdered,
  ChevronRight,
  Play,
  Radio
} from "lucide-react";

type Lead = { id: string; name: string; phone: string; status: string };

export default function Dialer() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("answered");

  useEffect(() => {
    api.get("/api/leads?status_filter=new").then(setLeads).catch(() => {});
  }, []);

  useEffect(() => {
    if (!callId) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callId]);

  async function startCall(lead: Lead) {
    try {
      const call = await api.post("/api/calls/start", { lead_id: lead.id, direction: "outbound" });
      setActiveLead(lead);
      setCallId(call.id);
      setSeconds(0);
      showToast(`Initiating call to ${lead.name}...`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to start call", "error");
    }
  }

  async function endCall() {
    if (!callId) return;
    try {
      await api.post("/api/calls/end", { call_id: callId, outcome, duration_seconds: seconds, notes });
      showToast(`Call outcome set: ${outcome.replace("_", " ").toUpperCase()}`, "success");
      setCallId(null);
      setActiveLead(null);
      setNotes("");
      setSeconds(0);
      api.get("/api/leads?status_filter=new").then(setLeads).catch(() => {});
    } catch (err: any) {
      showToast(err.message || "Failed to submit call details", "error");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Wrapper (Normal Flow) */}
      <div className="bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-forgeBlue animate-pulse" />
              <span>Outbound Dialer Workspace</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Handle new campaign leads, record outcomes, and submit shift call logs</p>
          </div>
          <span className="bg-blue-50 text-forgeBlue text-xs font-bold border border-blue-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <ListOrdered className="h-4 w-4" />
            <span>{leads.length} Leads Waiting</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Leads List Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-forgeBlue" />
            <span>New Leads Queue</span>
          </h2>
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between border rounded-2xl p-4 bg-gray-50/50 hover:bg-white transition">
                <div>
                  <div className="font-bold text-gray-800 text-sm">{l.name}</div>
                  <div className="text-xs text-gray-400 font-medium mt-0.5">{l.phone}</div>
                </div>
                <button
                  onClick={() => startCall(l)}
                  disabled={!!callId}
                  className="bg-forgeBlue text-white text-xs px-3.5 py-2 rounded-xl font-bold hover:bg-blue-800 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call</span>
                </button>
              </div>
            ))}
            {leads.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12 font-medium">No new leads in queue.</p>
            )}
          </div>
        </div>

        {/* Active Dialer Console */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            <span>Active Dialer Session</span>
          </h2>
          {activeLead ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border p-4 rounded-2xl">
                <div className="font-extrabold text-gray-800 text-base">{activeLead.name}</div>
                <div className="text-sm text-gray-500 font-medium mt-0.5">{activeLead.phone}</div>
                <div className="text-xs text-forgeBlue font-bold mt-3 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  <span>Duration: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Session Call Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Type important details, promises, or lead remarks..."
                  className="w-full border rounded-xl px-3 py-2 text-sm h-24 bg-gray-50 focus:ring-2 focus:ring-forgeBlue"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Call Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm w-full bg-gray-50 font-bold text-gray-700 focus:ring-2 focus:ring-forgeBlue"
                >
                  <option value="answered">Answered</option>
                  <option value="qualified">Qualified</option>
                  <option value="follow_up_required">Follow-up Required</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="transferred">Transferred</option>
                  <option value="voicemail">Voicemail</option>
                </select>
              </div>
              <button
                onClick={endCall}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneOff className="h-4 w-4" />
                <span>End Call Session</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <ChevronRight className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium">No active call session. Select a lead in the queue to begin dialing.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
