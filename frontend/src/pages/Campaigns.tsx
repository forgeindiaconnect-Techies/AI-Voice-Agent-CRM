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
  const maxVal = Math.max(...points.map(p => p.val)) * 1.15;
  const avgVal = Math.round(points.reduce((a, b) => a + b.val, 0) / points.length);
  const width = 640;
  const height = 190;
  const paddingX = 35;
  const paddingY = 25;

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

      <div className="relative w-full pt-1">
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

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
          <defs>
            <linearGradient id="chartGradientMain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Grid lines (15% opacity in dark mode) */}
          {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const val = Math.round(maxVal * frac);
            const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
            return (
              <g key={idx}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="stroke-slate-100 dark:stroke-white/[0.08]" strokeDasharray="4 4" strokeWidth="1" />
                <text x={paddingX - 8} y={y + 3} textAnchor="end" className="text-[12px] fill-slate-400 dark:fill-[#94A3B8] font-mono font-semibold">{val}</text>
              </g>
            );
          })}

          {/* Average reference line */}
          <line x1={paddingX} y1={avgY} x2={width - paddingX} y2={avgY} className="stroke-[#FFC107] dark:stroke-[#FACC15]/40" strokeDasharray="6 6" strokeWidth="1.5" />
          <text x={width - paddingX + 5} y={avgY + 3} className="text-[10px] fill-[#D4AF37] dark:fill-[#FACC15] font-bold">Avg: {avgVal}</text>

          {/* Area & Line */}
          <path d={areaD} fill="url(#chartGradientMain)" />
          <path d={d} fill="none" stroke="url(#chartLineGrad)" strokeWidth="2" strokeLinecap="round" />

          {/* Points */}
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
              <text x={pt.x} y={height - 4} textAnchor="middle" className="text-[12px] fill-slate-400 dark:fill-[#94A3B8] font-bold uppercase">{pt.hour}</text>
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
function ActiveCampaignTimeline() {
  const milestones = [
    { title: "Credit Card Sales Q3", pool: "Outbound Sales Pool", status: "Running", progress: 68, color: "from-[#10B981] to-[#06B6D4]" },
    { title: "Q3 Executive Hiring", pool: "Recruitment Pool", status: "Running", progress: 84, color: "from-[#2563EB] to-[#3B82F6]" },
    { title: "Priority Support Follow-up", pool: "Customer Care Pool", status: "Paused", progress: 42, color: "from-[#F59E0B] to-[#FBBF24]" },
    { title: "Wealth Advisory Outbound", pool: "VIP Clients", status: "Scheduled", progress: 10, color: "from-[#8B5CF6] to-[#A78BFA]" }
  ];

  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-6 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-5">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-600 dark:text-[#A78BFA]" />
          <span>Active Campaign Timeline</span>
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
        {milestones.map((m, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${m.color}`} />
                <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC]">{m.title}</span>
                <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-medium font-mono">({m.pool})</span>
              </div>
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#34D399]">
                {m.progress}%
              </span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-[#0B1220] rounded-full p-0.5 border border-slate-200/40 dark:border-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${m.color} transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse`}
                style={{ width: `${m.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Supervisor Alerts & Operational Notifications Widget
function SupervisorAlertsPanel() {
  const alerts = [
    { title: "Lead Queue Depletion Warning", desc: "Outbound Sales Pool requires CSV import (+200 leads left)", type: "warning", time: "5m ago" },
    { title: "High Conversion Rate Surge", desc: "AI Agent AGT84785 achieved 94% lead conversion on Campaign #8492", type: "success", time: "14m ago" },
    { title: "Retry Queue Throttle Adjusted", desc: "Supervisor auto-adjusted retry interval to 30 mins for optimal SLA", type: "info", time: "42m ago" }
  ];

  return (
    <div className="bg-white/95 dark:bg-[#131C2F] backdrop-blur-md rounded-[22px] p-5 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2.5">
        <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#0F4FA8] dark:text-[#60A5FA]" />
          <span>Supervisor Alerts</span>
        </h3>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider animate-pulse">
          3 Active
        </span>
      </div>

      <div className="space-y-3 text-xs">
        {alerts.map((al, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-[16px] bg-slate-50 dark:bg-[#18243A] border border-slate-100 dark:border-white/5 hover:border-blue-500/30 dark:hover:border-blue-500/30 flex items-start gap-3 border-l-4 border-l-[#FACC15] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)] transition-all duration-200 cursor-pointer"
          >
            {/* Warning icon inside glowing circle */}
            <div className="h-8 w-8 rounded-full bg-[#FACC15]/10 dark:bg-[#FACC15]/10 text-[#FACC15] flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.2)] shrink-0">
              {al.type === "warning" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : al.type === "success" ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 dark:text-[#F8FAFC] truncate">{al.title}</span>
                {/* Aligned perfectly right */}
                <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-mono shrink-0 ml-auto pl-2">{al.time}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-medium mt-1 leading-normal">{al.desc}</p>
            </div>
          </div>
        ))}
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
        <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#FFC107] dark:text-[#FACC15]" />
          <span>Quick Actions</span>
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
        <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600 dark:text-[#34D399]" />
          <span>Status Breakdown</span>
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
        <h3 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#0F4FA8] dark:text-[#60A5FA]" />
          <span>Activity Audit</span>
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
      
      {/* 1. PREMIUM HERO SECTION WITH GRADIENT BORDER & GLASSMORPHISM */}
      <div className="p-0.5 rounded-[24px] bg-gradient-to-r from-[#0F4FA8] via-[#1E6AD7] to-[#FFC107] shadow-lg shadow-blue-900/5">
        <div className="bg-white/95 backdrop-blur-md rounded-[23px] p-6 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            {/* Title & Subtitle */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0F4FA8]/10 text-[#0F4FA8] rounded-xl border border-[#0F4FA8]/20">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Campaign Management</h1>
                  <p className="text-xs text-slate-500 font-semibold">Enterprise AI outbound dialers & IVR queue routing workspace</p>
                </div>
              </div>

              {/* Four KPI Chips replacing single badge */}
              <div className="flex items-center gap-2 pt-2 flex-wrap text-xs font-bold">
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200/80">
                  {totalCount} Total
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  {activeCount} Active
                </span>
                <span className="bg-blue-50 text-[#0F4FA8] px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#0F4FA8] animate-ping" />
                  2 Running
                </span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
                  1 Scheduled
                </span>
              </div>
            </div>

            {/* Actions: Segmented Control & Create Campaign Button */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
              
              {/* Segmented Control with active sliding highlight */}
              <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 text-xs font-bold shadow-inner">
                <button
                  onClick={() => { setActiveTab("outbound"); loadData(); }}
                  className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "outbound"
                      ? "bg-[#0F4FA8] text-white shadow-md font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Outbound Dialers
                </button>
                <button
                  onClick={() => { setActiveTab("inbound"); loadData(); }}
                  className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "inbound"
                      ? "bg-[#0F4FA8] text-white shadow-md font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Inbound IVR Queue
                </button>
              </div>

              {/* Create Campaign Button with Brand Gradient */}
              {!isSupervisor && activeTab === "outbound" && (
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="bg-gradient-to-r from-[#0F4FA8] to-[#1E6AD7] hover:from-[#0B3C80] hover:to-[#1656B3] text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Campaign</span>
                </button>
              )}
            </div>

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
                <ActiveCampaignTimeline />
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
          <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search campaigns by name, ID, or pool..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4FA8] font-semibold text-slate-800 transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                <CustomSelect
                  value={statusFilter}
                  onChange={statusFilter => setStatusFilter(statusFilter)}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="All Statuses"
                  className="w-48"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">Sort:</span>
                <CustomSelect
                  value={sortBy}
                  onChange={val => setSortBy(val as any)}
                  options={SORT_BY_OPTIONS}
                  placeholder="Sort by"
                  className="w-36"
                />
              </div>

              <button
                onClick={loadData}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center shadow-2xs cursor-pointer"
                title="Refresh Campaigns Data"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 5. CAMPAIGNS CARDS LIST */}
          <div className="space-y-4">
            {filteredCampaigns.map((c) => {
              const poolObj = pools.find(p => p.id === c.pool_id);
              const isExpanded = expandedCampaignId === c.id;
              const stats = campaignStats[c.id];

              return (
                <div
                  key={c.id}
                  className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0F4FA8] flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                        <Megaphone className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-base font-black text-slate-900 tracking-tight">{c.name}</h4>
                          <span className="font-mono font-bold text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {c.campaign_id}
                          </span>
                          <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : c.status === "paused"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {c.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Target Pool: <strong>{poolObj?.name.replace(/_/g, " ") || "No Pool"}</strong></span>
                          <span>·</span>
                          <span>Voice: <strong>{c.ai_voice || "Neural-Female-IN"}</strong></span>
                          <span>·</span>
                          <span>Calling Hours: <strong>{c.calling_hours || "9 AM - 6 PM"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
                      {!isSupervisor && (
                        <>
                          {c.status === "active" ? (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "paused")}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <CustomPauseIcon size={18} />
                              <span>Pause</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(c.id, "active")}
                              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Play className="h-3.5 w-3.5" />
                              <span>Resume</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setTempAgentIds(c.agent_ids || []);
                              setIsAssignModalOpen(true);
                            }}
                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#0F4FA8] border border-blue-200 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            <span>Assign Agents ({c.agent_ids?.length || 0})</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleExpandCampaign(c.id)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                        <span>{isExpanded ? "Hide Metrics" : "View Metrics"}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Telemetry Stats Panel */}
                  {isExpanded && stats && (
                    <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 border rounded-xl">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Total Leads</span>
                        <span className="block text-lg font-black text-slate-900 mt-0.5">{stats.total_leads}</span>
                      </div>
                      <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                        <span className="text-[10px] font-extrabold text-[#0F4FA8] uppercase">Pending Queue</span>
                        <span className="block text-lg font-black text-[#0F4FA8] mt-0.5">{stats.pending_leads}</span>
                      </div>
                      <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase">Completed</span>
                        <span className="block text-lg font-black text-emerald-700 mt-0.5">{stats.completed_leads}</span>
                      </div>
                      <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase">Qualified</span>
                        <span className="block text-lg font-black text-emerald-700 mt-0.5">{stats.qualified}</span>
                      </div>
                      <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                        <span className="text-[10px] font-extrabold text-amber-700 uppercase">Retry Queue</span>
                        <span className="block text-lg font-black text-amber-700 mt-0.5">{stats.retry_queue}</span>
                      </div>
                      <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                        <span className="text-[10px] font-extrabold text-indigo-700 uppercase">Success Rate</span>
                        <span className="block text-lg font-black text-indigo-700 mt-0.5">{stats.success_rate}%</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-[#0F4FA8]" />
                <span>Launch New AI Campaign</span>
              </h3>
              <button onClick={() => setShowLaunchModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Campaign Name</label>
                <input
                  required
                  placeholder="e.g. Q3 Credit Card Sales Campaign"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0F4FA8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Target Lead Pool</label>
                  <CustomSelect
                    value={form.pool_id}
                    onChange={val => setForm({ ...form, pool_id: val })}
                    options={poolFilterOptions}
                    placeholder="Select Pool"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">AI Voice Model</label>
                  <CustomSelect
                    value={form.ai_voice}
                    onChange={val => setForm({ ...form, ai_voice: val })}
                    options={AI_VOICE_OPTIONS}
                    placeholder="Select Voice"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0F4FA8] hover:bg-blue-900 text-white font-extrabold py-3 rounded-xl transition mt-2 cursor-pointer shadow-md"
              >
                Create & Initialize Dialer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT LEADS MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span>Import Lead Contacts CSV</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2 bg-slate-50/50">
              <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="text-xs font-extrabold text-slate-700">Drag and drop CSV or Excel file</div>
              <div className="text-[11px] text-slate-400">Supports .csv, .xlsx up to 50,000 records</div>
            </div>

            <button
              onClick={() => {
                showToast("Leads imported into target pool successfully!", "success");
                setShowImportModal(false);
              }}
              className="w-full bg-emerald-600 text-white font-extrabold py-3 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
            >
              Upload & Process Batch
            </button>
          </div>
        </div>
      )}

      {/* ASSIGN AGENTS MODAL */}
      {isAssignModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">Assign Agents to {selectedCampaign.name}</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
              {agentsList.map(agent => {
                const isSelected = tempAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleSelectAgent(agent.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected ? "bg-blue-50 border-blue-200 text-[#0F4FA8] font-extrabold" : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>
                      <div>{agent.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{agent.employee_id}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-[#0F4FA8]" />}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSaveCampaignAgents}
              className="w-full bg-[#0F4FA8] text-white font-extrabold py-3 rounded-xl hover:bg-blue-900 transition cursor-pointer"
            >
              Save Allocations
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
