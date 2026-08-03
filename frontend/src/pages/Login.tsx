import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, BASE_URL } from "../api/client";
import ForgeLogo from "../components/ForgeLogo";
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, Lock, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      showToast("Email and password are required.", "error");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      showToast("Successfully signed in to Forge CRM!", "success");
      navigate("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      showToast(err.message || "Invalid credentials, please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  const fillDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    showToast(`Loaded ${roleEmail} demo credentials. Click Access Dashboard to login.`, "info");
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center bg-[#071B36] font-sans overflow-hidden p-4">
      {/* Animated Brand Background Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0F4FA8]/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#FFC107]/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-md my-auto pt-8 pb-4">
        {/* Glassmorphic Login Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-[24px] shadow-2xl p-8 border border-white/20 space-y-6 relative z-10">
          
          {/* Official Company Branding */}
          <div className="flex flex-col items-center text-center space-y-2">
            <ForgeLogo size="lg" variant="full" />
            <span className="text-[11px] font-black tracking-widest text-[#0F4FA8] bg-blue-50 border border-blue-200/80 px-3 py-1 rounded-full uppercase mt-2">
              AI VOICE CRM ENTERPRISE
            </span>
            
            {/* Backend Connection Status */}
            <div className="mt-2 flex items-center justify-center">
              {backendStatus === "checking" && (
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1.5 border border-slate-200">
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                  Checking server status...
                </span>
              )}
              {backendStatus === "healthy" && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Backend Active ({BASE_URL.replace("http://", "").replace("https://", "")})</span>
                </span>
              )}
              {backendStatus === "offline" && (
                <button
                  type="button"
                  onClick={checkBackendHealth}
                  className="text-[11px] font-extrabold text-rose-700 bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-rose-200 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                  title="Click to retry connection"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Backend Offline — Click to Retry</span>
                </button>
              )}
            </div>
          </div>

          {backendError && (
            <div className="p-3 bg-rose-50 border border-rose-200/90 rounded-xl text-xs font-semibold text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Backend Unreachable:</strong> {backendError}
                <div className="text-[10px] text-rose-600 mt-0.5">Ensure backend server is running on {BASE_URL}</div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address / Employee ID
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-medium text-slate-800 bg-slate-50/50 transition"
                  placeholder="admin@forgeindia.com or ADM12345"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-medium text-slate-800 bg-slate-50/50 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#0F4FA8] focus:ring-[#0F4FA8] h-4 w-4"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => showToast("Please contact your IT Administrator to reset password.", "info")}
                className="text-[#0F4FA8] hover:underline font-extrabold cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            
            <button
              type="submit"
              disabled={loading || backendStatus === "offline"}
              className="w-full bg-[#0F4FA8] hover:bg-blue-900 text-white rounded-xl py-3.5 font-black transition disabled:opacity-60 text-xs tracking-wider uppercase shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-[#FFC107]" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-[#FFC107]" />
                  <span>Access Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Security Accounts (Auto-fill) */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase text-center mb-2.5 tracking-wider">
              DEMO SECURITY ACCOUNTS (CLICK TO AUTO-FILL)
            </p>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600 font-medium text-center">
              <button
                type="button"
                onClick={() => fillDemoCredentials("admin@forgeindia.com", "Admin@123")}
                className="bg-slate-50 hover:bg-blue-50/80 hover:border-blue-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
              >
                <span className="font-extrabold text-[#0F4FA8] block">ADMIN</span>
                <span className="truncate block font-semibold text-slate-700">admin@...</span>
                <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Admin@123</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials("tl@forgeindia.com", "Leader@123")}
                className="bg-slate-50 hover:bg-amber-50/80 hover:border-amber-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
              >
                <span className="font-extrabold text-amber-600 block">SUPERVISOR</span>
                <span className="truncate block font-semibold text-slate-700">tl@...</span>
                <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Leader@123</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials("agent@forgeindia.com", "Agent@123")}
                className="bg-slate-50 hover:bg-emerald-50/80 hover:border-emerald-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
              >
                <span className="font-extrabold text-emerald-600 block">AGENT</span>
                <span className="truncate block font-semibold text-slate-700">agent@...</span>
                <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Agent@123</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Professional Footer */}
      <footer className="text-center text-xs text-slate-400 font-semibold pb-4 space-y-1 z-10">
        <div>© 2026 Forge India Connect Pvt. Ltd. · All Rights Reserved</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
          SHAPING FUTURE · AI VOICE CRM ENTERPRISE
        </div>
      </footer>
    </div>
  );
}
