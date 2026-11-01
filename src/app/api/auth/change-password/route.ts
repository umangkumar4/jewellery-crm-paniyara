import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { changePasswordSchema } from "@/schemas/auth.schema";
import { getSessionPayload } from "@/server/auth/session";
import {
  changePassword,
  InvalidCurrentPasswordError,
  UserNotFoundError,
} from "@/server/services/authService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = getSessionPayload(request);
  if (session instanceof Response) return session;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    await changePassword(session.userId, parsed.data);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof InvalidCurrentPasswordError) {
      // Not 401: api-client.ts treats 401 as "session expired" and force-logs
      // out + redirects to /login, which would hide this as a form error.
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof UserNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    logger.error({ error }, "Failed to change password");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
