import { dbConnect } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/server/auth/session";
import { customerPhoneQuerySchema } from "@/schemas/customer.schema";
import { findCustomerByPhone, serializeCustomer } from "@/server/services/customersService";
import { validationErrorResponse } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
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
