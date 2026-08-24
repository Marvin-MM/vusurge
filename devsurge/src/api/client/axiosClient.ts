import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { clearCsrfToken, getCsrfToken, invalidateCsrfToken } from "./csrf";

const metaEnv = (import.meta as any).env || {};
const baseURL: string = metaEnv.VITE_API_BASE_URL || "/api/v1";

/**
 * Fires once, from AuthContext, so the transport layer can react to a
 * server-confirmed session expiry (401) without importing React context
 * into a plain module. Never called for ordinary 403s (permission denial)
 * — only for "your session is no longer valid."
 */
let sessionExpiredHandler: (() => void) | undefined;
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "content-type": "application/json",
  },
  timeout: 15000,
  // Required for cookie-based sessions: the frontend and backend are
  // different origins in every environment this app targets (see
  // backend/docs/env-reference.md's CORS/CSRF notes).
  withCredentials: true,
});

// --- CSRF: attach the token to every unsafe request -----------------------
apiClient.interceptors.request.use(async (config) => {
  if (UNSAFE_METHODS.has((config.method || "get").toLowerCase())) {
    try {
      const token = await getCsrfToken();
      config.headers = config.headers ?? ({} as any);
      (config.headers as any)["x-csrf-token"] = token;
    } catch {
      // No session yet (e.g. sign-up/sign-in itself, which Better Auth's own
      // client calls directly, not through apiClient) — proceed without a
      // token; the backend only requires one when a session cookie is
      // already present.
    }
  }
  return config;
});

// --- Errors: normalize + CSRF-failure retry-once + session-expiry --------
interface RetriableConfig extends InternalAxiosRequestConfig {
  _csrfRetried?: boolean;
}

apiClient.interceptors.response.use(undefined, async (error) => {
  const status = error.response?.status as number | undefined;
  const data = error.response?.data as { detail?: string; message?: string; code?: string } | undefined;
  const config = error.config as RetriableConfig | undefined;

  if (status === 403 && data?.code === "CSRF_VALIDATION_FAILED" && config && !config._csrfRetried) {
    config._csrfRetried = true;
    invalidateCsrfToken();
    const token = await getCsrfToken();
    config.headers = config.headers ?? ({} as any);
    (config.headers as any)["x-csrf-token"] = token;
    return apiClient.request(config);
  }

  if (status === 401) {
    clearCsrfToken();
    sessionExpiredHandler?.();
  }

  // Sensitive operations (connecting an integration, transferring ownership,
  // and similar) require a session authenticated within the last 15 minutes.
  // The backend answers a bare 403 whose `detail` does not tell the reader
  // that re-authenticating is the remedy, so give this its own message —
  // otherwise it is indistinguishable from an ordinary permission denial.
  if (status === 403 && data?.code === "FRESH_SESSION_REQUIRED") {
    return Promise.reject({
      status,
      code: data.code,
      message:
        "For security, this action needs a recently authenticated session. Please sign in again, then retry.",
      data: error.response?.data,
    });
  }

  if (status === 503 && data?.code === "FEATURE_DISABLED") {
    return Promise.reject({
      status,
      code: data.code,
      message: data.detail || "This capability is not enabled in this deployment.",
      data: error.response?.data,
    });
  }

  // Real API errors are RFC 9457 problem documents (`detail`).
  const message = data?.detail || data?.message || error.message || "An unexpected error occurred.";

  return Promise.reject({
    status: status || 500,
    message,
    code: data?.code,
    data: error.response?.data,
  });
});

// --- Typed response helpers -----------------------------------------------
// The single place every feature's query hook calls through, so the
// distinction between "flat resource," "plain array," and cursor-paginated
// "{items,hasMore,nextCursor}" lives here once instead of a `.data.data`
// unwrap repeated in every hook (see backend/docs/openapi.json per
// endpoint for which shape a given path actually returns).
export interface CursorPage<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

export async function apiArray<T>(url: string, config?: AxiosRequestConfig): Promise<T[]> {
  const response = await apiClient.get<T[]>(url, config);
  return response.data;
}

export async function apiCursorList<T>(url: string, config?: AxiosRequestConfig): Promise<CursorPage<T>> {
  const response = await apiClient.get<CursorPage<T>>(url, config);
  return response.data;
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.patch<T>(url, data, config);
  return response.data;
}

export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
}

export async function apiDelete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}

export default apiClient;
