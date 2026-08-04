import React, { useState } from "react";
import { createPortal } from "react-dom";
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

export default function RegisterUserModal({
  isOpen,
  onClose,
  onSuccess,
  pools,
  supervisors
}: RegisterUserModalProps) {
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

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

  if (!isOpen || typeof document === "undefined") return null;

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
    showToast("Generated 12-character secure password", "info");
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-sans">
      
      {/* Enterprise SaaS CRM Dialog (Width 1150px / max-w-6xl) */}
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 w-full max-w-6xl flex flex-col max-h-[88vh] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
        
        {/* Sticky Header with Title, Subtitle, Stepper & Close Action */}
        <div className="px-8 py-5 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-5 shrink-0">
          
          {/* Title & Subtitle */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold border border-blue-100 shadow-2xs">
              <UserPlus className="h-6 w-6 text-[#0F4C9A]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Register New User</h2>
                <span className="text-[11px] font-extrabold bg-[#0F4C9A]/10 text-[#0F4C9A] border border-[#0F4C9A]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Enterprise SaaS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure user profile credentials, system roles, department pools, and security policies
              </p>
            </div>
          </div>

          {/* Stepper Navigation & Close Button */}
          <div className="flex items-center gap-4 justify-between lg:justify-end shrink-0">
            
            {/* Enhanced Stepper Badges */}
            <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  currentStep === 1
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : currentStep > 1
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 1
                    ? "bg-white/20 text-white"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {currentStep > 1 ? "✓" : "1"}
                </span>
                <span>1. Profile & Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  currentStep === 2
                    ? "bg-[#0F4C9A] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 2
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  2
                </span>
                <span>2. Security & Policies</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-7 space-y-6">
          
          {/* STEP 1: PROFILE & OPERATIONAL ROLES */}
          {currentStep === 1 && (
            <div className="space-y-6">
              
              {/* SECTION 1: Personal Information Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("personal")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/70 border-b border-slate-100 text-left cursor-pointer hover:bg-slate-100/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold">
                      <User className="h-4 w-4 text-[#0F4C9A]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        1. Personal Information
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Basic user credentials and identification numbers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                      Required Fields
                    </span>
                    {openSections.personal ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.personal && (
                  <div className="p-6 bg-white space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Full Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">User's full legal name as per system logs</p>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="rahul@forgeindia.com"
                            className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">Used for system login & email notifications</p>
                      </div>

                      {/* Phone Number */}
                      <PhoneInput
                        value={phone}
                        onChange={(fullVal) => setPhone(fullVal)}
                        label="Phone Number"
                      />

                      {/* Employee ID */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold text-slate-700">Employee ID</label>
                          <button
                            type="button"
                            onClick={handleAutoGenerateEmpId}
                            className="text-[11px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Auto Generate
                          </button>
                        </div>
                        <div className="relative">
                          <Hash className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                          <input
                            type="text"
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                            placeholder="e.g. AGT84920"
                            className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs uppercase font-mono"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">Unique system code (e.g. AGT84920)</p>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Role & Operational Assignment Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("role")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/70 border-b border-slate-100 text-left cursor-pointer hover:bg-slate-100/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold">
                      <Shield className="h-4 w-4 text-[#0F4C9A]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        2. Role & Operational Assignment
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Define RBAC roles, pool mappings, and shifts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-[#0F4C9A] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/80">
                      Role & Mapping
                    </span>
                    {openSections.role ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.role && (
                  <div className="p-6 bg-white space-y-5">
                    <div className="space-y-6">
                      
                      {/* System Role Selection Cards */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">Select System Role *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Agent Card */}
                          <button
                            type="button"
                            onClick={() => setRole("agent")}
                            className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                              role === "agent"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-blue-200/80 hover:border-[#0F4C9A] hover:bg-blue-50/50 hover:-translate-y-0.5 shadow-xs"
                            }`}
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${role === "agent" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-semibold text-sm tracking-tight uppercase">Agent</span>
                              <span className={`block text-[11px] font-medium ${role === "agent" ? "text-blue-100" : "text-slate-400"}`}>Telecaller & Outreach</span>
                            </div>
                            {role === "agent" && (
                              <span className="absolute top-3.5 right-3.5 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-white" />
                              </span>
                            )}
                          </button>

                          {/* TL Card */}
                          <button
                            type="button"
                            onClick={() => setRole("team_leader")}
                            className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                              role === "team_leader"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-blue-200/80 hover:border-[#0F4C9A] hover:bg-blue-50/50 hover:-translate-y-0.5 shadow-xs"
                            }`}
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${role === "team_leader" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Shield className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-semibold text-sm tracking-tight uppercase">TL</span>
                              <span className={`block text-[11px] font-medium ${role === "team_leader" ? "text-blue-100" : "text-slate-400"}`}>Team Leader</span>
                            </div>
                            {role === "team_leader" && (
                              <span className="absolute top-3.5 right-3.5 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-white" />
                              </span>
                            )}
                          </button>

                          {/* Admin Card */}
                          <button
                            type="button"
                            onClick={() => setRole("admin")}
                            className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                              role === "admin"
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-blue-200/80 hover:border-[#0F4C9A] hover:bg-blue-50/50 hover:-translate-y-0.5 shadow-xs"
                            }`}
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${role === "admin" ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-semibold text-sm tracking-tight uppercase">Admin</span>
                              <span className={`block text-[11px] font-medium ${role === "admin" ? "text-blue-100" : "text-slate-400"}`}>Full System Control</span>
                            </div>
                            {role === "admin" && (
                              <span className="absolute top-3.5 right-3.5 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-white" />
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Pool Selection Cards */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">Select Campaign Pool</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* No Pool */}
                          <button
                            type="button"
                            onClick={() => setPoolId("")}
                            className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                              !poolId
                                ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                : "bg-white text-slate-900 border-blue-200/80 hover:border-[#0F4C9A] hover:bg-blue-50/50 hover:-translate-y-0.5 shadow-xs"
                            }`}
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${!poolId ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                              <Layers className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-semibold text-xs tracking-tight uppercase">No Pool</span>
                              <span className={`block text-[10px] font-medium ${!poolId ? "text-blue-100" : "text-slate-400"}`}>Unassigned</span>
                            </div>
                            {!poolId && (
                              <span className="absolute top-3 right-3 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>

                          {pools.map(p => {
                            const isSelected = poolId === p.id;
                            const isCreditCard = p.name.toLowerCase().includes("credit") || p.name.toLowerCase().includes("card");
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setPoolId(p.id)}
                                className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                                  isSelected
                                    ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-md"
                                    : "bg-white text-slate-900 border-blue-200/80 hover:border-[#0F4C9A] hover:bg-blue-50/50 hover:-translate-y-0.5 shadow-xs"
                                }`}
                              >
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-[#0F4C9A]"}`}>
                                  {isCreditCard ? <Briefcase className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                                </div>
                                <div>
                                  <span className="block font-semibold text-xs tracking-tight uppercase truncate max-w-[120px]">
                                    {p.name.replace(/_/g, " ")}
                                  </span>
                                  <span className={`block text-[10px] font-medium ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                                    {isCreditCard ? "Sales" : "Campaign Pool"}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="absolute top-3 right-3 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                                    <Check className="h-3 w-3 text-white" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        {/* Department */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">Department</label>
                          <select
                            value={department}
                            onChange={e => setDepartment(e.target.value)}
                            className="w-full h-11 px-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] cursor-pointer transition shadow-2xs"
                          >
                            <option value="Sales">Sales & Outreach</option>
                            <option value="Service">Customer Support</option>
                            <option value="HR">HR & Recruitment</option>
                            <option value="Operations">Call Center Operations</option>
                          </select>
                        </div>

                        {/* Supervisor Mapping */}
                        {role === "agent" && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">Supervisor Mapping</label>
                            <select
                              value={supervisorId}
                              onChange={e => setSupervisorId(e.target.value)}
                              className="w-full h-11 px-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] cursor-pointer transition shadow-2xs"
                            >
                              <option value="">Unassigned</option>
                              {supervisors.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Shift Schedule */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">Shift Schedule</label>
                          <select
                            value={shift}
                            onChange={e => setShift(e.target.value)}
                            className="w-full h-11 px-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] cursor-pointer transition shadow-2xs"
                          >
                            <option value="Day">Day Shift (9 AM - 6 PM)</option>
                            <option value="Night">Night Shift (9 PM - 6 AM)</option>
                            <option value="Flexible">Flexible Shift</option>
                          </select>
                        </div>
                        {/* Preferred Language */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">Preferred Language</label>
                        <select
                          value={language}
                          onChange={e => setLanguage(e.target.value)}
                          className="w-full h-11 px-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] cursor-pointer transition shadow-2xs"
                        >
                          <option value="English">English</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Tamil">Tamil</option>
                          <option value="Telugu">Telugu</option>
                        </select>
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">Default telephony interaction language</p>
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
            <div className="space-y-6">
              
              {/* SECTION 3: Security Credentials Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs transition">
                <button
                  type="button"
                  onClick={() => toggleSection("security")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/70 border-b border-slate-100 text-left cursor-pointer hover:bg-slate-100/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold">
                      <Lock className="h-4 w-4 text-[#0F4C9A]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        3. Security Credentials & Password Policies
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Set account login credentials and security parameters
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
                      Security Policy
                    </span>
                    {openSections.security ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.security && (
                  <div className="p-6 bg-white space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Password */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold text-slate-700">
                            Password <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleGenerateStrongPassword}
                            className="text-[11px] font-bold text-[#0F4C9A] hover:underline cursor-pointer"
                          >
                            Generate Password
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-11 pl-10 pr-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Password Strength Meter */}
                        {password && (
                          <div className="mt-2.5 space-y-1">
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
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">At least 6 characters with uppercase & symbols</p>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/20 focus:border-[#0F4C9A] transition shadow-2xs"
                          />
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <span className="text-[11px] text-rose-500 font-semibold mt-1.5 block">Passwords do not match</span>
                        )}
                        <p className="text-[11px] text-slate-400 font-normal mt-1.5">Re-enter password for confirmation</p>
                      </div>

                    </div>

                    {/* Interactive Security Options Grid */}
                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <label className="flex items-center gap-3.5 p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={sendCredentials}
                          onChange={e => setSendCredentials(e.target.checked)}
                          className="h-4 w-4 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800">Send Login Credentials via Email</span>
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">Automated welcome email with initial password</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3.5 p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl cursor-pointer hover:bg-slate-100/60 transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={requirePasswordChange}
                          onChange={e => setRequirePasswordChange(e.target.checked)}
                          className="h-4 w-4 text-[#0F4C9A] rounded border-slate-300 focus:ring-[#0F4C9A] accent-[#0F4C9A] cursor-pointer"
                        />
                        <div>
                          <span className="block font-bold text-slate-800">Require password change on first login</span>
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">Enforce security policy on first portal session</span>
                        </div>
                      </label>
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

        </form>

        {/* Sticky Footer with Aligned Actions */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          
          <button
            type="button"
            onClick={handleClose}
            className="px-5 h-11 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 h-11 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Security</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 h-11 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => showToast("Draft saved locally.", "info")}
                  className="px-5 h-11 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 h-11 bg-[#0F4C9A] hover:bg-[#0D3F80] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
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

      </div>
    </div>,
    document.body
  );
}
