import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DateRange } from "@/features/dashboard/components/DateRangeFilter";

export interface DashboardSummary {
  from: string;
  to: string;
  total_sales: number;
  invoice_count: number;
  items_sold: number;
  new_customers: number;
  old_jewellery_purchase_count: number;
  old_jewellery_purchased_value: number;
  pending_amount: number;
  stock_on_hand: {
    count: number;
    net_weight_g: number;
  };
}

export function useDashboardSummary(range: DateRange) {
  return useQuery({
    queryKey: ["dashboard-summary", range],
    queryFn: () =>
      apiClient.get<DashboardSummary>(`/dashboard/summary?from=${range.from}&to=${range.to}`),
    placeholderData: (previousData) => previousData,
  });
}
