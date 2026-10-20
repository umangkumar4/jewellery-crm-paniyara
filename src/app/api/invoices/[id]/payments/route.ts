import { logger } from "@/lib/logger";
import { dbConnect } from "@/lib/db/mongoose";
import { requireAuth } from "@/server/auth/session";
import { addInvoicePaymentSchema } from "@/schemas/invoice.schema";
import {
  addPayment,
  InvoiceNotFoundError,
  PaymentExceedsBalanceError,
} from "@/server/services/invoicesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = addInvoicePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();
  const { id } = await params;

  try {
    const invoice = await addPayment(id, parsed.data);
    return Response.json({ invoice_id: invoice._id.toString(), saved: true });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PaymentExceedsBalanceError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    logger.error({ error }, "Failed to add invoice payment");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
