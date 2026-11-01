import { logger } from "@/lib/logger";
import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import { deleteInvoiceSchema } from "@/schemas/invoice.schema";
import { validationErrorResponse } from "@/server/validation";
import {
  findInvoiceById,
  findOldJewelleryExchangeItems,
  findOldJewelleryExcessRefund,
  classifyExchangeSettlement,
  deleteInvoiceCascade,
  serializeInvoice,
  InvoiceNotFoundError,
  InvoiceAlreadyDeletedError,
  OldJewelleryItemNotReturnableError,
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
    // A failure here (a real DB error, not "no exchange") still falls
    // through to the same catch below as findInvoiceById's own failures -
    // this isn't wrapped in its own try/catch, since there's nothing
    // different to do for either failure: both are a 500, logged the same
    // way, and a half-loaded invoice (items but no old jewellery data, or
    // vice versa) isn't a response worth returning. Run in parallel - both
    // reads only depend on invoice.linkedOldPurchaseId, already known.
    const [old_jewellery_items, old_jewellery_excess] = await Promise.all([
      findOldJewelleryExchangeItems(invoice.linkedOldPurchaseId),
      findOldJewelleryExcessRefund(invoice.linkedOldPurchaseId),
    ]);
    const exchange_settlement_type = classifyExchangeSettlement(
      invoice.exchangeApplied,
      invoice.grandTotal,
      !!old_jewellery_excess,
    );
    return Response.json({
      ...serializeInvoice(invoice),
      old_jewellery_items,
      old_jewellery_excess,
      exchange_settlement_type,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch invoice");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Soft delete (isDeleted: true, record kept) - now wired into the invoice
// detail page's own "Delete Invoice" dialog, which is why this requires a
// mandatory `reason` in the body (previously backend-only/decision 5, see
// docs/billing-plan.md - that changed once this got a real UI + audit trail).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = deleteInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();
  const { id } = await params;

  try {
    const { invoiceNo, revertedTags } = await deleteInvoiceCascade(id, parsed.data.reason);
    return Response.json({
      message: `Invoice ${invoiceNo} and its records were deleted`,
      reverted_tags: revertedTags,
    });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvoiceAlreadyDeletedError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OldJewelleryItemNotReturnableError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error({ err: error }, "Failed to delete invoice");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
