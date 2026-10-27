import { z } from "zod";

const paymentModeSchema = z.enum(["cash", "upi", "card", "bank_transfer"]);
// Deliberately narrower than paymentModeSchema (no "card") - matches
// RefundMode on the client, and both source requirement docs only ever
// list Cash/UPI/Bank Transfer for refunds/withdrawals.
const refundModeSchema = z.enum(["cash", "upi", "bank_transfer"]);
const paymentStatusSchema = z.enum(["unpaid", "partial", "paid"]);
const makingMethodSchema = z.enum(["fixed", "per_gram", "percent_metal"]);

// Used by createInvoiceSchema's discount_amount refine below.
function hasAtMostTwoDecimals(n: number): boolean {
  const str = String(n);
  const dotIndex = str.indexOf(".");
  return dotIndex === -1 || str.length - dotIndex - 1 <= 2;
}

// Exported for reuse by standaloneOldJewelleryPurchase.schema.ts - same
// customer shape, no reason to duplicate the field rules.
export const invoiceCustomerInputSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  // Exactly 10 digits - matches CustomerFields.tsx/StandaloneCustomerFields.tsx's
  // own PHONE_PATTERN, which already gates their phone-lookup feature (a
  // number that isn't exactly 10 digits never triggers a lookup there) -
  // this was previously never actually enforced at save time, so a number
  // the UI already treated as "incomplete" could still be submitted.
  phone: z.string().trim().regex(/^\d{10}$/, "Phone must be a valid 10-digit number"),
  email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
  address: z.string().trim().optional(),
});

const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  hsn_code: z.string().trim().min(1, "HSN code is required"),
  metal: z.string().trim().min(1, "Metal is required"),
  // Deliberately NOT min(1) - purity is optional end-to-end (explicit
  // product decision): a manually-added line can be finalized with no
  // purity recorded. Still a real string field (not .optional()) because
  // the client always sends one, even when empty - ManualAddForm's Select
  // defaults to "" when the cashier hasn't picked one.
  purity: z.string().trim(),
  pieces: z.number().int().min(1, "Pieces must be at least 1").default(1),
  // Gross/net weight and rate must be real, positive values - 0 isn't "not
  // entered yet," it's a physically meaningless weight/rate for a line
  // that's actually being billed. Stone weight stays min(0): a plain gold
  // band genuinely has zero stone weight, that's a valid real value.
  gross_wt_g: z.number().positive("Gross weight is required"),
  stone_wt_g: z.number().min(0, "Stone weight must be 0 or more").default(0),
  net_wt_g: z.number().positive("Net weight is required"),
  rate_per_gram: z.number().positive("Rate per gram is required"),
  // making_charge is always the computed ₹ result (never recomputed
  // server-side, same "client math is authoritative" rule as the rest of
  // this schema - see docs/billing-how-it-works.md §4/§9). making_method/
  // making_value just record what the admin actually chose in the "Making
  // method" dialog, for audit/re-edit - "fixed"/0 is the default for a
  // freshly-scanned tag item or a manual row that hasn't opened the dialog.
  making_charge: z.number().min(0, "Making charge must be 0 or more").default(0),
  making_method: makingMethodSchema.default("fixed"),
  making_value: z.number().min(0, "Making value must be 0 or more").default(0),
  stone_charge: z.number().min(0, "Stone charge must be 0 or more").default(0),
  // Optional - a manually-added line (no scanned/browsed tag behind it) has none.
  tag_code: z.string().trim().toUpperCase().optional(),
  // Positive, not min(0) - a line that contributes nothing to the bill is
  // always either an incomplete entry (rate not set yet, or a net weight so
  // small the metal value rounds to ₹0) or a mistake, never a real sellable
  // line - this app has no concept of a free/complimentary item.
  total: z.number().positive("Total must be greater than 0"),
});

const invoicePaymentInputSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than 0"),
  mode: paymentModeSchema,
});

// Old jewellery exchanged during this sale - settlement against the bill
// (exchange-first), never a discount on the items above. See
// docs/old-jewellery-exchange-plan.md.
// Exported for reuse by standaloneOldJewelleryPurchase.schema.ts.
export const oldJewelleryItemInputSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required"),
    metal: z.string().trim().min(1, "Metal is required"),
    // Optional end-to-end, same decision as new-jewellery items' purity.
    purity: z.string().trim(),
    gross_wt_g: z.number().positive("Gross weight is required"),
    stone_wt_g: z.number().min(0, "Stone weight must be 0 or more").default(0),
    dust_wt_g: z.number().min(0, "Dust weight must be 0 or more").default(0),
    other_deduction_wt_g: z.number().min(0, "Other deduction must be 0 or more").default(0),
    net_wt_g: z.number().min(0, "Net weight cannot be negative"),
    // null - this purity had no default purchase rate configured in
    // Settings yet, so the admin typed applied_rate_per_gram manually.
    default_rate_per_gram: z.number().min(0).nullable(),
    applied_rate_per_gram: z.number().positive("Rate is required"),
    calculated_value: z.number().min(0, "Calculated value cannot be negative"),
    // Positive, not min(0) - real cash paid out for nothing (whether from
    // an override or deductions landing exactly equal to gross) isn't a
    // valid old-jewellery item. Mirrors createInvoiceSchema's matching
    // total: z.number().positive(...) for new-jewellery items.
    final_value: z.number().positive("Final value must be greater than 0"),
    override_reason: z.string().trim().optional(),
  })
  .refine((item) => item.stone_wt_g + item.dust_wt_g + item.other_deduction_wt_g <= item.gross_wt_g, {
    message: "Deductions cannot exceed gross weight",
    path: ["gross_wt_g"],
  })
  // final_value is real cash paid out to a customer for old jewellery - an
  // override with no explanation on record is a fraud/mistake risk, not a
  // convenience, so a reason is mandatory whenever it's been pushed away
  // from the calculated value. Mirrors AddOldJewelleryItemDialog.tsx's
  // matching UI gate.
  .refine(
    (item) => item.final_value === item.calculated_value || item.override_reason?.trim().length,
    {
      message: "A reason is required when overriding the calculated value",
      path: ["override_reason"],
    },
  );

// Exported for reuse by standaloneOldJewelleryPurchase.schema.ts.
export const oldJewelleryRefundInputSchema = z.object({
  amount: z.number().positive("Refund amount must be greater than 0"),
  mode: refundModeSchema,
  reference: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

// Cross-field checks here are structural guards, not a recomputation of the
// client's GST/pricing math (that's an explicit project rule - see
// docs/billing-plan.md decision 7). Each .refine() carries a top-level field
// `path` on purpose: src/server/validation.ts's error response only reads
// z.flattenError()'s fieldErrors, which only surfaces messages grouped under
// a top-level key - a refine with no path (or a deeply nested one) would be
// silently dropped from the 422 response instead of shown to the caller.
export const createInvoiceSchema = z
  .object({
    customer: invoiceCustomerInputSchema,
    items: z.array(invoiceItemInputSchema).min(1, "At least one item is required"),
    discount_amount: z.number().min(0, "Discount cannot be negative").default(0),
    // gst_percent/gst_amount stay the authoritative combined totals (every
    // other consumer - dashboard, invoice list, the grand_total check below -
    // reads these, not the CGST/SGST split). cgst_percent/sgst_percent are
    // independently editable by the cashier, not forced to a 50/50 split, so
    // they're submitted and cross-checked separately rather than derived
    // server-side.
    gst_percent: z.number().min(0, "GST percent cannot be negative").max(100, "GST percent cannot exceed 100"),
    gst_amount: z.number().min(0, "GST amount cannot be negative"),
    cgst_percent: z.number().min(0, "CGST percent cannot be negative").max(100, "CGST percent cannot exceed 100"),
    sgst_percent: z.number().min(0, "SGST percent cannot be negative").max(100, "SGST percent cannot exceed 100"),
    cgst_amount: z.number().min(0, "CGST amount cannot be negative"),
    sgst_amount: z.number().min(0, "SGST amount cannot be negative"),
    subtotal: z.number().min(0, "Subtotal cannot be negative"),
    grand_total: z.number().min(0, "Grand total cannot be negative"),
    // Optional - a fully-on-credit sale has no payment yet.
    payment: invoicePaymentInputSchema.optional(),
    paid_amount: z.number().min(0, "Paid amount cannot be negative"),
    pending_amount: z.number().min(0, "Pending amount cannot be negative"),
    payment_status: paymentStatusSchema,
    // Empty array for the overwhelming majority of ordinary sales - every
    // new refine/field below that touches this is a no-op when it's empty,
    // see the refines' own comments.
    old_jewellery_items: z.array(oldJewelleryItemInputSchema).default([]),
    // Only "refund" exists - Customer Credit was built and then explicitly
    // removed from this app's scope, see docs/old-jewellery-exchange-plan.md.
    excess_settlement: z.enum(["refund"]).nullable().default(null),
    refund: oldJewelleryRefundInputSchema.optional(),
    // Idempotency key, exchange path only (see docs/old-jewellery-exchange-plan.md's
    // Step 5 scoping decision) - optional because ordinary sales don't send one.
    operation_id: z.string().uuid("Invalid operation id").optional(),
  })
  .refine((data) => data.paid_amount <= data.grand_total, {
    message: "Paid amount cannot exceed the grand total",
    path: ["paid_amount"],
  })
  // Mandatory exchange-first rule's excess side: if the old jewellery total
  // exceeds the bill, the admin must have chosen Refund and the refund
  // amount must match the excess exactly (±₹1 tolerance, same style as the
  // grand_total check below). A structural guard, not a recomputation of
  // the service layer's own authoritative exchangeApplied/excessAmount
  // (decision 20's deliberate exception to "client math is authoritative") -
  // that happens again, independently, inside the transaction itself.
  .refine(
    (data) => {
      const oldJewelleryTotal = data.old_jewellery_items.reduce((sum, item) => sum + item.final_value, 0);
      const excessAmount = Math.max(0, Math.round(oldJewelleryTotal) - data.grand_total);
      if (excessAmount <= 0) return true;
      return data.excess_settlement === "refund" && !!data.refund && Math.abs(data.refund.amount - excessAmount) <= 1;
    },
    { message: "Refund amount does not match the exchange excess", path: ["refund"] },
  )
  // The reverse case - no excess, so there's nothing to settle. Defensive:
  // shouldn't be reachable from the UI (RefundSection only renders while
  // excess is positive), rejected here anyway rather than silently accepted.
  .refine(
    (data) => {
      const oldJewelleryTotal = data.old_jewellery_items.reduce((sum, item) => sum + item.final_value, 0);
      const excessAmount = Math.max(0, Math.round(oldJewelleryTotal) - data.grand_total);
      if (excessAmount > 0) return true;
      return data.excess_settlement === null && !data.refund;
    },
    { message: "No excess to settle - remove the refund/settlement choice", path: ["excess_settlement"] },
  )
  .refine(
    (data) =>
      Math.abs(data.grand_total - (data.subtotal - data.discount_amount + data.gst_amount)) <= 1,
    {
      message: "Grand total does not match subtotal, discount, and GST",
      path: ["grand_total"],
    },
  )
  .refine(
    (data) => {
      const tagCodes = data.items.map((item) => item.tag_code).filter((code): code is string => !!code);
      return new Set(tagCodes).size === tagCodes.length;
    },
    { message: "The same tag cannot appear twice on one invoice", path: ["items"] },
  )
  // Consistency guards, same spirit as the grand_total check above - the
  // client computes CGST+SGST independently and is also the one that sums
  // them into gst_percent/gst_amount, so these two should never actually
  // disagree. Checked anyway as a tamper/drift guard, not a recomputation
  // of the split itself (decision 7, docs/billing-plan.md).
  .refine(
    (data) => Math.abs(data.cgst_percent + data.sgst_percent - data.gst_percent) <= 0.01,
    { message: "CGST% + SGST% does not match GST%", path: ["cgst_percent"] },
  )
  .refine(
    (data) => Math.abs(data.cgst_amount + data.sgst_amount - data.gst_amount) <= 1,
    { message: "CGST + SGST amount does not match the GST amount", path: ["cgst_amount"] },
  )
  // Mirrors MoneyField's 2-decimal cap on the Discount input - a string
  // check (how many decimal digits does this literal have), not a
  // tolerance-based float comparison, since this is a precision question,
  // not a rounding one. String(n) reliably round-trips a directly-typed
  // decimal like 100.56 (JS's shortest-round-trip number->string
  // algorithm), unlike a value produced by multiplication/division, so
  // this is safe for a field that's always typed, never computed.
  .refine((data) => hasAtMostTwoDecimals(data.discount_amount), {
    message: "Discount must have at most 2 decimal places",
    path: ["discount_amount"],
  })
  // Mirrors WholeRupeeField's restriction on the Payment Amount input -
  // grandTotal and old-jewellery value are both whole rupees, so keeping
  // payments whole too guarantees the pending balance never carries paise.
  // path: ["payment"], not ["payment", "amount"] - a refine path deeper
  // than one level is silently dropped from validationErrorResponse's
  // z.flattenError().fieldErrors (top-level keys only), same constraint
  // noted on tag.schema.ts's refines.
  .refine((data) => !data.payment || Number.isInteger(data.payment.amount), {
    message: "Payment amount must be a whole rupee",
    path: ["payment"],
  })
  .refine((data) => !data.refund || Number.isInteger(data.refund.amount), {
    message: "Refund amount must be a whole rupee",
    path: ["refund"],
  });

export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>;
export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;

// paid_amount here can't be cross-checked against the invoice's grandTotal in
// this schema - that total lives on the existing invoice document, not in
// this request body. That check happens in invoicesService.addPayment()
// once the invoice has been loaded. This schema only validates the shape of
// what was actually sent.
export const addInvoicePaymentSchema = z
  .object({
    amount: z.number().positive("Payment amount must be greater than 0"),
    mode: paymentModeSchema,
    paid_amount: z.number().min(0, "Paid amount cannot be negative"),
    pending_amount: z.number().min(0, "Pending amount cannot be negative"),
    payment_status: paymentStatusSchema,
  })
  // Same whole-rupee rule createInvoiceSchema's initial payment refine
  // enforces - grandTotal is always a whole rupee, so a later payment on
  // this same invoice (via "Collect Payment") must stay whole too, or the
  // pending balance ends up carrying paise.
  .refine((data) => Number.isInteger(data.amount), {
    message: "Payment amount must be a whole rupee",
    path: ["amount"],
  });

export type AddInvoicePaymentInput = z.infer<typeof addInvoicePaymentSchema>;
