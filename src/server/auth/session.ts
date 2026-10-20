import { verifyToken } from "@/server/auth/jwt";

/**
 * The only server-side auth check in this app - there's no cookie, so
 * nothing else (no proxy.ts) sees the session; every 🔒 route handler calls
 * this first. See docs/bckend_setup.md §6.
 */
export async function requireAuth(request: Request): Promise<Response | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return Response.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  return null;
}
