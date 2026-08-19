import { X, Filter, RotateCcw, Check, Search, Calendar, User, Phone, Sliders } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomSelect } from "./CustomSelect";

export interface LeadFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterUserId: string;
  setFilterUserId: (val: string) => void;
  filterPhone: string;
  setFilterPhone: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterSource: string;
  setFilterSource: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  filterAgent: string;
  setFilterAgent: (val: string) => void;
  onApply: () => void;
  onClearAll: () => void;
  activeFilterCount: number;
}

const STATUS_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "new", label: "New Leads" },
  { value: "pending", label: "Pending" },
  { value: "follow_up_required", label: "Follow Up Required" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "converted", label: "Converted / Won" },
  { value: "closed", label: "Closed" },
  { value: "dnc", label: "Do Not Call (DNC)" }
];

const SOURCE_OPTIONS = [
  { value: "All", label: "All Sources" },
  { value: "Manual", label: "Manual Input" },
  { value: "Website", label: "Website Form" },
  { value: "Inbound Call", label: "Inbound Call" },
  { value: "Campaign", label: "Outbound Campaign" },
  { value: "Facebook", label: "Facebook / Social" }
];

export default function LeadFilterModal({
  isOpen,
  onClose,
  filterUserId,
  setFilterUserId,
  filterPhone,
  setFilterPhone,
  filterStatus,
  setFilterStatus,
  filterSource,
  setFilterSource,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  filterAgent,
  setFilterAgent,
  onApply,
  onClearAll,
  activeFilterCount
}: LeadFilterModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#172033]/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  Advanced Lead Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {activeFilterCount} Active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Filter workspace leads by User ID, status, source, or dates
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Fields Body */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto softphone-scrollbar">
            {/* User ID Field (High Priority) */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                User ID / Lead ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter User ID (e.g. 8a9fbb828...)"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Matches exact or partial lead object IDs immediately.
              </p>
            </div>

            {/* Grid 2-cols: Phone & Assigned Agent */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search phone..."
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Agent
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Agent name or ID..."
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Grid 2-cols: Status & Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lead Status
                </label>
                <CustomSelect
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={STATUS_OPTIONS}
                  triggerClassName="h-9 rounded-xl text-xs dark:bg-[#172033] dark:text-white dark:border-white/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lead Source
                </label>
                <CustomSelect
                  value={filterSource}
                  onChange={setFilterSource}
                  options={SOURCE_OPTIONS}
                  triggerClassName="h-9 rounded-xl text-xs dark:bg-[#172033] dark:text-white dark:border-white/10"
                />
              </div>
            </div>

            {/* Date Range Selection */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-blue-500" /> Date Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">Start Date</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">End Date</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#172033]/50">
            <button
              onClick={() => {
                onClearAll();
              }}
              className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
