import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MetalPurity } from "@/features/settings/hooks/useMetalPurities";

export function useRenamePurity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, purity }: { id: string; purity: string }) =>
      apiClient.patch<MetalPurity>(`/purities/${id}`, { purity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metal-purities"] });
    },
  });
}
