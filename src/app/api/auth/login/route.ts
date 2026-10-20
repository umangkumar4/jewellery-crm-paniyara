import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/schemas/auth.schema";
import { InvalidCredentialsError, loginUser } from "@/server/services/authService";
import { signToken } from "@/server/auth/jwt";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const user = await loginUser(parsed.data);
    const token = signToken({ userId: user.id });

    // No cookie: the token goes straight into the response body. The
    // frontend stores it (sessionStorage, src/lib/auth-token.ts) and sends
    // it back as an `Authorization: Bearer <token>` header on every
    // subsequent request (src/lib/api-client.ts).
    return Response.json({ user, token }, { status: 200 });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    logger.error({ error }, "Failed to log in user");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
