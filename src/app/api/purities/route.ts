import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { createPuritySchema } from "@/schemas/purity.schema";
import { METALS } from "@/lib/metals";
import {
  addPurity,
  listMetalPurities,
  serializeMetalPurity,
  PurityAlreadyExistsError,
} from "@/server/services/metalPuritiesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const metalParam = searchParams.get("metal");
  const metal = (METALS as readonly string[]).includes(metalParam ?? "") ? metalParam! : undefined;
  const includeInactive = searchParams.get("includeInactive") === "true";

  await dbConnect();

  const purities = await listMetalPurities({ metal, includeInactive });

  return Response.json({ data: purities.map(serializeMetalPurity) });
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createPuritySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const purity = await addPurity(parsed.data);
    return Response.json(serializeMetalPurity(purity), { status: 201 });
  } catch (error) {
    if (error instanceof PurityAlreadyExistsError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ error }, "Failed to add purity");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
