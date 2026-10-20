import { z } from "zod";

export const customerPhoneQuerySchema = z.object({
  phone: z.string().trim().min(1, "Phone is required"),
});

export type CustomerPhoneQuery = z.infer<typeof customerPhoneQuerySchema>;
