import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  PhoneCall,
  UserCog,
  Radio,
  BarChart3,
  Calendar,
  Phone,
  LogOut,
  ShieldCheck
} from "lucide-react";

const NAV_BY_ROLE: Record<string, { to: string; label: string }[]> = {
  admin: [
    { to: "/", label: "Dashboard" },
    { to: "/leads", label: "Leads" },
    { to: "/campaigns", label: "Campaigns" },
    { to: "/users", label: "Users" },
    { to: "/live-calls", label: "Live Calls" },
    { to: "/reports", label: "Reports" },
  ],
  team_leader: [
    { to: "/", label: "Dashboard" },
    { to: "/leads", label: "Leads" },
    { to: "/campaigns", label: "Campaigns" },
    { to: "/users", label: "Agents" },
    { to: "/live-calls", label: "Live Calls" },
    { to: "/leave", label: "Leave Requests" },
    { to: "/quality", label: "Quality Audit" },
    { to: "/reports", label: "Reports" },
  ],
  agent: [
    { to: "/", label: "Dashboard" },
    { to: "/leads", label: "My Leads" },
    { to: "/dialer", label: "Dialer" },
    { to: "/campaigns", label: "Inbound Campaigns" },
  ],
};

const getIcon = (label: string, className = "h-4 w-4") => {
  switch (label.toLowerCase()) {
    case "dashboard":
      return <LayoutDashboard className={className} />;
    case "leads":
    case "my leads":
      return <Users className={className} />;
    case "campaigns":
    case "inbound campaigns":
      return <PhoneCall className={className} />;
    case "users":
    case "agents":
      return <UserCog className={className} />;
    case "live calls":
      return <Radio className={className} />;
    case "reports":
      return <BarChart3 className={className} />;
    case "leave requests":
      return <Calendar className={className} />;
    case "dialer":
      return <Phone className={className} />;
    case "quality audit":
      return <ShieldCheck className={className} />;
    default:
      return null;
  }
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const nav = user ? NAV_BY_ROLE[user.role] || [] : [];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-[#f4f6fb]">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 bg-forgeBlue text-white shadow-md z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1 hover:bg-blue-800 rounded transition"
            aria-label="Open Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <div className="font-bold text-sm tracking-tight">Forge India Connect</div>
            <div className="text-[10px] text-blue-200">AI Voice CRM</div>
          </div>
        </div>
        <div className="text-xs text-right font-medium">
          {user?.name.split(" ")[0]}
        </div>
      </header>

      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* Sidebar - static on desktop, slide-out drawer on mobile */}
      <aside
        className={`fixed md:static inset-y-0 left-0 w-60 h-full bg-forgeBlue text-white flex flex-col flex-shrink-0 z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-blue-800 flex justify-between items-center">
          <div>
            <div className="font-extrabold text-lg tracking-tight">Forge India</div>
            <div className="text-xs text-blue-200">AI Voice Calling CRM</div>
          </div>
          {/* Close button inside mobile menu */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 hover:bg-blue-800 rounded text-lg font-bold"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-xl text-sm transition ${
                  isActive ? "bg-forgeGold text-forgeBlue font-extrabold shadow-md" : "hover:bg-blue-800 font-medium text-blue-100"
                }`
              }
            >
              <div className="flex items-center gap-3">
                {getIcon(item.label)}
                <span>{item.label}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Footer User summary */}
        <div className="p-4 border-t border-blue-800 text-sm bg-blue-950/40 font-semibold">
          <div className="font-bold text-white">{user?.name}</div>
          <div className="text-xs text-blue-200 capitalize mb-3">
            {user?.role.replace("_", " ")} · {user?.employee_id}
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="w-full text-center text-xs bg-blue-800/60 hover:bg-red-700 hover:text-white text-blue-200 font-bold py-2.5 rounded-xl border border-blue-700/50 transition flex items-center justify-center gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main scrolling content area */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-6 bg-[#f4f6fb] relative flex flex-col">
        <Outlet />
      </main>

    </div>
  );
}
