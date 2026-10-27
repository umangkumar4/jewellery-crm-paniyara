import { z } from "zod";
import {
  invoiceCustomerInputSchema,
  oldJewelleryItemInputSchema,
  oldJewelleryRefundInputSchema,
} from "@/schemas/invoice.schema";

// Sell-without-buy: the shop buys old jewellery with no linked sale, so
// unlike the billing-exchange path (where old jewellery value settles
// against a grand_total and only the leftover is a refund), every rupee of
// value here is paid out. Reuses the exact same customer/item/refund sub-
// schemas the billing-exchange path already validates with - a purchased
// item is the same shape regardless of which flow it came from.
export const createStandaloneOldJewelleryPurchaseSchema = z
  .object({
    customer: invoiceCustomerInputSchema,
    items: z.array(oldJewelleryItemInputSchema).min(1, "At least one item is required"),
    refund: oldJewelleryRefundInputSchema,
    // Idempotency key - a double-click/network-retry of "Record Purchase"
    // must not create a second purchase and pay the customer out twice.
    // Required here (unlike invoice.schema.ts's optional one) since this
    // entire route only ever runs the exchange-equivalent path.
    operation_id: z.string().uuid("Invalid operation id"),
  })
  .refine(
    (data) => {
      const total = Math.round(data.items.reduce((sum, item) => sum + item.final_value, 0));
      return Math.abs(data.refund.amount - total) <= 1;
    },
    { message: "Refund amount does not match the total item value", path: ["refund"] },
  )
  // Every rupee of old-jewellery value here is paid out as cash - same
  // whole-rupee rule createInvoiceSchema's payment/refund refines enforce,
  // since the item values being summed above are already whole rupees.
  .refine((data) => Number.isInteger(data.refund.amount), {
    message: "Refund amount must be a whole rupee",
    path: ["refund"],
  });

export type CreateStandaloneOldJewelleryPurchaseInput = z.output<
  typeof createStandaloneOldJewelleryPurchaseSchema
>;
