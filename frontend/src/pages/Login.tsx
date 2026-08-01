import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, BASE_URL } from "../api/client";
import { Mic, Activity, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forgeBlue via-[#083A78] to-slate-900 px-4 font-sans">
      <div className="bg-white/95 backdrop-blur-md rounded-[24px] shadow-2xl w-full max-w-md p-8 border border-white/20 space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-3.5 rounded-2xl bg-forgeBlue/10 text-forgeBlue mb-3 items-center justify-center shadow-2xs">
            <Mic className="h-7 w-7 text-forgeBlue animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-forgeBlue tracking-tight">Forge India Connect</h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">Enterprise AI Voice Calling CRM</p>
          
          {/* Backend Status Indicator */}
          <div className="mt-3 flex items-center justify-center">
            {backendStatus === "checking" && (
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1.5 border border-slate-200">
                <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                Checking server status...
              </span>
            )}
            {backendStatus === "healthy" && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Backend Connected ({BASE_URL.replace("http://", "").replace("https://", "")})</span>
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address / Employee ID
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forgeBlue font-medium text-slate-800 bg-slate-50/50 transition"
              placeholder="e.g. admin@forgeindia.com or ADM12345"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forgeBlue font-medium text-slate-800 bg-slate-50/50 transition"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || backendStatus === "offline"}
            className="w-full bg-forgeBlue text-white rounded-xl py-3.5 font-bold hover:bg-blue-800 transition disabled:opacity-60 text-sm mt-2 shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Access Dashboard</span>
            )}
          </button>
        </form>

        {/* Demo Security Accounts */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase text-center mb-2.5 tracking-wider">
            DEMO SECURITY ACCOUNTS (CLICK TO AUTO-FILL)
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600 font-medium text-center">
            <button
              type="button"
              onClick={() => fillDemoCredentials("admin@forgeindia.com", "Admin@123")}
              className="bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
            >
              <span className="font-extrabold text-forgeBlue block">ADMIN</span>
              <span className="truncate block font-semibold text-slate-700">admin@...</span>
              <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Admin@123</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials("tl@forgeindia.com", "Leader@123")}
              className="bg-slate-50 hover:bg-amber-50/60 hover:border-amber-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
            >
              <span className="font-extrabold text-amber-600 block">SUPERVISOR</span>
              <span className="truncate block font-semibold text-slate-700">tl@...</span>
              <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Leader@123</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials("agent@forgeindia.com", "Agent@123")}
              className="bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-200 p-2 rounded-xl border border-slate-200 transition cursor-pointer text-left"
            >
              <span className="font-extrabold text-emerald-600 block">AGENT</span>
              <span className="truncate block font-semibold text-slate-700">agent@...</span>
              <span className="text-slate-400 block font-mono text-[9px] mt-0.5">Agent@123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
