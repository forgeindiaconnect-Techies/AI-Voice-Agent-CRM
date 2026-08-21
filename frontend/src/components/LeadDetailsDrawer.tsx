import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "./CustomSelect";
import CustomDateTimePicker from "./CustomDateTimePicker";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, PhoneCall, MessageSquare, Mail, User, MapPin, Clock,
  Sparkles, CheckCircle2, AlertCircle, Send, Activity, ChevronDown,
  Edit3, ExternalLink, Loader2, Save
} from "lucide-react";

export type LeadDrawerData = {
  id: string; lead_id?: string; name: string; phone: string; email?: string;
  location?: string; status: string; pool_id?: string; assigned_agent_id?: string;
  priority?: "urgent" | "high" | "medium" | "low"; ai_score?: number;
  last_contact_at?: string; created_at?: string; notes?: string; intent?: string;
  suggestions?: string[];
  history?: { timestamp: string; action: string; actor: string; notes?: string }[];
};

interface LeadDetailsDrawerProps {
  lead: any; onClose: () => void;
  onUpdateDisposition: (leadId: string, status: string, notes: string, followUpDate?: string) => Promise<void>;
  users?: { id: string; name: string; employee_id?: string }[];
  pools?: { id: string; name: string }[];
  onCall?: (lead: any) => void;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

const TEMPLATES = [
  { id: "intro", label: "Welcome & Intro", text: "Hello {name}, following up on your inquiry with Forge CRM. How can we assist you today?" },
  { id: "demo", label: "Schedule Demo", text: "Hi {name}, would you like to schedule a 15-minute live product demo of our AI Voice CRM?" },
  { id: "offer", label: "Special Plan Offer", text: "Hi {name}, we have an exclusive tier plan offer available for your team. Let us connect!" }
];

const DISPOSITION_STATUS_OPTIONS = [
  { value: "new", label: "New Lead" }, { value: "in_progress", label: "In Progress" },
  { value: "follow_up", label: "Follow-up Needed" }, { value: "qualified", label: "Qualified" },
  { value: "not_interested", label: "Not Interested" }, { value: "closed", label: "Closed / Won" }
];

const maskPhoneNumber = (phoneStr?: string): string => {
  if (!phoneStr) return "N/A";
  const clean = phoneStr.replace(/\D/g, "");
  if (clean.length >= 10) {
    const last10 = clean.slice(-10);
    return `+91 ${last10.slice(0, 4)}****${last10.slice(-3)}`;
  }
  return phoneStr;
};

const maskLeadName = (nameStr?: string): string => {
  if (!nameStr) return "Customer Lead";
  return nameStr.replace(/(\d{4})\d{3,4}(\d{3})/, "$1****$2");
};

export default function LeadDetailsDrawer({ lead, onClose, onUpdateDisposition, users = [], pools = [], onCall, showToast }: LeadDetailsDrawerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "disposition" | "timeline">("overview");
  const [isAiExpanded, setIsAiExpanded] = useState(true);
  const [status, setStatus] = useState(lead?.status || "new");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("intro");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customEmail, setCustomEmail] = useState(lead?.email || "");
  const [emailSubject, setEmailSubject] = useState("Follow up from Forge CRM");
  const [emailBody, setEmailBody] = useState(`Hi ${lead?.name || "Customer"},\n\nFollowing up regarding your lead inquiry with Forge CRM.\n\nBest regards,\nForge Team`);
  const [historyList, setHistoryList] = useState<any[]>([]);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status || "new"); setNotes(lead.notes || ""); setCustomEmail(lead.email || ""); setNotesError("");
      setWaMessage(TEMPLATES[0].text.replace("{name}", lead.name || "Customer"));
      const initialHistory = Array.isArray(lead.history) && lead.history.length > 0
        ? lead.history
        : [
            {
              timestamp: lead.created_at || new Date().toISOString(),
              action: "Created in CRM",
              actor: "System Automation",
              notes: `Source: ${lead.source || "Manual Dialer"}`
            }
          ];
      setHistoryList([...initialHistory]);
    }
  }, [lead]);

  // Real-time WebSocket timeline listener for lead activity events
  useEffect(() => {
    const handleActivityEvent = (evt: CustomEvent) => {
      const data = evt.detail;
      if (!data || !lead) return;
      const currentLeadId = lead.id || lead._id || lead.lead_id;
      const isTarget = data.lead_id === currentLeadId || data.lead_code === currentLeadId || (Array.isArray(data.lead_ids) && data.lead_ids.includes(currentLeadId));

      if (isTarget && data.history_entry) {
        setHistoryList((prev) => {
          const exists = prev.some(
            item => item.timestamp === data.history_entry.timestamp && item.action === data.history_entry.action
          );
          if (exists) return prev;
          return [data.history_entry, ...prev];
        });
      }
    };

    window.addEventListener("lead_activity_updated", handleActivityEvent as EventListener);
    return () => window.removeEventListener("lead_activity_updated", handleActivityEvent as EventListener);
  }, [lead]);

  useEffect(() => {
    document.body.classList.add("lead-modal-active");
    return () => {
      document.body.classList.remove("lead-modal-active");
    };
  }, []);

  if (!lead) return null;

  const assignedAgent = lead.assigned_agent_id ? users.find(u => u.id === lead.assigned_agent_id || u.employee_id === lead.assigned_agent_id) : undefined;
  const poolObj = pools.find(p => p.id === lead.pool_id || p.name === lead.pool_id);
  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
  const aiScore = lead.ai_score || 85;

  const handleCall = () => { if (onCall) onCall(lead); window.location.href = `tel:${lead.phone}`; showToast(`Initiating call with ${lead.name}...`, "info"); };
  const handleTemplateChange = (tplId: string) => { setSelectedTemplate(tplId); const tpl = TEMPLATES.find(t => t.id === tplId); if (tpl) setWaMessage(tpl.text.replace("{name}", lead.name || "Customer")); };
  const handleSendWhatsApp = () => { const p = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`; window.open(`https://wa.me/${p}?text=${encodeURIComponent(waMessage)}`, "_blank"); setShowWhatsAppModal(false); showToast(`Opened WhatsApp chat with ${lead.name}`, "success"); };
  const handleSendEmail = () => { const e = customEmail || lead.email; if (!e || e === "N/A") { showToast("Please specify a valid email address.", "warning"); return; } window.location.href = `mailto:${e}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`; setShowEmailModal(false); showToast(`Opening mail client for ${e}`, "info"); };

  const formatTimestamp = (ts: string) => {
    if (!ts) return "Just now";
    if (ts === "Today" || ts.includes("AM") || ts.includes("PM")) return ts;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return ts;
    }
  };

  const handleSaveDisposition = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!notes.trim()) { setNotesError("Please enter notes before saving."); setActiveTab("disposition"); return; }
    if (notes.trim().length < 5) { setNotesError("Notes must be at least 5 characters."); setActiveTab("disposition"); return; }
    setIsSubmitting(true); setNotesError("");

    const newEntry = {
      timestamp: new Date().toISOString(),
      action: `Disposition Updated to ${status.replace(/_/g, " ").toUpperCase()}`,
      actor: `${user?.name || "User"} (${(user?.role || "agent").replace(/_/g, " ").toUpperCase()})`,
      notes: notes.trim()
    };

    try { 
      await onUpdateDisposition(lead.id || lead._id || lead.lead_id, status, notes, followUpDate || undefined);
      setHistoryList(prev => [newEntry, ...prev]);
      showToast(`Disposition updated successfully!`, "success"); 
      onClose(); 
    }
    catch (err: any) { showToast(`Failed: ${err.message || "Server error"}`, "error"); }
    finally { setIsSubmitting(false); }
  };

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "disposition", label: "Disposition" },
    { id: "timeline", label: "Timeline" }
  ] as const;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 font-sans overflow-hidden box-border">
        {/* Translucent Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer z-[99998]"
        />

        {/* Compact Centered Workspace Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-[min(920px,78vw)] h-[min(520px,65vh)] max-w-[920px] max-h-[65vh] min-h-[380px] flex flex-col bg-white dark:bg-[#0D1526] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-[100000] box-border"
        >
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 left-0 w-80 h-80 bg-[#2563EB]/5 dark:bg-[#2563EB]/10 blur-3xl rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#FACC15]/5 dark:bg-[#FACC15]/8 blur-3xl rounded-full pointer-events-none translate-x-1/3 translate-y-1/3" />

          {/* 1. COMPACT FIXED MODAL HEADER */}
          <div className="sticky top-0 z-20 shrink-0 bg-white/95 dark:bg-[#0D1526]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar with Status Indicator */}
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#0F4FA8] via-[#1D4ED8] to-[#2563EB] text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white dark:border-[#1E293B] select-none">
                    {lead.name?.[0]?.toUpperCase() || "L"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0D1526] shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                      {maskLeadName(lead.name)}
                    </h2>
                    <span className="text-[9.5px] font-black text-[#0F4FA8] dark:text-[#FACC15] uppercase bg-amber-50 dark:bg-[#FACC15]/15 border border-amber-300/80 dark:border-[#FACC15]/30 px-2 py-0.5 rounded-full tracking-wider shadow-2xs">
                      {lead.status ? lead.status.replace(/_/g, " ").toUpperCase() : "QUALIFIED"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 text-[11.5px]">
                      <Phone className="h-3 w-3 text-[#0F4FA8] dark:text-blue-400" />
                      {maskPhoneNumber(lead.phone)}
                    </span>
                    <span className="font-mono text-[9.5px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded tracking-wider">
                      {lead.lead_id || "LD295084"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300/80 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                      {aiScore}% AI Fit
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center rounded-lg shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                title="Close Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 2. COMPACT TABS BAR */}
          <div className="px-4 pt-2 shrink-0 bg-white dark:bg-[#0D1526]">
            <div className="h-[38px] p-0.5 rounded-lg bg-slate-100 dark:bg-[#172033] grid grid-cols-3 gap-1">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-full rounded-md text-xs font-extrabold transition-all duration-200 ease-out cursor-pointer flex items-center justify-center active:scale-98 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-[#0F4FA8] font-black shadow-2xs border border-amber-300/60"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SCROLLABLE CONTENT BODY */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3 text-xs font-sans custom-scrollbar">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Contact Profile Card — Clean 3-Column Layout */}
                <div className="bg-white dark:bg-[#131F35] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                  <div className="px-4.5 py-2.5 bg-slate-50 dark:bg-[#1e293b] border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    <User className="h-3.5 w-3.5 text-[#0F4FA8] dark:text-blue-400" />
                    <span>CONTACT PROFILE</span>
                  </div>

                  <div className="p-4.5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3.5">
                    {/* Row 1: Phone, Email, Location */}
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        PHONE
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[#0F4FA8] shrink-0" />
                        {maskPhoneNumber(lead.phone)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        EMAIL
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate block">
                        {lead.email || "N/A"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        LOCATION
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {lead.location || "N/A"}
                      </span>
                    </div>

                    {/* Row 2: Target Pool, Assigned Agent, Priority */}
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        TARGET POOL
                      </span>
                      <span className="text-[10.5px] font-black text-[#0F4FA8] dark:text-[#FACC15] uppercase bg-blue-50 dark:bg-[#FACC15]/10 border border-blue-200/80 dark:border-[#FACC15]/25 px-2.5 py-0.5 rounded-full inline-block tracking-wider">
                        {poolObj?.name.replace(/_/g, " ") || "CUSTOMER SUPPORT"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        ASSIGNED AGENT
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {assignedAgent?.name || "Sales Agent"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                        PRIORITY
                      </span>
                      <span className={`text-[10.5px] font-black uppercase px-2.5 py-0.5 rounded-full inline-block border tracking-wider ${
                        lead.priority === "high" || lead.priority === "urgent"
                          ? "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
                          : "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                      }`}>
                        {lead.priority || "MEDIUM"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── DISPOSITION TAB ── */}
            {activeTab === "disposition" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {user?.role === "agent" && lead.status !== "new" ? (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4.5 flex items-start gap-3 shadow-2xs">
                    <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-[11px] uppercase tracking-wider text-rose-800 dark:text-rose-400 mb-0.5">
                        Read-Only Lead
                      </p>
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400/80 leading-relaxed">
                        Agents are only permitted to update the disposition of leads that are in NEW status.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveDisposition} className="bg-white dark:bg-[#131F35] rounded-xl p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                        <Edit3 className="h-3.5 w-3.5 text-[#0F4FA8] dark:text-blue-400" />
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        UPDATE DISPOSITION &amp; FOLLOW-UP
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                          Status Disposition
                        </label>
                        <CustomSelect
                          value={status}
                          onChange={setStatus}
                          options={DISPOSITION_STATUS_OPTIONS}
                          placeholder="Select Disposition"
                          triggerClassName="h-9 rounded-xl text-xs border-slate-200 dark:border-slate-700 dark:bg-[#0D1526]"
                        />
                      </div>

                      {(status === "follow_up" || status === "in_progress") && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                          <CustomDateTimePicker
                            label="Follow-up Date & Time"
                            value={followUpDate}
                            onChange={setFollowUpDate}
                            placeholder="Select Follow-up Date & Time"
                          />
                        </motion.div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Notes / Call Summary
                          </label>
                          <span className={`text-[10px] font-mono font-bold ${notes.length > 450 ? "text-rose-500" : "text-slate-400"}`}>
                            {notes.length} / 500
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={500}
                          placeholder="Enter conversation notes or next steps..."
                          value={notes}
                          onChange={e => {
                            setNotes(e.target.value);
                            if (notesError) setNotesError("");
                          }}
                          className={`w-full bg-slate-50/80 dark:bg-[#0D1526] border rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition-all duration-200 resize-none ${
                            notesError ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-800"
                          }`}
                        />
                        {notesError && (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {notesError}
                          </p>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </motion.div>
            )}

            {/* ── TIMELINE TAB ── */}
            {activeTab === "timeline" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-[#131F35] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                  <div className="px-4.5 py-3 bg-slate-50 dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400" />
                      <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        ACTIVITY LOG &amp; HISTORY
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border border-blue-200/80 dark:border-blue-500/30 px-2.5 py-0.5 rounded-full font-mono">
                      {historyList.length} Events
                    </span>
                  </div>

                  <div className="p-4.5">
                    <div className="relative pl-5 space-y-3.5 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
                      {historyList.map((item: any, idx: number) => {
                        const isLatest = idx === 0;
                        return (
                          <div key={idx} className="relative group">
                            {/* Dot Icon */}
                            <div className={`absolute -left-[27px] top-2 h-3 w-3 rounded-full border-2 border-white dark:border-[#0D1526] shadow-2xs ${
                              isLatest ? "bg-[#2563EB] ring-2 ring-blue-500/40 animate-pulse" : "bg-slate-400 dark:bg-slate-600"
                            }`} />
                            <div className={`bg-slate-50/90 dark:bg-[#0D1526] border rounded-xl p-3 transition-all ${
                              isLatest ? "border-blue-300 dark:border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/20" : "border-slate-200/80 dark:border-slate-800"
                            }`}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                    {item.action}
                                  </span>
                                  {isLatest && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-500 text-white tracking-widest animate-pulse">
                                      LIVE
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                                  <Clock className="h-3 w-3 text-blue-500" />
                                  {formatTimestamp(item.timestamp)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10.5px] font-medium text-slate-500 dark:text-slate-400 gap-2">
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                                  <User className="h-3 w-3 text-slate-400" />
                                  {item.actor}
                                </span>
                                {item.notes && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[280px]">
                                    "{item.notes}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* 4. COMPACT FIXED FOOTER BAR */}
          <div className="h-[52px] shrink-0 px-4 py-2 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0D1526] flex items-center justify-between gap-2.5 z-20 shadow-md">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCall}
                title="Call Lead"
                className="h-[34px] px-3 flex items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                <span>Call</span>
              </button>

              <button
                onClick={() => setShowWhatsAppModal(true)}
                title="WhatsApp"
                className="h-[34px] px-3 flex items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setShowEmailModal(true)}
                title="Email"
                className="h-[34px] px-3 flex items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-[#0F4FA8] dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-[#0F4FA8] hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>Email</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveDisposition()}
                disabled={isSubmitting || (user?.role === "agent" && lead.status !== "new")}
                title="Save Disposition"
                className="h-[34px] px-4 flex items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-extrabold bg-gradient-to-r from-[#0F4FA8] to-[#1D4ED8] hover:from-[#0B3C80] hover:to-[#1656B3] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save</span>
              </button>

              <button
                onClick={onClose}
                title="Close Modal"
                className="h-[34px] px-3.5 flex items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* WHATSAPP MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[100001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3.5 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">Send WhatsApp Message</h3>
                  <p className="text-[10.5px] font-semibold text-slate-400">{lead.name} · {lead.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Select Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => handleTemplateChange(t.id)} className={`p-2 rounded-xl text-[10px] font-extrabold transition border cursor-pointer active:scale-95 ${selectedTemplate === t.id ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-slate-50 dark:bg-[#0D1526] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100"}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Message Preview</label>
                <textarea rows={3} value={waMessage} onChange={e => setWaMessage(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-extrabold text-xs transition cursor-pointer">Cancel</button>
                <button onClick={handleSendWhatsApp} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><Send className="h-3.5 w-3.5" />Open WhatsApp</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3.5 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                  <Mail className="h-3.5 w-3.5 text-[#0F4FA8] dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">Send Email to Lead</h3>
                  <p className="text-[10.5px] font-semibold text-slate-400">{lead.name}</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Recipient Email</label>
                <input type="email" placeholder="Enter email address" value={customEmail} onChange={e => setCustomEmail(e.target.value)} className="w-full h-9 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full h-9 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Email Body</label>
                <textarea rows={3} value={emailBody} onChange={e => setEmailBody(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 font-medium resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-extrabold text-xs transition cursor-pointer">Cancel</button>
                <button onClick={handleSendEmail} className="flex-1 py-2 bg-[#0F4FA8] hover:bg-[#0B3C80] text-white rounded-xl font-extrabold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><ExternalLink className="h-3.5 w-3.5" />Open Mail Client</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
