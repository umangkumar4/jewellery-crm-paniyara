import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { dashboardRangeQuerySchema } from "@/schemas/dashboard.schema";
import { getDashboardSummary } from "@/server/services/dashboardService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const parsed = dashboardRangeQuerySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const summary = await getDashboardSummary(parsed.data);
    return Response.json(summary);
  } catch (error) {
    logger.error({ error }, "Failed to build dashboard summary");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
