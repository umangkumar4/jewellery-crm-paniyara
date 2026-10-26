import { z } from "zod";
import { METALS } from "@/lib/metals";

// Uppercased so "22K" and "22k" are always the same purity - same
// normalization convention as invoice.schema.ts's tag_code - instead of two
// catalog rows that only differ by case (duplicate rates, duplicate entries
// in every purity dropdown downstream).
export const createPuritySchema = z.object({
  metal: z.enum(METALS),
  purity: z.string().trim().min(1, "Purity is required").toUpperCase(),
});

export type CreatePurityInput = z.infer<typeof createPuritySchema>;

export const renamePuritySchema = z.object({
  purity: z.string().trim().min(1, "Purity is required").toUpperCase(),
});

export type RenamePurityInput = z.infer<typeof renamePuritySchema>;

export const setPurityActiveSchema = z.object({
  active: z.boolean(),
});

export type SetPurityActiveInput = z.infer<typeof setPurityActiveSchema>;
