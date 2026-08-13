import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "./CustomSelect";
import CustomDateTimePicker from "./CustomDateTimePicker";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, PhoneCall, MessageSquare, Mail, User, MapPin, Clock,
  Sparkles, CheckCircle2, AlertCircle, Send, Activity, ChevronDown,
  FileText, Edit3, ExternalLink, Loader2, Save, Star, Target, Users,
  Building2, ArrowRight
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

  useEffect(() => {
    if (lead) {
      setStatus(lead.status || "new"); setNotes(lead.notes || ""); setCustomEmail(lead.email || ""); setNotesError("");
      setWaMessage(TEMPLATES[0].text.replace("{name}", lead.name || "Customer"));
    }
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

  const handleSaveDisposition = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!notes.trim()) { setNotesError("Please enter notes before saving."); setActiveTab("disposition"); return; }
    if (notes.trim().length < 5) { setNotesError("Notes must be at least 5 characters."); setActiveTab("disposition"); return; }
    setIsSubmitting(true); setNotesError("");
    try { await onUpdateDisposition(lead.id, status, notes, followUpDate || undefined); showToast(`Disposition updated successfully!`, "success"); onClose(); }
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
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 font-sans overflow-hidden box-border">
        {/* Professional Translucent Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer z-[99998]"
        />

        {/* Desktop-First Large Centered Workspace Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-[min(1380px,calc(100vw-80px))] h-[min(860px,calc(100vh-40px))] max-w-[1380px] max-h-[calc(100vh-40px)] flex flex-col bg-white dark:bg-[#0D1526] border border-slate-200 dark:border-slate-800 rounded-[22px] shadow-2xl overflow-hidden relative z-[100000] box-border"
        >
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#2563EB]/5 dark:bg-[#2563EB]/10 blur-3xl rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FACC15]/5 dark:bg-[#FACC15]/8 blur-3xl rounded-full pointer-events-none translate-x-1/3 translate-y-1/3" />

          {/* 1. FIXED MODAL HEADER */}
          <div className="sticky top-0 z-20 shrink-0 bg-white/95 dark:bg-[#0D1526]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-7 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* 58-64px Avatar with Status Dot */}
                <div className="relative shrink-0">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-[18px] bg-gradient-to-br from-[#0F4FA8] via-[#1D4ED8] to-[#2563EB] text-white font-black text-xl flex items-center justify-center shadow-md border-2 border-white dark:border-[#1E293B] select-none">
                    {lead.name?.[0]?.toUpperCase() || "L"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0D1526] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                      {lead.name}
                    </h2>
                    <span className="text-xs font-black text-[#0F4FA8] dark:text-[#FACC15] uppercase bg-amber-50 dark:bg-[#FACC15]/15 border border-amber-300 dark:border-[#FACC15]/30 px-3 py-1 rounded-full tracking-wider shadow-2xs">
                      {lead.status ? lead.status.replace(/_/g, " ").toUpperCase() : "QUALIFIED"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                      <Phone className="h-3.5 w-3.5 text-[#0F4FA8] dark:text-blue-400" />
                      {lead.phone}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 rounded-md tracking-wider">
                      {lead.lead_id || "LD295084"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      {aiScore}% AI Fit
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all duration-200 cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 2. TABS BAR (Height 64px, rounded 16px, grid 3-columns) */}
          <div className="px-7 pt-4 shrink-0 bg-white dark:bg-[#0D1526]">
            <div className="h-[64px] p-1 rounded-[16px] bg-[#f1f5f9] dark:bg-[#172033] grid grid-cols-3 gap-1">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-full rounded-[12px] text-sm font-extrabold transition-all duration-200 ease-out cursor-pointer flex items-center justify-center active:scale-98 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-[#0F4FA8] font-black shadow-[0_4px_16px_rgba(234,179,8,0.35)] border border-amber-300/60"
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
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-7 py-6 space-y-6 text-xs font-sans custom-scrollbar">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Contact Profile Card */}
                <div className="bg-white dark:bg-[#131F35] rounded-[20px] border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="px-6 py-3.5 bg-[#f8fafc] dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    <User className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400" />
                    <span>CONTACT PROFILE</span>
                  </div>

                  <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        PHONE
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[#0F4FA8] shrink-0" />
                        {lead.phone}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        EMAIL
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate block">
                        {lead.email || "N/A"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        LOCATION
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        {lead.location || "N/A"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        TARGET POOL
                      </span>
                      <span className="text-xs font-black text-[#0F4FA8] dark:text-[#FACC15] uppercase bg-blue-50 dark:bg-[#FACC15]/10 border border-blue-200 dark:border-[#FACC15]/25 px-3 py-1 rounded-full inline-block tracking-wider">
                        {poolObj?.name.replace(/_/g, " ") || "CUSTOMER SUPPORT"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        ASSIGNED AGENT
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {assignedAgent?.name || "Unassigned"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        PRIORITY
                      </span>
                      <span className={`text-xs font-black uppercase px-3 py-1 rounded-full inline-block border tracking-wider ${
                        lead.priority === "high" || lead.priority === "urgent"
                          ? "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
                          : "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                      }`}>
                        {lead.priority || "MEDIUM"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Telemetry & Copilot Card */}
                <div className="bg-white dark:bg-[#131F35] rounded-[20px] border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                  <button
                    onClick={() => setIsAiExpanded(!isAiExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-[#f8fafc] dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 cursor-pointer text-left hover:brightness-[1.01] transition-all duration-200"
                  >
                    <span className="flex items-center gap-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                      <Sparkles className="h-4.5 w-4.5 text-[#FACC15]" />
                      <span>AI TELEMETRY &amp; COPILOT</span>
                    </span>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black font-mono bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-[#0F4FA8] px-3 py-0.5 rounded-full border border-amber-300/50 shadow-2xs">
                        {aiScore}%
                      </span>
                      <ChevronDown className={`h-4.5 w-4.5 text-slate-400 transition-transform duration-200 ${isAiExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {isAiExpanded && (
                    <div className="p-6 space-y-5">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          DETECTED INTENT
                        </span>
                        <div className="p-4 bg-slate-50 dark:bg-[#0D1526] rounded-xl border border-slate-200/80 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {lead.intent || "Product tier inquiry & subscription pricing request"}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          COPILOT RECOMMENDATIONS
                        </span>
                        <div className="space-y-2.5">
                          {(lead.suggestions || [
                            "Share official enterprise product brochure link",
                            "Confirm preferred callback slot for technical demo"
                          ]).map((sug: string, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-[#0D1526] rounded-xl border border-slate-200/80 dark:border-slate-800">
                              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {sug}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── DISPOSITION TAB ── */}
            {activeTab === "disposition" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {user?.role === "agent" && lead.status !== "new" ? (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-[20px] p-6 flex items-start gap-3 shadow-xs">
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-xs uppercase tracking-wider text-rose-800 dark:text-rose-400 mb-1">
                        Read-Only Lead
                      </p>
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400/80 leading-relaxed">
                        Agents are only permitted to update the disposition of leads that are in NEW status.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveDisposition} className="bg-white dark:bg-[#131F35] rounded-[20px] p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-6">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                        <Edit3 className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                        UPDATE DISPOSITION &amp; FOLLOW-UP
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          Status Disposition
                        </label>
                        <CustomSelect
                          value={status}
                          onChange={setStatus}
                          options={DISPOSITION_STATUS_OPTIONS}
                          placeholder="Select Disposition"
                          triggerClassName="h-11 rounded-xl text-xs border-slate-200 dark:border-slate-700 dark:bg-[#0D1526]"
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
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Notes / Call Summary
                          </label>
                          <span className={`text-[10px] font-mono font-bold ${notes.length > 450 ? "text-rose-500" : "text-slate-400"}`}>
                            {notes.length} / 500
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          maxLength={500}
                          placeholder="Enter conversation notes or next steps..."
                          value={notes}
                          onChange={e => {
                            setNotes(e.target.value);
                            if (notesError) setNotesError("");
                          }}
                          className={`w-full bg-slate-50 dark:bg-[#0D1526] border rounded-xl p-4 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition-all duration-200 resize-none ${
                            notesError ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-800"
                          }`}
                        />
                        {notesError && (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 shrink-0" />
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="bg-white dark:bg-[#131F35] rounded-[20px] border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 bg-[#f8fafc] dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Activity className="h-4.5 w-4.5 text-[#0F4FA8] dark:text-blue-400" />
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                        ACTIVITY LOG &amp; HISTORY
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-3 py-1 rounded-full">
                      {(lead.history || []).length || 3} Events
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="relative pl-6 space-y-6 border-l-2 border-slate-200 dark:border-slate-800 ml-3">
                      {(lead.history || [
                        { timestamp: lead.created_at || "11 Aug 2026 · 9:39 AM", action: "Created in CRM", actor: "System Automation" },
                        { timestamp: "Today", action: "Assigned to Pool", actor: "Supervisor Protocol" },
                        { timestamp: "14 Aug 2026 · 4:15 AM", action: "Follow-up Scheduled", actor: "Admin" }
                      ]).map((item: any, idx: number) => (
                        <div key={idx} className="relative group">
                          <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#0F4FA8] border-2 border-white dark:border-[#0D1526] shadow-2xs" />
                          <div className="bg-slate-50 dark:bg-[#0D1526] border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 transition-all">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {item.action}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.timestamp}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.actor}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* 4. FIXED MODAL FOOTER (Height 80px, padding 16px 28px, fixed at bottom) */}
          <div className="h-[80px] shrink-0 px-7 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1526] flex items-center justify-between gap-4 z-20 shadow-md">
            <div className="flex items-center gap-3">
              <button
                onClick={handleCall}
                title="Call Lead"
                className="h-[48px] px-5 flex items-center justify-center gap-2 rounded-[14px] text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <PhoneCall className="h-4 w-4 shrink-0" />
                <span>Call</span>
              </button>

              <button
                onClick={() => setShowWhatsAppModal(true)}
                title="WhatsApp"
                className="h-[48px] px-5 flex items-center justify-center gap-2 rounded-[14px] text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setShowEmailModal(true)}
                title="Email"
                className="h-[48px] px-5 flex items-center justify-center gap-2 rounded-[14px] text-xs font-extrabold bg-blue-50 dark:bg-blue-950/40 text-[#0F4FA8] dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-[#0F4FA8] hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span>Email</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveDisposition()}
                disabled={isSubmitting || (user?.role === "agent" && lead.status !== "new")}
                title="Save Disposition"
                className="h-[48px] px-7 flex items-center justify-center gap-2 rounded-[14px] text-xs font-extrabold bg-gradient-to-r from-[#0F4FA8] to-[#1D4ED8] hover:from-[#0B3C80] hover:to-[#1656B3] text-white shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save</span>
              </button>

              <button
                onClick={onClose}
                title="Close Modal"
                className="h-[48px] px-6 flex items-center justify-center gap-2 rounded-[14px] text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer active:scale-95"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* WHATSAPP MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[100001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 font-sans">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">Send WhatsApp Message</h3>
                  <p className="text-[11px] font-semibold text-slate-400">{lead.name} · {lead.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Select Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => handleTemplateChange(t.id)} className={`p-2 rounded-xl text-[10px] font-extrabold transition border cursor-pointer active:scale-95 ${selectedTemplate === t.id ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-slate-50 dark:bg-[#0D1526] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100"}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Message Preview</label>
                <textarea rows={3} value={waMessage} onChange={e => setWaMessage(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium resize-none" />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-[12px] font-extrabold text-xs transition cursor-pointer">Cancel</button>
                <button onClick={handleSendWhatsApp} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[12px] font-extrabold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><Send className="h-3.5 w-3.5" />Open WhatsApp</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 font-sans">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-[#0F4FA8] dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">Send Email to Lead</h3>
                  <p className="text-[11px] font-semibold text-slate-400">{lead.name}</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Recipient Email</label>
                <input type="email" placeholder="Enter email address" value={customEmail} onChange={e => setCustomEmail(e.target.value)} className="w-full h-10 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full h-10 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Email Body</label>
                <textarea rows={3} value={emailBody} onChange={e => setEmailBody(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/50 font-medium resize-none" />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-[12px] font-extrabold text-xs transition cursor-pointer">Cancel</button>
                <button onClick={handleSendEmail} className="flex-1 py-2.5 bg-[#0F4FA8] hover:bg-[#0B3C80] text-white rounded-[12px] font-extrabold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><ExternalLink className="h-3.5 w-3.5" />Open Mail Client</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
