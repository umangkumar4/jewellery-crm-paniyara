import { requireAuth } from "@/server/auth/session";
import { getQzSigningConfig } from "@/server/services/qzSigningService";

export const dynamic = "force-dynamic";

// The public half of the signing pair, sent to QZ Tray when connecting. 404
// means signing isn't set up, same as POST /api/print/sign.
export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const config = getQzSigningConfig();
  if (!config) {
    return Response.json({ error: "Print signing is not configured" }, { status: 404 });
  }

  return Response.json({ certificate: config.certificate });
}
