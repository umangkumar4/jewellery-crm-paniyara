import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useDeletePurity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ message: string }>(`/purities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metal-purities"] });
    },
  });
}
