import { createContext, useContext, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: ToastType = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Trigger standard browser desktop notification if permitted
    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
      new window.Notification("Forge CRM Alert", {
        body: message,
        icon: "/favicon.ico"
      });
    }

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container floating on top right */}
      <div className="fixed top-5 right-5 z-50 space-y-3 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 transform translate-x-0 flex items-center justify-between gap-3 animate-slide-in ${
              t.type === "success"
                ? "bg-green-50/90 border-green-200 text-green-800"
                : t.type === "error"
                ? "bg-red-50/90 border-red-200 text-red-800"
                : "bg-blue-50/90 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
              </span>
              <p className="text-sm font-semibold">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className="text-gray-400 hover:text-gray-600 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
