/**
 * The JWT lives only in the browser's sessionStorage, never in a cookie -
 * the server never sees it on a page navigation, only when a client
 * component explicitly attaches it as an Authorization header (see
 * src/lib/api-client.ts). Every accessor is guarded for SSR (no `window`)
 * and for storage being unavailable (private mode, blocked, quota).
 */
const TOKEN_KEY = "jewellery_crm_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // sessionStorage unavailable - nothing we can do, caller still has the token in memory
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
