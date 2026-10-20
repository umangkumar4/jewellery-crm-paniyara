import { z } from "zod";
import { METALS } from "@/lib/metals";

export const createPuritySchema = z.object({
  metal: z.enum(METALS),
  purity: z.string().trim().min(1, "Purity is required"),
});

export type CreatePurityInput = z.infer<typeof createPuritySchema>;

export const renamePuritySchema = z.object({
  purity: z.string().trim().min(1, "Purity is required"),
});

export type RenamePurityInput = z.infer<typeof renamePuritySchema>;

export const setPurityActiveSchema = z.object({
  active: z.boolean(),
});

export type SetPurityActiveInput = z.infer<typeof setPurityActiveSchema>;
