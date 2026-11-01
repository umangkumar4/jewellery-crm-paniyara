import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TagsListResponse } from "@/features/tagging/hooks/useTags";

export interface InfiniteTagsParams {
  limit: number;
  q?: string;
  status?: "tagged" | "sold";
}

// Separate from useTags (used by TagsTable's page-number pagination) so that
// hook's params/return shape stay untouched - this one accumulates pages for
// scroll-to-load-more consumers like TagBrowseDialog instead.
export function useInfiniteTags(params: InfiniteTagsParams) {
  return useInfiniteQuery({
    queryKey: ["tags", "infinite", params],
    queryFn: ({ pageParam }) => {
      const searchParams = new URLSearchParams({
        page: String(pageParam),
        limit: String(params.limit),
      });
      if (params.q) searchParams.set("q", params.q);
      if (params.status) searchParams.set("status", params.status);
      return apiClient.get<TagsListResponse>(`/tags?${searchParams.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * params.limit < lastPage.total ? lastPage.page + 1 : undefined,
  });
}
