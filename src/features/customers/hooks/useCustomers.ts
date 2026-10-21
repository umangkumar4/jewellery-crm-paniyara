import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface CustomerListRow {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface CustomersListParams {
  page: number;
  limit: number;
  q?: string;
}

export interface CustomersListResponse {
  data: CustomerListRow[];
  total: number;
  page: number;
}

export function useCustomers(params: CustomersListParams) {
  const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.q) searchParams.set("q", params.q);

  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => apiClient.get<CustomersListResponse>(`/customers?${searchParams.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}
