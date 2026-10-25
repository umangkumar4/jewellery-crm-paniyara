import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { changeOldJewelleryItemStatusSchema } from "@/schemas/oldJewelleryItem.schema";
import {
  changeOldJewelleryItemStatus,
  serializeOldJewelleryItemListRow,
  OldJewelleryItemNotFoundError,
  InvalidStatusTransitionError,
} from "@/server/services/oldJewelleryPurchasesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = changeOldJewelleryItemStatusSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const item = await changeOldJewelleryItemStatus(id, parsed.data);
    return Response.json(serializeOldJewelleryItemListRow(item));
  } catch (error) {
    if (error instanceof OldJewelleryItemNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidStatusTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ error }, "Failed to change old jewellery item status");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
