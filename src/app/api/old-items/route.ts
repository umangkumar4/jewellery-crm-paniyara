import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import {
  listOldJewelleryItems,
  serializeOldJewelleryItemListRow,
} from "@/server/services/oldJewelleryPurchasesService";
import type { OldJewelleryItemStatus } from "@/models/OldJewelleryItem.model";

export const dynamic = "force-dynamic";

const VALID_STATUSES: OldJewelleryItemStatus[] = ["IN_SHOP", "DISPOSED", "MELTED"];

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam >= 1 ? Math.min(Math.floor(limitParam), 100) : 20;

  const statusParam = searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as OldJewelleryItemStatus)
      ? (statusParam as OldJewelleryItemStatus)
      : undefined;

  await dbConnect();

  try {
    const { items, total } = await listOldJewelleryItems({ status, page, limit });
    return Response.json({ data: items.map(serializeOldJewelleryItemListRow), total, page });
  } catch (error) {
    logger.error({ error }, "Failed to list old jewellery items");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
