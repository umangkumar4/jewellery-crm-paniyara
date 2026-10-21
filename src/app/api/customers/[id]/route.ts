import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import {
  findCustomerById,
  getCustomerStats,
  serializeCustomerDetail,
} from "@/server/services/customersService";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { id } = await params;

  try {
    const customer = await findCustomerById(id);
    if (!customer) {
      return Response.json({ error: "No customer with this id" }, { status: 404 });
    }

    const stats = await getCustomerStats(id);
    return Response.json(serializeCustomerDetail(customer, stats));
  } catch (error) {
    logger.error({ error }, "Failed to load customer");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
