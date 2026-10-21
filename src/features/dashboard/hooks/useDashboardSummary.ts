import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DateRange } from "@/features/dashboard/components/DateRangeFilter";

export interface DashboardSummary {
  from: string;
  to: string;
  total_sales: number;
  invoice_count: number;
  items_sold: number;
  net_weight_sold_g: number;
  avg_invoice_value: number;
  new_customers: number;
  vs_previous_period: {
    total_sales_pct: number | null;
    invoice_count_pct: number | null;
  };
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
