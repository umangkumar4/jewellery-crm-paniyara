import { z } from "zod";

const paymentModeSchema = z.enum(["cash", "upi", "card", "bank_transfer"]);
const paymentStatusSchema = z.enum(["unpaid", "partial", "paid"]);

const invoiceCustomerInputSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().min(1, "Customer phone is required"),
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
  making_charge: z.number().min(0, "Making charge must be 0 or more").default(0),
  stone_charge: z.number().min(0, "Stone charge must be 0 or more").default(0),
  // Optional - a manually-added line (no scanned/browsed tag behind it) has none.
  tag_code: z.string().trim().toUpperCase().optional(),
  total: z.number().min(0, "Total must be 0 or more"),
});

const invoicePaymentInputSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than 0"),
  mode: paymentModeSchema,
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
  })
  .refine((data) => data.paid_amount <= data.grand_total, {
    message: "Paid amount cannot exceed the grand total",
    path: ["paid_amount"],
  })
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
  );

export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>;
export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;

// paid_amount here can't be cross-checked against the invoice's grandTotal in
// this schema - that total lives on the existing invoice document, not in
// this request body. That check happens in invoicesService.addPayment()
// once the invoice has been loaded. This schema only validates the shape of
// what was actually sent.
export const addInvoicePaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than 0"),
  mode: paymentModeSchema,
  paid_amount: z.number().min(0, "Paid amount cannot be negative"),
  pending_amount: z.number().min(0, "Pending amount cannot be negative"),
  payment_status: paymentStatusSchema,
});

export type AddInvoicePaymentInput = z.infer<typeof addInvoicePaymentSchema>;
