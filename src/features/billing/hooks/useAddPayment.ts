import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AddInvoicePaymentInput } from "@/schemas/invoice.schema";

export interface AddPaymentResult {
  invoice_id: string;
  saved: boolean;
}

export function useAddPayment(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddInvoicePaymentInput) =>
      apiClient.post<AddPaymentResult>(`/invoices/${invoiceId}/payments`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
