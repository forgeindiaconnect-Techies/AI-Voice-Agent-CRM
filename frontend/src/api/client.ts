const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `${window.location.protocol}//${hostname}:8000`;
  }
  return "http://localhost:8000";
};

const BASE_URL = getBaseUrl();

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

/**
 * Core fetch wrapper with auth, error handling, and optional abort support.
 * Gracefully handles CORS failures, network errors, and structured API errors.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      ...(signal ? { signal } : {}),
    });
  } catch (err: any) {
    // AbortError is expected when we cancel stale requests — rethrow silently
    if (err.name === "AbortError") {
      throw err;
    }
    // Network / CORS failures produce TypeError: Failed to fetch
    throw new Error(
      "Unable to connect to the server. Please check that the backend is running and try again."
    );
  }

  if (res.status === 401 && path !== "/api/auth/login") {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
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
};

export { BASE_URL };
