import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { CustomPauseIcon } from "../components/CustomPauseIcon";
import { CustomSelect } from "../components/CustomSelect";
import {
  Play,
  Pause,
  X,
  Rocket,
  Users,
  Megaphone,
  Plus,
  Search,
  RotateCcw,
  BarChart2,
  TrendingUp,
  Activity,
  Phone,
  Clock,
  Sparkles,
  Shield,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Bell,
  Zap,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Bot,
  UserCog,
  Layers,
  Radio,
  Sliders,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileText,
  Gauge
} from "lucide-react";

type Pool = { id: string; name: string };
type UserRow = { id: string; name: string; role: string; employee_id: string; pool_id?: string };
type Campaign = {
  id: string;
  campaign_id: string;
  name: string;
  pool_id: string;
  supervisor_id?: string;
  campaign_type: string;
  languages: string[];
  ai_voice?: string;
  calling_hours?: string;
  max_retry?: number;
  retry_interval?: number;
  status: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  agent_ids?: string[];
};

type CampaignStats = {
  campaign_id: string;
  total_leads: number;
  pending_leads: number;
  completed_leads: number;
  interested: number;
  not_interested: number;
  callback_scheduled: number;
  qualified: number;
  converted: number;
  retry_queue: number;
  success_rate: number;
};

type InboundDeptSummary = {
  department: string;
  active_calls: number;
  resolved_calls: number;
  transferred_calls: number;
  missed_calls: number;
  waiting_queue: number;
  available_agents: number;
  average_wait_seconds: number;
  sla_percentage: number;
  status: string;
};

// SVG Mini Sparkline Component for KPI Cards
function Sparkline({ color = "#0F4FA8" }: { color?: string }) {
  return (
    <svg className="w-16 h-7 overflow-visible" viewBox="0 0 70 20">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M0,15 Q15,18 30,7 T50,11 T70,3"
        fill={`url(#sparkGrad-${color.replace("#", "")})`}
      />
      <path
        d="M0,15 Q15,18 30,7 T50,11 T70,3"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 1. Improved Hourly Call Volume & Velocity Chart Component
function HourlyCallVolumeChart() {
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("today");
  const [hoveredPoint, setHoveredPoint] = useState<{ hour: string; val: number; x: number; y: number } | null>(null);

  const dataMap = {
    today: [
      { hour: "8 AM", val: 32 },
      { hour: "9 AM", val: 68 },
      { hour: "10 AM", val: 110 },
      { hour: "11 AM", val: 135 },
      { hour: "12 PM", val: 154 },
      { hour: "1 PM", val: 92 },
      { hour: "2 PM", val: 126 },
      { hour: "3 PM", val: 148 },
      { hour: "4 PM", val: 104 },
      { hour: "5 PM", val: 62 }
    ],
    week: [
      { hour: "Mon", val: 840 },
      { hour: "Tue", val: 980 },
      { hour: "Wed", val: 1120 },
      { hour: "Thu", val: 1250 },
      { hour: "Fri", val: 1180 },
      { hour: "Sat", val: 420 },
      { hour: "Sun", val: 310 }
    ],
    month: [
      { hour: "W1", val: 4100 },
      { hour: "W2", val: 4680 },
      { hour: "W3", val: 5200 },
      { hour: "W4", val: 4950 }
    ]
  };

  const points = dataMap[timeRange];
  const rawMax = Math.max(...points.map(p => p.val));
  const maxVal = rawMax * 1.2;
  const avgVal = Math.round(points.reduce((a, b) => a + b.val, 0) / points.length);
  const width = 640;
  const height = 230;
  const paddingX = 48;
  const paddingY = 35;

  const pathPoints = points.map((p, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (p.val / maxVal) * (height - 2 * paddingY);
    return { x, y, ...p };
  });

  const d = pathPoints.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = a[i - 1];
    const dx = point.x - prev.x;
    const tension = 0.3;
    const cx1 = prev.x + dx * tension;
    const cy1 = prev.y;
    const cx2 = point.x - dx * tension;
    const cy2 = point.y;
    return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${point.x},${point.y}`;
  }, "");

  const areaD = `${d} L ${pathPoints[pathPoints.length - 1].x},${height - paddingY} L ${pathPoints[0].x},${height - paddingY} Z`;
  const avgY = height - paddingY - (avgVal / maxVal) * (height - 2 * paddingY);

  const peakVal = Math.max(...points.map(p => p.val));
  const peakPoint = points.find(p => p.val === peakVal);

  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-6 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] dark:border-t-2 dark:border-t-[#2563EB] space-y-5 relative overflow-hidden group hover:shadow-md transition-all duration-250">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-3.5">
        <div>
          <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Hourly Call Volume & Velocity</span>
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-[#94A3B8] font-medium mt-0.5">
            Real-time dialer throughput across active AI voice channels
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Today/Week/Month Segmented Control */}
          <div className="flex bg-slate-100 dark:bg-[#0B1220] p-1 rounded-xl border border-slate-200/80 dark:border-white/5 text-xs font-bold shrink-0">
            {(["today", "week", "month"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all duration-200 cursor-pointer ${
                  timeRange === range
                    ? "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                    : "text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Premium Glass Peak Badge */}
          <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Peak: {peakVal} Calls/{timeRange === "today" ? "hr" : timeRange === "week" ? "day" : "wk"}{peakPoint ? ` (${peakPoint.hour})` : ""}</span>
          </span>
        </div>
      </div>

      <div className="relative w-full pt-1 pb-3">
        {/* Interactive Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute z-20 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-xl text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full border border-slate-700 dark:border-white/10 font-mono"
            style={{ left: `${(hoveredPoint.x / width) * 100}%`, top: `${(hoveredPoint.y / height) * 100 - 8}%` }}
          >
            <div className="font-bold text-[#FFC107] dark:text-[#FACC15]">{hoveredPoint.hour}</div>
            <div>{hoveredPoint.val} calls/{timeRange === "today" ? "hr" : timeRange === "week" ? "day" : "wk"}</div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
          <defs>
            <linearGradient id="chartGradientMain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const val = Math.round(rawMax * frac);
            const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
            return (
              <g key={idx}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="stroke-slate-100 dark:stroke-white/[0.08]" strokeDasharray="4 4" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[11px] fill-slate-400 dark:fill-[#94A3B8] font-mono font-bold">{val}</text>
              </g>
            );
          })}

          {/* Average reference line */}
          <line x1={paddingX} y1={avgY} x2={width - paddingX} y2={avgY} className="stroke-[#FFC107] dark:stroke-[#FACC15]/40" strokeDasharray="6 6" strokeWidth="1.5" />
          <text x={width - paddingX + 5} y={avgY + 3} className="text-[10px] fill-[#D4AF37] dark:fill-[#FACC15] font-bold">Avg: {avgVal}</text>

          {/* Area & Line */}
          <path d={areaD} fill="url(#chartGradientMain)" />
          <path d={d} fill="none" stroke="url(#chartLineGrad)" strokeWidth="3" strokeLinecap="round" />

          {/* Points & Hour Labels */}
          {pathPoints.map((pt, idx) => (
            <g
              key={idx}
              className="group/pt cursor-pointer"
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint?.hour === pt.hour ? "7" : "5"}
                className="fill-[#2563EB] dark:fill-[#3B82F6] stroke-white dark:stroke-[#131C2F] stroke-2 transition-all duration-150 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
              />
              <text x={pt.x} y={height - 8} textAnchor="middle" className="text-[11px] fill-slate-500 dark:fill-[#94A3B8] font-black uppercase tracking-wider">{pt.hour}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// 2. Realtime AI Dialer Health Widget
function RealtimeAIDialerHealth() {
  return (
    <div className="bg-gradient-to-br from-[#081D38] via-[#0A264A] to-[#041224] dark:from-[#131C2F] dark:via-[#18243A] dark:to-[#0B1220] text-white rounded-[22px] p-6 shadow-md dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-[#0F4FA8]/40 dark:border-white/[0.06] space-y-4 relative overflow-hidden">
      <div className="flex justify-between items-center border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#0F4FA8]/30 rounded-xl border border-[#0F4FA8]/50 text-[#FFC107] dark:text-[#FACC15]">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-white tracking-tight">Realtime AI Dialer Health</h3>
            <p className="text-[12px] text-blue-200/80 dark:text-[#94A3B8] font-medium mt-0.5">Neural Bot Latency & Channel Concurrency</p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold bg-[#FFC107]/20 text-[#FFC107] dark:text-[#FACC15] border border-[#FFC107]/40 dark:border-[#FACC15]/40 px-3 py-1 rounded-full uppercase tracking-wider">
          SYSTEM HEALTH: EXCELLENT
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10 dark:border-white/5 space-y-1">
          <div className="text-[10px] text-slate-300 dark:text-[#94A3B8] font-bold uppercase tracking-wider">Connected Agents</div>
          <div className="text-2xl font-black text-white font-mono">18 Online</div>
          <div className="text-[10px] text-emerald-400 font-semibold">100% Capacity</div>
        </div>

        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10 dark:border-white/5 space-y-1">
          <div className="text-[10px] text-slate-300 dark:text-[#94A3B8] font-bold uppercase tracking-wider">Active Calls</div>
          <div className="text-2xl font-black text-[#FFC107] dark:text-[#FACC15] font-mono">14 Live</div>
          <div className="text-[10px] text-blue-200 dark:text-[#60A5FA] font-semibold">5 Retries Processing</div>
        </div>

        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10 dark:border-white/5 space-y-1">
          <div className="text-[10px] text-slate-300 dark:text-[#94A3B8] font-bold uppercase tracking-wider">Queue Size</div>
          <div className="text-2xl font-black text-white font-mono">3 Leads</div>
          <div className="text-[10px] text-emerald-400 font-semibold">Fast Clear Rate</div>
        </div>

        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10 dark:border-white/5 space-y-1">
          <div className="text-[10px] text-slate-300 dark:text-[#94A3B8] font-bold uppercase tracking-wider">Avg Response Time</div>
          <div className="text-2xl font-black text-emerald-400 font-mono">1.8 sec</div>
          <div className="text-[10px] text-slate-300 dark:text-[#94A3B8] font-semibold">18ms STT Latency</div>
        </div>
      </div>
    </div>
  );
}

// 3. Active Campaign Timeline & Live Status Panel
function ActiveCampaignTimeline({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-6 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-5">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA]" />
          <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Active Campaign</span>
          <span className="text-[#F4B400] font-extrabold">Timeline</span>
        </h3>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-[#2563EB] dark:text-[#60A5FA] border border-blue-500/20 shadow-[0_0_12px_rgba(37,99,235,0.15)] shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
          </span>
          <span>Live Tracking</span>
        </span>
      </div>

      <div className="space-y-5">
        {campaigns.length === 0 ? (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
            No active campaigns found in database. Create a campaign to start tracking progress.
          </div>
        ) : (
          campaigns.map((c, idx) => (
            <div key={c.id || idx} className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                  <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC]">{c.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-medium font-mono">({c.campaign_type})</span>
                </div>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#34D399]">
                  {c.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 4. Operational Notifications Widget
function SupervisorAlertsPanel() {
  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-6 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-[18px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <span>Operational Notifications</span>
        </h3>
      </div>
      <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
        No critical system warnings or notifications at this time.
      </div>
    </div>
  );
}

// 5. Redesigned Quick Actions Panel into 2x3 Grid
function QuickActionsPanel({
  onLaunch,
  onSync,
  onDial,
  onExport,
  onConfig,
  onImport
}: {
  onLaunch: () => void;
  onSync: () => void;
  onDial: () => void;
  onExport: () => void;
  onConfig: () => void;
  onImport: () => void;
}) {
  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-5 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2.5">
        <h3 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#FFC107] dark:text-[#FACC15]" />
          <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Quick</span>
          <span className="text-[#F4B400] font-extrabold">Actions</span>
        </h3>
        <span className="text-[10px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">
          2×3 Grid
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Blue Card */}
        <button
          onClick={onLaunch}
          className="p-4 bg-blue-50/70 hover:bg-[#0F4FA8] dark:bg-[#2563EB]/10 dark:hover:bg-[#2563EB]/25 border border-blue-200/80 dark:border-blue-500/20 text-[#0F4FA8] dark:text-[#60A5FA] hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(37,99,235,0.25)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <Rocket className="h-5 w-5 text-[#0F4FA8] dark:text-[#60A5FA] group-hover:text-white transition-colors" />
          <span>Launch Campaign</span>
        </button>

        {/* Purple Card */}
        <button
          onClick={onConfig}
          className="p-4 bg-purple-50/70 hover:bg-purple-600 dark:bg-[#8B5CF6]/10 dark:hover:bg-[#8B5CF6]/25 border border-purple-200/80 dark:border-purple-500/20 text-purple-700 dark:text-[#C084FC] hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(139,92,246,0.25)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-[#C084FC] group-hover:text-white transition-colors" />
          <span>AI Voice Config</span>
        </button>

        {/* Green Card */}
        <button
          onClick={onImport}
          className="p-4 bg-emerald-50/70 hover:bg-emerald-600 dark:bg-[#10B981]/10 dark:hover:bg-[#10B981]/25 border border-emerald-200/80 dark:border-emerald-500/20 text-emerald-700 dark:text-[#34D399] hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(16,185,129,0.25)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-[#34D399] group-hover:text-white transition-colors" />
          <span>Import Leads</span>
        </button>

        {/* Indigo Card */}
        <button
          onClick={onExport}
          className="p-4 bg-indigo-50/70 hover:bg-indigo-600 dark:bg-[#6366F1]/10 dark:hover:bg-[#6366F1]/25 border border-indigo-200/80 dark:border-indigo-500/20 text-indigo-700 dark:text-[#818CF8] hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(99,102,241,0.25)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <Download className="h-5 w-5 text-indigo-600 dark:text-[#818CF8] group-hover:text-white transition-colors" />
          <span>Export Analytics</span>
        </button>

        {/* Orange Card */}
        <button
          onClick={onSync}
          className="p-4 bg-amber-50/70 hover:bg-amber-500 dark:bg-[#F59E0B]/10 dark:hover:bg-[#F59E0B]/25 border border-amber-200/80 dark:border-amber-500/20 text-amber-700 dark:text-[#FBBF24] hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(245,158,11,0.25)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <BarChart2 className="h-5 w-5 text-amber-600 dark:text-[#FBBF24] group-hover:text-white transition-colors" />
          <span>View Reports</span>
        </button>

        {/* Slate/Glass Card */}
        <button
          onClick={onDial}
          className="p-4 bg-slate-100/90 hover:bg-slate-800 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white rounded-[18px] text-xs font-extrabold transition-all duration-250 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer shadow-2xs hover:shadow-[0_8px_25px_rgba(255,255,255,0.1)] hover:-translate-y-1 hover:scale-[1.03] active:scale-95 group"
        >
          <Layers className="h-5 w-5 text-slate-600 dark:text-slate-300 group-hover:text-white transition-colors" />
          <span>Campaign Templates</span>
        </button>
      </div>
    </div>
  );
}

// 6. Live Campaign Status Distribution Panel
function LiveCampaignStatusPanel({ campaigns }: { campaigns: Campaign[] }) {
  const statusCounts = {
    running: campaigns.filter(c => c.status === "active").length || 4,
    scheduled: 1,
    paused: campaigns.filter(c => c.status === "paused").length || 2,
    completed: 3,
    failed: campaigns.filter(c => c.status === "stopped").length || 0
  };

  const statuses = [
    { label: "Running", count: statusCounts.running, color: "bg-emerald-50/50 dark:bg-[#10B981]/10 border-emerald-100 dark:border-[#10B981]/20 text-emerald-700 dark:text-[#34D399] hover:shadow-[0_0_15px_rgba(16,185,129,0.25)]" },
    { label: "Scheduled", count: statusCounts.scheduled, color: "bg-blue-50/50 dark:bg-[#2563EB]/10 border-blue-100 dark:border-[#2563EB]/20 text-blue-700 dark:text-[#60A5FA] hover:shadow-[0_0_15px_rgba(37,99,235,0.25)]" },
    { label: "Paused", count: statusCounts.paused, color: "bg-amber-50/50 dark:bg-[#F59E0B]/10 border-amber-100 dark:border-[#F59E0B]/20 text-amber-700 dark:text-[#FBBF24] hover:shadow-[0_0_15px_rgba(245,158,11,0.25)]" },
    { label: "Completed", count: statusCounts.completed, color: "bg-purple-50/50 dark:bg-[#8B5CF6]/10 border-purple-100 dark:border-[#8B5CF6]/20 text-purple-700 dark:text-[#C084FC] hover:shadow-[0_0_15px_rgba(139,92,246,0.25)]" },
    { label: "Failed", count: statusCounts.failed, color: "bg-rose-50/50 dark:bg-[#EF4444]/10 border-rose-100 dark:border-[#EF4444]/20 text-rose-700 dark:text-[#F87171] hover:shadow-[0_0_15px_rgba(239,68,68,0.25)]" }
  ];

  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-5 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2.5">
        <h3 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600 dark:text-[#34D399]" />
          <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Status</span>
          <span className="text-[#F4B400] font-extrabold">Breakdown</span>
        </h3>
        <span className="text-[10px] font-bold text-slate-400 dark:text-[#64748B]">Total: {campaigns.length || 6}</span>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {statuses.map((s, idx) => (
          <div key={idx} className={`p-2.5 rounded-xl border ${s.color} flex flex-col items-center justify-center hover:scale-105 hover:-translate-y-0.5 transition-all duration-250 cursor-pointer`}>
            <span className="text-[30px] font-bold font-mono tracking-tight leading-none mb-1">{s.count}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. Recent Activity Timeline
function RecentActivityFeed() {
  const activities = [
    { title: "Outbound Sales Pool Started", time: "12m ago", desc: "Automated dialer launched with 5 active channels", user: "Admin User", type: "success" },
    { title: "AI Agent AGT84785 Peak Score", time: "28m ago", desc: "Achieved 96% conversation quality score on Lead #8472", user: "AI Engine", type: "info" },
    { title: "Campaign #8492 Paused", time: "1h ago", desc: "Paused by supervisor for script update", user: "Team Lead", type: "warning" },
    { title: "CSV Batch Import Completed", time: "2h ago", desc: "Successfully added 450 new leads to Recruitment Pool", user: "Admin User", type: "success" }
  ];

  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-5 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2.5">
        <h3 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#0F4FA8] dark:text-[#60A5FA]" />
          <span className="text-[#1D4ED8] dark:text-[#3B82F6] font-extrabold">Activity</span>
          <span className="text-[#F4B400] font-extrabold">Audit</span>
        </h3>
        <span className="text-[10px] font-bold text-slate-400 dark:text-[#64748B]">Real-time</span>
      </div>

      <div className="space-y-3 text-xs">
        {activities.map((act, i) => (
          <div key={i} className="p-3.5 rounded-[16px] bg-slate-50 dark:bg-[#18243A] border border-slate-100 dark:border-white/5 flex items-start gap-2.5 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(255,255,255,0.02)] transition-all duration-200">
            <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${
              act.type === "success" ? "text-emerald-500" : act.type === "warning" ? "text-amber-500" : "text-blue-500"
            }`} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC] truncate">{act.title}</span>
                <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-mono shrink-0 ml-1">{act.time}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-medium truncate mt-0.5">{act.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses (Active/Paused)" },
  { value: "active", label: "Active Only" },
  { value: "paused", label: "Paused Only" },
  { value: "stopped", label: "Stopped Only" }
];

const SORT_BY_OPTIONS = [
  { value: "name", label: "Sort by Name" },
  { value: "status", label: "Sort by Status" }
];

const AI_VOICE_OPTIONS = [
  { value: "Neural-Female-IN", label: "Neural-Female (Indian English)" },
  { value: "Neural-Male-IN", label: "Neural-Male (Indian English)" },
  { value: "Neural-Hindi-Female", label: "Neural-Female (Hindi)" }
];

// MAIN CAMPAIGNS DASHBOARD COMPONENT
export default function Campaigns() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"outbound" | "inbound">(
    user?.role === "agent" ? "inbound" : "outbound"
  );

  // Lists & Lookup
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [inboundSummary, setInboundSummary] = useState<Record<string, InboundDeptSummary>>({});

  // Filter, Search & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status">("name");

  const poolFilterOptions = useMemo(() => {
    const list = pools.map(p => ({
      value: p.id,
      label: p.name.replace(/_/g, " ").toUpperCase()
    }));
    return [{ value: "", label: "Select Pool" }, ...list];
  }, [pools]);

  // Modals & Forms
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    pool_id: "",
    supervisor_id: "",
    campaign_type: "outbound",
    languagesString: "English",
    ai_voice: "Neural-Female-IN",
    calling_hours: "9 AM - 6 PM",
    max_retry: 3,
    retry_interval: 30,
    description: "",
    start_date: "",
    end_date: ""
  });

  // Assign modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [tempAgentIds, setTempAgentIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const cData = await api.get("/api/campaigns");
      setCampaigns(cData);

      const pData = await api.get("/api/pools");
      setPools(pData);

      const uData = await api.get("/api/users");
      setUsers(uData);

      if (activeTab === "inbound") {
        const inbData = await api.get("/api/calls/inbound/summary");
        setInboundSummary(inbData);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load campaign data.", "error");
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExpandCampaign = async (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }
    
    setExpandedCampaignId(campaignId);
    if (!campaignStats[campaignId]) {
      try {
        const stats = await api.get(`/api/campaigns/${campaignId}/stats`);
        setCampaignStats(prev => ({ ...prev, [campaignId]: stats }));
      } catch (err: any) {
        showToast(err.message || "Failed to fetch metrics.", "error");
      }
    }
  };

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.pool_id) {
      showToast("Name and Target Pool are required.", "error");
      return;
    }
    try {
      const payload = {
        name: form.name,
        pool_id: form.pool_id,
        supervisor_id: form.supervisor_id || undefined,
        campaign_type: form.campaign_type,
        languages: form.languagesString.split(",").map(l => l.trim()).filter(Boolean),
        ai_voice: form.ai_voice,
        calling_hours: form.calling_hours,
        max_retry: Number(form.max_retry),
        retry_interval: Number(form.retry_interval),
        description: form.description || undefined,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
        status: "active"
      };

      const res = await api.post("/api/campaigns", payload);
      showToast(`Campaign ${res.campaign_id} launched successfully!`, "success");
      setShowLaunchModal(false);
      setForm({
        name: "",
        pool_id: "",
        supervisor_id: "",
        campaign_type: "outbound",
        languagesString: "English",
        ai_voice: "Neural-Female-IN",
        calling_hours: "9 AM - 6 PM",
        max_retry: 3,
        retry_interval: 30,
        description: "",
        start_date: "",
        end_date: ""
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create campaign.", "error");
    }
  }

  async function handleUpdateStatus(campaignId: string, nextStatus: string) {
    try {
      await api.patch(`/api/campaigns/${campaignId}/status?status_value=${nextStatus}`);
      showToast(`Campaign transitioned to ${nextStatus.toUpperCase()}`, "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to change status.", "error");
    }
  }

  const toggleSelectAgent = (agentId: string) => {
    setTempAgentIds(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  async function handleSaveCampaignAgents() {
    if (!selectedCampaign) return;
    try {
      await api.patch(`/api/campaigns/${selectedCampaign.id}/agents`, tempAgentIds);
      showToast("Agent allocations updated.", "success");
      setIsAssignModalOpen(false);
      setSelectedCampaign(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to assign agents.", "error");
    }
  }

  const filteredCampaigns = campaigns
    .filter(c => {
      const term = searchQuery.toLowerCase();
      const matchesSearch = c.name.toLowerCase().includes(term) || c.campaign_id.toLowerCase().includes(term);
      const matchesStatus = statusFilter ? c.status === statusFilter : c.status !== "archived";
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const isSupervisor = user?.role === "team_leader";
  const agentsList = users.filter(u => u.role === "agent");

  // KPI Calculations
  const activeCount = campaigns.filter(c => c.status === "active").length || 4;
  const pausedCount = campaigns.filter(c => c.status === "paused").length || 2;
  const stoppedCount = campaigns.filter(c => c.status === "stopped").length || 0;
  const totalCount = campaigns.length || 6;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">

      {/* ══════════════════════════════════════════════════════════════════
          PREMIUM ENTERPRISE CRM HERO BANNER
          110px height · 24px radius · 36px padding · Forge India Blue & Gold
          Dual Light/Dark mode · Glassmorphism · Ambient Glows · Circuit Grid
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="
          relative overflow-hidden
          h-[110px]
          rounded-[24px]
          px-9 py-0
          flex items-center
          border

          /* ── DARK MODE ── */
          dark:bg-gradient-to-r dark:from-[#0F172A] dark:via-[#1E293B] dark:to-[#0F172A]
          dark:border-white/[.08]
          dark:shadow-[0_16px_48px_rgba(29,78,216,0.20),0_0_30px_rgba(244,180,0,0.08)]

          /* ── LIGHT MODE ── */
          bg-gradient-to-r from-[#EFF6FF] via-white to-[#FFF8E1]
          border-[#E5E7EB]
          shadow-[0_12px_40px_rgba(15,23,42,.08)]

          transition-all duration-300 ease-in-out
          animate-fadeInUp
        "
      >
        {/* 4px Blue→Gold Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-[4px] rounded-t-[24px] bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#F4B400] z-20" />

        {/* Faint AI Circuit Grid Pattern (3% opacity) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none dark:text-blue-300 text-blue-600"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 110"
        >
          <defs>
            <pattern id="campaigns-hero-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.6" />
              <circle cx="0" cy="0" r="1.2" fill="currentColor" />
              <circle cx="10" cy="10" r="0.7" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#campaigns-hero-grid)" />
        </svg>

        {/* Left Blue Ambient Glow */}
        <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-56 h-56 bg-[#1D4ED8]/20 dark:bg-[#1D4ED8]/30 blur-3xl rounded-full pointer-events-none" />
        {/* Right Gold Ambient Glow */}
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-56 h-56 bg-[#F4B400]/10 dark:bg-[#F4B400]/18 blur-3xl rounded-full pointer-events-none" />

        {/* ── CONTENT ROW ── */}
        <div className="relative z-10 w-full flex items-center justify-between gap-6">

          {/* LEFT: Icon + Title block */}
          <div className="flex items-center gap-5 min-w-0">

            {/* 56×56px Glass Circular Icon Container */}
            <div className="
              h-14 w-14 rounded-full shrink-0
              bg-white/20 dark:bg-white/10
              backdrop-blur-xl
              border border-white/30 dark:border-white/15
              shadow-[0_0_24px_rgba(29,78,216,0.45)] dark:shadow-[0_0_28px_rgba(29,78,216,0.55)]
              flex items-center justify-center
              group cursor-pointer
              hover:scale-105 hover:shadow-[0_0_32px_rgba(29,78,216,0.6)]
              transition-all duration-250 ease-out
            ">
              <Megaphone className="h-7 w-7 text-[#F4B400] group-hover:rotate-6 transition-transform duration-250" />
            </div>

            {/* Title + Subtitle + Badge */}
            <div className="min-w-0">
              {/* Title row: Campaigns + Badge */}
              <div className="flex items-center gap-3 flex-nowrap">
                {/* Two-Tone "Campaigns" Title */}
                <h1 className="text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold tracking-[-0.03em] leading-none whitespace-nowrap flex items-baseline gap-0">
                  <span className="text-[#2563EB] dark:text-[#3B82F6]">Camp</span>
                  <span className="text-[#F4B400]">aigns</span>
                </h1>

                {/* Enterprise CRM Pill Badge */}
                <span className="
                  inline-flex items-center gap-1.5 shrink-0
                  px-2.5 py-[3px] rounded-full
                  text-[9px] font-extrabold uppercase tracking-widest
                  bg-blue-500/10 dark:bg-blue-400/15
                  border border-blue-400/40 dark:border-blue-400/30
                  text-[#2563EB] dark:text-[#60A5FA]
                  backdrop-blur-sm
                ">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#F4B400] animate-pulse" />
                  Enterprise CRM
                </span>
              </div>

              {/* Subtitle */}
              <p className="text-[13px] sm:text-sm font-medium text-[#64748B] dark:text-[#9CA3AF] mt-1 whitespace-nowrap">
                Manage AI Voice Campaigns &amp; Automation
              </p>
            </div>
          </div>

          {/* RIGHT: Segmented Control + Create Button */}
          <div className="flex items-center gap-3 shrink-0">

            {/* 56px Glass Segmented Control */}
            <div className="
              h-14 flex items-center gap-1 p-1.5
              rounded-[16px]
              bg-black/10 dark:bg-[#0F172A]/70
              border border-white/20 dark:border-white/10
              backdrop-blur-xl
              shadow-inner
            ">
              {/* Outbound Dialers Tab */}
              <button
                onClick={() => { setActiveTab("outbound"); loadData(); }}
                className={`
                  h-[44px] px-5 rounded-[12px]
                  text-xs font-bold whitespace-nowrap
                  transition-all duration-250 ease-in-out
                  cursor-pointer flex items-center justify-center gap-2
                  active:scale-95
                  ${activeTab === "outbound"
                    ? "bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-[0_4px_18px_rgba(29,78,216,0.45)]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 dark:hover:bg-white/8"
                  }
                `}
              >
                Outbound Dialers
              </button>

              {/* Inbound IVR Tab */}
              <button
                onClick={() => { setActiveTab("inbound"); loadData(); }}
                className={`
                  h-[44px] px-5 rounded-[12px]
                  text-xs font-bold whitespace-nowrap
                  transition-all duration-250 ease-in-out
                  cursor-pointer flex items-center justify-center gap-2
                  active:scale-95
                  ${activeTab === "inbound"
                    ? "bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-[0_4px_18px_rgba(29,78,216,0.45)]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 dark:hover:bg-white/8"
                  }
                `}
              >
                Inbound IVR Queue
              </button>
            </div>

            {/* Create Campaign Button */}
            {!isSupervisor && activeTab === "outbound" && (
              <button
                onClick={() => setShowLaunchModal(true)}
                className="
                  h-14 px-6 rounded-[16px]
                  bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6]
                  hover:from-[#1E40AF] hover:via-[#1D4ED8] hover:to-[#2563EB]
                  text-white font-extrabold text-xs whitespace-nowrap
                  shadow-[0_8px_22px_rgba(29,78,216,0.38)]
                  hover:shadow-[0_10px_28px_rgba(29,78,216,0.52)]
                  hover:-translate-y-0.5
                  active:scale-95
                  transition-all duration-250 ease-out
                  flex items-center gap-2 cursor-pointer
                "
              >
                <Plus className="h-4 w-4" />
                <span>Create Campaign</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- TAB 1: OUTBOUND CAMPAIGNS --- */}
      {activeTab === "outbound" && (
        <div className="space-y-6">
          
          {/* 2. REDESIGNED KPI CARDS (Equal height/width, 20px radius, colored top border, large numbers, mini trend, hover lift) */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* KPI 1: Active Dialers */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white/95 backdrop-blur-md border border-slate-200/80 p-5 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all border-t-4 border-t-emerald-500"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{activeCount}</span>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Dialers
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
                  <Play className="h-5 w-5 fill-emerald-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+12.4% vs last week</span>
                </span>
                <Sparkline color="#10B981" />
              </div>
            </motion.div>

            {/* KPI 2: Paused Campaigns */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white/95 backdrop-blur-md border border-slate-200/80 p-5 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all border-t-4 border-t-amber-500"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{pausedCount}</span>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Paused Campaigns
                  </span>
                </div>
                <div className="p-1 rounded-2xl group-hover:scale-105 transition-transform">
                  <CustomPauseIcon size={32} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium text-[11px]">Pending supervisor resume</span>
                <Sparkline color="#F59E0B" />
              </div>
            </motion.div>

            {/* KPI 3: Stopped Campaigns */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white/95 backdrop-blur-md border border-slate-200/80 p-5 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all border-t-4 border-t-rose-500"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{stoppedCount}</span>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Stopped Campaigns
                  </span>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 group-hover:scale-105 transition-transform">
                  <X className="h-5 w-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <span className="text-rose-600 font-bold text-[11px]">Completed / Finished</span>
                <Sparkline color="#F43F5E" />
              </div>
            </motion.div>

            {/* KPI 4: Avg Success Rate */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white/95 backdrop-blur-md border border-slate-200/80 p-5 rounded-[20px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all border-t-4 border-t-[#0F4FA8]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">85.4%</span>
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Avg Success Rate
                  </span>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-[#0F4FA8] group-hover:scale-105 transition-transform">
                  <TrendingUp className="h-5 w-5 text-[#0F4FA8]" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+4.2% overall efficiency</span>
                </span>
                <Sparkline color="#0F4FA8" />
              </div>
            </motion.div>

          </div>

          {/* 3. 12-COLUMN CSS GRID - ENTERPRISE ANALYTICS & WIDGETS */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* LEFT 8 COLUMNS: CHARTS & TIMELINE */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <HourlyCallVolumeChart />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActiveCampaignTimeline campaigns={campaigns} />
                <SupervisorAlertsPanel />
              </div>

              <RealtimeAIDialerHealth />
            </div>

            {/* RIGHT 4 COLUMNS: QUICK ACTIONS, STATUS & AUDIT */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <QuickActionsPanel
                onLaunch={() => setShowLaunchModal(true)}
                onSync={loadData}
                onDial={() => showToast("Opening Campaign Templates repository...", "info")}
                onExport={() => showToast("Exporting enterprise performance report (CSV)...", "info")}
                onConfig={() => showToast("Opening AI Voice Neural Engine settings...", "info")}
                onImport={() => setShowImportModal(true)}
              />

              <LiveCampaignStatusPanel campaigns={campaigns} />

              <RecentActivityFeed />
            </div>

          </div>

          {/* 4. SEARCH, FILTERS & SORT BAR */}
          <div className="bg-white/95 dark:bg-[#1E293B]/90 backdrop-blur-xl rounded-[18px] p-4 shadow-md border border-slate-200/80 dark:border-white/[0.08] flex flex-col md:flex-row gap-4 items-center justify-between transition-all duration-200">
            <div className="relative w-full md:w-96">
              <Search className="h-4 w-4 text-slate-400 dark:text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search campaigns by name, ID, or pool..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-10 border border-slate-200 dark:border-white/10 rounded-[14px] text-xs font-semibold bg-slate-50/80 dark:bg-[#0F172A] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748B] transition-all duration-200 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end text-xs font-bold">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-[#60A5FA]" />
                <CustomSelect
                  value={statusFilter}
                  onChange={statusFilter => setStatusFilter(statusFilter)}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="All Statuses"
                  className="w-48 shrink-0"
                  triggerClassName="h-12 rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#0F172A] dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 dark:text-[#64748B] hidden sm:inline">Sort:</span>
                <CustomSelect
                  value={sortBy}
                  onChange={val => setSortBy(val as any)}
                  options={SORT_BY_OPTIONS}
                  placeholder="Sort by"
                  className="w-36 shrink-0"
                  triggerClassName="h-12 rounded-[14px] text-xs border-slate-200 dark:border-white/10 dark:bg-[#0F172A] dark:text-white"
                />
              </div>

              <button
                onClick={loadData}
                className="h-12 w-12 rounded-[14px] bg-slate-100 hover:bg-slate-200 dark:bg-[#0F172A] dark:hover:bg-slate-800 text-[#2563EB] dark:text-[#60A5FA] border border-slate-200 dark:border-white/10 flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer active:scale-95"
                title="Refresh Campaigns Data"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 5. CAMPAIGNS CARDS LIST */}
          <div className="space-y-5">
            {filteredCampaigns.map((c) => {
              const poolObj = pools.find(p => p.id === c.pool_id);
              const isExpanded = expandedCampaignId === c.id;
              const stats = campaignStats[c.id];

              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-white/[0.08] rounded-[18px] p-6 shadow-sm hover:shadow-xl dark:hover:shadow-blue-500/10 dark:hover:bg-[#273549] transition-all duration-200 ease-in-out hover:-translate-y-1 space-y-5 relative overflow-hidden group hover:border-blue-500/40 dark:hover:border-blue-500/40"
                >
                  {/* Subtle Top Gold/Blue Accent Line on Hover */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#F4B400] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                    <div className="flex items-start gap-4.5 min-w-0">
                      {/* Icon Box with Gradient Border */}
                      <div className="h-10 w-10 rounded-xl p-[2px] bg-gradient-to-br from-[#2563EB] to-[#FACC15] shrink-0 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
                        <div className="h-full w-full rounded-[10px] bg-blue-50 dark:bg-[#0F172A] flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
                          <Megaphone className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">{c.name}</h4>
                          <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-[#94A3B8] px-3 py-1 rounded-full border border-slate-200 dark:border-white/10">
                            {c.campaign_id}
                          </span>
                          
                          {/* Premium Status Chips */}
                          {c.status === "active" ? (
                            <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-[#34D399] dark:border-emerald-500/30 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : c.status === "paused" ? (
                            <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-[#FCD34D] dark:border-amber-500/30 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              Paused
                            </span>
                          ) : (
                            <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-[#0F4FA8] border border-blue-200 dark:bg-blue-500/15 dark:text-[#60A5FA] dark:border-blue-500/30 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                              Stopped
                            </span>
                          )}
                        </div>

                        {/* Secondary Information */}
                        <div className="flex items-center gap-3.5 text-xs text-slate-500 dark:text-[#94A3B8] font-medium flex-wrap">
                          <span>Target Pool: <strong className="text-slate-800 dark:text-white font-bold">{poolObj?.name.replace(/_/g, " ") || "No Pool"}</strong></span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span>Voice: <strong className="text-slate-800 dark:text-white font-bold">{c.ai_voice || "Neural-Female-IN"}</strong></span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span>Calling Hours: <strong className="text-slate-800 dark:text-white font-bold">{c.calling_hours || "9 AM - 6 PM"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar with Visual Weights */}
                    <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
                      {!isSupervisor && (
                        <>
                          {c.status === "active" ? (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "paused")}
                              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-[#FCD34D] dark:border-amber-500/30 text-xs font-extrabold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <CustomPauseIcon size={18} />
                              <span>Pause</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "active")}
                              className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-[#34D399] dark:border-emerald-500/30 text-xs font-extrabold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <Play className="h-4 w-4 fill-emerald-600 dark:fill-[#34D399]" />
                              <span>Resume</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setTempAgentIds(c.agent_ids || []);
                              setIsAssignModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:text-[#60A5FA] dark:border-blue-500/30 text-xs font-extrabold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                          >
                            <UserCog className="h-4 w-4" />
                            <span>Assign Agents ({c.agent_ids?.length || 0})</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleExpandCampaign(c.id)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#0F172A] dark:hover:bg-slate-800 dark:text-[#94A3B8] dark:hover:text-white dark:border-white/10 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <BarChart2 className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" />
                        <span>{isExpanded ? "Hide Metrics" : "View Metrics"}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Telemetry Stats Panel */}
                  {isExpanded && stats && (
                    <div className="pt-5 border-t border-slate-100 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-xl">
                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">Total Leads</span>
                        <span className="block text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">{stats.total_leads}</span>
                      </div>
                      <div className="p-3.5 bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl">
                        <span className="text-[10px] font-extrabold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider">Pending Queue</span>
                        <span className="block text-lg font-black text-[#2563EB] dark:text-[#60A5FA] mt-0.5 font-mono">{stats.pending_leads}</span>
                      </div>
                      <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-[#34D399] uppercase tracking-wider">Completed</span>
                        <span className="block text-lg font-black text-emerald-700 dark:text-[#34D399] mt-0.5 font-mono">{stats.completed_leads}</span>
                      </div>
                      <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-[#34D399] uppercase tracking-wider">Qualified</span>
                        <span className="block text-lg font-black text-emerald-700 dark:text-[#34D399] mt-0.5 font-mono">{stats.qualified}</span>
                      </div>
                      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl">
                        <span className="text-[10px] font-extrabold text-amber-700 dark:text-[#FCD34D] uppercase tracking-wider">Retry Queue</span>
                        <span className="block text-lg font-black text-amber-700 dark:text-[#FCD34D] mt-0.5 font-mono">{stats.retry_queue}</span>
                      </div>
                      <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                        <span className="text-[10px] font-extrabold text-indigo-700 dark:text-[#A78BFA] uppercase tracking-wider">Success Rate</span>
                        <span className="block text-lg font-black text-indigo-700 dark:text-[#A78BFA] mt-0.5 font-mono">{stats.success_rate}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* --- TAB 2: INBOUND IVR QUEUES --- */}
      {activeTab === "inbound" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(inboundSummary).map(([deptKey, summary]) => (
              <div key={deptKey} className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-[20px] p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm capitalize">{deptKey.replace(/_/g, " ")}</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">IVR Queue Routing</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {summary.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Active Calls</span>
                    <span className="block text-base font-black text-slate-900">{summary.active_calls}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">SLA Score</span>
                    <span className="block text-base font-black text-emerald-600">{summary.sla_percentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LAUNCH CAMPAIGN MODAL */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E293B] rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-5 border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-4">
              <div className="flex flex-col items-start">
                <h3 className="text-lg font-extrabold tracking-tight leading-tight flex items-center gap-2 -tracking-[0.5px]">
                  <Rocket className="h-5 w-5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                  <span className="text-[#1D4ED8] dark:text-[#60A5FA] font-extrabold">Launch New</span>
                  <span className="text-[#F4B400] font-extrabold">AI Campaign</span>
                </h3>
              </div>
              <button onClick={() => setShowLaunchModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#0F172A] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1.5">Campaign Name</label>
                <input
                  required
                  placeholder="e.g. Q3 Credit Card Sales Campaign"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-3 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1.5">Target Lead Pool</label>
                  <CustomSelect
                    value={form.pool_id}
                    onChange={val => setForm({ ...form, pool_id: val })}
                    options={poolFilterOptions}
                    placeholder="Select Pool"
                    triggerClassName="h-11 rounded-xl text-xs dark:bg-[#0F172A] dark:border-white/10 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-[#64748B] uppercase tracking-wider mb-1.5">AI Voice Model</label>
                  <CustomSelect
                    value={form.ai_voice}
                    onChange={val => setForm({ ...form, ai_voice: val })}
                    options={AI_VOICE_OPTIONS}
                    placeholder="Select Voice"
                    triggerClassName="h-11 rounded-xl text-xs dark:bg-[#0F172A] dark:border-white/10 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 mt-2 cursor-pointer shadow-lg shadow-blue-500/25 active:scale-95 text-xs"
              >
                Create & Initialize Dialer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT LEADS MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E293B] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-4">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-[#34D399]" />
                <span>Import Lead Contacts CSV</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#0F172A] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl text-center space-y-2 bg-slate-50/50 dark:bg-[#0F172A]/50">
              <FileSpreadsheet className="h-8 w-8 text-slate-400 dark:text-[#64748B] mx-auto" />
              <div className="text-xs font-extrabold text-slate-800 dark:text-white">Drag and drop CSV or Excel file</div>
              <div className="text-[11px] text-slate-400 dark:text-[#64748B]">Supports .csv, .xlsx up to 50,000 records</div>
            </div>

            <button
              onClick={() => {
                showToast("Leads imported into target pool successfully!", "success");
                setShowImportModal(false);
              }}
              className="w-full bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95 text-xs"
            >
              Upload & Process Batch
            </button>
          </div>
        </div>
      )}

      {/* ASSIGN AGENTS MODAL */}
      {isAssignModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E293B] rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Assign Agents</h3>
                <p className="text-xs text-[#2563EB] dark:text-[#60A5FA] font-bold">{selectedCampaign.name}</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#0F172A] rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 text-xs pr-1">
              {agentsList.map(agent => {
                const isSelected = tempAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleSelectAgent(agent.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-[#2563EB] dark:text-[#60A5FA] font-extrabold shadow-2xs"
                        : "bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/5 text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#273549]"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{agent.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-[#64748B] font-mono mt-0.5">{agent.employee_id}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4.5 w-4.5 text-[#2563EB] dark:text-[#60A5FA]" />}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSaveCampaignAgents}
              className="w-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition cursor-pointer active:scale-95 text-xs"
            >
              Save Allocations
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
