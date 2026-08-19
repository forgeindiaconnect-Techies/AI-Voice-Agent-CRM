import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, Phone, PhoneCall, FileText, ListOrdered, Copy, Mail, Calendar, Clock,
  CheckCircle2, AlertCircle, Play, Pause, Loader2, Save, Send, Sparkles, UserCheck,
  ShieldCheck, Activity, PhoneMissed, HelpCircle, ExternalLink, Check
} from "lucide-react";
import CustomDateTimePicker from "./CustomDateTimePicker";

export type ActiveSlideOverTab = "profile" | "history" | "disposition" | "logs" | "dialer" | null;

export interface LeadActionSlideOverProps {
  activeTab: ActiveSlideOverTab;
  onClose: () => void;
  onSelectTab: (tab: ActiveSlideOverTab) => void;
  selectedLead: any | null;
  callHistory: any[];
  onQuickCall?: (lead: any) => void;
  onSaveDisposition: (status: string, notes: string, followUpDate?: string) => Promise<void>;
  isSavingDisposition: boolean;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  user?: any;
  dialerComponent?: any;
}

const DISPOSITION_OPTIONS = [
  { value: "interested", label: "Interested", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { value: "not_interested", label: "Not Interested", badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400" },
  { value: "call_back", label: "Call Back", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400" },
  { value: "no_answer", label: "No Answer", badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" },
  { value: "busy", label: "Busy / Line Busy", badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400" },
  { value: "wrong_number", label: "Wrong Number", badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400" },
  { value: "converted", label: "Converted / Won", badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400" },
  { value: "follow_up_required", label: "Follow-up Required", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400" },
  { value: "dnc", label: "Do Not Call (DNC)", badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300" }
];

export default function LeadActionSlideOver({
  activeTab,
  onClose,
  onSelectTab,
  selectedLead,
  callHistory,
  onQuickCall,
  onSaveDisposition,
  isSavingDisposition,
  showToast,
  user,
  dialerComponent
}: LeadActionSlideOverProps) {
  const [dispStatus, setDispStatus] = useState<string>("interested");
  const [dispNotes, setDispNotes] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (selectedLead) {
      setDispStatus(selectedLead.status || "interested");
      setDispNotes(selectedLead.notes || "");
    }
  }, [selectedLead]);

  if (!activeTab || !selectedLead) return null;

  const maskPhoneNumber = (phoneStr?: string) => {
    if (!phoneStr) return "N/A";
    const clean = phoneStr.replace(/\D/g, "");
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      return `+91 ${last10.slice(0, 3)}****${last10.slice(7)}`;
    }
    return phoneStr;
  };

  const leadId = selectedLead._id || selectedLead.id || "N/A";
  const leadName = selectedLead.name || "Customer Lead";
  const leadPhone = selectedLead.phone || "N/A";
  const maskedPhone = maskPhoneNumber(leadPhone);
  const leadEmail = selectedLead.email || `${leadPhone.replace(/\D/g, "")}@customer.crm`;
  const leadSource = selectedLead.source || "Manual";
  const leadStatus = selectedLead.status || "new";
  const createdDate = selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "Aug 14, 2026";
  const assignedAgent = selectedLead.assigned_agent_id || user?.name || "Agent Agila G";

  // Filter call history for selected lead
  const leadCalls = callHistory.filter((c: any) => {
    const cleanLeadPhone = leadPhone.replace(/\D/g, "");
    const callPhone = (c.phone || c.phone_number || "").replace(/\D/g, "");
    return (c.lead_id && (c.lead_id === leadId || c.lead_id === selectedLead._id)) ||
           (cleanLeadPhone && callPhone && (cleanLeadPhone.endsWith(callPhone) || callPhone.endsWith(cleanLeadPhone)));
  });

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(leadId);
    setCopiedId(true);
    showToast(`User ID copied: ${leadId}`, "success");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveDisp = async () => {
    try {
      await onSaveDisposition(dispStatus, dispNotes, followUpDate || undefined);
    } catch (err: any) {
      showToast(err.message || "Failed to save disposition", "error");
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "profile": return "User Profile";
      case "history": return "Call History";
      case "disposition": return "Lead Disposition";
      case "logs": return "Technical Call Logs";
      case "dialer": return "Softphone Dialer";
      default: return "Lead Action Panel";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 270 }}
        className="absolute right-0 top-0 bottom-0 w-[380px] sm:w-[420px] max-w-full bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-white/10 shadow-2xl z-30 flex flex-col rounded-r-[20px] overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-[#172033]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                {activeTab === "profile" && <User className="h-4 w-4" />}
                {activeTab === "history" && <PhoneCall className="h-4 w-4" />}
                {activeTab === "disposition" && <FileText className="h-4 w-4" />}
                {activeTab === "logs" && <ListOrdered className="h-4 w-4" />}
                {activeTab === "dialer" && <Phone className="h-4 w-4" />}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  {getTabTitle()}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[220px]">
                  {leadName} • <span className="font-mono text-blue-600 dark:text-blue-400">{maskedPhone}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab Navigation Rail Bar */}
          <div className="flex items-center gap-1 mt-3 p-1 bg-slate-200/60 dark:bg-[#1A2438] rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <button
              onClick={() => onSelectTab("profile")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === "profile" ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs" : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </button>
            <button
              onClick={() => onSelectTab("history")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === "history" ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs" : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
            <button
              onClick={() => onSelectTab("disposition")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === "disposition" ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs" : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Dispo</span>
            </button>
            <button
              onClick={() => onSelectTab("logs")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === "logs" ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs" : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Logs</span>
            </button>
            <button
              onClick={() => onSelectTab("dialer")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                activeTab === "dialer" ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs" : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Dialer</span>
            </button>
          </div>
        </div>

        {/* Panel Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 softphone-scrollbar">

          {/* TAB 1: USER PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {/* User Avatar Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#172033] border border-slate-200/80 dark:border-white/10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                  {leadName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                    {leadName}
                  </h4>
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {maskedPhone}
                  </p>
                  <span className="inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 text-emerald-600">
                    {leadStatus.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Profile Details List */}
              <div className="space-y-3 bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-2xs">
                {/* User ID */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">User ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                      {leadId}
                    </span>
                    <button
                      onClick={handleCopyUserId}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer"
                      title="Copy User ID"
                    >
                      {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Email</span>
                  <a
                    href={`mailto:${leadEmail}`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[190px]"
                  >
                    {leadEmail}
                  </a>
                </div>

                {/* Source */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Source</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {leadSource}
                  </span>
                </div>

                {/* Assigned Agent */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Assigned Agent</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                    {assignedAgent}
                  </span>
                </div>

                {/* Lead Status */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Lead Status</span>
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase">
                    {leadStatus}
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Created Date</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {createdDate}
                  </span>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="flex gap-2">
                <button
                  onClick={() => onQuickCall && onQuickCall(selectedLead)}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call Customer</span>
                </button>
                <button
                  onClick={handleCopyUserId}
                  className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy ID</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CALL HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Call Activity ({leadCalls.length})
                </h4>
                <span className="text-[10px] text-slate-400">Showing recent agent interactions</span>
              </div>

              {leadCalls.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#172033] border border-dashed border-slate-200 dark:border-white/10 text-center">
                  <PhoneMissed className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="font-extrabold text-xs text-slate-700 dark:text-white">No Call History Yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Initiate a call using Quick Dial to start logging call events.
                  </p>
                </div>
              ) : (
                leadCalls.map((call: any, idx: number) => {
                  const callDate = call.started_at || call.created_at ? new Date(call.started_at || call.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  }) : "Recently";
                  const durSec = call.duration_seconds || call.duration || 0;
                  const formattedDur = `${Math.floor(durSec / 60).toString().padStart(2, "0")}:${(durSec % 60).toString().padStart(2, "0")}`;

                  return (
                    <div
                      key={call._id || call.id || `call-${idx}`}
                      className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#172033]/80 border border-slate-200/80 dark:border-white/10 space-y-2 hover:border-blue-400 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <PhoneCall className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            {call.direction === "inbound" ? "Inbound Call" : "Outbound Call"}
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {callDate} • Agent: <strong className="text-slate-700 dark:text-slate-300">{call.agent_name || user?.name || "Agila G"}</strong>
                          </p>
                        </div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                          call.status === "completed" || call.outcome === "interested"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {call.outcome || call.status || "Answered"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-white/5">
                        <span>Duration: <strong>{formattedDur}</strong></span>
                        {call.recording_url ? (
                          <button
                            onClick={() => {
                              const audioId = call._id || call.id;
                              setPlayingAudioId(playingAudioId === audioId ? null : audioId);
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <Play className="h-3 w-3" />
                            <span>{playingAudioId === (call._id || call.id) ? "Hide Recording" : "Play Recording"}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">Recording N/A</span>
                        )}
                      </div>

                      {playingAudioId === (call._id || call.id) && call.recording_url && (
                        <div className="pt-2">
                          <audio controls src={call.recording_url} className="w-full h-8" autoPlay />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: DISPOSITION */}
          {activeTab === "disposition" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block mb-0.5">
                  Current Status
                </span>
                <span className="text-xs font-extrabold uppercase text-slate-900 dark:text-white">
                  {leadStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Select Call Outcome / Disposition
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DISPOSITION_OPTIONS.map((opt) => {
                    const isSelected = dispStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDispStatus(opt.value)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/40"
                            : "bg-slate-50 dark:bg-[#172033] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes Field */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Agent Remarks & Call Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed summary of agent discussion..."
                  value={dispNotes}
                  onChange={(e) => setDispNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Follow Up Date Picker */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Follow-up Date & Time
                </label>
                <CustomDateTimePicker
                  value={followUpDate}
                  onChange={setFollowUpDate}
                  placeholder="Select follow-up schedule..."
                />
              </div>

              {/* Save Disposition Button */}
              <button
                onClick={handleSaveDisp}
                disabled={isSavingDisposition}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSavingDisposition ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Lead Disposition</span>
              </button>
            </div>
          )}

          {/* TAB 4: CALL LOGS & TECHNICAL EVENTS */}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Call Diagnostics & Telemetry
                </h4>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Live Station
                </span>
              </div>

              {/* Session Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1 text-[11px]">
                  <span className="text-slate-400">Target Phone</span>
                  <span className="text-amber-400 font-bold">{leadPhone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1 text-[11px]">
                  <span className="text-slate-400">SIP Session State</span>
                  <span className="text-emerald-400 font-bold">ACTIVE / READY</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1 text-[11px]">
                  <span className="text-slate-400">Media Audio Codec</span>
                  <span className="text-blue-400 font-bold">Opus 48kHz Stereo</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Agent Extension</span>
                  <span className="text-purple-400 font-bold">{user?.id ? user.id.slice(-6) : "EX-104"}</span>
                </div>
              </div>

              {/* Event Timeline */}
              <div>
                <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Call Event Timeline
                </h5>
                <div className="space-y-2 relative border-l-2 border-slate-200 dark:border-white/10 ml-2 pl-3">
                  <div className="relative">
                    <div className="absolute -left-[17px] top-0.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/30" />
                    <span className="text-[10px] font-mono text-slate-400">11:30:00 AM</span>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      SIP WebRTC Session Initialized
                    </p>
                    <p className="text-[10px] text-slate-500">Twilio Voice SDK connected via WebSocket transport</p>
                  </div>

                  <div className="relative pt-2">
                    <div className="absolute -left-[17px] top-2.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-900/30" />
                    <span className="text-[10px] font-mono text-slate-400">11:30:03 AM</span>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      Outbound PSTN Ringing State
                    </p>
                    <p className="text-[10px] text-slate-500">Target carrier signal received (180 Ringing)</p>
                  </div>

                  <div className="relative pt-2">
                    <div className="absolute -left-[17px] top-2.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30" />
                    <span className="text-[10px] font-mono text-slate-400">11:30:06 AM</span>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      Call Connected & Answered
                    </p>
                    <p className="text-[10px] text-slate-500">Two-way audio channel established</p>
                  </div>

                  <div className="relative pt-2">
                    <div className="absolute -left-[17px] top-2.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900/30" />
                    <span className="text-[10px] font-mono text-slate-400">11:30:45 AM</span>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      Agent Updated Disposition
                    </p>
                    <p className="text-[10px] text-slate-500">Status set to: Interested</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SOFTPHONE DIALER */}
          {activeTab === "dialer" && (
            <div className="space-y-4">
              {dialerComponent}
            </div>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
