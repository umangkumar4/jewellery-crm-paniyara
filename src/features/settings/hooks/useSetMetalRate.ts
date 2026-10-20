import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";

export interface SetMetalRateInput {
  metal: string;
  purity: string;
  rate_per_gram: number;
}

export function useSetMetalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetMetalRateInput) => apiClient.put<MetalPurity>("/metal-rates", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metal-purities"] });
    },
  });
}
