import { z } from "zod";
import { METALS } from "@/lib/metals";

export const setMetalRateSchema = z.object({
  metal: z.enum(METALS),
  purity: z.string().trim().min(1, "Purity is required"),
  rate_per_gram: z.number().min(0, "Rate must be 0 or more"),
  // What the shop pays per gram buying this metal/purity back as old
  // jewellery - independent of rate_per_gram (what it charges selling new
  // jewellery). Both travel together in one request/form, same as the rest
  // of this schema, but are stored as two independent fields on the same
  // MetalPurity row - see docs/old-jewellery-exchange-plan.md.
  purchase_rate_per_gram: z.number().min(0, "Purchase rate must be 0 or more"),
});

export type SetMetalRateInput = z.infer<typeof setMetalRateSchema>;
