import { z } from "zod";

export const createTagSchema = z.object({
  product_name: z.string().trim().min(1, "Product name is required"),
  metal: z.string().trim().min(1, "Metal is required"),
  purity: z.string().trim().min(1, "Purity is required"),
  gross_wt_g: z.number().min(0, "Gross weight must be 0 or more"),
  stone_wt_g: z.number().min(0, "Stone weight must be 0 or more").default(0),
  net_wt_g: z.number().min(0, "Net weight must be 0 or more"),
});

// .default(0) on stone_wt_g makes it optional going in (form values, before
// resolution) but guaranteed present coming out (what's actually sent to
// the API) - z.input/z.output capture that difference precisely.
export type CreateTagInput = z.output<typeof createTagSchema>;
export type CreateTagFormValues = z.input<typeof createTagSchema>;
