import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { createInvoiceSchema } from "@/schemas/invoice.schema";
import {
  createInvoice,
  listInvoices,
  serializeInvoiceListItem,
  TagNotFoundError,
  TagAlreadySoldError,
  RefundMismatchError,
  PaymentExceedsBalanceError,
} from "@/server/services/invoicesService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_PARAM_VALUES = new Set(["unpaid", "partial", "paid"]);

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam >= 1 ? Math.min(Math.floor(limitParam), 100) : 20;

  const dateParam = searchParams.get("date");
  const date = dateParam && DATE_PARAM_PATTERN.test(dateParam) ? dateParam : undefined;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const hasValidRange =
    fromParam && toParam && DATE_PARAM_PATTERN.test(fromParam) && DATE_PARAM_PATTERN.test(toParam);
  const from = hasValidRange ? fromParam : undefined;
  const to = hasValidRange ? toParam : undefined;

  const customerId = searchParams.get("customerId") ?? undefined;

  const statusParam = searchParams.get("status");
  const status =
    statusParam && STATUS_PARAM_VALUES.has(statusParam)
      ? (statusParam as "unpaid" | "partial" | "paid")
      : undefined;

  await dbConnect();

  try {
    const { items, total } = await listInvoices({ page, limit, date, from, to, customerId, status });
    return Response.json({ data: items.map(serializeInvoiceListItem), total, page });
  } catch (error) {
    logger.error({ error }, "Failed to list invoices");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await dbConnect();

  try {
    const invoice = await createInvoice(parsed.data);
    return Response.json(
      {
        invoice_id: invoice._id.toString(),
        invoice_no: invoice.invoiceNo,
        created_at: invoice.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TagNotFoundError) {
      return Response.json(
        { error: "One or more tags were not found", codes: error.codes },
        { status: 404 },
      );
    }
    if (error instanceof TagAlreadySoldError) {
      return Response.json(
        { error: "One or more tags are already sold", codes: error.codes },
        { status: 409 },
      );
    }
    // Duplicate operation_id (exchange path) isn't handled here - it's not
    // an error at all, createInvoice() returns the original invoice and
    // this same success path above runs normally.
    if (error instanceof RefundMismatchError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PaymentExceedsBalanceError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    // `err` (not `error`) is pino's special key - only under that key does
    // it apply its built-in serializer (message, stack, type). Logged under
    // a plain key, a bare Error instance has no enumerable own properties
    // and serializes to an unhelpful `{}`, which is exactly what made this
    // one impossible to diagnose from the terminal output alone.
    logger.error({ err: error }, "Failed to create invoice");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
