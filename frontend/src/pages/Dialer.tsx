import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { Device, Call } from "@twilio/voice-sdk";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  ListOrdered,
  ChevronRight,
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
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  
  // Twilio WebRTC state
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);

  useEffect(() => {
    api.get("/api/leads?status_filter=new").then(setLeads).catch(() => {});
    
    // Initialize Twilio Device
    const initTwilio = async () => {
      try {
        const { token } = await api.get("/api/calls/token");
        const device = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        device.on("registered", () => {
          setDeviceReady(true);
        });
        device.on("ready", () => {
          setDeviceReady(true);
        });

        device.on("error", (twilioError) => {
          console.error("Twilio Device Error:", twilioError);
          showToast(`Twilio Error: ${twilioError.message}`, "error");
        });

        await device.register();
        deviceRef.current = device;

        device.on("incoming", (call: Call) => {
          console.log("Incoming call from:", call.parameters.From);
          setIncomingCall(call);
          showToast(`Incoming call from ${call.parameters.From}`, "info");

          call.on("cancel", () => {
            setIncomingCall(null);
            showToast("Incoming call canceled", "info");
          });
          
          call.on("disconnect", () => {
            if (activeCallRef.current === call) {
              setCallId(null);
              setActiveLead(null);
              setSeconds(0);
              activeCallRef.current = null;
              showToast("Call ended", "info");
            } else {
              setIncomingCall(null);
            }
          });
        });
        
      } catch (err: any) {
        console.error("Failed to initialize Twilio:", err);
      }
    };
    
    initTwilio();
    
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!callId) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callId]);

  async function startCall(lead: Lead) {
    if (!deviceRef.current || !deviceReady) {
      showToast("WebRTC dialer is not ready yet. Please check microphone permissions and refresh.", "error");
      return;
    }

    try {
      // 1. Tell backend to log the call start in the database
      const callRecord = await api.post("/api/calls/start", { lead_id: lead.id, direction: "outbound" });
      
      // 2. Initiate actual browser-to-phone WebRTC call via Twilio
      const params = { To: lead.phone };
      const call = await deviceRef.current.connect({ params });
      
      call.on("accept", () => {
        showToast(`Call connected to ${lead.name}`, "success");
      });
      
      call.on("disconnect", () => {
        showToast(`Call ended`, "info");
      });
      
      activeCallRef.current = call;

      setActiveLead(lead);
      setCallId(callRecord.id);
      setSeconds(0);
      showToast(`Initiating WebRTC call to ${lead.name}...`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to start call", "error");
    }
  }

  async function endCall() {
    if (!callId) return;
    try {
      // End the Twilio WebRTC connection if it's active
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
        activeCallRef.current = null;
      }

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

  const acceptCall = () => {
    if (incomingCall) {
      incomingCall.accept();
      activeCallRef.current = incomingCall;
      setIncomingCall(null);
      setActiveLead({ id: "inbound", name: "Inbound Caller", phone: incomingCall.parameters.From || "Unknown", status: "in_progress" });
      setCallId("inbound-" + Date.now());
      setSeconds(0);
      showToast("Call answered", "success");
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
      showToast("Call rejected", "info");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-bounce">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-100 p-4 rounded-full">
                <PhoneCall className="h-8 w-8 text-green-600 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-gray-800 text-xl">Incoming Call</h3>
              <p className="text-gray-500 font-bold">{incomingCall.parameters.From || "Unknown Caller"}</p>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={rejectCall} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-bold transition">Reject</button>
              <button onClick={acceptCall} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/30 transition">Answer</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Wrapper */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-forgeBlue animate-pulse" />
              <span>Outbound Dialer Workspace</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Handle new campaign leads directly from your browser via WebRTC
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  await api.post("/api/calls/test-inbound");
                  showToast("Simulating inbound call...", "info");
                } catch (e: any) {
                  showToast("Failed to simulate call: " + e.message, "error");
                }
              }}
              className="bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-purple-200 transition"
              title="Test inbound ringing without international calling fees"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Simulate Call (Free)</span>
            </button>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${deviceReady ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              <div className={`w-2 h-2 rounded-full ${deviceReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span>{deviceReady ? 'WebRTC Ready' : 'Connecting to Twilio...'}</span>
            </span>
            <span className="bg-blue-50 text-forgeBlue text-xs font-bold border border-blue-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4" />
              <span>{leads.length} Leads Waiting</span>
            </span>
          </div>
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
                  disabled={!!callId || !deviceReady}
                  className="bg-forgeBlue text-white text-xs px-3.5 py-2 rounded-xl font-bold hover:bg-blue-800 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call via Browser</span>
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
            <span>Active WebRTC Session</span>
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
                <span>End WebRTC Call</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <ChevronRight className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium">No active call session. Select a lead to dial through your browser.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
