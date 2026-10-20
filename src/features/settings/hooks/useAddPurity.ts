import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";

export interface AddPurityInput {
  metal: string;
  purity: string;
}

export function useAddPurity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddPurityInput) => apiClient.post<MetalPurity>("/purities", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metal-purities"] });
    },
  });
}
