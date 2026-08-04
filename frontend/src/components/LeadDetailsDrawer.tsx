import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  PhoneCall,
  MessageSquare,
  Mail,
  User,
  MapPin,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Send,
  Layers,
  ShieldCheck,
  Activity,
  ChevronRight,
  Bot,
  FileText,
  Edit3,
  ExternalLink,
  Loader2,
  Building2,
  Tag
} from "lucide-react";

export type LeadDrawerData = {
  id: string;
  lead_id?: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  status: string;
  pool_id?: string;
  assigned_agent_id?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  ai_score?: number;
  last_contact_at?: string;
  created_at?: string;
  notes?: string;
  intent?: string;
  suggestions?: string[];
  history?: { timestamp: string; action: string; actor: string; notes?: string }[];
};

interface LeadDetailsDrawerProps {
  lead: any;
  onClose: () => void;
  onUpdateDisposition: (leadId: string, status: string, notes: string, followUpDate?: string) => Promise<void>;
  users?: { id: string; name: string; employee_id?: string }[];
  pools?: { id: string; name: string }[];
  onCall?: (lead: any) => void;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

const TEMPLATES = [
  { id: "intro", label: "Welcome & Intro", text: "Hello {name}, following up on your inquiry with Forge CRM. How can we assist you today?" },
  { id: "demo", label: "Schedule Demo", text: "Hi {name}, would you like to schedule a 15-minute live product demo of our AI Voice CRM?" },
  { id: "offer", label: "Special Plan Offer", text: "Hi {name}, we have an exclusive tier plan offer available for your team. Let's connect!" }
];

export default function LeadDetailsDrawer({
  lead,
  onClose,
  onUpdateDisposition,
  users = [],
  pools = [],
  onCall,
  showToast
}: LeadDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "disposition">("overview");
  
  // Disposition Form States
  const [status, setStatus] = useState(lead?.status || "new");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notesError, setNotesError] = useState("");

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("intro");

  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customEmail, setCustomEmail] = useState(lead?.email || "");
  const [emailSubject, setEmailSubject] = useState("Follow up from Forge CRM");
  const [emailBody, setEmailBody] = useState(`Hi ${lead?.name || "Customer"},\n\nFollowing up regarding your lead inquiry with Forge CRM.\n\nBest regards,\nForge Team`);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status || "new");
      setNotes(lead.notes || "");
      setCustomEmail(lead.email || "");
      setNotesError("");
      const initialTpl = TEMPLATES[0].text.replace("{name}", lead.name || "Customer");
      setWaMessage(initialTpl);
    }
  }, [lead]);

  if (!lead) return null;

  const assignedAgent = lead.assigned_agent_id
    ? users.find(u => u.id === lead.assigned_agent_id || u.employee_id === lead.assigned_agent_id)
    : undefined;
  const poolObj = pools.find(p => p.id === lead.pool_id || p.name === lead.pool_id);

  // Phone Sanitizer
  const cleanPhone = (lead.phone || "").replace(/\D/g, "");

  // Handle Call Button Action
  const handleCall = () => {
    if (onCall) {
      onCall(lead);
    }
    const dialUrl = `tel:${lead.phone}`;
    window.location.href = dialUrl;
    showToast(`Initiating call with ${lead.name} (${lead.phone})...`, "info");
  };

  // Handle WhatsApp Template Selection
  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplate(tplId);
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setWaMessage(tpl.text.replace("{name}", lead.name || "Customer"));
    }
  };

  // Execute WhatsApp Action
  const handleSendWhatsApp = () => {
    const phoneNum = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const encodedMsg = encodeURIComponent(waMessage);
    const waUrl = `https://wa.me/${phoneNum}?text=${encodedMsg}`;
    window.open(waUrl, "_blank");
    setShowWhatsAppModal(false);
    showToast(`Opened WhatsApp chat with ${lead.name}`, "success");
  };

  // Execute Email Action
  const handleSendEmail = () => {
    const targetEmail = customEmail || lead.email;
    if (!targetEmail || targetEmail === "N/A") {
      showToast("Please specify a valid email address.", "warning");
      return;
    }
    const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
    setShowEmailModal(false);
    showToast(`Opening default email client for ${targetEmail}`, "info");
  };

  // Handle Disposition Update Submission
  const handleSaveDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setNotesError("Please enter notes or disposition details before saving.");
      return;
    }
    if (notes.trim().length < 5) {
      setNotesError("Notes must be at least 5 characters long.");
      return;
    }

    setIsSubmitting(true);
    setNotesError("");

    try {
      await onUpdateDisposition(lead.id, status, notes, followUpDate || undefined);
      showToast(`Disposition updated to "${status.replace("_", " ").toUpperCase()}" successfully!`, "success");
      onClose();
    } catch (err: any) {
      showToast(`Failed to update disposition: ${err.message || "Server error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        
        {/* BACKDROP OVERLAY */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200/90 overflow-hidden"
          >
            {/* 1. STICKY HEADER WITH CUSTOMER PROFILE */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-5 border-b border-slate-200/80 shadow-2xs space-y-4 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0F4FA8] to-blue-500 text-[#FFC107] flex items-center justify-center font-black text-lg shadow-md border border-blue-400/30">
                      {lead.name[0]?.toUpperCase() || "C"}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight truncate leading-tight">
                        {lead.name}
                      </h2>
                      <span className="font-mono text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                        {lead.lead_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-[#0F4FA8]" />
                        {lead.phone}
                      </span>
                      {lead.location && (
                        <span className="text-slate-400 font-medium flex items-center gap-0.5 text-[11px]">
                          <MapPin className="h-3 w-3" />
                          {lead.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Close Drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* QUICK ACTION CARDS (CALL, WHATSAPP, EMAIL) */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleCall}
                  className="p-2.5 bg-emerald-50/80 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl font-extrabold text-xs transition-all shadow-2xs hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  title="Dial via System / Softphone"
                >
                  <PhoneCall className="h-4 w-4 shrink-0" />
                  <span>Call</span>
                </button>

                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="p-2.5 bg-emerald-50/80 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 rounded-xl font-extrabold text-xs transition-all shadow-2xs hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  title="Send WhatsApp Message"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-emerald-600 hover:text-white" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => setShowEmailModal(true)}
                  className="p-2.5 bg-blue-50/80 hover:bg-[#0F4FA8] text-[#0F4FA8] hover:text-white border border-blue-200 rounded-xl font-extrabold text-xs transition-all shadow-2xs hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  title="Send Email via Mail Client"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Email</span>
                </button>
              </div>

              {/* TAB NAVIGATION STRIP */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                {[
                  { id: "overview", label: "Overview & AI" },
                  { id: "disposition", label: "Update Status & Notes" },
                  { id: "timeline", label: "Activity Log" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                      activeTab === tab.id
                        ? "bg-[#0F4FA8] text-white shadow-xs"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. DRAWER BODY CONTENT (SCROLLABLE) */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs font-sans softphone-scrollbar">
              
              {/* TAB 1: OVERVIEW & AI INSIGHTS */}
              {activeTab === "overview" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  
                  {/* CONTACT DETAILS CARD */}
                  <div className="bg-white/95 p-4 rounded-[18px] border border-slate-200/80 shadow-xs space-y-3">
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <User className="h-3.5 w-3.5 text-[#0F4FA8]" />
                      <span>Contact Profile Details</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Phone</span>
                        <span className="font-extrabold text-slate-800">{lead.phone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Email Address</span>
                        <span className="font-semibold text-slate-700 truncate block">{lead.email || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Location</span>
                        <span className="font-semibold text-slate-700">{lead.location || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Target Pool</span>
                        <span className="font-bold text-[#0F4FA8] uppercase">{poolObj?.name.replace(/_/g, " ") || "Default Pool"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Assigned Agent</span>
                        <span className="font-bold text-slate-800">{assignedAgent?.name || "Unassigned"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Priority Level</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 border ${
                          lead.priority === "high"
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}>
                          {lead.priority || "Medium"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI TELEMETRY & INTENT CARD */}
                  <div className="bg-gradient-to-br from-blue-50/80 to-slate-50 p-4 rounded-[18px] border border-blue-200/80 shadow-xs space-y-3">
                    <div className="text-[11px] font-black text-[#0F4FA8] uppercase tracking-wider flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#0F4FA8] animate-pulse" />
                        <span>AI Telemetry & Intent Fit</span>
                      </span>
                      <span className="text-[10px] font-mono font-black bg-white px-2 py-0.5 rounded-full border border-blue-200 text-[#0F4FA8]">
                        {lead.ai_score || 88}% Score
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Detected Intent</span>
                        <p className="text-xs font-bold text-slate-800 bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs mt-1">
                          {lead.intent || "Product tier inquiry & subscription pricing request"}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">AI Copilot Next Actions</span>
                        {(lead.suggestions || [
                          "Share official enterprise product brochure link",
                          "Confirm preferred callback slot for technical team demo"
                        ]).map((sug: string, i: number) => (
                          <div key={i} className="bg-white p-2 rounded-xl border border-blue-100 text-xs font-semibold text-slate-700 flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{sug}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RECENT NOTES CARD */}
                  {lead.notes && (
                    <div className="bg-slate-50 p-3.5 rounded-[18px] border border-slate-200 space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Latest Disposition Notes</span>
                      <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}

                </motion.div>
              )}

              {/* TAB 2: UPDATE STATUS & DISPOSITION */}
              {activeTab === "disposition" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <form onSubmit={handleSaveDisposition} className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs space-y-4">
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Edit3 className="h-3.5 w-3.5 text-[#0F4FA8]" />
                      <span>Update Disposition & Call Notes</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Status Disposition</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] cursor-pointer"
                      >
                        <option value="new">New Lead</option>
                        <option value="in_progress">In Progress</option>
                        <option value="follow_up">Follow-up Needed</option>
                        <option value="qualified">Qualified</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="closed">Closed / Won</option>
                      </select>
                    </div>

                    {(status === "follow_up" || status === "in_progress") && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">Follow-up Date & Time</label>
                        <input
                          type="datetime-local"
                          value={followUpDate}
                          onChange={e => setFollowUpDate(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                        />
                      </motion.div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-extrabold text-slate-700 uppercase">Call Notes / Summary</label>
                        <span className={`text-[10px] font-mono font-bold ${notes.length > 450 ? "text-rose-500" : "text-slate-400"}`}>
                          {notes.length} / 500
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        maxLength={500}
                        placeholder="Enter detailed conversation outcome or next steps..."
                        value={notes}
                        onChange={e => {
                          setNotes(e.target.value);
                          if (notesError) setNotesError("");
                        }}
                        className={`w-full bg-slate-50 border ${
                          notesError ? "border-rose-500" : "border-slate-200"
                        } rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-medium`}
                      />
                      {notesError && <p className="text-[11px] font-bold text-rose-600 mt-1">{notesError}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white rounded-xl font-extrabold text-xs transition cursor-pointer disabled:opacity-50 shadow-md flex items-center justify-center gap-2 active:scale-95"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving Disposition...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Save Disposition Update</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* TAB 3: ACTIVITY TIMELINE */}
              {activeTab === "timeline" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs space-y-3">
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Activity className="h-3.5 w-3.5 text-[#0F4FA8]" />
                      <span>Activity Log & History</span>
                    </div>

                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {(lead.history || [
                        { timestamp: lead.created_at || "Recently", action: "Lead Created in CRM", actor: "System Automation" },
                        { timestamp: "Today", action: "Assigned to Pool", actor: "Supervisor Protocol" }
                      ]).map((item: any, idx: number) => (
                        <div key={idx} className="relative space-y-0.5">
                          <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[#0F4FA8] border-2 border-white ring-2 ring-blue-100" />
                          <div className="font-extrabold text-slate-900 text-xs">{item.action}</div>
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-2">
                            <span>By: {item.actor}</span>
                            <span>•</span>
                            <span>{item.timestamp}</span>
                          </div>
                          {item.notes && <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 font-medium">{item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

            </div>

          </motion.div>
        </div>

        {/* 3. WHATSAPP TEMPLATE & MESSAGE MODAL */}
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 font-sans">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Send WhatsApp Message</h3>
                    <p className="text-[11px] font-semibold text-slate-400">{lead.name} ({lead.phone})</p>
                  </div>
                </div>
                <button onClick={() => setShowWhatsAppModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Select Message Template</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTemplateChange(t.id)}
                        className={`p-2 rounded-xl text-[11px] font-extrabold transition border cursor-pointer ${
                          selectedTemplate === t.id
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Message Text Preview</label>
                  <textarea
                    rows={4}
                    value={waMessage}
                    onChange={e => setWaMessage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowWhatsAppModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>Open WhatsApp</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 4. EMAIL MODAL */}
        {showEmailModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 font-sans">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-[#0F4FA8] rounded-xl border border-blue-200">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Send Email to Lead</h3>
                    <p className="text-[11px] font-semibold text-slate-400">{lead.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Recipient Email</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={customEmail}
                    onChange={e => setCustomEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Email Body Preview</label>
                  <textarea
                    rows={4}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    className="flex-1 py-2.5 bg-[#0F4FA8] hover:bg-blue-900 text-white rounded-xl font-extrabold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open Mail Client</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </AnimatePresence>
  );
}
