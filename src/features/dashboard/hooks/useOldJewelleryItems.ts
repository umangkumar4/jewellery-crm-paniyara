import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ChangeOldJewelleryItemStatusInput } from "@/schemas/oldJewelleryItem.schema";

export type OldJewelleryItemStatus = "IN_SHOP" | "DISPOSED" | "MELTED";

export interface OldJewelleryItemStatusChangeRow {
  from: OldJewelleryItemStatus;
  to: OldJewelleryItemStatus;
  reason: string;
  changed_at: string;
}

export interface OldJewelleryItemListRow {
  id: string;
  purchase_no: string;
  description: string;
  metal: string;
  purity: string;
  net_wt_g: number;
  final_value: number;
  status: OldJewelleryItemStatus;
  status_history: OldJewelleryItemStatusChangeRow[];
}

export interface OldJewelleryItemsListParams {
  page: number;
  limit: number;
  status?: OldJewelleryItemStatus;
}

export interface OldJewelleryItemsListResponse {
  data: OldJewelleryItemListRow[];
  total: number;
  page: number;
}

export function useOldJewelleryItems(params: OldJewelleryItemsListParams) {
  const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.status) searchParams.set("status", params.status);

  return useQuery({
    queryKey: ["old-items", params],
    queryFn: () => apiClient.get<OldJewelleryItemsListResponse>(`/old-items?${searchParams.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}

export function useChangeOldJewelleryItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ChangeOldJewelleryItemStatusInput }) =>
      apiClient.patch<OldJewelleryItemListRow>(`/old-items/${id}/status`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["old-items"] });
    },
  });
}
