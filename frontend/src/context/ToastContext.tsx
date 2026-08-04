import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Info as InfoIcon, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success", duration: number = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    // Trigger standard browser desktop notification if permitted
    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
      try {
        new window.Notification("Forge CRM Alert", {
          body: message,
          icon: "/favicon.ico"
        });
      } catch (e) {
        // Ignore desktop notification errors
      }
    }
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Render Toast Portal at top-right document.body with ultra-high z-index */}
      {typeof document !== "undefined" && createPortal(
        <div
          className="fixed top-6 right-6 z-[999999] flex flex-col gap-3 pointer-events-none max-w-sm w-full font-sans"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="sync">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const config = {
    success: {
      title: "Success!",
      titleColor: "text-[#22C55E]",
      iconBg: "bg-[#22C55E]",
      progressBg: "bg-[#22C55E]",
      icon: <Check className="h-4 w-4 text-white stroke-[3]" />
    },
    error: {
      title: "Error!",
      titleColor: "text-[#EF4444]",
      iconBg: "bg-[#EF4444]",
      progressBg: "bg-[#EF4444]",
      icon: <X className="h-4 w-4 text-white stroke-[3]" />
    },
    warning: {
      title: "Warning!",
      titleColor: "text-[#F59E0B]",
      iconBg: "bg-[#F59E0B]",
      progressBg: "bg-[#F59E0B]",
      icon: <AlertTriangle className="h-4 w-4 text-white stroke-[2.5]" />
    },
    info: {
      title: "Info",
      titleColor: "text-[#3B82F6]",
      iconBg: "bg-[#3B82F6]",
      progressBg: "bg-[#3B82F6]",
      icon: <InfoIcon className="h-4 w-4 text-white stroke-[2.5]" />
    }
  }[toast.type || "success"];

  useEffect(() => {
    if (isPaused) return;

    const duration = toast.duration || 4000;
    const intervalTime = 30;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          onClose();
          return 0;
        }
        return next;
      });
    }, intervalTime);

    return () => {
      clearInterval(timer);
    };
  }, [toast.duration, onClose, isPaused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={onClose}
      className="pointer-events-auto relative overflow-hidden bg-white/95 backdrop-blur-xl border border-slate-100 rounded-[24px] p-4 shadow-xl shadow-slate-900/10 flex items-start gap-3.5 cursor-pointer select-none group hover:shadow-2xl transition-shadow"
    >
      {/* Circular SVG Icon Container */}
      <div className={`h-9 w-9 rounded-full ${config.iconBg} flex items-center justify-center shrink-0 shadow-sm mt-0.5`}>
        {config.icon}
      </div>

      {/* Content Section */}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className={`text-sm font-bold tracking-tight ${config.titleColor}`}>
          {toast.title || config.title}
        </h4>
        <p className="text-xs text-slate-600 font-normal leading-relaxed mt-0.5 break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition cursor-pointer shrink-0 -mr-1 -mt-1 active:scale-90"
        title="Dismiss notification"
      >
        <X className="h-4 w-4 stroke-[2]" />
      </button>

      {/* Thin Animated Auto-Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/70 overflow-hidden rounded-b-[24px]">
        <div
          className={`h-full transition-all ease-linear ${config.progressBg}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
