/**
 * Dynamic API Base URL Resolver.
 * Connects directly to the production Render backend API (https://ai-voice-agent-crm.onrender.com).
 */
const RENDER_PROD_URL = "https://ai-voice-agent-crm.onrender.com";

let currentBaseUrl: string | null = null;

export const getBaseUrl = (): string => {
  if (currentBaseUrl !== null) return currentBaseUrl;

  // 1. Check user custom override from local storage (e.g. set via ApiSettingsModal)
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
      const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
      const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      url = `${protocol}//${hostname}${url}`;
    }
    return url;
  }

  // 3. Permanent Default Target: Production Render Backend
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

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export const getWsUrl = (roomPath: string = ""): string => {
  const token = getToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";
  const cleanPath = roomPath ? (roomPath.startsWith("/") ? roomPath : `/${roomPath}`) : "";
  const baseUrl = getBaseUrl();

  try {
    const urlObj = new URL(baseUrl);
    const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${urlObj.host}/ws${cleanPath}${tokenQuery}`;
  } catch {
    return `wss://ai-voice-agent-crm.onrender.com/ws${cleanPath}${tokenQuery}`;
  }
};

const WS_URL = getWsUrl();

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
  const token = getToken();

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

      // Handle token expiration
      if (res.status === 401 && path !== "/api/auth/login") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please sign in again.");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: res.statusText }));
        let detailMsg = errorData.detail;
        if (Array.isArray(detailMsg)) {
          detailMsg = detailMsg.map((e: any) => e.msg || e.detail || JSON.stringify(e)).join("; ");
        } else if (typeof detailMsg === "object" && detailMsg !== null) {
          detailMsg = detailMsg.msg || detailMsg.detail || JSON.stringify(detailMsg);
        }
        throw new Error(detailMsg || `Server returned error (${res.status})`);
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

export { BASE_URL, WS_URL, getToken };
