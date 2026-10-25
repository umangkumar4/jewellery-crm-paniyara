import { z } from "zod";

export const changeOldJewelleryItemStatusSchema = z.object({
  // Only the two legal destinations - never "IN_SHOP" (no reverting) and
  // never the current status itself (checked separately in the service
  // layer, which also knows the item's current status).
  status: z.enum(["DISPOSED", "MELTED"]),
  reason: z.string().trim().min(1, "A reason is required"),
});

export type ChangeOldJewelleryItemStatusInput = z.infer<typeof changeOldJewelleryItemStatusSchema>;
