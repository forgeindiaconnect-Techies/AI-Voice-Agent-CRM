/**
 * Dynamic API Base URL Resolver.
 * Automatically adapts to current browser location (localhost, 127.0.0.1, or LAN IP e.g. 192.168.x.x).
 */
const getBaseUrl = (): string => {
  // If explicitly configured in environment and not default placeholder, use it
  if (
    import.meta.env.VITE_API_URL &&
    import.meta.env.VITE_API_URL.trim() !== "" &&
    !import.meta.env.VITE_API_URL.includes("localhost")
  ) {
    let url = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "");
    if (url.startsWith(":")) {
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      url = `${protocol}//${hostname}${url}`;
    }
    return url;
  }

  // Dynamic Resolution based on current browser URL
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }

  return "http://localhost:8000";
};

const BASE_URL = getBaseUrl();

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

/**
 * Robust fetch wrapper with authentication, timeout (default 10s), retry logic, and centralized error parsing.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  signal?: AbortSignal
): Promise<any> {
  const { timeoutMs = 10000, retries = 1, ...fetchOptions } = options;
  const token = getToken();

  const headers: Record<string, string> = {
    ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  };

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal with timeout signal
    const combinedSignal = signal || controller.signal;

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
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
        throw new Error(errorData.detail || `Server returned error (${res.status})`);
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
      ? "Request timed out. Backend server taking too long to respond."
      : lastError?.message || "Unable to connect to the backend server. Please check your connection.";

  throw new Error(errorMessage);
}

export const api = {
  get: (path: string, signal?: AbortSignal) => apiFetch(path, {}, signal),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) =>
    apiFetch(path, { method: "DELETE" }),
  upload: (path: string, formData: FormData) =>
    apiFetch(path, { method: "POST", body: formData }),
  checkHealth: async (): Promise<{ status: string; database?: string }> => {
    try {
      return await apiFetch("/api/health", { timeoutMs: 4000, retries: 0 });
    } catch {
      return await apiFetch("/health", { timeoutMs: 4000, retries: 0 });
    }
  },
};

export { BASE_URL };
