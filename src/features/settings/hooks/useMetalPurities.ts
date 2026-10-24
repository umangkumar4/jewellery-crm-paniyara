import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface MetalPurity {
  id: string;
  metal: string;
  purity: string;
  rate_per_gram: number | null;
  purchase_rate_per_gram: number | null;
  active: boolean;
  updated_at: string;
}

export interface MetalPuritiesParams {
  metal?: string;
  includeInactive?: boolean;
}

export function useMetalPurities(params: MetalPuritiesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.metal) searchParams.set("metal", params.metal);
  if (params.includeInactive) searchParams.set("includeInactive", "true");
  const query = searchParams.toString();

  return useQuery({
    queryKey: ["metal-purities", params],
    queryFn: () =>
      apiClient.get<{ data: MetalPurity[] }>(`/purities${query ? `?${query}` : ""}`).then((res) => res.data),
  });
}
