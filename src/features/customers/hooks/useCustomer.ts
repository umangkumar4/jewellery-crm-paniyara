import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface CustomerStats {
  invoice_count: number;
  total_purchased: number;
  pending_amount: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
  stats: CustomerStats;
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => apiClient.get<CustomerDetail>(`/customers/${id}`),
  });
}
