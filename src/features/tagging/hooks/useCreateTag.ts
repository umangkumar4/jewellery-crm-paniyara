import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateTagInput } from "@/schemas/tag.schema";

export interface Tag {
  id: string;
  code: string;
  product_name: string;
  metal: string;
  purity: string;
  purity_id: string;
  gross_wt_g: number;
  stone_wt_g: number;
  net_wt_g: number;
  rate_per_gram: number | null;
  status: "tagged" | "sold";
  buyer_code: string;
  stone_amount_method: "not_set" | "fixed" | "per_gram";
  total_stone_amount: number;
  stone_amount: number;
  created_at: string;
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => apiClient.post<Tag>("/tags", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
