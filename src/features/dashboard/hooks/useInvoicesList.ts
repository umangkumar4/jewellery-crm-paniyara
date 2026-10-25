import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface InvoiceListRow {
  id: string;
  invoice_no: string;
  customer_name: string;
  phone: string;
  items_count: number;
  grand_total: number;
  paid_amount: number;
  pending_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  created_at: string;
}

export interface InvoicesListParams {
  page: number;
  limit: number;
  date?: string;
  from?: string;
  to?: string;
  customerId?: string;
  status?: "unpaid" | "partial" | "paid";
}

export interface InvoicesListResponse {
  data: InvoiceListRow[];
  total: number;
  page: number;
}

export function useInvoicesList(params: InvoicesListParams) {
  const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.date) searchParams.set("date", params.date);
  if (params.from && params.to) {
    searchParams.set("from", params.from);
    searchParams.set("to", params.to);
  }
  if (params.customerId) searchParams.set("customerId", params.customerId);
  if (params.status) searchParams.set("status", params.status);

  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => apiClient.get<InvoicesListResponse>(`/invoices?${searchParams.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}
