import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
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

      {/* Render Toast Portal at top document.body with ultra-high z-index (999999) */}
      {typeof document !== "undefined" && createPortal(
        <div
          className="fixed top-6 right-6 z-[999999] flex flex-col gap-3 pointer-events-none max-w-md w-full font-sans"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const intervalTime = 40;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        return next > 0 ? next : 0;
      });
    }, intervalTime);

    const dismissTimeout = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(dismissTimeout);
    };
  }, [toast.duration, onClose]);

  const styles = {
    success: {
      bg: "bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/20",
      icon: <CheckCircle2 className="h-5 w-5 text-white shrink-0" />,
      progress: "bg-white/40"
    },
    error: {
      bg: "bg-rose-600 text-white border-rose-700 shadow-rose-600/20",
      icon: <AlertCircle className="h-5 w-5 text-white shrink-0" />,
      progress: "bg-white/40"
    },
    warning: {
      bg: "bg-amber-500 text-white border-amber-600 shadow-amber-500/20",
      icon: <AlertTriangle className="h-5 w-5 text-white shrink-0" />,
      progress: "bg-white/40"
    },
    info: {
      bg: "bg-[#0F4C9A] text-white border-blue-800 shadow-[#0F4C9A]/20",
      icon: <Info className="h-5 w-5 text-white shrink-0" />,
      progress: "bg-white/40"
    }
  }[toast.type || "success"];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-2xl p-4 shadow-2xl border transition-all duration-300 transform animate-in slide-in-from-right-full fade-in flex items-start gap-3.5 ${styles.bg}`}
    >
      {styles.icon}
      
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs font-semibold leading-relaxed tracking-tight break-words">
          {toast.message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/20 transition cursor-pointer shrink-0"
        title="Dismiss toast"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
        <div
          className={`h-full transition-all ease-linear ${styles.progress}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
