import { logger } from "@/lib/logger";
import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import { findInvoiceById, serializeInvoice } from "@/server/services/invoicesService";

export const dynamic = "force-dynamic";

// Same underlying data as GET /api/invoices/:id - "print" is a frontend
// layout concern (a receipt-styled page triggering window.print()), not a
// different query. Kept as its own route to match REQUIREMENTS.md's
// endpoint list and give the frontend a stable, purpose-named URL to fetch.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { id } = await params;

  try {
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      return Response.json({ error: "No invoice with this id" }, { status: 404 });
    }
    return Response.json(serializeInvoice(invoice));
  } catch (error) {
    logger.error({ error }, "Failed to fetch invoice for printing");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
