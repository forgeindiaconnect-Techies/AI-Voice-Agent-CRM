/**
 * Dynamic API Base URL Resolver.
 * Connects directly to the production Render backend API (https://ai-voice-agent-crm.onrender.com).
 */
const RENDER_PROD_URL = "https://ai-voice-agent-crm.onrender.com";

let currentBaseUrl: string | null = null;

export const getBaseUrl = (): string => {
  // 1. User configured custom API URL in localStorage takes precedence
  if (typeof localStorage !== "undefined") {
    const savedUrl = localStorage.getItem("custom_api_url");
    if (savedUrl && savedUrl.trim() !== "") {
      return savedUrl.trim().replace(/\/+$/, "");
    }
  }

  // 2. Check environment variable VITE_API_URL if configured
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== "") {
    let url = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "");
    if (url.startsWith(":")) {
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      url = `${protocol}//${hostname}${url}`;
    }
    return url;
  }

  // 3. In Vite development mode on localhost, fallback to local backend if running
  const isViteDev = Boolean(import.meta.env.DEV);
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (isViteDev && isLocalHost) {
    return "http://localhost:8000";
  }

  // 4. Default Target: Production Render Backend
  return RENDER_PROD_URL;
};



export const setCustomApiUrl = (newUrl: string | null) => {
  if (typeof localStorage !== "undefined") {
    if (newUrl && newUrl.trim() !== "") {
      localStorage.setItem("custom_api_url", newUrl.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("custom_api_url");
    }
  }
  currentBaseUrl = null;
};

const BASE_URL = getBaseUrl();

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    // Buffer of 10 seconds before actual expiration
    return Date.now() >= payload.exp * 1000 - 10000;
  } catch {
    return true;
  }
}

function handleUnauthorizedCleanup() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("refresh_token");
  }
  if (unauthorizedHandler) {
    try {
      unauthorizedHandler();
    } catch (err) {
      console.warn("[AUTH] Error executing unauthorized handler:", err);
    }
  } else if (typeof window !== "undefined") {
    window.location.hash = "#/login";
  }
}

function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  if (isTokenExpired(token)) {
    console.warn("[AUTH] Stale/Expired access token detected in localStorage. Clearing.");
    handleUnauthorizedCleanup();
    return null;
  }
  return token;
}

export const getWsUrl = (roomPath: string = ""): string => {
  const token = getToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";
  let cleanPath = roomPath ? (roomPath.startsWith("/") ? roomPath : `/${roomPath}`) : "";
  while (cleanPath.startsWith("/ws/")) {
    cleanPath = cleanPath.substring(3);
  }
  if (cleanPath === "/ws") {
    cleanPath = "";
  }
  if (cleanPath && !cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }
  const baseUrl = getBaseUrl();

  try {
    const urlObj = new URL(baseUrl);
    const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${urlObj.host}/ws${cleanPath}${tokenQuery}`;
  } catch {
    return `wss://ai-voice-agent-crm.onrender.com/ws${cleanPath}${tokenQuery}`;
  }
};

export const sanitizeUrl = (url: string): string => {
  if (!url) return "";
  return url.replace(/([?&]token=)[^&]+/g, "$1***");
};


export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

/**
 * Robust fetch wrapper with authentication, timeout (default 35s for Render cold starts), retry logic, and centralized error parsing.
 * Always routes directly to Render API without falling back to local relative paths.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  signal?: AbortSignal
): Promise<any> {
  const { timeoutMs = 35000, retries = 1, ...fetchOptions } = options;

  // Proactively prevent sending unauthenticated requests to protected endpoints
  const isAuthRoute = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register") || path.startsWith("/health") || path === "/";
  const token = getToken();

  if (!token && !isAuthRoute) {
    handleUnauthorizedCleanup();
    const err = new Error("Session expired or unauthenticated. Please sign in again.");
    (err as any).status = 401;
    throw err;
  }

  const headers: Record<string, string> = {
    ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  };

  const baseUrl = getBaseUrl();
  const targetUrl = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const combinedSignal = signal || controller.signal;

    try {
      const res = await fetch(targetUrl, {
        ...fetchOptions,
        headers,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized response from backend
      if (res.status === 401 && !isAuthRoute) {
        handleUnauthorizedCleanup();
        const err = new Error("Session expired. Please sign in again.");
        (err as any).status = 401;
        throw err;
      }

      // Gracefully handle 403 Forbidden for active/live call polling on remote server
      if (res.status === 403 && (path.includes("/calls/active") || path.includes("/calls/live"))) {
        return [];
      }

      // Gracefully handle 404 Not Found for optional presence, session & shift-summary polling endpoints
      if (res.status === 404 && (path.includes("session") || path.includes("presence") || path.includes("shift-summary"))) {
        return null;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: res.statusText }));
        let detailMsg = errorData.details || errorData.error || errorData.detail;
        if (Array.isArray(detailMsg)) {
          detailMsg = detailMsg.map((e: any) => e.msg || e.detail || e.details || JSON.stringify(e)).join("; ");
        } else if (typeof detailMsg === "object" && detailMsg !== null) {
          detailMsg = detailMsg.details || detailMsg.error || detailMsg.msg || detailMsg.detail || JSON.stringify(detailMsg);
        }
        const err = new Error(detailMsg || `Server returned error (${res.status})`);
        (err as any).status = res.status;
        (err as any).details = detailMsg;
        throw err;
      }

      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Don't retry if aborted explicitly by user
      if (err.name === "AbortError" && signal?.aborted) {
        throw err;
      }

      lastError = err;
      attempt++;

      if (attempt <= retries && err.name !== "AbortError") {
        // Exponential backoff before retry
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  const errorMessage =
    lastError?.name === "AbortError"
      ? "Render Server is spinning up (Cold Start). Please wait a few seconds and try again."
      : lastError?.message || "Unable to connect to the Render backend server. Please check your connection.";

  throw new Error(errorMessage);
}

export const api = {
  get: (path: string, signal?: AbortSignal) => apiFetch(path, {}, signal),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) =>
    apiFetch(path, { method: "DELETE" }),
  upload: (path: string, formData: FormData) =>
    apiFetch(path, { method: "POST", body: formData }),
  checkHealth: async (): Promise<{ status: string; database?: string }> => {
    try {
      return await apiFetch("/health", { timeoutMs: 35000, retries: 1 });
    } catch {
      return await apiFetch("/api/health", { timeoutMs: 35000, retries: 0 });
    }
  },
};

export { BASE_URL, getToken };
