import { logger } from "@/lib/logger";
import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import {
  findInvoiceById,
  deleteInvoiceCascade,
  serializeInvoice,
  InvoiceNotFoundError,
} from "@/server/services/invoicesService";

export const dynamic = "force-dynamic";

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
    logger.error({ error }, "Failed to fetch invoice");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Backend-only, by design - no entry point for this exists anywhere in the
// UI (see docs/billing-plan.md decision 5). Kept as a real, transactional
// endpoint for direct/administrative use, not wired into any page.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  await dbConnect();
  const { id } = await params;

  try {
    const { invoiceNo, revertedTags } = await deleteInvoiceCascade(id);
    return Response.json({
      message: `Invoice ${invoiceNo} and its records were deleted`,
      reverted_tags: revertedTags,
    });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    logger.error({ error }, "Failed to delete invoice");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
