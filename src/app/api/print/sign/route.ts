import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { qzSignSchema } from "@/schemas/print.schema";
import { signQzRequest } from "@/server/services/qzSignature";
import { getQzSigningConfig } from "@/server/services/qzSigningService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

/**
 * Signs a QZ Tray request so it can print without a prompt. The private key
 * only ever exists here on the server. 404 means signing isn't set up, which
 * the client treats as "print unsigned", not as a failure.
 */
export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = qzSignSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const config = getQzSigningConfig();
  if (!config) {
    return Response.json({ error: "Print signing is not configured" }, { status: 404 });
  }

  try {
    return Response.json({ signature: signQzRequest(parsed.data.request, config.privateKey) });
  } catch (error) {
    logger.error({ error }, "Failed to sign print request");
    return Response.json({ error: "Could not sign the print request" }, { status: 500 });
  }
}
