import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { setMetalRateSchema } from "@/schemas/metal-rate.schema";
import { setRate, serializeMetalPurity } from "@/server/services/metalPuritiesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = setMetalRateSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const updated = await setRate(parsed.data);
    if (!updated) {
      return Response.json(
        { error: "No such purity for this metal - add it first" },
        { status: 404 },
      );
    }
    return Response.json(serializeMetalPurity(updated));
  } catch (error) {
    logger.error({ error }, "Failed to set metal rate");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
