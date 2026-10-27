import { z } from "zod";
import { METALS } from "@/lib/metals";

// Uppercased so "22K" and "22k" are always the same purity - same
// normalization convention as invoice.schema.ts's tag_code - instead of two
// catalog rows that only differ by case (duplicate rates, duplicate entries
// in every purity dropdown downstream).
export const createPuritySchema = z.object({
  metal: z.enum(METALS),
  // 20 chars is generous for any real notation ("22K", "925", "92.5
  // STERLING SILVER") - without a cap this had no limit at all, so an
  // oversized string would reach every purity dropdown/grid/printed label
  // downstream looking broken, not just this one form.
  purity: z.string().trim().min(1, "Purity is required").max(20, "Purity must be at most 20 characters").toUpperCase(),
});

export type CreatePurityInput = z.infer<typeof createPuritySchema>;

export const renamePuritySchema = z.object({
  purity: z.string().trim().min(1, "Purity is required").max(20, "Purity must be at most 20 characters").toUpperCase(),
});

export type RenamePurityInput = z.infer<typeof renamePuritySchema>;

export const setPurityActiveSchema = z.object({
  active: z.boolean(),
});

export type SetPurityActiveInput = z.infer<typeof setPurityActiveSchema>;
