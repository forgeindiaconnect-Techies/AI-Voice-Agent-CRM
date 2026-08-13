import { useState, useEffect } from "react";
import { CustomSelect } from "./CustomSelect";
import CustomDateTimePicker from "./CustomDateTimePicker";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, PhoneCall, MessageSquare, Mail, User, MapPin, Clock,
  Sparkles, CheckCircle2, AlertCircle, Send, Activity, ChevronDown,
  FileText, Edit3, ExternalLink, Loader2, Save, Zap, Star, Target, Users
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

const getTimelineIcon = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes("creat")) return <Zap className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (a.includes("assign")) return <Users className="h-3.5 w-3.5 text-[#F4B400]" />;
  if (a.includes("call") || a.includes("dial")) return <PhoneCall className="h-3.5 w-3.5 text-emerald-500" />;
  if (a.includes("email")) return <Mail className="h-3.5 w-3.5 text-blue-400" />;
  if (a.includes("note")) return <FileText className="h-3.5 w-3.5 text-slate-400" />;
  if (a.includes("qualif")) return <Star className="h-3.5 w-3.5 text-[#F4B400]" />;
  if (a.includes("follow")) return <Target className="h-3.5 w-3.5 text-violet-500" />;
  return <Activity className="h-3.5 w-3.5 text-[#2563EB]" />;
};

export default function LeadDetailsDrawer({ lead, onClose, onUpdateDisposition, users = [], pools = [], onCall, showToast }: LeadDetailsDrawerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "disposition" | "timeline">("overview");
  const [isAiExpanded, setIsAiExpanded] = useState(true);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
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

  if (!lead) return null;

  const assignedAgent = lead.assigned_agent_id ? users.find(u => u.id === lead.assigned_agent_id || u.employee_id === lead.assigned_agent_id) : undefined;
  const poolObj = pools.find(p => p.id === lead.pool_id || p.name === lead.pool_id);
  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
  const aiScore = lead.ai_score || 75;

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

  const TABS = [{ id: "overview", label: "Overview" }, { id: "disposition", label: "Disposition" }, { id: "timeline", label: "Timeline" }] as const;

  return (
    <AnimatePresence>
      {/* MODAL BACKDROP */}
      <div className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 font-sans">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* CENTERED DESKTOP MODAL CONTAINER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-[min(1050px,calc(100vw-48px))] max-h-[calc(100vh-48px)] flex flex-col bg-white dark:bg-[#0D1526] border border-slate-200/80 dark:border-white/[.10] rounded-[20px] shadow-2xl overflow-hidden relative z-[9999] box-border"
        >
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#2563EB]/5 dark:bg-[#2563EB]/10 blur-3xl rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#F4B400]/5 dark:bg-[#F4B400]/8 blur-3xl rounded-full pointer-events-none translate-x-1/3 translate-y-1/3" />

          {/* FIXED HEADER */}
          <div className="sticky top-0 z-20 shrink-0 bg-white/95 dark:bg-[#0D1526]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[.07] px-6 pt-5 pb-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white font-black text-xl flex items-center justify-center shadow-[0_4px_20px_rgba(37,99,235,0.4)] border-2 border-white dark:border-[#1E293B] select-none">
                    {lead.name?.[0]?.toUpperCase() || "L"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0D1526] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate leading-none">{lead.name}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 rounded-md tracking-wider">{lead.lead_id || "—"}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.2)] backdrop-blur-sm">
                      <Sparkles className="h-3 w-3" />{aiScore}% AI Fit
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-xl shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all duration-200 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex items-center gap-1 p-1.5 rounded-[14px] bg-slate-100/80 dark:bg-white/[.05] border border-slate-200/60 dark:border-white/[.07] shadow-inner max-w-md">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 h-9 rounded-[10px] text-[12px] font-extrabold transition-all duration-250 ease-out cursor-pointer flex items-center justify-center active:scale-95 ${
                    activeTab === tab.id
                      ? "dark:bg-gradient-to-r dark:from-[#1D4ED8] dark:to-[#2563EB] dark:text-white dark:shadow-[0_4px_16px_rgba(37,99,235,0.45)] dark:border dark:border-blue-400/30 bg-gradient-to-r from-[#F4B400] to-[#FFD54A] text-[#1E3A8A] shadow-[0_4px_16px_rgba(244,180,0,0.35)] border border-amber-300/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/8"
                  }`}>{tab.label}</button>
              ))}
            </div>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-4 text-xs font-sans softphone-scrollbar">

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="bg-white dark:bg-[#131F35] rounded-[18px] border border-slate-200/80 dark:border-white/[.07] shadow-[0_2px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.2)] overflow-hidden">
                  <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-white to-white dark:from-[#1E293B] dark:via-[#131F35] dark:to-[#131F35] border-b border-slate-100 dark:border-white/[.06] flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-[#1D4ED8]/20 border border-blue-200 dark:border-[#2563EB]/30 flex items-center justify-center shrink-0"><User className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#3B82F6]" /></div>
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Contact Profile</span>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Phone</span><span className="font-bold text-slate-900 dark:text-white text-[12px] flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#F4B400] shrink-0" />{lead.phone}</span></div>
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Email</span><span className="font-semibold text-slate-800 dark:text-slate-200 truncate block text-[12px]">{lead.email || "N/A"}</span></div>
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Location</span><span className="font-semibold text-slate-800 dark:text-slate-200 text-[12px] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />{lead.location || "N/A"}</span></div>
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Target Pool</span><span className="text-[10px] font-extrabold text-[#1D4ED8] dark:text-[#F4B400] uppercase bg-blue-50 dark:bg-[#F4B400]/10 border border-blue-200 dark:border-[#F4B400]/25 px-2.5 py-1 rounded-full inline-block tracking-wider">{poolObj?.name.replace(/_/g, " ") || "RECRUITMENT"}</span></div>
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Assigned Agent</span><span className="font-bold text-slate-900 dark:text-white text-[12px]">{assignedAgent?.name || "Unassigned"}</span></div>
                    <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Priority</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full inline-block border tracking-wider ${lead.priority === "high" || lead.priority === "urgent" ? "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400" : "bg-amber-50 dark:bg-amber-500/12 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"}`}>{lead.priority || "Medium"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#131F35] rounded-[18px] border border-slate-200/80 dark:border-white/[.07] shadow-[0_2px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.2)] overflow-hidden">
                  <button onClick={() => setIsAiExpanded(!isAiExpanded)} className="w-full px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white dark:from-[#1E293B] dark:via-[#1a2740] dark:to-[#131F35] border-b border-slate-100 dark:border-white/[.06] cursor-pointer text-left hover:brightness-[1.02] transition-all duration-200">
                    <span className="flex items-center gap-2.5 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest"><Sparkles className="h-4 w-4 text-[#F4B400] animate-pulse" />AI Telemetry & Copilot</span>
                    <div className="flex items-center gap-2"><span className="text-[11px] font-black font-mono bg-gradient-to-r from-[#F4B400] to-[#FFD54A] text-[#1E3A8A] px-2.5 py-0.5 rounded-full border border-amber-300/50 shadow-sm">{lead.ai_score || 85}%</span><ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isAiExpanded ? "rotate-180" : ""}`} /></div>
                  </button>
                  {isAiExpanded && (
                    <div className="p-5 space-y-4">
                      <div><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Detected Intent</span>
                        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0D1526] p-3.5 rounded-[12px] border border-slate-200/80 dark:border-white/[.07] hover:border-[#2563EB]/40 hover:-translate-y-0.5 transition-all duration-200 leading-relaxed">{lead.intent || "Product tier inquiry & subscription pricing request"}</p>
                      </div>
                      <div className="space-y-2"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Copilot Recommendations</span>
                        {(lead.suggestions || ["Share official enterprise product brochure link", "Confirm preferred callback slot for technical demo"]).map((sug: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-[#0D1526] rounded-[12px] border border-slate-200/80 dark:border-white/[.07] hover:border-[#F4B400]/40 dark:hover:border-[#F4B400]/30 hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /><span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 leading-snug">{sug}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {lead.notes && (
                  <div className="bg-white dark:bg-[#131F35] rounded-[18px] border border-slate-200/80 dark:border-white/[.07] shadow-sm overflow-hidden">
                    <button onClick={() => setIsNotesExpanded(!isNotesExpanded)} className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-white/[.06] text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors duration-150">
                      <span className="flex items-center gap-2 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest"><FileText className="h-3.5 w-3.5 text-slate-400" />Latest Notes</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isNotesExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isNotesExpanded && <div className="px-5 py-4"><p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{lead.notes}</p></div>}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: DISPOSITION */}
            {activeTab === "disposition" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                {user?.role === "agent" && lead.status !== "new" ? (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-[18px] p-5 flex items-start gap-3 shadow-sm">
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div><p className="font-extrabold text-[11px] uppercase tracking-wider text-rose-800 dark:text-rose-400 mb-1">Read-Only Lead</p><p className="text-[12px] font-medium text-rose-600 dark:text-rose-400/80 leading-relaxed">Agents are only permitted to update the disposition of leads that are in NEW status.</p></div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveDisposition} className="bg-white dark:bg-[#131F35] rounded-[18px] p-6 border border-slate-200/80 dark:border-white/[.07] shadow-[0_2px_16px_rgba(15,23,42,0.06)] space-y-5">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-white/[.06] pb-3.5">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-[#1D4ED8]/20 border border-blue-100 dark:border-[#2563EB]/20 flex items-center justify-center"><Edit3 className="h-3.5 w-3.5 text-[#2563EB]" /></div>
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Update Status & Notes</span>
                    </div>
                    <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status Disposition</label><CustomSelect value={status} onChange={setStatus} options={DISPOSITION_STATUS_OPTIONS} placeholder="Select Status" /></div>
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
                      <div className="flex justify-between items-center mb-2"><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Call Notes / Summary</label><span className={`text-[10px] font-mono font-bold ${notes.length > 450 ? "text-rose-500" : "text-slate-400"}`}>{notes.length} / 500</span></div>
                      <textarea rows={4} maxLength={500} placeholder="Enter conversation notes or next steps..." value={notes} onChange={e => { setNotes(e.target.value); if (notesError) setNotesError(""); }} className={`w-full bg-slate-50 dark:bg-[#0D1526] border rounded-[10px] p-3.5 text-[12px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 transition-all duration-200 resize-none ${notesError ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-white/10"}`} />
                      {notesError && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{notesError}</p>}
                    </div>
                  </form>
                )}
              </motion.div>
            )}

            {/* TAB 3: TIMELINE */}
            {activeTab === "timeline" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="bg-white dark:bg-[#131F35] rounded-[18px] border border-slate-200/80 dark:border-white/[.07] shadow-[0_2px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.2)] overflow-hidden">
                  <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-white to-white dark:from-[#1E293B] dark:via-[#131F35] dark:to-[#131F35] border-b border-slate-100 dark:border-white/[.06] flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-[#1D4ED8]/20 border border-blue-200 dark:border-[#2563EB]/30 flex items-center justify-center shrink-0"><Activity className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#3B82F6]" /></div>
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Activity Log & History</span>
                    <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500">{(lead.history || []).length || 2} events</span>
                  </div>
                  <div className="px-5 py-5">
                    <div className="relative">
                      <div className="absolute left-[17px] top-5 bottom-4 w-[2px] bg-gradient-to-b from-[#2563EB] via-[#3B82F6]/60 to-transparent shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                      <div className="space-y-5">
                        {(lead.history || [
                          { timestamp: lead.created_at || "2026-08-06", action: "Lead Created in CRM", actor: "System Automation", notes: "" },
                          { timestamp: "Today", action: "Assigned to Pool", actor: "Supervisor Protocol", notes: "" }
                        ]).map((item: any, idx: number) => (
                          <div key={idx} className="relative pl-10 group cursor-default">
                            <div className="absolute left-0 top-1.5 h-9 w-9 rounded-full bg-white dark:bg-[#0D1526] border-2 border-[#2563EB]/40 dark:border-[#2563EB]/30 shadow-[0_0_12px_rgba(37,99,235,0.3)] flex items-center justify-center group-hover:border-[#2563EB] group-hover:shadow-[0_0_18px_rgba(37,99,235,0.5)] transition-all duration-250 z-10">
                              {getTimelineIcon(item.action)}
                            </div>
                            <div className="bg-slate-50 dark:bg-[#0D1526] border border-slate-200/80 dark:border-white/[.07] rounded-[14px] p-4 group-hover:border-[#2563EB]/30 dark:group-hover:border-[#2563EB]/30 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_24px_rgba(37,99,235,0.12)] transition-all duration-250">
                              <p className="text-[13px] font-extrabold text-slate-900 dark:text-white leading-snug mb-1.5">{item.action}</p>
                              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{item.actor}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{item.timestamp}</span>
                              </div>
                              {item.notes && <p className="mt-2.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-[#131F35] px-3 py-2 rounded-[10px] border border-slate-200 dark:border-white/[.06] leading-relaxed">{item.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* FIXED FOOTER */}
          <div className="sticky bottom-0 z-20 shrink-0 bg-white/95 dark:bg-[#0D1526]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[.07] px-6 py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={handleCall} title="Call Lead" className="h-11 px-5 flex items-center justify-center gap-2 rounded-[12px] text-xs font-extrabold bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white hover:border-transparent hover:shadow-[0_4px_14px_rgba(5,150,105,0.4)] active:scale-95 transition-all duration-200 cursor-pointer">
                <PhoneCall className="h-4 w-4 shrink-0" /><span>Call</span>
              </button>
              <button onClick={() => setShowWhatsAppModal(true)} title="WhatsApp" className="h-11 px-5 flex items-center justify-center gap-2 rounded-[12px] text-xs font-extrabold bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white hover:border-transparent hover:shadow-[0_4px_14px_rgba(5,150,105,0.4)] active:scale-95 transition-all duration-200 cursor-pointer">
                <MessageSquare className="h-4 w-4 shrink-0" /><span>WA</span>
              </button>
              <button onClick={() => setShowEmailModal(true)} title="Email" className="h-11 px-5 flex items-center justify-center gap-2 rounded-[12px] text-xs font-extrabold bg-blue-50/80 dark:bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6] border border-blue-500/50 hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white hover:border-transparent hover:shadow-[0_4px_14px_rgba(37,99,235,0.45)] active:scale-95 transition-all duration-200 cursor-pointer">
                <Mail className="h-4 w-4 shrink-0" /><span>Email</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => handleSaveDisposition()} disabled={isSubmitting || (user?.role === "agent" && lead.status !== "new")} title="Save Disposition" className="h-11 px-6 flex items-center justify-center gap-2 rounded-[12px] text-xs font-extrabold bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)] hover:from-[#1E40AF] hover:to-[#1D4ED8] hover:shadow-[0_6px_18px_rgba(37,99,235,0.55)] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span>Save</span>
              </button>
              <button onClick={onClose} title="Close Modal" className="h-11 px-5 flex items-center justify-center gap-2 rounded-[12px] text-xs font-extrabold bg-slate-100 dark:bg-white/[.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all duration-200 cursor-pointer">
                <X className="h-4 w-4" /><span>Close</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

        {/* WHATSAPP MODAL */}
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 font-sans">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/[.08]">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/[.07] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-emerald-600" /></div>
                  <div><h3 className="font-black text-slate-900 dark:text-white text-[14px]">Send WhatsApp Message</h3><p className="text-[11px] font-semibold text-slate-400">{lead.name} · {lead.phone}</p></div>
                </div>
                <button onClick={() => setShowWhatsAppModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Select Template</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map(t => (<button key={t.id} type="button" onClick={() => handleTemplateChange(t.id)} className={`p-2 rounded-xl text-[10px] font-extrabold transition border cursor-pointer active:scale-95 ${selectedTemplate === t.id ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-slate-50 dark:bg-[#0D1526] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"}`}>{t.label}</button>))}
                  </div>
                </div>
                <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Message Preview</label><textarea rows={3} value={waMessage} onChange={e => setWaMessage(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] p-3 text-[12px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium resize-none" /></div>
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-white/[.06] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-[12px] font-extrabold text-[12px] transition cursor-pointer">Cancel</button>
                  <button onClick={handleSendWhatsApp} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[12px] font-extrabold text-[12px] transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><Send className="h-3.5 w-3.5" />Open WhatsApp</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* EMAIL MODAL */}
        {showEmailModal && (
          <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 font-sans">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#131F35] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/[.08]">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/[.07] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-[#2563EB]/15 border border-blue-200 dark:border-[#2563EB]/25 flex items-center justify-center"><Mail className="h-4 w-4 text-[#2563EB]" /></div>
                  <div><h3 className="font-black text-slate-900 dark:text-white text-[14px]">Send Email to Lead</h3><p className="text-[11px] font-semibold text-slate-400">{lead.name}</p></div>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg text-slate-400 cursor-pointer transition"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Recipient Email</label><input type="email" placeholder="Enter email address" value={customEmail} onChange={e => setCustomEmail(e.target.value)} className="w-full h-10 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] px-3 text-[12px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 transition" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Subject</label><input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full h-10 bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] px-3 text-[12px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 transition" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Email Body</label><textarea rows={3} value={emailBody} onChange={e => setEmailBody(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0D1526] border border-slate-200 dark:border-white/10 rounded-[12px] p-3 text-[12px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 font-medium resize-none" /></div>
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-white/[.06] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-[12px] font-extrabold text-[12px] transition cursor-pointer">Cancel</button>
                  <button onClick={handleSendEmail} className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[12px] font-extrabold text-[12px] transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"><ExternalLink className="h-3.5 w-3.5" />Open Mail Client</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
