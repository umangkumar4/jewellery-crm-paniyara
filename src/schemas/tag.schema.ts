import { z } from "zod";

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
