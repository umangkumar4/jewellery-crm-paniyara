import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Tag } from "@/features/tagging/hooks/useCreateTag";

export interface TagsListParams {
  page: number;
  limit: number;
  q?: string;
  status?: "tagged" | "sold";
}

export interface TagsListResponse {
  data: Tag[];
  total: number;
  page: number;
}

export function useTags(params: TagsListParams) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);

  return useQuery({
    queryKey: ["tags", params],
    queryFn: () => apiClient.get<TagsListResponse>(`/tags?${searchParams.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}
