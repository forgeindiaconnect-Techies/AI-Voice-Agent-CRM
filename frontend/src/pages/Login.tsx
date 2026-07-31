import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Mic } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Ask for desktop notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showToast("Successfully signed in to Forge CRM!", "success");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Invalid credentials, please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forgeBlue via-[#083A78] to-slate-900 px-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-8 border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex p-3.5 rounded-full bg-forgeBlue/10 text-forgeBlue mb-3 items-center justify-center">
            <Mic className="h-7 w-7 text-forgeBlue animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-forgeBlue tracking-tight">Forge India Connect</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Enterprise AI Voice Calling CRM</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Address / Employee ID
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forgeBlue transition bg-gray-50/50"
              placeholder="e.g. admin@forgeindia.com or ADM12345"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forgeBlue transition bg-gray-50/50"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forgeBlue text-white rounded-xl py-3 font-semibold hover:bg-blue-800 hover:shadow-lg transition disabled:opacity-60 text-sm mt-2"
          >
            {loading ? "Verifying Credentials..." : "Access Dashboard"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-semibold text-center mb-2">DEMO SECURITY ACCOUNTS:</p>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500 font-medium text-center">
            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
              <span className="font-bold text-forgeBlue block">ADMIN</span>
              admin@forgeindia.com
              <span className="text-gray-400 block font-normal mt-0.5">Admin@123</span>
            </div>
            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
              <span className="font-bold text-forgeBlue block">SUPERVISOR</span>
              tl@forgeindia.com
              <span className="text-gray-400 block font-normal mt-0.5">Leader@123</span>
            </div>
            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
              <span className="font-bold text-forgeBlue block">AGENT</span>
              agent@forgeindia.com
              <span className="text-gray-400 block font-normal mt-0.5">Agent@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
