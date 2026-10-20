import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { renamePuritySchema, setPurityActiveSchema } from "@/schemas/purity.schema";
import {
  deletePurity,
  renamePurity,
  serializeMetalPurity,
  setPurityActive,
  PurityAlreadyExistsError,
  PurityInUseError,
  PurityNotFoundError,
} from "@/server/services/metalPuritiesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const hasPurity = body && typeof body === "object" && "purity" in body;
  const hasActive = body && typeof body === "object" && "active" in body;

  if (!hasPurity && !hasActive) {
    return Response.json(
      { error: "Validation failed", fields: { purity: "Provide purity and/or active" } },
      { status: 422 },
    );
  }

  await dbConnect();

  try {
    let updated: Awaited<ReturnType<typeof renamePurity>> | null = null;

    if (hasPurity) {
      const parsed = renamePuritySchema.safeParse(body);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error);
      }
      updated = await renamePurity(id, parsed.data.purity);
    }

    if (hasActive) {
      const parsed = setPurityActiveSchema.safeParse(body);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error);
      }
      updated = await setPurityActive(id, parsed.data.active);
    }

    return Response.json(serializeMetalPurity(updated!));
  } catch (error) {
    if (error instanceof PurityNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PurityAlreadyExistsError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ error }, "Failed to update purity");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;

  await dbConnect();

  try {
    await deletePurity(id);
    return Response.json({ message: "Purity deleted" });
  } catch (error) {
    if (error instanceof PurityNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PurityInUseError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ error }, "Failed to delete purity");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
