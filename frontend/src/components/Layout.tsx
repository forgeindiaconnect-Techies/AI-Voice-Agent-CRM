import { useState, useEffect, useRef } from "react";
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

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", JSON.stringify(true));
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", JSON.stringify(false));
    }
  }, [darkMode]);

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

  // Ctrl + K keybinding to focus global search
  useEffect(() => {
    const handleSearchKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleSearchKey);
    return () => window.removeEventListener("keydown", handleSearchKey);
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
                <span className="dk-live-badge ml-auto shrink-0 dark:bg-[rgba(245,158,11,0.15)] dark:border dark:border-[rgba(245,158,11,0.3)] dark:text-[#FCD34D] bg-[#2D2A17] text-[#D4AF37] border border-[#54481E]/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
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
              badge: (
                <span className="relative ml-auto shrink-0 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )
            },
            { to: "/dialer", label: "Manual Dialer", icon: <Phone className="h-5 w-5" /> },
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
                <span className="dk-live-badge ml-auto shrink-0 dark:bg-[rgba(245,158,11,0.15)] dark:border dark:border-[rgba(245,158,11,0.3)] dark:text-[#FCD34D] bg-[#2D2A17] text-[#D4AF37] border border-[#54481E]/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
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
              badge: (
                <span className="relative ml-auto shrink-0 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )
            },
            { to: "/dialer", label: "Manual Dialer", icon: <Phone className="h-5 w-5" /> },
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
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col md:flex-row ${
        darkMode ? "bg-[#0B1220] text-white" : "bg-[#F5F7FB] text-slate-800"
      }`}
    >
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-3 bg-[#081D38] text-white shadow-md z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 hover:bg-white/10 rounded-xl transition"
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
          className="fixed inset-0 bg-black/70 z-50 md:hidden backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 ${
          isSidebarCollapsed ? "w-[72px]" : "w-[240px]"
        } h-full flex flex-col flex-shrink-0 z-50 transform transition-all duration-250 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={
          darkMode
            ? {
                background: "linear-gradient(180deg, #101B2D 0%, #0D1826 100%)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
                color: "#F8FAFC",
              }
            : {
                background: "#FFFFFF",
                borderRight: "1px solid #E2E8F0",
                boxShadow: "4px 0 20px rgba(15,23,42,0.04)",
                color: "#0F172A",
              }
        }
      >
        {/* ── LOGO AREA ── */}
        <div
          className={`h-[72px] flex items-center justify-between shrink-0 select-none ${
            isSidebarCollapsed ? "px-3" : "px-4"
          }`}
          style={
            darkMode
              ? {
                  background: "linear-gradient(135deg,#0D1826 0%,#0F1D30 100%)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }
              : {
                  background: "#FFFFFF",
                  borderBottom: "1px solid #F1F5F9",
                }
          }
        >
          <div
            onClick={toggleSidebar}
            className="flex items-center gap-3 cursor-pointer overflow-hidden group"
            title={isSidebarCollapsed ? "Expand Sidebar (Ctrl + B)" : "Collapse Sidebar (Ctrl + B)"}
          >
            <div className="h-9 w-9 flex items-center justify-center shrink-0">
              <img
                src="/logo-square.png"
                alt="Forge Emblem"
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm tracking-tight leading-tight truncate text-[#2563EB] dark:text-[#60A5FA]">
                  Forge CRM
                </h2>
                <span
                  className="text-[10px] font-bold tracking-wider uppercase block truncate text-[#F59E0B] dark:text-[#FFC107]"
                >
                  AI Voice Agent CRM
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className={`md:hidden p-1 rounded-lg transition ${darkMode ? "text-white/40 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-800 hover:bg-slate-100"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── NAV GROUPS ── */}
        <nav
          className={`flex-1 ${
            isSidebarCollapsed ? "px-2 py-3 space-y-4" : "px-3 py-4 space-y-5"
          } overflow-y-auto softphone-scrollbar`}
        >
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {!isSidebarCollapsed ? (
                <div
                  className="px-3 pb-1.5 text-[10px] font-extrabold tracking-widest uppercase"
                  style={{ color: darkMode ? "rgba(100,116,139,0.75)" : "#94A3B8" }}
                >
                  {group.title}
                </div>
              ) : (
                gIdx > 0 && (
                  <div
                    className="w-8 mx-auto my-2"
                    style={{ borderTop: darkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid #F1F5F9" }}
                  />
                )
              )}

              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex items-center h-[44px] rounded-[14px] transition-all duration-200 ${
                      isSidebarCollapsed
                        ? `w-11 mx-auto justify-center ${
                            isActive
                              ? "text-white"
                              : darkMode
                              ? "text-white/50 hover:text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`
                        : `gap-3 px-3.5 text-[15px] font-medium ${
                            isActive
                              ? "text-white font-bold"
                              : darkMode
                              ? "text-white/65 hover:text-white"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                          }`
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: "linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)",
                          boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                          color: "#FFFFFF",
                        }
                      : {}
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Hover bg (non-active only) */}
                      {!isActive && (
                        <span
                          className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: darkMode ? "rgba(255,255,255,0.055)" : "rgba(241,245,249,0.8)" }}
                        />
                      )}

                      {/* Icon */}
                      <span
                        className="relative flex items-center justify-center shrink-0 transition-colors duration-200"
                        style={{ color: isActive ? "#FFC107" : undefined }}
                      >
                        {item.icon}
                      </span>

                      {/* Label */}
                      {!isSidebarCollapsed && (
                        <span className="relative truncate text-[15px] tracking-tight flex-1 font-medium">
                          {item.label}
                        </span>
                      )}

                      {/* Badge */}
                      {!isSidebarCollapsed && item.badge}

                      {/* Collapsed tooltip */}
                      {isSidebarCollapsed && (
                        <span
                          className="absolute left-full ml-3 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={
                            darkMode
                              ? {
                                  background: "linear-gradient(135deg,#151F32 0%,#1B2740 100%)",
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                                  color: "#F8FAFC",
                                }
                              : {
                                  background: "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                                  color: "#0F172A",
                                }
                          }
                        >
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

        {/* ── BOTTOM PROFILE SECTION ── */}
        <div
          className="p-3 space-y-2 shrink-0"
          style={
            darkMode
              ? {
                  background: "rgba(10,16,28,0.85)",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }
              : {
                  background: "#F8FAFC",
                  borderTop: "1px solid #E2E8F0",
                }
          }
        >
          {!isSidebarCollapsed ? (
            <>
              {/* User Profile Card */}
              <div
                className="flex items-center gap-3 p-2.5 rounded-[14px]"
                style={
                  darkMode
                    ? {
                        background: "linear-gradient(135deg,rgba(21,31,50,0.9) 0%,rgba(27,39,64,0.8) 100%)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                      }
                    : {
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                      }
                }
              >
                <div
                  className="h-9 w-9 rounded-full font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)",
                    color: "#FFC107",
                  }}
                >
                  {user?.name ? user.name[0].toUpperCase() : "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-xs truncate ${darkMode ? "text-white" : "text-slate-900"}`}>
                    {user?.name || "Admin User"}
                  </div>
                  <div className="text-[11px] font-semibold truncate text-[#F59E0B] dark:text-[#FFC107]">
                    {user?.role === "admin"
                      ? "Admin"
                      : user?.role?.replace("_", " ") || "Admin"}
                  </div>
                </div>
              </div>

              {/* Version & Live Status */}
              <div className="flex items-center justify-between text-[10px] font-extrabold px-1">
                <span className={darkMode ? "text-slate-500" : "text-slate-400"}>v1.0 Enterprise</span>
                <span className="flex items-center gap-1.5" style={{ color: darkMode ? "#FCD34D" : "#059669" }}>
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                  LIVE SYNC
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition font-semibold text-xs cursor-pointer text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                title="Logout"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-1">
              <div
                className="h-9 w-9 rounded-full font-extrabold text-sm flex items-center justify-center shadow-sm cursor-pointer"
                style={{
                  background: "linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)",
                  color: "#FFC107",
                }}
                title={`${user?.name || "Admin User"} (${user?.role || "Admin"})`}
              >
                {user?.name ? user.name[0].toUpperCase() : "A"}
              </div>

              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="p-1.5 rounded-lg transition cursor-pointer text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* ── STICKY TOP HEADER ── */}
        <header
          className="sticky top-0 z-[1000] h-[68px] px-6 flex items-center justify-between gap-4 shrink-0 transition-all duration-200"
          style={
            darkMode
              ? {
                  background: "rgba(10,16,28,0.95)",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3)",
                }
              : {
                  background: "rgba(255,255,255,0.96)",
                  borderBottom: "1px solid #E7ECF5",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.06)",
                }
          }
        >
          {/* Left: Brand / Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="hidden sm:flex items-center gap-2 pr-3.5 h-6"
              style={{ borderRight: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E7ECF5" }}
            >
              <ForgeLogo size="sm" variant="full" />
            </div>
            <div className="flex items-center gap-1.5 text-[14px] font-medium truncate">
              <span style={{ color: darkMode ? "rgba(100,116,139,0.85)" : "#94A3B8" }}>
                Dashboard
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: darkMode ? "rgba(100,116,139,0.5)" : "#CBD5E1" }}
              />
              <span
                className="font-bold text-[14px]"
                style={{ color: darkMode ? "#60A5FA" : "#0F4FA8" }}
              >
                {getCurrentPageTitle()}
              </span>
            </div>
          </div>

          {/* Center: Global Search */}
          <div className="hidden lg:flex items-center relative" style={{ minWidth: 340, maxWidth: 420, width: "100%" }}>
            {/* Search Icon */}
            <Search
              className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-250 z-10"
              style={{
                width: 18,
                height: 18,
                color: darkMode ? "#60A5FA" : "#2563EB",
              }}
            />

            {/* Input */}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search leads, calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="forge-search-input w-full pr-[90px] text-[13.5px] font-medium transition-all duration-250 focus:outline-none"
              style={{
                height: 48,
                paddingLeft: 44,
                borderRadius: 14,
                background: darkMode ? "#18243A" : "#FFFFFF",
                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #CBD5E1",
                color: darkMode ? "#F8FAFC" : "#0F172A",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget;
                t.style.background = darkMode ? "#1D2A44" : "#F8FAFC";
                t.style.borderColor = darkMode ? "#3B82F6" : "#3B82F6";
                t.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget;
                if (document.activeElement !== t) {
                  t.style.background = darkMode ? "#18243A" : "#FFFFFF";
                  t.style.borderColor = darkMode ? "rgba(255,255,255,0.08)" : "#CBD5E1";
                  t.style.transform = "translateY(0px)";
                }
              }}
              onFocus={(e) => {
                const t = e.target;
                t.style.background = darkMode ? "#1D2A44" : "#FFFFFF";
                t.style.borderColor = "#2563EB";
                t.style.boxShadow = darkMode
                  ? "0 0 0 2px rgba(37,99,235,0.35)"
                  : "0 0 0 2px rgba(37,99,235,0.15)";
                t.style.transform = "translateY(0px)";
              }}
              onBlur={(e) => {
                const t = e.target;
                t.style.background = darkMode ? "#18243A" : "#FFFFFF";
                t.style.borderColor = darkMode ? "rgba(255,255,255,0.08)" : "#CBD5E1";
                t.style.boxShadow = "none";
                t.style.transform = "translateY(0px)";
              }}
            />

            {/* Ctrl+K Badge */}
            <div
              className="absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center gap-[3px] pointer-events-none select-none"
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 8,
                background: darkMode ? "#0F172A" : "#F8FAFC",
                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E2E8F0",
                boxShadow: darkMode ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(15,23,42,0.06)",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: darkMode ? "#94A3B8" : "#64748B",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2">

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 cursor-pointer"
                style={
                  darkMode
                    ? {
                        background: "rgba(21,31,50,0.7)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "#94A3B8",
                      }
                    : { color: "#64748B" }
                }
                onMouseEnter={(e) => {
                  if (darkMode) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.12)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.3)";
                    (e.currentTarget as HTMLElement).style.color = "#fff";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(37,99,235,0.25)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (darkMode) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(21,31,50,0.7)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }
                }}
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {/* Animated notification dot */}
                <span
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                  style={{
                    background: "#F59E0B",
                    boxShadow: darkMode
                      ? "0 0 6px rgba(245,158,11,0.7)"
                      : "0 0 0 2px white",
                    border: darkMode ? "none" : "2px solid white",
                  }}
                />
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 p-4 z-50 text-xs animate-scale-in"
                  style={
                    darkMode
                      ? {
                          background: "linear-gradient(145deg,#151F32 0%,#1B2740 100%)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                          borderRadius: 18,
                        }
                      : {
                          background: "#fff",
                          border: "1px solid #E7ECF5",
                          boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
                          borderRadius: 18,
                        }
                  }
                >
                  <div
                    className="font-bold pb-2 mb-3 flex justify-between items-center"
                    style={{
                      color: darkMode ? "#F8FAFC" : "#0F172A",
                      borderBottom: darkMode
                        ? "1px solid rgba(255,255,255,0.07)"
                        : "1px solid #E7ECF5",
                    }}
                  >
                    <span>Notifications</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={
                        darkMode
                          ? { background: "rgba(37,99,235,0.15)", color: "#60A5FA" }
                          : { background: "#EFF6FF", color: "#0F4FA8" }
                      }
                    >
                      3 New
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{
                        background: darkMode ? "rgba(27,39,64,0.7)" : "#F8FAFC",
                      }}
                    >
                      <div
                        className="font-bold text-xs"
                        style={{ color: darkMode ? "#F8FAFC" : "#0F172A" }}
                      >
                        New Campaign Launched
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: darkMode ? "#64748B" : "#94A3B8" }}
                      >
                        Outbound Sales Campaign active with 5 channels.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 cursor-pointer"
              style={
                darkMode
                  ? {
                      background: "rgba(21,31,50,0.7)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "#FCD34D",
                    }
                  : { color: "#64748B" }
              }
              onMouseEnter={(e) => {
                if (darkMode) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.12)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (darkMode) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(21,31,50,0.7)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                }
              }}
              title="Toggle Theme"
            >
              {darkMode ? (
                <Sun className="h-4 w-4" style={{ color: "#FCD34D" }} />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Divider */}
            <div
              className="h-5"
              style={{
                borderLeft: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #E7ECF5",
              }}
            />

            {/* User Avatar */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-xl font-bold text-xs flex items-center justify-center"
                style={
                  darkMode
                    ? {
                        background: "linear-gradient(135deg,#1D4ED8 0%,#2563EB 100%)",
                        color: "#FFC107",
                        boxShadow: "0 0 0 2px rgba(37,99,235,0.35), 0 4px 12px rgba(37,99,235,0.25)",
                      }
                    : {
                        background: "#0F4FA8",
                        color: "#FFC107",
                      }
                }
              >
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 softphone-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
