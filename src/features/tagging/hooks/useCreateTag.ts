import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateTagInput } from "@/schemas/tag.schema";

export interface Tag {
  id: string;
  code: string;
  product_name: string;
  metal: string;
  purity: string;
  gross_wt_g: number;
  stone_wt_g: number;
  net_wt_g: number;
  status: "tagged" | "sold";
  created_at: string;
}

export function useCreateTag() {
  return useMutation({
    mutationFn: (input: CreateTagInput) => apiClient.post<Tag>("/tags", input),
  });
}
