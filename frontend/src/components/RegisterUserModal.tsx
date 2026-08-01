import React, { useState } from "react";
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
  Hash
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

type PoolRow = { id: string; name: string };
type UserRow = { id: string; name: string; role: string; employee_id: string };

type RegisterUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdUser: any) => void;
  pools: PoolRow[];
  supervisors: UserRow[];
};

const SKILL_OPTIONS = [
  "Outbound Calling",
  "Negotiation",
  "Sales Conversion",
  "Customer Service",
  "Lead Qualification",
  "Objection Handling"
];

export default function RegisterUserModal({
  isOpen,
  onClose,
  onSuccess,
  pools,
  supervisors
}: RegisterUserModalProps) {
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [role, setRole] = useState("agent");
  const [poolId, setPoolId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [shift, setShift] = useState("Day");
  const [language, setLanguage] = useState("English");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["Outbound Calling"]);
  const [isActive, setIsActive] = useState(true);

  const [sendCredentials, setSendCredentials] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Auto Generate Employee ID based on role
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
    showToast("Generated 12-character strong password", "info");
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

  // Multi-select Skill Toggle
  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

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
        employee_id: employeeId || undefined,
        phone: phone.trim() || undefined,
        pool_id: poolId || undefined,
        supervisor_id: role === "agent" && supervisorId ? supervisorId : undefined,
        shift,
        language,
        skills: selectedSkills,
        is_active: isActive,
        send_credentials: sendCredentials,
        require_password_change: requirePasswordChange
      };

      const newUser = await api.post("/api/users", payload);
      showToast(`User ${newUser.name || fullName} registered successfully!`, "success");
      onSuccess(newUser);
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to register user account.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white/95 backdrop-blur-md rounded-[20px] shadow-2xl border border-white/50 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0F4C9A] flex items-center justify-center font-bold shadow-2xs border border-blue-100">
              <Mic className="h-5 w-5 animate-pulse text-[#0F4C9A]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Register New User</h2>
              <p className="text-xs text-slate-500 font-semibold">Create Admin, Team Leader or Agent account with RBAC controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form (2-Column Responsive Grid) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#0F4C9A]" />
                <span>Personal & Security Info</span>
              </h3>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="rahul@forgeindia.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition"
                  />
                </div>
              </div>

              {/* Employee ID */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Employee ID</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateEmpId}
                    className="text-[10px] font-extrabold text-[#0F4C9A] hover:underline cursor-pointer"
                  >
                    Auto Generate
                  </button>
                </div>
                <div className="relative">
                  <Hash className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    placeholder="e.g. AGT84920"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition uppercase font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password Strength Meter Bar */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Strength:</span>
                      <span className={strength.score > 50 ? "text-emerald-600" : "text-amber-600"}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] transition"
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <span className="text-[10px] text-rose-500 font-bold mt-1 block">Passwords do not match</span>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#0F4C9A]" />
                <span>Role & Operational Assignment</span>
              </h3>

              {/* Role Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] cursor-pointer transition"
                >
                  <option value="agent">Agent (Telecaller)</option>
                  <option value="team_leader">Supervisor (Team Leader)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              {/* Pool Mapping */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pool Mapping</label>
                <select
                  value={poolId}
                  onChange={e => setPoolId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] cursor-pointer transition"
                >
                  <option value="">No Pool Assigned</option>
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.replace(/_/g, " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Supervisor Mapping */}
              {role === "agent" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supervisor Mapping</label>
                  <select
                    value={supervisorId}
                    onChange={e => setSupervisorId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C9A] cursor-pointer transition"
                  >
                    <option value="">Unassigned</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Shift & Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                  >
                    <option value="Day">Day Shift</option>
                    <option value="Night">Night Shift</option>
                    <option value="Flexible">Flexible Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                  </select>
                </div>
              </div>

              {/* AI Skills (Multi-Select Chips) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">AI Skills & Qualifications</label>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_OPTIONS.map(skill => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                          isSelected
                            ? "bg-[#0F4C9A] text-white border-[#0F4C9A] shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {skill} {isSelected && "✓"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
                <div className="flex items-center gap-3 bg-slate-50 p-2.5 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="status-toggle"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-[#0F4C9A] focus:ring-[#0F4C9A] rounded cursor-pointer"
                  />
                  <label htmlFor="status-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                    {isActive ? "Active Account (Permitted Login)" : "Inactive Account (Suspended)"}
                  </label>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Security Options Row */}
          <div className="pt-4 border-t border-slate-200/80 bg-slate-50/70 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendCredentials}
                  onChange={e => setSendCredentials(e.target.checked)}
                  className="h-4 w-4 text-[#0F4C9A] rounded"
                />
                <span>Send Login Credentials via Email</span>
              </label>

              <button
                type="button"
                onClick={handleGenerateStrongPassword}
                className="text-xs font-extrabold text-[#0F4C9A] hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#0F4C9A]" />
                <span>Generate Strong Password</span>
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={requirePasswordChange}
                onChange={e => setRequirePasswordChange(e.target.checked)}
                className="h-4 w-4 text-[#0F4C9A] rounded"
              />
              <span>Require password change on first login</span>
            </label>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => showToast("Draft saved locally.", "info")}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#0F4C9A] hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Create User</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
