import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { customerPhoneQuerySchema } from "@/schemas/customer.schema";
import {
  findCustomerByPhone,
  listCustomers,
  serializeCustomer,
  serializeCustomerListItem,
} from "@/server/services/customersService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

// Dual-mode on purpose: `?phone=` is the existing exact-match lookup
// (REQUIREMENTS.md #11, load-bearing for Billing's autofill - left
// byte-for-byte unchanged, including 422 on `?phone=` with an empty value).
// No `phone` key in the URL at all -> list mode (search/pagination), the
// new behavior this route gains. Branching on `.has("phone")`, not a
// truthiness check on `.get("phone")`, so `?phone=` (empty string) still
// goes through the existing validation path and 422s exactly as before,
// instead of silently falling through to list mode.
export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  if (searchParams.has("phone")) {
    const parsed = customerPhoneQuerySchema.safeParse({ phone: searchParams.get("phone") ?? "" });
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    await dbConnect();

    try {
      const customer = await findCustomerByPhone(parsed.data.phone);
      if (!customer) {
        return Response.json({ error: "No customer with this phone number" }, { status: 404 });
      }
      return Response.json(serializeCustomer(customer));
    } catch (error) {
      logger.error({ error }, "Failed to look up customer");
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam >= 1 ? Math.min(Math.floor(limitParam), 100) : 20;

  const q = searchParams.get("q")?.trim() || undefined;

  await dbConnect();

  try {
    const { items, total } = await listCustomers({ page, limit, q });
    return Response.json({ data: items.map(serializeCustomerListItem), total, page });
  } catch (error) {
    logger.error({ error }, "Failed to list customers");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
