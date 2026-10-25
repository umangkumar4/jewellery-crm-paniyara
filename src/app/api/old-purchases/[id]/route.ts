import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import {
  findOldJewelleryPurchaseById,
  serializeOldJewelleryPurchase,
} from "@/server/services/oldJewelleryPurchasesService";

export const dynamic = "force-dynamic";

// One route, not a separate /print variant like /api/invoices/:id has -
// the Old Jewellery Purchase Receipt has no separate interactive detail
// page (print-only, see docs/old-jewellery-exchange-plan.md's Step 6
// scope decisions), so there's only ever one consumer of this data.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { id } = await params;

  try {
    const result = await findOldJewelleryPurchaseById(id);
    if (!result) {
      return Response.json({ error: "No old jewellery purchase with this id" }, { status: 404 });
    }
    return Response.json(serializeOldJewelleryPurchase(result));
  } catch (error) {
    logger.error({ error }, "Failed to fetch old jewellery purchase");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
