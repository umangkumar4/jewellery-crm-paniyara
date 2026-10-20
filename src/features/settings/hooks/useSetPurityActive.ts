import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";

export function useSetPurityActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch<MetalPurity>(`/purities/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metal-purities"] });
    },
  });
}
