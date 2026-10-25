import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { createStandaloneOldJewelleryPurchaseSchema } from "@/schemas/standaloneOldJewelleryPurchase.schema";
import { createStandaloneOldJewelleryPurchase } from "@/server/services/oldJewelleryPurchasesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

// POST only - GET-by-id already exists at /api/old-purchases/[id] (Step 6,
// print-only). There's no list-all-purchases view in this phase (the
// inventory list at /api/old-items is item-level, not purchase-level).
export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createStandaloneOldJewelleryPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const purchase = await createStandaloneOldJewelleryPurchase(parsed.data);
    return Response.json(
      {
        id: purchase._id.toString(),
        purchase_no: purchase.purchaseNo,
        created_at: purchase.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ error }, "Failed to create standalone old jewellery purchase");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
