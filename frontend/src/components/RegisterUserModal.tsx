import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "./CustomSelect";
import MenuBadge from "./MenuBadge";
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Briefcase,
  Layers,
  Hash,
  ChevronDown,
  ChevronUp,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { PhoneInput } from "./PhoneInput";

type PoolRow = { id: string; name: string };
type UserRow = { id: string; name: string; role: string; employee_id: string };

type RegisterUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdUser: any) => void;
  pools: PoolRow[];
  supervisors: UserRow[];
};

const DEPARTMENT_OPTIONS = [
  { value: "Sales", label: "Sales & Outreach" },
  { value: "Service", label: "Customer Support" },
  { value: "HR", label: "HR & Recruitment" },
  { value: "Operations", label: "Call Center Operations" }
];

const SHIFT_OPTIONS = [
  { value: "Day", label: "Day Shift (9 AM - 6 PM)" },
  { value: "Night", label: "Night Shift (9 PM - 6 AM)" },
  { value: "Flexible", label: "Flexible Shift" }
];

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Tamil", label: "Tamil" },
  { value: "Telugu", label: "Telugu" }
];

export default function RegisterUserModal({
  isOpen,
  onClose,
  onSuccess,
  pools,
  supervisors
}: RegisterUserModalProps) {
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Manage body scroll locks, key triggers, and clearForm on modal open
  useEffect(() => {
    if (isOpen) {
      clearForm();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Accordion Expand/Collapse States
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    role: true,
    security: true
  });

  // Personal Info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // Role & Assignment
  const [role, setRole] = useState("agent");
  const [department, setDepartment] = useState("Sales");
  const [poolId, setPoolId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [shift, setShift] = useState("Day");
  const [language, setLanguage] = useState("English");

  // Security Credentials
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  // Default Access Controls
  const [isActive, setIsActive] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["Outbound Calling"]);
  const [recordingPermission, setRecordingPermission] = useState(true);
  const [monitoringPermission, setMonitoringPermission] = useState(true);
  const [transferPermission, setTransferPermission] = useState(true);
  const [aiCopilotAccess, setAiCopilotAccess] = useState(true);
  const [apiAccess, setApiAccess] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const clearForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setEmployeeId("");
    setPassword("");
    setConfirmPassword("");
    setRole("agent");
    setDepartment("Sales");
    setPoolId("");
    setSupervisorId("");
    setShift("Day");
    setLanguage("English");
    setSelectedSkills(["Outbound Calling"]);
    setIsActive(true);
    setCurrentStep(1);
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  const supervisorOptions = useMemo(() => {
    const list = supervisors.map(s => ({
      value: s.id,
      label: `${s.name} (${s.employee_id})`
    }));
    return [{ value: "", label: "Unassigned" }, ...list];
  }, [supervisors]);

  // Auto Generate Employee ID
  const handleAutoGenerateEmpId = () => {
    const prefix = role === "admin" ? "ADM" : role === "team_leader" ? "TL" : "AGT";
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newEmpId = `${prefix}${randomNum}`;
    setEmployeeId(newEmpId);
    showToast(`Generated Employee ID: ${newEmpId}`, "info");
  };

  // Generate Strong Password
  const handleGenerateStrongPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  // Password Strength Meter
  const getPasswordStrength = () => {
    if (!password) return { label: "None", score: 0, color: "bg-slate-200" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;

    if (score <= 1) return { label: "Weak", score: 25, color: "bg-rose-500" };
    if (score === 2 || score === 3) return { label: "Medium", score: 65, color: "bg-amber-500" };
    return { label: "Strong", score: 100, color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength();

  // Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      showToast("Full Name, Email, and Password are required.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        department,
        employee_id: employeeId || undefined,
        phone: phone.trim() || undefined,
        pool_id: poolId || undefined,
        supervisor_id: role === "agent" && supervisorId ? supervisorId : undefined,
        shift,
        language,
        skills: selectedSkills,
        is_active: isActive,
        send_credentials: sendCredentials,
        require_password_change: requirePasswordChange,
        permissions: {
          recording: recordingPermission,
          monitoring: monitoringPermission,
          transfer: transferPermission,
          ai_copilot: aiCopilotAccess,
          api_access: apiAccess
        }
      };

      const newUser = await api.post("/api/users", payload);
      showToast(`User ${newUser.name || fullName} registered successfully!`, "success");
      onSuccess(newUser);
      clearForm();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to register user account.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 font-sans animate-in fade-in">
      
      {/* Enterprise SaaS CRM Dialog - Compact Fit (Max Width 840px / Max Height 85vh) */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl shadow-slate-950/30 border border-slate-200/90 w-full max-w-[840px] flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
        
        {/* Sticky Header (Compact 46px Height) */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0 h-[46px] min-h-[46px]">
          
          {/* Title & Subtitle */}
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold border border-blue-100 shrink-0">
              <UserPlus className="h-3.5 w-3.5 text-[#0F4C9A]" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight leading-tight flex items-center gap-1">
                <span className="text-[#1D4ED8] font-extrabold">Register</span>
                <span className="text-[#F4B400] font-extrabold">New User</span>
              </h2>
              <span className="text-[9px] font-extrabold bg-[#0F4C9A]/10 text-[#0F4C9A] border border-[#0F4C9A]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Enterprise SaaS
              </span>
            </div>
          </div>

          {/* Stepper Navigation & Close Button */}
          <div className="flex items-center gap-2.5">
            
            {/* Compact Stepper Badges */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`px-2.5 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  currentStep === 1
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : currentStep > 1
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  currentStep === 1
                    ? "bg-white/20 text-white"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {currentStep > 1 ? "✓" : "1"}
                </span>
                <span>1. Profile &amp; Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`px-2.5 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  currentStep === 2
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  currentStep === 2
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  2
                </span>
                <span>2. Security &amp; Policies</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body (Internal Scroll Container) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-50/50 max-h-[calc(85vh-94px)]">
          
          {/* STEP 1: PROFILE & OPERATIONAL ROLES */}
          {currentStep === 1 && (
            <div className="space-y-3">
              
              {/* SECTION 1: Personal Information Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("personal")}
                  className="w-full px-3.5 py-2 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-white to-amber-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-blue-50/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] flex items-center justify-center shadow-xs">
                      <User className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">1. Personal&nbsp;</span>
                        <span className="text-[#F4B400]">Information</span>
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Required Fields
                    </span>
                    {openSections.personal ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </button>

                {openSections.personal && (
                  <div className="p-3 sm:p-3.5 bg-white space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Full Name <span className="text-rose-500 font-normal">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full h-[36px] pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-1">User's full legal name as per system logs</p>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Email Address <span className="text-rose-500 font-normal">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="rahul@forgeindia.com"
                            className="w-full h-[36px] pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-1">Used for system login &amp; email notifications</p>
                      </div>

                      {/* Phone Number */}
                      <div>
                        <PhoneInput
                          value={phone}
                          onChange={(fullVal) => setPhone(fullVal)}
                          label="Phone Number"
                          inputClassName="h-[36px] rounded-lg text-xs font-semibold"
                        />
                      </div>

                      {/* Employee ID */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Employee ID</label>
                          <button
                            type="button"
                            onClick={handleAutoGenerateEmpId}
                            className="text-[11px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Auto Generate
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <Hash className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <input
                            type="text"
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                            placeholder="e.g. AGT84920"
                            className="w-full h-[36px] pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs uppercase font-mono"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-1">Unique system code (e.g. AGT84920)</p>
                      </div>


                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Role & Operational Assignment Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("role")}
                  className="w-full px-3.5 py-2 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-blue-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-amber-50/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[#F4B400] to-[#FFD54A] flex items-center justify-center shadow-xs">
                      <Shield className="h-3 w-3 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">2. Role &amp;&nbsp;</span>
                        <span className="text-[#F4B400]">Operational Assignment</span>
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#92400E] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Role &amp; Mapping
                    </span>
                    {openSections.role ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </button>

                {openSections.role && (
                  <div className="p-3 sm:p-3.5 bg-white space-y-3">
                    <div className="space-y-3">
                      
                      {/* System Role Selection Cards */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Select System Role *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Agent Card */}
                          <button
                            type="button"
                            onClick={() => setRole("agent")}
                            className={`relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer text-left flex items-center gap-2.5 ${
                              role === "agent"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-xs"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${role === "agent" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs tracking-tight uppercase">Agent</span>
                              <span className={`block text-[10px] font-medium ${role === "agent" ? "text-blue-100" : "text-slate-400"}`}>Telecaller &amp; Outreach</span>
                            </div>
                            {role === "agent" && (
                              <span className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </span>
                            )}
                          </button>

                          {/* TL Card */}
                          <button
                            type="button"
                            onClick={() => setRole("team_leader")}
                            className={`relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer text-left flex items-center gap-2.5 ${
                              role === "team_leader"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-xs"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${role === "team_leader" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Shield className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs tracking-tight uppercase">TL</span>
                              <span className={`block text-[10px] font-medium ${role === "team_leader" ? "text-blue-100" : "text-slate-400"}`}>Team Leader</span>
                            </div>
                            {role === "team_leader" && (
                              <span className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </span>
                            )}
                          </button>

                          {/* Admin Card */}
                          <button
                            type="button"
                            onClick={() => setRole("admin")}
                            className={`relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer text-left flex items-center gap-2.5 ${
                              role === "admin"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-xs"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${role === "admin" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs tracking-tight uppercase">Admin</span>
                              <span className={`block text-[10px] font-medium ${role === "admin" ? "text-blue-100" : "text-slate-400"}`}>Full System Control</span>
                            </div>
                            {role === "admin" && (
                              <span className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Pool Selection Cards */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Select Campaign Pool</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* No Pool */}
                          <button
                            type="button"
                            onClick={() => setPoolId("")}
                            className={`relative p-2 rounded-lg border transition-all duration-200 cursor-pointer text-left flex items-center gap-2 ${
                              !poolId
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-xs"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${!poolId ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Layers className="h-3 w-3" />
                            </div>
                            <div>
                              <span className="block font-bold text-[11px] tracking-tight uppercase">No Pool</span>
                              <span className={`block text-[9px] font-medium ${!poolId ? "text-blue-100" : "text-slate-400"}`}>Unassigned</span>
                            </div>
                          </button>

                          {pools.map(p => {
                            const isSelected = poolId === p.id;
                            const isCreditCard = p.name.toLowerCase().includes("credit") || p.name.toLowerCase().includes("card");
                            return (
                              <MenuBadge
                                key={p.id}
                                title={isCreditCard ? "Sales Team" : p.name.replace(/_/g, " ")}
                                isActive={isSelected}
                                onClick={() => setPoolId(p.id)}
                                icon={isCreditCard ? <Briefcase className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                                showCheck={true}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Department */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Department</label>
                          <CustomSelect
                            value={department}
                            onChange={setDepartment}
                            options={DEPARTMENT_OPTIONS}
                            placeholder="Select Department"
                            triggerClassName="h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold"
                          />
                        </div>

                        {/* Supervisor Mapping */}
                        {role === "agent" && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Supervisor Mapping</label>
                            <CustomSelect
                              value={supervisorId}
                              onChange={setSupervisorId}
                              options={supervisorOptions}
                              placeholder="Select Supervisor"
                              triggerClassName="h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold"
                            />
                          </div>
                        )}

                        {/* Shift Schedule */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Shift Schedule</label>
                          <CustomSelect
                            value={shift}
                            onChange={setShift}
                            options={SHIFT_OPTIONS}
                            placeholder="Select Shift"
                            triggerClassName="h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold"
                          />
                        </div>

                        {/* Preferred Language */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Preferred Language</label>
                          <CustomSelect
                            value={language}
                            onChange={setLanguage}
                            options={LANGUAGE_OPTIONS}
                            placeholder="Select Language"
                            triggerClassName="h-[34px] sm:h-[36px] rounded-lg text-xs font-semibold"
                          />
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* STEP 2: SECURITY CREDENTIALS & POLICIES */}
          {currentStep === 2 && (
            <div className="space-y-3">
              
              {/* SECTION 3: Security Credentials Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("security")}
                  className="w-full px-3.5 py-2 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-white to-amber-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-blue-50/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] flex items-center justify-center shadow-xs">
                      <Lock className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">3. Security Credentials &amp;&nbsp;</span>
                        <span className="text-[#F4B400]">Password Policies</span>
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#92400E] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Security Policy
                    </span>
                    {openSections.security ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>

                </button>

                {openSections.security && (
                  <div className="p-3 sm:p-3.5 bg-white space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* Password */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            Password <span className="text-rose-500 font-normal">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleGenerateStrongPassword}
                            className="text-[11px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Generate Password
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-[36px] pl-10 pr-9 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Password Strength Meter */}
                        {password && (
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex justify-between items-center text-[9px] font-bold">
                              <span className="text-slate-400 uppercase">Strength:</span>
                              <span className={strength.score > 50 ? "text-emerald-600" : "text-amber-600"}>
                                {strength.label}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${strength.color}`}
                                style={{ width: `${strength.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-normal mt-1">At least 6 characters with uppercase &amp; symbols</p>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Confirm Password <span className="text-rose-500 font-normal">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-[36px] pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <span className="text-[10px] text-rose-500 font-semibold mt-1 block">Passwords do not match</span>
                        )}
                        <p className="text-[10px] text-slate-400 font-normal mt-1">Re-enter password for confirmation</p>
                      </div>

                    </div>


                    {/* Interactive Security Options Grid */}
                    <div className="pt-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2.5 p-2.5 bg-slate-50/70 border border-slate-200/90 rounded-lg cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={sendCredentials}
                          onChange={e => setSendCredentials(e.target.checked)}
                          className="h-3.5 w-3.5 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800 text-xs">Send Login Credentials via Email</span>
                          <span className="block text-[10px] text-slate-400 font-normal">Automated welcome email with initial password</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 bg-slate-50/70 border border-slate-200/90 rounded-lg cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={requirePasswordChange}
                          onChange={e => setRequirePasswordChange(e.target.checked)}
                          className="h-3.5 w-3.5 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800 text-xs">Require password change on first login</span>
                          <span className="block text-[10px] text-slate-400 font-normal">Enforce security policy on first portal session</span>
                        </div>
                      </label>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer (Compact 48px Height) */}
        <div className="px-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between shrink-0 h-[48px] min-h-[48px]">
          
          <button
            type="button"
            onClick={handleClose}
            className="h-[34px] px-3.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="h-[34px] px-4 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Security</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="h-[34px] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => showToast("Draft saved locally.", "info")}
                  className="h-[34px] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-lg transition cursor-pointer"
                >
                  Save Draft
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[34px] px-4 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </form>
    </div>,
    document.body
  );
}
