import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DateRange } from "@/features/dashboard/components/DateRangeFilter";

export interface SalesTrendPoint {
  date: string;
  total_sales: number;
}

export function useSalesTrend(range: DateRange) {
  return useQuery({
    queryKey: ["sales-trend", range],
    queryFn: () =>
      apiClient.get<SalesTrendPoint[]>(`/dashboard/sales-trend?from=${range.from}&to=${range.to}`),
    placeholderData: (previousData) => previousData,
  });
}
