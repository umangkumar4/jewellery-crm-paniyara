import { z } from "zod";

// "not_set" is a real, stored state, not an absence of one - it's what a
// tag has until an admin explicitly applies a method via StoneAmountDialog.
// Without it, a freshly created tag that never had the dialog opened at
// all would be indistinguishable from one explicitly set to "fixed" ₹0.
const stoneAmountMethodSchema = z.enum(["not_set", "fixed", "per_gram"]);

export const createTagSchema = z
  .object({
    product_name: z
      .string()
      .trim()
      .min(1, "Product name is required")
      .max(120, "Product name must be at most 120 characters"),
    purity_id: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid purity"),
    gross_wt_g: z.number().positive("Gross weight must be greater than 0"),
    stone_wt_g: z.number().min(0, "Stone weight must be 0 or more").default(0),
    net_wt_g: z.number().positive("Net weight must be greater than 0"),
    // Free text, optional, never read by any calculation - a reference
    // code to remember which buyer this item was lent/sold against, for
    // later complaint lookup. Same shape as invoice.schema.ts's buyer_code.
    buyer_code: z.string().trim().max(30, "Buyer code must be at most 30 characters").optional(),
    // stone_amount is always the client-computed result (never recomputed
    // server-side - same "client math is authoritative" rule
    // making_charge already follows in invoice.schema.ts).
    // stone_amount_method/total_stone_amount just record what actually
    // produced it, for later re-edit.
    stone_amount_method: stoneAmountMethodSchema.default("not_set"),
    total_stone_amount: z.number().min(0, "Stone amount value must be 0 or more").default(0),
    stone_amount: z.number().min(0, "Stone amount must be 0 or more").default(0),
  })
  .refine((data) => data.stone_wt_g <= data.gross_wt_g, {
    message: "Stone weight cannot exceed gross weight",
    path: ["stone_wt_g"],
  })
  // Structural guard, not a recomputation the client is trusted for
  // elsewhere - the UI auto-computes net_wt_g from gross/stone (see
  // TagForm.tsx), so this only ever fires against a tampered/direct API
  // request, never a normal UI submission. 0.01 tolerance absorbs floating
  // point noise from the UI's own 3dp rounding, same pattern as
  // invoice.schema.ts's cross-field checks.
  .refine((data) => Math.abs(data.net_wt_g - (data.gross_wt_g - data.stone_wt_g)) <= 0.01, {
    message: "Net weight must equal gross weight minus stone weight",
    path: ["net_wt_g"],
  });

// .default(0) on stone_wt_g makes it optional going in (form values, before
// resolution) but guaranteed present coming out (what's actually sent to
// the API) - z.input/z.output capture that difference precisely.
export type CreateTagInput = z.output<typeof createTagSchema>;
export type CreateTagFormValues = z.input<typeof createTagSchema>;
