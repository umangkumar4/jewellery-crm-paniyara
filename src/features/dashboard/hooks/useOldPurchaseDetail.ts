import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface OldPurchaseItemDetail {
  sr_no: number;
  description: string;
  metal: string;
  purity: string;
  gross_wt_g: number;
  stone_wt_g: number;
  dust_wt_g: number;
  other_deduction_wt_g: number;
  net_wt_g: number;
  applied_rate_per_gram: number;
  calculated_value: number;
  final_value: number;
  override_reason: string;
  status: "IN_SHOP" | "DISPOSED" | "MELTED";
}

export interface OldPurchaseRefundDetail {
  amount: number;
  mode: "cash" | "upi" | "bank_transfer";
  reference: string | null;
  remarks: string | null;
  confirmed_at: string;
}

export interface OldPurchaseDetail {
  id: string;
  purchase_no: string;
  customer_id: string;
  customer: { name: string; phone: string; email?: string; address?: string };
  source: "billing_exchange" | "standalone";
  linked_invoice_id: string | null;
  linked_invoice_no: string | null;
  items: OldPurchaseItemDetail[];
  total_purchase_value: number;
  applied_to_invoice: number;
  excess_amount: number;
  excess_settlement: "refund" | "credit" | null;
  refund: OldPurchaseRefundDetail | null;
  status: "active" | "cancelled";
  created_at: string;
}

export function useOldPurchaseDetail(id: string) {
  return useQuery({
    queryKey: ["old-purchase", id],
    queryFn: () => apiClient.get<OldPurchaseDetail>(`/old-purchases/${id}`),
    enabled: !!id,
  });
}
