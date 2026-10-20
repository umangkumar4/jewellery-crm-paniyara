import { z } from "zod";
import { METALS } from "@/lib/metals";

export const setMetalRateSchema = z.object({
  metal: z.enum(METALS),
  purity: z.string().trim().min(1, "Purity is required"),
  rate_per_gram: z.number().min(0, "Rate must be 0 or more"),
});

export type SetMetalRateInput = z.infer<typeof setMetalRateSchema>;
