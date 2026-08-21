import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "./CustomSelect";
import MenuBadge from "./MenuBadge";
import {
  X,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Briefcase,
  Layers,
  Users,
  Clock,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Send,
  Mic,
  Hash,
  ChevronDown,
  ChevronUp,
  Upload,
  UserPlus,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  ShieldCheck,
  BadgeCheck,
  FileCheck,
  Info,
  HelpCircle,
  CheckCircle
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
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["Outbound Calling", "Sales Conversion"]);
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
    <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-sans">
      
      {/* Enterprise SaaS CRM Dialog (Width ~1020-1060px / Height ~84vh) */}
      <form onSubmit={handleSubmit} className="bg-white rounded-[16px] shadow-2xl shadow-slate-900/20 border border-slate-200/90 w-full max-w-[1020px] lg:max-w-[1060px] flex flex-col h-full max-h-[84vh] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
        
        {/* Sticky Header with Title, Subtitle, Stepper & Close Action */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 h-[52px] sm:h-[54px] min-h-[52px]">
          
          {/* Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold border border-blue-100 shrink-0">
              <UserPlus className="h-4.5 w-4.5 text-[#0F4C9A]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight flex items-center gap-1.5">
                  <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Register</span>
                  <span className="text-[#F4B400] font-extrabold">New User</span>
                </h2>
                <span className="text-[10px] font-extrabold bg-[#0F4C9A]/10 text-[#0F4C9A] border border-[#0F4C9A]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Enterprise SaaS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Configure user profile credentials, system roles, department pools, and security policies
              </p>
            </div>
          </div>

          {/* Stepper Navigation & Close Button */}
          <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
            
            {/* Enhanced Stepper Badges */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentStep === 1
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : currentStep > 1
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 1
                    ? "bg-white/20 text-white"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {currentStep > 1 ? "✓" : "1"}
                </span>
                <span className="text-xs">1. Profile & Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentStep === 2
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 2
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  2
                </span>
                <span className="text-xs">2. Security & Policies</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Close dialog"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto lm-scroll p-4 sm:p-5 space-y-4 bg-slate-50/40">
          
          {/* STEP 1: PROFILE & OPERATIONAL ROLES */}
          {currentStep === 1 && (
            <div className="space-y-4">
              
              {/* SECTION 1: Personal Information Card */}
              <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("personal")}
                  className="w-full px-4.5 py-3 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-white to-amber-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-blue-50/80 hover:to-amber-50/60 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
                      <User className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">1. Personal&nbsp;</span>
                        <span className="text-[#F4B400]">Information</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Basic user credentials and identification numbers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Required Fields
                    </span>
                    {openSections.personal ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.personal && (
                  <div className="p-4 sm:p-4.5 bg-white space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Full Name */}
                      <div>
                        <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full h-[40px] sm:h-[42px] pl-9 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1">User's full legal name as per system logs</p>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="rahul@forgeindia.com"
                            className="w-full h-[40px] sm:h-[42px] pl-9 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1">Used for system login & email notifications</p>
                      </div>

                      {/* Phone Number */}
                      <PhoneInput
                        value={phone}
                        onChange={(fullVal) => setPhone(fullVal)}
                        label="Phone Number"
                        inputClassName="h-[40px] sm:h-[42px] rounded-[10px] text-[14px] font-semibold"
                      />

                      {/* Employee ID */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider">Employee ID</label>
                          <button
                            type="button"
                            onClick={handleAutoGenerateEmpId}
                            className="text-[11.5px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Auto Generate
                          </button>
                        </div>
                        <div className="relative">
                          <Hash className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="text"
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                            placeholder="e.g. AGT84920"
                            className="w-full h-[40px] sm:h-[42px] pl-9 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs uppercase font-mono"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1">Unique system code (e.g. AGT84920)</p>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Role & Operational Assignment Card */}
              <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("role")}
                  className="w-full px-4.5 py-3 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-blue-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-amber-50/80 hover:to-blue-50/60 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#F4B400] to-[#FFD54A] flex items-center justify-center shadow-[0_2px_8px_rgba(244,180,0,0.4)]">
                      <Shield className="h-3.5 w-3.5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">2. Role &amp;&nbsp;</span>
                        <span className="text-[#F4B400]">Operational Assignment</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Define RBAC roles, pool mappings, and shifts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-[#92400E] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Role &amp; Mapping
                    </span>
                    {openSections.role ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.role && (
                  <div className="p-4 sm:p-4.5 bg-white space-y-4">
                    <div className="space-y-4">
                      
                      {/* System Role Selection Cards */}
                      <div className="space-y-1.5">
                        <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider">Select System Role *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Agent Card */}
                          <button
                            type="button"
                            onClick={() => setRole("agent")}
                            className={`relative p-3 rounded-[10px] border transition-all duration-200 cursor-pointer text-left flex items-center gap-3 ${
                              role === "agent"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${role === "agent" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs sm:text-[13px] tracking-tight uppercase">Agent</span>
                              <span className={`block text-[10.5px] font-medium ${role === "agent" ? "text-blue-100" : "text-slate-400"}`}>Telecaller & Outreach</span>
                            </div>
                            {role === "agent" && (
                              <span className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>

                          {/* TL Card */}
                          <button
                            type="button"
                            onClick={() => setRole("team_leader")}
                            className={`relative p-3 rounded-[10px] border transition-all duration-200 cursor-pointer text-left flex items-center gap-3 ${
                              role === "team_leader"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${role === "team_leader" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Shield className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs sm:text-[13px] tracking-tight uppercase">TL</span>
                              <span className={`block text-[10.5px] font-medium ${role === "team_leader" ? "text-blue-100" : "text-slate-400"}`}>Team Leader</span>
                            </div>
                            {role === "team_leader" && (
                              <span className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>

                          {/* Admin Card */}
                          <button
                            type="button"
                            onClick={() => setRole("admin")}
                            className={`relative p-3 rounded-[10px] border transition-all duration-200 cursor-pointer text-left flex items-center gap-3 ${
                              role === "admin"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${role === "admin" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs sm:text-[13px] tracking-tight uppercase">Admin</span>
                              <span className={`block text-[10.5px] font-medium ${role === "admin" ? "text-blue-100" : "text-slate-400"}`}>Full System Control</span>
                            </div>
                            {role === "admin" && (
                              <span className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Pool Selection Cards */}
                      <div className="space-y-1.5">
                        <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider">Select Campaign Pool</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* No Pool */}
                          <button
                            type="button"
                            onClick={() => setPoolId("")}
                            className={`relative p-3 rounded-[10px] border transition-all duration-200 cursor-pointer text-left flex items-center gap-3 ${
                              !poolId
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-slate-200 hover:border-[#0F4C9A] hover:bg-blue-50/50 shadow-xs"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${!poolId ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Layers className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-bold text-xs tracking-tight uppercase">No Pool</span>
                              <span className={`block text-[10px] font-medium ${!poolId ? "text-blue-100" : "text-slate-400"}`}>Unassigned</span>
                            </div>
                            {!poolId && (
                              <span className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
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
                                icon={isCreditCard ? <Briefcase className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                                showCheck={true}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        {/* Department */}
                        <div>
                          <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">Department</label>
                          <CustomSelect
                            value={department}
                            onChange={setDepartment}
                            options={DEPARTMENT_OPTIONS}
                            placeholder="Select Department"
                            triggerClassName="h-[40px] sm:h-[42px] rounded-[10px] text-[14px] font-semibold"
                          />
                        </div>

                        {/* Supervisor Mapping */}
                        {role === "agent" && (
                          <div>
                            <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">Supervisor Mapping</label>
                            <CustomSelect
                              value={supervisorId}
                              onChange={setSupervisorId}
                              options={supervisorOptions}
                              placeholder="Select Supervisor"
                              triggerClassName="h-[40px] sm:h-[42px] rounded-[10px] text-[14px] font-semibold"
                            />
                          </div>
                        )}

                        {/* Shift Schedule */}
                        <div>
                          <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">Shift Schedule</label>
                          <CustomSelect
                            value={shift}
                            onChange={setShift}
                            options={SHIFT_OPTIONS}
                            placeholder="Select Shift"
                            triggerClassName="h-[40px] sm:h-[42px] rounded-[10px] text-[14px] font-semibold"
                          />
                        </div>
                        {/* Preferred Language */}
                        <div>
                          <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">Preferred Language</label>
                          <CustomSelect
                            value={language}
                            onChange={setLanguage}
                            options={LANGUAGE_OPTIONS}
                            placeholder="Select Language"
                            triggerClassName="h-[40px] sm:h-[42px] rounded-[10px] text-[14px] font-semibold"
                          />
                          <p className="text-[11px] text-slate-400 font-normal mt-1">Default telephony interaction language</p>
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
            <div className="space-y-4">
              
              {/* SECTION 3: Security Credentials Card */}
              <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("security")}
                  className="w-full px-4.5 py-3 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-white to-amber-50/40 border-b border-slate-100 text-left cursor-pointer hover:from-blue-50/80 hover:to-amber-50/60 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
                      <Lock className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-0">
                        <span className="text-[#1D4ED8]">3. Security Credentials &amp;&nbsp;</span>
                        <span className="text-[#F4B400]">Password Policies</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Set account login credentials and security parameters
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-[#92400E] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Security Policy
                    </span>
                    {openSections.security ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>

                </button>

                {openSections.security && (
                  <div className="p-4 sm:p-4.5 bg-white space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Password */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider">
                            Password <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleGenerateStrongPassword}
                            className="text-[11.5px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Generate Password
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-[40px] sm:h-[42px] pl-9 pr-9 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Password Strength Meter */}
                        {password && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-400 uppercase">Strength:</span>
                              <span className={strength.score > 50 ? "text-emerald-600" : "text-amber-600"}>
                                {strength.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${strength.color}`}
                                style={{ width: `${strength.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400 font-normal mt-1">At least 6 characters with uppercase & symbols</p>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-[12px] sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-[40px] sm:h-[42px] pl-9 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <span className="text-[11px] text-rose-500 font-semibold mt-1 block">Passwords do not match</span>
                        )}
                        <p className="text-[11px] text-slate-400 font-normal mt-1">Re-enter password for confirmation</p>
                      </div>

                    </div>

                    {/* Interactive Security Options Grid */}
                    <div className="pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <label className="flex items-center gap-3 p-3.5 bg-slate-50/70 border border-slate-200/90 rounded-[10px] cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={sendCredentials}
                          onChange={e => setSendCredentials(e.target.checked)}
                          className="h-4 w-4 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800 text-[12.5px] sm:text-[13px]">Send Login Credentials via Email</span>
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">Automated welcome email with initial password</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 bg-slate-50/70 border border-slate-200/90 rounded-[10px] cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={requirePasswordChange}
                          onChange={e => setRequirePasswordChange(e.target.checked)}
                          className="h-4 w-4 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800 text-[12.5px] sm:text-[13px]">Require password change on first login</span>
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">Enforce security policy on first portal session</span>
                        </div>
                      </label>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer with Aligned Actions (60px) */}
        <div className="px-5 sm:px-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0 h-[60px] min-h-[60px]">
          
          <button
            type="button"
            onClick={handleClose}
            className="h-[40px] px-4.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded-[10px] transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="h-[40px] px-5 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-[13px] rounded-[10px] shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Security</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="h-[40px] px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-[10px] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => showToast("Draft saved locally.", "info")}
                  className="h-[40px] px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-[10px] transition cursor-pointer"
                >
                  Save Draft
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[40px] px-5 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-[13px] rounded-[10px] shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
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
