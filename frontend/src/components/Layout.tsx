import { useState, useEffect } from "react";
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
  ChevronLeft,
  Pin,
  Activity,
  RefreshCw,
  Zap,
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
  const [showPinTooltip, setShowPinTooltip] = useState(false);

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

  const role = user?.role || "agent";

  const getNavGroups = (): NavGroup[] => {
    if (role === "admin") {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-6 w-6" /> },
            { 
              to: "/campaigns", 
              label: "AI Voice Agents", 
              icon: <Bot className="h-6 w-6" />,
              badge: <span className="bg-[#FFC107]/10 text-[#FFC107] border border-[#FFC107]/40 text-[10px] font-black px-2 py-0.5 rounded-full ml-auto">3 Active</span>
            },
            { to: "/leads", label: "Lead Management", icon: <Users className="h-6 w-6" /> },
          ],
        },
        {
          title: "VOICE OPERATIONS",
          items: [
            { 
              to: "/live-calls", 
              label: "Live Realtime Calls", 
              icon: <Radio className="h-6 w-6" />,
              badge: <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse ml-auto" />
            },
            { to: "/reports", label: "Call Logs & Audio", icon: <BarChart3 className="h-6 w-6" /> },
          ],
        },
        {
          title: "ADMINISTRATION",
          items: [
            { to: "/users", label: "Users & Agents", icon: <UserCog className="h-6 w-6" /> },
          ],
        },
      ];
    } else if (role === "team_leader") {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-6 w-6" /> },
            { to: "/leads", label: "Leads Pool", icon: <Users className="h-6 w-6" /> },
            { to: "/campaigns", label: "Voice Campaigns", icon: <PhoneCall className="h-6 w-6" /> },
          ],
        },
        {
          title: "OPERATIONS & AUDIT",
          items: [
            { 
              to: "/live-calls", 
              label: "Live Realtime Calls", 
              icon: <Radio className="h-6 w-6" />,
              badge: <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse ml-auto" />
            },
            { to: "/quality", label: "Quality Audit", icon: <ShieldCheck className="h-6 w-6" /> },
            { to: "/leave", label: "Leave Requests", icon: <Calendar className="h-6 w-6" /> },
            { to: "/reports", label: "Call Logs & Reports", icon: <BarChart3 className="h-6 w-6" /> },
          ],
        },
        {
          title: "MANAGEMENT",
          items: [
            { to: "/users", label: "Agents List", icon: <UserCog className="h-6 w-6" /> },
          ],
        },
      ];
    } else {
      return [
        {
          title: "CORE CRM",
          items: [
            { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-6 w-6" /> },
            { to: "/leads", label: "My Assigned Leads", icon: <Users className="h-6 w-6" /> },
            { to: "/dialer", label: "Softphone Dialer", icon: <Phone className="h-6 w-6" /> },
            { to: "/campaigns", label: "Inbound Campaigns", icon: <PhoneCall className="h-6 w-6" /> },
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
      <header className="md:hidden flex items-center justify-between px-5 py-3 bg-[#08182B] text-white shadow-md z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-xl transition"
            aria-label="Open Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>Forge India Connect</span>
            </div>
            <div className="text-[10px] text-[#FFC107] font-bold flex items-center gap-1">
              <Zap className="h-3 w-3 fill-[#FFC107]" />
              <span>AI Voice CRM v2.0</span>
            </div>
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

      {/* 300px Expanded / 80px Collapsed Premium Navigation Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 ${
          isSidebarCollapsed ? "w-[80px]" : "w-[300px]"
        } h-full bg-gradient-to-b from-[#08182B] via-[#0A213D] to-[#061424] text-white flex flex-col flex-shrink-0 z-50 transform transition-all duration-300 ease-in-out shadow-2xl border-r border-slate-800/80 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo & Header Container matching Reference Image */}
        <div className="h-20 border-b border-slate-800/80 flex items-center px-4 bg-[#051120] relative justify-between">
          {!isSidebarCollapsed ? (
            /* Expanded Header: Logo + Title + Chevron Toggle Button */
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#0A3258] border border-[#FFC107]/40 shadow-lg shadow-blue-900/50 text-[#FFC107] font-black flex items-center justify-center flex-shrink-0 text-base">
                  FI
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1 leading-none">
                    <span>Forge India Connect</span>
                  </div>
                  <div className="text-[11px] text-[#FFC107] font-bold mt-1 flex items-center gap-1">
                    <Zap className="h-3 w-3 fill-[#FFC107]" />
                    <span>AI Voice CRM v2.0</span>
                  </div>
                </div>
              </div>

              <button
                onClick={toggleSidebar}
                className="hidden md:flex h-8 w-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white items-center justify-center border border-slate-700/60 shadow-2xs transition cursor-pointer flex-shrink-0"
                title="Collapse Sidebar (Ctrl + B)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Collapsed Header: Centered Logo & Chevron Button */
            <div className="flex flex-col items-center justify-center w-full relative">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#0A3258] border border-[#FFC107]/40 shadow-lg shadow-blue-900/50 text-[#FFC107] font-black flex items-center justify-center text-base flex-shrink-0">
                FI
              </div>

              <button
                onClick={toggleSidebar}
                onMouseEnter={() => setShowPinTooltip(true)}
                onMouseLeave={() => setShowPinTooltip(false)}
                className="mt-1 p-1 text-slate-400 hover:text-[#FFC107] rounded-lg transition"
                title="Expand Sidebar (Ctrl + B)"
              >
                <ChevronRight className="h-4 w-4 text-[#FFC107]" />
              </button>

              {/* Floating Tooltip */}
              {showPinTooltip && (
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-[#0F172A] border border-slate-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap z-50 animate-fade-in pointer-events-none">
                  <ChevronRight className="h-3.5 w-3.5 text-[#FFC107]" />
                  <span>Click to Pin & Expand Sidebar</span>
                  <span className="text-[9px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded ml-1">Ctrl+B</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl absolute right-3"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grouped Navigation List */}
        <nav className={`flex-1 ${isSidebarCollapsed ? "px-2 py-4 space-y-5" : "px-3.5 py-5 space-y-6"} overflow-y-auto softphone-scrollbar`}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              {!isSidebarCollapsed ? (
                <div className="px-3 text-[10px] font-black text-slate-400/90 tracking-widest uppercase mb-2">
                  {group.title}
                </div>
              ) : (
                gIdx > 0 && <div className="w-8 mx-auto border-t border-slate-800/80 my-2" />
              )}

              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex items-center transition-all duration-200 ${
                      isSidebarCollapsed
                        ? `h-14 w-14 mx-auto justify-center rounded-[20px] ${
                            isActive
                              ? "bg-gradient-to-r from-[#1B57A6] via-[#16498C] to-[#0E356A] text-[#FFC107] shadow-lg shadow-blue-950/60"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`
                        : `gap-3.5 px-4 py-3 rounded-[20px] text-xs ${
                            isActive
                              ? "bg-gradient-to-r from-[#1B57A6] via-[#16498C] to-[#0E356A] text-white font-extrabold shadow-lg shadow-blue-950/60"
                              : "text-slate-300 hover:bg-white/10 hover:text-white font-medium"
                          }`
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active Left Yellow Pill Accent matching reference image */}
                      {isActive && (
                        <span className="w-2 h-7 bg-[#FFC107] rounded-r-full absolute left-0 top-1/2 -translate-y-1/2 shadow-md shadow-[#FFC107]/50" />
                      )}

                      <div className={`flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? "text-[#FFC107]" : "text-slate-400 group-hover:text-white"
                      }`}>
                        {item.icon}
                      </div>

                      {!isSidebarCollapsed && (
                        <span className="truncate text-xs tracking-tight flex-1">{item.label}</span>
                      )}

                      {!isSidebarCollapsed && item.badge}

                      {/* Collapsed Tooltip on Hover */}
                      {isSidebarCollapsed && (
                        <span className="absolute left-full ml-4 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-bold rounded-xl shadow-xl border border-slate-700/80 whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

        {/* Bottom User Profile Section */}
        <div className="p-4 border-t border-slate-800/80 bg-[#051120] text-xs">
          {!isSidebarCollapsed ? (
            /* Expanded User Card */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-[#0F4C81] to-blue-600 border border-blue-400/40 flex items-center justify-center font-black text-[#FFC107] text-xs shadow-md">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-[#08182B] rounded-full" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-white truncate text-xs">{user?.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize font-semibold truncate">
                    {user?.role.replace("_", " ")} · {user?.employee_id}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Collapsed User Card (80px Centered) */
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="relative">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#0F4C81] to-blue-600 border border-blue-400/40 flex items-center justify-center font-black text-[#FFC107] text-xs shadow-md">
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-[#08182B] rounded-full" />
              </div>

              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition flex items-center justify-center"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5 text-rose-400" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Sticky Compact Enterprise Header Toolbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md h-16 border-b border-slate-200/80 px-6 flex items-center justify-between gap-4 shadow-2xs">
          
          {/* Left: Welcome Title */}
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 font-bold border-r pr-3.5 border-slate-200">
              <span>Dashboard</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-[#0F4C81] font-black">{getCurrentPageTitle()}</span>
            </div>

            <div>
              <h1 className="text-[#0F4C81] font-black text-sm md:text-base leading-none">
                Welcome, {user?.name || "User"}
              </h1>
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
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-[#0F4C81]/5 text-xs font-medium text-slate-800 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 transition"
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
              className="h-9 px-3.5 bg-[#0F4C81] hover:bg-blue-900 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
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
                <span className="absolute top-1 right-1 h-2 w-2 bg-[#FFC107] rounded-full border border-white" />
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
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#0F4C81] to-blue-600 text-[#FFC107] font-black text-xs flex items-center justify-center shadow-2xs">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
            </div>
          </div>

        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 softphone-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
