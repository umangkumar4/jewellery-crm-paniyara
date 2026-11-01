import { verifyToken, type SessionPayload } from "@/server/auth/jwt";

/**
 * The only server-side auth check in this app - there's no cookie, so
 * nothing else (no proxy.ts) sees the session; every 🔒 route handler calls
 * this first. See docs/bckend_setup.md §6.
 */
export async function requireAuth(request: Request): Promise<Response | null> {
  const result = getSessionPayload(request);
  if (result instanceof Response) return result;
  return null;
}

/**
 * Like requireAuth, but hands back the decoded token payload (e.g. userId)
 * for routes that need to know *who* is calling, not just that the call is
 * authenticated.
 */
export function getSessionPayload(request: Request): SessionPayload | Response {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return Response.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  return payload;
}
