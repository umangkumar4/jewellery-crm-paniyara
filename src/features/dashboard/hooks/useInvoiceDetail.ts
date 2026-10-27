import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
// Same per-item shape the server's serializeOldJewelleryItemLine() produces
// - reused here rather than redefined, so this type can never silently
// drift from what GET /api/old-purchases/:id already uses it for.
import type { OldPurchaseItemDetail } from "@/features/dashboard/hooks/useOldPurchaseDetail";

export interface InvoiceItemDetail {
  sr_no: number;
  tag_code: string | null;
  description: string;
  hsn_code: string;
  metal: string;
  purity: string;
  pieces: number;
  gross_wt_g: number;
  stone_wt_g: number;
  net_wt_g: number;
  rate_per_gram: number;
  making_charge: number;
  stone_charge: number;
  total: number;
  buyer_code: string;
}

export interface InvoicePaymentDetail {
  amount: number;
  mode: "cash" | "upi" | "card" | "bank_transfer";
  paid_at: string;
}

export interface InvoiceOldJewelleryExcess {
  amount: number;
  refund: {
    amount: number;
    mode: "cash" | "upi" | "bank_transfer";
    reference: string | null;
    remarks: string | null;
    confirmed_at: string;
  } | null;
}

// "none"/"partial"/"exact"/"excess" - see invoicesService.ts's
// classifyExchangeSettlement() for the authoritative logic (computed once,
// server-side, so this page and the print page can never classify the same
// invoice differently).
export type ExchangeSettlementType = "none" | "partial" | "exact" | "excess";

export interface InvoiceDetail {
  id: string;
  invoice_no: string;
  customer_id: string;
  customer: { name: string; phone: string; email?: string; address?: string };
  items: InvoiceItemDetail[];
  payments: InvoicePaymentDetail[];
  subtotal: number;
  discount_amount: number;
  // Optional at the schema level (Invoice.model.ts has no `required` on any
  // of these) - genuinely can be undefined on the wire for a document
  // written outside the normal createInvoice() flow, so every reader must
  // handle that rather than assume non-null.
  gst_percent?: number;
  gst_amount?: number;
  cgst_percent?: number;
  sgst_percent?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  grand_total: number;
  paid_amount: number;
  pending_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  // Required/defaulted at the Mongoose level (0/null, not undefined) -
  // always present, unlike the GST fields above. 0/null for every ordinary
  // invoice with no old jewellery exchange.
  exchange_applied: number;
  linked_old_purchase_id: string | null;
  linked_old_purchase_no: string | null;
  // [] for every ordinary invoice with no old jewellery exchange - embedded
  // server-side (invoicesService.ts's findOldJewelleryExchangeItems()) so
  // the detail/print pages don't need a second request to
  // GET /api/old-purchases/:id just to render this.
  old_jewellery_items: OldPurchaseItemDetail[];
  // null for every ordinary invoice and for every exchange that didn't
  // exceed the bill - composed server-side from the linked
  // OldJewelleryPurchase document (invoicesService.ts's
  // findOldJewelleryExcessRefund()), same pattern as old_jewellery_items.
  old_jewellery_excess: InvoiceOldJewelleryExcess | null;
  // Always present - the server always computes and includes it.
  exchange_settlement_type: ExchangeSettlementType;
  created_at: string;
}

export function useInvoiceDetail(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiClient.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
  });
}

// Same response shape as the detail endpoint - kept as its own hook/query
// key so the print page's fetch is independently cacheable from the detail
// page's, even though both will usually return identical data.
export function useInvoicePrintData(id: string) {
  return useQuery({
    queryKey: ["invoice-print", id],
    queryFn: () => apiClient.get<InvoiceDetail>(`/invoices/${id}/print`),
    enabled: !!id,
  });
}
