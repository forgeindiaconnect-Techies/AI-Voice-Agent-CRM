import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForgeLogo from "./ForgeLogo";
import {
  Menu,
  X,
  LayoutGrid,
  Users,
  Megaphone,
  UserPlus,
  Radio,
  History,
  Phone,
  LogOut,
  ShieldCheck,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  Activity,
  RefreshCw,
  Bot
} from "lucide-react";

type NavGroup = {
  title: string;
  items: { to: string; label: string; icon: React.ReactNode; badge?: React.ReactNode }[];
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Load collapse state from localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  const [darkMode, setDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Ctrl + B keybinding to toggle sidebar expansion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev: boolean) => {
          const next = !prev;
          localStorage.setItem("sidebar_collapsed", JSON.stringify(next));
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", JSON.stringify(next));
      return next;
    });
  };

  const role = user?.role || "admin";

  const getNavGroups = (): NavGroup[] => {
    if (role === "admin") {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutGrid className="h-5 w-5" /> },
            { 
              to: "/ai-agents", 
              label: "AI Agents", 
              icon: <Bot className="h-5 w-5" />,
              badge: (
                <span className="bg-[#2D2A17] text-[#D4AF37] border border-[#54481E]/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full ml-auto shrink-0">
                  3 Live
                </span>
              )
            },
            { to: "/campaigns", label: "Campaigns", icon: <Megaphone className="h-5 w-5" /> },
            { to: "/leads", label: "Lead Management", icon: <Users className="h-5 w-5" /> },
            { 
              to: "/live-calls", 
              label: "Live Calls", 
              icon: <Radio className="h-5 w-5" />,
              badge: <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] ml-auto shrink-0 shadow-xs animate-pulse" />
            },
            { to: "/reports", label: "Call Logs", icon: <History className="h-5 w-5" /> },
          ],
        },
        {
          title: "VERTICAL MODULES",
          items: [
            { to: "/users", label: "Recruitment", icon: <UserPlus className="h-5 w-5" /> },
          ],
        },
      ];
    } else if (role === "team_leader") {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutGrid className="h-5 w-5" /> },
            { 
              to: "/ai-agents", 
              label: "AI Agents", 
              icon: <Bot className="h-5 w-5" />,
              badge: (
                <span className="bg-[#2D2A17] text-[#D4AF37] border border-[#54481E]/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full ml-auto shrink-0">
                  3 Live
                </span>
              )
            },
            { to: "/campaigns", label: "Campaigns", icon: <Megaphone className="h-5 w-5" /> },
            { to: "/leads", label: "Lead Management", icon: <Users className="h-5 w-5" /> },
            { 
              to: "/live-calls", 
              label: "Live Calls", 
              icon: <Radio className="h-5 w-5" />,
              badge: <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] ml-auto shrink-0 shadow-xs animate-pulse" />
            },
            { to: "/reports", label: "Call Logs", icon: <History className="h-5 w-5" /> },
          ],
        },
        {
          title: "VERTICAL MODULES",
          items: [
            { to: "/quality", label: "Quality Audit", icon: <ShieldCheck className="h-5 w-5" /> },
            { to: "/users", label: "Recruitment", icon: <UserPlus className="h-5 w-5" /> },
          ],
        },
      ];
    } else {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutGrid className="h-5 w-5" /> },
            { to: "/leads", label: "My Assigned Leads", icon: <Users className="h-5 w-5" /> },
            { to: "/dialer", label: "Softphone Dialer", icon: <Phone className="h-5 w-5" /> },
            { to: "/campaigns", label: "Campaigns", icon: <Megaphone className="h-5 w-5" /> },
            { to: "/reports", label: "Call Logs", icon: <History className="h-5 w-5" /> },
          ],
        },
      ];
    }
  };

  const navGroups = getNavGroups();

  const getCurrentPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Overview";
    if (path === "/ai-agents") return "AI Voice Agents";
    if (path === "/leads") return "Leads Management";
    if (path === "/campaigns" || path === "/campaigns-list") return "Campaigns";
    if (path === "/users") return "Recruitment & Access Control";
    if (path === "/live-calls") return "Live Call Console";
    if (path === "/reports") return "Call Logs & Analytics";
    if (path === "/quality") return "Quality Audit";
    if (path === "/leave") return "Leave Approvals";
    if (path === "/dialer") return "Softphone Dialer";
    return "Workspace";
  };

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col md:flex-row ${darkMode ? "bg-slate-950 text-white" : "bg-[#F5F7FB] text-slate-800"}`}>
      
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-3 bg-[#081D38] text-white shadow-md z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-xl transition"
            aria-label="Open Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ForgeLogo size="sm" variant="full" />
        </div>
        <div className="text-xs font-bold text-right text-[#FFC107]">
          {user?.name?.split(" ")[0] || "User"}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* 240px Expanded / 72px Collapsed Navigation Sidebar matching exact format */}
      <aside
        className={`fixed md:static inset-y-0 left-0 ${
          isSidebarCollapsed ? "w-[72px]" : "w-[240px]"
        } h-full bg-[#081D38] text-white flex flex-col flex-shrink-0 z-50 transform transition-all duration-250 ease-in-out shadow-2xl border-r border-slate-800/80 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* LOGO AREA / BRANDING */}
        <div className="h-[76px] border-b border-slate-800/80 bg-[#081D38] flex items-center justify-between px-4 relative select-none shrink-0">
          <div
            onClick={toggleSidebar}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
            title={isSidebarCollapsed ? "Expand Sidebar (Ctrl + B)" : "Collapse Sidebar (Ctrl + B)"}
          >
            <img
              src="/logo-square.png"
              alt="Forge Emblem"
              className="h-10 w-10 object-contain drop-shadow-sm shrink-0"
            />
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="font-extrabold text-white text-sm tracking-tight leading-tight truncate">
                  Forge CRM
                </h2>
                <span className="text-[10px] font-bold text-[#FFC107] tracking-wider uppercase block truncate">
                  AI Voice Agent CRM
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grouped Navigation List matching exact format in screenshot */}
        <nav className={`flex-1 ${isSidebarCollapsed ? "px-2 py-3 space-y-4" : "px-3 py-4 space-y-4"} overflow-y-auto softphone-scrollbar`}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1 my-2">
              {!isSidebarCollapsed ? (
                <div className="px-3 text-[11px] font-extrabold text-slate-400/90 tracking-wider uppercase mb-2">
                  {group.title}
                </div>
              ) : (
                gIdx > 0 && <div className="w-6 mx-auto border-t border-slate-800/80 my-2" />
              )}

              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex items-center h-[46px] transition-all duration-200 ${
                      isSidebarCollapsed
                        ? `w-12 mx-auto justify-center rounded-xl ${
                            isActive
                              ? "bg-[#1860C4] text-white font-semibold shadow-md"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`
                        : `gap-3 px-3.5 rounded-xl text-[14px] font-semibold ${
                            isActive
                              ? "bg-[#1860C4] text-white font-bold shadow-md"
                              : "text-slate-300 hover:text-white hover:bg-white/5"
                          }`
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`flex items-center justify-center shrink-0 transition-colors duration-200 ${
                        isActive ? "text-[#FFC107]" : "text-slate-400 group-hover:text-white"
                      }`}>
                        {item.icon}
                      </div>

                      {!isSidebarCollapsed && (
                        <span className="truncate text-[14px] tracking-tight flex-1 font-medium">{item.label}</span>
                      )}

                      {!isSidebarCollapsed && item.badge}

                      {/* Collapsed Tooltip on Hover */}
                      {isSidebarCollapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#081D38] text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom User Profile Section & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-[#05172E] text-xs space-y-2 shrink-0">
          {!isSidebarCollapsed ? (
            <>
              {/* User Profile Card */}
              <div className="bg-[#081D38] border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-3 shadow-inner">
                <div className="h-9 w-9 rounded-full bg-[#1860C4] text-[#FFC107] font-extrabold text-sm flex items-center justify-center shrink-0 shadow-md">
                  {user?.name ? user.name[0].toUpperCase() : "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-xs truncate">{user?.name || "Admin User"}</div>
                  <div className="text-[11px] font-semibold text-[#FFC107] capitalize truncate">
                    {user?.role === "admin" ? "Admin" : user?.role?.replace("_", " ") || "Admin"}
                  </div>
                </div>
              </div>

              {/* Version & Live Status */}
              <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 px-1">
                <span>v1.0 Enterprise</span>
                <span className="text-[#FFC107] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107] animate-ping" />
                  LIVE SYNC
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[#F87171] hover:bg-rose-500/10 transition font-semibold text-xs cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4 text-[#F87171] shrink-0" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-1">
              <div
                className="h-9 w-9 rounded-full bg-[#1860C4] text-[#FFC107] font-extrabold text-sm flex items-center justify-center shadow-md cursor-pointer"
                title={`${user?.name || "Admin User"} (${user?.role || "Admin"})`}
              >
                {user?.name ? user.name[0].toUpperCase() : "A"}
              </div>

              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="p-1.5 text-[#F87171] hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4 text-[#F87171]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* STICKY TOP HEADER TOOLBAR (72px Height, Aligned Controls) */}
        <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur-md h-[72px] border-b border-[#E7ECF5] px-6 flex items-center justify-between gap-4 shadow-2xs shrink-0">
          
          {/* Left: Brand / Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-2 border-r pr-3.5 border-[#E7ECF5] h-6">
              <ForgeLogo size="sm" variant="full" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium truncate">
              <span>Dashboard</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-[#0F4FA8] font-bold">{getCurrentPageTitle()}</span>
            </div>
          </div>

          {/* Center Global Search Bar (Reduced width w-64 max-w-xs) */}
          <div className="hidden lg:flex items-center relative w-64 max-w-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads, calls... (Ctrl + K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs font-medium text-slate-800 rounded-xl border border-[#E7ECF5] focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]/30 transition"
            />
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2.5">




            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl transition relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-0.5 right-0.5 h-2 w-2 bg-[#FFC107] rounded-full border border-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E7ECF5] rounded-2xl shadow-xl p-4 z-50 text-xs animate-scale-in">
                  <div className="font-bold text-slate-900 border-b border-[#E7ECF5] pb-2 mb-2 flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-[10px] bg-blue-100 text-[#0F4FA8] font-bold px-2 py-0.5 rounded-full">3 New</span>
                  </div>
                  <div className="space-y-2 text-slate-600">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="font-bold text-slate-800">New Campaign Launched</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Outbound Sales Campaign active with 5 channels.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-4 w-4 text-[#FFC107]" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            <div className="h-5 border-l border-[#E7ECF5]" />

            {/* User Profile Badge */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#0F4FA8] text-[#FFC107] font-bold text-xs flex items-center justify-center shadow-2xs">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
            </div>
          </div>

        </header>

        {/* Scrollable Content Viewport (24px Page Padding) */}
        <main className="flex-1 overflow-y-auto p-6 softphone-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
