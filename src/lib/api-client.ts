/**
 * Thin fetch wrapper for client components calling this app's own
 * `/api/*` Route Handlers (paths match docs/REQUIREMENTS.md exactly).
 * The session token lives in sessionStorage (src/lib/auth-token.ts), not a
 * cookie, so it's attached explicitly as an Authorization header here.
 */
import { clearStoredToken, getStoredToken } from "@/lib/auth-token";

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  // Some routes (invoice creation's tag-conflict errors) return which exact
  // items failed, not just a generic message - e.g. "these tag codes are
  // already sold" - so the caller can remove precisely those lines instead
  // of discarding the whole in-progress draft.
  codes?: string[];

  constructor(status: number, message: string, fields?: Record<string, string>, codes?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.codes = codes;
  }
}

const API_BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearStoredToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      // Plain lib module, not a component - no router instance available here.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed", body.fields, body.codes);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  // Optional body - most DELETE calls in this app send none (existing
  // one-arg callers are unaffected, `data` defaults to undefined, same
  // `body: undefined` as before), but some (e.g. deleting an invoice) now
  // need to send a mandatory reason.
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "DELETE", body: data !== undefined ? JSON.stringify(data) : undefined }),
};
