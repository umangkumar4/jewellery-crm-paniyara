import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateStandaloneOldJewelleryPurchaseInput } from "@/schemas/standaloneOldJewelleryPurchase.schema";

export interface CreateOldPurchaseResult {
  id: string;
  purchase_no: string;
  created_at: string;
}

export function useCreateOldPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStandaloneOldJewelleryPurchaseInput) =>
      apiClient.post<CreateOldPurchaseResult>("/old-purchases", input),
    onSuccess: () => {
      // New IN_SHOP items land in the same inventory list Step 7 built.
      queryClient.invalidateQueries({ queryKey: ["old-items"] });
    },
  });
}
