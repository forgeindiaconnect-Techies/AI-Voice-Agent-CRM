import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, BASE_URL } from "../api/client";
import ForgeLogo from "../components/ForgeLogo";
import { assets } from "../utils/assets";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Mic,
  Globe
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("admin@forgeindia.com");
  const [password, setPassword] = useState("Admin@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "healthy" | "offline">("checking");
  const [backendError, setBackendError] = useState<string | null>(null);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const checkBackendHealth = async () => {
    setBackendStatus("checking");
    setBackendError(null);
    try {
      await api.checkHealth();
      setBackendStatus("healthy");
    } catch (err: any) {
      setBackendStatus("offline");
      setBackendError(err.message || "Backend server is unreachable");
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      showToast("Email address and password are required.", "error");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      showToast("Signed in to Forge CRM Dashboard successfully!", "success");
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      showToast(err.message || "Invalid credentials. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  const fillDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    showToast(`Loaded demo credentials for ${roleEmail}`, "info");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen w-screen flex flex-col lg:grid lg:grid-cols-2 bg-gradient-to-br from-[#EEF4FB] via-[#F4F8FC] to-[#E9F0F8] dark:from-[#060B16] dark:via-[#0F172A] dark:to-[#132238] font-sans overflow-x-hidden text-slate-800 dark:text-white relative"
    >
      {/* Subtle Blue & Gold Floating Ambient Orbs */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-[#1D4ED8]/15 dark:bg-[#1D4ED8]/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-[#F4B400]/15 dark:bg-[#F4B400]/20 rounded-full blur-[100px] pointer-events-none animate-pulse" />

      {/* ── LEFT COLUMN: 640px PREMIUM GLASSMorphism CARD ── */}
      <div className="flex-1 flex flex-col justify-between items-center p-4 sm:p-8 lg:p-10 z-10 relative">
        <div className="w-full max-w-[640px] my-auto">
          {/* 640px Width, 28px Radius, Soft Blue Shadow, Premium Glassmorphism Card */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-2xl rounded-[28px] p-8 sm:p-10 lg:p-[48px] shadow-[0_20px_60px_rgba(29,78,216,0.15),0_0_40px_rgba(0,0,0,0.06)] border border-blue-500/10 dark:border-white/10 space-y-6"
          >
            {/* Enlarged Forge India Logo (Centered & Aligned) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mb-6 flex justify-center"
            >
              <ForgeLogo size="xl" variant="full" className="h-[100px] sm:h-[105px] w-auto object-contain drop-shadow-sm" />
            </motion.div>

            {/* Title & Subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-2 text-left"
            >
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight leading-tight">
                <span className="text-[#1D4ED8] dark:text-[#3B82F6]">Enterprise </span>
                <span className="text-[#F4B400]">Sign In</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                Access your AI voice agents, live calls, and campaign analytics.
              </p>

              {/* Status Badge */}
              <div className="flex items-center gap-2 pt-2">
                {backendStatus === "checking" && (
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 border border-slate-200 dark:border-white/10">
                    <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                    Connecting to server...
                  </span>
                )}
                {backendStatus === "healthy" && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>System Active ({BASE_URL.replace("http://", "").replace("https://", "")})</span>
                  </span>
                )}
                {backendStatus === "offline" && (
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-3 py-1 rounded-full flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Server Offline — Click to Retry</span>
                  </button>
                )}
              </div>
            </motion.div>

            {backendError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Backend Error:</strong> {backendError}
                </div>
              </div>
            )}

            {/* Login Form with Staggered Animations & 24px Field Spacing */}
            <form onSubmit={handleSubmit} className="space-y-6 pt-1">
              {/* Email Address Field (60px Height, 16px Radius, Dedicated 52px Icon Container, 56px Text Padding) */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
              >
                <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Email Address
                </label>
                <div className="relative flex items-center group">
                  {/* Dedicated 52px Icon Container */}
                  <div className="w-[52px] h-full flex items-center justify-center absolute left-0 top-0 pointer-events-none z-10">
                    <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-[#1D4ED8] dark:group-focus-within:text-[#60A5FA] transition-colors duration-200" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[60px] border border-[#DCE3EE] dark:border-white/10 rounded-[16px] pl-[56px] pr-5 text-base font-medium text-slate-900 dark:text-white bg-[#F8FAFC] dark:bg-[#0B1220]/70 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] focus:shadow-[0_0_20px_rgba(29,78,216,0.18)] transition-all duration-250 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Email address"
                  />
                </div>
              </motion.div>

              {/* Password Field (60px Height, 16px Radius, Dedicated 52px Icon Container, 56px Text Padding, 40x40px Circular Eye Button) */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative flex items-center group">
                  {/* Dedicated 52px Icon Container */}
                  <div className="w-[52px] h-full flex items-center justify-center absolute left-0 top-0 pointer-events-none z-10">
                    <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-[#1D4ED8] dark:group-focus-within:text-[#60A5FA] transition-colors duration-200" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[60px] border border-[#DCE3EE] dark:border-white/10 rounded-[16px] pl-[56px] pr-[56px] text-base font-medium text-slate-900 dark:text-white bg-[#F8FAFC] dark:bg-[#0B1220]/70 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] focus:shadow-[0_0_20px_rgba(29,78,216,0.18)] transition-all duration-250 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Enter Password"
                  />
                  {/* 40x40px Circular Hover Button for Eye Icon */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-slate-200/50 dark:bg-white/10 hover:bg-slate-300/70 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-[#1D4ED8] dark:hover:text-[#60A5FA] transition-all duration-200 cursor-pointer z-10"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </motion.div>

              {/* Remember Row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="flex items-center justify-between text-xs sm:text-sm pt-0.5"
              >
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-600 dark:text-slate-400 font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8] h-4 w-4 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => showToast("Please contact your IT Administrator to reset password.", "info")}
                  className="text-xs sm:text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline transition cursor-pointer"
                >
                  Forgot Password
                </button>
              </motion.div>

              {/* Premium Blue (#1D4ED8) → Gold (#F4B400) Gradient Sign In Button */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="pt-2"
              >
                <button
                  type="submit"
                  disabled={loading || backendStatus === "offline"}
                  className="w-full h-[56px] rounded-[16px] bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#F4B400] hover:from-[#1E40AF] hover:to-[#EAB308] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(29,78,216,0.3)] hover:shadow-[0_12px_35px_rgba(29,78,216,0.45)] hover:-translate-y-0.5 active:scale-98 transition-all duration-250 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin text-white" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in to Dashboard</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Quick Demo Access Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              className="pt-5 border-t border-slate-100 dark:border-white/10 space-y-2.5"
            >
              <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider text-center">
                QUICK DEMO ACCESS (CLICK TO AUTO-FILL)
              </p>
              <div className="grid grid-cols-3 gap-2.5 text-[11px] text-center font-semibold">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials("admin@forgeindia.com", "Admin@123")}
                  className="p-3 rounded-[14px] bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-[#1D4ED8] dark:hover:border-[#3B82F6] hover:shadow-md transition-all duration-200 cursor-pointer text-left group"
                >
                  <span className="font-extrabold text-[#1D4ED8] dark:text-[#60A5FA] block group-hover:scale-105 transition-transform">ADMIN</span>
                  <span className="truncate block text-slate-700 dark:text-slate-300 font-mono text-[10px]">admin@...</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials("tl@forgeindia.com", "Leader@123")}
                  className="p-3 rounded-[14px] bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-[#F4B400] dark:hover:border-[#F4B400] hover:shadow-md transition-all duration-200 cursor-pointer text-left group"
                >
                  <span className="font-extrabold text-[#F4B400] block group-hover:scale-105 transition-transform">SUPERVISOR</span>
                  <span className="truncate block text-slate-700 dark:text-slate-300 font-mono text-[10px]">tl@...</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials("agent@forgeindia.com", "Agent@123")}
                  className="p-3 rounded-[14px] bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-md transition-all duration-200 cursor-pointer text-left group"
                >
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block group-hover:scale-105 transition-transform">AGENT</span>
                  <span className="truncate block text-slate-700 dark:text-slate-300 font-mono text-[10px]">agent@...</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium pt-4">
          © 2026 Forge India Connect Pvt. Ltd. · All Rights Reserved
        </footer>
      </div>

      {/* ── RIGHT COLUMN: FUTURISTIC AI HERO SECTION (APPLE VISIONOS / OPENAI / MICROSOFT COPILOT STYLE) ── */}
      <div className="relative hidden lg:flex items-center justify-center p-4 lg:p-6 overflow-hidden h-full min-h-screen">
        {/* Faint Circuit/Hexagon Pattern Overlay (4% Opacity) */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none text-[#1D4ED8] dark:text-[#60A5FA]" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none">
          <pattern id="circuit-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="30" cy="30" r="3" fill="currentColor" />
            <path d="M 30 30 L 60 30 M 30 30 L 30 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#circuit-pattern)" />
        </svg>

        {/* Dual Ambient Glows: Soft Blue behind Human side & Soft Gold behind Robotic side */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-[320px] h-[600px] bg-[#1D4ED8]/25 dark:bg-[#1D4ED8]/35 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-[320px] h-[600px] bg-[#F4B400]/20 dark:bg-[#F4B400]/30 blur-[100px] rounded-full pointer-events-none" />

        {/* Slow Floating AI Character Container (10-15% Enlarged, Visually Centered) */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ willChange: "transform" }}
          className="relative z-10 h-[92vh] max-h-[960px] flex items-center justify-center scale-105 lg:scale-110"
        >
          <img
            src={assets.loginNobg}
            alt="AI Voice Agent Enterprise CRM"
            className="h-full w-auto object-contain select-none drop-shadow-[0_25px_60px_rgba(29,78,216,0.25)] transform hover:scale-[1.02] transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.src = assets.loginImg;
            }}
          />

          {/* AI Robotic Eye Gentle Breathing Glow Effect */}
          <div className="absolute top-[16.5%] left-[53.8%] h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_15px_#38BDF8] animate-ping opacity-75 pointer-events-none" />

          {/* ── Top-Right Floating Badge: Senior Enterprise Incoming Call Widget (Apple VisionOS / Stripe / macOS Fluent) ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0, y: [0, -5, 0] }}
            transition={{ opacity: { delay: 0.3 }, y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
            className="absolute -top-6 -right-2 sm:-right-6 h-[88px] px-6 sm:px-7 rounded-[24px] bg-white/85 dark:bg-[#1E293B]/90 backdrop-blur-[24px] backdrop-saturate-[180%] border border-white/70 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_35px_rgba(29,78,216,0.22),0_0_40px_rgba(244,180,0,0.15)] hover:shadow-[0_25px_60px_rgba(29,78,216,0.35),0_0_50px_rgba(244,180,0,0.25)] hover:-translate-y-1 transition-all duration-250 flex items-center gap-5 select-none z-20 group cursor-pointer overflow-hidden relative"
          >
            {/* 2.5px Edge-to-Edge Blue-to-Gold Gradient Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2.5px] rounded-t-[24px] bg-gradient-to-r from-[#1D4ED8] via-[#3B82F6] to-[#F4B400]" />

            {/* 48px Modern Avatar with Animated Gradient Ring */}
            <div className="relative h-12 w-12 rounded-full p-[2px] bg-gradient-to-tr from-[#1D4ED8] via-[#F4B400] to-[#2563EB] shrink-0 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="h-full w-full rounded-full bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-md flex items-center justify-center text-slate-800 dark:text-slate-100 font-extrabold text-base shadow-inner">
                👤
              </div>
            </div>

            {/* Caller Information (18px SemiBold) & Pulsing Green Live Status Dot with Increased Spacing */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="text-[18px] font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
                +91 80 XXXX XXXX
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Incoming Call</span>
              </div>
            </div>

            {/* 52x52px Circular Call Button with Blue-to-Purple Gradient, Hover Glow & Ripple */}
            <button
              type="button"
              className="h-[52px] w-[52px] rounded-full bg-gradient-to-tr from-[#1D4ED8] via-[#6366F1] to-[#9333EA] flex items-center justify-center text-white shadow-[0_8px_25px_rgba(99,102,241,0.5)] hover:shadow-[0_10px_30px_rgba(147,51,234,0.65)] hover:scale-110 active:scale-95 transition-all duration-250 shrink-0 group/btn cursor-pointer relative overflow-hidden"
            >
              <PhoneCall className="h-5.5 w-5.5 animate-pulse group-hover/btn:rotate-12 transition-transform" />
            </button>
          </motion.div>

          {/* ── Top-Right Floating Voice Spectrum Waveform (Matching User Reference Image) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="absolute top-20 -right-2 sm:-right-4 px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl border border-white/70 dark:border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.1)] flex items-center gap-3 select-none z-20 cursor-pointer group hover:scale-105 transition-all duration-200"
          >
            {/* Dark Purple Squircle Mic Icon Button */}
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] flex items-center justify-center text-white shadow-md shrink-0">
              <Mic className="h-4.5 w-4.5" />
            </div>

            {/* High-Resolution Audio Spectrum Waveform Bars */}
            <div className="flex items-center gap-1.5 h-7 pr-1">
              {[8, 14, 22, 10, 18, 28, 12, 20, 16, 26, 14, 22, 10, 18, 30, 12, 24, 16, 10].map((height, idx) => (
                <span
                  key={idx}
                  className="w-[2px] bg-slate-900 dark:bg-white rounded-full animate-pulse"
                  style={{
                    height: `${height}px`,
                    animationDuration: `${0.4 + (idx % 5) * 0.15}s`
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* ── Bottom-Left Floating Glass Card: Multilingual Support ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-8 left-2 sm:left-6 px-5 py-3.5 rounded-[22px] bg-white/80 dark:bg-[#1E293B]/85 backdrop-blur-[24px] backdrop-saturate-[180%] border border-white/60 dark:border-white/20 shadow-[0_14px_45px_rgba(0,0,0,0.12),0_0_25px_rgba(244,180,0,0.15)] hover:-translate-y-1 hover:border-[#1D4ED8] transition-all duration-250 space-y-1.5 select-none z-20 cursor-pointer group"
          >
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#1D4ED8] group-hover:rotate-45 transition-transform" />
              <span>Multilingual Support</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              <span className="text-[#1D4ED8] dark:text-[#60A5FA]">English</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-sans text-[#F4B400]">தமிழ்</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

