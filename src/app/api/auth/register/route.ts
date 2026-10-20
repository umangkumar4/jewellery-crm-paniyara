import { dbConnect } from "@/lib/db/mongoose";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { registerSchema } from "@/schemas/auth.schema";
import { registerUser, UserAlreadyExistsError } from "@/server/services/authService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const setupSecret = request.headers.get("x-setup-secret");
  if (!setupSecret || setupSecret !== env.SETUP_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const user = await registerUser(parsed.data);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof UserAlreadyExistsError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ error }, "Failed to register user");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
