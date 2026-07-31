import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  ShieldCheck,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Activity,
  RefreshCw
} from "lucide-react";

type NavGroup = {
  title: string;
  items: { to: string; label: string; icon: React.ReactNode }[];
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const role = user?.role || "agent";

  const getNavGroups = (): NavGroup[] => {
    if (role === "admin") {
      return [
        {
          title: "MAIN WORKSPACE",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
            { to: "/leads", label: "Leads", icon: <Users className="h-4 w-4" /> },
            { to: "/campaigns", label: "Campaigns", icon: <PhoneCall className="h-4 w-4" /> },
          ],
        },
        {
          title: "VOICE OPERATIONS",
          items: [
            { to: "/live-calls", label: "Live Calls", icon: <Radio className="h-4 w-4" /> },
            { to: "/reports", label: "Reports & Analytics", icon: <BarChart3 className="h-4 w-4" /> },
          ],
        },
        {
          title: "ADMINISTRATION",
          items: [
            { to: "/users", label: "Users & Agents", icon: <UserCog className="h-4 w-4" /> },
          ],
        },
      ];
    } else if (role === "team_leader") {
      return [
        {
          title: "MAIN WORKSPACE",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
            { to: "/leads", label: "Leads", icon: <Users className="h-4 w-4" /> },
            { to: "/campaigns", label: "Campaigns", icon: <PhoneCall className="h-4 w-4" /> },
          ],
        },
        {
          title: "OPERATIONS & AUDIT",
          items: [
            { to: "/live-calls", label: "Live Calls", icon: <Radio className="h-4 w-4" /> },
            { to: "/quality", label: "Quality Audit", icon: <ShieldCheck className="h-4 w-4" /> },
            { to: "/leave", label: "Leave Requests", icon: <Calendar className="h-4 w-4" /> },
            { to: "/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
          ],
        },
        {
          title: "MANAGEMENT",
          items: [
            { to: "/users", label: "Agents", icon: <UserCog className="h-4 w-4" /> },
          ],
        },
      ];
    } else {
      return [
        {
          title: "MAIN WORKSPACE",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
            { to: "/leads", label: "My Leads", icon: <Users className="h-4 w-4" /> },
            { to: "/dialer", label: "Softphone Dialer", icon: <Phone className="h-4 w-4" /> },
            { to: "/campaigns", label: "Inbound Campaigns", icon: <PhoneCall className="h-4 w-4" /> },
          ],
        },
      ];
    }
  };

  const navGroups = getNavGroups();

  const getCurrentPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Overview";
    if (path === "/leads") return "Leads Management";
    if (path === "/campaigns") return "Campaigns";
    if (path === "/users") return "Users & Access Control";
    if (path === "/live-calls") return "Live Call Console";
    if (path === "/reports") return "Reports & Analytics";
    if (path === "/quality") return "Quality Audit";
    if (path === "/leave") return "Leave Approvals";
    if (path === "/dialer") return "Softphone Dialer";
    return "Workspace";
  };

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col md:flex-row ${darkMode ? "bg-slate-950 text-white" : "bg-[#F5F7FB] text-slate-800"}`}>
      
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-3 bg-[#0F4C9A] text-white shadow-md z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 hover:bg-blue-800 rounded-xl transition"
            aria-label="Open Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>Forge India</span>
              <span className="text-[#F4B400] text-[10px] font-extrabold px-1.5 py-0.2 bg-white/10 rounded">CRM</span>
            </div>
            <div className="text-[10px] text-blue-200">AI Voice Calling Platform</div>
          </div>
        </div>
        <div className="text-xs font-bold text-right">
          {user?.name.split(" ")[0]}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* 280px Fixed Enterprise Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 ${
          isSidebarCollapsed ? "w-20" : "w-[280px]"
        } h-full bg-gradient-to-b from-[#0F4C9A] via-[#0B3C7A] to-[#0A3266] text-white flex flex-col flex-shrink-0 z-50 transform transition-all duration-300 ease-in-out shadow-2xl border-r border-blue-900/40 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo & Brand Header */}
        <div className="p-5 border-b border-blue-800/60 flex justify-between items-center bg-blue-950/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#F4B400] to-amber-500 text-[#0F4C9A] font-black flex items-center justify-center shadow-md flex-shrink-0 text-lg">
              FI
            </div>
            {!isSidebarCollapsed && (
              <div>
                <div className="font-black text-base tracking-tight leading-none text-white flex items-center gap-1">
                  <span>Forge India</span>
                  <span className="text-[10px] bg-[#F4B400] text-[#0F4C9A] px-1.5 py-0.5 rounded font-black">AI</span>
                </div>
                <div className="text-[11px] text-blue-200/90 font-medium mt-1">Voice Calling CRM</div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/60 rounded-xl transition"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/60 rounded-xl"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grouped Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto softphone-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-3 text-[10px] font-black text-blue-300/80 tracking-wider uppercase mb-2">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition duration-150 ${
                      isActive
                        ? "bg-white/15 text-white font-extrabold border-l-4 border-[#F4B400] shadow-xs backdrop-blur-xs pl-3"
                        : "text-blue-100/80 hover:bg-blue-800/50 hover:text-white font-semibold"
                    }`
                  }
                >
                  <div className="flex-shrink-0 text-blue-200">{item.icon}</div>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-blue-800/60 bg-blue-950/60 text-xs">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="h-9 w-9 rounded-xl bg-blue-700 border border-blue-500 flex items-center justify-center font-black text-white text-xs shadow-inner">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-[#0F4C9A] rounded-full" />
            </div>
            
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-white truncate text-xs">{user?.name}</div>
                <div className="text-[10px] text-blue-200/90 capitalize font-medium truncate">
                  {user?.role.replace("_", " ")} · {user?.employee_id}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="p-2 text-blue-300 hover:text-rose-400 hover:bg-blue-900/80 rounded-xl transition flex-shrink-0"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Sticky Compact Enterprise Header Toolbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md h-16 border-b border-slate-200/80 px-6 flex items-center justify-between gap-4 shadow-2xs">
          
          {/* Left: Welcome Title & User Metadata */}
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 font-bold border-r pr-3.5 border-slate-200">
              <span>Dashboard</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-[#0F4C9A] font-black">{getCurrentPageTitle()}</span>
            </div>

            <div>
              <h1 className="text-[#0F4C9A] font-black text-sm md:text-base leading-none">
                Welcome, {user?.name || "User"}
              </h1>
              <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                <span>Role: <strong className="text-[#0F4C9A] capitalize">{user?.role.replace("_", " ")}</strong></span>
                <span>·</span>
                <span>ID: <strong className="text-slate-700">{user?.employee_id}</strong></span>
              </div>
            </div>
          </div>

          {/* Center Global Search Bar */}
          <div className="hidden lg:flex items-center relative max-w-xs xl:max-w-sm w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads, campaigns, calls, agents... (Ctrl + K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-[#0F4C9A]/30 transition"
            />
          </div>

          {/* Right Action Toolbar: Live Updates, Sync Button, Notifications, Profile */}
          <div className="flex items-center gap-3">
            {/* Live Updates Status Indicator */}
            <span className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Activity className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>LIVE UPDATES</span>
            </span>

            {/* Sync Data Button */}
            <button
              onClick={() => window.location.reload()}
              className="h-9 px-3.5 bg-[#0F4C9A] hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
              title="Sync CRM Data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sync Data</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition relative"
                title="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-[#F4B400] rounded-full border border-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-xs animate-scale-in">
                  <div className="font-extrabold text-slate-900 border-b pb-2 mb-2 flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">3 New</span>
                  </div>
                  <div className="space-y-2 text-slate-600">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="font-bold text-slate-800">New Campaign Launched</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Outbound Sales Campaign active with 5 channels.</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="font-bold text-slate-800">Quality Audit Score Ready</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Agent AGT84785 scored 94/100 on Call #8472.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5 text-slate-600" />}
            </button>

            {/* User Profile Mini Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#0F4C9A] to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
            </div>
          </div>

        </header>

        {/* Main Scrollable Workspace Page Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F5F7FB] softphone-scrollbar">
          <Outlet />
        </main>

      </div>

    </div>
  );
}
